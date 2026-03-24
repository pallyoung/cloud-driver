import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(packageDir, 'dist', 'runtime');

await mkdir(outDir, { recursive: true });

await build({
  entryPoints: [path.join(packageDir, 'src', 'runtime', 'server.ts')],
  outfile: path.join(outDir, 'server.cjs'),
  bundle: true,
  format: 'cjs',
  platform: 'node',
  target: 'node22',
  sourcemap: false,
  minify: false,
  tsconfig: path.join(packageDir, 'tsconfig.json'),
  banner: {
    js: '#!/usr/bin/env node',
  },
});
