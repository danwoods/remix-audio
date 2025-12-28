/** @file Custom element for a pause icon */

import { createIconElement } from "../createIconElement.ts";

// ELEMENT ////////////////////////////////////////////////////////////////////

const svgTemplate = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-6">
    <path fill-rule="evenodd" d="M6.75 5.25a.75.75 0 0 1 .75-.75H9a.75.75 0 0 1 .75.75v13.5a.75.75 0 0 1-.75.75H7.5a.75.75 0 0 1-.75-.75V5.25Zm7.5 0A.75.75 0 0 1 15 4.5h1.5a.75.75 0 0 1 .75.75v13.5a.75.75 0 0 1-.75.75H15a.75.75 0 0 1-.75-.75V5.25Z" clip-rule="evenodd" />
  </svg>
`;

export const PauseIconCustomElement = createIconElement({
  svgTemplate,
  elementName: "pause-icon",
  defaultClasses: "size-6",
  description: "Custom element that renders a pause icon SVG.",
});

customElements.define("pause-icon", PauseIconCustomElement);
