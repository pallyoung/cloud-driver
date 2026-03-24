export type ManagedRoot = {
  id: string;
  label: string;
  readOnly: boolean;
  path?: string;
};

export type FileItem = {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size: number | null;
  mimeType?: string;
  modifiedAt: string;
  editable: boolean;
  previewable: boolean;
  editBlockedReason?: 'size-limit' | 'unsupported-type';
};

export type SessionResponse = {
  authenticated: boolean;
};

export type RootListResponse = {
  roots: ManagedRoot[];
};

export type FileListResponse = {
  rootId: string;
  path: string;
  items: FileItem[];
};

export type FileContentResponse = {
  rootId: string;
  path: string;
  content: string;
  etag: string;
  encoding: 'utf-8';
  lineEnding: 'lf' | 'crlf';
  size: number;
  modifiedAt: string;
};

export type BackupConflictPolicy = 'skip' | 'overwrite' | 'rename';

export type BackupProviderStatus = {
  available: boolean;
  provider: string;
  message: string | null;
};

export type SettingsResponse = {
  rootsConfigPath: string;
  sqlitePath: string;
  tempExportDir: string;
  exportTtlMinutes: number;
  backupProvider: string;
  backupProviderStatus: BackupProviderStatus | null;
  roots: ManagedRoot[];
};

export type ExportJobStatus =
  | 'queued'
  | 'processing'
  | 'ready'
  | 'completed'
  | 'cleaned'
  | 'failed'
  | 'expired';

export type ExportJobSummary = {
  id: string;
  rootId: string;
  sourcePath: string;
  sourceType: 'file' | 'directory';
  archiveName: string | null;
  status: ExportJobStatus;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;
  downloadUrl: string | null;
};

export type BackupJobStatus = 'queued' | 'processing' | 'completed' | 'failed';

export type BackupJobSummary = {
  id: string;
  rootId: string;
  sourcePath: string;
  sourceType: 'file' | 'directory';
  targetPath: string;
  resolvedTargetPath: string | null;
  conflictPolicy: BackupConflictPolicy;
  provider: string;
  status: BackupJobStatus;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  retryable: boolean;
};

export type JobsResponse = {
  exports: ExportJobSummary[];
  backups: BackupJobSummary[];
};
