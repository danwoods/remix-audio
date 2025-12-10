import type { Files } from "../../util/files.ts";
import albumCoverHtml from "../AlbumCover/album-cover-html.ts";
import { getAlbum } from "../../util/files.ts";

/**
 * Props for the album tile HTML function
 */
export interface AlbumTileProps {
  albumId: string;
  files: Files;
}

/**
 * Escape HTML special characters to prevent XSS
 */
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Generate HTML string for album tile with cover art and title/artist text
 *
 * Returns HTML immediately with a link containing album cover and metadata.
 *
 * @param props - Album tile properties
 * @returns HTML string for an anchor element with album cover and text
 *
 * @example
 * ```ts
 * const html = albumTileHtml({
 *   albumId: "Artist Name/Album Name",
 *   files: filesObject
 * });
 * ```
 */
export default async function albumTileHtml(
  props: AlbumTileProps,
): Promise<string> {
  const { albumId, files } = props;
  const [artistName, albumName] = albumId.split("/");

  const encodedArtistName = encodeURIComponent(artistName);
  const encodedAlbumName = encodeURIComponent(albumName);
  const href = `/artists/${encodedArtistName}/albums/${encodedAlbumName}/html`;

  const escapedArtistName = escapeHtml(artistName);
  const escapedAlbumName = escapeHtml(albumName);

  const albumObject = getAlbum(files, albumId);
  const srcArr = albumObject.tracks[0].url.split("/");
  srcArr.pop();
  const src = [...srcArr, "cover.jpeg"].join("/");

  return `<a href="${escapeHtml(href)}">
  ${albumCoverHtml({ albumId, className: "rounded w-full", src })}
  <div class="pt-1 md:pt-2">
    <p class="text-base font-bold line-clamp-1">${escapedAlbumName}</p>
    <p class="text-sm line-clamp-1">by ${escapedArtistName}</p>
  </div>
</a>`;
}
