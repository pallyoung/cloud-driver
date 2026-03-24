# Cloud Driver V1 PRD

## 1. Document Info

| Item | Value |
| --- | --- |
| Product Name | Cloud Driver |
| Version | V1 |
| Document Type | Product Requirements Document |
| Target Phase | Design baseline before implementation |
| Primary User | Single administrator |

## 2. Product Summary

Cloud Driver is a single-user web console for remotely managing files under a server-defined whitelist of directories. The system uses the server file system as the source of truth, exposes those directories in a browser, supports file and folder CRUD operations, provides text-file editing, supports file and folder export, and supports backing up files or folders to Quark Cloud Drive through a provider adapter.

## 3. Goals

### 3.1 Business Goals

1. Reduce the need to log into the server directly for common file operations.
2. Provide a controlled web interface for managing server directories.
3. Add a reliable export workflow for files and folders.
4. Add a task-based backup workflow for Quark Cloud Drive.

### 3.2 User Goals

1. Quickly browse the server directory structure from a browser.
2. Safely edit text files without breaking the server file structure.
3. Export files or entire folders without manual shell work.
4. Monitor long-running export and backup jobs in one place.

### 3.3 Product Principles

1. The real file system is the only source of truth.
2. Security boundaries are defined server-side, not by the browser.
3. Long-running operations must be task-based and observable.
4. Destructive actions must be explicit and confirmable.
5. The first version optimizes for a single trusted operator, not collaboration.

## 4. Non-Goals

The following are out of scope for V1:

1. Multi-user accounts, roles, and permissions.
2. Audit-log pages backed by database tables.
3. Recycle bin and restore workflows.
4. Version history and file diff history.
5. Collaborative editing.
6. Office document online editing.
7. Bidirectional sync with Quark Cloud Drive.
8. Distributed deployment or active-active scaling.

## 5. Users and Personas

### 5.1 Primary Persona

| Persona | Description |
| --- | --- |
| Admin Operator | Maintains server-side documents, media, configuration, and project assets from a browser instead of SSH or file transfer tools. |

### 5.2 Primary User Traits

1. Comfortable with directory structures and file operations.
2. Needs speed, clarity, and low-risk actions.
3. Often works with text configs, scripts, assets, and archives.
4. Needs predictable task feedback for export and backup workflows.

## 6. Problem Statement

Managing server files directly via SSH, SFTP, or shell utilities is error-prone and inefficient for routine tasks. The operator needs a controlled browser-based interface that:

1. Limits access to allowed directories only.
2. Preserves the real file hierarchy.
3. Supports safe text editing.
4. Supports export of files and folders.
5. Supports backup workflows to Quark Cloud Drive.

## 7. Scope

### 7.1 In Scope

1. Single-password login.
2. Server-defined root directory whitelist.
3. File tree and file list browsing.
4. File and folder CRUD inside allowed roots.
5. Text-file preview and editing.
6. Binary-file preview where feasible.
7. File direct download.
8. Folder export as generated `zip`.
9. Automatic cleanup of temporary export archives after successful download or TTL expiry.
10. Task center for export and backup jobs.
11. Backup to Quark Cloud Drive via provider abstraction.
12. SQLite persistence for jobs and system state.
13. Server-side log files for troubleshooting.

### 7.2 Out of Scope

1. Browser-side editing of Office documents.
2. Client-side drag-and-drop sync folders.
3. Full-text search across file contents.
4. Public share links.
5. Fine-grained per-folder permissions.

## 8. Functional Requirements

### 8.1 Authentication

#### Description

The system supports a single administrator account protected by a password-equivalent secret.

#### Requirements

1. The login page contains one password input and one submit action.
2. The server validates the submitted secret against a configured password hash.
3. Successful login creates a secure session cookie.
4. Failed login shows a clear error message.
5. The UI supports logout.
6. The server applies rate limiting to login attempts.

#### Acceptance Criteria

1. Given a valid secret, the operator can access the application.
2. Given an invalid secret, the operator remains unauthenticated.
3. After logout, protected APIs are no longer accessible.

### 8.2 Root Directory Management

#### Description

The server exposes a whitelist of manageable root directories through configuration. The browser can only operate inside those roots.

#### Requirements

1. Each root has `id`, `label`, `path`, and `readOnly`.
2. The UI shows all configured roots.
3. The UI must not allow browsing outside a configured root.
4. The server treats the whitelist as the security boundary.

#### Acceptance Criteria

1. The browser can switch between configured roots.
2. Paths outside any configured root are rejected by the API.

### 8.3 File Browsing

#### Description

The browser provides tree navigation and file list browsing.

#### Requirements

1. The left panel shows the directory tree.
2. The center panel shows the current directory contents.
3. The UI supports breadcrumb navigation.
4. The UI supports sorting by name, type, size, and modification time.
5. The UI supports filtering by keyword in the current directory view.
6. Empty folders display a clear empty state.

#### Acceptance Criteria

1. The file list reflects the real file system under the selected root.
2. Directory changes update the breadcrumb and file list consistently.

### 8.4 File and Folder CRUD

#### Requirements

1. Create folder inside writable roots.
2. Upload file into writable folders.
3. Rename file or folder.
4. Move file or folder within the same root.
5. Delete file or folder with confirmation.
6. Respect root `readOnly` restrictions.

#### Acceptance Criteria

1. All successful operations are reflected immediately in the UI.
2. Write operations in read-only roots are blocked.
3. Delete operations require explicit confirmation.

### 8.5 File Preview

#### Description

The right panel provides file metadata and preview capabilities.

#### Supported Preview Types

1. Text files.
2. Images.
3. PDF files.
4. Video where browser playback is practical.

#### Acceptance Criteria

1. Selecting a previewable file shows an appropriate preview mode.
2. Unsupported files show metadata and available actions only.

### 8.6 Text File Editing

#### Description

Only supported text files can be edited online.

#### Supported Types

`txt`, `md`, `json`, `yaml`, `yml`, `xml`, `html`, `css`, `js`, `ts`, `sh`, `py`, `go`, `java`, `sql`, `log`, `ini`, `conf`

#### Requirements

1. Opening a text file loads its content into an editor.
2. The editor supports explicit save.
3. The editor warns about unsaved changes.
4. Save operations perform conflict detection using file metadata such as `etag`.
5. Large files above the online-edit threshold are preview-only or blocked for editing.

#### Acceptance Criteria

1. A text file can be edited and saved successfully.
2. If the file changed on disk after load, the save fails with a conflict response.

### 8.7 Export

#### Description

The system supports exporting a single file or a folder.

#### Requirements

1. Exporting a file triggers direct streaming download.
2. Exporting a folder creates an export task.
3. Folder export packages the folder as `zip`.
4. The export task becomes downloadable when the archive is ready.
5. Temporary archive files are deleted after successful download.
6. Temporary archive files are also removed by TTL cleanup if not downloaded.

#### Acceptance Criteria

1. A single file downloads without a task-creation delay.
2. A folder export appears in the task center.
3. Downloading a ready export succeeds.
4. Temporary archive cleanup occurs after completion or expiry.

### 8.8 Backup to Quark Cloud Drive

#### Description

The operator can back up a file or folder to Quark Cloud Drive through a provider adapter.

#### Requirements

1. The operator can trigger backup from the file list or detail panel.
2. Backup requires selecting a target path and conflict strategy.
3. The system creates a backup task and executes it asynchronously.
4. Failed tasks support retry.
5. The provider layer must be replaceable without changing the file module contract.

#### Acceptance Criteria

1. A backup request creates a visible task.
2. Task status changes are visible in the task center.
3. Failed tasks can be retried.

### 8.9 Task Center

#### Description

One unified page tracks export and backup tasks.

#### Requirements

1. Filter tasks by type and status.
2. Show task source path, state, timestamps, and actions.
3. Show task details for failures.
4. Support download for ready export tasks.
5. Support retry for failed backup tasks.

#### Acceptance Criteria

1. The task center updates as long-running tasks change state.
2. The operator can find failed jobs and act on them.

### 8.10 Settings

#### Description

The settings page exposes key system information without allowing unsafe runtime reconfiguration of server roots.

#### Requirements

1. Show configured roots and read-only flags.
2. Show export temp directory and cleanup TTL.
3. Show active backup provider and connection status.
4. Show application version and environment summary.

#### Acceptance Criteria

1. The operator can verify system configuration from the UI.

## 9. User Flows

### 9.1 Login Flow

1. Open app.
2. Enter password.
3. Submit login form.
4. On success, navigate to overview.
5. On failure, show inline error.

### 9.2 Browse and Manage Files

1. Open file management page.
2. Select root directory.
3. Expand tree and navigate folders.
4. Select item from list.
5. Use toolbar or context menu to perform actions.

### 9.3 Edit Text File

1. Select a supported text file.
2. Open editor mode.
3. Modify content.
4. Save changes.
5. Receive success or conflict feedback.

### 9.4 Export Folder

1. Select folder.
2. Click export.
3. Confirm export creation.
4. Watch task move to processing.
5. Download when ready.
6. System removes temp archive after download or expiry.

### 9.5 Backup to Quark

1. Select file or folder.
2. Open backup action.
3. Choose target path and conflict strategy.
4. Submit task.
5. Monitor status in task center.
6. Retry on failure if needed.

## 10. Page-Level Requirements

### 10.1 Login Page

| Area | Requirement |
| --- | --- |
| Header | Product name and short description |
| Form | Single password field with submit button |
| Feedback | Inline validation and login error area |
| State | Loading state during submit |

### 10.2 Overview Page

| Area | Requirement |
| --- | --- |
| KPI Row | Root count, running jobs, failed jobs, ready exports |
| Panels | Recent export jobs, recent backup jobs |
| Status | Provider connection summary |

### 10.3 File Management Page

| Area | Requirement |
| --- | --- |
| Left Rail | Root switcher and folder tree |
| Top Bar | Breadcrumb, search, sort, primary actions |
| Main Table | File rows with type, size, modified time, status |
| Right Panel | Preview, editor, metadata, quick actions |

### 10.4 Task Center

| Area | Requirement |
| --- | --- |
| Filters | Type, status, keyword |
| List | Task cards or rows with source path and state |
| Detail | Error message, timestamps, actions |

### 10.5 Settings Page

| Area | Requirement |
| --- | --- |
| Roots | Display-only root configuration |
| Export | Temp directory, TTL, limits |
| Backup | Provider status and configuration summary |
| System | Version, environment, health summary |

## 11. Edge Cases

1. Attempt to operate in a read-only root.
2. Attempt to rename to an existing conflicting file name.
3. Export a folder that is deleted during packaging.
4. Download a ready export after it has already been cleaned.
5. Save a file that changed on disk while being edited.
6. Attempt to preview a huge or unsupported file.
7. Quark backup provider unavailable or rate limited.

## 12. Non-Functional Requirements

### 12.1 Security

1. All file operations are root-bound.
2. No absolute paths are accepted from the browser.
3. Path traversal is blocked.
4. Session cookies are `httpOnly`.
5. Login requests are rate-limited.

### 12.2 Reliability

1. Export and backup tasks persist across app restarts.
2. Task state transitions are recoverable.
3. Temp export cleanup has a background safety pass.

### 12.3 Performance

1. Initial file list load should feel responsive for normal directory sizes.
2. Large directories may require pagination or incremental rendering.
3. The UI should avoid blocking on export and backup work.

### 12.4 Usability

1. The product is desktop-first.
2. Mobile and tablet should remain usable for browsing and basic actions.
3. States and errors must be explicit and readable.

## 13. Dependencies

1. Server file system access to configured roots.
2. SQLite writable path.
3. Temp directory writable path for exports.
4. A usable Quark backup integration path through a provider implementation.

## 14. Risks

1. Quark Cloud Drive integration surface may not have a stable public API.
2. If Quark does not expose an official cloud-drive API, the first real integration may need to use a controlled browser-automation provider instead of an OpenAPI path.
2. Very large folders may need stricter export limits.
3. External file-system modifications can cause edit conflicts.
4. Symbolic links must be handled carefully to avoid path escape.

## 15. Milestones

### Milestone 1

1. Project skeleton.
2. Login flow.
3. Main layout.
4. Root browsing.

### Milestone 2

1. File CRUD.
2. Preview.
3. Text editing.

### Milestone 3

1. Export task pipeline.
2. Task center.
3. Temp file cleanup.

### Milestone 4

1. Backup task pipeline.
2. Mock provider.
3. Quark adapter integration path.

## 16. Release Criteria

V1 is ready when all of the following are true:

1. The operator can log in and out successfully.
2. The UI reflects the configured root directories.
3. File and folder CRUD work in writable roots.
4. Text file editing and save conflict handling work.
5. Files can be downloaded directly.
6. Folder exports can be created, downloaded, and cleaned up.
7. Backup tasks can be created and monitored.
8. Logs are written to server files.
9. The app can be deployed with documented development and production setups.
