import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AppConfig } from './config.js';
import { getRootsConfigPath, resolveHomePath } from './paths.js';

export type RuntimeMetadata = {
  pid: number;
  host: string;
  port: number;
  url: string;
  runtimeHome: string;
  logPath: string;
  errorLogPath: string;
  startedAt: string;
};

function getDistRoot(): string {
  const currentFile = fileURLToPath(import.meta.url);
  return path.resolve(path.dirname(currentFile), '..');
}

export function resolveServerEntry(): string {
  const serverEntry = path.join(getDistRoot(), 'runtime', 'server.cjs');

  if (!existsSync(serverEntry)) {
    throw new Error(`Server runtime bundle is missing at ${serverEntry}. Run the CLI build first.`);
  }

  return serverEntry;
}

export function resolveWebDistPath(): string | undefined {
  const distRoot = getDistRoot();
  const packagedWebDist = path.join(distRoot, 'runtime', 'web');

  if (existsSync(path.join(packagedWebDist, 'index.html'))) {
    return packagedWebDist;
  }

  const workspaceWebDist = path.resolve(distRoot, '../../../apps/web/dist');

  if (existsSync(path.join(workspaceWebDist, 'index.html'))) {
    return workspaceWebDist;
  }

  return undefined;
}

export function resolveServiceUrl(host: string, port: number): string {
  const printableHost = host === '0.0.0.0' || host === '::' ? '127.0.0.1' : host;
  return `http://${printableHost}:${port}`;
}

export function buildServerEnv(runtimeHome: string, config: AppConfig): NodeJS.ProcessEnv {
  const webDistPath = resolveWebDistPath();

  return {
    ...process.env,
    APP_HOST: config.server.host,
    APP_PORT: String(config.server.port),
    SESSION_SECRET: config.auth.sessionSecret,
    PASSWORD_HASH: config.auth.passwordHash,
    ROOTS_CONFIG_PATH: getRootsConfigPath(runtimeHome),
    SQLITE_PATH: resolveHomePath(runtimeHome, config.storage.sqlitePath),
    LOG_DIR: resolveHomePath(runtimeHome, config.storage.logDir),
    TEMP_EXPORT_DIR: resolveHomePath(runtimeHome, config.storage.tempExportDir),
    EXPORT_TTL_MINUTES: String(config.storage.exportTtlMinutes),
    BACKUP_PROVIDER: config.features.backupProvider,
    MOCK_BACKUP_ROOT: resolveHomePath(runtimeHome, config.storage.mockBackupRoot),
    WEB_DIST_PATH: webDistPath,
    NODE_ENV: process.env.NODE_ENV ?? 'production',
  };
}
