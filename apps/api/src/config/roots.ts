import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'yaml';
import { z } from 'zod';
import type { ManagedRoot } from '@cloud-driver/shared';
import { resolvedWorkspaceRoot } from './env.js';

const rootSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  path: z.string().min(1),
  readOnly: z.boolean().default(false),
});

const rootsFileSchema = z.object({
  roots: z.array(rootSchema).default([]),
});

export async function loadManagedRoots(configPath: string): Promise<ManagedRoot[]> {
  const absoluteConfigPath = path.isAbsolute(configPath)
    ? configPath
    : path.resolve(resolvedWorkspaceRoot, configPath);
  const raw = await readFile(absoluteConfigPath, 'utf-8');
  const parsed = rootsFileSchema.parse(parse(raw));

  return parsed.roots.map((root) => ({
    id: root.id,
    label: root.label,
    readOnly: root.readOnly,
    path: path.resolve(path.dirname(absoluteConfigPath), root.path),
  }));
}
