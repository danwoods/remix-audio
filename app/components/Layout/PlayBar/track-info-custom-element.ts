/** @file Custom element for track info seen at the bottom of the screen */

import { getParentDataFromTrackUrl } from "../../../util/track.ts";
import "../../../components/ScrollingText/index.ts";

// TEMPLATE ///////////////////////////////////////////////////////////////////

const template = document.createElement("template");

template.innerHTML = `
  <style>
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }
    .root {
      align-items: center;
      display: flex;
    }
    .album-image {
      display: inline-block;
      min-width: var(--playbar-album-size, 96px);
      height: var(--playbar-album-size, 96px);
      flex-shrink: 0;
    }
    .text-container {
      margin-left: var(--playbar-gap, 1rem);
      overflow: hidden;
      min-width: 0;
    }
    scrolling-text.primary {
      font-size: var(--font-size-primary, 1rem);
    }
    scrolling-text.secondary {
      font-size: var(--font-size-secondary, 0.875rem);
    }
  </style>
  <div class="root">
    <album-image-custom-element data-album-url="" class="album-image"></album-image-custom-element>
    <div class="text-container">
      <scrolling-text class="primary"></scrolling-text>
      <div class="flex items-center">
        <scrolling-text class="secondary"></scrolling-text>
      </div>
    </div>
  </div>
`;

// ELEMENT ////////////////////////////////////////////////////////////////////

export class TrackInfoCustomElement extends HTMLElement {
  static observedAttributes = [
    "data-track-url",
  ];

  private trackUrl: string | null = null;

  constructor() {
    super();

    this.attachShadow({ mode: "open" });
    this.shadowRoot!.appendChild(template.content.cloneNode(true));
  }

  connectedCallback() {
    this.updateAttributes();
    this.render();
  }

  private updateAttributes() {
    this.trackUrl = this.getAttribute("data-track-url") || null;
    this.render();
  }

  private render() {
    if (!this.trackUrl) {
      return;
    }

    const { artistName, albumName, trackName, albumUrl } =
      getParentDataFromTrackUrl(
        this.trackUrl,
      );

    const scrollingText = artistName && albumName
      ? `${albumName}, ${artistName}`
      : null;

    this.shadowRoot!.querySelector("album-image-custom-element")!.setAttribute(
      "data-album-url",
      albumUrl || "",
    );
    this.shadowRoot!.querySelector("scrolling-text.primary")!.textContent =
      trackName;
    this.shadowRoot!.querySelector("scrolling-text.secondary")!.textContent =
      scrollingText ?? "";
  }
}

customElements.define("track-info-custom-element", TrackInfoCustomElement);
