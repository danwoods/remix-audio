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
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-6">
    <path fill-rule="evenodd" d="M6.75 5.25a.75.75 0 0 1 .75-.75H9a.75.75 0 0 1 .75.75v13.5a.75.75 0 0 1-.75.75H7.5a.75.75 0 0 1-.75-.75V5.25Zm7.5 0A.75.75 0 0 1 15 4.5h1.5a.75.75 0 0 1 .75.75v13.5a.75.75 0 0 1-.75.75H15a.75.75 0 0 1-.75-.75V5.25Z" clip-rule="evenodd" />
  </svg>
`;

// ELEMENT ////////////////////////////////////////////////////////////////////

/**
 * Custom element that renders a pause icon SVG.
 *
 * @customElement pause-icon
 *
 * @example
 * ```html
 * <pause-icon></pause-icon>
 * <pause-icon class="size-8 text-blue-500"></pause-icon>
 * ```
 *
 * @remarks
 * The icon uses Tailwind CSS classes (size-6 by default) and inherits the current text color
 * via stroke="currentColor". Custom classes passed via the `class` attribute will be merged
 * with the default `size-6` class. You can override the size or add additional classes.
 * Styles and content are encapsulated within a shadow root.
 */
export class PauseIconCustomElement extends HTMLElement {
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

customElements.define("pause-icon", PauseIconCustomElement);
