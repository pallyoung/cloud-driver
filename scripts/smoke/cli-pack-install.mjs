import { mkdtemp, mkdir, readdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { runBrowserSmoke } from './cli-browser-smoke.mjs';

function parseArgs(argv) {
  const options = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (!token.startsWith('--')) {
      continue;
    }

    const key = token.slice(2);
    const next = argv[index + 1];

    if (!next || next.startsWith('--')) {
      options[key] = 'true';
      continue;
    }

    options[key] = next;
    index += 1;
  }

  return options;
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const { quietStdout = false, quietStderr = false, ...spawnOptions } = options;
    const child = spawn(command, args, {
      stdio: 'pipe',
      ...spawnOptions,
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (chunk) => {
      const text = chunk.toString();
      stdout += text;
      if (!quietStdout) {
        process.stdout.write(text);
      }
    });

    child.stderr?.on('data', (chunk) => {
      const text = chunk.toString();
      stderr += text;
      if (!quietStderr) {
        process.stderr.write(text);
      }
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      reject(new Error(`${command} ${args.join(' ')} failed with exit code ${code ?? 'unknown'}`));
    });
  });
}

function assertOutputIncludes(output, expected, context) {
  if (!output.includes(expected)) {
    throw new Error(`${context} did not include expected text: ${expected}`);
  }
}

function createNpmEnv(baseEnv, npmCacheDir) {
  const nextEnv = {
    ...baseEnv,
    npm_config_cache: npmCacheDir,
    npm_config_update_notifier: 'false',
    npm_config_fund: 'false',
  };

  delete nextEnv.npm_config_verify_deps_before_run;
  delete nextEnv.npm_config__jsr_registry;

  return nextEnv;
}

async function waitForHealth(url) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < 15_000) {
    try {
      const response = await fetch(`${url}/api/health/live`, {
        signal: AbortSignal.timeout(1000),
      });

      if (response.ok) {
        return true;
      }
    } catch {
      // Ignore and retry.
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  return false;
}

function getInstalledCliPath(prefixDir) {
  if (process.platform === 'win32') {
    return path.join(prefixDir, 'cd-cli.cmd');
  }

  return path.join(prefixDir, 'bin', 'cd-cli');
}

async function packCli(repoRoot) {
  const packageDir = path.join(repoRoot, 'packages', 'cd-cli');
  const outputDir = path.join(repoRoot, 'output', 'npm');
  const npmCacheDir = path.join(repoRoot, 'tmp', 'npm-cache');

  await mkdir(outputDir, { recursive: true });
  await mkdir(npmCacheDir, { recursive: true });

  const { stdout } = await run(
    'npm',
    ['pack', '--json', '--pack-destination', outputDir],
    {
      cwd: packageDir,
      quietStdout: true,
      env: createNpmEnv(process.env, npmCacheDir),
    },
  );

  if (stdout.trim()) {
    const parsed = JSON.parse(stdout.trim());
    const firstEntry = Array.isArray(parsed) ? parsed[0] : parsed;
    return path.join(outputDir, firstEntry.filename);
  }

  const files = await readdir(outputDir);
  const tarballs = files.filter((file) => file.endsWith('.tgz')).sort();

  if (tarballs.length === 0) {
    throw new Error(`No tarball found in ${outputDir}.`);
  }

  return path.join(outputDir, tarballs[tarballs.length - 1]);
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = parseArgs(process.argv.slice(2));
const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'cloud-driver-cli-pack-'));
const installPrefix = path.join(tempRoot, 'prefix');
const runtimeHome = path.join(tempRoot, 'runtime');
const npmCacheDir = path.join(repoRoot, 'tmp', 'npm-cache');
const password = args.password ?? 'packaged-secret';
const port = Number.parseInt(args.port ?? '3310', 10);
const baseUrl = `http://127.0.0.1:${port}`;
const screenshotDir = path.join(repoRoot, 'output', 'playwright');

let cliPath = '';

try {
  const tarballPath = await packCli(repoRoot);
  console.log(`Packed tarball: ${tarballPath}`);

  await run(
    'npm',
    ['install', '--global', '--prefix', installPrefix, tarballPath],
    {
      cwd: repoRoot,
      env: createNpmEnv(process.env, npmCacheDir),
    },
  );

  cliPath = getInstalledCliPath(installPrefix);

  if (!existsSync(cliPath)) {
    throw new Error(`Installed CLI binary not found at ${cliPath}.`);
  }

  await run(cliPath, ['init', '--home', runtimeHome, '--password', password, '--port', String(port)], {
    cwd: repoRoot,
    env: process.env,
  });

  const statusBeforeStart = await run(cliPath, ['status', '--home', runtimeHome], {
    cwd: repoRoot,
    env: process.env,
    quietStdout: true,
  });
  assertOutputIncludes(statusBeforeStart.stdout, 'Initialized: yes', 'status before start');
  assertOutputIncludes(statusBeforeStart.stdout, 'Running: no', 'status before start');

  const configPath = await run(cliPath, ['config', 'path', '--home', runtimeHome], {
    cwd: repoRoot,
    env: process.env,
    quietStdout: true,
  });
  assertOutputIncludes(
    configPath.stdout.trim(),
    path.join(runtimeHome, 'config', 'app.json'),
    'config path',
  );

  const configShow = await run(cliPath, ['config', 'show', '--home', runtimeHome], {
    cwd: repoRoot,
    env: process.env,
    quietStdout: true,
  });
  assertOutputIncludes(configShow.stdout, '"port": 3310', 'config show');

  const workspaceListBeforeAdd = await run(cliPath, ['workspace', 'list', '--home', runtimeHome], {
    cwd: repoRoot,
    env: process.env,
    quietStdout: true,
  });
  assertOutputIncludes(workspaceListBeforeAdd.stdout, 'No workspaces configured.', 'workspace list');

  await run(
    cliPath,
    ['workspace', 'add', path.join(repoRoot, 'dev-roots'), '--home', runtimeHome, '--id', 'dev-roots', '--label', 'Dev Roots'],
    {
      cwd: repoRoot,
      env: process.env,
    },
  );

  await run(
    cliPath,
    ['workspace', 'update', 'dev-roots', '--home', runtimeHome, '--label', 'Dev Roots Updated', '--read-only', 'true'],
    {
      cwd: repoRoot,
      env: process.env,
    },
  );

  const workspaceListUpdated = await run(cliPath, ['workspace', 'list', '--home', runtimeHome], {
    cwd: repoRoot,
    env: process.env,
    quietStdout: true,
  });
  assertOutputIncludes(workspaceListUpdated.stdout, 'dev-roots\tDev Roots Updated\tro\t', 'workspace list after update');

  await run(
    cliPath,
    ['workspace', 'update', 'dev-roots', '--home', runtimeHome, '--label', 'Dev Roots', '--read-only', 'false'],
    {
      cwd: repoRoot,
      env: process.env,
    },
  );

  await run(cliPath, ['start', '--home', runtimeHome], {
    cwd: repoRoot,
    env: process.env,
  });

  const healthy = await waitForHealth(baseUrl);

  if (!healthy) {
    throw new Error(`Packaged CLI service did not become healthy at ${baseUrl}.`);
  }

  const openCommand = await run(cliPath, ['open', '--home', runtimeHome, '--print-only'], {
    cwd: repoRoot,
    env: process.env,
    quietStdout: true,
  });
  assertOutputIncludes(openCommand.stdout.trim(), baseUrl, 'open --print-only');

  const logsCommand = await run(cliPath, ['logs', '--home', runtimeHome], {
    cwd: repoRoot,
    env: process.env,
    quietStdout: true,
  });
  assertOutputIncludes(logsCommand.stdout, path.join(runtimeHome, 'logs', 'server.log'), 'logs');
  assertOutputIncludes(logsCommand.stdout, path.join(runtimeHome, 'logs', 'server.error.log'), 'logs');

  const doctorCommand = await run(cliPath, ['doctor', '--home', runtimeHome], {
    cwd: repoRoot,
    env: process.env,
    quietStdout: true,
  });
  assertOutputIncludes(doctorCommand.stdout, 'Service healthy: yes', 'doctor');
  assertOutputIncludes(doctorCommand.stdout, 'Workspace count: 1', 'doctor');

  await run(cliPath, ['restart', '--home', runtimeHome], {
    cwd: repoRoot,
    env: process.env,
  });

  const statusAfterRestart = await run(cliPath, ['status', '--home', runtimeHome], {
    cwd: repoRoot,
    env: process.env,
    quietStdout: true,
  });
  assertOutputIncludes(statusAfterRestart.stdout, 'Running: yes', 'status after restart');
  assertOutputIncludes(statusAfterRestart.stdout, 'Healthy: yes', 'status after restart');

  if (args.browser === 'true') {
    await runBrowserSmoke({
      baseUrl,
      password,
      rootId: 'dev-roots',
      screenshotDir,
      headed: args.headed ?? 'false',
    });
  }

  await run(cliPath, ['status', '--home', runtimeHome], {
    cwd: repoRoot,
    env: process.env,
  });

  console.log(`CLI packaged smoke completed successfully using ${cliPath}`);
  console.log(`Runtime home: ${runtimeHome}`);
} finally {
  if (cliPath) {
    try {
      await run(cliPath, ['stop', '--home', runtimeHome], {
        cwd: repoRoot,
        env: process.env,
      });
    } catch {
      // Ignore cleanup failures in finalizer.
    }
  }

  if (args['keep-temp'] !== 'true') {
    await rm(tempRoot, { recursive: true, force: true });
  } else {
    console.log(`Keeping temp directory: ${tempRoot}`);
  }
}
