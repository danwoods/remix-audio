/** @file Server-suite tests for shared track metadata derivation. */

import { assertEquals } from "@std/assert";
import { setGetID3TagsReturn } from "./server/s3.server.test-mocks/id3.ts";
import {
  clearTrackMetadataCache,
  createTrackMetadataDeriver,
  deriveTrackMetadata,
  parseTrackMetadataFromUrlText,
} from "../app/util/track-metadata.ts";

Deno.test(
  "deriveTrackMetadata - server runtime uses ID3 tags and caches by URL",
  async () => {
    clearTrackMetadataCache();
    setGetID3TagsReturn({
      artist: "Server Artist",
      album: "Server Album",
      title: "Server Title",
      trackNumber: 8,
    });

    const trackUrl =
      "https://bucket.s3.amazonaws.com/Artist/Album/08__Fallback Title.mp3";
    const first = await deriveTrackMetadata(trackUrl);
    assertEquals(first.artist, "Server Artist");
    assertEquals(first.album, "Server Album");
    assertEquals(first.title, "Server Title");
    assertEquals(first.trackNumber, 8);

    // Should keep cached ID3 values for this URL.
    setGetID3TagsReturn({
      artist: "Different Artist",
      album: "Different Album",
      title: "Different Title",
      trackNumber: 99,
    });
    const second = await deriveTrackMetadata(trackUrl);
    assertEquals(second.artist, "Server Artist");
    assertEquals(second.album, "Server Album");
    assertEquals(second.title, "Server Title");
    assertEquals(second.trackNumber, 8);
  },
);

Deno.test(
  "deriveTrackMetadata - skipId3 returns URL text fallback on server",
  async () => {
    clearTrackMetadataCache();
    setGetID3TagsReturn({
      artist: "ID3 Artist",
      album: "ID3 Album",
      title: "ID3 Title",
      trackNumber: 77,
    });

    const metadata = await deriveTrackMetadata(
      "https://bucket.s3.amazonaws.com/Artist/Album/12__Fallback Track.mp3",
      { skipId3: true },
    );

    assertEquals(metadata.artist, "Artist");
    assertEquals(metadata.album, "Album");
    assertEquals(metadata.title, "Fallback Track");
    assertEquals(metadata.trackNumber, 12);
  },
);

Deno.test(
  "track metadata parser and deriver handle fallback/error branches",
  async () => {
    const malformed = parseTrackMetadataFromUrlText(
      "https://bucket.s3.amazonaws.com/Artist/Album/%E0%A4%A.mp3",
    );
    assertEquals(malformed.title, "%E0%A4%A");

    const invalid = parseTrackMetadataFromUrlText("not-a-valid-url");
    assertEquals(invalid.artist, "Unknown");
    assertEquals(invalid.album, "Unknown");
    assertEquals(invalid.albumUrl, null);

    const noReaderDeriver = createTrackMetadataDeriver(
      () => Promise.resolve(null),
    );
    const noReaderMetadata = await noReaderDeriver.deriveTrackMetadata("%%%");
    assertEquals(noReaderMetadata.title, "%%%");
    assertEquals(noReaderMetadata.trackNumber, 0);

    let nullRawCalls = 0;
    const nullRawDeriver = createTrackMetadataDeriver(
      () =>
        Promise.resolve(async (_url: string) => {
          nullRawCalls++;
          return null;
        }),
    );
    const nullRawUrl =
      "https://bucket.s3.amazonaws.com/Artist/Album/01__Fallback.mp3";
    const nullRawFirst = await nullRawDeriver.deriveTrackMetadata(nullRawUrl);
    const nullRawSecond = await nullRawDeriver.deriveTrackMetadata(nullRawUrl);
    assertEquals(nullRawCalls, 2);
    assertEquals(nullRawFirst.title, "Fallback");
    assertEquals(nullRawSecond.title, "Fallback");

    const partialDeriver = createTrackMetadataDeriver(
      () =>
        Promise.resolve(async (_url: string) => {
          return {
            artist: "Unknown",
            album: "",
            title: "ID3 Title",
            trackNumber: 0,
            image: "data:image/png;base64,abc",
          };
        }),
    );
    const merged = await partialDeriver.deriveTrackMetadata(
      "https://bucket.s3.amazonaws.com/Artist/Album/02__Fallback.mp3",
    );
    assertEquals(merged.artist, "Artist");
    assertEquals(merged.album, "Album");
    assertEquals(merged.title, "ID3 Title");
    assertEquals(merged.trackNumber, 2);
    assertEquals(merged.image, "data:image/png;base64,abc");
  },
);

Deno.test(
  "deriveTrackMetadata reuses in-flight ID3 read promises",
  async () => {
    let id3Calls = 0;
    let releaseRead: (() => void) | null = null;
    const readGate = new Promise<void>((resolve) => {
      releaseRead = resolve;
    });

    const deriver = createTrackMetadataDeriver(
      () =>
        Promise.resolve(async (_url: string) => {
          id3Calls++;
          await readGate;
          return {
            artist: "Inflight Artist",
            album: "Inflight Album",
            title: "Inflight Title",
            trackNumber: 3,
          };
        }),
    );

    const trackUrl =
      "https://bucket.s3.amazonaws.com/Artist/Album/03__Fallback.mp3";
    const firstPromise = deriver.deriveTrackMetadata(trackUrl);
    const secondPromise = deriver.deriveTrackMetadata(trackUrl);

    assertEquals(id3Calls, 1);
    releaseRead?.();

    const [first, second] = await Promise.all([firstPromise, secondPromise]);
    assertEquals(first.title, "Inflight Title");
    assertEquals(second.title, "Inflight Title");
    assertEquals(first.trackNumber, 3);
    assertEquals(second.trackNumber, 3);
  },
);
