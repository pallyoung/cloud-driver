import { createReadStream, createWriteStream } from 'node:fs';
import {
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { randomUUID } from 'node:crypto';
import type { FileContentResponse, FileItem, ManagedRoot } from '@cloud-driver/shared';

const MAX_EDITABLE_SIZE_BYTES = 2 * 1024 * 1024;

const editableExtensions = new Set([
  '.txt',
  '.md',
  '.json',
  '.yaml',
  '.yml',
  '.xml',
  '.html',
  '.css',
  '.js',
  '.ts',
  '.sh',
  '.py',
  '.go',
  '.java',
  '.sql',
  '.log',
  '.ini',
  '.conf',
]);

const mimeByExtension: Record<string, string> = {
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.json': 'application/json',
  '.yaml': 'application/yaml',
  '.yml': 'application/yaml',
  '.xml': 'application/xml',
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.ts': 'text/typescript',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
};

const inlinePreviewMimeTypes = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'application/pdf',
  'video/mp4',
  'video/webm',
  'video/quicktime',
]);

export class FileServiceError extends Error {
  readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = 'FileServiceError';
    this.statusCode = statusCode;
  }
}

type FileMetadata = {
  stats: Awaited<ReturnType<typeof stat>>;
  extension: string;
  mimeType: string;
  lineEnding: 'lf' | 'crlf';
};

function getMimeType(extension: string): string {
  return mimeByExtension[extension] ?? 'application/octet-stream';
}

function isEditableExtension(extension: string): boolean {
  return editableExtensions.has(extension);
}

function isInlinePreviewMimeType(mimeType: string): boolean {
  return inlinePreviewMimeTypes.has(mimeType);
}

function isEditableFile(metadata: FileMetadata): boolean {
  return isEditableExtension(metadata.extension) && metadata.stats.size <= MAX_EDITABLE_SIZE_BYTES;
}

function getEditBlockedReason(metadata: FileMetadata): 'size-limit' | 'unsupported-type' | undefined {
  if (!isEditableExtension(metadata.extension)) {
    return 'unsupported-type';
  }

  if (metadata.stats.size > MAX_EDITABLE_SIZE_BYTES) {
    return 'size-limit';
  }

  return undefined;
}

function isPreviewableFile(metadata: FileMetadata): boolean {
  if (isEditableFile(metadata)) {
    return true;
  }

  return isInlinePreviewMimeType(metadata.mimeType);
}

function getRelativePath(root: ManagedRoot, absolutePath: string): string {
  return path.relative(root.path!, absolutePath).split(path.sep).join('/');
}

function ensureRootPath(root: ManagedRoot): string {
  if (!root.path) {
    throw new FileServiceError(500, `Root "${root.id}" has no resolved path`);
  }

  return root.path;
}

function ensureWritableRoot(root: ManagedRoot): void {
  if (root.readOnly) {
    throw new FileServiceError(403, `Root "${root.id}" is read-only`);
  }
}

function assertSafeName(name: string, label: string): string {
  const trimmed = name.trim();

  if (!trimmed) {
    throw new FileServiceError(400, `${label} is required`);
  }

  if (trimmed === '.' || trimmed === '..' || trimmed.includes('/') || trimmed.includes('\\')) {
    throw new FileServiceError(400, `${label} is invalid`);
  }

  return trimmed;
}

async function getMetadata(absolutePath: string): Promise<FileMetadata> {
  const stats = await stat(absolutePath);
  const extension = path.extname(absolutePath).toLowerCase();
  const mimeType = getMimeType(extension);
  let lineEnding: 'lf' | 'crlf' = 'lf';

  if (stats.isFile() && stats.size > 0 && stats.size <= MAX_EDITABLE_SIZE_BYTES && isEditableExtension(extension)) {
    const raw = await readFile(absolutePath, 'utf8');
    lineEnding = raw.includes('\r\n') ? 'crlf' : 'lf';
  }

  return {
    stats,
    extension,
    mimeType,
    lineEnding,
  };
}

function buildEtag(stats: Awaited<ReturnType<typeof stat>>): string {
  return `${stats.mtimeMs}-${stats.size}`;
}

function normalizeContentForLineEnding(content: string, lineEnding: 'lf' | 'crlf'): string {
  const normalized = content.replace(/\r\n/g, '\n');
  return lineEnding === 'crlf' ? normalized.replace(/\n/g, '\r\n') : normalized;
}

function ensureTextFile(extension: string, stats: Awaited<ReturnType<typeof stat>>): void {
  if (!isEditableExtension(extension)) {
    throw new FileServiceError(400, 'This file type cannot be edited online');
  }

  if (stats.size > MAX_EDITABLE_SIZE_BYTES) {
    throw new FileServiceError(400, 'This file is too large for online editing');
  }
}

export function getRootById(roots: ManagedRoot[], rootId: string): ManagedRoot {
  const root = roots.find((entry) => entry.id === rootId);

  if (!root) {
    throw new FileServiceError(404, `Root "${rootId}" not found`);
  }

  ensureRootPath(root);
  return root;
}

export function resolvePathWithinRoot(root: ManagedRoot, relativePath = ''): string {
  const rootPath = ensureRootPath(root);

  if (path.isAbsolute(relativePath)) {
    throw new FileServiceError(400, 'Absolute paths are not allowed');
  }

  const normalizedRelative = path.normalize(relativePath || '.');
  const resolved = path.resolve(rootPath, normalizedRelative);
  const rootBoundary = `${rootPath}${path.sep}`;

  if (resolved !== rootPath && !resolved.startsWith(rootBoundary)) {
    throw new FileServiceError(400, 'Path escapes the managed root');
  }

  return resolved;
}

export async function listDirectory(root: ManagedRoot, relativePath = ''): Promise<FileItem[]> {
  const directoryPath = resolvePathWithinRoot(root, relativePath);
  const directoryStats = await stat(directoryPath).catch(() => {
    throw new FileServiceError(404, 'Directory not found');
  });

  if (!directoryStats.isDirectory()) {
    throw new FileServiceError(400, 'Target path is not a directory');
  }

  const entries = await readdir(directoryPath, { withFileTypes: true });
  const items = await Promise.all(
    entries.map(async (entry): Promise<FileItem> => {
      const absoluteEntryPath = path.join(directoryPath, entry.name);
      const metadata = await getMetadata(absoluteEntryPath);
      const isDirectory = metadata.stats.isDirectory();
      const editable = !isDirectory && isEditableFile(metadata);

      return {
        name: entry.name,
        path: getRelativePath(root, absoluteEntryPath),
        type: isDirectory ? 'directory' : 'file',
        size: isDirectory ? null : Number(metadata.stats.size),
        mimeType: isDirectory ? undefined : metadata.mimeType,
        modifiedAt: metadata.stats.mtime.toISOString(),
        editable,
        previewable: !isDirectory && isPreviewableFile(metadata),
        editBlockedReason: !isDirectory && !editable ? getEditBlockedReason(metadata) : undefined,
      };
    }),
  );

  return items.sort((left, right) => {
    if (left.type !== right.type) {
      return left.type === 'directory' ? -1 : 1;
    }

    return left.name.localeCompare(right.name, undefined, { sensitivity: 'base' });
  });
}

export async function readTextFile(root: ManagedRoot, relativePath: string): Promise<FileContentResponse> {
  const filePath = resolvePathWithinRoot(root, relativePath);
  const metadata = await getMetadata(filePath).catch(() => {
    throw new FileServiceError(404, 'File not found');
  });

  if (!metadata.stats.isFile()) {
    throw new FileServiceError(400, 'Target path is not a file');
  }

  ensureTextFile(metadata.extension, metadata.stats);
  const content = await readFile(filePath, 'utf8');

  if (content.includes('\u0000')) {
    throw new FileServiceError(400, 'Binary files cannot be edited as text');
  }

  return {
    rootId: root.id,
    path: getRelativePath(root, filePath),
    content,
    etag: buildEtag(metadata.stats),
    encoding: 'utf-8',
    lineEnding: metadata.lineEnding,
    size: Number(metadata.stats.size),
    modifiedAt: metadata.stats.mtime.toISOString(),
  };
}

export async function saveTextFile(
  root: ManagedRoot,
  relativePath: string,
  content: string,
  expectedEtag: string,
): Promise<FileContentResponse> {
  ensureWritableRoot(root);

  const filePath = resolvePathWithinRoot(root, relativePath);
  const metadata = await getMetadata(filePath).catch(() => {
    throw new FileServiceError(404, 'File not found');
  });

  if (!metadata.stats.isFile()) {
    throw new FileServiceError(400, 'Target path is not a file');
  }

  ensureTextFile(metadata.extension, metadata.stats);
  const currentEtag = buildEtag(metadata.stats);

  if (expectedEtag !== currentEtag) {
    throw new FileServiceError(409, 'The file changed after it was loaded.');
  }

  const normalizedContent = normalizeContentForLineEnding(content, metadata.lineEnding);
  const tempPath = path.join(path.dirname(filePath), `.cloud-driver-${randomUUID()}.tmp`);
  await writeFile(tempPath, normalizedContent, 'utf8');
  await rename(tempPath, filePath);

  return readTextFile(root, relativePath);
}

export async function createFolder(root: ManagedRoot, parentPath: string, name: string): Promise<void> {
  ensureWritableRoot(root);

  const safeName = assertSafeName(name, 'Folder name');
  const parentDirectory = resolvePathWithinRoot(root, parentPath);
  const parentStats = await stat(parentDirectory).catch(() => {
    throw new FileServiceError(404, 'Parent directory not found');
  });

  if (!parentStats.isDirectory()) {
    throw new FileServiceError(400, 'Parent path is not a directory');
  }

  const targetPath = path.join(parentDirectory, safeName);
  await mkdir(targetPath).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'EEXIST') {
      throw new FileServiceError(409, 'A folder with that name already exists');
    }

    throw error;
  });
}

export async function moveEntry(root: ManagedRoot, sourcePath: string, targetDirPath: string): Promise<string> {
  ensureWritableRoot(root);

  const absoluteSourcePath = resolvePathWithinRoot(root, sourcePath);
  const absoluteTargetDirPath = resolvePathWithinRoot(root, targetDirPath);
  const sourceStats = await stat(absoluteSourcePath).catch(() => {
    throw new FileServiceError(404, 'Source path not found');
  });
  const targetDirStats = await stat(absoluteTargetDirPath).catch(() => {
    throw new FileServiceError(404, 'Target directory not found');
  });

  if (!targetDirStats.isDirectory()) {
    throw new FileServiceError(400, 'Target path is not a directory');
  }

  const targetPath = path.join(absoluteTargetDirPath, path.basename(absoluteSourcePath));

  if (absoluteSourcePath === targetPath) {
    throw new FileServiceError(400, 'Source and target are the same');
  }

  if (sourceStats.isDirectory()) {
    const sourceBoundary = `${absoluteSourcePath}${path.sep}`;
    if (absoluteTargetDirPath === absoluteSourcePath || absoluteTargetDirPath.startsWith(sourceBoundary)) {
      throw new FileServiceError(400, 'A directory cannot be moved into itself');
    }
  }

  await stat(targetPath)
    .then(() => {
      throw new FileServiceError(409, 'A file or folder with that name already exists in the target directory');
    })
    .catch((error: unknown) => {
      if (error instanceof FileServiceError) {
        throw error;
      }

      if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') {
        throw error;
      }
    });

  await rename(absoluteSourcePath, targetPath).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') {
      throw new FileServiceError(404, 'Source path not found');
    }

    throw error;
  });

  return getRelativePath(root, targetPath);
}

export async function renameEntry(root: ManagedRoot, relativePath: string, newName: string): Promise<string> {
  ensureWritableRoot(root);

  const safeName = assertSafeName(newName, 'New name');
  const sourcePath = resolvePathWithinRoot(root, relativePath);

  if (sourcePath === root.path) {
    throw new FileServiceError(400, 'The root directory cannot be renamed');
  }

  const sourceStats = await stat(sourcePath).catch(() => {
    throw new FileServiceError(404, 'Path not found');
  });

  if (!sourceStats) {
    throw new FileServiceError(404, 'Path not found');
  }

  const targetPath = path.join(path.dirname(sourcePath), safeName);
  await stat(targetPath)
    .then(() => {
      throw new FileServiceError(409, 'A file or folder with that name already exists');
    })
    .catch((error: unknown) => {
      if (error instanceof FileServiceError) {
        throw error;
      }

      if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') {
        throw error;
      }
    });

  await rename(sourcePath, targetPath).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') {
      throw new FileServiceError(404, 'Path not found');
    }

    throw error;
  });

  return getRelativePath(root, targetPath);
}

export async function deleteEntry(root: ManagedRoot, relativePath: string): Promise<void> {
  ensureWritableRoot(root);

  const targetPath = resolvePathWithinRoot(root, relativePath);

  if (targetPath === root.path) {
    throw new FileServiceError(400, 'The root directory cannot be deleted');
  }

  await stat(targetPath).catch(() => {
    throw new FileServiceError(404, 'Path not found');
  });

  await rm(targetPath, { recursive: true, force: false });
}

export async function getDownloadInfo(root: ManagedRoot, relativePath: string): Promise<{
  filePath: string;
  fileName: string;
  mimeType: string;
}> {
  const filePath = resolvePathWithinRoot(root, relativePath);
  const metadata = await getMetadata(filePath).catch(() => {
    throw new FileServiceError(404, 'File not found');
  });

  if (!metadata.stats.isFile()) {
    throw new FileServiceError(400, 'Only files can be downloaded directly');
  }

  return {
    filePath,
    fileName: path.basename(filePath),
    mimeType: metadata.mimeType,
  };
}

export async function getPreviewInfo(root: ManagedRoot, relativePath: string): Promise<{
  filePath: string;
  fileName: string;
  mimeType: string;
}> {
  const preview = await getDownloadInfo(root, relativePath);

  if (!isInlinePreviewMimeType(preview.mimeType)) {
    throw new FileServiceError(400, 'This file type is not available for inline preview');
  }

  return preview;
}

export function createFileReadStream(filePath: string) {
  return createReadStream(filePath);
}

export async function saveUploadedFile(
  root: ManagedRoot,
  targetDirPath: string,
  fileName: string,
  sourceStream: NodeJS.ReadableStream,
): Promise<string> {
  ensureWritableRoot(root);

  const safeName = assertSafeName(fileName, 'File name');
  const absoluteTargetDirPath = resolvePathWithinRoot(root, targetDirPath);
  const targetDirStats = await stat(absoluteTargetDirPath).catch(() => {
    throw new FileServiceError(404, 'Target directory not found');
  });

  if (!targetDirStats.isDirectory()) {
    throw new FileServiceError(400, 'Target path is not a directory');
  }

  const targetPath = path.join(absoluteTargetDirPath, safeName);
  await stat(targetPath)
    .then(() => {
      throw new FileServiceError(409, 'A file with that name already exists');
    })
    .catch((error: unknown) => {
      if (error instanceof FileServiceError) {
        throw error;
      }

      if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') {
        throw error;
      }
    });

  const tempPath = path.join(absoluteTargetDirPath, `.cloud-driver-upload-${randomUUID()}.tmp`);
  const writeStream = createWriteStream(tempPath);

  try {
    await pipeline(sourceStream, writeStream);
    await rename(tempPath, targetPath);
  } catch (error) {
    await rm(tempPath, { force: true }).catch(() => undefined);
    throw error;
  }

  return getRelativePath(root, targetPath);
}
