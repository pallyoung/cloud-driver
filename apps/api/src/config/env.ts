import { existsSync } from 'node:fs';
import path from 'node:path';
import { config as loadDotEnv } from 'dotenv';
import { z } from 'zod';
import { findWorkspaceRoot } from './paths.js';

const workspaceRoot = findWorkspaceRoot();
const envFilePath = path.join(workspaceRoot, '.env');

if (existsSync(envFilePath)) {
  loadDotEnv({ path: envFilePath });
}

const envSchema = z.object({
  APP_HOST: z.string().default('0.0.0.0'),
  APP_PORT: z.coerce.number().default(3001),
  SESSION_SECRET: z.string().min(8),
  PASSWORD_HASH: z.string().min(1),
  ROOTS_CONFIG_PATH: z.string().default('./config/roots.yaml'),
  SQLITE_PATH: z.string().default('./data/cloud-driver.db'),
  LOG_DIR: z.string().default('./logs'),
  TEMP_EXPORT_DIR: z.string().default('./tmp/exports'),
  EXPORT_TTL_MINUTES: z.coerce.number().int().positive().default(30),
  BACKUP_PROVIDER: z.string().default('mock'),
  MOCK_BACKUP_ROOT: z.string().default('./tmp/mock-quark'),
  QUARK_COOKIE: z.string().optional(),
  WEB_DIST_PATH: z.string().optional(),
});

export const env = envSchema.parse(process.env);
export const resolvedWorkspaceRoot = workspaceRoot;
