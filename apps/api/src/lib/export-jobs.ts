import { createWriteStream } from 'node:fs';
import { mkdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import archiver from 'archiver';
import type { DatabaseSync } from 'node:sqlite';
import type { ExportJobSummary, ManagedRoot } from '@cloud-driver/shared';
import { env } from '../config/env.js';
import { resolveFromWorkspace } from '../config/resolve-path.js';
import { getDatabase } from './database.js';
import { FileServiceError, getRootById, resolvePathWithinRoot } from './files.js';

type ExportJobRow = {
  id: string;
  root_id: string;
  source_path: string;
  source_type: 'file' | 'directory';
  archive_name: string | null;
  temp_file_path: string | null;
  status: ExportJobSummary['status'];
  error_message: string | null;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
  downloaded_at: string | null;
  cleaned_at: string | null;
};

function mapExportJob(row: ExportJobRow): ExportJobSummary {
  return {
    id: row.id,
    rootId: row.root_id,
    sourcePath: row.source_path,
    sourceType: row.source_type,
    archiveName: row.archive_name,
    status: row.status,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    expiresAt: row.expires_at,
    downloadUrl: row.status === 'ready' ? `/api/exports/${row.id}/download` : null,
  };
}

async function createZipArchive(sourcePath: string, archiveRootName: string, targetPath: string): Promise<void> {
  await mkdir(path.dirname(targetPath), { recursive: true });

  await new Promise<void>((resolve, reject) => {
    const output = createWriteStream(targetPath);
    const archive = archiver('zip', {
      zlib: { level: 9 },
    });

    let settled = false;
    const finish = (handler: () => void) => {
      if (settled) {
        return;
      }

      settled = true;
      handler();
    };

    output.on('close', () => finish(resolve));
    output.on('error', (error: Error) => finish(() => reject(error)));
    archive.on('warning', (error: Error) => finish(() => reject(error)));
    archive.on('error', (error: Error) => finish(() => reject(error)));

    archive.pipe(output);
    archive.directory(sourcePath, archiveRootName);
    void archive.finalize();
  });
}

function getArchiveBaseName(relativePath: string, rootId: string): string {
  const baseName = relativePath ? path.basename(relativePath) : rootId;
  return baseName || rootId;
}

export class ExportJobService {
  private readonly db: DatabaseSync;
  private readonly tempExportDir: string;
  private readonly ttlMs: number;
  private readonly runningJobIds = new Set<string>();

  constructor(private readonly roots: ManagedRoot[]) {
    this.db = getDatabase();
    this.tempExportDir = resolveFromWorkspace(env.TEMP_EXPORT_DIR);
    this.ttlMs = env.EXPORT_TTL_MINUTES * 60 * 1000;
  }

  async initialize(): Promise<void> {
    await mkdir(this.tempExportDir, { recursive: true });
    await this.cleanupExpiredJobs();
  }

  listJobs(): ExportJobSummary[] {
    const rows = this.db
      .prepare(
        `
          SELECT *
          FROM export_jobs
          ORDER BY datetime(created_at) DESC
        `,
      )
      .all() as ExportJobRow[];

    return rows.map(mapExportJob);
  }

  getJob(jobId: string): ExportJobSummary | null {
    const row = this.db
      .prepare(
        `
          SELECT *
          FROM export_jobs
          WHERE id = ?
        `,
      )
      .get(jobId) as ExportJobRow | undefined;

    return row ? mapExportJob(row) : null;
  }

  async createDirectoryExport(rootId: string, sourcePath: string): Promise<ExportJobSummary> {
    const root = getRootById(this.roots, rootId);
    const absoluteSourcePath = resolvePathWithinRoot(root, sourcePath);
    const sourceStats = await stat(absoluteSourcePath).catch(() => {
      throw new FileServiceError(404, 'Directory not found');
    });

    if (!sourceStats.isDirectory()) {
      throw new FileServiceError(400, 'Only directories create export jobs. Use direct download for files.');
    }

    const id = `exp_${randomUUID()}`;
    const createdAt = new Date().toISOString();
    const archiveBaseName = getArchiveBaseName(sourcePath, rootId);
    const archiveName = `${archiveBaseName}_${createdAt.replace(/[:.]/g, '-')}.zip`;
    const tempFilePath = path.join(this.tempExportDir, `${id}.zip`);

    this.db
      .prepare(
        `
          INSERT INTO export_jobs (
            id,
            root_id,
            source_path,
            source_type,
            archive_name,
            temp_file_path,
            status,
            error_message,
            created_at,
            updated_at,
            expires_at,
            downloaded_at,
            cleaned_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        id,
        rootId,
        sourcePath,
        'directory',
        archiveName,
        tempFilePath,
        'queued',
        null,
        createdAt,
        createdAt,
        null,
        null,
        null,
      );

    void this.processJob(id, absoluteSourcePath, archiveBaseName, tempFilePath);
    return this.getJob(id)!;
  }

  private async processJob(
    jobId: string,
    absoluteSourcePath: string,
    archiveRootName: string,
    tempFilePath: string,
  ): Promise<void> {
    if (this.runningJobIds.has(jobId)) {
      return;
    }

    this.runningJobIds.add(jobId);
    this.updateJob(jobId, {
      status: 'processing',
      error_message: null,
      updated_at: new Date().toISOString(),
    });

    try {
      await createZipArchive(absoluteSourcePath, archiveRootName, tempFilePath);

      this.updateJob(jobId, {
        status: 'ready',
        error_message: null,
        updated_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + this.ttlMs).toISOString(),
      });
    } catch (error) {
      await rm(tempFilePath, { force: true }).catch(() => undefined);

      this.updateJob(jobId, {
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Export failed',
        updated_at: new Date().toISOString(),
      });
    } finally {
      this.runningJobIds.delete(jobId);
    }
  }

  getDownload(jobId: string): { filePath: string; fileName: string; mimeType: string } {
    const row = this.db
      .prepare(
        `
          SELECT *
          FROM export_jobs
          WHERE id = ?
        `,
      )
      .get(jobId) as ExportJobRow | undefined;

    if (!row) {
      throw new FileServiceError(404, 'Export job not found');
    }

    if (row.status !== 'ready' || !row.temp_file_path || !row.archive_name) {
      throw new FileServiceError(400, 'Export archive is not ready');
    }

    return {
      filePath: row.temp_file_path,
      fileName: row.archive_name,
      mimeType: 'application/zip',
    };
  }

  async markDownloadedAndCleanup(jobId: string): Promise<void> {
    const row = this.db
      .prepare(
        `
          SELECT *
          FROM export_jobs
          WHERE id = ?
        `,
      )
      .get(jobId) as ExportJobRow | undefined;

    if (!row) {
      return;
    }

    const now = new Date().toISOString();
    this.updateJob(jobId, {
      status: 'completed',
      updated_at: now,
      downloaded_at: now,
    });

    if (row.temp_file_path) {
      await rm(row.temp_file_path, { force: true }).catch(() => undefined);
    }

    this.updateJob(jobId, {
      status: 'cleaned',
      updated_at: new Date().toISOString(),
      cleaned_at: new Date().toISOString(),
    });
  }

  async cleanupExpiredJobs(): Promise<void> {
    const rows = this.db
      .prepare(
        `
          SELECT *
          FROM export_jobs
          WHERE status = 'ready'
            AND expires_at IS NOT NULL
            AND datetime(expires_at) <= datetime(?)
        `,
      )
      .all(new Date().toISOString()) as ExportJobRow[];

    for (const row of rows) {
      if (row.temp_file_path) {
        await rm(row.temp_file_path, { force: true }).catch(() => undefined);
      }

      this.updateJob(row.id, {
        status: 'expired',
        updated_at: new Date().toISOString(),
      });
    }
  }

  private updateJob(
    jobId: string,
    fields: Partial<Pick<ExportJobRow, 'status' | 'error_message' | 'updated_at' | 'expires_at' | 'downloaded_at' | 'cleaned_at'>>,
  ): void {
    const current = this.db
      .prepare(
        `
          SELECT *
          FROM export_jobs
          WHERE id = ?
        `,
      )
      .get(jobId) as ExportJobRow | undefined;

    if (!current) {
      return;
    }

    const nextRow: ExportJobRow = {
      ...current,
      ...fields,
    };

    this.db
      .prepare(
        `
          UPDATE export_jobs
          SET status = ?,
              error_message = ?,
              updated_at = ?,
              expires_at = ?,
              downloaded_at = ?,
              cleaned_at = ?
          WHERE id = ?
        `,
      )
      .run(
        nextRow.status,
        nextRow.error_message,
        nextRow.updated_at,
        nextRow.expires_at,
        nextRow.downloaded_at,
        nextRow.cleaned_at,
        jobId,
      );
  }
}
