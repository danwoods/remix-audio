#!/usr/bin/env -S deno run
/** @file Parse LCOV output and compare to coverage-baseline.json, or write new baseline.
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
}

function parseLcov(
  path: string,
): { lineCoverage: number; branchCoverage: number } {
  const content = Deno.readTextFileSync(path);
  let lf = 0,
    lh = 0,
    brf = 0,
    brh = 0;
  for (const line of content.split("\n")) {
    if (line.startsWith("LF:")) lf += parseInt(line.slice(3), 10);
    if (line.startsWith("LH:")) lh += parseInt(line.slice(3), 10);
    if (line.startsWith("BRF:")) brf += parseInt(line.slice(4), 10);
    if (line.startsWith("BRH:")) brh += parseInt(line.slice(4), 10);
  }
  const lineCoverage = lf ? (lh / lf) * 100 : 100;
  const branchCoverage = brf ? (brh / brf) * 100 : 100;
  return { lineCoverage, branchCoverage };
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

  const { lineCoverage, branchCoverage } = parseLcov(LCOV_PATH);

  if (writeBaseline) {
    let existing: Baseline | null = null;
    try {
      existing = JSON.parse(Deno.readTextFileSync(BASELINE_PATH));
    } catch {
      /* No baseline yet; allow initial write */
    }
    if (existing) {
      const lineOk = lineCoverage >= existing.lineCoverage;
      const branchOk = branchCoverage >= existing.branchCoverage;
      if (!lineOk || !branchOk) {
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
        Deno.exit(1);
      }
    }
    const baseline: Baseline = {
      lineCoverage: Math.round(lineCoverage * 10) / 10,
      branchCoverage: Math.round(branchCoverage * 10) / 10,
    };
    Deno.writeTextFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2));
    console.log(
      `Wrote ${BASELINE_PATH}: line ${baseline.lineCoverage}%, branch ${baseline.branchCoverage}%`,
    );
    Deno.exit(0);
  }

  let baseline: Baseline;
  try {
    baseline = JSON.parse(Deno.readTextFileSync(BASELINE_PATH));
  } catch {
    console.error(
      `Error: ${BASELINE_PATH} not found. Run: deno task coverage:baseline`,
    );
    Deno.exit(1);
  }

  const lineOk = lineCoverage >= baseline.lineCoverage;
  const branchOk = branchCoverage >= baseline.branchCoverage;

  if (lineOk && branchOk) {
    console.log(
      `Coverage OK: line ${
        lineCoverage.toFixed(1)
      }% (>= ${baseline.lineCoverage}%), branch ${
        branchCoverage.toFixed(1)
      }% (>= ${baseline.branchCoverage}%)`,
    );
    Deno.exit(0);
  }

  if (!lineOk) {
    console.error(
      `Line coverage regressed: ${
        lineCoverage.toFixed(1)
      }% < ${baseline.lineCoverage}%`,
    );
  }
  if (!branchOk) {
    console.error(
      `Branch coverage regressed: ${
        branchCoverage.toFixed(1)
      }% < ${baseline.branchCoverage}%`,
    );
  }
  Deno.exit(1);
}

main();
