import { randomUUID } from 'node:crypto';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import type {
  BackupConflictPolicy,
  BackupJobSummary,
  BackupProviderStatus,
} from '@cloud-driver/shared';
import type { ManagedRoot } from '@cloud-driver/shared';
import type { BackupProvider } from '@cloud-driver/quark-adapter';
import { getDatabase } from './database.js';
import { FileServiceError, getRootById, resolvePathWithinRoot } from './files.js';

type BackupJobRow = {
  id: string;
  root_id: string;
  source_path: string;
  source_type: 'file' | 'directory';
  target_path: string;
  resolved_target_path: string | null;
  conflict_policy: BackupConflictPolicy;
  provider: string;
  status: BackupJobSummary['status'];
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

function mapBackupJob(row: BackupJobRow): BackupJobSummary {
  return {
    id: row.id,
    rootId: row.root_id,
    sourcePath: row.source_path,
    sourceType: row.source_type,
    targetPath: row.target_path,
    resolvedTargetPath: row.resolved_target_path,
    conflictPolicy: row.conflict_policy,
    provider: row.provider,
    status: row.status,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    retryable: row.status === 'failed',
  };
}

function normalizeBackupTargetPath(rawTargetPath: string, sourcePath: string): string {
  const trimmed = rawTargetPath.trim();

  if (!trimmed) {
    throw new FileServiceError(400, 'Backup target path is required');
  }

  const basename = path.posix.basename(sourcePath);
  const endsWithSlash = trimmed === '/' || trimmed.endsWith('/');
  const segments = trimmed.split('/').filter(Boolean);

  if (segments.some((segment) => segment === '.' || segment === '..')) {
    throw new FileServiceError(400, 'Backup target path is invalid');
  }

  if (endsWithSlash) {
    segments.push(basename);
  }

  if (segments.length === 0) {
    throw new FileServiceError(400, 'Backup target path is required');
  }

  return `/${segments.join('/')}`;
}

export class BackupJobService {
  private readonly db = getDatabase();
  private readonly runningJobIds = new Set<string>();

  constructor(
    private readonly roots: ManagedRoot[],
    private readonly provider: BackupProvider,
  ) {}

  async initialize(): Promise<void> {
    await this.getProviderStatus();
  }

  async getProviderStatus(): Promise<BackupProviderStatus> {
    try {
      const status = await this.provider.testConnection();
      return {
        available: status.available,
        provider: status.provider,
        message: status.message ?? null,
      };
    } catch (error) {
      return {
        available: false,
        provider: this.provider.name,
        message: error instanceof Error ? error.message : 'Backup provider check failed',
      };
    }
  }

  listJobs(): BackupJobSummary[] {
    const rows = this.db
      .prepare(
        `
          SELECT *
          FROM backup_jobs
          ORDER BY datetime(updated_at) DESC, datetime(created_at) DESC
        `,
      )
      .all() as BackupJobRow[];

    return rows.map(mapBackupJob);
  }

  getJob(jobId: string): BackupJobSummary | null {
    const row = this.db
      .prepare(
        `
          SELECT *
          FROM backup_jobs
          WHERE id = ?
        `,
      )
      .get(jobId) as BackupJobRow | undefined;

    return row ? mapBackupJob(row) : null;
  }

  async createJob(input: {
    rootId: string;
    sourcePath: string;
    targetPath: string;
    conflictPolicy: BackupConflictPolicy;
  }): Promise<BackupJobSummary> {
    const root = getRootById(this.roots, input.rootId);
    const absoluteSourcePath = resolvePathWithinRoot(root, input.sourcePath);
    const sourceStats = await stat(absoluteSourcePath).catch(() => {
      throw new FileServiceError(404, 'Backup source was not found');
    });
    const sourceType = sourceStats.isDirectory() ? 'directory' : 'file';
    const normalizedTargetPath = normalizeBackupTargetPath(input.targetPath, input.sourcePath);
    const id = `bak_${randomUUID()}`;
    const createdAt = new Date().toISOString();

    this.db
      .prepare(
        `
          INSERT INTO backup_jobs (
            id,
            root_id,
            source_path,
            source_type,
            target_path,
            resolved_target_path,
            conflict_policy,
            provider,
            status,
            error_message,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        id,
        input.rootId,
        input.sourcePath,
        sourceType,
        normalizedTargetPath,
        null,
        input.conflictPolicy,
        this.provider.name,
        'queued',
        null,
        createdAt,
        createdAt,
      );

    void this.processJob(id);
    return this.getJob(id)!;
  }

  async retryJob(jobId: string): Promise<BackupJobSummary> {
    const row = this.requireRow(jobId);

    if (row.status !== 'failed') {
      throw new FileServiceError(400, 'Only failed backup jobs can be retried');
    }

    this.updateJob(jobId, {
      status: 'queued',
      error_message: null,
      updated_at: new Date().toISOString(),
    });

    void this.processJob(jobId);
    return this.getJob(jobId)!;
  }

  private async processJob(jobId: string): Promise<void> {
    if (this.runningJobIds.has(jobId)) {
      return;
    }

    const row = this.requireRow(jobId);
    const root = getRootById(this.roots, row.root_id);

    this.runningJobIds.add(jobId);
    this.updateJob(jobId, {
      status: 'processing',
      error_message: null,
      updated_at: new Date().toISOString(),
    });

    try {
      const absoluteSourcePath = resolvePathWithinRoot(root, row.source_path);
      const sourceStats = await stat(absoluteSourcePath).catch(() => {
        throw new FileServiceError(404, 'Backup source was not found');
      });
      const sourceType = sourceStats.isDirectory() ? 'directory' : 'file';
      const result =
        sourceType === 'directory'
          ? await this.provider.uploadDirectory({
              rootId: row.root_id,
              relativePath: row.source_path,
              absoluteSourcePath,
              sourceType,
              targetPath: row.target_path,
              conflictPolicy: row.conflict_policy,
            })
          : await this.provider.uploadFile({
              rootId: row.root_id,
              relativePath: row.source_path,
              absoluteSourcePath,
              sourceType,
              targetPath: row.target_path,
              conflictPolicy: row.conflict_policy,
            });

      this.updateJob(jobId, {
        status: 'completed',
        resolved_target_path: result.targetPath,
        error_message: null,
        updated_at: new Date().toISOString(),
      });
    } catch (error) {
      this.updateJob(jobId, {
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Backup failed',
        updated_at: new Date().toISOString(),
      });
    } finally {
      this.runningJobIds.delete(jobId);
    }
  }

  private requireRow(jobId: string): BackupJobRow {
    const row = this.db
      .prepare(
        `
          SELECT *
          FROM backup_jobs
          WHERE id = ?
        `,
      )
      .get(jobId) as BackupJobRow | undefined;

    if (!row) {
      throw new FileServiceError(404, 'Backup job not found');
    }

    return row;
  }

  private updateJob(
    jobId: string,
    fields: Partial<
      Pick<
        BackupJobRow,
        'status' | 'resolved_target_path' | 'error_message' | 'updated_at'
      >
    >,
  ): void {
    const current = this.requireRow(jobId);
    const nextRow: BackupJobRow = {
      ...current,
      ...fields,
    };

    this.db
      .prepare(
        `
          UPDATE backup_jobs
          SET resolved_target_path = ?,
              status = ?,
              error_message = ?,
              updated_at = ?
          WHERE id = ?
        `,
      )
      .run(
        nextRow.resolved_target_path,
        nextRow.status,
        nextRow.error_message,
        nextRow.updated_at,
        jobId,
      );
  }
}
