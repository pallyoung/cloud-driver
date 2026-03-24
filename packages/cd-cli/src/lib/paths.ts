import os from 'node:os';
import path from 'node:path';

export function resolveRuntimeHome(explicitHome?: string): string {
  if (explicitHome) {
    return path.resolve(explicitHome);
  }

  const envHome = process.env.CLOUD_DRIVER_HOME?.trim();

  if (envHome) {
    return path.resolve(envHome);
  }

  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'cloud-driver');
  }

  if (process.platform === 'win32') {
    const base =
      process.env.LOCALAPPDATA ?? process.env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Local');
    return path.join(base, 'Cloud Driver');
  }

  const xdgDataHome = process.env.XDG_DATA_HOME ?? path.join(os.homedir(), '.local', 'share');
  return path.join(xdgDataHome, 'cloud-driver');
}

export function resolveHomePath(runtimeHome: string, targetPath: string): string {
  return path.isAbsolute(targetPath) ? targetPath : path.resolve(runtimeHome, targetPath);
}

export function getAppConfigPath(runtimeHome: string): string {
  return path.join(runtimeHome, 'config', 'app.json');
}

export function getRootsConfigPath(runtimeHome: string): string {
  return path.join(runtimeHome, 'config', 'roots.yaml');
}

export function getRunDir(runtimeHome: string): string {
  return path.join(runtimeHome, 'run');
}

export function getPidFilePath(runtimeHome: string): string {
  return path.join(getRunDir(runtimeHome), 'server.pid');
}

export function getMetadataPath(runtimeHome: string): string {
  return path.join(getRunDir(runtimeHome), 'server.json');
}
