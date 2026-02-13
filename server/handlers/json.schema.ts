/** @file Handler for JSON export schema. */
import dataExportSchema from "../schemas/data-export.schema.json" with {
  type: "json",
};

const SCHEMA_CACHE_CONTROL = "public, max-age=86400, immutable";

/**
 * Handle JSON Schema endpoint.
 *
 * Route: GET `/_json/schema`
 */
export async function handleJsonSchema(
  _req: Request,
  _params: Record<string, string>,
): Promise<Response> {
  return new Response(JSON.stringify(dataExportSchema), {
    status: 200,
    headers: {
      "Content-Type": "application/schema+json",
      "Cache-Control": SCHEMA_CACHE_CONTROL,
    },
  });
}
