/** @file Browser-only ID3 (audio metadata) for File objects.
 *
 * Uses id3js only (zero Node deps, no music-metadata). Safe to import from
 * client bundle; does not pull in node:stream or music-metadata.
 */

import { fromFile } from "id3js";

/** Normalized ID3 tags (same shape as {@linkcode ../util/id3.ts ID3Tags}). */
export type ID3Tags = {
  artist: string;
  album: string;
  image?: string;
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

    const title = (tag.title ?? "").trim() || "Unknown";
    const album = (tag.album ?? "").trim() || "Unknown";
    const artist = (tag.artist ?? "").trim() || "Unknown";

    let trackNumber = 0;
    if ("track" in tag && tag.track != null) {
      const t = tag.track;
      trackNumber = typeof t === "number" ? t : parseInt(String(t), 10) || 0;
    }

    let image: string | undefined;
    if ("images" in tag && Array.isArray(tag.images) && tag.images.length > 0) {
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
  } catch {
    return null;
  }
};
