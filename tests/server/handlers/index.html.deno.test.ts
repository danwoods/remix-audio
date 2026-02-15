/** @file Tests for index page route handler */
import { assertEquals, assertStringIncludes } from "@std/assert";
import { handleIndexHtml } from "../../../server/handlers/index.html.ts";
import { setSendBehavior } from "../s3.server.test-mocks/s3-client.ts";

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
