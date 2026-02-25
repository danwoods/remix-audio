/** @file Track-related utility functions for parsing URLs and fetching tracks from S3 */

import { getBucketContents } from "../../lib/s3.ts";
import { parseTrackMetadataFromUrlText } from "./track-metadata.ts";

/**
 * Parses track metadata from a track URL.
 *
 * @param trackUrl - The full track URL in format: `{baseUrl}/{artistName}/{albumName}/{trackNumber}__{trackName}.{ext}`
 * @returns An object containing parsed track information
 * @returns `artistName` - The artist name extracted from the URL path
 * @returns `albumName` - The album name extracted from the URL path
 * @returns `trackName` - The track name extracted from the filename (after `__` separator, excluding extension)
 * @returns `trackNumber` - The track number extracted from the filename (before `__` separator)
 * @returns `albumUrl` - The base URL for the album (S3 bucket URL)
 *
 * @example
 * ```ts
 * import { assertEquals } from "@std/assert";
 * import { getParentDataFromTrackUrl } from "./track.ts";
 *
 * const url = "https://bucket.s3.amazonaws.com/Artist/Album/01__Track Name.mp3";
 * const data = getParentDataFromTrackUrl(url);
 * assertEquals(data.artistName, "Artist");
 * assertEquals(data.albumName, "Album");
 * assertEquals(data.trackName, "Track Name");
 * assertEquals(data.trackNumber, "01");
 * assertEquals(data.albumUrl, "https://bucket.s3.amazonaws.com/Artist/Album");
 * ```
 *
 * @remarks
 * The URL format is expected to be:
 * - Path segments: `.../{artist}/{album}/{filename}`
 * - Filename format: `{number}__{name}.{ext}` (double underscore separator)
 * - Returns `null` values if the URL is null or doesn't match the expected format
 */
export const getParentDataFromTrackUrl = (trackUrl: string | null) => {
  if (!trackUrl) {
    return {
      artistName: null,
      albumName: null,
      trackName: null,
      trackNumber: null,
      albumUrl: null,
    };
  }

  const currentTrackPieces = trackUrl.split("/");

  if (currentTrackPieces.length < 6) {
    throw new Error("Invalid track URL", { cause: trackUrl });
  }

  const albumUrl = currentTrackPieces.slice(0, currentTrackPieces.length - 1)
    .join("/");
  const artistName = currentTrackPieces[currentTrackPieces.length - 3];
  const albumName = currentTrackPieces[currentTrackPieces.length - 2];
  const parsedMetadata = parseTrackMetadataFromUrlText(trackUrl);
  const trackName = parsedMetadata.title;
  const trackNumber = parsedMetadata.trackNumberText;

  return {
    artistName,
    albumName,
    trackName,
    trackNumber,
    albumUrl,
  };
};

/**
 * Escape HTML special characters to prevent XSS
 *
 * @param unsafe - The string that may contain HTML special characters
 * @returns The escaped string safe for use in HTML
 *
 * @example
 * ```ts
 * import { assertEquals } from "@std/assert";
 * import { escapeHtml } from "./track.ts";
 *
 * const result = escapeHtml("<script>alert('xss')</script>");
 * assertEquals(result, "&lt;script&gt;alert(&#039;xss&#039;)&lt;/script&gt;");
 * ```
 */
export function escapeHtml(unsafe: string | null): typeof unsafe {
  if (unsafe === null) {
    return null;
  }
  if (unsafe === "") {
    return "";
  }
  return unsafe.replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Track information extracted from S3 bucket
 */
export type TrackInfo = {
  url: string;
  title: string;
  trackNum: number;
};

/**
 * Get remaining tracks in album after current track
 *
 * @param albumUrl - The base URL for the album (S3 bucket URL)
 * @param currentTrackUrl - The full URL of the current track
 * @returns A promise that resolves to an array of track information for remaining tracks
 *
 * @example
 * ```ts
 * // Example usage (not executable in doc tests due to DOM API requirements):
 * // const tracks = await getRemainingAlbumTracks(
 * //   "https://bucket.s3.amazonaws.com/Artist/Album",
 * //   "https://bucket.s3.amazonaws.com/Artist/Album/01__Track One.mp3"
 * // );
 * // Returns: [{ url: "...", title: "Track Two", trackNum: 2 }, ...]
 * ```
 *
 * @remarks
 * This function requires DOM APIs (DOMParser) and network access, so it cannot be tested
 * in Deno's documentation test environment. See the test file for executable examples.
 *
 * Note: This function automatically filters out cover image files (cover.jpeg) from
 * the returned track list.
 */
export const getRemainingAlbumTracks = async (
  albumUrl: string,
  currentTrackUrl: string,
): Promise<Array<TrackInfo>> => {
  let artistName: string | null;
  let albumName: string | null;
  try {
    const data = getParentDataFromTrackUrl(currentTrackUrl);
    artistName = data.artistName;
    albumName = data.albumName;
  } catch {
    return [];
  }
  if (!artistName || !albumName) {
    return [];
  }

  // Extract base bucket URL from albumUrl
  // albumUrl format: https://bucket.s3.region.amazonaws.com/artist/album
  // We need: https://bucket.s3.region.amazonaws.com
  const urlObj = new URL(albumUrl);
  const bucketUrl = `${urlObj.protocol}//${urlObj.host}`;
  const prefix = `${artistName}/${albumName}/`;

  let contents: string[] = [];
  try {
    const rawContents = await getBucketContents(bucketUrl, prefix);
    contents = rawContents.filter(
      (key): key is string => key !== null && key !== undefined,
    );
  } catch (error) {
    console.error(
      "getRemainingAlbumTracks: Error fetching bucket contents:",
      error,
    );
    throw error;
  }

  const currentTrackPieces = currentTrackUrl.split("/");
  let currentTrackKey = currentTrackPieces[currentTrackPieces.length - 1];
  // Decode URL encoding in case the track URL is encoded
  try {
    currentTrackKey = decodeURIComponent(currentTrackKey);
  } catch {
    // If decoding fails, use as-is
  }
  // Remove file extension if present for matching
  const currentTrackKeyNoExt = currentTrackKey.replace(/\.[^.]+$/, "");
  const currentTrackIndex = contents.findIndex((key) => {
    // Extract filename from full key path for comparison
    const keyFilename = key.split("/").pop() || "";
    const keyFilenameNoExt = keyFilename.replace(/\.[^.]+$/, "");

    // Try multiple matching strategies:
    // 1. Exact match
    // 2. Match without extension
    // 3. Match with URL decoding
    // 4. Match single underscore with double underscore (2_Plateau matches 2__Plateau)
    // Normalize: convert single underscores to double, but preserve existing double underscores
    // Replace __ with a placeholder, then single _ with __, then restore __
    const normalizeUnderscores = (str: string) => {
      return str.replace(/__/g, "\0").replace(/_/g, "__").replace(/\0/g, "__");
    };
    const normalizedCurrent = normalizeUnderscores(currentTrackKeyNoExt);
    const normalizedKey = normalizeUnderscores(keyFilenameNoExt);

    return keyFilename === currentTrackKey ||
      keyFilenameNoExt === currentTrackKeyNoExt ||
      normalizedKey === normalizedCurrent ||
      decodeURIComponent(keyFilename) === currentTrackKey ||
      keyFilename === encodeURIComponent(currentTrackKey);
  });

  if (currentTrackIndex === -1) {
    return [];
  }

  // Build all tracks from contents, filter cover, sort by track number.
  // Use track-number order for "remaining", not S3 listing order (e.g. "10__" can come before "9__" alphabetically).
  const allTracks: Array<TrackInfo> = contents
    .map((key) => {
      const fullUrl = `${bucketUrl}/${key}`;
      const parsedTrackMetadata = parseTrackMetadataFromUrlText(fullUrl);
      return {
        url: fullUrl,
        title: parsedTrackMetadata.title,
        trackNum: parsedTrackMetadata.trackNumber,
      };
    })
    .filter(filterOutCoverJpeg)
    .sort((a, b) => a.trackNum - b.trackNum);

  // Match current track in allTracks using same rules as original findIndex:
  // exact path, without extension, normalized underscores, URL decoding
  const currentUrlPath = currentTrackUrl.split("/").pop() || "";
  const normalizeUnderscores = (str: string) =>
    str.replace(/__/g, "\0").replace(/_/g, "__").replace(/\0/g, "__");
  const currentIndexInSorted = allTracks.findIndex((t) => {
    const tPath = t.url.split("/").pop() || "";
    const tPathNoExt = tPath.replace(/\.[^.]+$/, "");
    return tPath === currentUrlPath ||
      tPath === currentTrackKey ||
      tPathNoExt === currentTrackKeyNoExt ||
      normalizeUnderscores(tPathNoExt) ===
        normalizeUnderscores(currentTrackKeyNoExt) ||
      decodeURIComponent(tPath) === currentUrlPath ||
      tPath === encodeURIComponent(currentTrackKey);
  });
  if (currentIndexInSorted === -1) return [];
  return allTracks.slice(currentIndexInSorted + 1);
};

/**
 * Get all tracks in an album
 *
 * @param albumUrl - The base URL for the album (S3 bucket URL)
 * @param currentTrackUrl - The full URL of a track in the album (used to determine artist/album)
 * @returns A promise that resolves to an array of all track information in the album
 *
 * @example
 * ```ts
 * // Example usage (not executable in doc tests due to DOM API requirements):
 * // const tracks = await getAllAlbumTracks(
 * //   "https://bucket.s3.amazonaws.com/Artist/Album",
 * //   "https://bucket.s3.amazonaws.com/Artist/Album/01__Track One.mp3"
 * // );
 * // Returns: [{ url: "...", title: "Track One", trackNum: 1 }, ...]
 * ```
 *
 * @remarks
 * This function requires DOM APIs (DOMParser) and network access, so it cannot be tested
 * in Deno's documentation test environment. See the test file for executable examples.
 *
 * Note: This function automatically filters out cover image files (cover.jpeg) from
 * the returned track list.
 */
export const getAllAlbumTracks = async (
  albumUrl: string,
  currentTrackUrl: string,
): Promise<Array<TrackInfo>> => {
  let artistName: string | null;
  let albumName: string | null;
  try {
    const data = getParentDataFromTrackUrl(currentTrackUrl);
    artistName = data.artistName;
    albumName = data.albumName;
  } catch {
    return [];
  }
  if (!artistName || !albumName) {
    return [];
  }

  try {
    // Extract base bucket URL from albumUrl
    const urlObj = new URL(albumUrl);
    const bucketUrl = `${urlObj.protocol}//${urlObj.host}`;
    const prefix = `${artistName}/${albumName}/`;

    const contents = (await getBucketContents(bucketUrl, prefix)).filter(
      (key): key is string => key !== null && key !== undefined,
    );

    const tracks = contents
      .map((key) => {
        const fullUrl = `${bucketUrl}/${key}`;
        const parsedTrackMetadata = parseTrackMetadataFromUrlText(fullUrl);

        return {
          url: fullUrl,
          title: parsedTrackMetadata.title,
          trackNum: parsedTrackMetadata.trackNumber,
        };
      })
      .sort((a, b) => a.trackNum - b.trackNum)
      .filter(filterOutCoverJpeg);

    return tracks;
  } catch (error) {
    console.error("Failed to load all album tracks:", error);
    return [];
  }
};

/**
 * Filter out cover.jpeg tracks
 *
 * @param track - The track information
 * @returns True if the track is not a cover.jpeg, false otherwise
 */
const filterOutCoverJpeg = (track: TrackInfo): boolean => {
  let filename = track.url.split("/").pop() || "";
  try {
    filename = decodeURIComponent(filename);
  } catch {
    // Ignore decode failures and use the raw filename.
  }
  return filename.toLowerCase() !== "cover.jpeg";
};
