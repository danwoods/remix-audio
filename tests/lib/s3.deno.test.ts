/** @file Tests for lib/s3.ts */
import { assertEquals } from "@std/assert";
import { getBucketContents } from "../../lib/s3.ts";

if (typeof globalThis.DOMParser === "undefined") {
  globalThis.DOMParser = class DOMParser {
    parseFromString(xml: string, _type: string): Document {
      const keys: string[] = [];
      const keyRegex = /<Key>(.*?)<\/Key>/g;
      let match: RegExpExecArray | null;
      while ((match = keyRegex.exec(xml)) !== null) {
        keys.push(match[1]);
      }

      const contents = keys.map((key) => ({
        getElementsByTagName: (tag: string) =>
          tag === "Key" ? [{ textContent: key }] : [],
      }));

      return {
        getElementsByTagName: (tagName: string) =>
          tagName === "Contents"
            ? contents as unknown as HTMLCollectionOf<Element>
            : [] as unknown as HTMLCollectionOf<Element>,
      } as unknown as Document;
    }
  } as unknown as typeof DOMParser;
}

Deno.test("getBucketContents parses keys from ListObjectsV2 XML", async () => {
  const originalFetch = globalThis.fetch;
  try {
    let requestedUrl = "";
    globalThis.fetch = ((input: string | URL | Request) => {
      requestedUrl = String(input);
      const xml = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        "<ListBucketResult>",
        "  <Contents><Key>Artist/Album/1__Song A.mp3</Key></Contents>",
        "  <Contents><Key>Artist/Album/2__Song B.mp3</Key></Contents>",
        "</ListBucketResult>",
      ].join("\n");
      return Promise.resolve(new Response(xml));
    }) as typeof fetch;

    const keys = await getBucketContents(
      "https://example-bucket.s3.us-east-1.amazonaws.com",
      "Artist/Album/",
    );

    assertEquals(
      requestedUrl,
      "https://example-bucket.s3.us-east-1.amazonaws.com/?list-type=2&prefix=Artist/Album/",
    );
    assertEquals(keys, [
      "Artist/Album/1__Song A.mp3",
      "Artist/Album/2__Song B.mp3",
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("getBucketContents returns empty array when XML has no Contents", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = (() =>
      Promise.resolve(
        new Response(
          [
            '<?xml version="1.0" encoding="UTF-8"?>',
            "<ListBucketResult>",
            "  <Name>example-bucket</Name>",
            "</ListBucketResult>",
          ].join("\n"),
        ),
      )) as typeof fetch;

    const keys = await getBucketContents(
      "https://example-bucket.s3.us-east-1.amazonaws.com",
      "Empty/Album/",
    );
    assertEquals(keys, []);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
