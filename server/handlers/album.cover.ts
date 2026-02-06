/** @file Handler for album cover image extracted from ID3 tags of a track.
 *
 * Serves cover art for an album at `GET /artists/:artistId/albums/:albumId/cover`.
 * Loads the first track (by track number) from S3, extracts ID3 image as a data URL
 * via {@link getID3Tags}, decodes it with {@link decodeDataUrl} from `app/util/data-url.ts`,
 * and returns the image bytes with appropriate Content-Type and Cache-Control.
 * Results are cached in memory by album key.
 */

import { decodeDataUrl } from "../../app/util/data-url.ts";
import { getObjectBytes, getUploadedFiles } from "../../app/util/s3.server.ts";
import { getAlbum, sortTracksByTrackNumber } from "../../app/util/files.ts";
import { getID3Tags } from "../../app/util/id3.ts";
import { createLogger } from "../../app/util/logger.ts";

const logger = createLogger("Album Cover");

/** In-memory cache: album key -> { body, contentType } */
const coverCache = new Map<
  string,
  { body: Uint8Array; contentType: string }
>();

/**
 * Get S3 object key from a track URL.
 *
 * @param trackUrl - Full track URL (e.g. https://bucket.s3.region.amazonaws.com/artist/album/1__Title.mp3)
 * @returns Decoded path segment used as S3 key (e.g. "artist/album/1__Title.mp3")
 */
export function getKeyFromTrackUrl(trackUrl: string): string {
  const pathname = new URL(trackUrl).pathname;
  const key = pathname.startsWith("/") ? pathname.slice(1) : pathname;
  try {
    return decodeURIComponent(key);
  } catch {
    return key;
  }
}

/**
 * Handle GET request for album cover image.
 *
 * @param _req - The request (unused; route params carry artist/album).
 * @param params - Route params: artistId, albumId.
 * @returns Response with image body (Content-Type from ID3), or 400/404/500 with message.
 */
export async function handleAlbumCover(
  _req: Request,
  params: Record<string, string>,
): Promise<Response> {
  const { artistId, albumId } = params;
  logger.info("Handling album cover", { artistId, albumId });

  if (!artistId || !albumId) {
    return new Response("Missing artist or album ID", { status: 400 });
  }

  const cacheKey = `${artistId}/${albumId}`;
  const cached = coverCache.get(cacheKey);
  if (cached) {
    logger.debug("Serving cover from cache", { cacheKey });
    const body = new Blob([new Uint8Array(cached.body)], {
      type: cached.contentType,
    });
    return new Response(body, {
      headers: {
        "Content-Type": cached.contentType,
        "Cache-Control": "private, max-age=86400",
      },
    });
  }

  const files = await getUploadedFiles();
  const album = getAlbum(files, cacheKey);
  if (!album) {
    return new Response("Album not found", { status: 404 });
  }

  const tracks = [...album.tracks].sort(sortTracksByTrackNumber);
  const firstTrack = tracks[0];
  if (!firstTrack) {
    return new Response("Album has no tracks", { status: 404 });
  }

  try {
    const key = getKeyFromTrackUrl(firstTrack.url);
    const trackBytes = await getObjectBytes(key);
    const id3Tags = await getID3Tags(trackBytes);
    if (!id3Tags.image) {
      return new Response("No cover art in album tracks", { status: 404 });
    }
    const decoded = decodeDataUrl(id3Tags.image);
    if (!decoded) {
      return new Response("Invalid cover image data", { status: 500 });
    }
    coverCache.set(cacheKey, decoded);
    logger.debug("Cached cover", { cacheKey });
    const body = new Blob([new Uint8Array(decoded.body)], {
      type: decoded.contentType,
    });
    return new Response(body, {
      headers: {
        "Content-Type": decoded.contentType,
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("Failed to extract cover", { error: message, cacheKey });
    return new Response("Failed to load cover", { status: 500 });
  }
}
