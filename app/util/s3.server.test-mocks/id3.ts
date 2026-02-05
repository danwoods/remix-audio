/** Mock for id3.ts - used when running s3.server tests with import map */
import type { ID3Tags } from "../id3.ts";

let returnValue: ID3Tags = {
  artist: "Test Artist",
  album: "Test Album",
  title: "Test Song",
  trackNumber: 1,
  image: "data:image/jpeg;base64,/9j/4AAQSkZJRg==",
};

export function setGetID3TagsReturn(value: ID3Tags): void {
  returnValue = value;
}

export function getID3Tags(_file: Uint8Array): Promise<ID3Tags> {
  return Promise.resolve(returnValue);
}
