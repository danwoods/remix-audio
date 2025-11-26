import assert from "node:assert";
import { describe, it } from "vitest";
import { getAlbum } from "./files.ts";

describe("track organization methods", () => {
  it("getAlbum", () => {
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

    assert.equal(getAlbum(files, "artist1/album1"), album1);
  });
});
