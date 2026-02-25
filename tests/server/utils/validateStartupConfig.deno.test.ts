/** @file Tests for validateStartupConfig utility */
import { assertEquals } from "@std/assert";
import {
  logStartupConfigIssuesAndExit,
  validateStartupConfig,
} from "../../../server/utils/validateStartupConfig.ts";

function saveRestoreEnv(keys: string[]): () => void {
  const saved: Record<string, string | undefined> = {};
  for (const key of keys) {
    saved[key] = Deno.env.get(key);
  }
  return () => {
    for (const key of keys) {
      if (saved[key] === undefined) Deno.env.delete(key);
      else Deno.env.set(key, saved[key]!);
    }
  };
}

const S3_KEYS = [
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "STORAGE_REGION",
  "STORAGE_BUCKET",
];
const ALL_KEYS = [...S3_KEYS, "E2E_MODE", "ADMIN_USER", "ADMIN_PASS"];

Deno.test("skips S3 validation when E2E_MODE=1", () => {
  const restore = saveRestoreEnv(ALL_KEYS);
  try {
    Deno.env.set("E2E_MODE", "1");
    for (const k of S3_KEYS) Deno.env.delete(k);
    Deno.env.delete("ADMIN_USER");
    Deno.env.delete("ADMIN_PASS");

    const result = validateStartupConfig();

    assertEquals(result.ok, true);
    assertEquals(result.s3Missing, []);
  } finally {
    restore();
  }
});

Deno.test("returns ok and empty s3Missing when all S3 vars set", () => {
  const restore = saveRestoreEnv(ALL_KEYS);
  try {
    Deno.env.delete("E2E_MODE");
    Deno.env.set("AWS_ACCESS_KEY_ID", "key");
    Deno.env.set("AWS_SECRET_ACCESS_KEY", "secret");
    Deno.env.set("STORAGE_REGION", "us-east-1");
    Deno.env.set("STORAGE_BUCKET", "my-bucket");

    const result = validateStartupConfig();

    assertEquals(result.ok, true);
    assertEquals(result.s3Missing, []);
  } finally {
    restore();
  }
});

Deno.test("returns not ok and lists missing S3 vars", () => {
  const restore = saveRestoreEnv(ALL_KEYS);
  try {
    Deno.env.delete("E2E_MODE");
    Deno.env.set("AWS_ACCESS_KEY_ID", "key");
    Deno.env.delete("AWS_SECRET_ACCESS_KEY");
    Deno.env.delete("STORAGE_REGION");
    Deno.env.set("STORAGE_BUCKET", "bucket");

    const result = validateStartupConfig();

    assertEquals(result.ok, false);
    assertEquals(result.s3Missing, ["AWS_SECRET_ACCESS_KEY", "STORAGE_REGION"]);
  } finally {
    restore();
  }
});

Deno.test("sets adminDisabled when both ADMIN_USER and ADMIN_PASS empty", () => {
  const restore = saveRestoreEnv(ALL_KEYS);
  try {
    Deno.env.delete("E2E_MODE");
    for (const k of S3_KEYS) Deno.env.set(k, "x");
    Deno.env.delete("ADMIN_USER");
    Deno.env.delete("ADMIN_PASS");

    const result = validateStartupConfig();

    assertEquals(result.adminDisabled, true);
  } finally {
    restore();
  }
});

Deno.test("sets adminDisabled false when both ADMIN_USER and ADMIN_PASS set", () => {
  const restore = saveRestoreEnv(ALL_KEYS);
  try {
    Deno.env.delete("E2E_MODE");
    for (const k of S3_KEYS) Deno.env.set(k, "x");
    Deno.env.set("ADMIN_USER", "admin");
    Deno.env.set("ADMIN_PASS", "secret");

    const result = validateStartupConfig();

    assertEquals(result.adminDisabled, false);
  } finally {
    restore();
  }
});

Deno.test("sets adminDisabled true when only one of ADMIN_USER or ADMIN_PASS set", () => {
  const restore = saveRestoreEnv(ALL_KEYS);
  try {
    Deno.env.delete("E2E_MODE");
    for (const k of S3_KEYS) Deno.env.set(k, "x");
    Deno.env.set("ADMIN_USER", "admin");
    Deno.env.delete("ADMIN_PASS");

    const result = validateStartupConfig();

    assertEquals(result.adminDisabled, true);
  } finally {
    restore();
  }
});

Deno.test("treats empty string as missing", () => {
  const restore = saveRestoreEnv(ALL_KEYS);
  try {
    Deno.env.delete("E2E_MODE");
    Deno.env.set("AWS_ACCESS_KEY_ID", "key");
    Deno.env.set("AWS_SECRET_ACCESS_KEY", "");
    Deno.env.set("STORAGE_REGION", "  ");
    Deno.env.set("STORAGE_BUCKET", "bucket");

    const result = validateStartupConfig();

    assertEquals(result.ok, false);
    assertEquals(result.s3Missing, ["AWS_SECRET_ACCESS_KEY", "STORAGE_REGION"]);
  } finally {
    restore();
  }
});

Deno.test("logStartupConfigIssuesAndExit calls exitFn when result not ok", () => {
  const exitFn = (code?: number) => {
    throw new Error(`exit:${code}`);
  };
  const result = {
    ok: false,
    s3Missing: ["AWS_ACCESS_KEY_ID"],
    adminDisabled: false,
  };
  let threw = false;
  try {
    logStartupConfigIssuesAndExit(result, exitFn);
  } catch (e) {
    threw = true;
    assertEquals((e as Error).message, "exit:1");
  }
  assertEquals(threw, true);
});
