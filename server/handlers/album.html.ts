import { getUploadedFiles } from "../../app/util/s3.server.ts";
import { getAlbum, sortTracksByTrackNumber } from "../../app/util/files.ts";
import pkg from "../../deno.json" with { type: "json" };
import { createAlbumUrl } from "../../lib/album.ts";

export async function handleAlbumHtml(
  _req: Request,
  params: Record<string, string>,
): Promise<Response> {
  const { artistId, albumId } = params;

  if (!artistId || !albumId) {
    return new Response("Missing artist or album ID", { status: 400 });
  }

  const files = await getUploadedFiles();
  const album = getAlbum(files, `${artistId}/${albumId}`);

  if (!album) {
    return new Response("Album not found", { status: 404 });
  }

  const tracks = [...album.tracks].sort(sortTracksByTrackNumber);

  const albumUrl = createAlbumUrl(
    Deno.env.get("STORAGE_BUCKET")!,
    Deno.env.get("STORAGE_REGION")!,
    artistId,
    albumId,
  );

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${pkg.name} - ${albumId}</title>
  <meta name="description" content="Your audio where you want it.">
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

    .page-title {
      padding: 20px 24px;
      font-size: 14px;
      font-weight: 600;
      color: #fff;
      background: #121212;
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

    .track {
      display: flex;
      align-items: center;
      padding: 12px 16px;
      border-radius: 8px;
      margin-bottom: 4px;
      transition: background 0.2s;
    }

    .track:hover {
      background: rgba(255, 255, 255, 0.1);
    }

    .track-number {
      width: 32px;
      font-size: 14px;
      color: rgba(255, 255, 255, 0.5);
    }

    .track-info {
      flex: 1;
      min-width: 0;
    }

    .track-name {
      font-size: 15px;
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .track-artist {
      font-size: 13px;
      color: rgba(255, 255, 255, 0.5);
    }

    .track-duration {
      font-size: 13px;
      color: rgba(255, 255, 255, 0.5);
      margin-left: 16px;
    }
  </style>
</head>
<body>
  <div class="page-title">${pkg.name}</div>
  
  <album-header-custom-element data-album-url="${albumUrl}"></album-header-custom-element>

  <section class="tracklist">
    <h2 class="tracklist-title">Tracks</h2>
    <div id="tracklistContainer"></div>
  </section>


  <script>
    const albumHeader = document.getElementById('albumHeader');
    const tracklistContainer = document.getElementById('tracklistContainer');

    const tracks = [${
    tracks.map((track) =>
      `{ name: "${track.title}", artist: "${artistId}", duration: "0:00" }`
    ).join(",\n")
  }];

    tracks.forEach((track, index) => {
      const trackEl = document.createElement('div');
      trackEl.className = 'track';
      trackEl.innerHTML = \`
        <span class="track-number">\${index + 1}</span>
        <div class="track-info">
          <div class="track-name">\${track.name}</div>
          <div class="track-artist">\${track.artist}</div>
        </div>
        <span class="track-duration">\${track.duration}</span>
      \`;
      tracklistContainer.appendChild(trackEl);
    });
  </script>
  <script type="module" src="/build/main.js"></script>
</body>
</html>
`;

  return new Response(html, {
    headers: { "Content-Type": "text/html" },
  });
}
