/** @file Tests for index page route handler */
import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { handleIndexHtml } from "../../../server/handlers/index.html.ts";
import { setSendBehavior } from "../s3.server.test-mocks/s3-client.ts";
import { getUploadedFiles } from "../../../app/util/s3.server.ts";

const ADMIN_USER = "admin";
const ADMIN_PASS = "secret";

function setupStorageEnv(): void {
  Deno.env.set("AWS_ACCESS_KEY_ID", "test-key");
  Deno.env.set("AWS_SECRET_ACCESS_KEY", "test-secret");
  Deno.env.set("STORAGE_REGION", "test-region");
  Deno.env.set("STORAGE_BUCKET", "test-bucket");
}

function createAdminAuthHeader(): string {
  return `Basic ${globalThis.btoa(`${ADMIN_USER}:${ADMIN_PASS}`)}`;
}

Deno.test({
  name: "Index handler /admin auth flow",
  async fn(t) {
    const originalUser = Deno.env.get("ADMIN_USER");
    const originalPass = Deno.env.get("ADMIN_PASS");

    try {
      Deno.env.delete("ADMIN_USER");
      Deno.env.delete("ADMIN_PASS");

      await t.step("returns 500 when credentials are missing", async () => {
        const req = new Request("http://localhost:8000/admin", {
          method: "GET",
        });
        const response = await handleIndexHtml(req, {});
        assertEquals(response.status, 500);
        const text = await response.text();
        assertStringIncludes(text, "credentials");
      });

      Deno.env.set("ADMIN_USER", ADMIN_USER);
      Deno.env.set("ADMIN_PASS", ADMIN_PASS);

      await t.step("challenges when unauthenticated", async () => {
        const req = new Request("http://localhost:8000/admin", {
          method: "GET",
        });
        const response = await handleIndexHtml(req, {});
        assertEquals(response.status, 401);
        assertEquals(
          response.headers.get("WWW-Authenticate"),
          'Basic realm="Admin", charset="UTF-8"',
        );
      });

      await t.step("redirects to / when authenticated", async () => {
        const req = new Request("http://localhost:8000/admin", {
          method: "GET",
          headers: { Authorization: createAdminAuthHeader() },
        });
        const response = await handleIndexHtml(req, {});
        assertEquals(response.status, 302);
        assertEquals(
          response.headers.get("Location"),
          new URL("/", req.url).toString(),
        );
      });
    } finally {
      if (originalUser === undefined) {
        Deno.env.delete("ADMIN_USER");
      } else {
        Deno.env.set("ADMIN_USER", originalUser);
      }

      if (originalPass === undefined) {
        Deno.env.delete("ADMIN_PASS");
      } else {
        Deno.env.set("ADMIN_PASS", originalPass);
      }
    }
  },
});

Deno.test("Index handler returns JSON fragment when X-Requested-With fetch", async () => {
  setupStorageEnv();
  setSendBehavior((command: unknown) => {
    const name = (command as { constructor: { name: string } }).constructor
      ?.name;
    if (name === "ListObjectsV2Command") {
      return Promise.resolve({ Contents: [], IsTruncated: false });
    }
    return Promise.resolve({});
  });

  const req = new Request("http://localhost:8000/", {
    headers: { "X-Requested-With": "fetch" },
  });
  const response = await handleIndexHtml(req, {});

  assertEquals(response.status, 200);
  assertEquals(
    response.headers.get("Content-Type"),
    "application/json",
  );
  const body = await response.json();
  assertEquals(typeof body.title, "string");
  assertEquals(body.title.length > 0, true);
  assertEquals(typeof body.html, "string");
  assertEquals(Array.isArray(body.meta), true);
  assertEquals(body.html.includes("<!DOCTYPE html"), false);
  assertStringIncludes(body.html, "Latest");
});

Deno.test("Index handler returns versioned compiled data JSON with cache headers when format=json", async () => {
  setupStorageEnv();
  setSendBehavior((command: unknown) => {
    const name = (command as { constructor: { name: string } }).constructor
      ?.name;
    if (name === "ListObjectsV2Command") {
      return Promise.resolve({
        Contents: [
          {
            Key: "Artist%201/Album%201/1__Track%20One.mp3",
            LastModified: new Date("2026-01-01T00:00:00.000Z"),
          },
          {
            Key: "Artist%201/Album%201/2__Track%20Two.mp3",
            LastModified: new Date("2026-01-02T00:00:00.000Z"),
          },
        ],
        IsTruncated: false,
      });
    }
    return Promise.resolve({});
  });
  await getUploadedFiles(true);

  const req = new Request("http://localhost:8000/?format=json");
  const response = await handleIndexHtml(req, {});

  assertEquals(response.status, 200);
  assertEquals(
    response.headers.get("Content-Type"),
    "application/json",
  );
  assertEquals(
    response.headers.get("Cache-Control")?.includes("public"),
    true,
  );
  assert(response.headers.get("ETag"));
  assert(response.headers.get("Last-Modified"));

  const body = await response.json();
  assertEquals(body.dataFormatVersion, "1.0.0");
  assertEquals(body.scope.level, "root");
  assertEquals(typeof body.compiledAt, "string");
  assertEquals(
    Number.isNaN(Date.parse(body.compiledAt)),
    false,
  );
  assertEquals(Array.isArray(body.data.artists), true);
  assertEquals(body.data.artists.length, 1);
  assertEquals(body.data.artists[0].id, "Artist 1");
  assertEquals(body.data.artists[0].albums.length, 1);
  assertEquals(body.data.artists[0].albums[0].tracks.length, 2);
  assertEquals(body.data.totals.artists, 1);
  assertEquals(body.data.totals.albums, 1);
  assertEquals(body.data.totals.tracks, 2);
});

Deno.test("Index handler returns compiled data JSON for /_json path", async () => {
  setupStorageEnv();
  setSendBehavior((command: unknown) => {
    const name = (command as { constructor: { name: string } }).constructor
      ?.name;
    if (name === "ListObjectsV2Command") {
      return Promise.resolve({
        Contents: [
          {
            Key: "Artist/Album/1__Song.mp3",
            LastModified: new Date("2026-01-10T00:00:00.000Z"),
          },
        ],
        IsTruncated: false,
      });
    }
    return Promise.resolve({});
  });
  await getUploadedFiles(true);

  const req = new Request("http://localhost:8000/_json");
  const response = await handleIndexHtml(req, {});

  assertEquals(response.status, 200);
  assertEquals(response.headers.get("Content-Type"), "application/json");

  const body = await response.json();
  assertEquals(body.scope.level, "root");
  assertEquals(body.data.artists.length, 1);
  assertEquals(body.data.totals.tracks, 1);
});

Deno.test("Index JSON data endpoint returns 304 when ETag matches", async () => {
  setupStorageEnv();
  setSendBehavior((command: unknown) => {
    const name = (command as { constructor: { name: string } }).constructor
      ?.name;
    if (name === "ListObjectsV2Command") {
      return Promise.resolve({
        Contents: [
          {
            Key: "Artist/Album/1__Song.mp3",
            LastModified: new Date("2026-01-10T00:00:00.000Z"),
          },
        ],
        IsTruncated: false,
      });
    }
    return Promise.resolve({});
  });
  await getUploadedFiles(true);

  const first = await handleIndexHtml(
    new Request("http://localhost:8000/?format=json"),
    {},
  );
  const etag = first.headers.get("ETag");
  assert(etag);

  const second = await handleIndexHtml(
    new Request("http://localhost:8000/?format=json", {
      headers: { "If-None-Match": etag },
    }),
    {},
  );

  assertEquals(second.status, 304);
  assertEquals(second.headers.get("ETag"), etag);
  assertEquals(
    second.headers.get("Cache-Control")?.includes("public"),
    true,
  );
  assertEquals(await second.text(), "");
});
