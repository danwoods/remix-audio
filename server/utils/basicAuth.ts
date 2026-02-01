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
    const decoded = globalThis.atob(encoded);
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
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
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
