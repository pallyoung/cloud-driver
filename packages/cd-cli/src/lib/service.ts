import { spawn } from 'node:child_process';
import { closeSync, existsSync, openSync } from 'node:fs';
import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import type { AppConfig } from './config.js';
import { assertRunnableConfig, ensureRuntimeDirectories } from './config.js';
import { writeTextAtomic } from './fs-utils.js';
import { getMetadataPath, getPidFilePath, resolveHomePath } from './paths.js';
import { buildServerEnv, resolveServerEntry, resolveServiceUrl, type RuntimeMetadata } from './runtime.js';

export type ServiceStatus = {
  initialized: boolean;
  running: boolean;
  healthy: boolean;
  metadata: RuntimeMetadata | null;
};

async function writeRuntimeMetadata(runtimeHome: string, metadata: RuntimeMetadata): Promise<void> {
  await writeTextAtomic(getPidFilePath(runtimeHome), `${metadata.pid}\n`);
  await writeTextAtomic(getMetadataPath(runtimeHome), `${JSON.stringify(metadata, null, 2)}\n`);
}

async function removeRuntimeMetadata(runtimeHome: string): Promise<void> {
  await Promise.allSettled([
    rm(getPidFilePath(runtimeHome), { force: true }),
    rm(getMetadataPath(runtimeHome), { force: true }),
  ]);
}

export async function readRuntimeMetadata(runtimeHome: string): Promise<RuntimeMetadata | null> {
  const metadataPath = getMetadataPath(runtimeHome);

  if (!existsSync(metadataPath)) {
    return null;
  }

  const raw = await readFile(metadataPath, 'utf8');
  return JSON.parse(raw) as RuntimeMetadata;
}

export function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function waitForCondition(check: () => Promise<boolean>, timeoutMs: number, intervalMs: number) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (await check()) {
      return true;
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  return false;
}

export async function checkHealth(url: string): Promise<boolean> {
  try {
    const response = await fetch(`${url}/api/health/live`, {
      signal: AbortSignal.timeout(1000),
    });

    return response.ok;
  } catch {
    return false;
  }
}

export async function getServiceStatus(runtimeHome: string): Promise<ServiceStatus> {
  const metadata = await readRuntimeMetadata(runtimeHome);

  if (!metadata) {
    return {
      initialized: false,
      running: false,
      healthy: false,
      metadata: null,
    };
  }

  const running = isProcessAlive(metadata.pid);

  if (!running) {
    await removeRuntimeMetadata(runtimeHome);
    return {
      initialized: true,
      running: false,
      healthy: false,
      metadata: null,
    };
  }

  const healthy = await checkHealth(metadata.url);

  return {
    initialized: true,
    running,
    healthy,
    metadata,
  };
}

export async function startDetached(runtimeHome: string, config: AppConfig): Promise<RuntimeMetadata> {
  assertRunnableConfig(config);
  await ensureRuntimeDirectories(runtimeHome, config);
  const configuredUrl = resolveServiceUrl(config.server.host, config.server.port);

  const existingStatus = await getServiceStatus(runtimeHome);

  if (existingStatus.running && existingStatus.metadata) {
    throw new Error(`Cloud Driver is already running at ${existingStatus.metadata.url} (pid ${existingStatus.metadata.pid}).`);
  }

  if (await checkHealth(configuredUrl)) {
    throw new Error(
      `A Cloud Driver instance is already responding at ${configuredUrl}, but local runtime metadata is missing. Stop the existing process before starting a new one.`,
    );
  }

  const serverEntry = resolveServerEntry();
  const logPath = path.join(resolveHomePath(runtimeHome, config.storage.logDir), 'server.log');
  const errorLogPath = path.join(resolveHomePath(runtimeHome, config.storage.logDir), 'server.error.log');
  const outputFd = openSync(logPath, 'a');
  const errorFd = openSync(errorLogPath, 'a');
  const metadata: RuntimeMetadata = {
    pid: -1,
    host: config.server.host,
    port: config.server.port,
    url: configuredUrl,
    runtimeHome,
    logPath,
    errorLogPath,
    startedAt: new Date().toISOString(),
  };

  try {
    const child = spawn(process.execPath, [serverEntry], {
      detached: true,
      cwd: runtimeHome,
      stdio: ['ignore', outputFd, errorFd],
      env: buildServerEnv(runtimeHome, config),
    });

    metadata.pid = child.pid ?? -1;
    child.unref();
    await writeRuntimeMetadata(runtimeHome, metadata);
  } finally {
    closeSync(outputFd);
    closeSync(errorFd);
  }

  const healthy = await waitForCondition(async () => {
    if (metadata.pid <= 0 || !isProcessAlive(metadata.pid)) {
      return false;
    }

    return checkHealth(metadata.url);
  }, 10_000, 250);

  if (!healthy) {
    if (metadata.pid > 0 && isProcessAlive(metadata.pid)) {
      process.kill(metadata.pid, 'SIGTERM');
    }

    await removeRuntimeMetadata(runtimeHome);
    throw new Error(`Cloud Driver failed to start. Check logs at ${metadata.errorLogPath}.`);
  }

  return metadata;
}

export async function stopDetached(runtimeHome: string): Promise<boolean> {
  const metadata = await readRuntimeMetadata(runtimeHome);

  if (!metadata) {
    return false;
  }

  if (!isProcessAlive(metadata.pid)) {
    await removeRuntimeMetadata(runtimeHome);
    return false;
  }

  process.kill(metadata.pid, 'SIGTERM');

  const stopped = await waitForCondition(async () => !isProcessAlive(metadata.pid), 8_000, 250);

  if (!stopped && isProcessAlive(metadata.pid)) {
    process.kill(metadata.pid, 'SIGKILL');
    await waitForCondition(async () => !isProcessAlive(metadata.pid), 2_000, 100);
  }

  if (isProcessAlive(metadata.pid)) {
    throw new Error(`Failed to stop Cloud Driver process ${metadata.pid}.`);
  }

  await removeRuntimeMetadata(runtimeHome);
  return true;
}

export async function runForeground(runtimeHome: string, config: AppConfig): Promise<number> {
  assertRunnableConfig(config);
  await ensureRuntimeDirectories(runtimeHome, config);

  const serverEntry = resolveServerEntry();

  const child = spawn(process.execPath, [serverEntry], {
    cwd: runtimeHome,
    stdio: 'inherit',
    env: buildServerEnv(runtimeHome, config),
  });

  return new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (signal) {
        resolve(1);
        return;
      }

      resolve(code ?? 0);
    });
  });
}
