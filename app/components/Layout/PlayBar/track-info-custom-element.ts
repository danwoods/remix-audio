/** @file Custom element for track info seen at the bottom of the screen */

import { getParentDataFromTrackUrl } from "../../../util/track.ts";

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
    width: 96px;
    height: 96px;
  }
  .text-container {
    margin-left: 1rem;
  }
</style>
  <div class="root">
    <album-image-custom-element data-album-url="" class="album-image"></album-image-custom-element>
    <div class="text-container">
      <p class="text-base font-bold track-name"></p>
      <div class="flex items-center">
        <p class="marquee pr-6 md:animate-none">
          <span class="text-sm text-nowrap scrolling-text"></span>
        </p>
        <p class="md:hidden marquee2 pr-6">
          <span class="text-sm text-nowrap scrolling-text"></span>
        </p>
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
    this.shadowRoot!.querySelector(".track-name")!.textContent = trackName;
    this.shadowRoot!.querySelector(".scrolling-text")!.textContent =
      scrollingText;
  }
}

customElements.define("track-info-custom-element", TrackInfoCustomElement);
