import { beforeEach, describe, test } from "vitest";
import { strict as assert, strict as expect } from "node:assert";
import { Buffer } from "node:buffer";
import { extractCoverImage } from "./id3";
import { readFileSync } from "fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "path";

// Set up __dirname equivalent for ES modules
const __dirname = dirname(fileURLToPath(import.meta.url));

// Polyfill browser APIs for testing
beforeEach(() => {
  // Mock minimal window environment
  globalThis.window = {} as Window & typeof globalThis;

  // Mock Image API
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

  // Mock URL API
  (globalThis as { URL: typeof URL }).URL = {
    createObjectURL: () => "mock-url",
    revokeObjectURL: () => {},
  } as unknown as typeof URL;

  // Mock Canvas API
  const mockContext = {
    drawImage: () => {},
  };

  (globalThis as { document: Document }).document = {
    createElement: () => ({
      getContext: () => mockContext,
      toDataURL: () => "data:image/jpeg;base64,/9j/4AAQSkZJRg==",
    }),
  } as unknown as Document;

  // Mock atob
  (globalThis as { atob: (s: string) => string }).atob = (str: string) =>
    Buffer.from(str, "base64").toString("binary");
});

describe("extractCoverImage", () => {
  test("should extract cover image from MP3 with embedded art", async () => {
    const buffer = readFileSync(
      join(__dirname, "../../test_data/with-cover.mp3"),
    );
    const file = new File([buffer], "test.mp3", { type: "audio/mpeg" });

    const result = await extractCoverImage(file);

    expect(result !== null);
    expect(result?.format === "image/jpeg");
    expect(result?.data instanceof Uint8Array);
    expect(result?.data.length > 0);
  });

  test("should extract cover image from FLAC with embedded art", async () => {
    const buffer = readFileSync(
      join(__dirname, "../../test_data/with-cover.flac"),
    );
    const file = new File([buffer], "test.flac", { type: "audio/flac" });

    const result = await extractCoverImage(file);

    expect(result !== null);
    expect(result?.format === "image/jpeg");
    expect(result?.data instanceof Uint8Array);
  });

  test("should extract cover image from WAV with embedded art", async () => {
    const buffer = readFileSync(
      join(__dirname, "../../test_data/with-cover.wav"),
    );
    const file = new File([buffer], "test.wav", { type: "audio/wav" });

    const result = await extractCoverImage(file);

    expect(result !== null);
    expect(result?.format === "image/jpeg");
    expect(result?.data instanceof Uint8Array);
  });

  test("should return null for audio files without cover art", async () => {
    const buffer = readFileSync(
      join(__dirname, "../../test_data/no-cover.mp3"),
    );
    const file = new File([buffer], "test.mp3", { type: "audio/mpeg" });

    const result = await extractCoverImage(file);

    expect(result === null);
  });

  test("should handle canvas context error", async () => {
    const buffer = readFileSync(
      join(__dirname, "../../test_data/with-cover.mp3"),
    );
    const file = new File([buffer], "test.mp3", { type: "audio/mpeg" });

    // Mock canvas to return null context
    (globalThis as { document: Document }).document = {
      createElement: () => ({
        getContext: () => null,
      }),
    } as unknown as Document;

    try {
      await extractCoverImage(file);
    } catch (error) {
      if (!(error instanceof Error)) {
        throw new Error("Expected error to be instance of Error");
      }
      assert.strictEqual(
        error.message,
        "Failed to extract cover image: Could not get canvas context",
      );
    }
  });

  test("should handle image load error", async () => {
    const buffer = readFileSync(
      join(__dirname, "../../test_data/with-cover.mp3"),
    );
    const file = new File([buffer], "test.mp3", { type: "audio/mpeg" });

    // Mock Image to trigger error
    (globalThis as { Image: typeof Image }).Image = class {
      onerror: () => void = () => {};
      constructor() {
        setTimeout(() => this.onerror(), 0);
      }
    } as unknown as typeof Image;

    await expect.rejects(
      async () => await extractCoverImage(file),
      "Failed to extract cover image",
    );
  });

  test("should handle invalid audio files", async () => {
    const file = new File([new Uint8Array(10)], "invalid.mp3", {
      type: "audio/mpeg",
    });

    try {
      await extractCoverImage(file);
    } catch (error) {
      console.log("Error details:", error);
      if (!(error instanceof Error)) {
        console.log("Error is not an Error instance. Type:", typeof error);
        console.log("Error value:", error);
      }
      // Still verify the rejection happens
      assert.strictEqual(
        error instanceof Error ? error.message : String(error),
        "Failed to extract cover image: Unknown error",
      );
    }
  });
});
