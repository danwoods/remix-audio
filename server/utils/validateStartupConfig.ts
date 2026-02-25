/** @file Startup configuration validation for S3 and admin env vars.

 * Runs at server startup. Fails fast when S3 vars are missing; logs admin
 * status when admin credentials are not configured.
 *
 * @module
 */

/** Required environment variables for S3 storage */
const S3_REQUIRED = [
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "STORAGE_REGION",
  "STORAGE_BUCKET",
] as const;

/** Result of startup configuration validation */
export interface ValidationResult {
  /** false when any S3 var is missing */
  ok: boolean;
  /** Names of missing S3 env vars */
  s3Missing: string[];
  /** true when both ADMIN_USER and ADMIN_PASS are unset or empty */
  adminDisabled: boolean;
}

function isSet(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Validates startup configuration (S3 env vars and admin status).
 * Skips S3 validation when E2E_MODE=1.
 *
 * @returns ValidationResult with ok, s3Missing, and adminDisabled
 */
export function validateStartupConfig(): ValidationResult {
  if (Deno.env.get("E2E_MODE") === "1") {
    return {
      ok: true,
      s3Missing: [],
      adminDisabled: !isSet(Deno.env.get("ADMIN_USER")) ||
        !isSet(Deno.env.get("ADMIN_PASS")),
    };
  }

  const s3Missing = S3_REQUIRED.filter(
    (key) => !isSet(Deno.env.get(key)),
  );
  const adminDisabled = !isSet(Deno.env.get("ADMIN_USER")) ||
    !isSet(Deno.env.get("ADMIN_PASS"));

  return {
    ok: s3Missing.length === 0,
    s3Missing: [...s3Missing],
    adminDisabled,
  };
}

/**
 * Logs user-friendly startup config error messages and exits.
 * Use when validation result has ok: false.
 *
 * @param result - Validation result from validateStartupConfig
 * @param exitFn - Function to call instead of Deno.exit (for testing)
 */
export function logStartupConfigIssuesAndExit(
  result: ValidationResult,
  exitFn: (code?: number) => never = Deno.exit,
): never {
  console.error("");
  console.error("Configuration error: S3 storage is not configured");
  console.error("");
  console.error("Missing required environment variables:");
  for (const name of result.s3Missing) {
    console.error(`  - ${name}`);
  }
  console.error("");
  console.error(
    "Copy .env.sample to .env and set these variables. See README.md for details.",
  );
  if (result.adminDisabled) {
    console.error("");
    console.error(
      "Admin panel is also disabled (ADMIN_USER and ADMIN_PASS not set).",
    );
  }
  console.error("");
  exitFn(1);
}
