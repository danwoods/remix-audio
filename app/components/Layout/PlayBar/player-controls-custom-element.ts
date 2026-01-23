/** @file Custom element for player controls. */

import "../../../icons/play/index.ts";
import "../../../icons/pause/index.ts";
import "../../../icons/prev/index.ts";
import "../../../icons/next/index.ts";

type PlayState = "playing" | "paused" | undefined;

// TEMPLATE ///////////////////////////////////////////////////////////////////

const template = document.createElement("template");

template.innerHTML = `
  <style>
    :host {
      display: block;
      height: 100%;
    }
    button {
      background: none;
      border: none;
      color: #fff;
      cursor: pointer;
      height: 2.5rem;
      width: 2.5rem;
    }
    button:disabled {
      opacity: 0.5;
      cursor: default;
    }
    button[data-play-prev] {
      display: none;
      /* Note: CSS variables cannot be used in media queries, so we use the literal value */
      /* This matches --breakpoint-sm: 50rem defined in entry.css */
      @media only screen and (min-width: 50rem) {
        display: block;
      }
    }
    .root {
      align-items: center;
      display: flex;
      gap: 0.5rem;
      height: 100%;
      justify-content: center;
      padding-left: 1rem;
      padding-right: 1rem;
    }
  </style>
  <div class="root">
    <button data-play-prev>
      <prev-icon class="size-6"></prev-icon>
    </button>
    <button data-play-toggle>
      <play-icon></play-icon>
    </button>
    <button data-play-next>
      <next-icon></next-icon>
    </button>
  </div>
`;

// ELEMENT ////////////////////////////////////////////////////////////////////

/**
 * Custom element for player controls.
 *
 * @customElement player-controls-custom-element
 *
 * @attributes
 * - `data-play-state` (string | undefined): Play state. Must be the string "playing" or "paused", other values equate to "stopped".
 * - `data-has-previous-track` (string | undefined): Whether the previous track is available.
 * - `data-has-next-track` (string | undefined): Whether the next track is available.
 *
 * @emits
 * - `play-prev` (CustomEvent): Dispatched when the previous track button is clicked (if enabled).
 * - `play-toggle` (CustomEvent): Dispatched when the play/pause button is clicked.
 * - `play-next` (CustomEvent): Dispatched when the next track button is clicked (if enabled).
 */
export class PlayerControlsCustomElement extends HTMLElement {
  static observedAttributes = [
    "data-play-state",
    "data-has-previous-track",
    "data-has-next-track",
  ];

  private boundHandlePrevClick: (event: Event) => void;
  private boundHandleToggleClick: (event: Event) => void;
  private boundHandleNextClick: (event: Event) => void;

  constructor() {
    super();

    // Create shadow root in constructor to encapsulate styles
    this.attachShadow({ mode: "open" });

    // Clone the template content and append it to the shadow root
    this.shadowRoot!.appendChild(template.content.cloneNode(true));

    // Bind event handlers so we can remove them later
    this.boundHandlePrevClick = this.handlePrevClick.bind(this);
    this.boundHandleToggleClick = this.handleToggleClick.bind(this);
    this.boundHandleNextClick = this.handleNextClick.bind(this);
  }

  connectedCallback() {
    this.setupEventListeners();
    this.render();
  }

  disconnectedCallback() {
    this.removeEventListeners();
  }

  attributeChangedCallback(
    name: string,
  ) {
    if (
      name === "data-has-previous-track" ||
      name === "data-has-next-track" ||
      name === "data-play-state"
    ) {
      this.render();
    }
  }

  /**
   * Sets up event listeners for all control buttons.
   *
   * Attaches click event listeners to the previous, toggle, and next buttons
   * in the shadow DOM. This is called during `connectedCallback()` to ensure
   * listeners are active when the element is added to the DOM.
   *
   * @private
   */
  private setupEventListeners() {
    const prevButton = this.shadowRoot!.querySelector(
      "button[data-play-prev]",
    ) as HTMLButtonElement;
    const nextButton = this.shadowRoot!.querySelector(
      "button[data-play-next]",
    ) as HTMLButtonElement;
    const toggleButton = this.shadowRoot!.querySelector(
      "button[data-play-toggle]",
    ) as HTMLButtonElement;

    if (prevButton) {
      prevButton.addEventListener("click", this.boundHandlePrevClick);
    }
    if (nextButton) {
      nextButton.addEventListener("click", this.boundHandleNextClick);
    }
    if (toggleButton) {
      toggleButton.addEventListener("click", this.boundHandleToggleClick);
    }
  }

  /**
   * Removes event listeners from all control buttons.
   *
   * Detaches click event listeners from the previous, toggle, and next buttons
   * in the shadow DOM. This is called during `disconnectedCallback()` to prevent
   * memory leaks when the element is removed from the DOM.
   *
   * @private
   */
  private removeEventListeners() {
    const prevButton = this.shadowRoot!.querySelector(
      "button[data-play-prev]",
    ) as HTMLButtonElement;
    const nextButton = this.shadowRoot!.querySelector(
      "button[data-play-next]",
    ) as HTMLButtonElement;
    const toggleButton = this.shadowRoot!.querySelector(
      "button[data-play-toggle]",
    ) as HTMLButtonElement;

    if (prevButton) {
      prevButton.removeEventListener("click", this.boundHandlePrevClick);
    }
    if (nextButton) {
      nextButton.removeEventListener("click", this.boundHandleNextClick);
    }
    if (toggleButton) {
      toggleButton.removeEventListener("click", this.boundHandleToggleClick);
    }
  }

  /**
   * Handles clicks on the previous track button.
   *
   * Stops event propagation and dispatches a `play-prev` custom event if the
   * button is enabled. The event only fires when `data-has-previous-track` is
   * set to "true", which enables the button.
   *
   * @private
   * @param event - The click event from the previous button
   */
  private handlePrevClick(event: Event) {
    event.stopPropagation();
    const button = event.currentTarget as HTMLButtonElement;
    // Only dispatch if button is enabled
    if (!button.disabled) {
      this.dispatchEvent(
        new CustomEvent("play-prev", {
          bubbles: true,
          cancelable: false,
        }),
      );
    }
  }

  /**
   * Handles clicks on the play/pause toggle button.
   *
   * Stops event propagation and dispatches a `play-toggle` custom event.
   * This event is always dispatched regardless of the current play state,
   * allowing parent elements to handle the toggle logic.
   *
   * @private
   * @param event - The click event from the toggle button
   */
  private handleToggleClick(event: Event) {
    event.stopPropagation();
    this.dispatchEvent(
      new CustomEvent("play-toggle", {
        bubbles: true,
        cancelable: false,
      }),
    );
  }

  /**
   * Handles clicks on the next track button.
   *
   * Stops event propagation and dispatches a `play-next` custom event if the
   * button is enabled. The event only fires when `data-has-next-track` is
   * set to "true", which enables the button.
   *
   * @private
   * @param event - The click event from the next button
   */
  private handleNextClick(event: Event) {
    event.stopPropagation();
    const button = event.currentTarget as HTMLButtonElement;
    // Only dispatch if button is enabled
    if (!button.disabled) {
      this.dispatchEvent(
        new CustomEvent("play-next", {
          bubbles: true,
          cancelable: false,
        }),
      );
    }
  }

  private render() {
    const hasPreviousTrack =
      this.getAttribute("data-has-previous-track") === "true";
    const hasNextTrack = this.getAttribute("data-has-next-track") === "true";
    const playState = this.getAttribute("data-play-state") as PlayState;

    const prevButton = this.shadowRoot!.querySelector(
      "button[data-play-prev]",
    ) as HTMLButtonElement;
    const nextButton = this.shadowRoot!.querySelector(
      "button[data-play-next]",
    ) as HTMLButtonElement;
    const toggleButton = this.shadowRoot!.querySelector(
      "button[data-play-toggle]",
    ) as HTMLButtonElement;

    if (prevButton) {
      prevButton.disabled = !hasPreviousTrack;
    }
    if (nextButton) {
      nextButton.disabled = !hasNextTrack;
    }
    if (toggleButton) {
      toggleButton.innerHTML = playState === "playing"
        ? "<pause-icon></pause-icon>"
        : playState === "paused"
        ? "<play-icon class='animate-pulse'></play-icon>"
        : "<play-icon></play-icon>";
    }
  }
}

customElements.define(
  "player-controls-custom-element",
  PlayerControlsCustomElement,
);
