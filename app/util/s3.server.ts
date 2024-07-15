import type { UploadHandler } from "@remix-run/node";

import AWS from "aws-sdk";
import { PassThrough } from "stream";
import { getID3Tags } from "./id3";
import { writeAsyncIterableToWritable } from "@remix-run/node";

const { STORAGE_ACCESS_KEY, STORAGE_SECRET, STORAGE_REGION, STORAGE_BUCKET } =
  process.env;

if (
  !(STORAGE_ACCESS_KEY && STORAGE_SECRET && STORAGE_REGION && STORAGE_BUCKET)
) {
  throw new Error(`Storage is missing required configuration.`);
}

const uploadStream = ({ Key }: Pick<AWS.S3.Types.PutObjectRequest, "Key">) => {
  const s3 = new AWS.S3({
    credentials: {
      accessKeyId: STORAGE_ACCESS_KEY,
      secretAccessKey: STORAGE_SECRET,
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
  const id3Tags = await getID3Tags(file);
  const partitiionedFilename = `${id3Tags.artist}/${id3Tags.album}/${id3Tags.trackNumber}__${id3Tags.title}`;
  const uploadedFileLocation = await uploadStreamToS3(
    data,
    partitiionedFilename,
  );

  return uploadedFileLocation;
};
