/** @file Tests for extractCoverImage (browser-only ID3 cover extraction) */
import { assertEquals, assertExists, assertRejects } from "@std/assert";
import { extractCoverImage } from "./id3.ts";

const testDataDir = new URL("../../test_data/", import.meta.url);
const withCoverMp3 = new URL("with-cover.mp3", testDataDir);
const withCoverFlac = new URL("with-cover.flac", testDataDir);
const withCoverWav = new URL("with-cover.wav", testDataDir);
const noCoverMp3 = new URL("no-cover.mp3", testDataDir);

function setupBrowserMocks(): void {
  (globalThis as { window: Window & typeof globalThis }).window = {} as
    & Window
    & typeof globalThis;

  (globalThis as { Image: typeof Image }).Image = class {
    onload: () => void = () => {};
    onerror: () => void = () => {};
    width = 100;
    height = 100;
    src = "";

    constructor() {
      setTimeout(() => this.onload(), 0);
    }
  } as unknown as typeof Image;

  const RealURL = globalThis.URL;
  (globalThis as { URL: typeof URL }).URL = Object.assign(
    function URL(
      ...args: ConstructorParameters<typeof URL>
    ): URL {
      return new RealURL(...args);
    },
    {
      createObjectURL: () => "mock-url",
      revokeObjectURL: () => {},
    },
  ) as typeof URL;

  const mockContext = { drawImage: () => {} };

  (globalThis as { document: Document }).document = {
    createElement: () =>
      ({
        getContext: () => mockContext,
        toDataURL: () => "data:image/jpeg;base64,/9j/4AAQSkZJRg==",
      }) as unknown as HTMLCanvasElement,
  } as unknown as Document;
}

Deno.test("extractCoverImage - should extract cover image from MP3 with embedded art", async () => {
  setupBrowserMocks();
  const buffer = await Deno.readFile(withCoverMp3);
  const file = new File([buffer], "test.mp3", { type: "audio/mpeg" });

  const result = await extractCoverImage(file);

  assertExists(result);
  assertEquals(result?.format, "image/jpeg");
  assertEquals(result?.data instanceof Uint8Array, true);
  assertEquals((result?.data.length ?? 0) > 0, true);
});

Deno.test("extractCoverImage - should extract cover image from FLAC with embedded art", async () => {
  setupBrowserMocks();
  const buffer = await Deno.readFile(withCoverFlac);
  const file = new File([buffer], "test.flac", { type: "audio/flac" });

  const result = await extractCoverImage(file);

  assertExists(result);
  assertEquals(result?.format, "image/jpeg");
  assertEquals(result?.data instanceof Uint8Array, true);
});

Deno.test("extractCoverImage - should extract cover image from WAV with embedded art", async () => {
  setupBrowserMocks();
  const buffer = await Deno.readFile(withCoverWav);
  const file = new File([buffer], "test.wav", { type: "audio/wav" });

  const result = await extractCoverImage(file);

  assertExists(result);
  assertEquals(result?.format, "image/jpeg");
  assertEquals(result?.data instanceof Uint8Array, true);
});

Deno.test("extractCoverImage - should return null for audio files without cover art", async () => {
  setupBrowserMocks();
  const buffer = await Deno.readFile(noCoverMp3);
  const file = new File([buffer], "test.mp3", { type: "audio/mpeg" });

  const result = await extractCoverImage(file);

  assertEquals(result, null);
});

Deno.test("extractCoverImage - should handle canvas context error", async () => {
  setupBrowserMocks();
  const buffer = await Deno.readFile(withCoverMp3);
  const file = new File([buffer], "test.mp3", { type: "audio/mpeg" });

  (globalThis as { document: Document }).document = {
    createElement: () =>
      ({
        getContext: () => null,
      }) as unknown as HTMLCanvasElement,
  } as unknown as Document;

  try {
    await extractCoverImage(file);
  } catch (error) {
    if (!(error instanceof Error)) {
      throw new Error("Expected error to be instance of Error");
    }
    assertEquals(
      error.message,
      "Failed to extract cover image: Could not get canvas context",
    );
  }
});

Deno.test("extractCoverImage - should handle image load error", async () => {
  setupBrowserMocks();
  const buffer = await Deno.readFile(withCoverMp3);
  const file = new File([buffer], "test.mp3", { type: "audio/mpeg" });

  (globalThis as { Image: typeof Image }).Image = class {
    onerror: () => void = () => {};
    constructor() {
      setTimeout(() => this.onerror(), 0);
    }
  } as unknown as typeof Image;

  await assertRejects(
    async () => await extractCoverImage(file),
    Error,
    "Failed to extract cover image",
  );
});

Deno.test("extractCoverImage - should handle invalid audio files", async () => {
  setupBrowserMocks();
  const file = new File([new Uint8Array(10)], "invalid.mp3", {
    type: "audio/mpeg",
  });

  try {
    await extractCoverImage(file);
  } catch (error) {
    assertEquals(
      error instanceof Error ? error.message : String(error),
      "Failed to extract cover image: Unknown error",
    );
  }
});
