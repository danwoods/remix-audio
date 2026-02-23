/** @file Tests for coverage-check LCOV parsing including function coverage. */

import { assertEquals } from "@std/assert";
import { parseLcovContent } from "./coverage-check.ts";

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
