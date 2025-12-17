/** @file Custom element for an album image. */

import * as id3 from "id3js";
import { getAlbumContents } from "../../../lib/album.ts";

/**
 * Retrieves ID3 metadata tags from an audio file URL.
 *
 * @param url - The URL of the audio file to extract ID3 tags from.
 * @returns A promise that resolves to the ID3 tags object containing metadata.
 */
const getId3Tags = async (url: string) => {
  const tags = await id3.fromUrl(url);
  return tags;
};

/**
 * Converts a Uint8Array to a base64 data URL using efficient chunking.
 *
 * Uses chunking to avoid stack overflow when processing large arrays.
 *
 * @param data - The binary data as a Uint8Array.
 * @param mimeType - The MIME type of the data (e.g., "image/jpeg", "image/png").
 * @returns A promise that resolves to a data URL string in the format `data:{mimeType};base64,{base64}`.
 */
const createDataUrlFromArrayBuffer = async (
  data: Uint8Array,
  mimeType: string,
) => {
  // Convert to base64 - use efficient chunking to avoid stack overflow
  const uint8Array = new Uint8Array(data);
  const chunkSize = 0x8000; // 32KB chunks
  const chunks: string[] = [];

  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    const chunk = uint8Array.subarray(
      i,
      Math.min(i + chunkSize, uint8Array.length),
    );
    // Build string for this chunk without spreading
    let chunkStr = "";
    for (let j = 0; j < chunk.length; j++) {
      chunkStr += String.fromCharCode(chunk[j]);
    }
    chunks.push(chunkStr);
  }

  const binaryString = chunks.join("");
  const base64 = btoa(binaryString);
  const dataUrl = `data:${mimeType};base64,${base64}`;

  return dataUrl;
};

/**
 * Extracts album art from an audio file and converts it to a data URL.
 *
 * @param url - The URL of the audio file containing the album art.
 * @returns A promise that resolves to a data URL string of the album art, or null if no album art is found.
 */
const getAlbumArtAsDataUrl = async (url: string) => {
  const tags = await getId3Tags(url);

  let dataUrl = null;

  if (Array.isArray(tags?.images)) {
    const arrayBuffer = tags.images[0].data;
    const mimeType = tags.images[0].mime || "image/jpeg";

    dataUrl = await createDataUrlFromArrayBuffer(arrayBuffer, mimeType);
  }

  return dataUrl;
};

/**
 * Custom element for an album image.
 */
export class AlbumImageCustomElement extends HTMLElement {
  static observedAttributes = ["data-album-url"];

  constructor() {
    super();

    this.innerHTML = `
      <img alt="Album Art" style="max-width: 100%; max-height: 100%; border-radius: 8px;"/>
    `;

    const albumUrl = this.getAttribute("data-album-url") || "";
    const albumUrlParts = albumUrl.split("/");
    const albumId = albumUrlParts.pop();
    const artistId = albumUrlParts.pop();

    if (!artistId || !albumId) {
      throw new Error("Artist ID and album ID are required");
    }

    getAlbumContents(albumUrlParts.join("/"), artistId, albumId).then(
      (contents) => {
        const trackUrl = albumUrlParts.join("/") + "/" + contents[0];

        getAlbumArtAsDataUrl(trackUrl).then((dataUrl) => {
          if (dataUrl) {
            this.querySelector("img")?.setAttribute("src", dataUrl);
          }
        });
      },
    );
  }

  connectedCallback() {
  }

  disconnectedCallback() {
    console.log("Custom element removed from page.");
  }

  connectedMoveCallback() {
    console.log("Custom element moved with moveBefore()");
  }

  adoptedCallback() {
    console.log("Custom element moved to new page.");
  }

  attributeChangedCallback(
    name: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _oldValue: string | null,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _newValue: string | null,
  ) {
    console.log(`Attribute ${name} has changed.`);
  }
}

customElements.define("album-image-custom-element", AlbumImageCustomElement);
