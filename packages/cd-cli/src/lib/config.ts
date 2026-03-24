import { existsSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { parse, stringify } from 'yaml';
import { ensureDirectory, writeTextAtomic } from './fs-utils.js';
import { createPasswordHash, createSessionSecret } from './password.js';
import { getAppConfigPath, getRootsConfigPath, resolveHomePath } from './paths.js';
import { promptPasswordWithConfirmation } from './prompt.js';

export type AppConfig = {
  configVersion: number;
  server: {
    host: string;
    port: number;
  };
  auth: {
    mode: 'single-user-password';
    passwordHash: string;
    sessionSecret: string;
  };
  storage: {
    sqlitePath: string;
    logDir: string;
    tempExportDir: string;
    exportTtlMinutes: number;
    mockBackupRoot: string;
  };
  features: {
    backupProvider: string;
  };
};

export type ManagedWorkspace = {
  id: string;
  label: string;
  path: string;
  readOnly: boolean;
};

export type RootsConfig = {
  roots: ManagedWorkspace[];
};

function assertObject(value: unknown, message: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(message);
  }

  return value as Record<string, unknown>;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function createDefaultAppConfig(): AppConfig {
  return {
    configVersion: 1,
    server: {
      host: '127.0.0.1',
      port: 3001,
    },
    auth: {
      mode: 'single-user-password',
      passwordHash: '',
      sessionSecret: createSessionSecret(),
    },
    storage: {
      sqlitePath: './data/cloud-driver.db',
      logDir: './logs',
      tempExportDir: './tmp/exports',
      exportTtlMinutes: 30,
      mockBackupRoot: './tmp/mock-backup',
    },
    features: {
      backupProvider: 'mock',
    },
  };
}

export function normalizeAppConfig(raw: unknown): AppConfig {
  const root = assertObject(raw, 'app.json must be an object.');
  const server = assertObject(root.server, 'app.json server is required.');
  const auth = assertObject(root.auth, 'app.json auth is required.');
  const storage = assertObject(root.storage, 'app.json storage is required.');
  const features = assertObject(root.features, 'app.json features is required.');

  return {
    configVersion: asNumber(root.configVersion, 1),
    server: {
      host: asString(server.host, '127.0.0.1'),
      port: asNumber(server.port, 3001),
    },
    auth: {
      mode: 'single-user-password',
      passwordHash: asString(auth.passwordHash),
      sessionSecret: asString(auth.sessionSecret, createSessionSecret()),
    },
    storage: {
      sqlitePath: asString(storage.sqlitePath, './data/cloud-driver.db'),
      logDir: asString(storage.logDir, './logs'),
      tempExportDir: asString(storage.tempExportDir, './tmp/exports'),
      exportTtlMinutes: asNumber(storage.exportTtlMinutes, 30),
      mockBackupRoot: asString(storage.mockBackupRoot, './tmp/mock-backup'),
    },
    features: {
      backupProvider: asString(features.backupProvider, 'mock'),
    },
  };
}

export async function loadAppConfig(runtimeHome: string): Promise<AppConfig> {
  const appConfigPath = getAppConfigPath(runtimeHome);
  const raw = await readFile(appConfigPath, 'utf8');
  return normalizeAppConfig(JSON.parse(raw));
}

export async function saveAppConfig(runtimeHome: string, config: AppConfig): Promise<void> {
  const appConfigPath = getAppConfigPath(runtimeHome);
  await writeTextAtomic(appConfigPath, `${JSON.stringify(config, null, 2)}\n`);
}

export async function loadRootsConfig(runtimeHome: string): Promise<RootsConfig> {
  const rootsConfigPath = getRootsConfigPath(runtimeHome);
  const raw = await readFile(rootsConfigPath, 'utf8');
  const parsed = parse(raw) as { roots?: unknown } | null;
  const roots = Array.isArray(parsed?.roots) ? parsed.roots : [];

  return {
    roots: roots.map((entry) => {
      const item = assertObject(entry, 'Invalid workspace entry in roots.yaml.');
      return {
        id: asString(item.id),
        label: asString(item.label),
        path: asString(item.path),
        readOnly: asBoolean(item.readOnly, false),
      };
    }),
  };
}

export async function saveRootsConfig(runtimeHome: string, rootsConfig: RootsConfig): Promise<void> {
  const rootsConfigPath = getRootsConfigPath(runtimeHome);
  await writeTextAtomic(rootsConfigPath, stringify(rootsConfig));
}

export async function ensureRuntimeDirectories(runtimeHome: string, config: AppConfig): Promise<void> {
  await ensureDirectory(path.join(runtimeHome, 'config'));
  await ensureDirectory(path.join(runtimeHome, 'run'));
  await ensureDirectory(path.join(runtimeHome, 'data'));
  await ensureDirectory(resolveHomePath(runtimeHome, config.storage.logDir));
  await ensureDirectory(resolveHomePath(runtimeHome, config.storage.tempExportDir));
  await ensureDirectory(path.dirname(resolveHomePath(runtimeHome, config.storage.sqlitePath)));
  await ensureDirectory(resolveHomePath(runtimeHome, config.storage.mockBackupRoot));
}

export async function initializeRuntime(runtimeHome: string, options: {
  password?: string;
  host?: string;
  port?: number;
}): Promise<{ config: AppConfig; created: boolean }> {
  await ensureDirectory(runtimeHome);

  const appConfigPath = getAppConfigPath(runtimeHome);
  const rootsConfigPath = getRootsConfigPath(runtimeHome);
  const configExists = existsSync(appConfigPath);
  const rootsExist = existsSync(rootsConfigPath);

  const config = configExists ? await loadAppConfig(runtimeHome) : createDefaultAppConfig();

  if (options.host) {
    config.server.host = options.host;
  }

  if (options.port) {
    config.server.port = options.port;
  }

  if (!config.auth.sessionSecret) {
    config.auth.sessionSecret = createSessionSecret();
  }

  if (!config.auth.passwordHash) {
    const password = options.password ?? (await promptPasswordWithConfirmation());
    config.auth.passwordHash = createPasswordHash(password);
  }

  await ensureRuntimeDirectories(runtimeHome, config);
  await saveAppConfig(runtimeHome, config);

  if (!rootsExist) {
    await saveRootsConfig(runtimeHome, { roots: [] });
  }

  return {
    config,
    created: !configExists,
  };
}

export function assertRunnableConfig(config: AppConfig): void {
  if (!config.auth.passwordHash) {
    throw new Error('Password is not configured. Run `cd-cli password set` first.');
  }

  if (!config.auth.sessionSecret) {
    throw new Error('Session secret is not configured. Run `cd-cli init` again.');
  }

  if (!config.server.host) {
    throw new Error('Server host is not configured.');
  }

  if (!Number.isInteger(config.server.port) || config.server.port <= 0) {
    throw new Error('Server port must be a positive integer.');
  }
}

export async function setPassword(runtimeHome: string, password?: string): Promise<AppConfig> {
  const config = await loadAppConfig(runtimeHome);
  const nextPassword = password ?? (await promptPasswordWithConfirmation());
  config.auth.passwordHash = createPasswordHash(nextPassword);
  await saveAppConfig(runtimeHome, config);
  return config;
}

export async function addWorkspace(runtimeHome: string, input: ManagedWorkspace): Promise<RootsConfig> {
  const rootsConfig = await loadRootsConfig(runtimeHome);

  if (rootsConfig.roots.some((root) => root.id === input.id)) {
    throw new Error(`Workspace id \`${input.id}\` already exists.`);
  }

  const workspaceStat = await stat(input.path);

  if (!workspaceStat.isDirectory()) {
    throw new Error('Workspace path must point to a directory.');
  }

  rootsConfig.roots.push({
    ...input,
    path: path.resolve(input.path),
  });
  rootsConfig.roots.sort((left, right) => left.label.localeCompare(right.label));
  await saveRootsConfig(runtimeHome, rootsConfig);
  return rootsConfig;
}

export async function removeWorkspace(runtimeHome: string, id: string): Promise<RootsConfig> {
  const rootsConfig = await loadRootsConfig(runtimeHome);
  const nextRoots = rootsConfig.roots.filter((root) => root.id !== id);

  if (nextRoots.length === rootsConfig.roots.length) {
    throw new Error(`Workspace id \`${id}\` was not found.`);
  }

  const nextConfig = { roots: nextRoots };
  await saveRootsConfig(runtimeHome, nextConfig);
  return nextConfig;
}

export async function updateWorkspace(runtimeHome: string, id: string, patch: {
  label?: string;
  readOnly?: boolean;
}): Promise<RootsConfig> {
  const rootsConfig = await loadRootsConfig(runtimeHome);
  const target = rootsConfig.roots.find((root) => root.id === id);

  if (!target) {
    throw new Error(`Workspace id \`${id}\` was not found.`);
  }

  if (patch.label) {
    target.label = patch.label;
  }

  if (typeof patch.readOnly === 'boolean') {
    target.readOnly = patch.readOnly;
  }

  await saveRootsConfig(runtimeHome, rootsConfig);
  return rootsConfig;
}
