# Deno Server Setup

This document describes how to run the Deno-based server for the remix-audio
application.

## Prerequisites

- Deno 1.40+ installed
- Node.js 20+ (for building client bundle with Vite)
- AWS credentials configured (for S3 access)

## Environment Variables

Create a `.env` file in the project root with the following variables:

```bash
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
STORAGE_REGION=your_region
STORAGE_BUCKET=your_bucket_name
ADMIN_USER=admin_username
ADMIN_PASS=admin_password
PORT=8000  # Optional, defaults to 8000
```

## Building the Client Bundle

Before running the Deno server, you need to build the client bundle:

```bash
npm install
npm run build:client
```

Or if you add a script to package.json:

```bash
vite build
```

This will create the client bundle in `build/client/`.

## Running the Server

### Development Mode

```bash
deno task dev
```

Or directly:

```bash
deno run --allow-net --allow-env --allow-read --allow-write --allow-sys --watch server/main.ts
```

### Production Mode

```bash
deno task start
```

Or directly:

```bash
deno run --allow-net --allow-env --allow-read --allow-write --allow-sys server/main.ts
```

**Note**: The `--allow-sys` flag is required for AWS SDK compatibility.

## Testing

Run the router tests:

```bash
deno test server/router.test.ts --allow-read
```

## Project Structure

```
.
├── app/                    # React components and routes
│   ├── components/         # React components
│   ├── routes/            # Page components
│   ├── util/              # Utility functions
│   ├── context/           # React Context providers
│   ├── entry.client.tsx   # Client-side hydration entry
│   └── root.tsx           # Root component
├── server/                # Deno server code
│   ├── main.ts           # Server entry point
│   ├── router.ts         # Custom router
│   ├── ssr.tsx           # SSR utilities
│   └── handlers/         # Route handlers
├── build/                 # Build output
│   └── client/           # Client bundle (from Vite)
├── public/                # Static assets
└── deno.json             # Deno configuration
```

## Routes

- `GET /` - Homepage
- `POST /` - File upload
- `GET /artists/:artistId/albums/:albumId` - Album detail page
- `GET /artists/:artistId/albums/:albumId/cover` - Album cover image (extracted
  from ID3 tags of first track)

## Notes

- The server uses Deno's native HTTP server (`Deno.serve()`)
- Client bundle is built with Vite (separate from server)
- SSR is handled manually using `react-dom/server`
- File uploads are handled using Deno's `Request.formData()`
- S3 integration uses AWS SDK v3 via npm compatibility

## Troubleshooting

### Port Already in Use

Change the port by setting the `PORT` environment variable:

```bash
PORT=3000 deno task start
```

### Client Bundle Not Found

Make sure you've built the client bundle:

```bash
npm install
vite build
```

### Import Errors

Ensure all imports use `.ts` or `.tsx` extensions for Deno compatibility.
