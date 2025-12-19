/** @file Custom element for a play icon */

import { applyMergedClasses } from "../../util/mergeClasses.ts";

// TEMPLATE ///////////////////////////////////////////////////////////////////

const template = document.createElement("template");

template.innerHTML = `
  <style>
    svg {
      display: block;
      height: 100%;
    }
  </style>
  <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
  </svg>
`;

// <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-6">
//   <path fill-rule="evenodd" d="M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.286L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653Z" clip-rule="evenodd" />
// </svg>

// ELEMENT ////////////////////////////////////////////////////////////////////

/**
 * Custom element that renders a play icon SVG.
 *
 * @customElement play-icon
 *
 * @example
 * ```html
 * <play-icon></play-icon>
 * <play-icon class="size-8 text-blue-500"></play-icon>
 * ```
 *
 * @remarks
 * The icon uses Tailwind CSS classes (size-6 by default) and inherits the current text color
 * via stroke="currentColor". Custom classes passed via the `class` attribute will be merged
 * with the default `size-6` class. You can override the size or add additional classes.
 * Styles and content are encapsulated within a shadow root.
 */
export class PlayIconCustomElement extends HTMLElement {
  static observedAttributes = ["class"];

  private defaultClasses: string;

  constructor() {
    super();

    // Create shadow root in constructor to encapsulate styles
    this.attachShadow({ mode: "open" });

    // Clone the template content and append it to the shadow root
    this.shadowRoot!.appendChild(template.content.cloneNode(true));

    this.defaultClasses = "size-6";

    this.updateSvgClasses();
  }

  private updateSvgClasses() {
    const svg = this.shadowRoot!.querySelector("svg");
    if (svg) {
      console.log("updateSvgClasses", this.defaultClasses, this.className);
      applyMergedClasses(svg, this.defaultClasses, this.className);
    }
  }

  connectedCallback() {
    this.updateSvgClasses();
  }

  attributeChangedCallback(
    name: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _oldValue: string | null,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _newValue: string | null,
  ) {
    if (name === "class") {
      this.updateSvgClasses();
    }
  }
}

customElements.define("play-icon", PlayIconCustomElement);
