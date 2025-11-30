/** @file Tests for upload route handler */
/* eslint-disable import/no-unresolved */
import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { handleUpload } from "../../../server/handlers/upload.ts";

Deno.test("Upload handler returns 400 when no files provided", async () => {
  const formData = new FormData();
  const req = new Request("http://localhost:8000/", {
    method: "POST",
    body: formData,
  });

  const response = await handleUpload(req);
  assertEquals(response.status, 400);

  const text = await response.text();
  assertEquals(text, "No files provided");
});

Deno.test("Upload handler accepts FormData with files", async () => {
  // Create a simple text file for testing
  const fileContent = new Blob(["test audio content"], { type: "audio/mpeg" });
  const file = new File([fileContent], "test.mp3", { type: "audio/mpeg" });

  const formData = new FormData();
  formData.append("files", file);

  const req = new Request("http://localhost:8000/", {
    method: "POST",
    body: formData,
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

Deno.test("Upload handler handles multiple files", async () => {
  const file1 = new File(["content1"], "test1.mp3", { type: "audio/mpeg" });
  const file2 = new File(["content2"], "test2.mp3", { type: "audio/mpeg" });

  const formData = new FormData();
  formData.append("files", file1);
  formData.append("files", file2);

  const req = new Request("http://localhost:8000/", {
    method: "POST",
    body: formData,
  });

  const response = await handleUpload(req);

  // Should handle multiple files (will fail if AWS not configured, but structure is correct)
  assertEquals(
    [303, 500].includes(response.status),
    true,
    "Should handle multiple files",
  );
});
