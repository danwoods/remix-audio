#!/usr/bin/env -S deno run
/** @file Pre-push coverage gate: run tests with coverage and enforce baseline.
 *
 * This script is invoked by the `.husky/pre-push` hook before every push. It
 * runs all tests with coverage instrumentation, generates LCOV output, and
 * compares the result to `coverage-baseline.json`. If line or branch coverage
 * drops below the baseline, the script exits 1 and the push is blocked.
 *
 * ## What this script does
 *
 * 1. Runs `deno task test:coverage:ci` (tests + coverage check)
 * 2. Passes through the exit code (0 = pass, 1 = fail)
 *
 * ## What this script does NOT do
 *
 * - It does **not** update the baseline. Baseline updates happen only in the
 *   CircleCI release job when a new version is tagged. See README Coverage
 *   section for details.
 *
 * ## Usage
 *
 * ```bash
 * deno run --allow-run scripts/pre-push-coverage.ts
 * ```
 *
 * The husky pre-push hook invokes this script automatically on `git push`.
 */

const cmd = new Deno.Command("deno", {
  args: ["task", "test:coverage:ci"],
  cwd: Deno.cwd(),
  stdout: "inherit",
  stderr: "inherit",
});

const { code } = await cmd.output();
Deno.exit(code);
