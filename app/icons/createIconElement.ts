/** @file Factory function for creating icon custom elements */

import { applyMergedClasses } from "../util/mergeClasses.ts";

/**
 * Options for creating an icon custom element.
 */
export interface CreateIconElementOptions {
  /** The SVG template string (should include the full SVG element) */
  svgTemplate: string;
  /** Default classes to apply (defaults to "size-6") */
  defaultClasses?: string;
  /** Custom styles to inject (defaults to standard icon styles) */
  customStyles?: string;
}

/**
 * Creates a custom element class for an icon.
 *
 * @param options - Configuration options for the icon element
 * @returns A custom element class that can be registered
 *
 * @example
 * ```ts
 * const PlayIcon = createIconElement({
 *   svgTemplate: `<svg>...</svg>`,
 *   defaultClasses: "size-6",
 * });
 * customElements.define("play-icon", PlayIcon);
 * ```
 */
export function createIconElement(options: CreateIconElementOptions) {
  const {
    svgTemplate,
    defaultClasses = "size-6 inline-block",
    customStyles = `
    svg {
      display: block;
      height: 100%;
    }
  `,
  } = options;

  // Create template outside the class
  const template = document.createElement("template");
  template.innerHTML = `
    <style>
      ${customStyles}
    </style>
    ${svgTemplate}
  `;

  /**
   * Custom element that renders an icon SVG.
   *
   * @remarks
   * The icon uses Tailwind CSS classes (${defaultClasses} by default) and inherits the current text color
   * via currentColor. Custom classes passed via the `class` attribute will be merged
   * with the default classes. You can override the size or add additional classes.
   * Styles and content are encapsulated within a shadow root.
   */
  class IconCustomElement extends HTMLElement {
    static observedAttributes = ["class"];

    private defaultClasses: string;

    constructor() {
      super();

      // Create shadow root in constructor to encapsulate styles
      this.attachShadow({ mode: "open" });

      // Clone the template content and append it to the shadow root
      this.shadowRoot!.appendChild(template.content.cloneNode(true));

      this.defaultClasses = defaultClasses;

      this.updateSvgClasses();
    }

    private updateSvgClasses() {
      const svg = this.shadowRoot!.querySelector("svg");
      if (svg) {
        console.log("updateSvgClasses", this.defaultClasses, this.className);
        applyMergedClasses(svg, this.defaultClasses, this.className);
      }
      // Also apply classes to the host element for proper sizing
      applyMergedClasses(this, this.defaultClasses, this.className);
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

  return IconCustomElement;
}
