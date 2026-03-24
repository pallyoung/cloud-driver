import { spawn } from 'node:child_process';
import { ensureE2ERuntime } from './setup.mjs';
import { credentials, ports, runtimePaths, workspaceRoot } from './runtime.mjs';

const { passwordHash } = await ensureE2ERuntime();

process.env.APP_PORT = String(ports.api);
process.env.WEB_PORT = String(ports.web);
process.env.SESSION_SECRET = credentials.sessionSecret;
process.env.PASSWORD_HASH = passwordHash;
process.env.ROOTS_CONFIG_PATH = runtimePaths.rootsConfigPath;
process.env.SQLITE_PATH = runtimePaths.sqlitePath;
process.env.LOG_DIR = runtimePaths.logDir;
process.env.TEMP_EXPORT_DIR = runtimePaths.tempExportDir;
process.env.EXPORT_TTL_MINUTES = '30';
process.env.BACKUP_PROVIDER = 'mock';
process.env.MOCK_BACKUP_ROOT = runtimePaths.mockBackupRoot;
process.env.NODE_ENV = 'test';

const child = spawn(
  'pnpm',
  ['--filter', '@cloud-driver/api', 'exec', 'tsx', 'src/index.ts'],
  {
    cwd: workspaceRoot,
    env: process.env,
    stdio: 'inherit',
  },
);

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
