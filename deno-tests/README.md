# Deno Tests

This directory contains tests for the Deno server migration, using Deno's native test framework.

## Test Structure

```
deno-tests/
├── app/
│   └── util/
│       └── files.deno.test.ts          # Tests for file utility functions
├── server/
│   ├── handlers/
│   │   ├── album.deno.test.ts           # Tests for album route handler
│   │   ├── root.deno.test.ts            # Tests for root route handler
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
   - HTTP method filtering

2. **Files Utility Tests** (`app/util/files.deno.test.ts`)

   - `getArtist()` - Get artist data
   - `sortTracksByTrackNumber()` - Track sorting
   - `getParentDataFromTrackUrl()` - URL parsing
   - `getAlbum()` - Album lookup
   - `getRemainingAlbumTracks()` - Remaining tracks calculation
   - `getAlbumIdsByRecent()` - Recent albums sorting
   - `search()` - Search functionality (artists, albums, tracks)

3. **Manifest Utility Tests** (`server/utils/manifest.deno.test.ts`)

   - Asset filename resolution
   - Client assets retrieval
   - Fallback behavior

4. **LoadEnv Utility Tests** (`server/utils/loadEnv.deno.test.ts`)

   - Missing .env file handling
   - Environment variable parsing
   - Existing variable preservation

5. **SSR Tests** (`server/ssr.deno.test.ts`)

   - HTML structure validation
   - Initial data script inclusion
   - Asset inclusion (CSS/JS)
   - Head links support
   - Script tag escaping

6. **Handler Tests**
   - **Root Handler** (`server/handlers/root.deno.test.ts`)
     - HTML response validation
     - Preconnect link inclusion
   - **Upload Handler** (`server/handlers/upload.deno.test.ts`)
     - No files error handling
     - FormData file acceptance
     - Multiple file handling
   - **Album Handler** (`server/handlers/album.deno.test.ts`)
     - Album page rendering (requires AWS credentials)

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
