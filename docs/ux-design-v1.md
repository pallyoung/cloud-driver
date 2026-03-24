# Cloud Driver V1 UX Design

## 1. Design Intent

Cloud Driver should feel like a controlled operations console rather than a generic SaaS dashboard. The interface needs to support high-confidence file operations, surface task state clearly, and make long-running export and backup actions easy to understand.

## 2. Experience Principles

1. Real file system first.
2. High signal, low ambiguity.
3. Dangerous actions are explicit.
4. Preview and editing are separate modes.
5. Long-running work must always have visible status.

## 3. Layout System

## 3.1 Primary Application Shell

Desktop layout uses a persistent shell:

1. Left navigation rail for primary pages.
2. Secondary left panel for roots and directory tree on the file page.
3. Main content area for tables, task lists, and settings.
4. Right detail panel for preview and editing on the file page.

## 3.2 Breakpoints

| Breakpoint | Target |
| --- | --- |
| `>= 1280px` | Full three-panel file workspace |
| `1024px - 1279px` | Collapsible detail panel |
| `768px - 1023px` | Tree panel collapses behind toggle |
| `< 768px` | Single-column flow, detail and actions use drawers |

## 4. Visual Direction

## 4.1 Style Theme

Working title: Warm Ops Console

The theme balances operational seriousness with a more distinctive visual identity than default enterprise UI.

## 4.2 Color Tokens

| Token | Value | Use |
| --- | --- | --- |
| `bg.canvas` | `#F4F0E8` | App background |
| `bg.surface` | `#FFFDF8` | Cards and panes |
| `text.primary` | `#14212B` | Main text |
| `text.secondary` | `#53606A` | Secondary text |
| `accent.primary` | `#0F766E` | Primary actions |
| `accent.secondary` | `#C96B32` | Emphasis and selection |
| `state.success` | `#2E7D32` | Success states |
| `state.warning` | `#B7791F` | Warning states |
| `state.danger` | `#B42318` | Error and destructive states |
| `border.default` | `#D9D1C3` | Dividers and field borders |

## 4.3 Typography

| Role | Font |
| --- | --- |
| Heading | `Space Grotesk` |
| Body | `IBM Plex Sans` |
| Paths and IDs | `IBM Plex Mono` |

## 4.4 Shape and Depth

1. Card radius: medium, not soft-rounded consumer style.
2. Shadows: restrained, more like stacked paper than floating glass.
3. Focus ring: strong visible teal outline for keyboard accessibility.

## 5. Navigation

## 5.1 Primary Navigation

1. Overview
2. File Manager
3. Task Center
4. Settings

## 5.2 Navigation Rules

1. The left nav stays stable across all authenticated pages.
2. Only one primary CTA exists per context.
3. Page titles and breadcrumbs should make the current location obvious.

## 6. Page Specs

## 6.1 Login Page

### Purpose

Authenticate the single operator with minimal friction.

### Structure

1. Centered auth card.
2. Product name and one-sentence explanation.
3. Password field.
4. Submit button.
5. Inline error area.

### UX Notes

1. Password field should autofocus.
2. Pressing Enter submits the form.
3. Errors remain local to the form and do not redirect.

## 6.2 Overview Page

### Purpose

Provide a quick operational status summary after login.

### Sections

1. KPI strip.
2. Recent export jobs.
3. Recent backup jobs.
4. Provider and system status card.

### KPI Strip

| Metric | Meaning |
| --- | --- |
| Managed Roots | Number of configured root directories |
| Running Jobs | Export and backup jobs in progress |
| Failed Jobs | Jobs requiring attention |
| Ready Downloads | Completed folder exports waiting for download |

### UX Notes

1. Overview is not the core work surface; it should be scannable within a few seconds.
2. Each panel links to the relevant deeper page.

## 6.3 File Manager Page

### Purpose

This is the primary workspace for daily use.

### Desktop Layout

| Region | Content |
| --- | --- |
| Left Tree Panel | Roots and folder tree |
| Center Workspace | Breadcrumb, toolbar, file list |
| Right Detail Panel | Metadata, preview, editor, quick actions |

### Left Tree Panel

1. Root switcher at top.
2. Directory tree underneath.
3. Root badges show read-only vs writable.
4. Expanded state persists during the session.

### Center Workspace

#### Header Area

1. Breadcrumb path.
2. Search field scoped to current directory view.
3. Sort selector.
4. Refresh action.

#### Toolbar

1. Upload
2. New Folder
3. Export
4. Backup to Quark
5. Delete

Toolbar behavior:

1. Primary action changes based on selection state.
2. Disabled actions remain visible with explanation on hover or helper text.

#### File List

Columns:

1. Name
2. Type
3. Size
4. Modified Time
5. Status

Row behavior:

1. Single click selects.
2. Double click opens folder or file.
3. Right click opens context menu.
4. Multi-select shows a sticky selection action bar.

### Right Detail Panel

Tabs or mode switch:

1. Details
2. Preview
3. Edit

Details mode shows:

1. File or folder name
2. Full relative path
3. Type
4. Size
5. Last modified time
6. Root read-only status
7. Export and backup quick actions

Preview mode shows:

1. Text preview for text files
2. Image preview
3. PDF inline preview where possible
4. Fallback summary for unsupported files

Edit mode shows:

1. Monaco-based text editor
2. Dirty-state indicator
3. Save button
4. Discard button
5. Shortcut hint for `Ctrl/Cmd + S`

### Empty and Edge States

1. Empty folder: show clear empty state and available creation actions.
2. Unsupported preview: show metadata and download action.
3. Read-only root: write actions disabled, banner explains restriction.
4. Unsaved changes: leaving or switching file triggers confirmation.

## 6.4 Task Center

### Purpose

Provide a single operational surface for export and backup jobs.

### Sections

1. Filter bar.
2. Task list.
3. Task detail panel or expandable row.

### Filters

1. All
2. Export
3. Backup
4. Processing
5. Failed
6. Ready

### Task Row Content

1. Task type badge.
2. Source path.
3. Destination summary.
4. Status badge.
5. Creation time.
6. Last update time.
7. Inline action buttons.

### Task Actions

Export task:

1. Download when ready.
2. View failure details when failed.

Backup task:

1. Retry when failed.
2. View failure details.

### UX Notes

1. Status labels must not depend on color only.
2. Error detail should be easy to copy for troubleshooting.

## 6.5 Settings Page

### Purpose

Expose configuration and health information in a safe read-only or low-risk format.

### Sections

1. Managed Roots
2. Export Configuration
3. Backup Provider Status
4. System Information

### UX Notes

1. Root paths are display-only in V1.
2. Risky settings should not be editable from the browser in the first release.

## 7. Interaction Flows

## 7.1 Browse Flow

1. User lands on File Manager.
2. User selects a root.
3. User expands folders in the tree.
4. Center table updates to current directory.
5. Right panel shows details for the selected item.

## 7.2 Edit Text File Flow

1. User selects a text file.
2. User enters Edit mode.
3. User modifies content.
4. Dirty badge appears.
5. User clicks Save or presses shortcut.
6. UI shows saving state.
7. On success, dirty state clears.
8. On conflict, UI offers reload or force overwrite.

## 7.3 Export Flow

### File Export

1. User selects file.
2. User clicks Download or Export.
3. Browser begins streaming download immediately.

### Folder Export

1. User selects folder.
2. User clicks Export.
3. Confirmation drawer explains `zip` packaging.
4. Job is created.
5. Task Center and row status update.
6. User downloads archive when ready.
7. System clears temp archive after download or TTL.

## 7.4 Backup Flow

1. User selects file or folder.
2. User opens Backup action drawer.
3. User chooses target path and conflict policy.
4. User submits.
5. Job enters queue and then processing.
6. Task Center reflects state changes.
7. Retry becomes available on failure.

## 8. Dialogs and Drawers

## 8.1 Delete Confirmation

Content:

1. Selected item name.
2. Type of item.
3. Warning that deletion may be irreversible in V1.

## 8.2 Rename Dialog

Content:

1. Current name.
2. New name field.
3. Validation message area.

## 8.3 Move Dialog

Content:

1. Source path.
2. Destination folder selector.
3. Conflict warning if target exists.

## 8.4 Export Drawer

Content:

1. Selected source path.
2. Export behavior summary.
3. Folder packaging notice for directories.
4. Confirm action.

## 8.5 Backup Drawer

Content:

1. Source path.
2. Target path input or picker.
3. Conflict policy selector.
4. Submit action.

## 9. Motion and Feedback

1. File row selection should animate subtly with opacity or background change only.
2. Side panels should slide and fade, not bounce.
3. Task status updates should crossfade rather than hard-swap.
4. Long operations should show skeletons or inline progress, not blocking spinners only.

## 10. Accessibility

1. All actions must be keyboard reachable.
2. Context menu actions need keyboard alternatives.
3. Focus order must match visual order.
4. Icon-only buttons require labels.
5. Status labels must include text, not color alone.
6. Reduced-motion mode should simplify panel transitions.

## 11. Content and Copy Guidelines

1. Use precise operational language.
2. Use `Export` for browser-facing download packaging.
3. Use `Backup to Quark` for remote backup tasks.
4. Use `Read-only root` rather than vague terms like `restricted`.
5. Use `Conflict detected` for save conflicts and existing-name conflicts.

## 12. Responsive Adaptation

### Tablet

1. Tree panel becomes collapsible.
2. Detail panel overlays as a drawer.
3. Toolbar actions compress into a kebab menu as needed.

### Mobile

1. The file page becomes a stacked flow.
2. Tree navigation opens in a dedicated sheet.
3. Preview and editor open full-screen.
4. Multi-select is reduced to simpler action patterns.

## 13. UX Risks

1. Large directory performance may degrade the file page without virtualization.
2. Edit-save conflicts can confuse users if the messaging is weak.
3. Export lifecycle needs strong status wording to avoid "nothing happened" confusion.
4. Backup destination selection may depend on the Quark integration shape.

## 14. Deliverables Mapping

This UX document should directly drive:

1. Wireframes for the four authenticated pages.
2. Component inventory for tree, table, detail panel, dialogs, and task rows.
3. Front-end state boundaries for selection, editing, and task tracking.
