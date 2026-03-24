import path from 'node:path';
import { resolvedWorkspaceRoot } from './env.js';

export function resolveFromWorkspace(targetPath: string): string {
  return path.isAbsolute(targetPath) ? targetPath : path.resolve(resolvedWorkspaceRoot, targetPath);
}
