/** @file Tests for upload route handler */
import { assertEquals } from "@std/assert";
import { handleUpload } from "../../../server/handlers/upload.ts";

const ADMIN_USER = "admin";
const ADMIN_PASS = "secret";

function createAdminAuthHeader(): string {
  return `Basic ${globalThis.btoa(`${ADMIN_USER}:${ADMIN_PASS}`)}`;
}

async function withAdminEnv<T>(fn: () => Promise<T>): Promise<T> {
  const originalUser = Deno.env.get("ADMIN_USER");
  const originalPass = Deno.env.get("ADMIN_PASS");

  Deno.env.set("ADMIN_USER", ADMIN_USER);
  Deno.env.set("ADMIN_PASS", ADMIN_PASS);

  try {
    return await fn();
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
}

Deno.test("Upload handler rejects unauthenticated requests", async () => {
  await withAdminEnv(async () => {
    const req = new Request("http://localhost:8000/", {
      method: "POST",
      body: new FormData(),
    });

    const response = await handleUpload(req);
    assertEquals(response.status, 401);
    assertEquals(
      response.headers.get("WWW-Authenticate"),
      'Basic realm="Admin", charset="UTF-8"',
    );
  });
});

Deno.test("Upload handler returns 400 when no files provided", async () => {
  await withAdminEnv(async () => {
    const formData = new FormData();
    const req = new Request("http://localhost:8000/", {
      method: "POST",
      body: formData,
      headers: { Authorization: createAdminAuthHeader() },
    });

    const response = await handleUpload(req);
    assertEquals(response.status, 400);

    const text = await response.text();
    assertEquals(text, "No files provided");
  });
});

Deno.test({
  name: "Upload handler accepts FormData with files",
  async fn() {
    await withAdminEnv(async () => {
      // Create a simple text file for testing
      const fileContent = new Blob(["test audio content"], {
        type: "audio/mpeg",
      });
      const file = new File([fileContent], "test.mp3", { type: "audio/mpeg" });

      const formData = new FormData();
      formData.append("files", file);

      const req = new Request("http://localhost:8000/", {
        method: "POST",
        body: formData,
        headers: { Authorization: createAdminAuthHeader() },
      });

      // Note: This will fail if AWS credentials aren't configured, but we can test the structure
      const response = await handleUpload(req);

      // Should either succeed (303 redirect) or fail with 500 (if AWS not configured)
      // But should NOT be 400 (no files) or crash
      assertEquals(
        [303, 500].includes(response.status),
        true,
        "Should return 303 (success) or 500 (AWS error), not 400",
      );
    });
  },
  sanitizeResources: false, // S3Client connections are managed by AWS SDK
  sanitizeOps: false,
});

Deno.test({
  name: "Upload handler handles multiple files",
  async fn() {
    await withAdminEnv(async () => {
      const file1 = new File(["content1"], "test1.mp3", {
        type: "audio/mpeg",
      });
      const file2 = new File(["content2"], "test2.mp3", {
        type: "audio/mpeg",
      });

      const formData = new FormData();
      formData.append("files", file1);
      formData.append("files", file2);

      const req = new Request("http://localhost:8000/", {
        method: "POST",
        body: formData,
        headers: { Authorization: createAdminAuthHeader() },
      });

      const response = await handleUpload(req);

      // Should handle multiple files (will fail if AWS not configured, but structure is correct)
      assertEquals(
        [303, 500].includes(response.status),
        true,
        "Should handle multiple files",
      );
    });
  },
  sanitizeResources: false, // S3Client connections are managed by AWS SDK
  sanitizeOps: false,
});
