/** @file Tests for handleS3Upload - uses import map to inject mocks (no s3.server.ts changes).
 * Run from app/util/ with: deno test --import-map=import_map.s3_test.json s3.server.test.ts --allow-env --no-check
 * Or use: deno task test:s3
 */
import { assert, assertEquals } from "@std/assert";
import { setGetID3TagsReturn } from "./server/s3.server.test-mocks/id3.ts";
import {
  clearSendCalls as clearS3SendCalls,
  sendCalls,
  setSendBehavior,
} from "./server/s3.server.test-mocks/s3-client.ts";
import { handleS3Upload } from "../app/util/s3.server.ts";

function setupEnv(): void {
  Deno.env.set("AWS_ACCESS_KEY_ID", "test-key");
  Deno.env.set("AWS_SECRET_ACCESS_KEY", "test-secret");
  Deno.env.set("STORAGE_REGION", "test-region");
  Deno.env.set("STORAGE_BUCKET", "test-bucket");
}

function defaultSendBehavior(command: unknown): Promise<unknown> {
  const name = (command as { constructor: { name: string } }).constructor?.name;
  if (name === "HeadObjectCommand") {
    const err = new Error("NotFound");
    (err as { name: string }).name = "NotFound";
    return Promise.reject(err);
  }
  return Promise.resolve({});
}

Deno.test("handleS3Upload - should handle file upload with cover image", async () => {
  setupEnv();
  clearS3SendCalls();
  setSendBehavior(defaultSendBehavior);

  const mockData = [new Uint8Array([1, 2, 3])];
  const result = await handleS3Upload(
    "files",
    "audio/mpeg",
    (async function* () {
      for (const chunk of mockData) {
        yield chunk;
      }
    })(),
  );

  const headObjectCalls = sendCalls.filter(
    (c) =>
      (c.command as { constructor: { name: string } }).constructor?.name ===
        "HeadObjectCommand",
  );
  assertEquals(headObjectCalls.length, 1);
  assertEquals(
    (headObjectCalls[0].command as { input: { Bucket: string; Key: string } })
      .input,
    { Bucket: "test-bucket", Key: "Test Artist/Test Album/cover.jpeg" },
  );

  const coverPutCalls = sendCalls.filter(
    (c) =>
      (c.command as { constructor: { name: string }; input: { Key: string } })
          .constructor?.name === "PutObjectCommand" &&
      (c.command as { input: { Key: string } }).input.Key ===
        "Test Artist/Test Album/cover.jpeg",
  );
  assertEquals(coverPutCalls.length, 1);
  assertEquals(
    (coverPutCalls[0].command as {
      input: { Key: string; ContentType: string; Body: unknown };
    }).input.Key,
    "Test Artist/Test Album/cover.jpeg",
  );
  assertEquals(
    (coverPutCalls[0].command as { input: { ContentType: string } }).input
      .ContentType,
    "image/jpeg",
  );
  assertEquals(
    (coverPutCalls[0].command as { input: { Body: unknown } }).input
      .Body instanceof Uint8Array,
    true,
  );

  const audioUploadCalls = sendCalls.filter(
    (c) =>
      (c.command as { constructor: { name: string }; input: { Key: string } })
          .constructor?.name === "PutObjectCommand" &&
      (c.command as { input: { Key: string } }).input.Key ===
        "Test Artist/Test Album/1__Test Song",
  );
  assertEquals(audioUploadCalls.length, 1);
  assertEquals(
    (audioUploadCalls[0].command as { input: { Key: string } }).input.Key,
    "Test Artist/Test Album/1__Test Song",
  );

  assertEquals(
    result?.includes(
      "test-bucket.s3.test-region.amazonaws.com/Test Artist/Test Album/1__Test Song",
    ),
    true,
  );
});

Deno.test("handleS3Upload - should skip cover image upload if it already exists", async () => {
  setupEnv();
  clearS3SendCalls();
  setSendBehavior((command) => {
    const name = (command as { constructor: { name: string } }).constructor
      ?.name;
    if (name === "HeadObjectCommand") return Promise.resolve({});
    if (name === "PutObjectCommand") return Promise.resolve({});
    return Promise.resolve({});
  });

  const mockData = [new Uint8Array([1, 2, 3])];
  await handleS3Upload(
    "files",
    "audio/mpeg",
    (async function* () {
      for (const chunk of mockData) {
        yield chunk;
      }
    })(),
  );

  const headObjectCalls = sendCalls.filter(
    (c) =>
      (c.command as { constructor: { name: string } }).constructor?.name ===
        "HeadObjectCommand",
  );
  assertEquals(headObjectCalls.length, 1);

  const coverPutCalls = sendCalls.filter(
    (c) =>
      (c.command as { constructor: { name: string }; input: { Key: string } })
          .constructor?.name === "PutObjectCommand" &&
      (c.command as { input: { Key: string } }).input.Key ===
        "Test Artist/Test Album/cover.jpeg",
  );
  assertEquals(coverPutCalls.length, 0);

  const audioUploadCalls = sendCalls.filter(
    (c) =>
      (c.command as { constructor: { name: string }; input: { Key: string } })
          .constructor?.name === "PutObjectCommand" &&
      (c.command as { input: { Key: string } }).input.Key ===
        "Test Artist/Test Album/1__Test Song",
  );
  assertEquals(audioUploadCalls.length, 1);
});

Deno.test("handleS3Upload - should handle files without cover images", async () => {
  setupEnv();
  clearS3SendCalls();
  setSendBehavior(defaultSendBehavior);
  setGetID3TagsReturn({
    artist: "Test Artist",
    album: "Test Album",
    title: "Test Song",
    trackNumber: 1,
  });

  const mockData = [new Uint8Array([1, 2, 3])];
  await handleS3Upload(
    "files",
    "audio/mpeg",
    (async function* () {
      for (const chunk of mockData) {
        yield chunk;
      }
    })(),
  );

  const headObjectCalls = sendCalls.filter(
    (c) =>
      (c.command as { constructor: { name: string } }).constructor?.name ===
        "HeadObjectCommand",
  );
  assertEquals(headObjectCalls.length, 0);

  const coverPutCalls = sendCalls.filter(
    (c) =>
      (c.command as { constructor: { name: string }; input: { Key: string } })
          .constructor?.name === "PutObjectCommand" &&
      (c.command as { input: { Key: string } }).input.Key ===
        "Test Artist/Test Album/cover.jpeg",
  );
  assertEquals(coverPutCalls.length, 0);

  const audioUploadCalls = sendCalls.filter(
    (c) =>
      (c.command as { constructor: { name: string }; input: { Key: string } })
          .constructor?.name === "PutObjectCommand" &&
      (c.command as { input: { Key: string } }).input.Key ===
        "Test Artist/Test Album/1__Test Song",
  );
  assertEquals(audioUploadCalls.length, 1);
  assertEquals(
    (audioUploadCalls[0].command as { input: { Key: string } }).input.Key,
    "Test Artist/Test Album/1__Test Song",
  );
});

Deno.test("handleS3Upload - empty string metadata overrides do not replace server defaults", async () => {
  /**
   * Regression: when client sends empty strings (e.g. getID3TagsFromFile
   * returns null for non-MP3), spreading metadataOverride would overwrite
   * server's "Unknown" with "". This produced S3 keys like //1__ and
   * file listing skipped them (!artist || !album). Empty overrides must
   * be ignored so server defaults apply.
   */
  setupEnv();
  clearS3SendCalls();
  setSendBehavior(defaultSendBehavior);
  setGetID3TagsReturn({
    artist: "Unknown",
    album: "Unknown",
    title: "Unknown",
    trackNumber: 1,
  });

  const mockData = [new Uint8Array([1, 2, 3])];
  await handleS3Upload(
    "files",
    "audio/mpeg",
    (async function* () {
      for (const chunk of mockData) {
        yield chunk;
      }
    })(),
    {
      artist: "",
      album: "",
      title: "",
      trackNumber: 1,
    },
  );

  const audioUploadCalls = sendCalls.filter(
    (c) =>
      (c.command as { constructor: { name: string }; input: { Key: string } })
          .constructor?.name === "PutObjectCommand" &&
      (c.command as { input: { Key: string } }).input.Key !==
        "Test Artist/Test Album/cover.jpeg",
  );
  assertEquals(audioUploadCalls.length, 1);
  const key = (audioUploadCalls[0].command as { input: { Key: string } }).input
    .Key;
  assert(
    !key.includes("//") && key.startsWith("Unknown/Unknown/"),
    `S3 key must use "Unknown" not empty strings; got: ${key}`,
  );
});
