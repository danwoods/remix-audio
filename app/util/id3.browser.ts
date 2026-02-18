/** @file Browser-only ID3 (audio metadata) for File objects and URLs.
 *
 * Uses id3js only (zero Node deps, no music-metadata). Safe to import from
 * client bundle; does not pull in node:stream or music-metadata.
 * Exports getID3TagsFromFile and getID3TagsFromURL.
 */

import { fromFile, fromUrl } from "id3js";

/** Normalized ID3 tags (same shape as {@linkcode ../util/id3.ts ID3Tags}). */
export type ID3Tags = {
  artist: string;
  album: string;
  image?: string;
  title: string;
  trackNumber: number;
};

/** Editable ID3 fields sent from upload dialog to server. */
export type ID3TagsEditable = {
  artist: string;
  album: string;
  title: string;
  trackNumber: number;
};

function imageValueToDataUrl(
  img: { mime: string | null; data: ArrayBuffer },
): string {
  const bytes = new Uint8Array(img.data);
  const chunkSize = 8192;
  let binaryString = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.slice(i, i + chunkSize);
    binaryString += String.fromCharCode(...chunk);
  }
  const mime = img.mime || "image/jpeg";
  return `data:${mime};base64,${btoa(binaryString)}`;
}

/** Raw tag shape from id3js (fromFile or fromUrl). */
type RawTag = {
  title?: string | null;
  album?: string | null;
  artist?: string | null;
  track?: number | string | null;
  images?: Array<{ mime?: string | null; data?: ArrayBuffer }> | null;
};

function normalizeTag(tag: RawTag): ID3Tags {
  const title = (tag.title ?? "").trim() || "Unknown";
  const album = (tag.album ?? "").trim() || "Unknown";
  const artist = (tag.artist ?? "").trim() || "Unknown";

  let trackNumber = 0;
  if (tag.track != null) {
    const t = tag.track;
    trackNumber = typeof t === "number" ? t : parseInt(String(t), 10) || 0;
  }

  let image: string | undefined;
  if (Array.isArray(tag.images) && tag.images.length > 0) {
    const first = tag.images[0];
    if (first?.data) {
      image = imageValueToDataUrl({
        mime: first.mime ?? null,
        data: first.data,
      });
    }
  }

  return {
    title,
    album,
    trackNumber,
    artist,
    image,
  };
}

/**
 * Normalize a track URL for ID3 fetch/parsing requests.
 * Encodes unsafe path characters while avoiding double-encoding of
 * already-encoded path segments.
 */
export const normalizeUrlForId3Request = (url: string): string => {
  const absoluteUrlMatch = url.match(
    /^([a-zA-Z][a-zA-Z\d+\-.]*:\/\/[^/]+)(\/.*)?$/,
  );
  if (absoluteUrlMatch) {
    const origin = absoluteUrlMatch[1];
    const pathAndSearch = absoluteUrlMatch[2] ?? "";
    const searchIdx = pathAndSearch.indexOf("?");
    const rawPath = searchIdx === -1
      ? pathAndSearch
      : pathAndSearch.slice(0, searchIdx);
    const rawSearch = searchIdx === -1 ? "" : pathAndSearch.slice(searchIdx);
    const encodedPath = rawPath.split("/").map((segment, index) => {
      if (index === 0 || segment === "") return segment;
      try {
        return encodeURIComponent(decodeURIComponent(segment));
      } catch {
        return encodeURIComponent(segment);
      }
    }).join("/");
    return `${origin}${encodedPath}${rawSearch}`;
  }
  try {
    return encodeURI(url).replace(/#/g, "%23");
  } catch {
    return url;
  }
};

/**
 * Get normalized ID3 tags from a File in the browser.
 * BROWSER-ONLY: uses id3js.fromFile. In non-browser environments returns null.
 *
 * @param file - Audio file (e.g. from input type=file)
 * @returns ID3Tags or null if not in browser, parse fails, or file is not audio
 */
export const getID3TagsFromFile = async (
  file: File,
): Promise<ID3Tags | null> => {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return null;
  }
  try {
    const tag = await fromFile(file);
    if (!tag) return null;
    return normalizeTag(tag as RawTag);
  } catch {
    return null;
  }
};

/**
 * Get normalized ID3 tags from an audio file URL in the browser.
 * BROWSER-ONLY: uses id3js.fromUrl. In non-browser environments returns null.
 * Fetches the URL and parses ID3 metadata (title, artist, album, cover art).
 *
 * @param url - URL of the audio file (e.g. S3 track URL). Must be CORS-enabled
 *   if the file is on a different origin.
 * @returns ID3Tags or null if not in browser, parse fails, or fetch fails
 */
export const getID3TagsFromURL = async (
  url: string,
): Promise<ID3Tags | null> => {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return null;
  }
  try {
    const tag = await fromUrl(normalizeUrlForId3Request(url));
    if (!tag) return null;
    return normalizeTag(tag as RawTag);
  } catch {
    return null;
  }
};
