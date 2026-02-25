/** @file Tests for lib/album.ts */
import { assertEquals } from "@std/assert";
import {
  createAlbumUrl,
  getAlbumContents,
  getFirstSong,
} from "../../lib/album.ts";

if (typeof globalThis.DOMParser === "undefined") {
  globalThis.DOMParser = class DOMParser {
    parseFromString(xml: string, _type: string): Document {
      const keys: string[] = [];
      const keyRegex = /<Key>(.*?)<\/Key>/g;
      let match: RegExpExecArray | null;
      while ((match = keyRegex.exec(xml)) !== null) {
        keys.push(match[1]);
      }
      const contents = keys.map((key) => ({
        getElementsByTagName: (tag: string) =>
          tag === "Key" ? [{ textContent: key }] : [],
      }));
      return {
        getElementsByTagName: (tagName: string) =>
          tagName === "Contents"
            ? contents as unknown as HTMLCollectionOf<Element>
            : [] as unknown as HTMLCollectionOf<Element>,
      } as unknown as Document;
    }
  } as unknown as typeof DOMParser;
}

Deno.test("createAlbumUrl builds canonical S3 album URL", () => {
  const albumUrl = createAlbumUrl(
    "music-bucket",
    "eu-west-1",
    "The Artist",
    "Great Album",
  );

  assertEquals(
    albumUrl,
    "https://music-bucket.s3.eu-west-1.amazonaws.com/The Artist/Great Album",
  );
});

Deno.test("getAlbumContents caches repeated requests for same album", async () => {
  const originalFetch = globalThis.fetch;
  try {
    let fetchCalls = 0;
    globalThis.fetch = (() => {
      fetchCalls += 1;
      return Promise.resolve(
        new Response(
          [
            '<?xml version="1.0" encoding="UTF-8"?>',
            "<ListBucketResult>",
            "  <Contents><Key>Artist Cache/Album Cache/1__Song.mp3</Key></Contents>",
            "</ListBucketResult>",
          ].join("\n"),
        ),
      );
    }) as typeof fetch;

    const first = await getAlbumContents(
      "https://cache-test.s3.us-east-1.amazonaws.com",
      "Artist Cache",
      "Album Cache",
    );
    const second = await getAlbumContents(
      "https://cache-test.s3.us-east-1.amazonaws.com",
      "Artist Cache",
      "Album Cache",
    );

    assertEquals(first, ["Artist Cache/Album Cache/1__Song.mp3"]);
    assertEquals(second, ["Artist Cache/Album Cache/1__Song.mp3"]);
    assertEquals(fetchCalls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("getFirstSong filters non-song entries and returns first sorted song", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = (() =>
      Promise.resolve(
        new Response(
          [
            '<?xml version="1.0" encoding="UTF-8"?>',
            "<ListBucketResult>",
            "  <Contents><Key>Artist Sort/Album Sort/cover.jpeg</Key></Contents>",
            "  <Contents><Key>Artist Sort/Album Sort/disc1/</Key></Contents>",
            "  <Contents><Key>Artist Sort/Album Sort/02__B Song.mp3</Key></Contents>",
            "  <Contents><Key>Artist Sort/Album Sort/01__A Song.mp3</Key></Contents>",
            "</ListBucketResult>",
          ].join("\n"),
        ),
      )) as typeof fetch;

    const firstSong = await getFirstSong(
      "https://first-song-test.s3.us-east-1.amazonaws.com",
      "Artist Sort",
      "Album Sort",
    );

    assertEquals(firstSong, "Artist Sort/Album Sort/01__A Song.mp3");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
