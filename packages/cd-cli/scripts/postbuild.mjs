import { cp, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(packageDir, 'dist');
const templatesDir = path.join(packageDir, 'templates');
const distTemplatesDir = path.join(distDir, 'templates');
const workspaceWebDist = path.resolve(packageDir, '../../apps/web/dist');
const packagedWebDist = path.join(distDir, 'runtime', 'web');

await mkdir(distTemplatesDir, { recursive: true });
await cp(templatesDir, distTemplatesDir, { recursive: true });

if (!existsSync(path.join(workspaceWebDist, 'index.html'))) {
  throw new Error(
    `[cd-cli] apps/web/dist is missing at ${workspaceWebDist}. Build @cloud-driver/web before packaging the CLI.`,
  );
}

await mkdir(path.join(distDir, 'runtime'), { recursive: true });
await cp(workspaceWebDist, packagedWebDist, { recursive: true });
