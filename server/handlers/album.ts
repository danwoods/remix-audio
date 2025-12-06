/** @file Album detail route handler */
import { renderPage } from "../ssr.tsx";
import AlbumPage from "../../app/routes/artists.$artistId.albums.$albumId_.tsx";
import { getUploadedFiles } from "../../app/util/s3.server.ts";

export async function handleAlbum(
  req: Request,
  params: Record<string, string>,
): Promise<Response> {
  const { artistId, albumId } = params;

  if (!artistId || !albumId) {
    return new Response("Missing artist or album ID", { status: 400 });
  }

  const files = await getUploadedFiles();
  const url = new URL(req.url);
  const pathname = url.pathname;

  const html = await renderPage(
    AlbumPage,
    { artistId, albumId, files },
    { files, headLinks: [], pathname },
  );

  return new Response(html, {
    headers: { "Content-Type": "text/html" },
  });
}
