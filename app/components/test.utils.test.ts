/** @file Tests for shared component test utilities. */

import { assertEquals, assertExists } from "@std/assert";
import {
  createCustomElement,
  createLinkedomEnv,
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
