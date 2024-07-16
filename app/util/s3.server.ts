/** @File Utilities for working with AWS S3 */
import type { UploadHandler } from "@remix-run/node";

import AWS from "aws-sdk";
import { PassThrough } from "stream";
import { getID3Tags } from "./id3";
import { writeAsyncIterableToWritable } from "@remix-run/node";
import { fromEnv } from "@aws-sdk/credential-providers";
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { createAsyncIteratorFromArrayBuffer } from "./file";

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
// https://docs.aws.amazon.com/AmazonS3/latest/userguide/example_s3_Scenario_UsingLargeFiles_section.html

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

export async function uploadStreamToS3(
  data: AsyncIterable<Uint8Array>,
  filename: string,
) {
  const stream = uploadStream({
    Key: filename,
  });

  await writeAsyncIterableToWritable(data, stream.writeStream);
  const file = await stream.promise;
  console.log({ file });
  return file.Location;
}

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
  const id3Tags = await getID3Tags(file);
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

export type Track = { url: string; title: string; trackNum: number };

type Files = {
  [artist: string]: {
    [album: string]: Array<Track>;
  };
};

/**
 * Get an Object of all of the files in the bucket organized by artist > album > track
 * @returns An Object of audio file references
 */
export const getUploadedFiles = async (): Promise<Files> => {
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
          acc[artist][album] = acc[artist][album] || [];
          const [trackNum, title] = trackWNum.split("__");
          acc[artist][album].push({
            title,
            trackNum: Number(trackNum),
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
