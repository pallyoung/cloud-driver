# Cloud Driver V1 Technical Design

## 1. Document Scope

This document defines the V1 technical architecture, development setup, deployment strategy, data model, front-end state model, API design, operational concerns, and delivery artifacts for Cloud Driver.

## 2. Architecture Overview

Cloud Driver V1 uses a modular monolith architecture.

### Core Characteristics

1. Single deployable application for production.
2. Browser-based front end and server API developed in one monorepo.
3. Server file system is the source of truth for managed files.
4. SQLite stores job state and lightweight system state only.
5. Export and backup are asynchronous jobs.
6. Quark integration is isolated behind a provider adapter.

### Runtime Topology

```text
Browser
  -> Reverse Proxy (Caddy or Nginx)
  -> Fastify Application
     -> SQLite
     -> Managed Roots (mounted directories)
     -> Temp Export Directory
     -> Log Directory
     -> Backup Provider Adapter
```

## 3. Repository Structure

```text
cloud-driver/
  apps/
    web/
    api/
  packages/
    shared/
    quark-adapter/
  config/
    roots.example.yaml
  docs/
    prd-v1.md
    ux-design-v1.md
    technical-design-v1.md
  data/
  logs/
  tmp/
  deploy/
    Dockerfile
    docker-compose.prod.yml
    Caddyfile
  scripts/
    hash-password.ts
  .env.example
  package.json
  pnpm-workspace.yaml
```

## 4. Technology Choices

### 4.1 Front End

| Concern | Technology |
| --- | --- |
| UI framework | React |
| Build tool | Vite |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Routing | React Router |
| Global state | `@relax-state/react` |
| Forms | React Hook Form |
| Text editor | Monaco Editor |
| HTTP | fetch wrapper |
| Live task updates | Server-Sent Events |

### 4.2 Back End

| Concern | Technology |
| --- | --- |
| API framework | Fastify |
| Language | TypeScript |
| Validation | Zod |
| Database | SQLite |
| ORM or query layer | Drizzle ORM |
| Logs | Pino |
| File watching | chokidar |
| Archive generation | archiver |
| Password hashing | argon2 or bcrypt |
| Session | secure cookie based session |

## 5. Core Domain Model

### 5.1 Managed Root

Configured outside the database in `roots.yaml`.

Fields:

1. `id`
2. `label`
3. `path`
4. `readOnly`

### 5.2 File Resource

Derived from the real file system, not stored as a persistent database entity.

Fields used in API payloads:

1. `rootId`
2. `relativePath`
3. `name`
4. `type`
5. `isDirectory`
6. `size`
7. `mimeType`
8. `modifiedAt`
9. `editable`
10. `previewable`

### 5.3 Export Job

Asynchronous task for folder packaging and download lifecycle.

### 5.4 Backup Job

Asynchronous task for provider-backed upload to Quark.

## 6. Front-End State Design With `@relax-state/react`

The front end will use `@relax-state/react` as the main global state system. Because the exact library API surface must match the installed version, this design defines the required state domains and responsibilities rather than hard-coding library-specific helper names in the spec.

### 6.1 State Domains

#### `authState`

Responsibilities:

1. Current authentication status.
2. Current session profile summary.
3. Login pending state.
4. Login error state.

Shape:

```ts
type AuthState = {
  status: "unknown" | "authenticated" | "anonymous";
  isSubmitting: boolean;
  error: string | null;
  session: {
    loggedInAt?: string;
  } | null;
};
```

#### `explorerState`

Responsibilities:

1. Active root.
2. Current directory path.
3. Breadcrumb path.
4. Search keyword.
5. Sort mode.
6. Expanded tree nodes.

Shape:

```ts
type ExplorerState = {
  activeRootId: string | null;
  currentPath: string;
  breadcrumbs: Array<{ name: string; path: string }>;
  keyword: string;
  sortBy: "name" | "type" | "size" | "modifiedAt";
  sortOrder: "asc" | "desc";
  expandedPaths: string[];
};
```

#### `selectionState`

Responsibilities:

1. Current selected rows.
2. Active item for detail panel.
3. Selection mode for bulk actions.

Shape:

```ts
type SelectionState = {
  selectedPaths: string[];
  activePath: string | null;
  activeType: "file" | "directory" | null;
};
```

#### `editorState`

Responsibilities:

1. Open file context.
2. Original content and working content.
3. Dirty-state tracking.
4. Save status.
5. Conflict state.

Shape:

```ts
type EditorState = {
  openFile: {
    rootId: string;
    path: string;
    etag: string;
    size: number;
    encoding: string;
  } | null;
  originalContent: string;
  draftContent: string;
  isDirty: boolean;
  isSaving: boolean;
  lastSavedAt: string | null;
  conflict: {
    detected: boolean;
    message: string | null;
  };
};
```

#### `jobsState`

Responsibilities:

1. Export jobs list.
2. Backup jobs list.
3. SSE connection state.
4. Per-job transient loading state for retry and download requests.

Shape:

```ts
type JobStatus =
  | "queued"
  | "processing"
  | "ready"
  | "downloading"
  | "completed"
  | "cleaned"
  | "failed"
  | "expired";

type JobsState = {
  connection: "idle" | "connecting" | "open" | "closed" | "error";
  exportJobs: ExportJobSummary[];
  backupJobs: BackupJobSummary[];
  lastEventAt: string | null;
};
```

#### `uiState`

Responsibilities:

1. Modal and drawer visibility.
2. Context menu state.
3. Toast state.
4. Responsive panel behavior.

Shape:

```ts
type UIState = {
  dialogs: {
    deleteConfirm: boolean;
    rename: boolean;
    move: boolean;
    export: boolean;
    backup: boolean;
  };
  drawers: {
    detailOpen: boolean;
    treeOpen: boolean;
  };
  toast: {
    kind: "success" | "error" | "info" | null;
    message: string | null;
  };
};
```

### 6.2 State Ownership Rules

1. `@relax-state/react` manages shared UI and business-view state.
2. The server remains the source of truth for file system and job lifecycle data.
3. API responses may optimistically patch state, but authoritative refresh follows write actions.
4. Long-running task updates enter the app through SSE and update `jobsState`.

### 6.3 Directory Layout for Front End

```text
apps/web/src/
  app/
    router.tsx
    providers.tsx
  pages/
    login/
    overview/
    explorer/
    jobs/
    settings/
  features/
    auth/
    explorer/
    editor/
    export/
    backup/
    jobs/
  state/
    auth/
    explorer/
    selection/
    editor/
    jobs/
    ui/
  components/
    layout/
    navigation/
    file-tree/
    file-table/
    detail-panel/
    preview/
    dialogs/
    status/
  lib/
    api/
    sse/
    file-utils/
```

## 7. Back-End Module Design

## 7.1 `auth`

Responsibilities:

1. Validate submitted password against configured hash.
2. Create and destroy secure sessions.
3. Protect authenticated routes.
4. Apply rate limiting.

## 7.2 `roots`

Responsibilities:

1. Load `roots.yaml`.
2. Validate root config at startup.
3. Expose root summaries to the UI.

## 7.3 `files`

Responsibilities:

1. Directory tree retrieval.
2. Directory listing.
3. File read and text content read.
4. Upload.
5. Download.
6. Create folder.
7. Rename.
8. Move.
9. Delete.
10. Text content save with conflict detection.

## 7.4 `exports`

Responsibilities:

1. Create export jobs.
2. Stream file downloads.
3. Package folders as `zip`.
4. Mark jobs ready for download.
5. Clean temp files after download or TTL expiry.

## 7.5 `backups`

Responsibilities:

1. Create backup jobs.
2. Invoke the provider abstraction.
3. Persist status updates.
4. Retry failed jobs.

## 7.6 `jobs`

Responsibilities:

1. Own in-process queue execution.
2. Publish SSE status events.
3. Recover resumable jobs on startup where applicable.

## 7.7 `settings`

Responsibilities:

1. Serve display-safe configuration and system status.
2. Expose backup provider availability summary.

## 7.8 `logging`

Responsibilities:

1. Structured app log output.
2. Error logs and operation traces to filesystem log files.

## 8. Persistence Design

## 8.1 SQLite Storage Scope

SQLite stores only:

1. Export jobs.
2. Backup jobs.
3. Lightweight system settings if needed.
4. Optional session metadata.

It does not store:

1. File tree snapshots.
2. Full file metadata index.
3. Root whitelist definitions.
4. Audit tables.

## 8.2 Database Schema Draft

### `export_jobs`

| Field | Type | Notes |
| --- | --- | --- |
| `id` | text | Primary key |
| `root_id` | text | Root identifier |
| `source_path` | text | Relative path |
| `source_type` | text | `file` or `directory` |
| `archive_name` | text | Generated archive filename |
| `temp_file_path` | text | Server temp archive path |
| `status` | text | Job status enum |
| `error_message` | text nullable | Last failure |
| `created_at` | text | ISO datetime |
| `updated_at` | text | ISO datetime |
| `expires_at` | text nullable | TTL cleanup deadline |
| `downloaded_at` | text nullable | Download completion time |
| `cleaned_at` | text nullable | Temp cleanup time |

### `backup_jobs`

| Field | Type | Notes |
| --- | --- | --- |
| `id` | text | Primary key |
| `root_id` | text | Root identifier |
| `source_path` | text | Relative path |
| `source_type` | text | `file` or `directory` |
| `provider` | text | `mock` or `quark` |
| `target_path` | text | Provider-side destination |
| `conflict_policy` | text | `skip`, `overwrite`, `rename` |
| `status` | text | Job status enum |
| `progress` | integer nullable | Optional percentage |
| `error_message` | text nullable | Last failure |
| `retry_count` | integer | Retry counter |
| `created_at` | text | ISO datetime |
| `updated_at` | text | ISO datetime |
| `completed_at` | text nullable | Completion time |

### `system_settings`

| Field | Type | Notes |
| --- | --- | --- |
| `key` | text | Primary key |
| `value` | text | Serialized setting |
| `updated_at` | text | ISO datetime |

## 9. Root Configuration

`config/roots.yaml` defines the managed roots:

```yaml
roots:
  - id: docs
    label: Documents
    path: /managed/docs
    readOnly: false
  - id: media
    label: Media
    path: /managed/media
    readOnly: false
```

Rules:

1. Root IDs are unique.
2. Paths must exist or fail fast at startup based on environment mode.
3. Root paths are never editable from the browser in V1.

## 10. File-System Safety Model

All file actions must pass through a common path guard.

### Path Guard Rules

1. APIs accept `rootId` and `relativePath`, never arbitrary absolute paths.
2. Normalize and resolve the path against the root directory.
3. Reject any resolved path that escapes the root boundary.
4. Enforce read-only restrictions before write actions.
5. Guard against symlink traversal outside the root.

### Write Strategy

For text-file saving:

1. Read metadata and current `etag`.
2. Compare with client-supplied `etag`.
3. Write to a temporary file.
4. Atomically replace the target file.

## 11. API Design

## 11.1 Authentication APIs

### `POST /api/auth/login`

Request:

```json
{
  "password": "string"
}
```

Response:

```json
{
  "ok": true
}
```

### `POST /api/auth/logout`

Response:

```json
{
  "ok": true
}
```

### `GET /api/auth/me`

Response:

```json
{
  "authenticated": true
}
```

## 11.2 Roots APIs

### `GET /api/roots`

Response:

```json
{
  "roots": [
    {
      "id": "docs",
      "label": "Documents",
      "readOnly": false
    }
  ]
}
```

## 11.3 File APIs

### `GET /api/files/tree?rootId=docs&path=projects`

Response:

```json
{
  "path": "projects",
  "children": [
    {
      "name": "images",
      "path": "projects/images",
      "isDirectory": true
    }
  ]
}
```

### `GET /api/files/list?rootId=docs&path=projects`

Response:

```json
{
  "rootId": "docs",
  "path": "projects",
  "items": [
    {
      "name": "readme.md",
      "path": "projects/readme.md",
      "type": "file",
      "size": 2048,
      "mimeType": "text/markdown",
      "modifiedAt": "2026-03-23T10:00:00.000Z",
      "editable": true,
      "previewable": true
    }
  ]
}
```

### `GET /api/files/content?rootId=docs&path=projects/readme.md`

Response:

```json
{
  "rootId": "docs",
  "path": "projects/readme.md",
  "content": "# Title",
  "etag": "abc123",
  "encoding": "utf-8",
  "size": 2048,
  "modifiedAt": "2026-03-23T10:00:00.000Z"
}
```

### `PUT /api/files/content`

Request:

```json
{
  "rootId": "docs",
  "path": "projects/readme.md",
  "content": "# Updated",
  "etag": "abc123"
}
```

Success response:

```json
{
  "ok": true,
  "etag": "def456",
  "modifiedAt": "2026-03-23T10:05:00.000Z"
}
```

Conflict response:

```json
{
  "ok": false,
  "code": "FILE_CONFLICT",
  "message": "The file changed after it was loaded."
}
```

### `POST /api/files/mkdir`

Request:

```json
{
  "rootId": "docs",
  "parentPath": "projects",
  "name": "drafts"
}
```

### `PATCH /api/files/rename`

Request:

```json
{
  "rootId": "docs",
  "path": "projects/readme.md",
  "newName": "overview.md"
}
```

### `POST /api/files/move`

Request:

```json
{
  "rootId": "docs",
  "sourcePath": "projects/readme.md",
  "targetDirPath": "archive"
}
```

### `DELETE /api/files`

Request:

```json
{
  "rootId": "docs",
  "path": "projects/readme.md"
}
```

### `POST /api/files/upload`

Multipart upload with fields:

1. `rootId`
2. `targetPath`
3. `file`

### `GET /api/files/download?rootId=docs&path=projects/readme.md`

Streams the selected file directly.

## 11.4 Export APIs

### `POST /api/exports`

Request:

```json
{
  "rootId": "docs",
  "path": "projects"
}
```

Response:

```json
{
  "jobId": "exp_123",
  "status": "queued"
}
```

### `GET /api/exports/:id`

Response:

```json
{
  "id": "exp_123",
  "status": "ready",
  "downloadUrl": "/api/exports/exp_123/download"
}
```

### `GET /api/exports/:id/download`

Downloads the generated archive and triggers post-download cleanup workflow.

## 11.5 Backup APIs

### `POST /api/backups`

Request:

```json
{
  "rootId": "docs",
  "path": "projects",
  "targetPath": "/backup/projects",
  "conflictPolicy": "overwrite"
}
```

Response:

```json
{
  "jobId": "bak_123",
  "status": "queued"
}
```

### `GET /api/backups/jobs`

Response:

```json
{
  "items": [
    {
      "id": "bak_123",
      "status": "processing",
      "sourcePath": "projects",
      "targetPath": "/backup/projects",
      "progress": 40
    }
  ]
}
```

### `POST /api/backups/jobs/:id/retry`

Response:

```json
{
  "ok": true,
  "status": "queued"
}
```

## 11.6 Jobs and Settings APIs

### `GET /api/jobs`

Returns merged export and backup task summaries for the task center.

### `GET /api/jobs/stream`

SSE endpoint for task updates.

Event payload example:

```json
{
  "type": "job.updated",
  "jobKind": "export",
  "jobId": "exp_123",
  "status": "ready",
  "updatedAt": "2026-03-23T10:10:00.000Z"
}
```

### `GET /api/settings`

Returns display-safe configuration and system summaries.

## 12. Job System Design

## 12.1 Export Job State Machine

States:

1. `queued`
2. `processing`
3. `ready`
4. `downloading`
5. `completed`
6. `cleaned`
7. `failed`
8. `expired`

Transitions:

1. `queued -> processing`
2. `processing -> ready`
3. `processing -> failed`
4. `ready -> downloading`
5. `downloading -> completed`
6. `ready -> expired`
7. `completed -> cleaned`
8. `expired -> cleaned`

## 12.2 Backup Job State Machine

States:

1. `queued`
2. `processing`
3. `completed`
4. `failed`
5. `cancelled` optional future state

Transitions:

1. `queued -> processing`
2. `processing -> completed`
3. `processing -> failed`
4. `failed -> queued` on retry

## 13. Text Editing Design

### Rules

1. Only supported text files can enter edit mode.
2. Default size limit should be configurable, starting at `2MB`.
3. Encoding support prioritizes UTF-8.
4. Save operations must use optimistic concurrency checks.
5. The API should preserve line-ending style where practical.

### Editor Stack

1. Monaco editor is lazy-loaded.
2. `editorState` tracks `originalContent`, `draftContent`, and `etag`.
3. Save action posts full content in V1.

## 14. Export Design

### File Export

1. Direct streaming response.
2. No temp archive created.

### Folder Export

1. Create export job record.
2. Queue archive generation.
3. Archive into temp export directory.
4. Mark job ready when archive exists.
5. Download endpoint streams archive.
6. Cleanup task removes archive after successful download or TTL expiry.

### Temp File Cleanup

1. Cleanup on successful download.
2. Periodic cleanup worker for expired archives.
3. Startup scan to remove stale temp files and reconcile job state.

## 15. Backup Provider Design

The system uses a provider interface so the rest of the application is not tied to one cloud implementation.

### Reality Check For Quark

Verified on 2026-03-23:

1. Official Quark properties reviewed for this project did not expose a confirmed cloud-drive OpenAPI or OAuth upload surface for third-party server integrations.
2. The current official developer entry point appears to be the Quark Mini Program platform rather than a documented cloud-drive API.
3. Therefore the project keeps the provider seam, ships `mock` by default, and treats a browser-automation provider as the first realistic real-upload path.
4. Detailed analysis and implementation path are documented in `docs/quark-integration-feasibility-v1.md`.

### Provider Contract

Methods:

1. `testConnection()`
2. `uploadFile()`
3. `uploadDirectory()`
4. `createRemoteFolder()`
5. `getJobStatus()` if needed by the provider model

### Planned Implementations

1. `MockBackupProvider`
2. `QuarkBackupProvider`

### Quark Integration Risk Handling

1. The app ships with a provider seam from day one.
2. All task lifecycle logic is provider-agnostic.
3. A mock provider can validate UX and task orchestration before real Quark integration is finalized.

## 16. Development Environment

### 16.1 Local Requirements

1. Node.js 22 LTS
2. pnpm
3. SQLite local file access
4. Writable `data`, `logs`, and `tmp` directories

### 16.2 Local Directory Layout

```text
cloud-driver/
  config/roots.yaml
  dev-roots/
    docs/
    media/
  data/
  logs/
  tmp/exports/
```

### 16.3 Local Environment Variables

```env
APP_PORT=3001
WEB_PORT=5173
SESSION_SECRET=change-me
PASSWORD_HASH=change-me
SQLITE_PATH=./data/cloud-driver.db
LOG_DIR=./logs
TEMP_EXPORT_DIR=./tmp/exports
EXPORT_TTL_MINUTES=30
BACKUP_PROVIDER=mock
```

### 16.4 Local Run Flow

1. Install dependencies with `pnpm install`
2. Create `.env` from `.env.example`
3. Create `config/roots.yaml`
4. Run database migrations
5. Start development servers with `pnpm dev`

Expected local endpoints:

1. Web: `http://localhost:5173`
2. API: `http://localhost:3001`

## 17. Production Deployment

## 17.1 Deployment Model

Recommended production model:

1. Build front-end static assets.
2. Bundle front-end assets into the application image.
3. Run one application container behind Caddy or Nginx.
4. Mount configuration, SQLite data, logs, temp exports, and managed roots from the host.

## 17.2 Host Directory Layout

```text
/srv/cloud-driver/
  .env
  config/roots.yaml
  data/cloud-driver.db
  logs/
  tmp/exports/
```

Managed data directories can live elsewhere, for example:

```text
/data/projects
/data/archive
```

Mounted into the app container as:

```text
/managed/projects
/managed/archive
```

## 17.3 Production Services

1. `caddy` or `nginx` for TLS and reverse proxy
2. `app` for API and static assets

## 17.4 Production Environment Variables

```env
NODE_ENV=production
APP_PORT=3001
SESSION_SECRET=strong-random-secret
PASSWORD_HASH=argon2-or-bcrypt-hash
SQLITE_PATH=/app/data/cloud-driver.db
LOG_DIR=/app/logs
TEMP_EXPORT_DIR=/app/tmp/exports
EXPORT_TTL_MINUTES=30
BACKUP_PROVIDER=quark
QUARK_*=...
```

## 17.5 Production Delivery Artifacts

1. Source repository
2. Application container image
3. `deploy/Dockerfile`
4. `deploy/docker-compose.prod.yml`
5. `deploy/Caddyfile`
6. `.env.example`
7. `config/roots.example.yaml`
8. Database migration files
9. Operation and deployment documentation

## 18. Logging and Observability

### Log Outputs

1. `logs/app.log`
2. `logs/error.log`

### Log Content

1. App startup and shutdown events
2. Auth success and failure summaries
3. Export job creation, completion, and cleanup
4. Backup job creation, retry, and failure
5. File write errors and path validation failures

### Health Endpoints

1. `GET /api/health/live`
2. `GET /api/health/ready`

## 19. Testing Strategy

### Unit Tests

1. Path normalization and path guard rules
2. Root config validation
3. Job state transitions
4. Text edit conflict detection

### Integration Tests

1. File CRUD against test directories
2. Export packaging and cleanup
3. Backup task orchestration with mock provider

### E2E Tests

1. Login flow
2. Browse and open file
3. Edit text file and save
4. Export folder and download archive
5. Create backup job and observe task state

## 20. Implementation Plan

### Phase 1

1. Monorepo bootstrap
2. Front-end shell
3. Login flow
4. Root browsing

### Phase 2

1. File list
2. CRUD endpoints
3. Preview and text editor

### Phase 3

1. Export job pipeline
2. Task center
3. Cleanup worker

### Phase 4

1. Backup job pipeline
2. Mock provider
3. Quark provider integration seam

## 21. Open Risks and Decisions

1. Final Quark implementation depends on provider-level integration feasibility.
2. Very large directory exports may require size or depth limits.
3. The exact `@relax-state/react` API usage must follow the chosen package version during implementation.
4. Future migration from SQLite to PostgreSQL should remain possible by keeping the persistence model narrow.
