#!/usr/bin/env -S deno run
/** @file Parse LCOV output and compare to coverage-baseline.json, or write new baseline.
 *
 * Enforces line, branch, and function coverage metrics (LF/LH, BRF/BRH, FNF/FNH).
 *
 * Default (check) mode: Compare current coverage to baseline; exit 1 if regressed.
 * --write-baseline or -w: Write current coverage to coverage-baseline.json only if
 * coverage has stayed the same or improved (>= existing baseline). Exit 1 if regressed.
 *
 * Usage:
 *   deno run --allow-read scripts/coverage-check.ts
 *   deno run --allow-read --allow-write scripts/coverage-check.ts --write-baseline
 */

const LCOV_PATH = "cov.lcov";
const BASELINE_PATH = "coverage-baseline.json";

interface Baseline {
  lineCoverage: number;
  branchCoverage: number;
  functionCoverage: number;
}

/** Parses LCOV content and returns line, branch, and function coverage percentages. */
export function parseLcovContent(
  content: string,
): { lineCoverage: number; branchCoverage: number; functionCoverage: number } {
  let lf = 0,
    lh = 0,
    brf = 0,
    brh = 0,
    fnf = 0,
    fnh = 0;
  for (const line of content.split("\n")) {
    if (line.startsWith("LF:")) lf += parseInt(line.slice(3), 10);
    if (line.startsWith("LH:")) lh += parseInt(line.slice(3), 10);
    if (line.startsWith("BRF:")) brf += parseInt(line.slice(4), 10);
    if (line.startsWith("BRH:")) brh += parseInt(line.slice(4), 10);
    if (line.startsWith("FNF:")) fnf += parseInt(line.slice(4), 10);
    if (line.startsWith("FNH:")) fnh += parseInt(line.slice(4), 10);
  }
  const lineCoverage = lf ? (lh / lf) * 100 : 100;
  const branchCoverage = brf ? (brh / brf) * 100 : 100;
  const functionCoverage = fnf ? (fnh / fnf) * 100 : 100;
  const round = (n: number) => Math.round(n * 10) / 10;
  return {
    lineCoverage: round(lineCoverage),
    branchCoverage: round(branchCoverage),
    functionCoverage: round(functionCoverage),
  };
}

function parseLcov(
  path: string,
): { lineCoverage: number; branchCoverage: number; functionCoverage: number } {
  const content = Deno.readTextFileSync(path);
  return parseLcovContent(content);
}

/** Result of comparing current coverage to baseline. */
export interface CheckResult {
  ok: boolean;
  errors: string[];
}

/** Compares current coverage metrics to baseline. All three metrics (line, branch,
 * function) must be present in the baseline and current must be >= baseline.
 */
export function checkCoverageAgainstBaseline(
  current: {
    lineCoverage: number;
    branchCoverage: number;
    functionCoverage: number;
  },
  baseline: Partial<Baseline>,
): CheckResult {
  const errors: string[] = [];
  const lineOk = baseline.lineCoverage != null &&
    current.lineCoverage >= baseline.lineCoverage;
  const branchOk = baseline.branchCoverage != null &&
    current.branchCoverage >= baseline.branchCoverage;
  const functionOk = baseline.functionCoverage != null &&
    current.functionCoverage >= baseline.functionCoverage;

  if (lineOk && branchOk && functionOk) {
    return { ok: true, errors: [] };
  }

  if (!lineOk && baseline.lineCoverage != null) {
    errors.push(
      `Line coverage regressed: ${
        current.lineCoverage.toFixed(1)
      }% < ${baseline.lineCoverage}%`,
    );
  }
  if (!branchOk && baseline.branchCoverage != null) {
    errors.push(
      `Branch coverage regressed: ${
        current.branchCoverage.toFixed(1)
      }% < ${baseline.branchCoverage}%`,
    );
  }
  if (!functionOk) {
    if (baseline.functionCoverage == null) {
      errors.push(
        "Baseline missing required functionCoverage. Run: deno task coverage:baseline",
      );
    } else {
      errors.push(
        `Function coverage regressed: ${
          current.functionCoverage.toFixed(1)
        }% < ${baseline.functionCoverage}%`,
      );
    }
  }
  return { ok: false, errors };
}

function main() {
  const writeBaseline = Deno.args.includes("--write-baseline") ||
    Deno.args.includes("-w");

  try {
    Deno.statSync(LCOV_PATH);
  } catch {
    console.error(
      `Error: ${LCOV_PATH} not found. Run coverage first (deno task test:coverage && deno coverage cov --lcov --output=cov.lcov).`,
    );
    Deno.exit(1);
  }

  const { lineCoverage, branchCoverage, functionCoverage } = parseLcov(
    LCOV_PATH,
  );

  if (writeBaseline) {
    let existing: Partial<Baseline> | null = null;
    try {
      existing = JSON.parse(Deno.readTextFileSync(BASELINE_PATH));
    } catch {
      /* No baseline yet; allow initial write */
    }
    if (existing) {
      const lineOk = existing.lineCoverage == null ||
        lineCoverage >= existing.lineCoverage;
      const branchOk = existing.branchCoverage == null ||
        branchCoverage >= existing.branchCoverage;
      const functionOk = existing.functionCoverage == null ||
        functionCoverage >= existing.functionCoverage;
      if (!lineOk || !branchOk || !functionOk) {
        if (!lineOk) {
          console.error(
            `Cannot write baseline: line coverage regressed (${
              lineCoverage.toFixed(1)
            }% < ${existing.lineCoverage}%)`,
          );
        }
        if (!branchOk) {
          console.error(
            `Cannot write baseline: branch coverage regressed (${
              branchCoverage.toFixed(1)
            }% < ${existing.branchCoverage}%)`,
          );
        }
        if (!functionOk) {
          console.error(
            `Cannot write baseline: function coverage regressed (${
              functionCoverage.toFixed(1)
            }% < ${existing.functionCoverage}%)`,
          );
        }
        Deno.exit(1);
      }
    }
    const baseline: Baseline = {
      lineCoverage,
      branchCoverage,
      functionCoverage,
    };
    Deno.writeTextFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2));
    console.log(
      `Wrote ${BASELINE_PATH}: line ${baseline.lineCoverage}%, branch ${baseline.branchCoverage}%, function ${baseline.functionCoverage}%`,
    );
    Deno.exit(0);
  }

  let baseline: Partial<Baseline>;
  try {
    baseline = JSON.parse(Deno.readTextFileSync(BASELINE_PATH));
  } catch {
    console.error(
      `Error: ${BASELINE_PATH} not found. Run: deno task coverage:baseline`,
    );
    Deno.exit(1);
  }

  const result = checkCoverageAgainstBaseline(
    { lineCoverage, branchCoverage, functionCoverage },
    baseline,
  );

  if (result.ok) {
    console.log(
      `Coverage OK: line ${
        lineCoverage.toFixed(1)
      }% (>= ${baseline.lineCoverage}%), branch ${
        branchCoverage.toFixed(1)
      }% (>= ${baseline.branchCoverage}%), function ${
        functionCoverage.toFixed(1)
      }% (>= ${baseline.functionCoverage}%)`,
    );
    Deno.exit(0);
  }

  for (const err of result.errors) {
    console.error(err);
  }
  Deno.exit(1);
}

if (import.meta.main) {
  main();
}
