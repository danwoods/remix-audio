/** @file JSON data handler for artist-scoped export endpoint. */
import { createScopedJsonDataResponse } from "../utils/jsonData.ts";

/**
 * Handle artist JSON export endpoint.
 *
 * Route: GET `/artists/:artistId/_json`
 */
export async function handleArtistJsonData(
  req: Request,
  params: Record<string, string>,
): Promise<Response> {
  const { artistId } = params;
  if (!artistId) {
    return new Response("Missing artist ID", { status: 400 });
  }

  return await createScopedJsonDataResponse(req, {
    level: "artist",
    artistId,
  });
}
