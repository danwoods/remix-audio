/** @file Tests for basicAuth utility */
import { assertEquals } from "@std/assert";
import {
  getAdminAuthStatus,
  requireAdminAuth,
} from "../../../server/utils/basicAuth.ts";

Deno.test("getAdminAuthStatus returns isConfigured false when credentials not set", () => {
  const originalUser = Deno.env.get("ADMIN_USER");
  const originalPass = Deno.env.get("ADMIN_PASS");
  try {
    Deno.env.delete("ADMIN_USER");
    Deno.env.delete("ADMIN_PASS");
    const req = new Request("http://localhost/");
    const status = getAdminAuthStatus(req);
    assertEquals(status, { isConfigured: false, isAdmin: false });
  } finally {
    if (originalUser === undefined) Deno.env.delete("ADMIN_USER");
    else Deno.env.set("ADMIN_USER", originalUser);
    if (originalPass === undefined) Deno.env.delete("ADMIN_PASS");
    else Deno.env.set("ADMIN_PASS", originalPass);
  }
});

Deno.test("getAdminAuthStatus returns isAdmin false when no Authorization header", () => {
  const originalUser = Deno.env.get("ADMIN_USER");
  const originalPass = Deno.env.get("ADMIN_PASS");
  try {
    Deno.env.set("ADMIN_USER", "admin");
    Deno.env.set("ADMIN_PASS", "secret");
    const req = new Request("http://localhost/");
    const status = getAdminAuthStatus(req);
    assertEquals(status, { isConfigured: true, isAdmin: false });
  } finally {
    if (originalUser === undefined) Deno.env.delete("ADMIN_USER");
    else Deno.env.set("ADMIN_USER", originalUser);
    if (originalPass === undefined) Deno.env.delete("ADMIN_PASS");
    else Deno.env.set("ADMIN_PASS", originalPass);
  }
});

Deno.test("getAdminAuthStatus returns isAdmin false when credentials wrong", () => {
  const originalUser = Deno.env.get("ADMIN_USER");
  const originalPass = Deno.env.get("ADMIN_PASS");
  try {
    Deno.env.set("ADMIN_USER", "admin");
    Deno.env.set("ADMIN_PASS", "secret");
    const wrong = `Basic ${globalThis.btoa("wrong:wrong")}`;
    const req = new Request("http://localhost/", {
      headers: { Authorization: wrong },
    });
    const status = getAdminAuthStatus(req);
    assertEquals(status, { isConfigured: true, isAdmin: false });
  } finally {
    if (originalUser === undefined) Deno.env.delete("ADMIN_USER");
    else Deno.env.set("ADMIN_USER", originalUser);
    if (originalPass === undefined) Deno.env.delete("ADMIN_PASS");
    else Deno.env.set("ADMIN_PASS", originalPass);
  }
});

Deno.test("getAdminAuthStatus returns isAdmin true when credentials valid", () => {
  const originalUser = Deno.env.get("ADMIN_USER");
  const originalPass = Deno.env.get("ADMIN_PASS");
  try {
    Deno.env.set("ADMIN_USER", "admin");
    Deno.env.set("ADMIN_PASS", "secret");
    const auth = `Basic ${globalThis.btoa("admin:secret")}`;
    const req = new Request("http://localhost/", {
      headers: { Authorization: auth },
    });
    const status = getAdminAuthStatus(req);
    assertEquals(status, { isConfigured: true, isAdmin: true });
  } finally {
    if (originalUser === undefined) Deno.env.delete("ADMIN_USER");
    else Deno.env.set("ADMIN_USER", originalUser);
    if (originalPass === undefined) Deno.env.delete("ADMIN_PASS");
    else Deno.env.set("ADMIN_PASS", originalPass);
  }
});

Deno.test("requireAdminAuth returns 500 when credentials not configured", async () => {
  const originalUser = Deno.env.get("ADMIN_USER");
  const originalPass = Deno.env.get("ADMIN_PASS");
  try {
    Deno.env.delete("ADMIN_USER");
    Deno.env.delete("ADMIN_PASS");
    const req = new Request("http://localhost/");
    const res = requireAdminAuth(req);
    assertEquals(res !== null, true);
    assertEquals(res!.status, 500);
    const text = await res!.text();
    assertEquals(text.includes("credentials"), true);
  } finally {
    if (originalUser === undefined) Deno.env.delete("ADMIN_USER");
    else Deno.env.set("ADMIN_USER", originalUser);
    if (originalPass === undefined) Deno.env.delete("ADMIN_PASS");
    else Deno.env.set("ADMIN_PASS", originalPass);
  }
});

Deno.test("requireAdminAuth returns 401 with WWW-Authenticate when not authorized", () => {
  const originalUser = Deno.env.get("ADMIN_USER");
  const originalPass = Deno.env.get("ADMIN_PASS");
  try {
    Deno.env.set("ADMIN_USER", "admin");
    Deno.env.set("ADMIN_PASS", "secret");
    const req = new Request("http://localhost/");
    const res = requireAdminAuth(req);
    assertEquals(res !== null, true);
    assertEquals(res!.status, 401);
    assertEquals(
      res!.headers.get("WWW-Authenticate"),
      'Basic realm="Admin", charset="UTF-8"',
    );
  } finally {
    if (originalUser === undefined) Deno.env.delete("ADMIN_USER");
    else Deno.env.set("ADMIN_USER", originalUser);
    if (originalPass === undefined) Deno.env.delete("ADMIN_PASS");
    else Deno.env.set("ADMIN_PASS", originalPass);
  }
});

Deno.test("requireAdminAuth returns null when authorized", () => {
  const originalUser = Deno.env.get("ADMIN_USER");
  const originalPass = Deno.env.get("ADMIN_PASS");
  try {
    Deno.env.set("ADMIN_USER", "admin");
    Deno.env.set("ADMIN_PASS", "secret");
    const auth = `Basic ${globalThis.btoa("admin:secret")}`;
    const req = new Request("http://localhost/", {
      headers: { Authorization: auth },
    });
    const res = requireAdminAuth(req);
    assertEquals(res, null);
  } finally {
    if (originalUser === undefined) Deno.env.delete("ADMIN_USER");
    else Deno.env.set("ADMIN_USER", originalUser);
    if (originalPass === undefined) Deno.env.delete("ADMIN_PASS");
    else Deno.env.set("ADMIN_PASS", originalPass);
  }
});
