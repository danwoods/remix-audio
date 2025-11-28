# Migration Plan: Remix to Deno Server

## Executive Summary

This document outlines a comprehensive plan to migrate the Remix-based audio streaming application to a Deno-based server architecture. The application currently uses Remix's file-based routing, server-side rendering, and file upload handling. The migration will leverage Deno's native capabilities and modern web standards while maintaining the existing React frontend.

## Current Architecture Overview

### Technology Stack

- **Framework**: Remix v2.10.2
- **Runtime**: Node.js >=20.0.0
- **Build Tool**: Vite 5.1.4
- **Frontend**: React 18.2.0
- **Styling**: Tailwind CSS + DaisyUI
- **Testing**: Vitest
- **Storage**: AWS S3 (via @aws-sdk/client-s3)

### Key Remix Features in Use

1. **File-based Routing**: Routes defined in `app/routes/`

   - `_index.tsx` - Homepage
   - `artists.$artistId.albums.$albumId_.tsx` - Album detail page

2. **Server-side Data Loading**: `loader` functions for data fetching

   - Root loader fetches file list from S3
   - Route loaders fetch album-specific data

3. **File Upload Handling**: `action` function with multipart form data

   - Uses Remix's `UploadHandler` interface
   - Uses `useFetcher` hook in `FilePicker` component for form submission
   - Streams files to S3
   - Extracts ID3 metadata during upload

4. **Server-side Rendering**: Full SSR with React hydration

   - Uses `Outlet` for nested route rendering
   - Uses `Links`, `Meta`, `Scripts`, `ScrollRestoration` components

5. **Streaming**: Uses Node.js streams for S3 uploads

6. **Client-side Navigation**:
   - `Link` component used throughout (AppBar, Search, AlbumTile)
   - `useLocation` hook for pathname detection
   - `useOutletContext` for sharing player state between routes

### Current File Structure

```
app/
├── root.tsx              # Root layout, loader, action
├── routes/
│   ├── _index.tsx        # Homepage route
│   └── artists.$artistId.albums.$albumId_.tsx
├── components/           # React components
├── hooks/               # React hooks
└── util/
    ├── files.ts         # File organization utilities
    ├── id3.ts          # ID3 metadata extraction
    └── s3.server.ts    # S3 upload/download logic
```

## Migration Strategy

### Phase 1: Deno Environment Setup

#### 1.1 Deno Configuration

- Create `deno.json` configuration file
- Set up import maps for dependencies
- Configure Deno permissions (file system, network, environment variables)
- Set up TypeScript configuration compatible with Deno

#### 1.2 Dependency Migration

**Remix Dependencies to Replace:**

- `@remix-run/node` → Deno native Request/Response APIs
- `@remix-run/react` → Keep for client-side, remove server-side usage
- `@remix-run/serve` → Deno's native HTTP server (`Deno.serve()`)

**Additional Dependencies Needed:**

- `react` and `react-dom` - For SSR (use `react-dom/server`)
- `react-dom/client` - For client-side hydration
- Router library (optional): Consider `@tanstack/react-router` or custom routing

**Node.js Dependencies to Replace:**

- `stream.PassThrough` → Deno's native streams or Web Streams API
- `Buffer` → Deno's `Uint8Array` or `Deno.readAll()`
- `process.env` → `Deno.env.get()`

**Compatible Dependencies (Verify):**

- `@aws-sdk/client-s3` - Check Deno compatibility or use Deno-native AWS SDK
- `music-metadata` - Verify Deno compatibility
- `canvas` - May need Deno-specific version or alternative
- React and React DOM - Compatible with Deno

#### 1.3 Build System Changes

- Keep Vite for client-side React bundling
- Use Deno's native HTTP server (`Deno.serve()`) for server
- Set up dual build process:
  - Vite builds client bundle (React components, CSS)
  - Deno serves static assets and handles SSR
- Configure asset serving using Deno's file system APIs
- Set up development workflow with hot reload for both client and server

### Phase 2: Server Architecture Redesign

#### 2.1 Routing System

**Custom Router with Deno's Native HTTP Server**

- Build custom router using `Deno.serve()` and URL pattern matching
- Implement route matching and parameter extraction manually
- Create route handler registry mapping patterns to handler functions
- Support dynamic route parameters (e.g., `:artistId`, `:albumId`)
- Handle nested routes and route precedence
- Maintain similar route patterns: `/`, `/artists/:artistId/albums/:albumId`

**Router Implementation Approach:**

- Use URL pattern matching (consider `URLPattern` API or custom regex)
- Create route definitions with method handlers (GET, POST, etc.)
- Extract route parameters from URL
- Support query string parsing
- Handle 404s and error responses

#### 2.2 Data Loading (Loaders)

- Convert Remix `loader` functions to route handler functions
- Handler receives `Request` and route params as arguments
- Maintain same data fetching logic from S3
- Return data to be passed to React components for SSR
- Store data in a way that can be serialized and sent to client for hydration

#### 2.3 File Upload (Actions)

- Replace Remix `action` with POST route handler
- Replace `useFetcher` in `FilePicker.tsx` with standard form submission:
  - Option A: Use standard HTML form with `action` attribute pointing to upload endpoint
  - Option B: Use `fetch` API with `FormData` for programmatic submission
  - Handle loading states manually (currently handled by `fetcher.state`)
- Use Deno's native `Request` API for multipart form parsing
- Replace `parseMultipartFormData` with Deno-compatible solution:
  - Use `multipart` from `std/media_types` or
  - Use `form-data` library compatible with Deno
  - Parse `multipart/form-data` manually using Web Streams API
- Replace `composeUploadHandlers` and `createMemoryUploadHandler` with custom upload logic
- Maintain streaming upload to S3 using Web Streams API
- Return appropriate redirect responses after upload

#### 2.4 Server-Side Rendering

- Implement manual SSR using `react-dom/server`'s `renderToString()`
- Create HTML template with:
  - Server-rendered React component HTML
  - Serialized data for client hydration (JSON in `<script>` tag)
  - Client bundle script tags
  - CSS links
- Implement client-side hydration using `react-dom/client`'s `hydrateRoot()`
- Ensure data passed to server matches data used for hydration

### Phase 3: Code Migration

#### 3.1 Root Component (`app/root.tsx`)

**Changes Required:**

- Remove Remix-specific imports (`@remix-run/node`, `@remix-run/react`)
- Convert `loader` to route handler function
- Convert `action` to POST route handler
- Update `useLoaderData` usage - pass data as props from server
- Replace `Links`, `Meta`, `Scripts`, `ScrollRestoration` with custom implementation:
  - `Links` → Manual `<link>` tags in HTML template
  - `Meta` → Manual `<meta>` tags in HTML template
  - `Scripts` → Manual `<script>` tags for client bundle
  - `ScrollRestoration` → Custom client-side implementation or remove
- Update environment variable access: `process.env` → `Deno.env.get()`

**Migration Steps:**

1. Create `server/routes.ts` for route definitions
2. Create `server/handlers/root.ts` for root route handler
3. Move loader logic to GET handler
4. Move action logic to POST handler
5. Create `server/ssr.tsx` for SSR rendering logic
6. Update root component to receive data via props instead of `useLoaderData`
7. Create HTML template function that includes head management
8. Implement client-side hydration script

#### 3.2 Route Files

**`app/routes/_index.tsx` → `server/handlers/index.ts` + `app/pages/index.tsx`**

- Convert `loader` to route handler function in `server/handlers/index.ts`
- Create page component in `app/pages/index.tsx`
- Update `useLoaderData` to receive data via props
- Component logic remains mostly the same

**`app/routes/artists.$artistId.albums.$albumId_.tsx` → `server/handlers/artists/[artistId]/albums/[albumId].ts` + `app/pages/artists/[artistId]/albums/[albumId].tsx`**

- Convert dynamic route syntax from Remix to Deno route pattern (`/artists/:artistId/albums/:albumId`)
- Convert `loader` to route handler function
- Extract route params from URL in handler
- Update `useLoaderData` and `useOutletContext` usage:
  - Replace `useLoaderData` with props
  - Replace `useOutletContext` with React Context or props drilling
  - Context contains: `{ isPlaying: boolean, playToggle: (track?: { url: string }) => void, currentTrack: string | null }`
- Component logic remains mostly the same

#### 3.3 Server Utilities (`app/util/s3.server.ts`)

**Critical Changes:**

- Replace `PassThrough` stream with Web Streams API:
  ```typescript
  // Old: new PassThrough()
  // New: new ReadableStream() or TransformStream
  ```
- Replace `writeAsyncIterableToWritable` with Deno-compatible streaming
- Update `Buffer` usage (found in 2 locations):
  - Line 190: `Buffer.from(base64Data, "base64")` for cover image upload
  - Replace with: `Uint8Array.from(atob(base64Data), c => c.charCodeAt(0))`
  ```typescript
  // Old: Buffer.from(base64Data, "base64")
  // New: Uint8Array.from(atob(base64Data), c => c.charCodeAt(0))
  ```
- Update `process.env` → `Deno.env.get()` (used in `validateConfig()` function)
- Verify AWS SDK compatibility or use Deno-native AWS client
- Replace Node.js stream operations with Web Streams API

**Streaming Upload Pattern:**

```typescript
// New pattern using Web Streams
const stream = new ReadableStream({
  start(controller) {
    // Stream data chunks
  },
});
```

#### 3.4 ID3 Utilities (`app/util/id3.ts`)

**Changes Required:**

- Verify `music-metadata` compatibility with Deno
- Update `Buffer` usage to `Uint8Array` (found at line 110):
  - Line 110: `Buffer.from(imageMetadata.data).toString("base64")`
  - Replace with: Convert `Uint8Array` to base64 using `btoa(String.fromCharCode(...array))` or Deno's built-in encoding
  ```typescript
  // Old: Buffer.from(imageMetadata.data).toString("base64")
  // New: btoa(String.fromCharCode(...new Uint8Array(imageMetadata.data)))
  // Or: Use Deno's encoding utilities if available
  ```
- Check `canvas` package compatibility:
  - May need `deno-canvas` or alternative
  - Or use Deno's native image processing capabilities
- Update image conversion logic for Deno environment
- Note: `extractCoverImage` function uses browser `Image` API - may need server-side alternative

#### 3.5 File Utilities (`app/util/files.ts`)

**Changes Required:**

- Minimal changes expected
- Verify `id3js` library compatibility with Deno
- Update any Node.js-specific APIs

### Phase 4: Frontend Adaptation

#### 4.1 Client-Side Code

- Most React components should work without changes
- Update imports to use new route structure
- Implement client-side routing:
  - Option A: Use React Router for client-side navigation
  - Option B: Use browser History API with custom router
  - Option C: Use full-page navigation (simpler, less SPA-like)
- Update Remix-specific hooks found in codebase:
  - **`useLoaderData`** (used in `root.tsx`, `_index.tsx`, `artists.$artistId.albums.$albumId_.tsx`)
    → Props passed from server-rendered data
  - **`useOutletContext`** (used in `artists.$artistId.albums.$albumId_.tsx`)
    → React Context API or props drilling (context contains: `isPlaying`, `playToggle`, `currentTrack`)
  - **`useFetcher`** (used in `FilePicker.tsx` for file uploads)
    → Use `fetch` API directly or create custom hook for form submissions
  - **`Link`** (used in `AppBar`, `Search`, `AlbumTile`)
    → React Router's `Link` or custom navigation component
  - **`useLocation`** (used in `AppBar` for pathname)
    → React Router's `useLocation` or browser `window.location`
  - **`Outlet`** (used in `root.tsx`)
    → Render child route components directly based on current route
- Implement client-side hydration to restore React state
- Handle client-side navigation and data fetching if using SPA approach
- **File Upload**: Replace `useFetcher().Form` with standard HTML form + fetch API or custom form submission handler

#### 4.2 Asset Management

- Configure static asset serving in Deno
- Update CSS imports and build process
- Ensure Tailwind CSS compilation works with Deno setup

### Phase 5: Testing Migration

#### 5.1 Test Framework

- Vitest may work with Deno, but verify compatibility
- Consider migrating to Deno's native test runner (`deno test`)
- Update test imports and mocks for Deno environment
- Update test setup files

#### 5.2 Test Updates

- Update environment variable access in tests
- Mock Deno APIs instead of Node.js APIs
- Update file system operations in tests
- Verify S3 mocking works with Deno

### Phase 6: Build and Deployment

#### 6.1 Build Process

- Set up separate build for client-side code (Vite)
- Configure Deno build for server code
- Create deployment scripts
- Update CI/CD pipelines

#### 6.2 Deployment Considerations

- Deno Deploy (recommended for serverless)
- Self-hosted Deno server
- Docker container with Deno runtime
- Update environment variable configuration
- Verify S3 credentials work in Deno environment

## Detailed Migration Checklist

### Pre-Migration

- [ ] Research Deno HTTP server and routing patterns
- [ ] Verify all dependency compatibility with Deno
- [ ] Set up Deno development environment
- [ ] Create backup of current codebase
- [ ] Document current API contracts
- [ ] Research React SSR with Deno patterns

### Phase 1: Setup

- [x] Create new Deno project structure
- [x] Create `deno.json` configuration
- [x] Set up import maps for dependencies
- [x] Configure TypeScript for Deno
- [x] Install/verify Deno-compatible dependencies
- [x] Set up basic HTTP server with `Deno.serve()`
- [x] Create router foundation
- [ ] Set up development server with hot reload (deferred - focusing on core migration)

### Phase 2: Core Server

- [x] Implement custom router with route matching
- [x] Create route handler interface/type
- [x] Migrate root loader to route handler
- [x] Migrate root action to POST route handler
- [x] Set up SSR rendering function
- [x] Create HTML template function
- [ ] Implement client-side hydration setup
- [x] Migrate homepage route
- [x] Migrate album detail route
- [ ] Test basic routing and data loading
- [ ] Test SSR rendering

### Phase 3: File Upload

- [x] Replace multipart form parsing
- [x] Migrate S3 upload handler
- [x] Update streaming logic
- [ ] Test file upload functionality
- [ ] Verify ID3 extraction works

### Phase 4: Utilities

- [x] Migrate `s3.server.ts` utilities
- [x] Update stream operations
- [x] Replace Buffer usage
- [x] Migrate `id3.ts` utilities
- [x] Update `files.ts` utilities (no changes needed)
- [ ] Test all utility functions

### Phase 5: Frontend

- [x] Update component imports
- [x] Replace Remix hooks with alternatives (props, Context API)
- [x] Implement client-side routing (full-page navigation)
- [x] Set up client-side hydration
- [ ] Test client-side navigation
- [ ] Verify SSR rendering matches client rendering
- [ ] Test audio player functionality
- [ ] Ensure hydration warnings are resolved

### Phase 6: Testing

- [x] Migrate test configuration (router tests created)
- [x] Router tests passing
- [x] Type checking passes
- [ ] Update test files for Deno
- [ ] Run full test suite
- [ ] Fix failing tests

### Phase 7: Deployment

- [ ] Update build scripts
- [ ] Configure production build
- [ ] Set up deployment pipeline
- [ ] Test production deployment
- [ ] Update documentation

## Key Technical Decisions

### 1. Framework Choice: Plain Deno (Custom Router)

**Decision**: Use plain Deno with custom router

- Full control over routing and SSR implementation
- No framework dependencies
- Lightweight and minimal
- Can optimize for specific use cases
- More work upfront but more flexibility

**Router Implementation Options:**

- **URLPattern API**: Modern browser/Deno API for route matching
- **Custom regex-based**: Simple pattern matching
- **Path-to-regexp style**: Similar to Express.js routing

### 2. AWS SDK Compatibility

**Options:**

- Use `@aws-sdk/client-s3` if compatible (check npm compatibility in Deno)
- Use `aws-sdk-js-v3` with Deno import
- Use Deno-native AWS client library
- Use AWS REST API directly

**Action**: Verify `@aws-sdk/client-s3` works with Deno's npm compatibility layer

### 3. Canvas/Image Processing

**Options:**

- `deno-canvas` package
- Native Deno image processing (if available)
- Alternative image processing library
- Server-side image conversion service

**Action**: Research and test canvas alternatives for cover art processing

### 4. Streaming Strategy

**Approach**: Use Web Streams API

- Native to Deno and browsers
- Modern standard
- Better compatibility
- Replace Node.js streams entirely

### 5. Client-Side Routing

**Options:**

- **React Router**: Full-featured, well-supported
- **Custom History API**: Lightweight, manual implementation
- **Full-page navigation**: Simplest, traditional web app approach

**Recommendation**: Start with full-page navigation, add React Router if SPA features needed

**Action**: Decide on SPA vs traditional navigation based on requirements

## Risk Assessment

### High Risk Areas

1. **File Upload Streaming**: Complex stream operations need careful migration
2. **ID3 Metadata Extraction**: Dependencies may not be Deno-compatible
3. **Canvas Operations**: Image processing may need significant changes
4. **AWS SDK**: Compatibility uncertain, may need alternative implementation

### Medium Risk Areas

1. **Routing Migration**: Need to build custom router from scratch
2. **SSR Implementation**: Manual SSR setup more complex than framework-provided
3. **Data Loading**: Similar concepts, different APIs
4. **Client-Side Hydration**: Need to ensure server/client data matches
5. **Testing**: Test framework migration required

### Low Risk Areas

1. **React Components**: Should work with minimal changes
2. **Utility Functions**: Mostly pure functions, easy to migrate
3. **Styling**: Tailwind CSS works independently

## Success Criteria

1. ✅ All routes work correctly
2. ✅ File uploads function properly
3. ✅ S3 integration works
4. ✅ ID3 metadata extraction works
5. ✅ Cover art display works
6. ✅ Audio playback works
7. ✅ All tests pass
8. ✅ Performance is equal or better
9. ✅ Production deployment successful

## Timeline Estimate

- **Phase 1 (Setup)**: 3-4 days (custom router adds complexity)
- **Phase 2 (Core Server)**: 5-7 days (SSR implementation from scratch)
- **Phase 3 (File Upload)**: 3-4 days
- **Phase 4 (Utilities)**: 2-3 days
- **Phase 5 (Frontend)**: 3-4 days (hydration and routing)
- **Phase 6 (Testing)**: 2-3 days
- **Phase 7 (Deployment)**: 1-2 days

**Total Estimated Time**: 19-27 days

**Note**: Using plain Deno adds 4-6 days compared to using Fresh due to custom router and SSR implementation.

## Resources and References

### Documentation

- [Deno Manual](https://deno.land/manual)
- [Deno HTTP Server](https://deno.land/api?s=Deno.serve)
- [Deno Web Streams API](https://deno.land/manual/runtime/web_platform_api/streams_api)
- [Deno AWS SDK Guide](https://deno.land/manual/node/npm_specifiers)
- [URLPattern API](https://developer.mozilla.org/en-US/docs/Web/API/URLPattern)
- [React Server Components](https://react.dev/reference/rsc/server-components)
- [React DOM Server](https://react.dev/reference/react-dom/server)

### Migration Guides

- [Node.js to Deno Migration](https://deno.land/manual/node)
- [Building HTTP Servers in Deno](https://deno.land/manual/examples/http_server)

### Testing

- [Deno Testing](https://deno.land/manual/basics/testing)
- [Deno Testing HTTP](https://deno.land/manual/basics/testing/mocking_apis)

## Notes for AI Implementation

When implementing this migration:

1. **Start with basic Deno HTTP server** and build router incrementally
2. **Test each phase** before moving to the next
3. **Keep Remix version running** in parallel during migration
4. **Use feature flags** to gradually switch over functionality
5. **Document all API changes** between Remix and plain Deno
6. **Pay special attention to**:
   - Router implementation (build from scratch)
   - SSR setup (manual React rendering)
   - Client-side hydration (ensure data matches)
   - Stream operations (most complex part)
   - Environment variable access patterns
   - File system operations
   - Network requests
7. **Verify Deno compatibility** of each dependency before migration
8. **Test file uploads thoroughly** - this is the most critical feature
9. **Ensure backward compatibility** with existing S3 data structure
10. **Maintain code quality** and follow Deno best practices
11. **Start simple**: Begin with basic routing, then add SSR, then add features
12. **Use URLPattern API** for route matching if available, fallback to regex
13. **Implement proper error handling** for 404s and server errors
14. **Consider creating a small router library** if patterns become complex

## Appendix: Code Pattern Examples

### Remix Loader → Deno Route Handler

```typescript
// Remix
export const loader = async () => {
  const files = await getUploadedFiles();
  return json({ files });
};

// Plain Deno
export async function handleIndex(req: Request): Promise<Response> {
  const files = await getUploadedFiles();
  const html = await renderPage(IndexPage, { files });
  return new Response(html, {
    headers: { "Content-Type": "text/html" },
  });
}
```

### Remix Action → Deno POST Handler

```typescript
// Remix
export const action = async ({ request }: ActionFunctionArgs) => {
  // Handle POST
  return redirect("/");
};

// Plain Deno
export async function handleUpload(req: Request): Promise<Response> {
  // Handle POST upload
  // ... upload logic ...
  return new Response(null, {
    status: 303,
    headers: { Location: "/" },
  });
}
```

### Router Setup Example

```typescript
// server/router.ts
interface Route {
  pattern: string;
  handler: (req: Request, params: Record<string, string>) => Promise<Response>;
  method?: string;
}

const routes: Route[] = [
  { pattern: "/", handler: handleIndex },
  { pattern: "/artists/:artistId/albums/:albumId", handler: handleAlbum },
  { pattern: "/upload", handler: handleUpload, method: "POST" },
];

export async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);

  for (const route of routes) {
    if (route.method && req.method !== route.method) continue;

    const match = matchRoute(route.pattern, url.pathname);
    if (match) {
      return route.handler(req, match.params);
    }
  }

  return new Response("Not Found", { status: 404 });
}

Deno.serve({ port: 8000 }, handleRequest);
```

### SSR Rendering Example

```typescript
// server/ssr.tsx
import { renderToString } from "react-dom/server";
import { App } from "../app/root.tsx";

export async function renderPage(
  Component: React.ComponentType<any>,
  props: any
): Promise<string> {
  const appHtml = renderToString(<Component {...props} />);
  const dataJson = JSON.stringify(props).replace(/</g, "\\u003c");

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Remix Audio</title>
    <link rel="stylesheet" href="/app.css" />
  </head>
  <body>
    <div id="root">${appHtml}</div>
    <script>
      window.__INITIAL_DATA__ = ${dataJson};
    </script>
    <script type="module" src="/client.js"></script>
  </body>
</html>`;
}
```

### Client Hydration Example

```typescript
// client/hydrate.tsx
import { hydrateRoot } from "react-dom/client";
import { App } from "../app/root.tsx";

const initialData = (window as any).__INITIAL_DATA__;
const root = document.getElementById("root");

if (root) {
  hydrateRoot(root, <App {...initialData} />);
}
```

### File Upload Migration Example

```typescript
// Remix: FilePicker.tsx
const fetcher = useFetcher();
<fetcher.Form method="post" encType="multipart/form-data">
  <input type="file" name="files" multiple />
</fetcher.Form>

// Deno: FilePicker.tsx
const [isSubmitting, setIsSubmitting] = useState(false);

const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  setIsSubmitting(true);
  const formData = new FormData(e.currentTarget);

  try {
    const response = await fetch("/upload", {
      method: "POST",
      body: formData,
    });

    if (response.ok) {
      window.location.href = "/"; // Redirect after upload
    }
  } finally {
    setIsSubmitting(false);
  }
};

<form onSubmit={handleSubmit} encType="multipart/form-data">
  <input type="file" name="files" multiple />
  <button type="submit" disabled={isSubmitting}>
    {isSubmitting ? "Uploading..." : "Upload"}
  </button>
</form>
```

### Node.js Stream → Web Stream

```typescript
// Node.js
const pass = new PassThrough();
await writeAsyncIterableToWritable(data, pass);

// Deno/Web Streams
const stream = new ReadableStream({
  async start(controller) {
    for await (const chunk of data) {
      controller.enqueue(chunk);
    }
    controller.close();
  },
});
```

---

**Document Version**: 1.0  
**Last Updated**: 2024  
**Status**: Ready for Implementation
