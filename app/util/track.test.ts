/** @file Tests for track utility functions */

import { assertEquals, assertRejects, assertThrows } from "@std/assert";
import {
  escapeHtml,
  getAllAlbumTracks,
  getParentDataFromTrackUrl,
  getRemainingAlbumTracks,
} from "./track.ts";

// Mock DOMParser for Deno test environment
if (typeof globalThis.DOMParser === "undefined") {
  globalThis.DOMParser = class DOMParser {
    parseFromString(xml: string, _type: string) {
      // Simple XML parser for test purposes
      // Extract keys from XML
      const keys: string[] = [];
      const keyRegex = /<Key>(.*?)<\/Key>/g;
      let match;
      while ((match = keyRegex.exec(xml)) !== null) {
        keys.push(match[1]);
      }

      // Create array-like object that works with Array.from()
      const contents = keys.map((key) => ({
        getElementsByTagName: (tag: string) => {
          if (tag === "Key") {
            // Return array-like object with textContent
            return [{ textContent: key }];
          }
          return [];
        },
      }));

      // Make it array-like for Array.from()
      contents.length = keys.length;

      return {
        getElementsByTagName: (tagName: string) => {
          if (tagName === "Contents") {
            return contents as unknown as HTMLCollectionOf<Element>;
          }
          return [] as unknown as HTMLCollectionOf<Element>;
        },
      } as unknown as Document;
    }
  } as unknown as typeof DOMParser;
}

// Mock fetch to return S3 XML response
let mockBucketContents: string[] = [];
let mockBucketContentsError: Error | null = null;

// Override fetch to return mock S3 responses
globalThis.fetch = ((_input: RequestInfo | URL, _init?: RequestInit) => {
  if (mockBucketContentsError) {
    throw mockBucketContentsError;
  }
  // Return a mock XML response matching S3 ListObjectsV2 format
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
${
    mockBucketContents.map((key) => `  <Contents><Key>${key}</Key></Contents>`)
      .join("\n")
  }
</ListBucketResult>`;
  return Promise.resolve(
    new Response(xml, {
      headers: { "Content-Type": "application/xml" },
    }),
  );
}) as typeof fetch;

function resetMocks() {
  mockBucketContents = [];
  mockBucketContentsError = null;
}

Deno.test("getParentDataFromTrackUrl - should parse valid track URL correctly", () => {
  const url = "https://bucket.s3.amazonaws.com/Artist/Album/01__Track Name.mp3";
  const result = getParentDataFromTrackUrl(url);

  assertEquals(result.artistName, "Artist");
  assertEquals(result.albumName, "Album");
  assertEquals(result.trackName, "Track Name.mp3");
  assertEquals(result.trackNumber, "01");
});

Deno.test("getParentDataFromTrackUrl - should return null values for null input", () => {
  const result = getParentDataFromTrackUrl(null);

  assertEquals(result.artistName, null);
  assertEquals(result.albumName, null);
  assertEquals(result.trackName, null);
  assertEquals(result.trackNumber, null);
});

Deno.test("getParentDataFromTrackUrl - should handle URLs with different formats", () => {
  const url =
    "https://bucket.s3.us-east-1.amazonaws.com/Artist Name/Album Name/05__Song Title.flac";
  const result = getParentDataFromTrackUrl(url);

  assertEquals(result.artistName, "Artist Name");
  assertEquals(result.albumName, "Album Name");
  assertEquals(result.trackName, "Song Title.flac");
  assertEquals(result.trackNumber, "05");
});

Deno.test("getParentDataFromTrackUrl - should handle URLs without proper structure", () => {
  const url = "https://example.com/track.mp3";
  assertThrows(
    () => getParentDataFromTrackUrl(url),
    Error,
    "Invalid track URL",
  );
});

Deno.test("escapeHtml - should escape HTML special characters", () => {
  assertEquals(
    escapeHtml("<script>alert('xss')</script>"),
    "&lt;script&gt;alert(&#039;xss&#039;)&lt;/script&gt;",
  );
});

Deno.test("escapeHtml - should escape ampersand", () => {
  assertEquals(escapeHtml("A & B"), "A &amp; B");
});

Deno.test("escapeHtml - should escape quotes", () => {
  assertEquals(escapeHtml('He said "hello"'), "He said &quot;hello&quot;");
});

Deno.test("escapeHtml - should escape single quotes", () => {
  assertEquals(escapeHtml("It's working"), "It&#039;s working");
});

Deno.test("escapeHtml - should escape angle brackets", () => {
  assertEquals(
    escapeHtml("<div>content</div>"),
    "&lt;div&gt;content&lt;/div&gt;",
  );
});

Deno.test("escapeHtml - should handle empty string", () => {
  assertEquals(escapeHtml(""), "");
});

Deno.test("escapeHtml - should handle string with no special characters", () => {
  assertEquals(escapeHtml("plain text"), "plain text");
});

Deno.test("getRemainingAlbumTracks - should return remaining tracks after current track", async () => {
  resetMocks();
  mockBucketContents = [
    "Artist/Album/1__Track One.mp3",
    "Artist/Album/2__Track Two.mp3",
    "Artist/Album/3__Track Three.mp3",
  ];

  const tracks = await getRemainingAlbumTracks(
    "https://bucket.s3.amazonaws.com/Artist/Album",
    "https://bucket.s3.amazonaws.com/Artist/Album/1__Track One.mp3",
  );

  assertEquals(tracks.length, 2);
  assertEquals(tracks[0].title, "Track Two.mp3");
  assertEquals(tracks[0].trackNum, 2);
  assertEquals(tracks[1].title, "Track Three.mp3");
  assertEquals(tracks[1].trackNum, 3);
});

Deno.test("getRemainingAlbumTracks - should return empty array if no remaining tracks", async () => {
  resetMocks();
  mockBucketContents = ["Artist/Album/1__Track One.mp3"];

  const tracks = await getRemainingAlbumTracks(
    "https://bucket.s3.amazonaws.com/Artist/Album",
    "https://bucket.s3.amazonaws.com/Artist/Album/1__Track One.mp3",
  );

  assertEquals(tracks.length, 0);
});

Deno.test("getRemainingAlbumTracks - should return empty array if artist/album cannot be parsed", async () => {
  resetMocks();

  const tracks = await getRemainingAlbumTracks(
    "https://bucket.s3.amazonaws.com/Artist/Album",
    "https://bucket.s3.amazonaws.com/invalid",
  );

  assertEquals(tracks.length, 0);
});

Deno.test("getRemainingAlbumTracks - should handle S3 API errors", async () => {
  resetMocks();
  mockBucketContentsError = new Error("S3 API Error");

  await assertRejects(
    async () => {
      await getRemainingAlbumTracks(
        "https://bucket.s3.amazonaws.com/Artist/Album",
        "https://bucket.s3.amazonaws.com/Artist/Album/1__Track One.mp3",
      );
    },
    Error,
    "S3 API Error",
  );
});

Deno.test("getRemainingAlbumTracks - should match tracks with single underscore", async () => {
  resetMocks();
  mockBucketContents = [
    "Artist/Album/1__Track One.mp3",
    "Artist/Album/2__Track Two.mp3",
  ];

  // Current track uses single underscore (should match double underscore in bucket)
  const tracks = await getRemainingAlbumTracks(
    "https://bucket.s3.amazonaws.com/Artist/Album",
    "https://bucket.s3.amazonaws.com/Artist/Album/1_Track One.mp3",
  );

  assertEquals(tracks.length, 1);
});

Deno.test("getRemainingAlbumTracks - should match tracks without file extension", async () => {
  resetMocks();
  mockBucketContents = [
    "Artist/Album/1__Track One.mp3",
    "Artist/Album/2__Track Two.mp3",
  ];

  // Current track without extension
  const tracks = await getRemainingAlbumTracks(
    "https://bucket.s3.amazonaws.com/Artist/Album",
    "https://bucket.s3.amazonaws.com/Artist/Album/1__Track One",
  );

  assertEquals(tracks.length, 1);
});

Deno.test("getRemainingAlbumTracks - should handle URL-encoded track names", async () => {
  resetMocks();
  mockBucketContents = [
    "Artist/Album/1__Track%20One.mp3",
    "Artist/Album/2__Track Two.mp3",
  ];

  const tracks = await getRemainingAlbumTracks(
    "https://bucket.s3.amazonaws.com/Artist/Album",
    "https://bucket.s3.amazonaws.com/Artist/Album/1__Track One.mp3",
  );

  assertEquals(tracks.length > 0, true);
});

Deno.test("getRemainingAlbumTracks - should sort tracks by track number", async () => {
  resetMocks();
  mockBucketContents = [
    "Artist/Album/1__Track One.mp3",
    "Artist/Album/2__Track Two.mp3",
    "Artist/Album/3__Track Three.mp3",
  ];

  const tracks = await getRemainingAlbumTracks(
    "https://bucket.s3.amazonaws.com/Artist/Album",
    "https://bucket.s3.amazonaws.com/Artist/Album/1__Track One.mp3",
  );

  assertEquals(tracks.length, 2);
  assertEquals(tracks[0].trackNum < tracks[1].trackNum, true);
});

Deno.test("getAllAlbumTracks - should return all tracks in album", async () => {
  resetMocks();
  mockBucketContents = [
    "Artist/Album/1__Track One.mp3",
    "Artist/Album/2__Track Two.mp3",
    "Artist/Album/3__Track Three.mp3",
  ];

  const tracks = await getAllAlbumTracks(
    "https://bucket.s3.amazonaws.com/Artist/Album",
    "https://bucket.s3.amazonaws.com/Artist/Album/1__Track One.mp3",
  );

  assertEquals(tracks.length, 3);
  assertEquals(tracks[0].trackNum, 1);
  assertEquals(tracks[1].trackNum, 2);
  assertEquals(tracks[2].trackNum, 3);
});

Deno.test("getAllAlbumTracks - should return empty array if artist/album cannot be parsed", async () => {
  resetMocks();

  const tracks = await getAllAlbumTracks(
    "https://bucket.s3.amazonaws.com/Artist/Album",
    "https://bucket.s3.amazonaws.com/invalid",
  );

  assertEquals(tracks.length, 0);
});

Deno.test("getAllAlbumTracks - should handle S3 API errors gracefully", async () => {
  resetMocks();
  mockBucketContentsError = new Error("S3 API Error");

  const tracks = await getAllAlbumTracks(
    "https://bucket.s3.amazonaws.com/Artist/Album",
    "https://bucket.s3.amazonaws.com/Artist/Album/1__Track One.mp3",
  );

  assertEquals(tracks.length, 0);
});

Deno.test("getAllAlbumTracks - should sort tracks by track number", async () => {
  resetMocks();
  mockBucketContents = [
    "Artist/Album/3__Track Three.mp3",
    "Artist/Album/1__Track One.mp3",
    "Artist/Album/2__Track Two.mp3",
  ];

  const tracks = await getAllAlbumTracks(
    "https://bucket.s3.amazonaws.com/Artist/Album",
    "https://bucket.s3.amazonaws.com/Artist/Album/1__Track One.mp3",
  );

  assertEquals(tracks[0].trackNum, 1);
  assertEquals(tracks[1].trackNum, 2);
  assertEquals(tracks[2].trackNum, 3);
});

Deno.test("getAllAlbumTracks - should handle tracks without track numbers", async () => {
  resetMocks();
  mockBucketContents = [
    "Artist/Album/invalid__Track.mp3",
    "Artist/Album/1__Track One.mp3",
  ];

  const tracks = await getAllAlbumTracks(
    "https://bucket.s3.amazonaws.com/Artist/Album",
    "https://bucket.s3.amazonaws.com/Artist/Album/1__Track One.mp3",
  );

  // Should still return tracks, with 0 for invalid track numbers
  assertEquals(tracks.length > 0, true);
});
