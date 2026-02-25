/** @file Tests for shared track metadata derivation helpers. */

import { assertEquals } from "@std/assert";
import {
  createTrackMetadataDeriver,
  parseTrackMetadataFromUrlText,
} from "./track-metadata.ts";

Deno.test(
  "parseTrackMetadataFromUrlText - parses __ format and keeps extension",
  () => {
    const parsed = parseTrackMetadataFromUrlText(
      "https://bucket.s3.amazonaws.com/Artist/Album/01__Track Name.mp3",
    );

    assertEquals(parsed.artist, "Artist");
    assertEquals(parsed.album, "Album");
    assertEquals(parsed.title, "Track Name.mp3");
    assertEquals(parsed.trackNumber, 1);
    assertEquals(parsed.trackNumberText, "01");
    assertEquals(
      parsed.albumUrl,
      "https://bucket.s3.amazonaws.com/Artist/Album",
    );
  },
);

Deno.test(
  "parseTrackMetadataFromUrlText - keeps full filename when no extension present",
  () => {
    const parsed = parseTrackMetadataFromUrlText(
      "https://bucket.s3.amazonaws.com/Artist/Album/01__Track Name",
    );

    assertEquals(parsed.artist, "Artist");
    assertEquals(parsed.album, "Album");
    assertEquals(parsed.title, "Track Name");
    assertEquals(parsed.trackNumber, 1);
    assertEquals(parsed.trackNumberText, "01");
  },
);

Deno.test(
  "deriveTrackMetadata - skipId3 bypasses ID3 reads and returns URL fallback",
  async () => {
    let id3Calls = 0;
    const deriver = createTrackMetadataDeriver(
      () =>
        Promise.resolve((_url: string) => {
          id3Calls++;
          return {
            artist: "ID3 Artist",
            album: "ID3 Album",
            title: "ID3 Title",
            trackNumber: 9,
          };
        }),
    );

    const metadata = await deriver.deriveTrackMetadata(
      "https://bucket.s3.amazonaws.com/Artist/Album/02__Fallback Title.mp3",
      { skipId3: true },
    );

    assertEquals(id3Calls, 0);
    assertEquals(metadata.artist, "Artist");
    assertEquals(metadata.album, "Album");
    assertEquals(metadata.title, "Fallback Title.mp3");
    assertEquals(metadata.trackNumber, 2);
  },
);

Deno.test(
  "deriveTrackMetadata - merges partial ID3 fields with URL fallback per field",
  async () => {
    const deriver = createTrackMetadataDeriver(
      () =>
        Promise.resolve((_url: string) => {
          return {
            artist: "ID3 Artist",
            album: "",
            title: "Unknown",
            track: "07/12",
          };
        }),
    );

    const metadata = await deriver.deriveTrackMetadata(
      "https://bucket.s3.amazonaws.com/Artist/Album/03__Fallback Title.mp3",
    );

    assertEquals(metadata.artist, "ID3 Artist");
    assertEquals(metadata.album, "Album");
    assertEquals(metadata.title, "Fallback Title.mp3");
    assertEquals(metadata.trackNumber, 7);
  },
);

Deno.test(
  "deriveTrackMetadata - caches ID3-derived data by URL",
  async () => {
    let id3Calls = 0;
    const deriver = createTrackMetadataDeriver(
      () =>
        Promise.resolve((_url: string) => {
          id3Calls++;
          return {
            artist: "Cached Artist",
            album: "Cached Album",
            title: "Cached Title",
            trackNumber: 11,
          };
        }),
    );

    const url =
      "https://bucket.s3.amazonaws.com/Artist/Album/11__Fallback Title.mp3";
    const first = await deriver.deriveTrackMetadata(url);
    const second = await deriver.deriveTrackMetadata(url);

    assertEquals(id3Calls, 1);
    assertEquals(first.title, "Cached Title");
    assertEquals(second.title, "Cached Title");
  },
);

Deno.test(
  "deriveTrackMetadata - does not cache when ID3 has no usable values",
  async () => {
    let id3Calls = 0;
    const deriver = createTrackMetadataDeriver(
      () =>
        Promise.resolve((_url: string) => {
          id3Calls++;
          return {
            artist: "Unknown",
            album: "",
            title: "Unknown",
            trackNumber: 0,
          };
        }),
    );

    const url =
      "https://bucket.s3.amazonaws.com/Artist/Album/04__Fallback Title.mp3";
    const first = await deriver.deriveTrackMetadata(url);
    const second = await deriver.deriveTrackMetadata(url);

    assertEquals(id3Calls, 2);
    assertEquals(first.title, "Fallback Title.mp3");
    assertEquals(second.title, "Fallback Title.mp3");
  },
);
