/** @file Custom element for the header on an album page. */

import * as id3 from "id3js";
import { extractColors } from "extract-colors";
import type { AlbumUrl } from "../../../lib/album.ts";
import { getFirstSong } from "../../../lib/album.ts";

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
 * Applies a gradient background to the album header element using extracted colors.
 *
 * @param elm - The HTML element to apply the gradient to.
 * @param colors - An array of two hex color strings [startColor, endColor] for the gradient.
 */
const setAlbumHeaderGradient = (elm: HTMLElement, colors: string[]) => {
  elm.setAttribute(
    "style",
    `background: linear-gradient(to bottom, ${colors[0]}, ${colors[1]});`,
  );
};

/**
 * Custom element for the header on an album page.
 */
export class AlbumHeaderCustomElement extends HTMLElement {
  static observedAttributes = ["data-album-url"];

  private scrollSentinel: HTMLDivElement | null = null;
  private scrollObserver: IntersectionObserver | null = null;

  constructor() {
    super();

    if (!this.getAttribute("data-album-url")) {
      throw new Error("Album URL is required");
    }

    const albumUrl = this.getAttribute("data-album-url") as AlbumUrl;
    const albumUrlParts = albumUrl.split("/");
    const albumId = albumUrlParts.pop();
    const artistId = albumUrlParts.pop();

    if (!artistId || !albumId) {
      throw new Error(
        "Artist ID or album ID missing or mis-configured in data-album-url attribute",
      );
    }

    this.innerHTML = `
      <header class="album-header" id="albumHeader">
        <div class="album-content">
          <div class="album-art"><album-image-custom-element data-album-url="${albumUrl}"></album-image-custom-element></div>
          <div class="album-info">
            <span class="album-label">Album</span>
            <h1 class="album-title">${albumId}</h1>
            <p class="album-artist">${artistId}</p>
            <p class="album-meta">2024 • 12 songs • 48 min</p>
          </div>
        </div>
      </header>
      `;

    getFirstSong(albumUrlParts.join("/"), artistId, albumId).then(
      (firstSong) => {
        const trackUrl = albumUrlParts.join("/") + "/" + firstSong;

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
    // Scroll handling with Intersection Observer for efficiency.
    // Use the scroll container: next sibling (when header is before the scroll area)
    // or nearest scrollable ancestor; otherwise viewport (body scroll).
    const scrollRoot = this.nextElementSibling ??
      this.findScrollableAncestor();
    const sentinel = document.createElement("div");
    sentinel.style.height = "1px";
    sentinel.style.pointerEvents = "none";
    sentinel.setAttribute("aria-hidden", "true");
    if (scrollRoot) {
      sentinel.style.position = "absolute";
      sentinel.style.top = "60px"; // Trigger point (px scrolled before shrink)
      sentinel.style.left = "0";
      sentinel.style.right = "0";
      scrollRoot.insertBefore(sentinel, scrollRoot.firstChild);
    } else {
      sentinel.style.position = "absolute";
      sentinel.style.top = "60px";
      sentinel.style.left = "0";
      sentinel.style.right = "0";
      document.body.insertBefore(sentinel, this);
    }

    this.scrollSentinel = sentinel;

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
        root: scrollRoot,
      },
    );

    observer.observe(sentinel);
    this.scrollObserver = observer;
  }

  /**
   * Returns the nearest ancestor that has overflow-y auto/scroll/overlay,
   * or null if none (viewport is the scroll context).
   */
  private findScrollableAncestor(): Element | null {
    let el: Element | null = this.parentElement;
    while (el) {
      const overflowY = getComputedStyle(el).overflowY;
      if (
        overflowY === "auto" ||
        overflowY === "scroll" ||
        overflowY === "overlay"
      ) {
        return el;
      }
      el = el.parentElement;
    }
    return null;
  }

  disconnectedCallback() {
    if (this.scrollObserver && this.scrollSentinel) {
      this.scrollObserver.disconnect();
      this.scrollObserver = null;
      this.scrollSentinel.remove();
      this.scrollSentinel = null;
    }
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
