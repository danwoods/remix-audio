/** @file ID3 (audio metadata) related functionality */
import type { MP3TagAPICFrame } from "mp3tag.js/types/id3v2/frames.d.ts";
import id3 from "mp3tag.js";
import { fromUrl } from "id3js";

/** Normalized ID3 tags */
export type ID3Tags = {
  artist: string;
  album: string;
  image?: MP3TagAPICFrame;
  title: string;
  trackNumber: number;
};

/**
 * Get an object of basic, normalized ID3 tags
 * @param file File to pull metadata from
 * @returns An object of normalized ID3 tags
 */
export const getID3Tags = async (file: File): Promise<ID3Tags> => {
  const mp3tag = new id3(await file.arrayBuffer());
  mp3tag.read();

  if (mp3tag.error !== "") throw new Error(mp3tag.error);

  return {
    title: mp3tag.tags.title,
    album: mp3tag.tags.album,
    trackNumber: Number(mp3tag.tags.track),
    artist: mp3tag.tags.artist,
    image: mp3tag.tags.v2?.APIC && mp3tag.tags.v2?.APIC[0],
  };
};

/** Pull ID3 tags from file at `url` */
export const getID3TagsFromURL = (url: string) => fromUrl(url);
