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

// Move environment validation into a function that's called during runtime
// rather than during module initialization
const validateConfig = () => {
  const {
    AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY,
    STORAGE_REGION,
    STORAGE_BUCKET,
  } = process.env;

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

  return {
    AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY,
    STORAGE_REGION,
    STORAGE_BUCKET,
  };
};

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
  const config = validateConfig();
  const s3 = new AWS.S3({
    credentials: {
      accessKeyId: config.AWS_ACCESS_KEY_ID,
      secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
    },
    region: config.STORAGE_REGION,
  });
  const pass = new PassThrough();
  return {
    writeStream: pass,
    promise: s3
      .upload({ Bucket: config.STORAGE_BUCKET, Key, Body: pass })
      .promise(),
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
  const config = validateConfig();

  if (name !== "files") {
    return undefined;
  }

  // Collect file data
  const dataArray = [];
  for await (const x of data) {
    dataArray.push(x);
  }
  const file = new File(dataArray, "temp", { type: contentType });
  const fileArrayBuffer = await file.arrayBuffer();
  const uint8Array = new Uint8Array(fileArrayBuffer);

  // 1. Get file metadata
  const id3Tags = await getID3Tags(uint8Array);

  // 2. Handle cover image
  if (id3Tags.image) {
    const albumPath = `${id3Tags.artist}/${id3Tags.album}/cover.jpeg`;
    const s3 = new AWS.S3({
      credentials: {
        accessKeyId: config.AWS_ACCESS_KEY_ID,
        secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
      },
      region: config.STORAGE_REGION,
    });

    try {
      // 2.1 Check if cover image exists
      await s3
        .headObject({
          Bucket: config.STORAGE_BUCKET,
          Key: albumPath,
        })
        .promise();
    } catch (error) {
      // 2.2 If cover doesn't exist, upload it
      if ((error as AWS.AWSError).code === "NotFound") {
        // Convert base64 image to buffer
        const base64Data = id3Tags.image.replace(
          /^data:image\/jpeg;base64,/,
          "",
        );
        const imageBuffer = Buffer.from(base64Data, "base64");

        await s3
          .putObject({
            Bucket: config.STORAGE_BUCKET,
            Key: albumPath,
            Body: imageBuffer,
            ContentType: "image/jpeg",
          })
          .promise();
      }
    }
  }

  // 3. Upload audio file
  const partitiionedFilename = `${id3Tags.artist}/${id3Tags.album}/${id3Tags.trackNumber}__${id3Tags.title}`;
  const uploadedFileLocation = await uploadStreamToS3(
    createAsyncIteratorFromArrayBuffer(fileArrayBuffer),
    partitiionedFilename,
  );

  return uploadedFileLocation;
};

// Reading ////////////////////////////////////////////////////////////////////

const client = new S3Client({
  region: process.env.STORAGE_REGION,
  credentials: fromEnv(),
});

/** File fetch cache to avoid repetitve fetches */
let filesFetchCache: Promise<Files> | null = null;

/** Get file list from S3 and organize it into a `Files` object */
const fileFetch = async (): Promise<Files> => {
  const config = validateConfig();
  const command = new ListObjectsV2Command({
    Bucket: config.STORAGE_BUCKET,
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
              `https://${config.STORAGE_BUCKET}.s3.${config.STORAGE_REGION}.amazonaws.com/` +
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
