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

/** Album art cache to avoid repetitve fetches */
const albumArtCache = new Map<string, Promise<string | null>>();

// XXX: Move to ID3 module
/** Fetch album art */
export const getAlbumArt = (files: Files, albumId: string) => {
  if (!albumArtCache.has(albumId)) {
    const album = getAlbum(files, albumId);
    if (!album) {
      return Promise.resolve(null);
    }
    const artFetch = fromUrl(album.tracks[0].url).then((tags) => {
      if (Array.isArray(tags?.images)) {
        const arrayBuffer = tags.images[0].data;
        const blob = new Blob([arrayBuffer]);
        const srcBlob = URL.createObjectURL(blob);
        return srcBlob;
      } else {
        return null;
      }
    });

    albumArtCache.set(albumId, artFetch);
  }

  return albumArtCache.get(albumId)!;
};

/** Get artist data from files object */
export const getArtist = (files: Files, artistId: string) => {
  return files[artistId];
};

/** Given a track's URL, pull data from it to determine the track's artist, album, and number */
export const getParentDataFromTrackUrl = (trackUrl: string | null) => {
  const currentTrackPieces = trackUrl ? trackUrl.split("/") : null;
  const artistName =
    currentTrackPieces && currentTrackPieces[currentTrackPieces.length - 3];
  const albumName =
    currentTrackPieces && currentTrackPieces[currentTrackPieces.length - 2];
  const trackPieces =
    currentTrackPieces &&
    currentTrackPieces[currentTrackPieces.length - 1].split("__");
  const trackName = trackPieces && trackPieces[1];
  const trackNumber = trackPieces && trackPieces[0];

  return {
    artistName,
    albumName,
    trackName,
    trackNumber,
  };
};

/** Given files and a track URL, get the following tracks on the album */
export const getRemainingAlbumTracks = (files: Files, trackUrl: string) => {
  const { artistName, albumName } = getParentDataFromTrackUrl(trackUrl);
  const album = getAlbum(files, `${artistName}/${albumName}`);
  if (album) {
    const currentTrackIndex = album.tracks.findIndex((t) => t.url === trackUrl);
    const remainingAlbumTracks = album.tracks.slice(currentTrackIndex + 1);
    return remainingAlbumTracks;
  }

  return [];
};
