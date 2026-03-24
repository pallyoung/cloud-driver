import { mkdir, rm, writeFile } from 'node:fs/promises';
import { scryptSync } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { credentials, runtimePaths } from './runtime.mjs';

function createPasswordHash(password) {
  const salt = 'clouddrivere2esalt';
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

export async function ensureE2ERuntime() {
  await rm(runtimePaths.root, { recursive: true, force: true });
  await mkdir(runtimePaths.docsRoot, { recursive: true });
  await mkdir(pathDir(runtimePaths.mediaRoot), { recursive: true });
  await mkdir(runtimePaths.mediaRoot, { recursive: true });
  await mkdir(pathDir(runtimePaths.rootsConfigPath), { recursive: true });
  await mkdir(pathDir(runtimePaths.sqlitePath), { recursive: true });
  await mkdir(runtimePaths.logDir, { recursive: true });
  await mkdir(runtimePaths.tempExportDir, { recursive: true });
  await mkdir(runtimePaths.mockBackupRoot, { recursive: true });
  await mkdir(runtimePaths.downloadsDir, { recursive: true });
  await mkdir(runtimePaths.screenshotsDir, { recursive: true });

  await mkdir(pathJoin(runtimePaths.docsRoot, 'contracts'), { recursive: true });

  await writeFile(
    pathJoin(runtimePaths.docsRoot, 'readme.md'),
    '# Cloud Driver Review\n\nThis fixture file is used for Playwright E2E verification.\n',
    'utf8',
  );
  await writeFile(
    pathJoin(runtimePaths.docsRoot, 'release-notes.txt'),
    'Release cadence: weekly\nOwner: operations\n',
    'utf8',
  );
  await writeFile(
    pathJoin(runtimePaths.docsRoot, 'config.json'),
    '{"service":"cloud-driver","owner":"operations","enabled":true}\n',
    'utf8',
  );
  await writeFile(
    pathJoin(runtimePaths.docsRoot, 'ops.yaml'),
    'service: cloud-driver\nowner : operations\nworkers: [api,web]\n',
    'utf8',
  );
  await writeFile(
    pathJoin(runtimePaths.docsRoot, 'module.ts'),
    'export const renderUser=(name:string)=>{return {name,active:true}}\n',
    'utf8',
  );
  await writeFile(
    pathJoin(runtimePaths.docsRoot, 'landing.html'),
    '<main><section><h1>Cloud Driver</h1><p>Ops ready</p></section></main>\n',
    'utf8',
  );
  await writeFile(
    pathJoin(runtimePaths.docsRoot, 'theme.css'),
    '.app{display:grid;grid-template-columns:1fr 2fr;color:#0f766e}\n',
    'utf8',
  );
  await writeFile(
    pathJoin(runtimePaths.docsRoot, 'guide.md'),
    '# Cloud Driver\n\n-   editor\n- preview\n',
    'utf8',
  );
  await writeFile(
    pathJoin(runtimePaths.docsRoot, 'deploy.sh'),
    '#!/usr/bin/env bash\nset -euo pipefail\necho "deploy cloud-driver"\n',
    'utf8',
  );
  await writeFile(
    pathJoin(runtimePaths.docsRoot, 'runtime.ini'),
    '[service]\nname=cloud-driver\nowner=operations\n',
    'utf8',
  );
  await writeFile(
    pathJoin(runtimePaths.docsRoot, 'oversized.log'),
    'oversized-entry '.repeat(24_000) + '\n' + 'line\n'.repeat(450_000),
    'utf8',
  );
  await writeFile(
    pathJoin(runtimePaths.docsRoot, 'contracts', 'contract-a.md'),
    '# Contract A\n\nStatus: draft\n',
    'utf8',
  );
  await writeFile(
    pathJoin(runtimePaths.mediaRoot, 'notes.txt'),
    'Media review checklist\n',
    'utf8',
  );
  await writeFile(
    pathJoin(runtimePaths.mediaRoot, 'diagram.png'),
    Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+Xn4wAAAAASUVORK5CYII=',
      'base64',
    ),
  );
  await writeFile(
    runtimePaths.rootsConfigPath,
    [
      'roots:',
      '  - id: docs',
      '    label: Documents',
      `    path: ${runtimePaths.docsRoot}`,
      '    readOnly: false',
      '  - id: media',
      '    label: Media',
      `    path: ${runtimePaths.mediaRoot}`,
      '    readOnly: false',
      '',
    ].join('\n'),
    'utf8',
  );

  return {
    passwordHash: createPasswordHash(credentials.password),
  };
}

function pathDir(filePath) {
  return filePath.substring(0, filePath.lastIndexOf('/'));
}

function pathJoin(...parts) {
  return parts.join('/').replace(/\\/g, '/');
}

const entryPath = process.argv[1] ? fileURLToPath(new URL(`file://${process.argv[1]}`)) : null;
if (entryPath === fileURLToPath(import.meta.url)) {
  await ensureE2ERuntime();
}
