/** @file Basic authentication utilities for admin endpoints */

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
