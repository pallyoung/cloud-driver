import { existsSync } from 'node:fs';
import path from 'node:path';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ManagedRoot, BackupProviderStatus } from '@cloud-driver/shared';
import { createBackupProvider } from '@cloud-driver/quark-adapter';
import { env } from './config/env.js';
import { loadManagedRoots } from './config/roots.js';
import { resolveFromWorkspace } from './config/resolve-path.js';
import { BackupJobService } from './lib/backup-jobs.js';
import { getResolvedSqlitePath } from './lib/database.js';
import { ExportJobService } from './lib/export-jobs.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerBackupRoutes } from './routes/backups.js';
import { registerExportRoutes } from './routes/exports.js';
import { registerFileRoutes } from './routes/files.js';
import { registerHealthRoutes } from './routes/health.js';
import { registerJobRoutes } from './routes/jobs.js';
import { registerRootRoutes } from './routes/roots.js';

declare module 'fastify' {
  interface FastifyInstance {
    managedRoots: ManagedRoot[];
    exportJobService: ExportJobService;
    backupJobService: BackupJobService;
    backupProviderStatus: BackupProviderStatus | null;
    runtimeConfig: {
      passwordHash: string;
      sessionSecret: string;
      webDistPath: string | null;
    };
    isAuthenticated(request: FastifyRequest): boolean;
  }
}

const PUBLIC_API_PREFIXES = ['/api/auth', '/api/health'];

export type BuildServerOptions = {
  webDistPath?: string | null;
};

export type StartServerOptions = BuildServerOptions & {
  host?: string;
  port?: number;
};

function resolveWebDistPath(webDistPath: string | null | undefined): string | null {
  if (!webDistPath) {
    return null;
  }

  return resolveFromWorkspace(webDistPath);
}

async function registerWebRuntime(app: FastifyInstance, webDistPath: string | null) {
  if (!webDistPath) {
    return;
  }

  if (!existsSync(webDistPath)) {
    app.log.warn({ webDistPath }, 'WEB_DIST_PATH does not exist, skipping static web hosting');
    return;
  }

  await app.register(fastifyStatic, {
    root: webDistPath,
    serve: false,
  });

  app.route({
    method: ['GET', 'HEAD'],
    url: '/*',
    handler: async (request, reply) => {
      const pathname = request.url.split('?')[0];

      if (pathname.startsWith('/api')) {
        return reply.code(404).send({ message: 'Not Found' });
      }

      const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');

      if (path.extname(relativePath)) {
        return reply.sendFile(relativePath);
      }

      return reply.sendFile('index.html');
    },
  });
}

export async function buildServer(options: BuildServerOptions = {}) {
  const resolvedWebDistPath = resolveWebDistPath(options.webDistPath ?? env.WEB_DIST_PATH);

  const app = Fastify({
    logger: {
      transport:
        process.env.NODE_ENV === 'production'
          ? undefined
          : {
              target: 'pino-pretty',
              options: { translateTime: 'SYS:standard' },
            },
    },
  });

  app.runtimeConfig = {
    passwordHash: env.PASSWORD_HASH,
    sessionSecret: env.SESSION_SECRET,
    webDistPath: resolvedWebDistPath,
  };

  await app.register(cookie, {
    secret: env.SESSION_SECRET,
  });
  await app.register(multipart);
  await app.register(cors, {
    origin: true,
    credentials: true,
  });

  app.managedRoots = await loadManagedRoots(env.ROOTS_CONFIG_PATH);
  app.exportJobService = new ExportJobService(app.managedRoots);
  await app.exportJobService.initialize();

  const backupProvider = createBackupProvider({
    provider: env.BACKUP_PROVIDER,
    mockRoot: resolveFromWorkspace(env.MOCK_BACKUP_ROOT),
    quarkCookie: env.QUARK_COOKIE,
  });

  app.backupJobService = new BackupJobService(app.managedRoots, backupProvider);
  await app.backupJobService.initialize();
  app.backupProviderStatus = await app.backupJobService.getProviderStatus();

  app.decorate('isAuthenticated', (request: FastifyRequest) => {
    const signedCookie = request.cookies.cloud_driver_session;

    if (!signedCookie) {
      return false;
    }

    const verification = request.unsignCookie(signedCookie);
    return verification.valid && verification.value === 'authenticated';
  });

  app.addHook('preHandler', async (request, reply) => {
    const pathname = request.url.split('?')[0];

    if (!pathname.startsWith('/api')) {
      return;
    }

    if (PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
      return;
    }

    if (!app.isAuthenticated(request)) {
      return reply.code(401).send({ message: 'Unauthorized' });
    }
  });

  await registerAuthRoutes(app);
  await registerHealthRoutes(app);
  await registerRootRoutes(app);
  await registerFileRoutes(app);
  await registerExportRoutes(app);
  await registerBackupRoutes(app);
  await registerJobRoutes(app);

  app.get('/api/settings', async () => {
    app.backupProviderStatus = await app.backupJobService.getProviderStatus();

    return {
      rootsConfigPath: env.ROOTS_CONFIG_PATH,
      sqlitePath: getResolvedSqlitePath(),
      tempExportDir: env.TEMP_EXPORT_DIR,
      exportTtlMinutes: env.EXPORT_TTL_MINUTES,
      backupProvider: env.BACKUP_PROVIDER,
      backupProviderStatus: app.backupProviderStatus,
      roots: app.managedRoots,
      webDistPath: app.runtimeConfig.webDistPath,
    };
  });

  await registerWebRuntime(app, resolvedWebDistPath);

  const cleanupTimer = setInterval(() => {
    void app.exportJobService.cleanupExpiredJobs();
  }, 60 * 1000);

  app.addHook('onClose', async () => {
    clearInterval(cleanupTimer);
  });

  return app;
}

export async function startServer(options: StartServerOptions = {}) {
  const app = await buildServer(options);

  try {
    await app.listen({
      port: options.port ?? env.APP_PORT,
      host: options.host ?? env.APP_HOST,
    });
  } catch (error) {
    app.log.error(error);
    throw error;
  }

  return app;
}
