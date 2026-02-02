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

export interface AdminAuthStatus {
  isConfigured: boolean;
  isAuthorized: boolean;
}

type Credentials = { username: string; password: string };

function getConfiguredAdminCredentials(): Credentials | null {
  const username = Deno.env.get(ADMIN_USER_ENV) ?? "";
  const password = Deno.env.get(ADMIN_PASS_ENV) ?? "";

  if (!username || !password) {
    return null;
  }

  return { username, password };
}

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
 * @returns `{ isConfigured, isAuthorized }` — use `isAuthorized` to show/hide
 *   admin-only UI on GET `/` without triggering a 401 challenge.
 */
export function getAdminAuthStatus(req: Request): AdminAuthStatus {
  const configured = getConfiguredAdminCredentials();
  if (!configured) {
    return { isConfigured: false, isAuthorized: false };
  }

  const provided = parseBasicAuthHeader(req.headers.get("Authorization"));
  if (!provided) {
    return { isConfigured: true, isAuthorized: false };
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
    isAuthorized: usernameMatches && passwordMatches,
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
  const { isConfigured, isAuthorized } = getAdminAuthStatus(req);

  if (!isConfigured) {
    return new Response("Admin credentials not configured", {
      status: 500,
      headers: { "Content-Type": "text/plain" },
    });
  }

  if (!isAuthorized) {
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
