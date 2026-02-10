/** @file Tests for album tile HTML function */
import { assert, assertStringIncludes } from "@std/assert";
import type { Files } from "../../util/files.ts";
import albumTileHtml from "./album-tile-html.ts";

function makeFiles(artistId: string, albumId: string): Files {
  const id = `${artistId}/${albumId}`;
  return {
    [artistId]: {
      [albumId]: {
        id,
        title: albumId,
        coverArt: "",
        tracks: [
          {
            url:
              `https://bucket.s3.region.amazonaws.com/${artistId}/${albumId}/1__Track.mp3`,
            title: "Track",
            trackNum: 1,
            lastModified: null,
          },
        ],
      },
    },
  };
}

Deno.test("albumTileHtml uses nav-link with correct href for artist/album", () => {
  const files = makeFiles("Test Artist", "Test Album");
  const html = albumTileHtml({ albumId: "Test Artist/Test Album", files });

  assert(html.includes("<nav-link href="), "Output should use nav-link");
  assertStringIncludes(
    html,
    'href="/artists/Test%20Artist/albums/Test%20Album"',
    "href should be encoded artist/album path",
  );
  assertStringIncludes(html, "Test Album");
  assertStringIncludes(html, "Test Artist");
});
