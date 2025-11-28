/** @file Root route handler */
import { renderPage } from "../ssr.tsx";
import IndexPage from "../../app/routes/_index.tsx";
import { getUploadedFiles } from "../../app/util/s3.server.ts";
import { getAlbumIdsByRecent } from "../../app/util/files.ts";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function handleRoot(_req: Request): Promise<Response> {
  const files = await getUploadedFiles();
  const recentlyUploadedAlbumIds = getAlbumIdsByRecent(files).slice(0, 5);

  // Setup `head` links that are based on env vars
  const storageBucket = Deno.env.get("STORAGE_BUCKET");
  const storageRegion = Deno.env.get("STORAGE_REGION");
  const headLinks =
    storageBucket && storageRegion
      ? [
          {
            rel: "preconnect",
            href: `https://${storageBucket}.s3.${storageRegion}.amazonaws.com`,
          },
        ]
      : [];

  const html = await renderPage(
    IndexPage,
    { files, recentlyUploadedAlbumIds },
    { files, headLinks },
  );

  return new Response(html, {
    headers: { "Content-Type": "text/html" },
  });
}
