/** @File Utilities for working with AWS S3 */
import type { UploadHandler } from "@remix-run/node";
import type { Files } from "./files";

import { PassThrough } from "stream";
import { getID3Tags } from "./id3";
import { writeAsyncIterableToWritable } from "@remix-run/node";
import { fromEnv } from "@aws-sdk/credential-providers";
import {
  S3Client,
  ListObjectsV2Command,
  PutObjectCommand,
  HeadObjectCommand,
  NoSuchKey,
} from "@aws-sdk/client-s3";

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
const uploadStream = ({ Key }: { Key: string }) => {
  const config = validateConfig();
  const client = new S3Client({
    region: config.STORAGE_REGION,
    credentials: {
      accessKeyId: config.AWS_ACCESS_KEY_ID,
      secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
    },
  });
  const pass = new PassThrough();
  return {
    writeStream: pass,
    promise: (async () => {
      const command = new PutObjectCommand({
        Bucket: config.STORAGE_BUCKET,
        Key,
        Body: pass,
      });
      await client.send(command);
      return {
        Location: `https://${config.STORAGE_BUCKET}.s3.${config.STORAGE_REGION}.amazonaws.com/${Key}`,
      };
    })(),
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
  let id3Tags;
  try {
    id3Tags = await getID3Tags(uint8Array);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error(`Failed to extract ID3 tags from file: ${errorMessage}`);
    throw new Error(
      `Failed to extract metadata from audio file: ${errorMessage}`,
    );
  }

  // 2. Handle cover image
  if (id3Tags.image) {
    const albumPath = `${id3Tags.artist}/${id3Tags.album}/cover.jpeg`;
    const client = new S3Client({
      region: config.STORAGE_REGION,
      credentials: {
        accessKeyId: config.AWS_ACCESS_KEY_ID,
        secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
      },
    });

    try {
      // 2.1 Check if cover image exists
      const headCommand = new HeadObjectCommand({
        Bucket: config.STORAGE_BUCKET,
        Key: albumPath,
      });
      await client.send(headCommand);
    } catch (error) {
      // 2.2 If cover doesn't exist, upload it
      if (
        error instanceof NoSuchKey ||
        (error as { name?: string }).name === "NotFound"
      ) {
        try {
          // Convert base64 image to buffer
          const base64Data = id3Tags.image.replace(
            /^data:image\/jpeg;base64,/,
            "",
          );
          const imageBuffer = Buffer.from(base64Data, "base64");

          const putCommand = new PutObjectCommand({
            Bucket: config.STORAGE_BUCKET,
            Key: albumPath,
            Body: imageBuffer,
            ContentType: "image/jpeg",
          });
          await client.send(putCommand);
        } catch (uploadError) {
          // Log but don't fail the entire upload if cover image upload fails
          const errorMessage =
            uploadError instanceof Error
              ? uploadError.message
              : "Unknown error";
          const errorName =
            (uploadError as { name?: string }).name || "Unknown";
          console.error(
            `Failed to upload cover image for ${albumPath}: ${errorName} - ${errorMessage}`,
          );
          // Continue with audio file upload even if cover image fails
        }
      } else {
        // Log other errors (permissions, network, etc.) but continue with upload
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        const errorName = (error as { name?: string }).name || "Unknown";
        console.error(
          `Error checking cover image for ${albumPath}: ${errorName} - ${errorMessage}`,
        );
        // Continue with audio file upload even if cover check fails
      }
    }
  }

  // 3. Upload audio file
  const partitionedFilename = `${id3Tags.artist}/${id3Tags.album}/${id3Tags.trackNumber}__${id3Tags.title}`;
  const uploadedFileLocation = await uploadStreamToS3(
    createAsyncIteratorFromArrayBuffer(fileArrayBuffer),
    partitionedFilename,
  );

  return uploadedFileLocation;
};

// Reading ////////////////////////////////////////////////////////////////////

/** File fetch cache to avoid repetitve fetches */
let filesFetchCache: Promise<Files> | null = null;

/** Get file list from S3 and organize it into a `Files` object */
const fileFetch = async (): Promise<Files> => {
  const config = validateConfig();
  const client = new S3Client({
    region: config.STORAGE_REGION,
    credentials: fromEnv(),
  });
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
          const keyParts = cur.Key.split("/");

          // Validate: must have exactly 3 parts (artist/album/track)
          if (keyParts.length !== 3) {
            console.warn(
              `Skipping invalid file structure: ${cur.Key} (expected artist/album/track)`,
            );
            return acc;
          }

          const [artist, album, trackWNum] = keyParts;

          // Validate: artist and album must exist
          if (!artist || !album || !trackWNum) {
            console.warn(`Skipping file with missing parts: ${cur.Key}`);
            return acc;
          }

          // Validate: track filename must have __ separator
          const trackParts = trackWNum.split("__");
          if (trackParts.length !== 2) {
            console.warn(
              `Skipping invalid track filename format: ${cur.Key} (expected number__title)`,
            );
            return acc;
          }

          const [trackNumStr, title] = trackParts;
          const trackNum = Number(trackNumStr);

          // Validate: track number must be a valid number
          if (Number.isNaN(trackNum) || trackNum <= 0) {
            console.warn(`Skipping file with invalid track number: ${cur.Key}`);
            return acc;
          }

          // All validations passed, proceed with adding to files
          acc[artist] = acc[artist] || {};
          acc[artist][album] = acc[artist][album] || {
            id: `${artist}/${album}`,
            title: album,
            coverArt: null,
            tracks: [],
          };
          acc[artist][album].tracks.push({
            title: title || "Unknown",
            trackNum,
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
