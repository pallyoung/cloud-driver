import { mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

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

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const packageDir = path.join(repoRoot, 'packages', 'cd-cli');
const outputDir = path.join(repoRoot, 'output', 'npm');
const npmCacheDir = path.join(repoRoot, 'tmp', 'npm-cache');

async function resolveTarballPath(stdout) {
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

const tarballPath = await resolveTarballPath(stdout);

console.log(`Packed CLI tarball: ${tarballPath}`);
