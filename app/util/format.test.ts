/** @file Tests for format utility */

import { assertEquals } from "@std/assert";
import { formatFileSize } from "./format.ts";

Deno.test("formatFileSize returns B for values under 1024", () => {
  assertEquals(formatFileSize(0), "0 B");
  assertEquals(formatFileSize(512), "512 B");
});

Deno.test("formatFileSize returns KB for values between 1KB and 1MB", () => {
  assertEquals(formatFileSize(1024), "1.0 KB");
  assertEquals(formatFileSize(1536), "1.5 KB");
});

Deno.test("formatFileSize returns MB for values 1MB and above", () => {
  assertEquals(formatFileSize(1024 * 1024), "1.0 MB");
  assertEquals(formatFileSize(2500000), "2.4 MB");
});
