/** @file Functionality for working with file objects */

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
