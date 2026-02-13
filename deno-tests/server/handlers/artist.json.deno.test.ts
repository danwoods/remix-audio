/** @file Tests for artist JSON data handler */
import { assertEquals } from "@std/assert";
import { handleArtistJsonData } from "../../../server/handlers/artist.json.ts";
import { setSendBehavior } from "../s3.server.test-mocks/s3-client.ts";
import { getUploadedFiles } from "../../../app/util/s3.server.ts";

function setupStorageEnv(): void {
  Deno.env.set("AWS_ACCESS_KEY_ID", "test-key");
  Deno.env.set("AWS_SECRET_ACCESS_KEY", "test-secret");
  Deno.env.set("STORAGE_REGION", "test-region");
  Deno.env.set("STORAGE_BUCKET", "test-bucket");
}

Deno.test("Artist JSON handler returns versioned scoped data", async () => {
  setupStorageEnv();
  setSendBehavior((command: unknown) => {
    const name = (command as { constructor: { name: string } }).constructor
      ?.name;
    if (name === "ListObjectsV2Command") {
      return Promise.resolve({
        Contents: [
          {
            Key: "Test%20Artist/Test%20Album/1__Intro.mp3",
            LastModified: new Date("2026-01-01T00:00:00.000Z"),
          },
          {
            Key: "Test%20Artist/Another%20Album/1__Second.mp3",
            LastModified: new Date("2026-01-02T00:00:00.000Z"),
          },
          {
            Key: "Other%20Artist/Other%20Album/1__Elsewhere.mp3",
            LastModified: new Date("2026-01-03T00:00:00.000Z"),
          },
        ],
        IsTruncated: false,
      });
    }
    return Promise.resolve({});
  });
  await getUploadedFiles(true);

  const req = new Request("http://localhost:8000/artists/Test%20Artist/_json");
  const response = await handleArtistJsonData(req, {
    artistId: "Test Artist",
  });

  assertEquals(response.status, 200);
  assertEquals(response.headers.get("Content-Type"), "application/json");

  const body = await response.json();
  assertEquals(body.dataFormatVersion, "1.0.0");
  assertEquals(body.scope.level, "artist");
  assertEquals(body.scope.artistId, "Test Artist");
  assertEquals(body.data.artists.length, 1);
  assertEquals(body.data.artists[0].id, "Test Artist");
  assertEquals(body.data.artists[0].albums.length, 2);
  assertEquals(body.data.totals.artists, 1);
  assertEquals(body.data.totals.albums, 2);
  assertEquals(body.data.totals.tracks, 2);
});

Deno.test("Artist JSON handler returns 404 when artist does not exist", async () => {
  setupStorageEnv();
  setSendBehavior((command: unknown) => {
    const name = (command as { constructor: { name: string } }).constructor
      ?.name;
    if (name === "ListObjectsV2Command") {
      return Promise.resolve({
        Contents: [],
        IsTruncated: false,
      });
    }
    return Promise.resolve({});
  });
  await getUploadedFiles(true);

  const req = new Request("http://localhost:8000/artists/Unknown/_json");
  const response = await handleArtistJsonData(req, {
    artistId: "Unknown",
  });

  assertEquals(response.status, 404);
  assertEquals(await response.text(), "Artist not found");
});
