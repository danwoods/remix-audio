/** @file Index page route handler */
import { renderPage } from "../ssr-plain.ts";
import { getUploadedFiles } from "../../app/util/s3.server.ts";

import albumRowWithTitleHtml from "../../app/components/AlbumRow/album-row-with-title-html.ts";
import { getAlbumIdsByRecent } from "../../app/util/files.ts";
import pkg from "../../deno.json" with { type: "json" };

/** Index page route handler */
export async function handleIndexHtml(
  _req: Request,
  _params: Record<string, string>,
): Promise<Response> {
  const files = await getUploadedFiles();
  const recentlyUploadedAlbumIds = getAlbumIdsByRecent(files).slice(0, 5);

  const recentlyListenedToAlbumIds = [
    { id: "Childish Gambino/Poindexter" },
    { id: "Girl Talk/All Day" },
    { id: "Pearl Jam/Vitalogy (Expanded Edition)" },
    { id: "The Rolling Stones/Let It Bleed" },
    { id: "The Black Keys/Ohio Players" },
  ];

  const mostListenedToAlbumIds = [
    { id: "Pearl Jam/Dark Matter" },
    { id: "Run The Jewels/RTJ4" },
    { id: "Pink Floyd/Wish You Were Here" },
    { id: "Wu-Tang Clan/Enter The Wu-Tang: 36 Chambers" },
    { id: "The Rolling Stones/Exile On Main St." },
  ];

  const html = renderPage(
    {
      appName: pkg.name,
      headLinks: [],
      assets: { css: "", js: "" },
    },
    [
      albumRowWithTitleHtml({
        albumIds: recentlyListenedToAlbumIds,
        files: files,
        title: "Continue Listening",
      }),
      albumRowWithTitleHtml({
        albumIds: recentlyUploadedAlbumIds,
        files: files,
        title: "Latest",
      }),
      albumRowWithTitleHtml({
        albumIds: mostListenedToAlbumIds,
        files: files,
        title: "Favorites",
      }),
    ],
  );

  return new Response(html, {
    headers: { "Content-Type": "text/html" },
  });
}
