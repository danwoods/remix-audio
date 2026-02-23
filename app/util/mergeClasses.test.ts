/** @file Tests for mergeClasses and applyMergedClasses utilities. */

import { assertEquals } from "@std/assert";
import { parseHtmlFragment } from "../components/test.utils.ts";
import { applyMergedClasses, mergeClasses } from "./mergeClasses.ts";

Deno.test("mergeClasses returns default when custom is empty", () => {
  assertEquals(
    mergeClasses("size-6 text-blue-500", ""),
    "size-6 text-blue-500",
  );
  assertEquals(mergeClasses("size-6", "   "), "size-6");
});

Deno.test("mergeClasses combines non-conflicting default and custom classes", () => {
  assertEquals(
    mergeClasses("size-6", "text-blue-500"),
    "size-6 text-blue-500",
  );
});

Deno.test("mergeClasses lets custom class override conflicting default", () => {
  assertEquals(mergeClasses("size-6", "size-8"), "size-8");
  assertEquals(
    mergeClasses("size-6", "size-8 text-blue-500"),
    "size-8 text-blue-500",
  );
});

Deno.test("mergeClasses keeps default classes without prefix when no custom conflict", () => {
  assertEquals(
    mergeClasses("rounded block", "text-blue-500"),
    "rounded block text-blue-500",
  );
});

Deno.test("mergeClasses filters only conflicting prefix from multiple defaults", () => {
  assertEquals(
    mergeClasses("size-6 text-red-500 rounded", "size-8"),
    "text-red-500 rounded size-8",
  );
  assertEquals(
    mergeClasses("size-6 text-red-500", "text-red-700"),
    "size-6 text-red-700",
  );
});

Deno.test("mergeClasses trims and normalizes whitespace", () => {
  assertEquals(
    mergeClasses("  size-6  text-blue-500  ", "  size-8  "),
    "text-blue-500 size-8",
  );
});

Deno.test("applyMergedClasses sets element class to merged result", () => {
  const document = parseHtmlFragment('<div id="x"></div>');
  const el = document.getElementById("x")!;
  applyMergedClasses(el, "size-6", "size-8 text-blue-500");
  assertEquals(el.getAttribute("class"), "size-8 text-blue-500");
});
