/** @file Utility methods for working with the Files object */

import type { Files, Track } from "./s3.server";
import { fromUrl } from "id3js";

/**
 * Given an albumID, find it in a files object
 * @param files File object
 * @param albumId Album ID in the format "artistID/albumID"
 * @returns Value of album (array of tracks)
 */
export const getAlbum = (
  files: Files,
  albumId: string,
): { coverArt: string | null; tracks: Track[] } => {
  const albumIdsObj: {
    [albumId: string]: { coverArt: string | null; tracks: Track[] };
  } = Object.keys(files)
    .map((artist) => {
      return Object.entries(files[artist]).reduce(
        (acc, cur) => ({ ...acc, [`${artist}/${cur[0]}`]: cur[1] }),
        {},
      );
    })
    .reduce((acc, cur) => ({ ...acc, ...cur }), {});

  return albumIdsObj[albumId];
};

/** Fetch album art */
export const getAlbumArt = (files: Files, albumId: string) => {
  const album = getAlbum(files, albumId);
  return fromUrl(album.tracks[0].url).then((tags) => {
    if (Array.isArray(tags?.images)) {
      const arrayBuffer = tags.images[0].data;
      const blob = new Blob([arrayBuffer]);
      const srcBlob = URL.createObjectURL(blob);
      return srcBlob;
    } else {
      return null;
    }
  });
};

export const getArtist = (files: Files, artistId: string) => {
  return files[artistId];
};
