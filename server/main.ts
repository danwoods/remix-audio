/** @file Main Deno server entry point */
import { Router } from "./router.ts";
import { handleUpload } from "./handlers/upload.ts";
import { handleIndexHtml } from "./handlers/index.html.ts";
import { loadEnv } from "./utils/loadEnv.ts";
import { handleAlbumCover } from "./handlers/album.cover.ts";
import { handleAlbumHtml } from "./handlers/album.html.ts";

// Load environment variables from .env file
await loadEnv();

const router = new Router();

// Register routes
router.add({ pattern: "/", handler: handleIndexHtml, method: "GET" });
router.add({ pattern: "/admin", handler: handleIndexHtml, method: "GET" });
router.add({ pattern: "/", handler: handleUpload, method: "POST" });
router.add({
  pattern: "/artists/:artistId/albums/:albumId/cover",
  handler: handleAlbumCover,
  method: "GET",
});
router.add({
  pattern: "/artists/:artistId/albums/:albumId",
  handler: handleAlbumHtml,
  method: "GET",
});

// Start server
const port = parseInt(Deno.env.get("PORT") || "8000", 10);

console.log(`🚀 Server running on http://localhost:${port}`);

Deno.serve({ port }, async (req: Request) => {
  const url = new URL(req.url);

  // Handle static assets (CSS, JS, images) from build directory
  if (url.pathname.startsWith("/build/")) {
    try {
      const filePath = `.${url.pathname}`;
      const file = await Deno.readFile(filePath);
      const contentType = getContentType(url.pathname);
      return new Response(file, {
        headers: { "Content-Type": contentType },
      });
    } catch (error) {
      console.error(`Failed to serve static file ${url.pathname}:`, error);
      return new Response("Not Found", { status: 404 });
    }
  }

  // Handle assets directory (for Vite dev server compatibility)
  if (url.pathname.startsWith("/assets/")) {
    try {
      const filePath = `./build/client${url.pathname}`;
      const file = await Deno.readFile(filePath);
      const contentType = getContentType(url.pathname);
      return new Response(file, {
        headers: { "Content-Type": contentType },
      });
    } catch {
      return new Response("Not Found", { status: 404 });
    }
  }

  // Handle favicon
  if (url.pathname === "/favicon.ico") {
    try {
      const file = await Deno.readFile("./public/favicon.ico");
      return new Response(file, {
        headers: { "Content-Type": "image/x-icon" },
      });
    } catch {
      return new Response("Not Found", { status: 404 });
    }
  }

  // Handle app.css
  if (url.pathname === "/app.css") {
    try {
      const file = await Deno.readFile("./app/app.css");
      return new Response(file, {
        headers: { "Content-Type": "text/css" },
      });
    } catch {
      return new Response("Not Found", { status: 404 });
    }
  }

  // Route requests through router
  return router.handle(req);
});

function getContentType(pathname: string): string {
  if (pathname.endsWith(".css")) return "text/css";
  if (pathname.endsWith(".js")) return "application/javascript";
  if (pathname.endsWith(".json")) return "application/json";
  if (pathname.endsWith(".png")) return "image/png";
  if (pathname.endsWith(".jpg") || pathname.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (pathname.endsWith(".svg")) return "image/svg+xml";
  return "application/octet-stream";
}
