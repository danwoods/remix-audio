/** @file Tests for s3.server - uses import map to inject mocks (no s3.server.ts changes).
 * Covers getObjectBytes, handleS3Upload. Run via `deno task test:server`.
 */
import { assert, assertEquals, assertRejects } from "@std/assert";
import { setGetID3TagsReturn } from "./server/s3.server.test-mocks/id3.ts";
import {
  clearSendCalls as clearS3SendCalls,
  sendCalls,
  setSendBehavior,
} from "./server/s3.server.test-mocks/s3-client.ts";
import {
  getObjectBytes,
  getUploadedFiles,
  handleS3Upload,
  uploadStreamToS3,
} from "../app/util/s3.server.ts";

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

Deno.test("getObjectBytes - fetches object and returns bytes", async () => {
  setupEnv();
  clearS3SendCalls();
  const expected = new Uint8Array([65, 66, 67]);
  setSendBehavior((command) => {
    const name = (command as { constructor: { name: string } }).constructor
      ?.name;
    if (name === "GetObjectCommand") {
      const stream = new Response(expected).body!;
      return Promise.resolve({ Body: stream });
    }
    return Promise.resolve({});
  });

  const result = await getObjectBytes("Artist/Album/1__Track.mp3");

  assertEquals(result, expected);
  const getCalls = sendCalls.filter(
    (c) =>
      (c.command as { constructor: { name: string } }).constructor?.name ===
        "GetObjectCommand",
  );
  assertEquals(getCalls.length, 1);
  assertEquals(
    (getCalls[0].command as { input: { Bucket: string; Key: string } }).input
      .Key,
    "Artist/Album/1__Track.mp3",
  );
});

Deno.test("getObjectBytes - throws when S3 returns empty body", async () => {
  setupEnv();
  clearS3SendCalls();
  setSendBehavior((command) => {
    const name = (command as { constructor: { name: string } }).constructor
      ?.name;
    if (name === "GetObjectCommand") {
      return Promise.resolve({ Body: undefined });
    }
    return Promise.resolve({});
  });

  await assertRejects(
    () => getObjectBytes("Artist/Album/1__Track.mp3"),
    Error,
    "S3 object empty: Artist/Album/1__Track.mp3",
  );
});

Deno.test("uploadStreamToS3 - uploads stream and returns S3 URL", async () => {
  setupEnv();
  clearS3SendCalls();
  setSendBehavior(() => Promise.resolve({}));

  const data = (async function* () {
    yield new Uint8Array([1, 2, 3]);
    yield new Uint8Array([4, 5]);
  })();

  const url = await uploadStreamToS3(data, "Artist/Album/1__Track.mp3");

  assert(
    url.startsWith(
      "https://test-bucket.s3.test-region.amazonaws.com/Artist/Album/1__Track.mp3",
    ),
  );
  const putCalls = sendCalls.filter(
    (c) =>
      (c.command as { constructor: { name: string } }).constructor?.name ===
        "PutObjectCommand",
  );
  assertEquals(putCalls.length, 1);
  const input =
    (putCalls[0].command as { input: { Key: string; Body: unknown } })
      .input;
  assertEquals(input.Key, "Artist/Album/1__Track.mp3");
  const body = input.Body as Uint8Array;
  assertEquals(body.length, 5);
  assertEquals([...body], [1, 2, 3, 4, 5]);
});

Deno.test("getUploadedFiles - parses S3 keys into Files structure", async () => {
  setupEnv();
  clearS3SendCalls();
  const now = new Date();
  setSendBehavior((command) => {
    const name = (command as { constructor: { name: string } }).constructor
      ?.name;
    if (name === "ListObjectsV2Command") {
      return Promise.resolve({
        Contents: [
          {
            Key: "Artist One/Album A/1__First Track.mp3",
            LastModified: now,
          },
          {
            Key: "Artist One/Album A/2__Second Track.mp3",
            LastModified: now,
          },
          {
            Key: "Artist Two/Album B/1__Solo.mp3",
            LastModified: now,
          },
        ],
        IsTruncated: false,
        NextContinuationToken: undefined,
      });
    }
    return Promise.resolve({});
  });

  const files = await getUploadedFiles(true);

  assertEquals(Object.keys(files), ["Artist One", "Artist Two"]);
  assert("Artist One" in files);
  assert("Album A" in files["Artist One"]);
  assertEquals(files["Artist One"]["Album A"].id, "Artist One/Album A");
  assertEquals(files["Artist One"]["Album A"].title, "Album A");
  assertEquals(files["Artist One"]["Album A"].tracks.length, 2);
  assertEquals(
    files["Artist One"]["Album A"].tracks[0].title,
    "First Track.mp3",
  );
  assertEquals(files["Artist One"]["Album A"].tracks[0].trackNum, 1);
  assertEquals(
    files["Artist One"]["Album A"].tracks[0].url,
    "https://test-bucket.s3.test-region.amazonaws.com/Artist One/Album A/1__First Track.mp3",
  );
  assertEquals(files["Artist Two"]["Album B"].tracks[0].title, "Solo.mp3");
});

Deno.test("getObjectBytes - throws when required env vars are missing", async () => {
  const orig = {
    AWS_ACCESS_KEY_ID: Deno.env.get("AWS_ACCESS_KEY_ID"),
    AWS_SECRET_ACCESS_KEY: Deno.env.get("AWS_SECRET_ACCESS_KEY"),
    STORAGE_REGION: Deno.env.get("STORAGE_REGION"),
    STORAGE_BUCKET: Deno.env.get("STORAGE_BUCKET"),
  };
  Deno.env.delete("AWS_ACCESS_KEY_ID");
  Deno.env.delete("AWS_SECRET_ACCESS_KEY");
  Deno.env.delete("STORAGE_REGION");
  Deno.env.delete("STORAGE_BUCKET");
  try {
    await assertRejects(
      () => getObjectBytes("key"),
      Error,
      "Storage is missing required configuration",
    );
  } finally {
    if (orig.AWS_ACCESS_KEY_ID) {
      Deno.env.set("AWS_ACCESS_KEY_ID", orig.AWS_ACCESS_KEY_ID);
    }
    if (orig.AWS_SECRET_ACCESS_KEY) {
      Deno.env.set("AWS_SECRET_ACCESS_KEY", orig.AWS_SECRET_ACCESS_KEY);
    }
    if (orig.STORAGE_REGION) {
      Deno.env.set("STORAGE_REGION", orig.STORAGE_REGION);
    }
    if (orig.STORAGE_BUCKET) {
      Deno.env.set("STORAGE_BUCKET", orig.STORAGE_BUCKET);
    }
  }
});

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
