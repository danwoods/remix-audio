/** @file Shared JSON data endpoint utilities.
 *
 * Provides a consistent, cacheable JSON data format for top-level and scoped
 * resources (artist/album). Designed so future handlers can opt-in by calling
 * {@link maybeHandleJsonDataRequest}.
 */
import {
  type Album,
  type Files,
  sortTracksByTrackNumber,
} from "../../app/util/files.ts";
import { getUploadedFiles } from "../../app/util/s3.server.ts";

export const DATA_FORMAT_VERSION = "1.0.0";
export const DATA_SCHEMA_PATH = "/_json/schema";

const JSON_CACHE_CONTROL = "public, max-age=300, stale-while-revalidate=60";

export type JsonDataScope =
  | { level: "root" }
  | { level: "artist"; artistId: string }
  | { level: "album"; artistId: string; albumId: string };

interface JsonTrack {
  title: string;
  trackNumber: number;
  url: string;
  lastModified: string | null;
}

interface JsonAlbum {
  id: string;
  title: string;
  artistId: string;
  localUrl: string;
  localJsonUrl: string;
  coverUrl: string;
  trackCount: number;
  tracks: JsonTrack[];
}

interface JsonArtist {
  id: string;
  title: string;
  localUrl: string;
  localJsonUrl: string;
  albumCount: number;
  albums: JsonAlbum[];
}

interface JsonTotals {
  artists: number;
  albums: number;
  tracks: number;
}

interface JsonData {
  artists: JsonArtist[];
  totals: JsonTotals;
}

interface JsonDataResponseBody {
  dataFormatVersion: typeof DATA_FORMAT_VERSION;
  compiledAt: string;
  schemaUrl: string;
  scope: JsonDataScope;
  data: JsonData;
}

type CachedJsonPayload = {
  body: string;
  etag: string;
  compiledAt: string;
};

const compiledPayloadCache = new WeakMap<
  Files,
  Map<string, CachedJsonPayload>
>();

/** True when request explicitly asks for JSON data export mode. */
export function isJsonDataRequest(req: Request): boolean {
  const url = new URL(req.url);
  const format = url.searchParams.get("format")?.toLowerCase();
  return format === "json" || url.pathname.endsWith("/_json");
}

/**
 * Handle JSON data mode for a scope. Returns null when request is not in JSON mode.
 * Future page handlers can call this early and return the response when present.
 */
export async function maybeHandleJsonDataRequest(
  req: Request,
  scope: JsonDataScope,
): Promise<Response | null> {
  if (!isJsonDataRequest(req)) {
    return null;
  }
  return await createScopedJsonDataResponse(req, scope);
}

/** Build a scoped, cache-aware JSON response for the current S3-backed data snapshot. */
export async function createScopedJsonDataResponse(
  req: Request,
  scope: JsonDataScope,
): Promise<Response> {
  const files = await getUploadedFiles();
  if (!scopeExists(files, scope)) {
    const message = scope.level === "album"
      ? "Album not found"
      : "Artist not found";
    return new Response(message, { status: 404 });
  }

  const scopeKey = getScopeKey(scope);
  const snapshotCache = getSnapshotCache(files);
  let cached = snapshotCache.get(scopeKey);

  if (!cached) {
    const compiledAt = new Date().toISOString();
    const data = buildScopedData(files, scope);
    const payload: JsonDataResponseBody = {
      dataFormatVersion: DATA_FORMAT_VERSION,
      compiledAt,
      schemaUrl: DATA_SCHEMA_PATH,
      scope,
      data,
    };
    const body = JSON.stringify(payload);
    const etag = await buildEtag(body);

    cached = { body, etag, compiledAt };
    snapshotCache.set(scopeKey, cached);
  }

  const headers = buildJsonHeaders(cached);
  if (isNotModified(req, cached)) {
    return new Response(null, {
      status: 304,
      headers,
    });
  }

  headers.set("Content-Type", "application/json");
  return new Response(cached.body, {
    status: 200,
    headers,
  });
}

function scopeExists(files: Files, scope: JsonDataScope): boolean {
  if (scope.level === "root") {
    return true;
  }

  const artist = files[scope.artistId];
  if (!artist) {
    return false;
  }

  if (scope.level === "artist") {
    return true;
  }

  return Boolean(artist[scope.albumId]);
}

function getSnapshotCache(files: Files): Map<string, CachedJsonPayload> {
  let cache = compiledPayloadCache.get(files);
  if (!cache) {
    cache = new Map<string, CachedJsonPayload>();
    compiledPayloadCache.set(files, cache);
  }
  return cache;
}

function getScopeKey(scope: JsonDataScope): string {
  if (scope.level === "root") {
    return "root";
  }
  if (scope.level === "artist") {
    return `artist:${scope.artistId}`;
  }
  return `album:${scope.artistId}/${scope.albumId}`;
}

function buildScopedData(files: Files, scope: JsonDataScope): JsonData {
  const artists = buildArtists(files, scope);

  const totals = artists.reduce<JsonTotals>(
    (acc, artist) => {
      acc.artists += 1;
      acc.albums += artist.albums.length;
      acc.tracks += artist.albums.reduce(
        (trackTotal, album) => trackTotal + album.tracks.length,
        0,
      );
      return acc;
    },
    { artists: 0, albums: 0, tracks: 0 },
  );

  return {
    artists,
    totals,
  };
}

function buildArtists(files: Files, scope: JsonDataScope): JsonArtist[] {
  const artistEntries = Object.entries(files).sort(([a], [b]) =>
    a.localeCompare(b)
  );

  return artistEntries.flatMap(([artistId, albumsByArtist]) => {
    if (
      (scope.level === "artist" || scope.level === "album") &&
      artistId !== scope.artistId
    ) {
      return [];
    }

    const albums = buildAlbums(artistId, albumsByArtist, scope);
    if (albums.length === 0) {
      return [];
    }

    const encodedArtistId = encodeURIComponent(artistId);
    const localUrl = `/artists/${encodedArtistId}`;
    return [{
      id: artistId,
      title: artistId,
      localUrl,
      localJsonUrl: `${localUrl}/_json`,
      albumCount: albums.length,
      albums,
    }];
  });
}

function buildAlbums(
  artistId: string,
  albumsByArtist: Record<string, Album>,
  scope: JsonDataScope,
): JsonAlbum[] {
  const albumEntries = Object.entries(albumsByArtist).sort(([a], [b]) =>
    a.localeCompare(b)
  );

  return albumEntries.flatMap(([albumId, album]) => {
    if (scope.level === "album" && albumId !== scope.albumId) {
      return [];
    }

    const encodedArtistId = encodeURIComponent(artistId);
    const encodedAlbumId = encodeURIComponent(albumId);
    const localUrl = `/artists/${encodedArtistId}/albums/${encodedAlbumId}`;
    const tracks = [...album.tracks].sort(sortTracksByTrackNumber).map(
      (track) => {
        const lastModified = track.lastModified == null
          ? null
          : new Date(track.lastModified).toISOString();
        return {
          title: track.title,
          trackNumber: track.trackNum,
          url: track.url,
          lastModified,
        };
      },
    );

    return [{
      id: album.id,
      title: album.title,
      artistId,
      localUrl,
      localJsonUrl: `${localUrl}/_json`,
      coverUrl: `${localUrl}/cover`,
      trackCount: tracks.length,
      tracks,
    }];
  });
}

function buildJsonHeaders(cached: CachedJsonPayload): Headers {
  return new Headers({
    "Cache-Control": JSON_CACHE_CONTROL,
    "ETag": cached.etag,
    "Last-Modified": new Date(cached.compiledAt).toUTCString(),
  });
}

function isNotModified(req: Request, cached: CachedJsonPayload): boolean {
  const ifNoneMatch = req.headers.get("If-None-Match");
  if (ifNoneMatch && ifNoneMatch === cached.etag) {
    return true;
  }

  const ifModifiedSince = req.headers.get("If-Modified-Since");
  if (!ifModifiedSince) {
    return false;
  }

  const sinceMs = Date.parse(ifModifiedSince);
  if (Number.isNaN(sinceMs)) {
    return false;
  }

  const compiledMs = new Date(cached.compiledAt).valueOf();
  const compiledSeconds = Math.floor(compiledMs / 1000) * 1000;
  return sinceMs >= compiledSeconds;
}

async function buildEtag(payload: string): Promise<string> {
  const bytes = new TextEncoder().encode(payload);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hex = Array.from(new Uint8Array(digest)).map((byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
  return `"${hex}"`;
}
