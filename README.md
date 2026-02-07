# BoomBox

A Deno-based music player application. Your audio where you want it—browse
artists and albums, play tracks, and (with admin) upload music to cloud storage
(S3).

- **Server**: Deno native HTTP (`Deno.serve()`), custom router, server-side
  rendering with plain HTML.
- **Client**: Custom elements (Web Components) with shadow DOM, bundled by Deno
  and loaded as `/build/main.js`.
- **Storage**: AWS S3 for track and album metadata; admin uploads via HTTP Basic
  Auth.

---

## Prerequisites

- **Deno** 1.40+
- **AWS credentials** (for S3 access; configure via environment or IAM)
- **Node.js** is not required for running the server or building the client
  bundle.

---

## Quick start

1. **Environment**\
   Copy [`.env.sample`](.env.sample) to `.env` and set `AWS_*`, `STORAGE_*`, and
   (for admin) `ADMIN_USER` / `ADMIN_PASS`. See
   [Environment variables](#environment-variables).

2. **Build the client bundle**
   ```bash
   deno task build
   ```
   This produces `build/main.js` (custom elements bundle). The server serves
   this and other static assets from `build/`, `app/app.css`, and `public/`.

3. **Run the server**
   ```bash
   deno task start
   ```
   Server runs at **http://localhost:8000** (or set `PORT` in `.env`).

---

## Environment variables

Create a `.env` file in the project root. Use [`.env.sample`](.env.sample) as a
template:

| Variable                | Purpose                            |
| ----------------------- | ---------------------------------- |
| `AWS_ACCESS_KEY_ID`     | AWS access key for S3              |
| `AWS_SECRET_ACCESS_KEY` | AWS secret for S3                  |
| `STORAGE_REGION`        | AWS region for the bucket          |
| `STORAGE_BUCKET`        | S3 bucket name                     |
| `ADMIN_USER`            | Username for admin HTTP Basic Auth |
| `ADMIN_PASS`            | Password for admin HTTP Basic Auth |
| `PORT`                  | Server port (default: `8000`)      |

If `ADMIN_USER` or `ADMIN_PASS` is unset or empty, admin is disabled and
protected routes return 500. See [Admin authentication](#admin-authentication).

---

## Admin authentication

Only **GET `/admin`** and **POST `/`** (upload) require auth and may return 401.
The home page does not challenge; it uses the request’s `Authorization` header
to show or hide admin UI.

- **Mechanism**: HTTP Basic Auth. Credentials come from `ADMIN_USER` and
  `ADMIN_PASS`.
- **How to log in**: Visit `/admin` → browser shows username/password dialog →
  enter the same values as in `.env`. On success you are redirected to `/`; the
  browser then sends the `Authorization` header so the app shows admin-only UI
  (e.g. upload).
- **Protected routes**:
  - **GET `/admin`** — Login entry; requires valid Basic Auth, then redirects to
    `/`.
  - **POST `/`** — File upload; requires valid Basic Auth (401 if missing).

---

## Building

- **Custom elements bundle** (required for the UI):
  ```bash
  deno task build
  ```
  Output: `build/main.js`. The server serves it at `/build/main.js`.

- **Generated API docs** (optional):
  ```bash
  deno task build:docs
  ```
  Output: `docs/` (HTML). See [Documentation](#documentation).

---

## Running the server

| Mode                    | Command           |
| ----------------------- | ----------------- |
| **Development** (watch) | `deno task start` |
| **Production**          | `deno task start` |

Or run directly:

```bash
# Development (with --watch)
deno run --allow-net --allow-env --allow-read --allow-write --allow-sys --watch server/main.ts

# Production
deno run --allow-net --allow-env --allow-read --allow-write --allow-sys server/main.ts
```

The `--allow-sys` flag is required for AWS SDK compatibility.

---

## Testing

Run the full test suite:

```bash
deno task test:all
```

This runs: `test:doc`, `test:components`, `test:util`, and `test:server` (Deno
tests under `deno-tests/`).

- **Server / integration tests**: `deno-tests/` — see
  [deno-tests/README.md](deno-tests/README.md) for structure and how to run
  individual tests.
- **Component tests**: `deno test app/components/ --no-check`
- **Util tests**: `deno test app/util --no-check --allow-env --allow-read`

---

## Project structure

```
.
├── app/                    # UI and shared logic
│   ├── components/         # Custom elements and HTML helpers
│   │   ├── Layout/PlayBar/ # Play bar, playlist, controls
│   │   ├── register-custom-elements.ts
│   │   └── ...
│   ├── icons/              # Heroicons-based icons
│   ├── util/               # Utilities (files, ID3, S3 client, etc.)
│   └── app.css             # Global styles
├── server/                 # Deno server
│   ├── main.ts             # Entry point, static files, router
│   ├── router.ts           # Custom route matcher
│   ├── ssr-plain.ts        # HTML page shell (SSR)
│   ├── handlers/           # Route handlers (index, album, upload, cover)
│   └── utils/              # basicAuth, loadEnv, manifest
├── build/                  # Build output
│   └── main.js             # Custom elements bundle (from deno task build)
├── deno-tests/             # Deno tests (router, handlers, SSR, utils)
├── public/                 # Static assets (e.g. favicon)
├── test_data/              # Test audio files (see test_data/README.md)
├── docs/                   # Generated API docs (deno task build:docs)
├── deno.json               # Config, tasks, imports
└── doc.exports.ts          # Exports used for generated docs
```

---

## Routes

| Method + path                                  | Description                                            |
| ---------------------------------------------- | ------------------------------------------------------ |
| `GET /`                                        | Home page (admin UI shown when logged in via `/admin`) |
| `GET /admin`                                   | Admin login (Basic Auth); redirects to `/` on success  |
| `POST /`                                       | File upload (requires admin Basic Auth)                |
| `GET /artists/:artistId/albums/:albumId`       | Album detail page                                      |
| `GET /artists/:artistId/albums/:albumId/cover` | Album cover image (from first track’s ID3)             |

Static assets: `/build/*`, `/assets/*` (if present), `/favicon.ico`, `/app.css`.

---

## Documentation

- **Generated API docs**: Run `deno task build:docs` and open `docs/index.html`.
  Built from [doc.exports.ts](doc.exports.ts).
- **Custom elements**: See
  [.cursor/rules/custom-elements.mdc](.cursor/rules/custom-elements.mdc) for the
  shadow DOM / template pattern and naming.
- **Project conventions**: Deno-first, testing, and UI approach are described in
  [.cursor/rules/project.mdc](.cursor/rules/project.mdc).
- **Test layout and coverage**: [deno-tests/README.md](deno-tests/README.md).
- **Test audio files**: [test_data/README.md](test_data/README.md).

---

## Architecture notes

- The server uses Deno’s native HTTP server and a small custom router (no
  framework).
- SSR is done manually: handlers call `renderPage()` in `server/ssr-plain.ts`,
  which returns full HTML including the custom elements script
  (`/build/main.js`).
- The client is built from custom elements registered in
  `app/components/register-custom-elements.ts`, bundled with
  `deno bundle --platform=browser` to `build/main.js`.
- File uploads use `Request.formData()`; S3 integration uses AWS SDK v3 via npm
  specifiers in `deno.json`.

---

## Troubleshooting

| Issue                     | What to do                                                   |
| ------------------------- | ------------------------------------------------------------ |
| Port in use               | Set `PORT` (e.g. `PORT=3000 deno task start`).               |
| Client bundle not found   | Run `deno task build` so `build/main.js` exists.             |
| 500 on `/admin` or upload | Set both `ADMIN_USER` and `ADMIN_PASS` in `.env`.            |
| Import errors             | Use `.ts` / `.tsx` extensions in imports for Deno.           |
| S3 errors                 | Check `AWS_*` and `STORAGE_*` in `.env` and IAM permissions. |

---

## License and references

- Icons: [Heroicons](https://heroicons.com).
- Custom elements pattern:
  [Gold Standard Wiki](https://github.com/webcomponents/gold-standard/wiki).
