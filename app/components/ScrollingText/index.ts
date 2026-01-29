/** @file Scrolling-text custom element: marquee when content overflows, static when it fits. */

// TEMPLATE ///////////////////////////////////////////////////////////////////

const template = document.createElement("template");

template.innerHTML = `
  <style>
    :host {
      display: block;
      overflow: hidden;
      width: 100%;
    }
    
    .scrolling-text-container {
      display: block;
      overflow: hidden;
      width: 100%;
      white-space: nowrap;
    }
    
    .scrolling-text-wrapper {
      display: inline-block;
      white-space: nowrap;
      /* Ensure wrapper can be wider than container for scrolling */
      min-width: max-content;
    }
    
    .scrolling-text-content {
      display: inline-block;
      white-space: nowrap;
    }
    
    .scrolling-text-duplicate {
      display: none;
      white-space: nowrap;
      padding-left: var(--text-gap, 16px);
    }
    
    .scrolling-text-container.scrolling .scrolling-text-wrapper {
      animation: scroll-text var(--scroll-duration, 15s) linear infinite;
    }
    
    /* Always show duplicate for seamless scrolling */
    .scrolling-text-container.scrolling .scrolling-text-duplicate {
      display: inline-block;
    }
    
    @keyframes scroll-text {
      0% {
        transform: translateX(0);
      }
      100% {
        transform: translateX(var(--scroll-distance, -200px));
      }
    }
    
    /* Pause animation on hover for better UX */
    .scrolling-text-container.scrolling:hover .scrolling-text-wrapper {
      animation-play-state: paused;
    }
  </style>
  <div class="scrolling-text-container">
    <span class="scrolling-text-wrapper">
      <span class="scrolling-text-content"></span>
      <span class="scrolling-text-duplicate"></span>
    </span>
  </div>
`;
// ELEMENT ////////////////////////////////////////////////////////////////////

/**
 * Custom element that shows a scrolling text (marquee) effect when content
 * overflows, and static text when it fits.
 *
 * - **Content**: Uses the element’s text content (including from child nodes).
 *   Only text is shown; HTML in children is not rendered.
 * - **When it scrolls**: Scrolling runs only when the measured text is wider
 *   than the element. Otherwise the text is shown without animation.
 * - **Interaction**: Animation pauses on hover.
 * - **Attributes**: `class` and `style` are observed and applied to the inner
 *   container so you can style the visible area (e.g. typography, width).
 *
 * **CSS custom property**
 *
 * - `--text-gap` (default `16px`): Gap between the original and duplicated
 *   text when scrolling. Set on the host: `<scrolling-text style="--text-gap: 24px">`.
 *
 * @example
 * ```html
 * <scrolling-text class="some-class">Some long text that might overflow</scrolling-text>
 * ```
 *
 * @extends HTMLElement
 * @customElement scrolling-text
 */
export class ScrollingTextCustomElement extends HTMLElement {
  private resizeObserver: ResizeObserver | null = null;
  private mutationObserver: MutationObserver | null = null;
  private animationFrameId: number | null = null;
  private containerElement: HTMLElement | null = null;
  private wrapperElement: HTMLElement | null = null;
  private textElement: HTMLElement | null = null;
  private duplicateElement: HTMLElement | null = null;

  constructor() {
    super();

    // Create shadow root in constructor to encapsulate styles
    this.attachShadow({ mode: "open" });

    // Clone the template content and append it to the shadow root
    this.shadowRoot!.appendChild(template.content.cloneNode(true));

    // Get references to elements
    this.containerElement = this.shadowRoot!.querySelector(
      ".scrolling-text-container",
    ) as HTMLElement;
    this.wrapperElement = this.shadowRoot!.querySelector(
      ".scrolling-text-wrapper",
    ) as HTMLElement;
    this.textElement = this.shadowRoot!.querySelector(
      ".scrolling-text-content",
    ) as HTMLElement;
    this.duplicateElement = this.shadowRoot!.querySelector(
      ".scrolling-text-duplicate",
    ) as HTMLElement;
  }

  /** Attributes forwarded to the inner container for styling. */
  static get observedAttributes(): string[] {
    return ["class", "style"];
  }

  /**
   * Syncs class and style from the host to the inner container when they change.
   */
  attributeChangedCallback(
    name: string,
    _oldValue: string | null,
    _newValue: string | null,
  ): void {
    if (name === "class") {
      this.updateContainerClasses();
    } else if (name === "style") {
      this.updateContainerStyles();
    }
  }

  /**
   * Handles window resize events as a fallback.
   * Bound in constructor to maintain reference for cleanup.
   */
  private handleResize = (): void => {
    this.checkAndUpdateScrolling();
  };

  /**
   * Checks if the text content overflows its container and updates the
   * scrolling state accordingly.
   */
  private checkAndUpdateScrolling(): void {
    if (!this.containerElement || !this.textElement || !this.wrapperElement) {
      return;
    }

    // Cancel any pending animation frame
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }

    // Use requestAnimationFrame to ensure layout is complete
    this.animationFrameId = requestAnimationFrame(() => {
      const textContent = this.textElement!.textContent || "";

      // Measure text width for overflow detection and animation
      let textWidth = 0;

      if (textContent) {
        const tempSpan = document.createElement("span");
        tempSpan.style.visibility = "hidden";
        tempSpan.style.position = "absolute";
        tempSpan.style.whiteSpace = "nowrap";
        tempSpan.textContent = textContent;

        // Copy computed styles from text element to get accurate measurements
        const textStyles = globalThis.getComputedStyle(this.textElement!);
        tempSpan.style.font = textStyles.font;
        tempSpan.style.fontSize = textStyles.fontSize;
        tempSpan.style.fontFamily = textStyles.fontFamily;
        tempSpan.style.fontWeight = textStyles.fontWeight;
        tempSpan.style.letterSpacing = textStyles.letterSpacing;

        document.body.appendChild(tempSpan);
        textWidth = tempSpan.offsetWidth;
        document.body.removeChild(tempSpan);
      }

      // Use a minimum width if text is empty or too small to ensure scrolling is visible
      if (textWidth === 0 || textWidth < 50) {
        textWidth = 200; // Default width for empty or very short text
      }

      const containerWidth = this.offsetWidth;
      const shouldScroll = containerWidth && textWidth &&
        containerWidth < textWidth;
      if (!shouldScroll) {
        this.containerElement!.classList.remove("scrolling");
        return;
      }

      // Enable scrolling when text overflows
      this.containerElement!.classList.add("scrolling");
      // For seamless scrolling: duplicate starts immediately after original (gap = 0)
      // Scroll by exactly -textWidth so duplicate appears at original's starting position
      const scrollDistanceValue = -textWidth;
      const duration = Math.max(10, textWidth / 50);
      this.containerElement!.style.setProperty(
        "--scroll-duration",
        `${duration}s`,
      );
      this.containerElement!.style.setProperty(
        "--scroll-distance",
        `${scrollDistanceValue}px`,
      );

      this.animationFrameId = null;
    });
  }

  /**
   * Copies classes from the custom element to the container element.
   */
  private updateContainerClasses(): void {
    if (this.containerElement) {
      // Copy classes from custom element to container
      this.containerElement.setAttribute(
        "class",
        `scrolling-text-container ${this.getAttribute("class") || ""}`,
      );
    }
  }

  /**
   * Copies styles from the custom element to the container element.
   */
  private updateContainerStyles(): void {
    if (this.containerElement) {
      // Copy styles from custom element to container
      this.containerElement.setAttribute(
        "style",
        this.getAttribute("style") || "",
      );
    }
  }

  connectedCallback(): void {
    this.updateContainerClasses();
    this.updateContainerStyles();
    this.render();

    // Use double requestAnimationFrame to ensure layout is complete
    // before initial overflow check (needed for accurate measurements)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.checkAndUpdateScrolling();
      });
    });

    // Set up ResizeObserver to watch for size changes
    // Observe both the host element and the container element
    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => {
        this.checkAndUpdateScrolling();
      });
      // Observe the host element (for external size changes)
      this.resizeObserver.observe(this);
      // Also observe the container element (for internal size changes)
      if (this.containerElement) {
        this.resizeObserver.observe(this.containerElement);
      }
    }

    // Set up MutationObserver to watch for child node changes
    if (typeof MutationObserver !== "undefined") {
      this.mutationObserver = new MutationObserver(() => {
        this.render();
      });
      this.mutationObserver.observe(this, {
        childList: true,
        characterData: true,
        subtree: true,
      });
    }

    // Add window resize listener as fallback for mobile/resize events
    globalThis.addEventListener("resize", this.handleResize);
    // Also listen for orientation changes on mobile
    globalThis.addEventListener("orientationchange", this.handleResize);
  }

  disconnectedCallback(): void {
    // Clean up ResizeObserver
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    // Clean up MutationObserver
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
      this.mutationObserver = null;
    }

    // Remove window event listeners
    globalThis.removeEventListener("resize", this.handleResize);
    globalThis.removeEventListener("orientationchange", this.handleResize);

    // Cancel any pending animation frames
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private render(): void {
    const container = this.containerElement;
    const text = this.textElement;
    const duplicate = this.duplicateElement;
    if (!container || !text || !duplicate) {
      return;
    }

    // Use textContent instead of innerHTML to capture text set via textContent property
    const textContent = this.textContent || "";
    text.textContent = textContent;

    // Set duplicate text content for seamless scrolling
    duplicate.textContent = textContent;

    // Check scrolling after a brief delay to ensure layout is complete
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.checkAndUpdateScrolling();
      });
    });
  }
}

// REGISTRATION ///////////////////////////////////////////////////////////////

customElements.define("scrolling-text", ScrollingTextCustomElement);
