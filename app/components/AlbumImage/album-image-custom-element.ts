/** @file Custom element for an album image. */

import * as id3 from "id3js";
import { getFirstSong } from "../../../lib/album.ts";

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
 * @returns A data URL string in the format `data:{mimeType};base64,{base64}`.
 */
const createDataUrlFromArrayBuffer = (
  data: Uint8Array,
  mimeType: string,
): string => {
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
const getAlbumArtAsDataUrl = async (url: string): Promise<string | null> => {
  try {
    const tags = await getId3Tags(encodeURI(url));

    if (Array.isArray(tags?.images) && tags.images.length > 0) {
      const arrayBuffer = tags.images[0].data;
      const mimeType = tags.images[0].mime || "image/jpeg";

      return createDataUrlFromArrayBuffer(arrayBuffer, mimeType);
    }

    return null;
  } catch (_error) {
    // Silently fail - album art is optional
    return null;
  }
};

// CACHING ////////////////////////////////////////////////////////////////////

/** Cache of album art promises, keyed by album URL (not track URL) since album art is the same for all tracks in an album. */
const albumArtCache = new Map<string, Promise<string | null>>();

/**
 * Retrieves album art from an audio file and converts it to a data URL.
 * Cached by album URL to prevent re-fetching when tracks change within the same album.
 *
 * @param albumUrl - The full album URL (e.g., "https://bucket.s3.region.amazonaws.com/artist/album").
 * @param artistId - The artist ID.
 * @param albumId - The album ID.
 * @returns A promise that resolves to a data URL string of the album art, or null if no album art is found.
 */
const getAlbumArtAsDataUrlCached = async (
  albumUrl: string,
  artistId: string,
  albumId: string,
): Promise<string | null> => {
  // Cache by album URL, not track URL, since album art is the same for all tracks
  // Use the full albumUrl as the cache key
  if (!albumArtCache.has(albumUrl)) {
    // Get first song to extract album art from
    const albumUrlParts = albumUrl.split("/");
    const baseUrl = albumUrlParts.slice(0, -2).join("/"); // Remove artist and album from end
    const firstSong = await getFirstSong(
      baseUrl,
      artistId,
      albumId,
    );

    if (!firstSong) {
      return null;
    }

    // firstSong already contains the full path from bucket root (e.g., "artist/album/track1.mp3")
    // so just prepend the base URL
    const trackUrl = `${baseUrl}/${firstSong}`;
    albumArtCache.set(albumUrl, getAlbumArtAsDataUrl(trackUrl));
  }

  return albumArtCache.get(albumUrl)!;
};

// TEMPLATE ///////////////////////////////////////////////////////////////////

const template = document.createElement("template");

template.innerHTML = `
  <style>
    img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  </style>
  <img alt=""/>
`;

// ELEMENT ////////////////////////////////////////////////////////////////////

/**
 * Custom element for an album image.
 */
export class AlbumImageCustomElement extends HTMLElement {
  static observedAttributes = ["data-album-url", "class"];

  private artistId: string | null = null;
  private albumId: string | null = null;
  private currentAlbumUrl: string | null = null;
  private loadImageAbortController: AbortController | null = null;

  constructor() {
    super();

    // Create shadow root in constructor to encapsulate styles
    this.attachShadow({ mode: "open" });

    // Clone the template content and append it to the shadow root
    this.shadowRoot!.appendChild(template.content.cloneNode(true));

    this.updateImageClasses();
  }

  private async loadAlbumImage() {
    const albumUrl = this.getAttribute("data-album-url") || "";
    if (!albumUrl) {
      return;
    }

    const albumUrlParts = albumUrl.split("/");
    const albumId = albumUrlParts.pop();
    const artistId = albumUrlParts.pop();

    if (!artistId || !albumId) {
      return;
    }

    // If we're already loading/loaded the same album, don't reload
    // This prevents the image from popping in/out when tracks change within the same album
    if (
      this.currentAlbumUrl === albumUrl && this.artistId === artistId &&
      this.albumId === albumId
    ) {
      return;
    }

    // Abort any pending image load for a different album
    if (this.loadImageAbortController) {
      this.loadImageAbortController.abort();
    }
    this.loadImageAbortController = new AbortController();
    const signal = this.loadImageAbortController.signal;

    // Store for use in event handlers
    this.artistId = artistId;
    this.albumId = albumId;
    this.currentAlbumUrl = albumUrl;

    try {
      const dataUrl = await getAlbumArtAsDataUrlCached(
        albumUrl,
        artistId,
        albumId,
      );

      if (signal.aborted || !dataUrl) {
        return;
      }

      const img = this.shadowRoot!.querySelector("img");
      if (!img) {
        return;
      }

      // Set src first with empty alt to prevent flash
      img.setAttribute("src", dataUrl);

      // Set alt text for accessibility once image is loaded
      // Check if already loaded (cached images)
      if (img.complete && img.naturalHeight !== 0) {
        this.setAltText(img);
      } else {
        const loadHandler = () => {
          if (!signal.aborted) {
            this.setAltText(img);
          }
          // Clean up listeners
          img.removeEventListener("load", loadHandler);
          img.removeEventListener("error", errorHandler);
        };
        const errorHandler = () => {
          if (!signal.aborted) {
            this.setAltText(img);
          }
          // Clean up listeners
          img.removeEventListener("load", loadHandler);
          img.removeEventListener("error", errorHandler);
        };

        img.addEventListener("load", loadHandler, { once: true });
        img.addEventListener("error", errorHandler, { once: true });

        // Clean up listeners if aborted
        signal.addEventListener("abort", () => {
          img.removeEventListener("load", loadHandler);
          img.removeEventListener("error", errorHandler);
        });
      }
    } catch (_error) {
      // Silently fail - album art is optional
      // Error could be from network, parsing, etc.
    }
  }

  connectedCallback() {
    this.updateImageClasses();
    this.updateImageStyles();
    this.loadAlbumImage();
  }

  private setAltText(img: HTMLImageElement) {
    if (this.albumId && this.artistId) {
      img.setAttribute(
        "alt",
        `Album art for ${this.albumId} by ${this.artistId}`,
      );
    } else {
      img.setAttribute("alt", "Album art");
    }
  }

  private updateImageClasses() {
    const img = this.shadowRoot!.querySelector("img");
    if (img) {
      // Copy classes from custom element to img element
      img.setAttribute("class", this.getAttribute("class") || "");
    }
  }

  private updateImageStyles() {
    const img = this.shadowRoot!.querySelector("img");
    if (img) {
      // Copy styles from custom element to img element
      img.setAttribute("style", this.getAttribute("style") || "");
    }
  }

  disconnectedCallback() {
    // Clean up any pending image loads
    if (this.loadImageAbortController) {
      this.loadImageAbortController.abort();
      this.loadImageAbortController = null;
    }
  }

  connectedMoveCallback() {
    // Element moved in DOM - no action needed
  }

  adoptedCallback() {
    // Element moved to new document - no action needed
  }

  attributeChangedCallback(
    name: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _oldValue: string | null,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _newValue: string | null,
  ) {
    if (name === "class") {
      this.updateImageClasses();
    } else if (name === "data-album-url") {
      // Reload image when album URL changes
      this.loadAlbumImage();
    } else if (name === "style") {
      this.updateImageStyles();
    }
  }
}

customElements.define("album-image-custom-element", AlbumImageCustomElement);
