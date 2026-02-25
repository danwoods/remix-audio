/** @file Tests for shared data-url util */
import { assertEquals } from "@std/assert";
import { createDataUrlFromBytes, decodeDataUrl } from "./data-url.ts";

Deno.test("createDataUrlFromBytes produces valid data URL", () => {
  const bytes = new Uint8Array([0xff, 0xd8, 0xff]);
  const dataUrl = createDataUrlFromBytes(bytes, "image/jpeg");
  assertEquals(dataUrl.startsWith("data:image/jpeg;base64,"), true);
  const decoded = decodeDataUrl(dataUrl);
  assertEquals(decoded !== null, true);
  if (decoded) {
    assertEquals(decoded.contentType, "image/jpeg");
    assertEquals(decoded.body.length, 3);
    assertEquals(decoded.body[0], 0xff);
    assertEquals(decoded.body[1], 0xd8);
    assertEquals(decoded.body[2], 0xff);
  }
});

Deno.test("decodeDataUrl returns null for invalid format", () => {
  assertEquals(decodeDataUrl("not-a-data-url"), null);
  assertEquals(decodeDataUrl(""), null);
  assertEquals(decodeDataUrl("data:image/jpeg"), null);
});

Deno.test("decodeDataUrl returns null for invalid base64", () => {
  assertEquals(decodeDataUrl("data:image/jpeg;base64,!!!"), null);
});

Deno.test("createDataUrlFromBytes accepts ArrayBuffer", () => {
  const buffer = new ArrayBuffer(2);
  new Uint8Array(buffer).set([0x89, 0x50]);
  const dataUrl = createDataUrlFromBytes(buffer, "image/png");
  assertEquals(dataUrl.startsWith("data:image/png;base64,"), true);
  const decoded = decodeDataUrl(dataUrl);
  assertEquals(decoded?.body.length, 2);
  assertEquals(decoded?.body[0], 0x89);
  assertEquals(decoded?.body[1], 0x50);
});
