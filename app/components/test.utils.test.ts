/** @file Tests for shared component test utilities. */

import { assertEquals, assertExists } from "@std/assert";
import {
  createCustomElement,
  createLinkedomEnv,
  createS3ListXml,
  getFetchUrl,
  parseHtmlFragment,
  wireLinkedomToGlobal,
} from "./test.utils.ts";

// ============================================================================
// TESTS
// ============================================================================

Deno.test("parseHtmlFragment returns Document with parsed HTML", () => {
  const document = parseHtmlFragment('<div id="x">a</div>');
  const el = document.getElementById("x");
  assertExists(el);
  assertEquals(el.textContent, "a");
});

Deno.test("createLinkedomEnv returns document and window", () => {
  const { document, window } = createLinkedomEnv();
  assertExists(document.body);
  assertExists((window as Window & { HTMLElement?: unknown }).HTMLElement);
});

Deno.test("createLinkedomEnv accepts custom body HTML", () => {
  const html = `<!DOCTYPE html>
<html><head></head><body><nav></nav><main></main></body></html>`;
  const { document } = createLinkedomEnv(html);
  assertExists(document.querySelector("nav"));
  assertExists(document.querySelector("main"));
});

Deno.test("createCustomElement appends element with attributes", () => {
  const { document, window } = createLinkedomEnv();
  wireLinkedomToGlobal(window, document);
  const el = createCustomElement(document, "div", {
    id: "x",
    "data-foo": "bar",
  });
  assertExists(document.body?.querySelector("#x"));
  assertEquals(el.getAttribute("id"), "x");
  assertEquals(el.getAttribute("data-foo"), "bar");
});

Deno.test("getFetchUrl extracts URL from string input", () => {
  assertEquals(getFetchUrl("https://example.com/a"), "https://example.com/a");
});

Deno.test("getFetchUrl extracts URL from URL input", () => {
  assertEquals(
    getFetchUrl(new URL("https://example.com/b")),
    "https://example.com/b",
  );
});

Deno.test("getFetchUrl extracts URL from Request input", () => {
  const req = new Request("https://example.com/c");
  assertEquals(getFetchUrl(req), "https://example.com/c");
});

Deno.test("createS3ListXml returns ListBucketResult XML with keys", () => {
  const xml = createS3ListXml(["Artist/Album/01.mp3", "Artist/Album/02.mp3"]);
  assertEquals(
    xml.includes("<Key>Artist/Album/01.mp3</Key>"),
    true,
  );
  assertEquals(
    xml.includes("<Key>Artist/Album/02.mp3</Key>"),
    true,
  );
  assertEquals(
    xml.includes("ListBucketResult"),
    true,
  );
});

Deno.test("createS3ListXml returns valid XML for empty keys", () => {
  const xml = createS3ListXml([]);
  assertEquals(xml.includes("ListBucketResult"), true);
  assertEquals(xml.includes("<?xml"), true);
});
