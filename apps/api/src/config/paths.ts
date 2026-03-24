import { existsSync } from 'node:fs';
import path from 'node:path';

export function findWorkspaceRoot(startDirectory = process.cwd()): string {
  let currentDirectory = startDirectory;

  while (true) {
    if (
      existsSync(path.join(currentDirectory, 'pnpm-workspace.yaml')) ||
      existsSync(path.join(currentDirectory, '.env.example'))
    ) {
      return currentDirectory;
    }

    const parentDirectory = path.dirname(currentDirectory);

    if (parentDirectory === currentDirectory) {
      return startDirectory;
    }

    currentDirectory = parentDirectory;
  }
}
