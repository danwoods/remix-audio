/** @file Tests for files utility - getAlbum (co-located); see deno-tests for full coverage */
import { assertEquals } from "@std/assert";
import { getAlbum } from "./files.ts";

Deno.test("track organization methods", async (t) => {
  await t.step("getAlbum", () => {
    const album1 = {
      id: "artist1/album1",
      title: "album1",
      coverArt: null,
      tracks: [
        {
          title: "track1",
          url: "https://example.com/track1.mp3",
          trackNum: 1,
          lastModified: null,
        },
      ],
    };
    const files = {
      artist1: {
        album1,
      },
    };

    assertEquals(getAlbum(files, "artist1/album1"), album1);
  });
});
