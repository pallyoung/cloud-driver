import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { env } from '../config/env.js';
import { resolveFromWorkspace } from '../config/resolve-path.js';

let database: DatabaseSync | null = null;

export function getDatabase(): DatabaseSync {
  if (database) {
    return database;
  }

  const sqlitePath = resolveFromWorkspace(env.SQLITE_PATH);
  mkdirSync(path.dirname(sqlitePath), { recursive: true });

  const db = new DatabaseSync(sqlitePath);
  db.exec(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS export_jobs (
      id TEXT PRIMARY KEY,
      root_id TEXT NOT NULL,
      source_path TEXT NOT NULL,
      source_type TEXT NOT NULL,
      archive_name TEXT,
      temp_file_path TEXT,
      status TEXT NOT NULL,
      error_message TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      expires_at TEXT,
      downloaded_at TEXT,
      cleaned_at TEXT
    );

    CREATE TABLE IF NOT EXISTS backup_jobs (
      id TEXT PRIMARY KEY,
      root_id TEXT NOT NULL,
      source_path TEXT NOT NULL,
      source_type TEXT NOT NULL,
      target_path TEXT NOT NULL,
      resolved_target_path TEXT,
      conflict_policy TEXT NOT NULL,
      provider TEXT NOT NULL,
      status TEXT NOT NULL,
      error_message TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  database = db;
  return db;
}

export function getResolvedSqlitePath(): string {
  return resolveFromWorkspace(env.SQLITE_PATH);
}
