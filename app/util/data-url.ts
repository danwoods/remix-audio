/** @file Shared data URL ↔ bytes conversion for client and server.
 *
 * Used by the server (album cover handler) and client (AlbumImage) when handling
 * ID3 cover art: server decodes data URLs to bytes for HTTP responses; client
 * encodes bytes to data URLs for img src. Keeps image format logic DRY.
 *
 * @module
 */

/**
 * Decode a data URL (e.g. from ID3 image) into bytes and content-type.
 * Works in both browser and Deno (atob, Uint8Array).
 *
 * @param dataUrl - String like "data:image/jpeg;base64,..."
 * @returns Object with body and contentType, or null if invalid
 */
export function decodeDataUrl(
  dataUrl: string,
): { body: Uint8Array; contentType: string } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  const contentType = match[1].trim();
  const base64 = match[2].replace(/\s/g, "");
  try {
    const binary = atob(base64);
    const body = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      body[i] = binary.charCodeAt(i);
    }
    return { body, contentType };
  } catch {
    return null;
  }
}

/**
 * Encode bytes and MIME type into a data URL using chunked base64.
 * Uses chunking to avoid stack overflow when processing large arrays.
 * Works in both browser and Deno (btoa, Uint8Array).
 *
 * @param data - Binary image data as Uint8Array or ArrayBuffer
 * @param mimeType - MIME type (e.g. "image/jpeg", "image/png")
 * @returns Data URL string in the format `data:{mimeType};base64,{base64}`
 */
export function createDataUrlFromBytes(
  data: Uint8Array | ArrayBuffer,
  mimeType: string,
): string {
  const uint8Array = data instanceof Uint8Array ? data : new Uint8Array(data);
  const chunkSize = 0x8000; // 32KB chunks
  const chunks: string[] = [];

  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    const chunk = uint8Array.subarray(
      i,
      Math.min(i + chunkSize, uint8Array.length),
    );
    let chunkStr = "";
    for (let j = 0; j < chunk.length; j++) {
      chunkStr += String.fromCharCode(chunk[j]);
    }
    chunks.push(chunkStr);
  }

  const binaryString = chunks.join("");
  const base64 = btoa(binaryString);
  return `data:${mimeType};base64,${base64}`;
}
