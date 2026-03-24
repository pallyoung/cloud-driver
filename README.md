# Cloud Driver

Cloud Driver is a single-user server file management console. The repository is organized as a small monorepo with a React web app, a Fastify API, shared contracts, and a Quark backup adapter seam.

## Workspace

- `apps/web`: React + Vite + Tailwind shell
- `apps/api`: Fastify API shell
- `packages/shared`: shared types and constants
- `packages/quark-adapter`: backup provider interfaces
- `docs/`: PRD, UX, and technical design

## Local Setup

1. Copy `.env.example` to `.env` and adjust values.
2. Copy `config/roots.example.yaml` to `config/roots.yaml` if needed.
3. Generate a password hash with `node scripts/hash-password.ts <your-password>` and place it in `.env` as `PASSWORD_HASH`.
4. Install dependencies with `pnpm install`.
5. Start the workspace with `pnpm dev`.

## Current Status

The current baseline includes:

- single-password login endpoint and signed cookie session
- protected roots and file-list APIs
- `@relax-state/react` front-end state shell
- live root loading and current-directory file listing

Next phases cover file CRUD, text editing, export jobs, and backup jobs.

## CLI Install

Cloud Driver can be installed as a single packaged CLI:

```bash
npm i -g @shier-art/cd-cli
```

Requirements:

- Node.js `>= 22`

After installation you get one command:

```bash
cd-cli
```

## CLI Quick Start

```bash
cd-cli init
cd-cli password set
cd-cli workspace add /srv/files --id files --label "Files"
cd-cli start
cd-cli open
```

Notes:

- `cd-cli start` launches the server in a detached child process, so it does not occupy the current shell.
- The packaged npm module already includes the web UI and API runtime. No separate web or server install is required.

## CLI Help

Current `cd-cli --help` output:

```text
Cloud Driver CLI

Usage:
  cd-cli init [--home <path>] [--password <password>] [--host <host>] [--port <port>]
  cd-cli start [--home <path>]
  cd-cli run [--home <path>]
  cd-cli stop [--home <path>]
  cd-cli restart [--home <path>]
  cd-cli status [--home <path>]
  cd-cli open [--home <path>] [--print-only]
  cd-cli logs [--home <path>]
  cd-cli doctor [--home <path>]
  cd-cli password set [--home <path>] [--password <password>]
  cd-cli workspace list [--home <path>]
  cd-cli workspace add <path> [--home <path>] [--id <id>] [--label <label>] [--read-only]
  cd-cli workspace remove <id> [--home <path>]
  cd-cli workspace update <id> [--home <path>] [--label <label>] [--read-only <true|false>]
  cd-cli config show [--home <path>]
  cd-cli config path [--home <path>]
  cd-cli config set <host|port> <value> [--home <path>]
```

## CLI Packaging

The repository includes the publishable CLI package source at `packages/cd-cli`.

Useful workspace commands:

1. `pnpm build:cli`
2. `pnpm pack:cli`
3. `pnpm smoke:cli`
4. `pnpm changeset`
5. `pnpm version-packages`

What they do:

1. Build the web app first, then build the packaged CLI runtime.
2. Produce an npm tarball under `output/npm/`.
3. Pack the tarball, install it into a temporary prefix, start the packaged service, run a browser smoke flow, capture screenshots into `output/playwright/`, and stop the service.
4. Create a release note for `@shier-art/cd-cli`.
5. Apply queued `changesets` to package versions and changelogs.

Release automation:

1. `CLI Verify` validates build and packaged smoke on pushes and pull requests.
2. `CLI Publish` uses `changesets` on `main` to create or update the release PR, then publishes `@shier-art/cd-cli` after the release PR is merged.
