/** @file Tests for S3 server utilities.
 *
 * Pure functions (createAsyncIteratorFromArrayBuffer) are tested here without mocks.
 * Functions that call AWS S3 (getObjectBytes, uploadStreamToS3, handleS3Upload,
 * getUploadedFiles) are tested in deno-tests/s3.server.test.ts with the import
 * map to inject S3 and ID3 mocks.
 */

import { assertEquals } from "@std/assert";
import { createAsyncIteratorFromArrayBuffer } from "./s3.server.ts";

Deno.test("createAsyncIteratorFromArrayBuffer yields chunks of correct size", async () => {
  const data = new Uint8Array([1, 2, 3, 4, 5]);
  const chunks: Uint8Array[] = [];

  for await (
    const chunk of createAsyncIteratorFromArrayBuffer(
      data.buffer,
      2,
    )
  ) {
    chunks.push(chunk);
  }

  assertEquals(chunks.length, 3);
  assertEquals(chunks[0], new Uint8Array([1, 2]));
  assertEquals(chunks[1], new Uint8Array([3, 4]));
  assertEquals(chunks[2], new Uint8Array([5]));
});

Deno.test("createAsyncIteratorFromArrayBuffer uses default chunk size of 1024", async () => {
  const data = new Uint8Array(2048);
  const chunks: Uint8Array[] = [];

  for await (const chunk of createAsyncIteratorFromArrayBuffer(data.buffer)) {
    chunks.push(chunk);
  }

  assertEquals(chunks.length, 2);
  assertEquals(chunks[0].length, 1024);
  assertEquals(chunks[1].length, 1024);
});

Deno.test("createAsyncIteratorFromArrayBuffer yields no chunks for empty buffer", async () => {
  const chunks: Uint8Array[] = [];

  for await (
    const chunk of createAsyncIteratorFromArrayBuffer(
      new ArrayBuffer(0),
      1024,
    )
  ) {
    chunks.push(chunk);
  }

  assertEquals(chunks.length, 0);
});
