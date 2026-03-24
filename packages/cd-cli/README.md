# `@shier-art/cd-cli`

Single-package runtime and CLI for Cloud Driver.

After a global install you get:

- one command: `cd-cli`
- a detached service process via `cd-cli start`
- the packaged web UI and API runtime in the same npm package

## Install

```bash
npm i -g @shier-art/cd-cli
```

## Quick Start

```bash
cd-cli init
cd-cli password set
cd-cli workspace add /srv/files --id files --label "Files"
cd-cli start
cd-cli open
```

`cd-cli start` launches the server in a detached child process, so it does not occupy the current shell.

## Common Commands

```bash
cd-cli start
cd-cli stop
cd-cli restart
cd-cli status
cd-cli logs
cd-cli doctor

cd-cli password set

cd-cli workspace list
cd-cli workspace add /srv/files --id files --label "Files"
cd-cli workspace update files --label "Shared Files" --read-only false
cd-cli workspace remove files

cd-cli config show
cd-cli config path
cd-cli config set host 127.0.0.1
cd-cli config set port 3001
```

## Runtime Layout

By default the runtime home is resolved from:

1. `CLOUD_DRIVER_HOME`
2. platform app-data conventions

The managed runtime layout is:

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

## Notes

- V1 is single-user only and uses password login.
- Workspaces are mount definitions only. Removing one never deletes the real directory.
- Export remains available from the web UI. Folder export is packaged server-side, then the temporary archive is cleaned up after download.

See `docs/cd-cli-design-v1.md` in the repository for the full implementation design.
