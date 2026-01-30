import { getUploadedFiles } from "../../app/util/s3.server.ts";
import { getAlbum, sortTracksByTrackNumber } from "../../app/util/files.ts";
import pkg from "../../deno.json" with { type: "json" };
import { createAlbumUrl } from "../../lib/album.ts";
import { createLogger } from "../../app/util/logger.ts";

const logger = createLogger("Album HTML");

export async function handleAlbumHtml(
  _req: Request,
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

  const trackListHtml = tracks.map((track) => `
    <tracklist-item-custom-element data-track-url="${track.url}" data-track-name="${track.title}" data-track-artist="${artistId}" data-track-number="${track.trackNum}"></tracklist-item-custom-element>
  `).join("");

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${pkg.name} - ${albumId}</title>
  <meta name="description" content="Your audio where you want it.">
  <link rel="stylesheet" href="/app.css">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #121212;
      color: #fff;
      min-height: 200vh;
    }

    .album-header {
      position: sticky;
      top: 0;
      z-index: 100;
      background: linear-gradient(to bottom, #3a1c5c, #1a1a2e);
      padding: 24px;
      transition: padding 0.15s ease-out;
      will-change: padding;
    }

    .album-header.shrunk {
      padding: 12px 24px;
    }

    .album-content {
      display: flex;
      gap: 16px;
      align-items: flex-end;
    }

    .album-art {
      width: 120px;
      height: 120px;
      border-radius: 8px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      flex-shrink: 0;
      transition: width 0.15s ease-out, height 0.15s ease-out;
      font-size: 48px;
    }

    .album-header.shrunk .album-art {
      width: 56px;
      height: 56px;
      font-size: 24px;
    }

    .album-info {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
    }

    .album-label {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: rgba(255, 255, 255, 0.7);
      transition: font-size 0.15s ease-out;
    }

    .album-header.shrunk .album-label {
      font-size: 10px;
    }

    .album-title {
      font-size: 32px;
      font-weight: 700;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      transition: font-size 0.15s ease-out;
    }

    .album-header.shrunk .album-title {
      font-size: 18px;
    }

    .album-artist {
      font-size: 14px;
      color: rgba(255, 255, 255, 0.7);
      transition: font-size 0.15s ease-out;
    }

    .album-header.shrunk .album-artist {
      font-size: 12px;
    }

    .album-meta {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.5);
      margin-top: 4px;
      transition: opacity 0.15s ease-out, height 0.15s ease-out;
    }

    .album-header.shrunk .album-meta {
      opacity: 0;
      height: 0;
      margin: 0;
      overflow: hidden;
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

  <section class="tracklist">
    <h2 class="tracklist-title">Tracks</h2>
    <div id="tracklistContainer">${trackListHtml}</div>
  </section>

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
