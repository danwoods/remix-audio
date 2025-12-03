/** @file Index page route handler */
import { renderPage } from "../ssr-plain.ts";
import { getUploadedFiles } from "../../app/util/s3.server.ts";

import albumRowWithTitleHtml from "../../app/components/AlbumRow/album-row-with-title-html.ts";

/** Index page route handler */
export async function handleIndexHtml(
  _req: Request,
  _params: Record<string, string>,
): Promise<Response> {
  const files = await getUploadedFiles();

  const recentlyListenedToAlbumIds = [
    { id: "Childish Gambino/Poindexter" },
    { id: "Girl Talk/All Day" },
    { id: "Pearl Jam/Vitalogy (Expanded Edition)" },
    { id: "The Rolling Stones/Let It Bleed" },
    { id: "The Black Keys/Ohio Players" },
  ];

  const html = renderPage(
    {
      appName: "Album Cover",
      headLinks: [],
      assets: { css: "", js: "" },
    },
    [
      await albumRowWithTitleHtml({
        albumIds: recentlyListenedToAlbumIds,
        files: files,
        title: "Continue Listening",
      }),
    ],
  );

  return new Response(html, {
    headers: { "Content-Type": "text/html" },
  });
}
