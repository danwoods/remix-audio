/** @file Tests for coverage-check LCOV parsing and baseline comparison. */

import { assertEquals } from "@std/assert";
import {
  checkCoverageAgainstBaseline,
  parseLcovContent,
} from "./coverage-check.ts";

Deno.test(
  "parseLcovContent extracts line, branch, and function coverage from LCOV",
  () => {
    const lcov = `
SF:file.ts
FN:1,foo
FN:5,bar
FNDA:1,foo
FNDA:0,bar
FNF:2
FNH:1
DA:1,1
DA:2,2
DA:3,0
LH:2
LF:3
BRF:4
BRH:3
end_of_record
`;
    const result = parseLcovContent(lcov);
    assertEquals(result.lineCoverage, 66.7);
    assertEquals(result.branchCoverage, 75);
    assertEquals(result.functionCoverage, 50);
  },
);

Deno.test(
  "checkCoverageAgainstBaseline fails when baseline lacks functionCoverage",
  () => {
    const current = {
      lineCoverage: 70,
      branchCoverage: 75,
      functionCoverage: 80,
    };
    const baseline = { lineCoverage: 65, branchCoverage: 70 };
    const result = checkCoverageAgainstBaseline(current, baseline);
    assertEquals(result.ok, false);
    assertEquals(result.errors.length, 1);
    assertEquals(
      result.errors[0],
      "Baseline missing required functionCoverage. Run: deno task coverage:baseline",
    );
  },
);
