/** @file Tests for album tile HTML function.
 *
 * Uses linkedom to parse the returned HTML and assert on DOM structure
 * (nav-link, album-image-custom-element, text content).
 */

import { assertEquals, assertExists } from "@std/assert";
import { parseHTML } from "linkedom";
import type { Files } from "../../util/files.ts";
import albumTileHtml from "./album-tile-html.ts";

// ============================================================================
// TEST HELPERS
// ============================================================================

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

/** Parses an HTML string into a document for DOM-based assertions. */
function parseHtmlFragment(html: string): Document {
  const { document } = parseHTML(
    `<!DOCTYPE html><html><head></head><body>${html}</body></html>`,
    "http://localhost:8000/",
  );
  return document;
}

// ============================================================================
// TESTS
// ============================================================================

Deno.test(
  "albumTileHtml uses nav-link with correct href for artist/album",
  () => {
    const files = makeFiles("Test Artist", "Test Album");
    const html = albumTileHtml({ albumId: "Test Artist/Test Album", files });

    const document = parseHtmlFragment(html);
    const navLink = document.querySelector("nav-link");
    const albumImage = document.querySelector("album-image-custom-element");

    assertExists(navLink, "Output should use nav-link");
    assertEquals(
      navLink.getAttribute("href"),
      "/artists/Test%20Artist/albums/Test%20Album",
      "href should be encoded artist/album path",
    );

    assertExists(albumImage, "Output should use album-image-custom-element");
    assertEquals(
      albumImage.getAttribute("data-album-url"),
      "https://bucket.s3.region.amazonaws.com/Test Artist/Test Album",
      "data-album-url should point to album folder",
    );

    const text = document.body?.textContent ?? "";
    assertEquals(
      text.includes("Test Album"),
      true,
      "Output should include album name",
    );
    assertEquals(
      text.includes("Test Artist"),
      true,
      "Output should include artist name",
    );
  },
);
