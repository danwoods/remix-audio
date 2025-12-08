# Server Internal Server Error - Fixed

## Issue

When accessing the server, it returned "Internal Server Error" with the
following problems:

1. **Missing .env file loading**: Deno doesn't automatically load `.env` files
2. **Missing `--allow-sys` permission**: AWS SDK requires system access for OS
   information

## Fixes Applied

### 1. Added .env File Loading

Created `server/utils/loadEnv.ts` to load environment variables from `.env` file
at startup.

**File**: `server/utils/loadEnv.ts`

- Parses `.env` file
- Sets environment variables (only if not already set)
- Handles comments and quoted values
- Gracefully handles missing `.env` file

**Integration**: Added to `server/main.ts`:

```typescript
import { loadEnv } from "./utils/loadEnv.ts";
await loadEnv(); // Load before server starts
```

### 2. Added `--allow-sys` Permission

Updated `deno.json` tasks to include `--allow-sys` flag required by AWS SDK.

**Updated tasks**:

- `dev`: Now includes `--allow-sys`
- `start`: Now includes `--allow-sys`

### 3. Improved Error Handling

Enhanced router error handling to show actual error messages instead of generic
"Internal Server Error".

**File**: `server/router.ts`

- Now includes error message in response
- Logs error stack for debugging
- Returns error details in development

## Verification

✅ Server starts successfully\
✅ Environment variables loaded from `.env`\
✅ S3 connection works\
✅ HTML rendered correctly\
✅ Data serialized for client hydration

## How to Start Server

```bash
# Development (with auto-reload)
deno task dev

# Production
deno task start
```

The server will:

1. Load environment variables from `.env` file
2. Start on port 8000 (or PORT env var)
3. Serve static assets from `build/client/`
4. Handle routes and render SSR

## Required Environment Variables

Make sure your `.env` file contains:

```bash
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
STORAGE_REGION=your_region
STORAGE_BUCKET=your_bucket
PORT=8000  # Optional
```


