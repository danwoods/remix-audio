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

   - HTML structure validation
   - Initial data script inclusion
   - Asset inclusion (CSS/JS)
   - Head links support
   - Script tag escaping

7. **Handler Tests**
   - **Album Cover Handler** (`server/handlers/album.cover.deno.test.ts`)
     - 400 when artistId or albumId is missing
     - `decodeDataUrl()` behavior (valid and invalid data URLs)
     - `getKeyFromTrackUrl()` S3 key extraction from track URL
   - **Upload Handler** (`server/handlers/upload.deno.test.ts`)
     - No files error handling
     - FormData file acceptance
     - Multiple file handling
   - **Note**: Root and Album handler tests were removed after handlers were
     refactored to use plain HTML rendering (`index.html.ts` and
     `album.html.ts`)

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
