/** @file ID3 (audio metadata) related functionality */
import { fromUrl } from "id3js";
import * as musicMetadata from "music-metadata";

/** Normalized ID3 tags */
export type ID3Tags = {
  artist: string;
  album: string;
  image?: string;
  title: string;
  trackNumber: number;
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
