# AGENTS.md

## Cursor Cloud specific instructions

### Services overview

**BoomBox** is a Deno-based music player (single server, no separate frontend build
tool). The server handles SSR, API routes, and serves the client bundle.

- **Runtime**: Deno (installed at `~/.deno/bin/deno`; already on `PATH` via `~/.bashrc`)
- **Tasks**: All dev commands use `deno task <name>` — see `deno.json` for the full list.

### Building

The client bundle (`build/main.js`) must exist before the server can serve the UI.
The `build/` directory may not exist on a fresh checkout — create it first:

```sh
mkdir -p build && deno task build
```

### Running the server (development / E2E mode)

The server can run without real AWS credentials by using E2E mode, which mocks S3:

```sh
deno task start:e2e
```

This starts the server on **http://localhost:8000** with mocked S3 data and admin
credentials `e2e-admin` / `e2e-secret`.

### Lint, format, and tests

| Check | Command |
|-------|---------|
| Lint | `deno lint` |
| Format check | `deno fmt --check` |
| All unit/integration tests | `deno task test:all` |
| Coverage + baseline check | `deno task test:coverage:ci` |

`deno fmt --check` may report cosmetic differences depending on the Deno version
(e.g., CSS line-wrapping). This is a known discrepancy; do not auto-format files
unless the project README instructs you to.

### Gotchas

- **`build/` directory**: `deno task build` writes to `build/main.js` via shell
  redirection; the directory must exist or the command fails silently.
- **Husky hooks**: Pre-commit runs `deno fmt` and `deno lint` on staged files.
  Pre-push runs full coverage enforcement (`deno task test:coverage:ci`).
- **No real AWS needed for tests**: All test suites mock S3 via import maps
  (`import_map.s3_test.json`) or `E2E_MODE=1`.
- **Playwright / E2E tests** require Node.js + `npm ci` + `npx playwright install chromium`.
  These are optional for most development tasks.
