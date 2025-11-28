# Canvas API Review and Resolution

## Issue

The migration plan noted that the `deno-canvas` API might differ from `node-canvas`, and that `loadImage` and `toBuffer` methods needed to be verified at runtime.

## Investigation Results

### Finding 1: Package Doesn't Exist

The package `@luca/deno-canvas@^1.0.0` specified in `deno.json` does not exist in JSR. Attempts to import it resulted in "JSR package not found" errors.

### Finding 2: Canvas Not Needed on Server

After reviewing the codebase, it was discovered that:

1. **`extractCoverImage` function**:

   - Uses browser-only APIs: `File`, `parseBlob` (from `music-metadata-browser`)
   - Requires DOM APIs: `Image`, `document.createElement("canvas")`, `Blob`, `URL.createObjectURL`
   - Is only used in test files, not in production server code

2. **Server-side image handling**:
   - Uses `getID3Tags` function which calls `music-metadata.parseBuffer`
   - Already extracts images as base64-encoded strings
   - Converts base64 directly to `Uint8Array` for S3 upload
   - **No canvas conversion needed on the server**

### Resolution

1. **Removed `deno-canvas` dependency** from `deno.json` - it's not needed
2. **Added environment checks** to `convertToJpeg` and `extractCoverImage` functions:
   - Both functions now throw clear errors if called in a server environment
   - Added documentation noting they are browser-only
3. **Clarified function purposes**:
   - `extractCoverImage`: Browser-only, for client-side image extraction
   - `getID3Tags`: Works in both browser and server, already provides base64 images

## Code Changes

### `app/util/id3.ts`

- Added environment check: `if (typeof window === "undefined" || typeof document === "undefined")`
- Removed deno-canvas fallback code (was never needed)
- Added JSDoc comments clarifying browser-only usage

### `deno.json`

- Removed: `"deno-canvas": "jsr:@luca/deno-canvas@^1.0.0"`

## Verification

✅ Type checking passes: `deno check server/main.ts` succeeds
✅ No runtime canvas dependencies needed for server code
✅ Browser code continues to work with native DOM APIs

## Conclusion

**Canvas API is not needed on the Deno server.** The server-side code path uses `getID3Tags` which already provides images in the correct format (base64 strings that are converted to Uint8Array). The canvas conversion is only needed in the browser for the `extractCoverImage` function, which uses native browser APIs that work correctly.

**Status: ✅ RESOLVED** - No canvas library needed for Deno server.
