/** @file Tests for conventional commit release helpers. */

import { assertEquals } from "@std/assert";
import {
  determineVersionBump,
  getCommitBump,
  incrementSemver,
  parseGitLogMessages,
} from "./release.ts";

Deno.test("determineVersionBump returns major for breaking commits", () => {
  const bump = determineVersionBump([
    "fix: patch release",
    "feat(ui): add new album card",
    "feat(player)!: remove deprecated queue format\n\nBREAKING CHANGE: queue payload changed",
  ]);

  assertEquals(bump, "major");
});

Deno.test("determineVersionBump returns minor for feat commits", () => {
  const bump = determineVersionBump([
    "chore: update docs",
    "fix: handle edge case in parser",
    "feat(upload): add drag and drop support",
  ]);

  assertEquals(bump, "minor");
});

Deno.test("determineVersionBump returns patch for fix and perf commits", () => {
  const bump = determineVersionBump([
    "docs: improve readme formatting",
    "perf(player): cache playlist lookup",
    "fix(api): guard missing album id",
  ]);

  assertEquals(bump, "patch");
});

Deno.test("determineVersionBump ignores release commits", () => {
  const bump = determineVersionBump([
    "chore(release): v1.2.3",
    "docs: update changelog",
  ]);

  assertEquals(bump, "none");
});

Deno.test("incrementSemver applies patch, minor, and major bumps", () => {
  assertEquals(incrementSemver("1.2.3", "patch"), "1.2.4");
  assertEquals(incrementSemver("1.2.3", "minor"), "1.3.0");
  assertEquals(incrementSemver("1.2.3", "major"), "2.0.0");
});

Deno.test("parseGitLogMessages splits NUL-separated git messages", () => {
  const messages = parseGitLogMessages(
    "feat: add queue support\x1e\nfix: prevent null pointer\x1e\n",
  );

  assertEquals(messages, [
    "feat: add queue support",
    "fix: prevent null pointer",
  ]);
});

Deno.test("getCommitBump detects breaking change footer", () => {
  const bump = getCommitBump(
    "chore: migrate transport\n\nBREAKING CHANGE: websocket payload changed",
  );

  assertEquals(bump, "major");
});
