/** @file ID3 (audio metadata) related functionality */
import { fromUrl } from "id3js";
import * as musicMetadata from "music-metadata";
import { parseBlob } from "music-metadata-browser";

/** Normalized ID3 tags */
export type ID3Tags = {
  artist: string;
  album: string;
  image?: string;
  title: string;
  trackNumber: number;
};

/**
 * Converts image data to JPEG format using Canvas
 * @param imageData Original image data
 * @param format Original image format
 * @returns JPEG image as Uint8Array
 */
const convertToJpeg = async (
  imageData: Uint8Array,
  format: string,
): Promise<Uint8Array> => {
  const blob = new Blob([imageData], { type: format });
  const imageUrl = URL.createObjectURL(blob);

  try {
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = imageUrl;
    });

    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      // In Node.js environments, use node-canvas as a polyfill
      if (typeof window === "undefined") {
        const { createCanvas, Image } = await import("canvas");
        const canvas = createCanvas(img.width, img.height);
        const ctx = canvas.getContext("2d");
        const nodeImage = new Image();
        nodeImage.src = imageUrl;
        ctx.drawImage(nodeImage, 0, 0);
        const jpegBuffer = canvas.toBuffer("image/jpeg", { quality: 0.9 });
        return new Uint8Array(jpegBuffer);
      }
      throw new Error("Could not get canvas context");
    }
    ctx.drawImage(img, 0, 0);

    const jpegUrl = canvas.toDataURL("image/jpeg", 0.9);
    const base64Data = jpegUrl.split(",")[1];
    return new Uint8Array(
      atob(base64Data)
        .split("")
        .map((char) => char.charCodeAt(0)),
    );
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
};

/**
 * Extracts the cover image from an audio file and converts it to JPEG
 * @param file Audio file to extract cover art from
 * @returns Object containing the JPEG image data, or null if no image found
 */
export const extractCoverImage = async (
  file: File,
): Promise<{ data: Uint8Array; format: "image/jpeg" } | null> => {
  try {
    const metadata = await parseBlob(file);
    const picture = metadata.common.picture?.[0];

    if (!picture) {
      return null;
    }

    const jpegData = await convertToJpeg(picture.data, picture.format);

    return {
      data: jpegData,
      format: "image/jpeg",
    };
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Failed to extract cover image: ${errorMessage}`);
  }
};

/**
 * Get an object of basic, normalized ID3 tags
 * @param file File to pull metadata from
 * @returns An object of normalized ID3 tags
 */
export const getID3Tags = async (file: Uint8Array): Promise<ID3Tags> => {
  const metadata = await musicMetadata.parseBuffer(file);

  let image;

  const imageMetadata = metadata.common.picture && metadata.common.picture[0];

  if (imageMetadata) {
    const contents_in_base64 = Buffer.from(imageMetadata.data).toString(
      "base64",
    );
    const withPrefix = `data:${imageMetadata.format};base64, ${contents_in_base64}`;
    image = withPrefix;
  }

  return {
    title: metadata.common.title || "Unknown",
    album: metadata.common.album || "Unknown",
    trackNumber: Number(metadata.common.track.no),
    artist: metadata.common.artist || "Unknown",
    image,
  };
};

/** Pull ID3 tags from file at `url` */
export const getID3TagsFromURL = (url: string) => fromUrl(url);
