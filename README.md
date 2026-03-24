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

## CLI Packaging

The repository now includes a publishable CLI package scaffold at `packages/cd-cli`.

Useful commands:

1. `pnpm build:cli`
2. `pnpm pack:cli`
3. `pnpm smoke:cli`
4. `pnpm changeset`
5. `pnpm version-packages`

What they do:

1. Build the Web app first, then build the packaged CLI runtime.
2. Produce an npm tarball under `output/npm/`.
3. Pack the tarball, install it into a temporary prefix, start the packaged service, run a browser smoke flow, capture screenshots into `output/playwright/`, and stop the service.
4. Create a release note for `@shier-art/cd-cli`.
5. Apply queued `changesets` to package versions and changelogs.

Release automation:

1. `CLI Verify` validates build + packaged smoke on pushes and pull requests.
2. `CLI Publish` uses `changesets` on `main` to create or update the release PR, then publishes `@shier-art/cd-cli` after the release PR is merged.
