/** @file Tests for album page route handler */
import { assertEquals, assertStringIncludes } from "@std/assert";
import { handleAlbumHtml } from "../../../server/handlers/album.html.ts";
import { setSendBehavior } from "../s3.server.test-mocks/s3-client.ts";
import { getUploadedFiles } from "../../../app/util/s3.server.ts";

function setupStorageEnv(): void {
  Deno.env.set("AWS_ACCESS_KEY_ID", "test-key");
  Deno.env.set("AWS_SECRET_ACCESS_KEY", "test-secret");
  Deno.env.set("STORAGE_REGION", "test-region");
  Deno.env.set("STORAGE_BUCKET", "test-bucket");
}

function mockFilesWithAlbum(): void {
  setSendBehavior((command: unknown) => {
    const name = (command as { constructor: { name: string } }).constructor
      ?.name;
    if (name === "ListObjectsV2Command") {
      return Promise.resolve({
        Contents: [
          {
            Key: "Test%20Artist/Test%20Album/1__Test%20Track.mp3",
            LastModified: new Date(),
          },
        ],
        IsTruncated: false,
      });
    }
    return Promise.resolve({});
  });
}

Deno.test("Album handler returns 400 when artistId is missing", async () => {
  setupStorageEnv();
  mockFilesWithAlbum();

  const req = new Request(
    "http://localhost:8000/artists//albums/SomeAlbum",
  );
  const response = await handleAlbumHtml(req, {
    artistId: "",
    albumId: "SomeAlbum",
  });
  assertEquals(response.status, 400);
  const text = await response.text();
  assertEquals(text, "Missing artist or album ID");
});

Deno.test("Album handler returns full HTML when no fragment header", async () => {
  setupStorageEnv();
  mockFilesWithAlbum();

  const req = new Request(
    "http://localhost:8000/artists/Test%20Artist/albums/Test%20Album",
  );
  const response = await handleAlbumHtml(req, {
    artistId: "Test Artist",
    albumId: "Test Album",
  });

  assertEquals(response.status, 200);
  assertEquals(response.headers.get("Content-Type"), "text/html");
  const html = await response.text();
  assertStringIncludes(html, "<!DOCTYPE html>");
  assertStringIncludes(html, "<html");
  assertStringIncludes(html, "tracklist");
  assertStringIncludes(html, "album-header-custom-element");
});

Deno.test("Album handler returns JSON fragment when X-Requested-With fetch", async () => {
  setupStorageEnv();
  mockFilesWithAlbum();

  const req = new Request(
    "http://localhost:8000/artists/Test%20Artist/albums/Test%20Album",
    { headers: { "X-Requested-With": "fetch" } },
  );
  const response = await handleAlbumHtml(req, {
    artistId: "Test Artist",
    albumId: "Test Album",
  });

  assertEquals(response.status, 200);
  assertEquals(
    response.headers.get("Content-Type"),
    "application/json",
  );
  const body = await response.json();
  assertEquals(typeof body.title, "string");
  assertStringIncludes(body.title, "Test Album");
  assertEquals(typeof body.html, "string");
  assertEquals(body.html.includes("<!DOCTYPE html"), false);
  assertStringIncludes(body.html, "tracklist");
  assertStringIncludes(body.html, "album-header-custom-element");
  assertEquals(Array.isArray(body.meta), true);
  const ogTitle = body.meta?.find(
    (m: { property?: string }) => m.property === "og:title",
  );
  assertEquals(ogTitle != null, true);
  assertEquals(ogTitle.content.includes("Test Album"), true);
  assertEquals(typeof body.styles, "string");
  assertStringIncludes(body.styles, "album-header-custom-element");
  assertStringIncludes(body.styles, ".album-page-main");
});

Deno.test("Album handler returns versioned compiled data JSON when format=json", async () => {
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
            Key: "Another%20Artist/Another%20Album/1__Elsewhere.mp3",
            LastModified: new Date("2026-01-05T00:00:00.000Z"),
          },
        ],
        IsTruncated: false,
      });
    }
    return Promise.resolve({});
  });
  await getUploadedFiles(true);

  const req = new Request(
    "http://localhost:8000/artists/Test%20Artist/albums/Test%20Album?format=json",
  );
  const response = await handleAlbumHtml(req, {
    artistId: "Test Artist",
    albumId: "Test Album",
  });

  assertEquals(response.status, 200);
  assertEquals(response.headers.get("Content-Type"), "application/json");
  assertEquals(
    response.headers.get("Cache-Control")?.includes("public"),
    true,
  );
  assertEquals(Boolean(response.headers.get("ETag")), true);
  assertEquals(Boolean(response.headers.get("Last-Modified")), true);

  const body = await response.json();
  assertEquals(body.dataFormatVersion, "1.0.0");
  assertEquals(body.scope.level, "album");
  assertEquals(body.scope.artistId, "Test Artist");
  assertEquals(body.scope.albumId, "Test Album");
  assertEquals(body.data.artists.length, 1);
  assertEquals(body.data.artists[0].id, "Test Artist");
  assertEquals(body.data.artists[0].albums.length, 1);
  assertEquals(body.data.artists[0].albums[0].title, "Test Album");
  assertEquals(body.data.artists[0].albums[0].tracks.length, 1);
  assertEquals(body.data.totals.artists, 1);
  assertEquals(body.data.totals.albums, 1);
  assertEquals(body.data.totals.tracks, 1);
});

Deno.test("Album handler returns compiled data JSON for /_json path", async () => {
  setupStorageEnv();
  mockFilesWithAlbum();
  await getUploadedFiles(true);

  const req = new Request(
    "http://localhost:8000/artists/Test%20Artist/albums/Test%20Album/_json",
  );
  const response = await handleAlbumHtml(req, {
    artistId: "Test Artist",
    albumId: "Test Album",
  });

  assertEquals(response.status, 200);
  assertEquals(response.headers.get("Content-Type"), "application/json");

  const body = await response.json();
  assertEquals(body.scope.level, "album");
  assertEquals(body.scope.artistId, "Test Artist");
  assertEquals(body.scope.albumId, "Test Album");
  assertEquals(body.data.totals.albums, 1);
});
