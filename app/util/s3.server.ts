/** @File Utilities for working with AWS S3 */
import type { Files } from "./files.ts";

import { getID3Tags } from "./id3.ts";
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
  // @ts-expect-error - Deno is available at runtime
  const AWS_ACCESS_KEY_ID = Deno.env.get("AWS_ACCESS_KEY_ID");
  // @ts-expect-error - Deno is available at runtime
  const AWS_SECRET_ACCESS_KEY = Deno.env.get("AWS_SECRET_ACCESS_KEY");
  // @ts-expect-error - Deno is available at runtime
  const STORAGE_REGION = Deno.env.get("STORAGE_REGION");
  // @ts-expect-error - Deno is available at runtime
  const STORAGE_BUCKET = Deno.env.get("STORAGE_BUCKET");

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

/** Upload file to S3 */
export async function uploadStreamToS3(
  data: AsyncIterable<Uint8Array>,
  filename: string,
) {
  const config = validateConfig();
  const client = new S3Client({
    region: config.STORAGE_REGION,
    credentials: {
      accessKeyId: config.AWS_ACCESS_KEY_ID,
      secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
    },
  });

  // Collect all chunks into a single Uint8Array
  const chunks: Uint8Array[] = [];
  for await (const chunk of data) {
    chunks.push(chunk);
  }

  // Calculate total length
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);

  // Combine all chunks into a single Uint8Array
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }

  // Upload to S3
  const command = new PutObjectCommand({
    Bucket: config.STORAGE_BUCKET,
    Key: filename,
    Body: combined,
  });

  await client.send(command);

  return `https://${config.STORAGE_BUCKET}.s3.${config.STORAGE_REGION}.amazonaws.com/${filename}`;
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
 * Handler for streaming files to S3. Extracts ID3 data from
 * files to organize into artist/album bucket structure.
 * This replaces the Remix UploadHandler interface.
 **/
export async function handleS3Upload(
  name: string,
  contentType: string,
  data: AsyncIterable<Uint8Array>,
): Promise<string | undefined> {
  const config = validateConfig();

  if (name !== "files") {
    return undefined;
  }

  // Collect file data
  const dataArray: BlobPart[] = [];
  for await (const x of data) {
    // Convert Uint8Array to ArrayBuffer for File constructor
    // Ensure we have a proper ArrayBuffer (not SharedArrayBuffer)
    if (x.buffer instanceof ArrayBuffer) {
      const buffer = x.buffer.slice(x.byteOffset, x.byteOffset + x.byteLength);
      dataArray.push(buffer);
    } else {
      // Fallback: create new ArrayBuffer and copy data
      const buffer = new ArrayBuffer(x.length);
      new Uint8Array(buffer).set(x);
      dataArray.push(buffer);
    }
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
          // Convert base64 image to Uint8Array (replacing Buffer)
          // Handle any image format and optional whitespace after comma
          const base64Data = id3Tags.image.replace(
            /^data:[^;]+;base64,\s*/,
            "",
          );
          // Convert base64 to Uint8Array
          const binaryString = atob(base64Data);
          const imageBuffer = Uint8Array.from(binaryString, (c) =>
            c.charCodeAt(0),
          );

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
}

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

          let [artist, album] = keyParts;
          const trackWNum = keyParts[2];

          // Decode URL-encoded artist and album names from S3 keys
          // S3 keys may be URL-encoded (e.g., "Childish%20Gambino" -> "Childish Gambino")
          try {
            artist = decodeURIComponent(artist);
            album = decodeURIComponent(album);
          } catch {
            // If decoding fails, use as-is (already decoded or invalid)
          }

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
