/** Mock for @aws-sdk/client-s3 - mock S3Client, real commands */
import {
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  NoSuchKey,
  PutObjectCommand,
} from "npm:@aws-sdk/client-s3@^3.614.0";

export {
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  NoSuchKey,
  PutObjectCommand,
};

export const sendCalls: { command: unknown }[] = [];

let sendBehavior: (command: unknown) => Promise<unknown> = (command) => {
  const name = (command as { constructor: { name: string } }).constructor?.name;
  if (name === "HeadObjectCommand") {
    const err = new Error("NotFound");
    (err as { name: string }).name = "NotFound";
    return Promise.reject(err);
  }
  return Promise.resolve({});
};

export function setSendBehavior(
  fn: (command: unknown) => Promise<unknown>,
): void {
  sendBehavior = fn;
}

export function clearSendCalls(): void {
  sendCalls.length = 0;
}

export class S3Client {
  send(command: unknown): Promise<unknown> {
    sendCalls.push({ command });
    return sendBehavior(command);
  }
}
