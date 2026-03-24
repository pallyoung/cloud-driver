import { mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

export async function ensureDirectory(targetPath: string): Promise<void> {
  await mkdir(targetPath, { recursive: true });
}

export async function writeTextAtomic(targetPath: string, content: string): Promise<void> {
  await ensureDirectory(path.dirname(targetPath));
  const tempPath = `${targetPath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tempPath, content, 'utf8');
  await rename(tempPath, targetPath);
}
