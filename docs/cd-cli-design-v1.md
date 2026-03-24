# Cloud Driver CLI Design V1

## 1. Scope

This document defines the V1 design for the publishable npm CLI package `@shier-art/cd-cli`.

Goal:

- install one npm package
- get one command: `cd-cli`
- start the Cloud Driver service without separately installing the API or Web app
- manage the single-user runtime locally through CLI commands

V1 stays intentionally narrow:

- single-user password login
- local or server-side self-hosting
- workspace mount management
- service lifecycle management
- export capability continues to work through the Web UI
- Quark sync CLI management is deferred

## 2. Product Outcome

After installing the package, the target user flow is:

```bash
npm i -g @shier-art/cd-cli

cd-cli init
cd-cli password set
cd-cli workspace add /srv/files --id files --label "Files"
cd-cli start
cd-cli open
```

The package must already contain:

- the API runtime bundle
- the built Web static assets
- CLI entry scripts
- default config templates

The user should not need to:

- clone the repository
- install `apps/api`
- install `apps/web`
- run two separate services

## 3. Non-Goals

V1 does not include:

- Quark backup feature completion
- multi-user auth and permissions
- system service installers for `systemd`, `launchd`, or Windows Service
- bundled Node runtime
- distributed deployment or horizontal scaling

## 4. Command Surface

### 4.1 Core Commands

```bash
cd-cli init
cd-cli start
cd-cli run
cd-cli stop
cd-cli restart
cd-cli status
cd-cli open
cd-cli logs
cd-cli doctor
```

### 4.2 Password Commands

```bash
cd-cli password set
```

### 4.3 Workspace Commands

```bash
cd-cli workspace list
cd-cli workspace add <path> --id <id> --label <label>
cd-cli workspace remove <id>
cd-cli workspace update <id> [--label <label>] [--read-only <true|false>]
```

### 4.4 Config Commands

```bash
cd-cli config show
cd-cli config path
cd-cli config set host 127.0.0.1
cd-cli config set port 3001
```

## 5. Command Semantics

### `cd-cli init`

- creates runtime directories
- writes default config files if missing
- generates `sessionSecret`
- optionally prompts for first password
- does not start the service

### `cd-cli start`

- starts the server in a detached child process
- does not occupy the current shell
- writes PID and runtime metadata
- writes stdout and stderr to log files
- waits briefly for health check before reporting success

### `cd-cli run`

- starts the server in the foreground
- keeps stdout and stderr attached to the current terminal
- targets development, debugging, containers, and process managers

### `cd-cli stop`

- reads the PID file
- sends graceful termination first
- escalates to force kill after timeout if needed
- removes stale PID files

### `cd-cli status`

- checks PID existence
- checks HTTP health endpoint
- prints bind host, port, runtime home, version, and log paths

### `cd-cli open`

- prints the service URL
- opens the browser by default
- supports `--print-only` when the caller only needs the URL

### `cd-cli workspace remove <id>`

- removes the mount definition only
- never deletes the real filesystem directory

## 6. Runtime Layout

The CLI manages an application home directory.

Priority:

1. `CLOUD_DRIVER_HOME` if provided
2. platform-standard application data directory

Recommended layout:

```text
$CLOUD_DRIVER_HOME/
  config/
    app.json
    roots.yaml
  data/
    cloud-driver.db
  logs/
    server.log
    server.error.log
  run/
    server.pid
    server.json
  tmp/
    exports/
```

### Runtime File Responsibilities

- `config/app.json`: service config, auth config, storage config
- `config/roots.yaml`: mounted workspace definitions
- `data/cloud-driver.db`: SQLite job metadata
- `logs/server.log`: application log stream
- `logs/server.error.log`: stderr or fatal startup log stream
- `run/server.pid`: active detached process id
- `run/server.json`: runtime metadata such as version, port, and log paths

## 7. Configuration Model

### 7.1 Main Config

`config/app.json`

```json
{
  "configVersion": 1,
  "server": {
    "host": "127.0.0.1",
    "port": 3001
  },
  "auth": {
    "mode": "single-user-password",
    "passwordHash": "scrypt$...",
    "sessionSecret": "random-secret"
  },
  "storage": {
    "sqlitePath": "./data/cloud-driver.db",
    "logDir": "./logs",
    "tempExportDir": "./tmp/exports",
    "exportTtlMinutes": 30
  },
  "features": {
    "backupProvider": "disabled"
  }
}
```

### 7.2 Workspace Config

`config/roots.yaml`

```yaml
roots:
  - id: docs
    label: Docs
    path: /srv/docs
    readOnly: false
```

### 7.3 Config Rules

- relative storage paths are resolved from `CLOUD_DRIVER_HOME`
- workspace paths should remain absolute in persisted config
- password is stored as hash only
- config writes are atomic
- config includes `configVersion` for future migrations

## 8. Process Model

V1 uses a CLI-managed child process instead of a system service.

### 8.1 Why This Model

- cross-platform with low setup cost
- matches the npm global install distribution model
- supports `start`, `stop`, `restart`, and `status` naturally
- avoids forcing users to install extra process managers

### 8.2 `start` Behavior

`cd-cli start` must run the server as a detached child process:

```ts
spawn(process.execPath, [serverEntry], {
  detached: true,
  stdio: ['ignore', outFd, errFd],
  cwd: runtimeHome,
  env,
}).unref();
```

Expected behavior:

- parent process returns immediately
- service continues after shell command exits
- logs are written to files instead of terminal
- PID is persisted for later management

### 8.3 Startup Validation

`cd-cli start` should not report success immediately after spawn.

It should:

1. spawn detached child
2. poll `/api/health`
3. confirm the process is alive
4. return success only after health check passes
5. report the log file path if startup fails

## 9. Monorepo Packaging Strategy

## 9.1 New Package

Add a public package:

```text
packages/cd-cli
```

Package name:

```text
@shier-art/cd-cli
```

### 9.2 Published Tarball Content

The npm tarball should contain only runtime artifacts, not source-only workspace dependencies.

Expected output:

```text
dist/
  bin/
    cd-cli.js
  runtime/
    api/
      index.js
    web/
      index.html
      assets/*
  templates/
    app.json
    roots.yaml
```

### 9.3 Why Bundling Is Required

The current API imports workspace-local packages such as `@cloud-driver/shared` and `@cloud-driver/quark-adapter`.

If the CLI package only copied compiled API files, a global install would fail because those workspace package references would not exist on the target machine.

So V1 should:

- bundle the API runtime into the CLI package
- bundle the CLI itself
- copy the Web build output as static assets

Recommended tools:

- `tsup` or `esbuild` for API and CLI bundling
- `vite build` for Web assets

## 10. API and Web Changes Required

### 10.1 API Changes

The API must be usable both as:

- a direct standalone entrypoint
- an embedded runtime used by the CLI package

Required changes:

1. export `buildServer()` and `startServer()`
2. stop auto-starting when imported as a module
3. allow configurable `host`
4. allow optional `WEB_DIST_PATH`
5. serve built Web assets from Fastify
6. add SPA fallback to `index.html`

### 10.2 Web Changes

Web remains a static SPA build.

Required runtime behavior:

- `vite build` produces deployable static assets
- API serves these files in production
- SPA routes such as `/explorer` and `/settings` fallback to `index.html`

Development remains unchanged:

- Vite dev server proxies `/api` to the API service

## 11. Build Pipeline

Recommended build sequence:

1. build `apps/web`
2. bundle API runtime
3. bundle CLI runtime
4. copy Web `dist` into CLI package runtime
5. copy config templates
6. `npm pack` the CLI package

Suggested root scripts:

```json
{
  "scripts": {
    "build:web": "pnpm --filter @cloud-driver/web build",
    "build:cli": "pnpm --filter @shier-art/cd-cli build",
    "pack:cli": "pnpm --filter @shier-art/cd-cli pack"
  }
}
```

## 12. Publish Strategy

### 12.1 Package Metadata

`packages/cd-cli/package.json`

- `name: "@shier-art/cd-cli"`
- `bin: { "cd-cli": "./dist/bin/cd-cli.js" }`
- `files: ["dist"]`
- `type: "module"`
- `publishConfig.access = "public"`
- `engines.node = ">=22"`

### 12.2 Release Flow

1. run local build and typecheck
2. run CLI smoke tests from packed tarball
3. publish to npm
4. create GitHub release notes

Recommended additions:

- GitHub Actions for release
- `changesets` for versioning and changelog management

## 13. Verification Strategy

### 13.1 Unit and Command Tests

- config parsing and migration
- password hashing and persistence
- workspace add, update, remove
- PID file handling

### 13.2 Process Management Tests

- detached start
- status after start
- stop and restart
- stale PID cleanup
- startup failure reporting

### 13.3 Installed Package Smoke Test

Use the actual packed tarball:

1. `npm pack`
2. install globally into a clean temp environment
3. run `cd-cli init`
4. add a workspace
5. run `cd-cli start`
6. open the served Web UI
7. log in
8. browse files
9. open and edit a text file
10. export a file and a folder
11. stop the service

Playwright should cover the browser portion of this smoke path.

## 14. Security Defaults

- default bind host is `127.0.0.1`
- password hash only, no plaintext persistence
- workspace removal never deletes filesystem data
- production public exposure should go behind Nginx or Caddy with HTTPS
- CLI must validate workspace paths before writing config

## 15. Phase Plan

### Phase 1: Single-Service Runtime Foundation

- export API server builder and starter
- support configurable host
- support Web static asset hosting
- support SPA fallback

### Phase 2: CLI Core

- add `packages/cd-cli`
- implement `init`, `start`, `run`, `stop`, `status`
- implement `password set`
- implement `workspace list/add/remove/update`

### Phase 3: Packaging and Smoke Validation

- bundle API runtime
- embed Web build assets
- pack and install tarball
- add automated smoke test

### Phase 4: Release Automation

- npm publish workflow
- GitHub release workflow
- versioning and changelog tooling

## 16. Acceptance Criteria For V1

V1 is complete when:

- `npm i -g @shier-art/cd-cli` gives a usable `cd-cli`
- `cd-cli start` launches a detached child process and frees the shell
- the packaged service serves both API and Web from one process
- password setup works without touching raw env files
- workspace add and remove work without editing YAML manually
- a fresh machine can install, start, log in, browse files, edit text files, and export files from the packaged distribution
