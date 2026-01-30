/** @file Tests for album cover route handler */
import { assertEquals } from "@std/assert";
import { decodeDataUrl } from "../../../app/util/data-url.ts";
import {
  getKeyFromTrackUrl,
  handleAlbumCover,
} from "../../../server/handlers/album.cover.ts";

Deno.test("Album cover handler returns 400 when artistId is missing", async () => {
  const req = new Request(
    "http://localhost:8000/artists//albums/SomeAlbum/cover",
  );
  const response = await handleAlbumCover(req, {
    artistId: "",
    albumId: "SomeAlbum",
  });
  assertEquals(response.status, 400);
  const text = await response.text();
  assertEquals(text, "Missing artist or album ID");
});

Deno.test("Album cover handler returns 400 when albumId is missing", async () => {
  const req = new Request(
    "http://localhost:8000/artists/SomeArtist/albums//cover",
  );
  const response = await handleAlbumCover(req, {
    artistId: "SomeArtist",
    albumId: "",
  });
  assertEquals(response.status, 400);
  const text = await response.text();
  assertEquals(text, "Missing artist or album ID");
});

Deno.test("decodeDataUrl returns body and contentType for valid data URL", () => {
  const dataUrl = "data:image/jpeg;base64,/9j/4AAQ";
  const result = decodeDataUrl(dataUrl);
  assertEquals(result !== null, true);
  if (result) {
    assertEquals(result.contentType, "image/jpeg");
    assertEquals(result.body instanceof Uint8Array, true);
    assertEquals(result.body.length > 0, true);
  }
});

Deno.test("getKeyFromTrackUrl extracts S3 key from track URL", () => {
  const url =
    "https://my-bucket.s3.us-east-1.amazonaws.com/Artist%20Name/Album%20Name/1__Song.mp3";
  const key = getKeyFromTrackUrl(url);
  assertEquals(key, "Artist Name/Album Name/1__Song.mp3");
});

Deno.test("decodeDataUrl returns null for invalid data URL", () => {
  assertEquals(decodeDataUrl("not-a-data-url"), null);
  assertEquals(decodeDataUrl("data:image/jpeg;base64,!!"), null); // invalid base64
});
