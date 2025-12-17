/** Unique symbol for the AlbumUrl type. This is used to ensure that the AlbumUrl type is unique. */
const AlbumUrlTypeId: unique symbol = Symbol.for("album/url");
import { getBucketContents } from "./s3.ts";

/** A URL in the form of https://< bucket >.s3.< region >.amazonaws.com/< artistId >/< albumId >.
 *
 * This is a type alias for a string that is a valid URL in the form of https://< bucket >.s3.< region >.amazonaws.com/< artistId >/< albumId >.
 *
 * @example
 * ```ts
 * const albumUrl: AlbumUrl = "https://my-bucket.s3.us-east-1.amazonaws.com/artist1/album1";
 * ```
 */
export type AlbumUrl = string & {
  readonly [AlbumUrlTypeId]: {
    readonly AlbumUrl: "AlbumUrl"; // unique identifier for AlbumUrl
  };
};

/** Create a new album URL. */
export const createAlbumUrl = (
  bucket: string,
  region: string,
  artistId: string,
  albumId: string,
): AlbumUrl => {
  return `https://${bucket}.s3.${region}.amazonaws.com/${artistId}/${albumId}` as AlbumUrl;
};

/** Get the contents of an album bucket. Filters out JPEG and directory files. */
export const getAlbumContents = async (
  albumUrl: string,
  artistId: string,
  albumId: string,
): Promise<string[]> => {
  const contents = await getBucketContents(albumUrl, `${artistId}/${albumId}/`);
  return contents.filter((content) =>
    !content.endsWith(".jpeg") && !content.endsWith("/")
  );
};
