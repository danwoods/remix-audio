/** @file Shared track metadata derivation for client and server runtimes. */

const UNKNOWN = "Unknown";

/**
 * Unified track metadata shape used across the app.
 * Matches existing ID3-like metadata used by upload + playback flows.
 */
export type TrackMetadata = {
  artist: string;
  album: string;
  title: string;
  trackNumber: number;
  image?: string;
};

/**
 * Track metadata parsed from URL/filename text structure.
 * Includes URL-derived helpers used by existing track utilities.
 */
export type ParsedTrackMetadataFromUrlText = TrackMetadata & {
  albumUrl: string | null;
  trackNumberText: string | null;
};

/** Options for {@link deriveTrackMetadata}. */
export type DeriveTrackMetadataOptions = {
  /** Skip ID3 lookup and derive from URL/filename text only. */
  skipId3?: boolean;
};

/** ID3 reader abstraction to keep derivation logic easy to test. */
export type ID3TagReader = (url: string) => Promise<unknown | null>;

type ResolveID3TagReader = () => Promise<ID3TagReader | null>;

type NormalizedId3Fields = {
  artist: string | null;
  album: string | null;
  title: string | null;
  trackNumber: number;
  image?: string;
};

/** Decode URL path pieces without throwing on malformed encodings. */
const safeDecode = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const getStringValue = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed;
};

const getKnownStringValue = (value: unknown): string | null => {
  const str = getStringValue(value);
  if (!str) return null;
  if (str.toLowerCase() === UNKNOWN.toLowerCase()) return null;
  return str;
};

const stripFileExtension = (value: string): string => {
  return value.replace(/\.[^./\\]+$/, "");
};

const parseTrackNumber = (value: unknown): number => {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return 0;
    const normalized = Math.trunc(value);
    return normalized > 0 ? normalized : 0;
  }

  if (typeof value === "string") {
    const match = value.trim().match(/^(\d+)/);
    if (!match) return 0;
    const parsed = Number(match[1]);
    if (!Number.isFinite(parsed)) return 0;
    return parsed > 0 ? parsed : 0;
  }

  return 0;
};

const getPathSegments = (trackUrl: string): string[] => {
  try {
    const url = new URL(trackUrl);
    return url.pathname.split("/").filter(Boolean).map(safeDecode);
  } catch {
    const noQueryOrHash = trackUrl.split(/[?#]/)[0];
    const noProtocolHost = noQueryOrHash.replace(/^[a-z]+:\/\/[^/]+/i, "");
    return noProtocolHost.split("/").filter(Boolean).map(safeDecode);
  }
};

const getAlbumUrl = (trackUrl: string): string | null => {
  const noQueryOrHash = trackUrl.split(/[?#]/)[0];
  const pieces = noQueryOrHash.split("/");
  if (pieces.length < 2) return null;
  return pieces.slice(0, -1).join("/");
};

const parseTrackFilename = (
  filename: string,
): { title: string; trackNumber: number; trackNumberText: string | null } => {
  const decodedFilename = safeDecode(filename).trim();
  const pieces = decodedFilename.split("__");

  const hasTrackSeparator = pieces.length > 1;
  const trackNumberText = hasTrackSeparator ? pieces[0]?.trim() || null : null;
  const trackNumber = parseTrackNumber(trackNumberText);
  const titleRaw = hasTrackSeparator
    ? pieces.slice(1).join("__").trim()
    : decodedFilename;
  const titleWithoutExt = stripFileExtension(titleRaw).trim();

  return {
    title: titleWithoutExt || UNKNOWN,
    trackNumber,
    trackNumberText,
  };
};

/**
 * Parse track metadata from URL/filename structure.
 *
 * Uses the existing filename convention `{trackNumber}__{trackTitle}` and strips
 * file extension from title (e.g. `01__Song.mp3` => `Song`).
 */
export const parseTrackMetadataFromUrlText = (
  trackUrl: string,
): ParsedTrackMetadataFromUrlText => {
  const pathSegments = getPathSegments(trackUrl);
  const filename = pathSegments[pathSegments.length - 1] || "";
  const { title, trackNumber, trackNumberText } = parseTrackFilename(filename);

  const artist = pathSegments[pathSegments.length - 3] || UNKNOWN;
  const album = pathSegments[pathSegments.length - 2] || UNKNOWN;

  return {
    artist,
    album,
    title,
    trackNumber,
    trackNumberText,
    albumUrl: getAlbumUrl(trackUrl),
  };
};

const normalizeId3Fields = (raw: unknown): NormalizedId3Fields | null => {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;

  const artist = getKnownStringValue(obj.artist);
  const album = getKnownStringValue(obj.album);
  const title = getKnownStringValue(obj.title);
  const trackNumber = parseTrackNumber(obj.trackNumber ?? obj.track);
  const image = getStringValue(obj.image) ?? undefined;

  if (!artist && !album && !title && trackNumber <= 0 && !image) {
    return null;
  }

  return {
    artist,
    album,
    title,
    trackNumber,
    image,
  };
};

const mergeId3WithFallback = (
  fallback: ParsedTrackMetadataFromUrlText,
  id3Fields: NormalizedId3Fields,
): TrackMetadata => {
  return {
    artist: id3Fields.artist ?? fallback.artist,
    album: id3Fields.album ?? fallback.album,
    title: id3Fields.title ?? fallback.title,
    trackNumber: id3Fields.trackNumber > 0
      ? id3Fields.trackNumber
      : fallback.trackNumber,
    ...(id3Fields.image ? { image: id3Fields.image } : {}),
  };
};

const normalizeCacheKey = (trackUrl: string): string => {
  try {
    const url = new URL(trackUrl);
    url.hash = "";
    return url.toString();
  } catch {
    return trackUrl.trim();
  }
};

let defaultReaderPromise: Promise<ID3TagReader | null> | null = null;

// deno-coverage-ignore-start
const resolveDefaultId3TagReader: ResolveID3TagReader = () => {
  if (!defaultReaderPromise) {
    defaultReaderPromise = (async () => {
      const safeReader =
        (reader: (url: string) => Promise<unknown>) =>
        async (url: string): Promise<unknown | null> => {
          try {
            return await reader(url);
          } catch {
            return null;
          }
        };

      // Browser runtime
      if (typeof window !== "undefined" && typeof document !== "undefined") {
        try {
          const { getID3TagsFromURL } = await import("./id3.browser.ts");
          return safeReader(getID3TagsFromURL);
        } catch {
          return null;
        }
      }

      // Server runtime
      try {
        const { getID3TagsFromURL } = await import("./id3.ts");
        return safeReader(getID3TagsFromURL);
      } catch {
        return null;
      }
    })();
  }

  return defaultReaderPromise;
};
// deno-coverage-ignore-stop

/**
 * Factory for a track metadata deriver with isolated cache/state.
 * Useful for tests and for creating custom derivation behavior.
 */
export const createTrackMetadataDeriver = (
  resolveId3TagReader: ResolveID3TagReader = resolveDefaultId3TagReader,
) => {
  const id3Cache = new Map<string, NormalizedId3Fields>();
  const inFlightId3Reads = new Map<
    string,
    Promise<NormalizedId3Fields | null>
  >();

  const deriveTrackMetadata = async (
    trackUrl: string,
    options: DeriveTrackMetadataOptions = {},
  ): Promise<TrackMetadata> => {
    const fallback = parseTrackMetadataFromUrlText(trackUrl);
    if (options.skipId3) {
      return {
        artist: fallback.artist,
        album: fallback.album,
        title: fallback.title,
        trackNumber: fallback.trackNumber,
      };
    }

    const reader = await resolveId3TagReader();
    if (!reader) {
      return {
        artist: fallback.artist,
        album: fallback.album,
        title: fallback.title,
        trackNumber: fallback.trackNumber,
      };
    }

    const cacheKey = normalizeCacheKey(trackUrl);
    const cached = id3Cache.get(cacheKey);
    if (cached) {
      return mergeId3WithFallback(fallback, cached);
    }

    const existingRead = inFlightId3Reads.get(cacheKey);
    if (existingRead) {
      const id3Fields = await existingRead;
      return id3Fields ? mergeId3WithFallback(fallback, id3Fields) : {
        artist: fallback.artist,
        album: fallback.album,
        title: fallback.title,
        trackNumber: fallback.trackNumber,
      };
    }

    const readPromise = (async () => {
      const raw = await reader(trackUrl);
      const id3Fields = normalizeId3Fields(raw);
      if (id3Fields) {
        // Only cache values that actually came from ID3.
        id3Cache.set(cacheKey, id3Fields);
      }
      return id3Fields;
    })();

    inFlightId3Reads.set(cacheKey, readPromise);

    try {
      const id3Fields = await readPromise;
      return id3Fields ? mergeId3WithFallback(fallback, id3Fields) : {
        artist: fallback.artist,
        album: fallback.album,
        title: fallback.title,
        trackNumber: fallback.trackNumber,
      };
    } finally {
      inFlightId3Reads.delete(cacheKey);
    }
  };

  const clearCache = () => {
    id3Cache.clear();
    inFlightId3Reads.clear();
  };

  return {
    deriveTrackMetadata,
    clearCache,
  };
};

const defaultDeriver = createTrackMetadataDeriver();

/** Shared, default track metadata derivation used by app runtime code. */
export const deriveTrackMetadata = defaultDeriver.deriveTrackMetadata;

/** Clear in-memory ID3 cache for deterministic tests. */
export const clearTrackMetadataCache = defaultDeriver.clearCache;
