import { access, cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import type { BackupConflictPolicy, BackupProviderStatus } from '@cloud-driver/shared';

export type BackupSourceType = 'file' | 'directory';

export type BackupTarget = {
  rootId: string;
  relativePath: string;
  absoluteSourcePath: string;
  sourceType: BackupSourceType;
  targetPath: string;
  conflictPolicy: BackupConflictPolicy;
};

export type BackupUploadResult = {
  targetPath: string;
  skipped: boolean;
};

export interface BackupProvider {
  readonly name: string;
  testConnection(): Promise<BackupProviderStatus>;
  uploadFile(target: BackupTarget): Promise<BackupUploadResult>;
  uploadDirectory(target: BackupTarget): Promise<BackupUploadResult>;
}

function assertRemotePath(targetPath: string): string {
  const trimmed = targetPath.trim();

  if (!trimmed) {
    throw new Error('Backup target path is required.');
  }

  const segments = trimmed.split('/').filter(Boolean);

  if (segments.length === 0) {
    throw new Error('Backup target path is required.');
  }

  if (segments.some((segment) => segment === '.' || segment === '..')) {
    throw new Error('Backup target path cannot escape the provider root.');
  }

  return `/${segments.join('/')}`;
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function resolveConflictTarget(
  absoluteTargetPath: string,
  sourceType: BackupSourceType,
  conflictPolicy: BackupConflictPolicy,
): Promise<{ absoluteTargetPath: string; skipped: boolean }> {
  const exists = await pathExists(absoluteTargetPath);

  if (!exists) {
    return {
      absoluteTargetPath,
      skipped: false,
    };
  }

  if (conflictPolicy === 'skip') {
    return {
      absoluteTargetPath,
      skipped: true,
    };
  }

  if (conflictPolicy === 'overwrite') {
    await rm(absoluteTargetPath, { recursive: true, force: true });
    return {
      absoluteTargetPath,
      skipped: false,
    };
  }

  const parsed = path.parse(absoluteTargetPath);
  const baseName = sourceType === 'file' ? parsed.name : path.basename(absoluteTargetPath);
  const extension = sourceType === 'file' ? parsed.ext : '';
  const parentDir = parsed.dir;
  let index = 1;

  while (true) {
    const nextCandidate = path.join(parentDir, `${baseName} (${index})${extension}`);

    if (!(await pathExists(nextCandidate))) {
      return {
        absoluteTargetPath: nextCandidate,
        skipped: false,
      };
    }

    index += 1;
  }
}

async function copyToRemote(
  remoteRoot: string,
  target: BackupTarget,
): Promise<BackupUploadResult> {
  const normalizedRemotePath = assertRemotePath(target.targetPath);
  const absoluteTargetPath = path.join(remoteRoot, ...normalizedRemotePath.slice(1).split('/'));
  const conflictTarget = await resolveConflictTarget(
    absoluteTargetPath,
    target.sourceType,
    target.conflictPolicy,
  );

  if (!conflictTarget.skipped) {
    await mkdir(path.dirname(conflictTarget.absoluteTargetPath), { recursive: true });
    await cp(target.absoluteSourcePath, conflictTarget.absoluteTargetPath, {
      recursive: target.sourceType === 'directory',
      force: true,
    });
  }

  const resolvedTargetPath = `/${path
    .relative(remoteRoot, conflictTarget.absoluteTargetPath)
    .split(path.sep)
    .join('/')}`;

  return {
    targetPath: resolvedTargetPath,
    skipped: conflictTarget.skipped,
  };
}

export class MockBackupProvider implements BackupProvider {
  readonly name = 'mock';

  constructor(private readonly remoteRoot: string) {}

  async testConnection(): Promise<BackupProviderStatus> {
    await mkdir(this.remoteRoot, { recursive: true });

    return {
      available: true,
      provider: this.name,
      message: `Mock backup provider mirrors files into ${this.remoteRoot}.`,
    };
  }

  async uploadFile(target: BackupTarget): Promise<BackupUploadResult> {
    return copyToRemote(this.remoteRoot, target);
  }

  async uploadDirectory(target: BackupTarget): Promise<BackupUploadResult> {
    return copyToRemote(this.remoteRoot, target);
  }
}

export class QuarkBackupProvider implements BackupProvider {
  readonly name = 'quark';

  constructor(private readonly cookie?: string) {}

  async testConnection(): Promise<BackupProviderStatus> {
    if (!this.cookie) {
      return {
        available: false,
        provider: this.name,
        message: 'Quark provider is selected, but no authenticated adapter credentials are configured yet.',
      };
    }

    return {
      available: false,
      provider: this.name,
      message: 'Quark provider scaffold is present, but the cloud-disk upload adapter still needs provider-specific wiring.',
    };
  }

  async uploadFile(): Promise<BackupUploadResult> {
    throw new Error('Quark backup adapter is not wired yet. Switch BACKUP_PROVIDER=mock for local task validation.');
  }

  async uploadDirectory(): Promise<BackupUploadResult> {
    throw new Error('Quark backup adapter is not wired yet. Switch BACKUP_PROVIDER=mock for local task validation.');
  }
}

export function createBackupProvider(input: {
  provider: string;
  mockRoot: string;
  quarkCookie?: string;
}): BackupProvider {
  if (input.provider === 'quark') {
    return new QuarkBackupProvider(input.quarkCookie);
  }

  return new MockBackupProvider(input.mockRoot);
}
