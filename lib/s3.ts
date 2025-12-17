/**
 * S3 bucket utilities for interacting with S3-compatible storage services.
 *
 * This module provides functions to interact with S3 buckets using the S3 REST API.
 * It uses the ListObjectsV2 API endpoint to retrieve bucket contents.
 */

/**
 * Retrieves a list of object keys (file paths) from an S3 bucket for a given prefix path.
 *
 * This function makes a request to the S3 ListObjectsV2 API endpoint and parses the XML
 * response to extract the keys of all objects matching the specified prefix.
 *
 * @param bucketUrl - The base URL of the S3 bucket (e.g., "https://my-bucket.s3.us-east-1.amazonaws.com")
 * @param path - The prefix path to filter objects by (e.g., "artist1/album1/")
 * @returns A promise that resolves to an array of object keys (file paths) matching the prefix
 * @throws Error if the fetch request fails or if the XML response cannot be parsed
 *
 * @example
 * ```ts
 * const keys = await getBucketContents(
 *   "https://my-bucket.s3.us-east-1.amazonaws.com",
 *   "artist1/album1/"
 * );
 * // Returns: ["artist1/album1/track1.mp3", "artist1/album1/track2.mp3", ...]
 * ```
 */
export const getBucketContents = async (bucketUrl: string, path: string) => {
  const response = await fetch(`${bucketUrl}/?list-type=2&prefix=${path}`);
  const xml = await response.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, "text/xml");
  const contents = doc.getElementsByTagName("Contents");
  const keys = Array.from(contents).map((content) => {
    return content.getElementsByTagName("Key")[0].textContent;
  });

  return keys;
};
