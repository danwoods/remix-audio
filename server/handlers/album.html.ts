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
import { escapeAttr, renderPage } from "../ssr.ts";
import { getAdminAuthStatus } from "../utils/basicAuth.ts";

const logger = createLogger("Album HTML");

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

  // Set up track list HTML (escape dynamic values to prevent attribute injection)
  const trackListHtml = tracks.map((track) => `
    <tracklist-item-custom-element data-track-url="${
    escapeAttr(track.url)
  }" data-track-name="${escapeAttr(track.title)}" data-track-artist="${
    escapeAttr(artistId)
  }" data-track-number="${
    escapeAttr(String(track.trackNum))
  }"></tracklist-item-custom-element>
  `).join("");

  // Set up OG meta tags and page URL
  const baseUrl = new URL(req.url).origin;
  const pageUrl = `${baseUrl}/artists/${encodeURIComponent(artistId)}/albums/${
    encodeURIComponent(albumId)
  }`;
  const coverUrl = `${pageUrl}/cover`;
  const ogTitle = `${album.title} - ${pkg.name}`;
  const ogDescription = "Your audio where you want it.";
  const pathname = `/artists/${encodeURIComponent(artistId)}/albums/${
    encodeURIComponent(albumId)
  }`;

  const headExtra = `
  <meta property="og:type" content="website">
  <meta property="og:title" content="${escapeAttr(ogTitle)}">
  <meta property="og:description" content="${escapeAttr(ogDescription)}">
  <meta property="og:url" content="${escapeAttr(pageUrl)}">
  <meta property="og:image" content="${escapeAttr(coverUrl)}">
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
  </style>`;

  const mainContentHtml = `
  <album-header-custom-element data-album-url="${
    escapeAttr(albumUrl)
  }"></album-header-custom-element>

  <div class="album-page-main">
    <section class="tracklist">
      <h2 class="tracklist-title">Tracks</h2>
      <div id="tracklistContainer">${trackListHtml}</div>
    </section>
  </div>`;

  const { isAdmin } = getAdminAuthStatus(req);

  const html = renderPage(
    {
      appName: pkg.name,
      title: `${pkg.name} - ${albumId}`,
      description: ogDescription,
      headExtra,
      pathname,
      isAdmin,
      playbarAlbumUrl: albumUrl,
    },
    [mainContentHtml],
  );

  return new Response(html, {
    headers: { "Content-Type": "text/html" },
  });
}
