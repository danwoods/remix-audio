/**
 * @file Basic authentication utilities for admin endpoints
 *
 * Admin access is controlled by HTTP Basic Auth. Credentials are read from
 * environment variables `ADMIN_USER` and `ADMIN_PASS`. If either is unset or
 * empty, admin is considered "not configured" and protected routes return 500.
 *
 * **Flow:**
 * 1. User visits a protected route (e.g. GET `/admin` or POST `/` for uploads).
 * 2. Handler calls `requireAdminAuth(req)`. If credentials are missing or
 *    invalid, it returns a 401 with `WWW-Authenticate: Basic`, prompting the
 *    browser to show a login dialog.
 * 3. After the user submits valid credentials, the browser resends the request
 *    with an `Authorization: Basic <base64>` header.
 * 4. Credentials are compared using a timing-safe comparison to mitigate
 *    timing side-channel attacks.
 *
 * **Protected routes:** GET `/admin` (login entry point), POST `/` (file upload).
 * **Auth state on GET `/`:** Handlers use `getAdminAuthStatus(req)` to know
 * whether to show admin-only UI (e.g. upload button) without challenging.
 */

const ADMIN_USER_ENV = "ADMIN_USER";
const ADMIN_PASS_ENV = "ADMIN_PASS";
const AUTH_REALM = "Admin";

/**
 * Result of checking admin authentication for a request.
 *
 * @property isConfigured - Whether `ADMIN_USER` and `ADMIN_PASS` are set. If
 *   false, protected routes return 500 instead of 401.
 * @property isAdmin - Whether the request carries valid admin credentials
 *   (via `Authorization: Basic`). Use this to show/hide admin-only UI without
 *   triggering a 401 challenge.
 */
export interface AdminAuthStatus {
  isConfigured: boolean;
  isAdmin: boolean;
}

/** Internal representation of username and password (env or parsed from header). */
type Credentials = { username: string; password: string };

/**
 * Reads admin credentials from environment variables.
 *
 * @returns `{ username, password }` if both `ADMIN_USER` and `ADMIN_PASS` are
 *   set and non-empty; otherwise `null` (admin not configured).
 */
function getConfiguredAdminCredentials(): Credentials | null {
  const username = Deno.env.get(ADMIN_USER_ENV) ?? "";
  const password = Deno.env.get(ADMIN_PASS_ENV) ?? "";

  if (!username || !password) {
    return null;
  }

  return { username, password };
}

/**
 * Parses an HTTP Basic Auth header value into username and password.
 *
 * Expects `"Basic <base64(username:password)>"`. Invalid or malformed values
 * (e.g. wrong scheme, bad base64, missing colon) return `null`.
 *
 * @param headerValue - The raw `Authorization` header value, or `null`.
 * @returns `{ username, password }` if the header is valid Basic auth;
 *   otherwise `null`.
 */
function parseBasicAuthHeader(headerValue: string | null): Credentials | null {
  if (!headerValue) {
    return null;
  }

  const [scheme, encoded] = headerValue.trim().split(/\s+/, 2);
  if (!scheme || scheme.toLowerCase() !== "basic" || !encoded) {
    return null;
  }

  try {
    // Decode base64 to bytes, then decode as UTF-8
    const binaryString = globalThis.atob(encoded);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const decoded = new TextDecoder("utf-8").decode(bytes);

    const separatorIndex = decoded.indexOf(":");
    if (separatorIndex === -1) {
      return null;
    }

    const username = decoded.slice(0, separatorIndex);
    const password = decoded.slice(separatorIndex + 1);
    return { username, password };
  } catch {
    return null;
  }
}

/**
 * Compares two strings in constant time to mitigate timing side-channel attacks.
 *
 * Uses fixed iteration over the longer length and pads the shorter string so
 * that comparison time does not leak information about length or character
 * position of the first difference.
 *
 * @param a - First string to compare.
 * @param b - Second string to compare.
 * @returns `true` if `a` and `b` are identical; otherwise `false`.
 */
function timingSafeEqual(a: string, b: string): boolean {
  // Always iterate over max length to avoid timing side-channel
  const maxLength = Math.max(a.length, b.length);

  // Pre-pad strings to eliminate conditionals in the loop
  const aPadded = a.padEnd(maxLength, "\0");
  const bPadded = b.padEnd(maxLength, "\0");

  // Track both length difference and content difference
  let result = a.length ^ b.length;

  // Always iterate the full max length without any conditionals
  for (let i = 0; i < maxLength; i++) {
    result |= aPadded.charCodeAt(i) ^ bPadded.charCodeAt(i);
  }

  return result === 0;
}

/**
 * Determine whether admin credentials are configured and whether the request
 * has valid admin credentials (via the `Authorization` header).
 *
 * @param req - The incoming request (may include `Authorization: Basic ...`)
 * @returns `{ isConfigured, isAdmin }` — use `isAdmin` to show/hide
 *   admin-only UI on GET `/` without triggering a 401 challenge.
 */
export function getAdminAuthStatus(req: Request): AdminAuthStatus {
  const configured = getConfiguredAdminCredentials();
  if (!configured) {
    return { isConfigured: false, isAdmin: false };
  }

  const provided = parseBasicAuthHeader(req.headers.get("Authorization"));
  if (!provided) {
    return { isConfigured: true, isAdmin: false };
  }

  const usernameMatches = timingSafeEqual(
    provided.username,
    configured.username,
  );
  const passwordMatches = timingSafeEqual(
    provided.password,
    configured.password,
  );

  return {
    isConfigured: true,
    isAdmin: usernameMatches && passwordMatches,
  };
}

/**
 * Enforce admin authentication for the request. Use in protected handlers
 * (e.g. GET `/admin`, POST `/`).
 *
 * @param req - The incoming request
 * @returns A `Response` to send (401 Unauthorized, or 500 if admin not
 *   configured); or `null` if the request is authorized. When non-null, the
 *   handler should return this response immediately.
 */
export function requireAdminAuth(req: Request): Response | null {
  const { isConfigured, isAdmin } = getAdminAuthStatus(req);

  if (!isConfigured) {
    return new Response("Admin credentials not configured", {
      status: 500,
      headers: { "Content-Type": "text/plain" },
    });
  }

  if (!isAdmin) {
    return new Response("Unauthorized", {
      status: 401,
      headers: {
        "Content-Type": "text/plain",
        "WWW-Authenticate": `Basic realm="${AUTH_REALM}", charset="UTF-8"`,
      },
    });
  }

  return null;
}
