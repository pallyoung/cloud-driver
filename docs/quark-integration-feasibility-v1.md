# Quark Integration Feasibility V1

Verified on: 2026-03-23

## 1. Reality Check

Based on official Quark properties reviewed on 2026-03-23:

1. `https://pan.quark.cn/` is positioned as a consumer cloud-drive product with web, desktop, mobile, TV, and browser-plugin entry points.
2. The official product surface emphasizes end-user backup and cross-device usage, including desktop backup scenarios.
3. `https://open.quark.cn/` is currently presented as the Quark Mini Program developer platform, and the landing page is marked beta.
4. No official Quark Cloud Drive OpenAPI, OAuth documentation, or third-party server-upload documentation was found on official Quark domains for direct cloud-drive integration.

Source links:

1. `https://pan.quark.cn/`
2. `https://www.quark.cn/`
3. `https://open.quark.cn/`

## 2. Practical Conclusion

Inference from the official sources above:

1. A stable, officially documented, server-to-Quark cloud-drive API path is not currently confirmed.
2. The project should not promise a low-risk "official API" implementation unless Quark publishes a cloud-drive developer surface.
3. The current provider seam remains correct, because the integration risk is provider-specific rather than file-management-specific.

## 3. Feasible Integration Paths

### Path A: Official OpenAPI Provider

Status:

1. Not currently verified.

Pros:

1. Best long-term maintainability.
2. Clear auth and permission model.
3. Reliable remote completion semantics.

Cons:

1. No official cloud-drive API documentation was found.
2. Cannot be scheduled as a committed delivery path yet.

Decision:

1. Keep the adapter seam ready for this path.
2. Do not block the product on it.

### Path B: Browser Automation Provider

Description:

1. Use Playwright or a dedicated Chromium automation worker to drive the official `pan.quark.cn` web UI with a persistent logged-in profile.
2. The provider performs folder navigation, remote folder creation, upload initiation, and completion polling through the browser UI.

Pros:

1. Achieves a real upload into Quark without waiting for an official API.
2. Works with the existing server-side asynchronous job model.
3. Completion can be observed from the official web UI rather than inferred from a local copy step.

Cons:

1. Unsupported by official API guarantees.
2. UI changes can break selectors or flow timing.
3. Session expiration, QR re-login, or anti-abuse controls must be handled operationally.
4. Requires a dedicated automation runtime and a human login bootstrap.

Decision:

1. This is the most realistic near-term "real integration" path for a server-side product.
2. It should be treated as a controlled, opt-in provider mode rather than the default.

### Path C: Desktop Agent + Official Client Handoff

Description:

1. Run a local agent on a logged-in workstation or dedicated desktop VM.
2. The server hands files to the agent.
3. The agent places them into a directory managed by the official Quark client.

Pros:

1. Avoids driving the web UI for every upload.
2. Uses the official client for the actual sync behavior.

Cons:

1. Requires a continuously logged-in desktop environment.
2. Cloud-side completion is harder to verify unless the client exposes stable local sync state.
3. Operational complexity is higher than browser automation for this project stage.

Decision:

1. Keep as a fallback deployment option for customer-specific environments.
2. Do not make it the primary implementation path for V1.1.

## 4. Recommended Project Path

### Recommendation

1. Keep `mock` as the default provider for development and CI.
2. Introduce a new real provider mode named `quark-browser`.
3. Keep the current `quark` stub reserved for a future official API implementation.

### Why `quark-browser`

1. It is compatible with the existing async job model.
2. It preserves the current provider abstraction.
3. It provides a real upload path without pretending an official API exists.

## 5. `quark-browser` Architecture

### Runtime Topology

1. API server creates backup jobs exactly as it does now.
2. `BackupJobService` dispatches jobs to `QuarkBrowserProvider`.
3. `QuarkBrowserProvider` uses a persistent Chromium profile directory.
4. A one-time manual login is completed against `pan.quark.cn`.
5. Subsequent jobs reuse the authenticated browser profile.

### Provider Responsibilities

1. `testConnection()`
   - Launch browser context with persistent profile.
   - Open `pan.quark.cn`.
   - Verify the account is still logged in.
   - Verify that upload controls are present.
2. `uploadFile()`
   - Resolve target directory path.
   - Create missing remote folders if needed.
   - Upload file via official web input control.
   - Poll the UI until upload success or failure is visible.
3. `uploadDirectory()`
   - Phase 1: package the directory to a zip and upload the archive.
   - Phase 2: if the official web UI reliably supports folder upload, switch to native folder upload.
4. `normalizeRemotePath()`
   - Enforce provider-safe remote paths.
5. `handleConflicts()`
   - `skip`: stop before upload if item already exists.
   - `overwrite`: delete or replace through the UI before upload.
   - `rename`: generate a suffixed remote name before upload.

## 6. Authentication Model

### Initial Login

1. Operator starts a dedicated provider bootstrap command.
2. System launches Chromium with persistent profile storage.
3. Operator completes QR-code login manually.
4. Provider stores only browser profile state on disk.

### Session Health

1. Every `testConnection()` checks if the session is still valid.
2. If session expires, provider status becomes unavailable.
3. Settings page should show `Re-login required` rather than a generic failure.

### Proposed Environment Variables

```env
BACKUP_PROVIDER=quark-browser
QUARK_BROWSER_PROFILE_DIR=./data/quark-browser-profile
QUARK_BROWSER_HEADLESS=true
QUARK_BROWSER_BASE_URL=https://pan.quark.cn/
QUARK_BROWSER_LOGIN_TIMEOUT_SECONDS=180
QUARK_BROWSER_UPLOAD_TIMEOUT_SECONDS=3600
QUARK_REMOTE_BASE_DIR=/CloudDriver
```

## 7. Upload and Retry Strategy

### File Upload

1. Stage source file locally.
2. Ensure remote directory exists.
3. Upload through the file chooser.
4. Poll for upload success marker in the UI.
5. Mark job `completed` only after success marker is seen.

### Folder Upload

Phase 1:

1. Zip the folder.
2. Upload the archive.
3. Store `resolvedTargetPath` as the archive path.
4. Surface in UI that the backup artifact is an archive.

Phase 2:

1. Switch to native folder upload if browser automation proves stable.
2. Preserve folder structure directly on Quark.

### Retry Policy

1. Retry only on transient provider errors.
2. Do not retry automatically on auth expiration.
3. Do not retry automatically on conflict-policy violations.
4. Store provider message and last failed UI step for operator diagnosis.

## 8. Data Model Additions

The existing `backup_jobs` table is enough for V1, but V1.1 should consider adding:

1. `attempt_count`
2. `last_provider_message`
3. `provider_run_id`
4. `auth_state`
5. `artifact_type` with values `file`, `directory`, `archive`

## 9. Security and Operations

1. Run the browser provider on a dedicated worker account.
2. Store the persistent browser profile on encrypted disk if possible.
3. Do not expose Quark session data through the API.
4. Restrict outbound automation runtime to the provider worker only.
5. Add a manual `re-login` operational runbook.

## 10. Delivery Plan

### V1.1

1. Finalize design and operational assumptions.
2. Add `quark-browser` provider type.
3. Add bootstrap command for manual login.
4. Implement file upload path.
5. Implement archive-based folder backup path.
6. Surface provider session status in Settings and Jobs.

### V1.2

1. Add native folder upload if the web UI is stable enough.
2. Improve conflict handling and completion polling.
3. Add provider screenshots or traces for failed jobs.

### Future

1. Replace or supplement `quark-browser` with an official API provider if Quark publishes one.

## 11. Decision

For this project, the recommended path is:

1. Keep shipping `mock` today.
2. Treat `quark-browser` as the first real integration target.
3. Keep `quark` reserved for a future official API path.
4. Do not market the integration as official OpenAPI-based unless Quark publishes that surface.
