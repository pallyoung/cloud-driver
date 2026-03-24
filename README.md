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
