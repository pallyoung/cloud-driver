import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
export const workspaceRoot = path.resolve(scriptDir, '../..');
export const ports = {
  api: 3201,
  web: 4173,
};

export const credentials = {
  password: 'demo123456',
  sessionSecret: 'cloud-driver-e2e-secret',
};

export const runtimePaths = {
  root: path.join(workspaceRoot, 'tmp', 'e2e-runtime'),
  docsRoot: path.join(workspaceRoot, 'tmp', 'e2e-runtime', 'roots', 'docs'),
  mediaRoot: path.join(workspaceRoot, 'tmp', 'e2e-runtime', 'roots', 'media'),
  rootsConfigPath: path.join(workspaceRoot, 'tmp', 'e2e-runtime', 'config', 'roots.yaml'),
  sqlitePath: path.join(workspaceRoot, 'tmp', 'e2e-runtime', 'data', 'cloud-driver.db'),
  logDir: path.join(workspaceRoot, 'tmp', 'e2e-runtime', 'logs'),
  tempExportDir: path.join(workspaceRoot, 'tmp', 'e2e-runtime', 'exports'),
  mockBackupRoot: path.join(workspaceRoot, 'tmp', 'e2e-runtime', 'mock-quark'),
  downloadsDir: path.join(workspaceRoot, 'tmp', 'e2e-runtime', 'downloads'),
  screenshotsDir: path.join(workspaceRoot, 'output', 'playwright'),
};
