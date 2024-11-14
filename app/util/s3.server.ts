/** @File Utilities for working with AWS S3 */
import type { UploadHandler } from "@remix-run/node";
import type { Files } from "./files";

import AWS from "aws-sdk";
import { PassThrough } from "stream";
import { getID3Tags } from "./id3";
import { writeAsyncIterableToWritable } from "@remix-run/node";
import { fromEnv } from "@aws-sdk/credential-providers";
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";
// import { parseBuffer } from "music-metadata";
// import * as musicMetadata from "music-metadata";

const {
  AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY,
  STORAGE_REGION,
  STORAGE_BUCKET,
} = process.env;

// Check for presence of env vars
if (
  !(
    AWS_ACCESS_KEY_ID &&
    AWS_SECRET_ACCESS_KEY &&
    STORAGE_REGION &&
    STORAGE_BUCKET
  )
) {
  throw new Error(`Storage is missing required configuration.`);
}

// Uploading //////////////////////////////////////////////////////////////////

/**
 * Given an array buffer, create an async generator that returns chunks of the buffer
 * @param arrayBuffer ArrayBuffer of file
 * @param chunkSize How large individual file chunks should be
 */
export async function* createAsyncIteratorFromArrayBuffer(
  arrayBuffer: ArrayBuffer,
  chunkSize = 1024,
) {
  const uint8Array = new Uint8Array(arrayBuffer);
  let offset = 0;

  while (offset < uint8Array.length) {
    const chunk = uint8Array.slice(offset, offset + chunkSize);
    offset += chunkSize;
    yield chunk;
  }
}

/** Create upload stream */
const uploadStream = ({ Key }: Pick<AWS.S3.Types.PutObjectRequest, "Key">) => {
  const s3 = new AWS.S3({
    credentials: {
      accessKeyId: AWS_ACCESS_KEY_ID,
      secretAccessKey: AWS_SECRET_ACCESS_KEY,
    },
    region: STORAGE_REGION,
  });
  const pass = new PassThrough();
  return {
    writeStream: pass,
    promise: s3.upload({ Bucket: STORAGE_BUCKET, Key, Body: pass }).promise(),
  };
};

/** Stream file to S3 */
export async function uploadStreamToS3(
  data: AsyncIterable<Uint8Array>,
  filename: string,
) {
  const stream = uploadStream({
    Key: filename,
  });

  await writeAsyncIterableToWritable(data, stream.writeStream);
  const file = await stream.promise;

  return file.Location;
}

// S3 Folder Structure //////////////////////////////////////////////////////////
// Bucket:
// - Metadata
// -- playcounts.csv
// -- likes.csv
// -- playlists.csv
// - App
// - Music
// -- [Artist]
// --- [Album]
// ---- cover.jpeg
// ---- [Tracks...]

/*
Per upload:
1. Get file metadata
2. Check if file has cover image data
  2.1 If file has cover image, do a cache-able HEAD check on album image
  2.2 If no album image exist, create image file and upload that
3. Upload file
*/

// const getAlbumCoverImage = async (albumUrl: string) => {
//   const response = await fetch(albumUrl);
//   const arrayBuffer = await response.arrayBuffer();
//   const uint8Array = new Uint8Array(arrayBuffer);
//   const id3Tags = await getID3Tags(uint8Array);
//   const albumCoverImage = id3Tags.image;
//   return albumCoverImage;
// };

/**
 * Remix compatible handler for streaming files to S3. Extracts ID3 data from
 * files to organize into artist/album bucket structure.
 * @see https://remix.run/docs/en/main/guides/file-uploads#upload-handler-composition
 **/
export const s3UploadHandler: UploadHandler = async ({
  name,
  contentType,
  data,
}) => {
  const dataArray = [];

  if (name !== "files") {
    return undefined;
  }

  for await (const x of data) {
    dataArray.push(x);
  }

  const file = new File(dataArray, "temp", { type: contentType });
  const fileArrayBuffer = await file.arrayBuffer();

  // const metadata = await musicMetadata.parseBlob(file);
  // console.log(metadata);
  // throw "boom";
  const uint8Array = new Uint8Array(fileArrayBuffer);
  const id3Tags = await getID3Tags(uint8Array);
  const partitiionedFilename = `${id3Tags.artist}/${id3Tags.album}/${id3Tags.trackNumber}__${id3Tags.title}`;
  const uploadedFileLocation = await uploadStreamToS3(
    createAsyncIteratorFromArrayBuffer(fileArrayBuffer),
    partitiionedFilename,
  );

  return uploadedFileLocation;
};

// Reading ////////////////////////////////////////////////////////////////////

const client = new S3Client({
  region: STORAGE_REGION,
  credentials: fromEnv(),
});

/** File fetch cache to avoid repetitve fetches */
let filesFetchCache: Promise<Files> | null = null;

/** Get file list from S3 and organize it into a `Files` object */
const fileFetch = async (): Promise<Files> => {
  const command = new ListObjectsV2Command({
    Bucket: STORAGE_BUCKET,
  });

  try {
    let isTruncated = true;
    let files: Files = {};

    while (isTruncated) {
      const { Contents, IsTruncated, NextContinuationToken } =
        await client.send(command);

      if (!Contents) {
        return files;
      }

      files = Contents?.reduce((acc, cur) => {
        if (cur.Key) {
          const [artist, album, trackWNum] = cur.Key.split("/");

          acc[artist] = acc[artist] || {};
          acc[artist][album] = acc[artist][album] || {
            id: `${artist}/${album}`,
            title: album,
            coverArt: null,
            tracks: [],
          };
          const [trackNum, title] = trackWNum.split("__");
          acc[artist][album].tracks.push({
            title,
            trackNum: Number(trackNum),
            lastModified: cur.LastModified?.valueOf() || null,
            url:
              `https://${STORAGE_BUCKET}.s3.${STORAGE_REGION}.amazonaws.com/` +
              cur.Key,
          });
        }
        return acc;
      }, files);

      isTruncated = Boolean(IsTruncated);
      command.input.ContinuationToken = NextContinuationToken;
    }
    return files;
  } catch (err) {
    console.error(err);
    throw err;
  }
};

/**
 * Get Files object
 * @param force Optionally force a fresh data pull. Otherwise data will be pulled from cache if available.
 **/
export const getUploadedFiles = async (force?: boolean): Promise<Files> => {
  if (!filesFetchCache || force) {
    filesFetchCache = fileFetch();
  }

  return filesFetchCache;
};
