/** @file Tests for JSON schema endpoint handler */
import { assertEquals } from "@std/assert";
import { handleJsonSchema } from "../../../server/handlers/json.schema.ts";

Deno.test("JSON schema handler returns schema document for data endpoint", async () => {
  const req = new Request("http://localhost:8000/_json/schema");
  const response = await handleJsonSchema(req, {});

  assertEquals(response.status, 200);
  assertEquals(response.headers.get("Content-Type"), "application/schema+json");

  const body = await response.json();
  assertEquals(typeof body.$schema, "string");
  assertEquals(body.type, "object");
  assertEquals(body.properties.dataFormatVersion.const, "1.0.0");
  assertEquals(Array.isArray(body.required), true);
  assertEquals(body.required.includes("compiledAt"), true);
  assertEquals(typeof body.$defs.scope, "object");
});
