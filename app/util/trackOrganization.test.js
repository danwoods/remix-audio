import assert from "node:assert";
import { describe, it } from "node:test";
import { getAlbum } from "./trackOrganization.ts";

describe("track organization methods", () => {
  it("getAlbum", () => {
    const album1 = [{ title: "track1" }];
    const files = {
      artist1: {
        album1,
      },
    };

    assert.equal(getAlbum(files, "artist1/album1"), album1);
  });
});
