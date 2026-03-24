import path from 'node:path';
import { existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import {
  addWorkspace,
  initializeRuntime,
  loadAppConfig,
  loadRootsConfig,
  removeWorkspace,
  saveAppConfig,
  setPassword,
  updateWorkspace,
} from './lib/config.js';
import { openBrowser } from './lib/open-browser.js';
import { parseArgs, getBooleanOption, getStringOption } from './lib/options.js';
import { getAppConfigPath, getRootsConfigPath, resolveRuntimeHome } from './lib/paths.js';
import { resolveServiceUrl, resolveWebDistPath } from './lib/runtime.js';
import { checkHealth, getServiceStatus, runForeground, startDetached, stopDetached } from './lib/service.js';

function printHelp(): void {
  console.log(`Cloud Driver CLI

Usage:
  cd-cli init [--home <path>] [--password <password>] [--host <host>] [--port <port>]
  cd-cli start [--home <path>]
  cd-cli run [--home <path>]
  cd-cli stop [--home <path>]
  cd-cli restart [--home <path>]
  cd-cli status [--home <path>]
  cd-cli open [--home <path>] [--print-only]
  cd-cli logs [--home <path>]
  cd-cli doctor [--home <path>]
  cd-cli password set [--home <path>] [--password <password>]
  cd-cli workspace list [--home <path>]
  cd-cli workspace add <path> [--home <path>] [--id <id>] [--label <label>] [--read-only]
  cd-cli workspace remove <id> [--home <path>]
  cd-cli workspace update <id> [--home <path>] [--label <label>] [--read-only <true|false>]
  cd-cli config show [--home <path>]
  cd-cli config path [--home <path>]
  cd-cli config set <host|port> <value> [--home <path>]
`);
}

function resolveHome(options: Record<string, string | boolean>): string {
  const explicitHome = typeof options.home === 'string' ? options.home : undefined;
  return resolveRuntimeHome(explicitHome);
}

function parsePort(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const port = Number.parseInt(value, 10);

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error('Port must be a positive integer.');
  }

  return port;
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'workspace';
}

async function requireInitializedHome(runtimeHome: string) {
  const configPath = getAppConfigPath(runtimeHome);

  if (!existsSync(configPath)) {
    throw new Error(`Runtime home is not initialized: ${runtimeHome}. Run \`cd-cli init\` first.`);
  }

  return loadAppConfig(runtimeHome);
}

async function notifyRestartIfRunning(runtimeHome: string) {
  const status = await getServiceStatus(runtimeHome);

  if (status.running) {
    console.log('Config updated. Run `cd-cli restart` to apply changes to the running service.');
  }
}

async function handleInit(args: string[]) {
  const parsed = parseArgs(args);
  const runtimeHome = resolveHome(parsed.options);
  const password = getStringOption(parsed, 'password');
  const host = getStringOption(parsed, 'host');
  const port = parsePort(getStringOption(parsed, 'port'));
  const result = await initializeRuntime(runtimeHome, { password, host, port });

  console.log(result.created ? 'Initialized Cloud Driver runtime.' : 'Cloud Driver runtime already existed and was updated.');
  console.log(`Runtime home: ${runtimeHome}`);
  console.log(`Config: ${getAppConfigPath(runtimeHome)}`);
  console.log(`URL: ${resolveServiceUrl(result.config.server.host, result.config.server.port)}`);
}

async function handleStart(args: string[]) {
  const parsed = parseArgs(args);
  const runtimeHome = resolveHome(parsed.options);
  const config = await requireInitializedHome(runtimeHome);
  const metadata = await startDetached(runtimeHome, config);

  console.log('Cloud Driver started.');
  console.log(`PID: ${metadata.pid}`);
  console.log(`URL: ${metadata.url}`);
  console.log(`Log: ${metadata.logPath}`);
  console.log(`Error log: ${metadata.errorLogPath}`);
}

async function handleRun(args: string[]) {
  const parsed = parseArgs(args);
  const runtimeHome = resolveHome(parsed.options);
  const config = await requireInitializedHome(runtimeHome);
  const exitCode = await runForeground(runtimeHome, config);
  return exitCode;
}

async function handleStop(args: string[]) {
  const parsed = parseArgs(args);
  const runtimeHome = resolveHome(parsed.options);
  const stopped = await stopDetached(runtimeHome);
  console.log(stopped ? 'Cloud Driver stopped.' : 'Cloud Driver is not running.');
}

async function handleRestart(args: string[]) {
  const parsed = parseArgs(args);
  const runtimeHome = resolveHome(parsed.options);
  const existingStatus = await getServiceStatus(runtimeHome);

  if (existingStatus.running && existingStatus.metadata) {
    console.log(`Stopping existing Cloud Driver process ${existingStatus.metadata.pid}...`);
    await stopDetached(runtimeHome);
  } else {
    console.log('Cloud Driver is not currently running. Starting a new process...');
  }

  const config = await requireInitializedHome(runtimeHome);
  const metadata = await startDetached(runtimeHome, config);

  console.log(existingStatus.running ? 'Cloud Driver restarted.' : 'Cloud Driver started.');
  console.log(`PID: ${metadata.pid}`);
  console.log(`URL: ${metadata.url}`);
  console.log(`Log: ${metadata.logPath}`);
}

async function handleStatus(args: string[]) {
  const parsed = parseArgs(args);
  const runtimeHome = resolveHome(parsed.options);
  const status = await getServiceStatus(runtimeHome);
  const initialized = existsSync(getAppConfigPath(runtimeHome));

  console.log(`Runtime home: ${runtimeHome}`);
  console.log(`Initialized: ${initialized ? 'yes' : 'no'}`);
  console.log(`Running: ${status.running ? 'yes' : 'no'}`);
  console.log(`Healthy: ${status.healthy ? 'yes' : 'no'}`);

  if (status.metadata) {
    console.log(`PID: ${status.metadata.pid}`);
    console.log(`URL: ${status.metadata.url}`);
    console.log(`Started at: ${status.metadata.startedAt}`);
    console.log(`Log: ${status.metadata.logPath}`);
    console.log(`Error log: ${status.metadata.errorLogPath}`);
  }
}

async function handleOpen(args: string[]) {
  const parsed = parseArgs(args);
  const runtimeHome = resolveHome(parsed.options);
  const printOnly = getBooleanOption(parsed, 'print-only') ?? false;
  const config = await requireInitializedHome(runtimeHome);
  const status = await getServiceStatus(runtimeHome);
  const url = status.metadata?.url ?? resolveServiceUrl(config.server.host, config.server.port);

  if (!printOnly) {
    try {
      await openBrowser(url);
      console.log(`Opened ${url} in your default browser.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(`Automatic browser launch failed: ${message}`);
    }
  }

  console.log(url);
}

async function handleLogs(args: string[]) {
  const parsed = parseArgs(args);
  const runtimeHome = resolveHome(parsed.options);
  const config = await requireInitializedHome(runtimeHome);
  const logDir = path.resolve(runtimeHome, config.storage.logDir);
  console.log(path.join(logDir, 'server.log'));
  console.log(path.join(logDir, 'server.error.log'));
}

async function handleDoctor(args: string[]) {
  const parsed = parseArgs(args);
  const runtimeHome = resolveHome(parsed.options);
  const configPath = getAppConfigPath(runtimeHome);
  const rootsPath = getRootsConfigPath(runtimeHome);
  const webDistPath = resolveWebDistPath();
  const initialized = existsSync(configPath);
  const serviceStatus = await getServiceStatus(runtimeHome);

  console.log(`Runtime home: ${runtimeHome}`);
  console.log(`Node: ${process.version}`);
  console.log(`Platform: ${process.platform} ${process.arch}`);
  console.log(`Initialized: ${initialized ? 'yes' : 'no'}`);
  console.log(`Config path: ${configPath}`);
  console.log(`Roots path: ${rootsPath}`);
  console.log(`Bundled web: ${webDistPath ?? 'missing'}`);
  console.log(`Service running: ${serviceStatus.running ? 'yes' : 'no'}`);
  console.log(`Service healthy: ${serviceStatus.healthy ? 'yes' : 'no'}`);

  if (!initialized) {
    return;
  }

  const config = await loadAppConfig(runtimeHome);
  const rootsConfig = await loadRootsConfig(runtimeHome);
  const configuredUrl = resolveServiceUrl(config.server.host, config.server.port);
  const urlRespondingWithoutMetadata =
    !serviceStatus.running && (await checkHealth(configuredUrl));

  console.log(`Configured URL: ${configuredUrl}`);
  console.log(`Password configured: ${config.auth.passwordHash ? 'yes' : 'no'}`);
  console.log(`Session secret configured: ${config.auth.sessionSecret ? 'yes' : 'no'}`);
  console.log(`Workspace count: ${rootsConfig.roots.length}`);
  console.log(
    `Service responding without metadata: ${urlRespondingWithoutMetadata ? 'yes' : 'no'}`,
  );

  if (serviceStatus.metadata) {
    console.log(`PID: ${serviceStatus.metadata.pid}`);
    console.log(`Started at: ${serviceStatus.metadata.startedAt}`);
    console.log(`Log: ${serviceStatus.metadata.logPath}`);
    console.log(`Error log: ${serviceStatus.metadata.errorLogPath}`);
  }

  if (rootsConfig.roots.length === 0) {
    console.log('Workspaces: none configured');
    return;
  }

  for (const root of rootsConfig.roots) {
    try {
      const rootStat = await stat(root.path);
      const rootStatus = rootStat.isDirectory() ? 'ok' : 'not-directory';
      console.log(
        `Workspace ${root.id}: ${rootStatus} (${root.readOnly ? 'ro' : 'rw'}) ${root.path}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(
        `Workspace ${root.id}: missing (${root.readOnly ? 'ro' : 'rw'}) ${root.path} - ${message}`,
      );
    }
  }
}

async function handlePassword(args: string[]) {
  const [action, ...rest] = args;

  if (action !== 'set') {
    throw new Error('Usage: cd-cli password set [--home <path>] [--password <password>]');
  }

  const parsed = parseArgs(rest);
  const runtimeHome = resolveHome(parsed.options);
  const password = getStringOption(parsed, 'password');
  await requireInitializedHome(runtimeHome);
  await setPassword(runtimeHome, password);
  console.log('Password updated.');
  await notifyRestartIfRunning(runtimeHome);
}

async function handleWorkspace(args: string[]) {
  const [action, ...rest] = args;

  if (!action) {
    throw new Error('Usage: cd-cli workspace <list|add|remove|update>');
  }

  const parsed = parseArgs(rest);
  const runtimeHome = resolveHome(parsed.options);
  await requireInitializedHome(runtimeHome);

  if (action === 'list') {
    const rootsConfig = await loadRootsConfig(runtimeHome);

    if (rootsConfig.roots.length === 0) {
      console.log('No workspaces configured.');
      return;
    }

    for (const root of rootsConfig.roots) {
      console.log(`${root.id}\t${root.label}\t${root.readOnly ? 'ro' : 'rw'}\t${root.path}`);
    }
    return;
  }

  if (action === 'add') {
    const workspacePath = parsed.positionals[0];

    if (!workspacePath) {
      throw new Error('Usage: cd-cli workspace add <path> [--id <id>] [--label <label>] [--read-only]');
    }

    const absolutePath = path.resolve(workspacePath);
    const label = getStringOption(parsed, 'label') ?? path.basename(absolutePath);
    const id = getStringOption(parsed, 'id') ?? slugify(label);
    const readOnly = getBooleanOption(parsed, 'read-only') ?? false;
    await addWorkspace(runtimeHome, {
      id,
      label,
      path: absolutePath,
      readOnly,
    });
    console.log(`Workspace added: ${id}`);
    await notifyRestartIfRunning(runtimeHome);
    return;
  }

  if (action === 'remove') {
    const id = parsed.positionals[0];

    if (!id) {
      throw new Error('Usage: cd-cli workspace remove <id>');
    }

    await removeWorkspace(runtimeHome, id);
    console.log(`Workspace removed: ${id}`);
    await notifyRestartIfRunning(runtimeHome);
    return;
  }

  if (action === 'update') {
    const id = parsed.positionals[0];

    if (!id) {
      throw new Error('Usage: cd-cli workspace update <id> [--label <label>] [--read-only <true|false>]');
    }

    const label = getStringOption(parsed, 'label');
    const readOnly = getBooleanOption(parsed, 'read-only');

    if (!label && typeof readOnly !== 'boolean') {
      throw new Error('Provide at least one of --label or --read-only.');
    }

    await updateWorkspace(runtimeHome, id, { label, readOnly });
    console.log(`Workspace updated: ${id}`);
    await notifyRestartIfRunning(runtimeHome);
    return;
  }

  throw new Error(`Unknown workspace action: ${action}`);
}

async function handleConfig(args: string[]) {
  const [action, ...rest] = args;

  if (!action) {
    throw new Error('Usage: cd-cli config <show|path|set>');
  }

  const parsed = parseArgs(rest);
  const runtimeHome = resolveHome(parsed.options);

  if (action === 'path') {
    console.log(getAppConfigPath(runtimeHome));
    return;
  }

  if (action === 'show') {
    const config = await requireInitializedHome(runtimeHome);
    console.log(JSON.stringify(config, null, 2));
    return;
  }

  if (action === 'set') {
    const [key, value] = parsed.positionals;

    if (!key || !value) {
      throw new Error('Usage: cd-cli config set <host|port> <value>');
    }

    const config = await requireInitializedHome(runtimeHome);

    if (key === 'host') {
      config.server.host = value;
    } else if (key === 'port') {
      config.server.port = parsePort(value) ?? config.server.port;
    } else {
      throw new Error(`Unsupported config key: ${key}`);
    }

    await saveAppConfig(runtimeHome, config);
    console.log(`Config updated: ${key}=${value}`);
    await notifyRestartIfRunning(runtimeHome);
    return;
  }

  throw new Error(`Unknown config action: ${action}`);
}

export async function runCli(argv: string[]): Promise<number> {
  const [command, ...rest] = argv;

  if (!command || command === 'help' || command === '--help') {
    printHelp();
    return 0;
  }

  switch (command) {
    case 'init':
      await handleInit(rest);
      return 0;
    case 'start':
      await handleStart(rest);
      return 0;
    case 'run':
      return handleRun(rest);
    case 'stop':
      await handleStop(rest);
      return 0;
    case 'restart':
      await handleRestart(rest);
      return 0;
    case 'status':
      await handleStatus(rest);
      return 0;
    case 'open':
      await handleOpen(rest);
      return 0;
    case 'logs':
      await handleLogs(rest);
      return 0;
    case 'doctor':
      await handleDoctor(rest);
      return 0;
    case 'password':
      await handlePassword(rest);
      return 0;
    case 'workspace':
      await handleWorkspace(rest);
      return 0;
    case 'config':
      await handleConfig(rest);
      return 0;
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}
