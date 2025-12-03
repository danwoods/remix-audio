/** @file Album detail route handler */
import { renderPage } from "../ssr-plain.ts";
import albumCoverHtml from "../../app/components/AlbumCover/album-cover-html.ts";
import { getUploadedFiles } from "../../app/util/s3.server.ts";
import { getAlbumArtAsDataUrl } from "../../app/util/files.ts";

/** Example route handler for plain HTML */
export async function handleAlbumCover(
  _req: Request,
  params: Record<string, string>,
): Promise<Response> {
  const { artistId, albumId } = params;

  if (!artistId || !albumId) {
    return new Response("Missing artist or album ID", { status: 400 });
  }

  const files = await getUploadedFiles();

  const albumArtUrl = await getAlbumArtAsDataUrl(
    files,
    `${artistId}/${albumId}`,
  );

  const html = await renderPage(
    { appName: "Album Cover", headLinks: [], assets: { css: "", js: "" } },
    albumCoverHtml({
      albumId: `${artistId}/${albumId}`,
      className: "w-32 h-32",
      alt: "Album cover",
      files: files,
      src: albumArtUrl || undefined,
    }),
  );

  return new Response(html, {
    headers: { "Content-Type": "text/html" },
  });
}
