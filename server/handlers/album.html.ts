/** @file Handler for album detail page HTML.
 *
 * Renders the album page with track list and OG meta tags for sharing.
 * Sets og:image to the album cover URL (`/artists/:artistId/albums/:albumId/cover`).
 */

import { getUploadedFiles } from "../../app/util/s3.server.ts";
import { getAlbum, sortTracksByTrackNumber } from "../../app/util/files.ts";
import pkg from "../../deno.json" with { type: "json" };
import { createAlbumUrl } from "../../lib/album.ts";
import { createLogger } from "../../app/util/logger.ts";

const logger = createLogger("Album HTML");

/**
 * Escape string for safe use in HTML attribute values (e.g. title, og:content).
 *
 * @param s - Raw string (e.g. user-controlled or dynamic text).
 * @returns Escaped string safe for double-quoted attribute values.
 */
function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Handle GET request for album detail page.
 *
 * @param req - The request; req.url is used to build base URL for og:url and og:image (cover URL).
 * @param params - Route params: artistId, albumId.
 * @returns Response with HTML document including OG meta tags and cover image URL.
 */
export async function handleAlbumHtml(
  req: Request,
  params: Record<string, string>,
): Promise<Response> {
  const { artistId, albumId } = params;
  logger.info("Handling album HTML", { artistId, albumId });

  if (!artistId || !albumId) {
    return new Response("Missing artist or album ID", { status: 400 });
  }

  const files = await getUploadedFiles();
  logger.debug("Files", { files: JSON.stringify(files, null, 2) });

  const album = getAlbum(files, `${artistId}/${albumId}`);
  logger.debug("Album", { album });

  if (!album) {
    return new Response("Album not found", { status: 404 });
  }

  const tracks = [...album.tracks].sort(sortTracksByTrackNumber);
  logger.debug("Tracks", { tracks });

  const albumUrl = createAlbumUrl(
    Deno.env.get("STORAGE_BUCKET")!,
    Deno.env.get("STORAGE_REGION")!,
    artistId,
    albumId,
  );
  logger.debug("Album URL", { albumUrl });

  // Set up track list HTML
  const trackListHtml = tracks.map((track) => `
    <tracklist-item-custom-element data-track-url="${track.url}" data-track-name="${track.title}" data-track-artist="${artistId}" data-track-number="${track.trackNum}"></tracklist-item-custom-element>
  `).join("");

  // Set up OG meta tags
  const baseUrl = new URL(req.url).origin;
  const pageUrl = `${baseUrl}/artists/${encodeURIComponent(artistId)}/albums/${
    encodeURIComponent(albumId)
  }`;
  const coverUrl = `${pageUrl}/cover`;
  const ogTitle = `${album.title} - ${pkg.name}`;
  const ogDescription = "Your audio where you want it.";

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeAttr(pkg.name)} - ${escapeAttr(albumId)}</title>
  <meta name="description" content="${escapeAttr(ogDescription)}">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${escapeAttr(ogTitle)}">
  <meta property="og:description" content="${escapeAttr(ogDescription)}">
  <meta property="og:url" content="${escapeAttr(pageUrl)}">
  <meta property="og:image" content="${escapeAttr(coverUrl)}">
  <link rel="preload" href="/build/main.js" as="script" />
  <link rel="stylesheet" href="/app.css">
  <style>
    album-header-custom-element {
      flex-shrink: 0;
    }

    .album-page-main {
      position: relative;
      flex: 1;
      min-height: 0;
      overflow: auto;
      padding-bottom: 6rem;
    }

    .tracklist {
      background: #121212;
      padding: 16px 24px;
    }

    .tracklist-title {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 16px;
      color: rgba(255, 255, 255, 0.9);
    }
  </style>
</head>
<body> 
  <album-header-custom-element data-album-url="${albumUrl}"></album-header-custom-element>

  <div class="album-page-main">
    <section class="tracklist">
      <h2 class="tracklist-title">Tracks</h2>
      <div id="tracklistContainer">${trackListHtml}</div>
    </section>
  </div>

  <playbar-custom-element data-album-url="${albumUrl}"></playbar-custom-element>

  <script type="module" src="/build/main.js"></script>
  <script>
    document.addEventListener("track-click", (event) => {
      const customEvent = event instanceof CustomEvent ? event : null;
      if (customEvent && customEvent.detail) {
        const trackUrl = customEvent.detail.trackUrl;
        const playbar = document.querySelector('playbar-custom-element');
        if (playbar) {
          playbar.setAttribute('data-current-track-url', trackUrl);
          playbar.setAttribute('data-is-playing', 'true');
        }
      }
    });
  </script>
</body>
</html>
`;

  return new Response(html, {
    headers: { "Content-Type": "text/html" },
  });
}
