# Deno Tests

This directory contains tests for the Deno server migration, using Deno's native
test framework.

## Test Structure

```
deno-tests/
├── app/
│   └── util/
│       ├── data-url.deno.test.ts        # Tests for data URL encode/decode (shared client/server)
│       └── files.deno.test.ts           # Tests for file utility functions
├── server/
│   ├── handlers/
│   │   ├── album.cover.deno.test.ts    # Tests for album cover route handler
│   │   ├── album.html.deno.test.ts     # Tests for album page handler (HTML + fragment)
│   │   ├── index.html.deno.test.ts     # Tests for index/admin handler (auth + fragment)
│   │   └── upload.deno.test.ts          # Tests for upload route handler
│   ├── router.deno.test.ts              # Tests for custom router
│   ├── ssr.deno.test.ts                 # Tests for SSR rendering
│   └── utils/
│       ├── loadEnv.deno.test.ts         # Tests for environment variable loader
│       └── manifest.deno.test.ts        # Tests for asset manifest utility
└── README.md                             # This file
```

## Running Tests

### Run All Tests

```bash
deno test deno-tests/ --allow-net --allow-env --allow-read --allow-write --allow-sys
```

### Run Specific Test File

```bash
deno test deno-tests/server/router.deno.test.ts
```

### Run Tests Without Type Checking (Faster)

```bash
deno test deno-tests/ --no-check --allow-net --allow-env --allow-read --allow-write --allow-sys
```

## Test Coverage

### ✅ Completed Tests

1. **Router Tests** (`server/router.deno.test.ts`)

   - Static route matching
   - Dynamic route matching with parameters
   - 404 handling for unmatched routes
   - Cover route matched before album route (more specific path first)
   - HTTP method filtering

2. **Data URL Utility Tests** (`app/util/data-url.deno.test.ts`)

   - `createDataUrlFromBytes()` - Encode bytes to data URL (round-trip with
     decode)
   - `createDataUrlFromBytes()` with ArrayBuffer input
   - `decodeDataUrl()` - Decode data URL to body and contentType (covered via
     round-trip and album.cover tests)

3. **Files Utility Tests** (`app/util/files.deno.test.ts`)

   - `getArtist()` - Get artist data
   - `sortTracksByTrackNumber()` - Track sorting
   - `getParentDataFromTrackUrl()` - URL parsing
   - `getAlbum()` - Album lookup
   - `getRemainingAlbumTracks()` - Remaining tracks calculation
   - `getAlbumIdsByRecent()` - Recent albums sorting
   - `search()` - Search functionality (artists, albums, tracks)

4. **Manifest Utility Tests** (`server/utils/manifest.deno.test.ts`)

   - Asset filename resolution
   - Client assets retrieval
   - Fallback behavior

5. **LoadEnv Utility Tests** (`server/utils/loadEnv.deno.test.ts`)

   - Missing .env file handling
   - Environment variable parsing
   - Existing variable preservation

6. **SSR Tests** (`server/ssr.deno.test.ts`)

   - `isFragmentRequest()` (X-Requested-With: fetch)
   - HTML structure validation
   - Asset inclusion (CSS/JS)
   - Head links support
   - Script tag escaping

7. **Handler Tests**
   - **Index / Admin Handler** (`server/handlers/index.html.deno.test.ts`)
     - Admin auth flow: 500 when credentials missing, 401 when unauthenticated,
       302 redirect to `/` when authenticated
     - Fragment response: when `X-Requested-With: fetch`, returns JSON envelope
       `{ title, html, meta }` instead of full HTML
   - **Album HTML Handler** (`server/handlers/album.html.deno.test.ts`)
     - 400 when artistId or albumId is missing
     - Full HTML when no fragment header (DOCTYPE, layout, tracklist)
     - Fragment response: when `X-Requested-With: fetch`, returns JSON envelope
       with `title`, `html`, `meta` (OG tags), and `styles` (critical CSS)
   - **Album Cover Handler** (`server/handlers/album.cover.deno.test.ts`)
     - 400 when artistId or albumId is missing
     - `decodeDataUrl()` behavior (valid and invalid data URLs)
     - `getKeyFromTrackUrl()` S3 key extraction from track URL
   - **Upload Handler** (`server/handlers/upload.deno.test.ts`)
     - No files error handling
     - FormData file acceptance
     - Multiple file handling

## Test Philosophy

- **Simple**: Tests use Deno's native test framework, no external test libraries
- **Focused**: Each test file focuses on a single module/component
- **Isolated**: Tests are independent and can run in any order
- **Practical**: Tests verify actual behavior, not implementation details

## Notes

- Some tests (like album handler) require AWS credentials to fully test
- Upload handler tests will fail if AWS credentials aren't configured (expected)
- Tests use `--no-check` flag to skip TypeScript checking for faster execution
- All tests use Deno's standard assertion library from `deno.land/std`

## Future Test Additions

Potential areas for additional tests:

- Integration tests for full request/response cycles
- Error handling edge cases
- Performance tests for large file sets
- Browser-based E2E tests (using Playwright or similar)
