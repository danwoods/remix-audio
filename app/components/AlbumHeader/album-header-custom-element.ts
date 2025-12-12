/** @file Custom element for the header on an album page. */

import * as id3 from "id3js";
import { extractColors } from "extract-colors";

/**
 * Lists the contents of an album bucket.
 *
 * @param albumUrl - The URL of the album bucket.
 * @returns A promise that resolves to an array of keys in the album bucket.
 */
const getAlbumContents = (
  albumUrl: string,
  artistId: string,
  albumId: string,
) =>
  fetch(`${albumUrl}/?list-type=2&prefix=${artistId}/${albumId}/`)
    .then((response) => response.text())
    .then((xml) => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xml, "text/xml");

      // S3 uses a namespace, so we need to handle it
      const contents = doc.getElementsByTagName("Contents");
      const keys = Array.from(contents).map((content) => {
        return content.getElementsByTagName("Key")[0].textContent;
      });

      return keys;
    })
    .catch((error) => {
      console.error("Error getting album contents", error);
      return [];
    });

/**
 * Extracts dominant colors from an album art image URL.
 *
 * @param objectUrl - The object URL (blob URL) of the album art image.
 * @returns A promise that resolves to an array of color objects extracted from the image.
 */
const extractAlbumArtColors = async (objectUrl: string) => {
  const colors = await extractColors(objectUrl);
  return colors;
};

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
 * Extracts gradient colors from album art for use in the header background.
 *
 * @param url - The URL of the audio file containing the album art.
 * @returns A promise that resolves to an array of two hex color strings [startColor, endColor], or null if no album art is found.
 */
const getAlbumHeaderGradient = async (url: string) => {
  const tags = await getId3Tags(url);

  if (Array.isArray(tags?.images)) {
    const arrayBuffer = tags.images[0].data;
    const blob = new Blob([arrayBuffer]);
    const srcBlob = URL.createObjectURL(blob);
    const colors = await extractAlbumArtColors(srcBlob);

    return [colors[0].hex, colors[colors.length - 1].hex];
  }

  return null;
};

/**
 * Sets the album art image in the specified HTML element.
 *
 * @param elm - The HTML element to insert the album art image into.
 * @param dataUrl - The data URL of the album art image.
 */
const setAlbumArt = async (elm: HTMLElement, dataUrl: string) => {
  elm.innerHTML =
    `<img src="${dataUrl}" alt="Album Art" style="max-width: 100%; max-height: 100%; border-radius: 8px;"/>`;
};

/**
 * Applies a gradient background to the album header element using extracted colors.
 *
 * @param elm - The HTML element to apply the gradient to.
 * @param colors - An array of two hex color strings [startColor, endColor] for the gradient.
 */
const setAlbumHeaderGradient = async (elm: HTMLElement, colors: string[]) => {
  elm.setAttribute(
    "style",
    `background: linear-gradient(to bottom, ${colors[0]}, ${colors[1]});`,
  );
};

/**
 * Custom element for the header on an album page.
 */
export class AlbumHeaderCustomElement extends HTMLElement {
  static observedAttributes = ["data-album-id"];

  constructor() {
    super();

    const albumUrl = this.getAttribute("data-album-url") || "";
    const albumUrlParts = albumUrl.split("/");
    const albumId = albumUrlParts.pop();
    const artistId = albumUrlParts.pop();

    if (!artistId || !albumId) {
      throw new Error("Artist ID and album ID are required");
    }

    this.innerHTML = `
      <header class="album-header" id="albumHeader">
        <div class="album-content">
          <div class="album-art">🎵</div>
          <div class="album-info">
            <span class="album-label">Album</span>
            <h1 class="album-title">${albumId}</h1>
            <p class="album-artist">${artistId}</p>
            <p class="album-meta">2024 • 12 songs • 48 min</p>
          </div>
        </div>
      </header>
      `;

    getAlbumContents(albumUrlParts.join("/"), artistId, albumId).then(
      (contents) => {
        const trackUrl = albumUrlParts.join("/") + "/" + contents[0];

        getAlbumArtAsDataUrl(trackUrl).then((dataUrl) => {
          if (dataUrl) {
            setAlbumArt(
              this.querySelector(".album-art") as HTMLElement,
              dataUrl,
            );
          }
        });

        getAlbumHeaderGradient(trackUrl).then((colors) => {
          if (colors) {
            setAlbumHeaderGradient(
              this.querySelector(".album-header") as HTMLElement,
              colors,
            );
          }
        });
      },
    );
  }

  connectedCallback() {
    // Scroll handling with Intersection Observer for efficiency
    const sentinel = document.createElement("div");
    sentinel.style.height = "1px";
    sentinel.style.position = "absolute";
    sentinel.style.top = "60px"; // Trigger point
    sentinel.style.left = "0";
    sentinel.style.right = "0";
    sentinel.style.pointerEvents = "none";
    document.body.insertBefore(sentinel, this);

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const header = this.querySelector(".album-header");
          // When sentinel is NOT intersecting (scrolled past), shrink header
          if (!entry.isIntersecting) {
            header?.classList.add("shrunk");
          } else {
            header?.classList.remove("shrunk");
          }
        });
      },
      {
        threshold: 0,
        rootMargin: "0px",
      },
    );

    observer.observe(sentinel);
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

customElements.define("album-header-custom-element", AlbumHeaderCustomElement);
