import type {
  BackupJobSummary,
  FileContentResponse,
  FileListResponse,
  JobsResponse,
  RootListResponse,
  SessionResponse,
  SettingsResponse,
  ExportJobSummary,
} from '@cloud-driver/shared';

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<T>(input: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);

  if (init?.body && !(init.body instanceof FormData) && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }

  const response = await fetch(input, {
    ...init,
    credentials: 'include',
    headers,
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;

    try {
      const data = (await response.json()) as { message?: string };
      if (data.message) {
        message = data.message;
      }
    } catch {
      // Ignore invalid error response bodies.
    }

    throw new ApiError(response.status, message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function getSession(): Promise<SessionResponse> {
  try {
    return await request<SessionResponse>('/api/auth/me');
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return { authenticated: false };
    }

    throw error;
  }
}

export async function login(password: string): Promise<void> {
  await request<{ ok: true }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
}

export async function logout(): Promise<void> {
  await request<{ ok: true }>('/api/auth/logout', {
    method: 'POST',
  });
}

export async function getRoots(): Promise<RootListResponse> {
  return request<RootListResponse>('/api/roots');
}

export async function getFilesList(rootId: string, relativePath = ''): Promise<FileListResponse> {
  const query = new URLSearchParams({
    rootId,
    path: relativePath,
  });

  return request<FileListResponse>(`/api/files/list?${query.toString()}`);
}

export async function getSettings(): Promise<SettingsResponse> {
  return request<SettingsResponse>('/api/settings');
}

export async function getFileContent(rootId: string, relativePath: string): Promise<FileContentResponse> {
  const query = new URLSearchParams({
    rootId,
    path: relativePath,
  });

  return request<FileContentResponse>(`/api/files/content?${query.toString()}`);
}

export async function saveFileContent(input: {
  rootId: string;
  path: string;
  content: string;
  etag: string;
}): Promise<{ ok: true; etag: string; modifiedAt: string; lineEnding: 'lf' | 'crlf' }> {
  return request<{ ok: true; etag: string; modifiedAt: string; lineEnding: 'lf' | 'crlf' }>('/api/files/content', {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export async function createFolder(input: {
  rootId: string;
  parentPath: string;
  name: string;
}): Promise<void> {
  await request<{ ok: true }>('/api/files/mkdir', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function renamePath(input: {
  rootId: string;
  path: string;
  newName: string;
}): Promise<{ ok: true; path: string }> {
  return request<{ ok: true; path: string }>('/api/files/rename', {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function deletePath(input: { rootId: string; path: string }): Promise<void> {
  await request<{ ok: true }>('/api/files', {
    method: 'DELETE',
    body: JSON.stringify(input),
  });
}

export function getDownloadUrl(rootId: string, relativePath: string): string {
  const query = new URLSearchParams({
    rootId,
    path: relativePath,
  });

  return `/api/files/download?${query.toString()}`;
}

export function getPreviewUrl(rootId: string, relativePath: string): string {
  const query = new URLSearchParams({
    rootId,
    path: relativePath,
  });

  return `/api/files/preview?${query.toString()}`;
}

export async function movePath(input: {
  rootId: string;
  sourcePath: string;
  targetDirPath: string;
}): Promise<{ ok: true; path: string }> {
  return request<{ ok: true; path: string }>('/api/files/move', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function uploadFile(input: {
  rootId: string;
  targetPath: string;
  file: File;
}): Promise<{ ok: true; path: string }> {
  const formData = new FormData();
  formData.set('rootId', input.rootId);
  formData.set('targetPath', input.targetPath);
  formData.set('file', input.file);

  return request<{ ok: true; path: string }>('/api/files/upload', {
    method: 'POST',
    body: formData,
  });
}

export async function createExportJob(input: {
  rootId: string;
  path: string;
}): Promise<ExportJobSummary> {
  return request<ExportJobSummary>('/api/exports', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function createBackupJob(input: {
  rootId: string;
  path: string;
  targetPath: string;
  conflictPolicy: 'skip' | 'overwrite' | 'rename';
}): Promise<BackupJobSummary> {
  return request<BackupJobSummary>('/api/backups', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function retryBackupJob(id: string): Promise<BackupJobSummary> {
  return request<BackupJobSummary>(`/api/backups/jobs/${id}/retry`, {
    method: 'POST',
  });
}

export async function getJobs(): Promise<JobsResponse> {
  return request<JobsResponse>('/api/jobs');
}
