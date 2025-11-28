# Migration Status

## Completed Tasks

### Phase 1: Deno Environment Setup ✅

- Created `deno.json` with import maps for all dependencies
- Set up Deno project structure with `server/` directory
- Configured TypeScript for Deno
- Set up basic HTTP server with `Deno.serve()`

### Phase 2: Core Server ✅

- Implemented custom router with route matching (`server/router.ts`)
- Created route handler interface
- Migrated root loader to route handler (`server/handlers/root.ts`)
- Migrated root action to POST route handler (`server/handlers/upload.ts`)
- Set up SSR rendering function (`server/ssr.tsx`)
- Created HTML template function
- Migrated homepage route (`server/handlers/root.ts`)
- Migrated album detail route (`server/handlers/album.ts`)

### Phase 3: File Upload ✅

- Replaced multipart form parsing with Deno's `Request.formData()`
- Migrated S3 upload handler to `handleS3Upload()` function
- Updated streaming logic to use Uint8Array instead of Node.js streams

### Phase 4: Utilities ✅

- Migrated `s3.server.ts`:
  - Replaced `process.env` with `Deno.env.get()`
  - Replaced `PassThrough` streams with Uint8Array collection
  - Replaced `Buffer.from()` with `Uint8Array.from()`
- Migrated `id3.ts`:
  - Replaced `Buffer.from().toString("base64")` with `btoa(String.fromCharCode(...))`
  - Updated canvas import to use `deno-canvas`
- `files.ts` - No changes needed (pure functions)

### Phase 5: Frontend ✅

- Updated component imports to use `.ts`/`.tsx` extensions
- Replaced Remix hooks:
  - `useLoaderData` → Props passed from server
  - `useOutletContext` → React Context API (`PlayerContext`)
  - `useFetcher` → Standard `fetch` API in `FilePicker`
  - `Link` → Standard `<a>` tags for full-page navigation
  - `useLocation` → `window.location` with state management
- Created `PlayerContext` for sharing player state
- Updated all components to work without Remix dependencies

## Remaining Tasks

### Client-Side Hydration ✅

- ✅ Created client entry point (`app/entry.client.tsx`)
- ✅ Updated Vite config to build client bundle without Remix
- ⚠️ Need to test SSR and client render match

### Testing

- Router tests created (`server/router.test.ts`)
- Need to test file upload functionality
- Need to verify ID3 extraction works with Deno
- Need to test SSR rendering
- Need to test client-side navigation

### Build Configuration

- Need to update Vite config for Deno client build
- Need to configure asset serving
- Need to set up production build process

### Known Issues

1. ✅ **Client Bundle**: Fixed - SSR now references `/build/client/assets/main.js` from Vite build
2. ✅ **Canvas API**: Resolved - Canvas is not needed on the server. `extractCoverImage` is browser-only and uses native DOM APIs. The server uses `getID3Tags` which already provides base64-encoded images. Removed unnecessary `deno-canvas` dependency.
3. ✅ **Import Paths**: All import paths fixed to use `.ts`/`.tsx` extensions
4. ✅ **Type Errors**: All TypeScript type errors resolved

## Next Steps

1. **Create Client Entry Point**: Build a new client entry point that hydrates the React app
2. **Update Vite Config**: Configure Vite to build client bundle without Remix
3. **Test Server**: Run the Deno server and test basic functionality
4. **Fix Import Issues**: Resolve any import path problems
5. **Test File Upload**: Verify file upload works end-to-end
6. **Test SSR**: Ensure server-side rendering works correctly

## Files Created

- `deno.json` - Deno configuration
- `server/main.ts` - Main server entry point
- `server/router.ts` - Custom router implementation
- `server/router.test.ts` - Router tests
- `server/ssr.tsx` - SSR rendering utilities
- `server/handlers/root.ts` - Root route handler
- `server/handlers/index.ts` - Index route handler (placeholder)
- `server/handlers/album.ts` - Album detail route handler
- `server/handlers/upload.ts` - File upload handler
- `app/context/PlayerContext.tsx` - React Context for player state
- `app/client/hydrate.tsx` - Client hydration script (needs work)

## Files Modified

- `app/root.tsx` - Removed Remix dependencies, accepts props
- `app/routes/_index.tsx` - Removed Remix hooks, accepts props
- `app/routes/artists.$artistId.albums.$albumId_.tsx` - Removed Remix hooks, uses Context
- `app/util/s3.server.ts` - Migrated to Deno APIs
- `app/util/id3.ts` - Migrated to Deno APIs
- `app/components/Layout/AppBar/index.tsx` - Replaced Link/useLocation
- `app/components/Layout/AppBar/Search.tsx` - Replaced Link
- `app/components/Layout/AppBar/FilePicker.tsx` - Replaced useFetcher
- `app/components/AlbumTile/index.tsx` - Replaced Link
