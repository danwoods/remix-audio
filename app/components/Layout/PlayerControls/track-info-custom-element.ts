/** @file Custom element for track info seen at the bottom of the screen */

import { getParentDataFromTrackUrl } from "../../../util/track.ts";

// TEMPLATE ///////////////////////////////////////////////////////////////////

const template = document.createElement("template");

template.innerHTML = `
  <div class="max-sm:basis-3/5 lg:basis-5/12 overflow-x-clip items-center">
    <div class="flex cursor-default w-20">
      <album-image-custom-element data-album-url="" class="rounded z-10 size-20 inline-block"></album-image-custom-element>
      <div class="ml-3 pt-2">
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
