/** @file Shared utilities for component tests.
 *
 * HTML function tests use parseHtmlFragment. Custom element tests use
 * createLinkedomEnv, wireLinkedomToGlobal, and optionally createCustomElement.
 *
 * @see app/components/README.md for test patterns.
 */

import { parseHTML } from "linkedom";

// ============================================================================
// HTML FRAGMENT PARSING
// ============================================================================

/** Parses an HTML string into a Document for DOM-based assertions. */
export function parseHtmlFragment(html: string): Document {
  const { document } = parseHTML(
    `<!DOCTYPE html><html><head></head><body>${html}</body></html>`,
    "http://localhost:8000/",
  );
  return document;
}

// ============================================================================
// LINKEDOM ENVIRONMENT
// ============================================================================

const DEFAULT_LINKEDOM_HTML = `<!DOCTYPE html>
<html><head></head><body></body></html>`;

/** Creates a linkedom document/window pair for custom element tests. */
export function createLinkedomEnv(html = DEFAULT_LINKEDOM_HTML): {
  document: Document;
  window: Window;
} {
  const { document, window } = parseHTML(html, "http://localhost:8000/");
  return {
    document: document as Document,
    window: window as unknown as Window,
  };
}

// ============================================================================
// GLOBAL WIRING
// ============================================================================

/** Options for wireLinkedomToGlobal. */
export type WireLinkedomOptions = {
  /** Wire Event and CustomEvent from linkedom (needed for dispatchEvent). */
  event?: boolean;
  /** Override globalThis.fetch. Omit to leave fetch unchanged. */
  fetch?: (
    input: RequestInfo | URL,
    init?: RequestInit,
  ) => Promise<Response>;
  /** Polyfill requestAnimationFrame/cancelAnimationFrame via setTimeout. */
  requestAnimationFrame?: boolean;
  /** Wire getComputedStyle mock for ScrollingText-like components. */
  getComputedStyle?: boolean;
};

/** Wires linkedom to globalThis and clears body. Call before importing custom elements. */
export function wireLinkedomToGlobal(
  linkedomWindow: Window & {
    Event?: typeof Event;
    CustomEvent?: typeof CustomEvent;
    setTimeout?: typeof setTimeout;
    clearTimeout?: typeof clearTimeout;
  },
  linkedomDocument: Document,
  options?: WireLinkedomOptions,
): void {
  const body = linkedomDocument.body;
  if (body) {
    while (body.firstChild) body.removeChild(body.firstChild);
  }

  (globalThis as { document: Document }).document = linkedomDocument;
  (globalThis as { window: Window }).window =
    linkedomWindow as unknown as Window;
  (globalThis as { customElements: CustomElementRegistry }).customElements =
    (linkedomWindow as Window & { customElements: CustomElementRegistry })
      .customElements;
  (globalThis as { HTMLElement: typeof HTMLElement }).HTMLElement =
    (linkedomWindow as Window & { HTMLElement: typeof HTMLElement })
      .HTMLElement;
  (globalThis as { setTimeout: typeof setTimeout }).setTimeout =
    linkedomWindow.setTimeout?.bind(linkedomWindow) ?? setTimeout;
  (globalThis as { clearTimeout: typeof clearTimeout }).clearTimeout =
    linkedomWindow.clearTimeout?.bind(linkedomWindow) ?? clearTimeout;

  if (options?.event && linkedomWindow.Event && linkedomWindow.CustomEvent) {
    (globalThis as { Event: typeof Event }).Event = linkedomWindow.Event;
    (globalThis as { CustomEvent: typeof CustomEvent }).CustomEvent =
      linkedomWindow.CustomEvent;
  }

  if (options?.fetch) {
    globalThis.fetch = options.fetch;
  }

  if (options?.requestAnimationFrame) {
    let rafId = 0;
    (globalThis as { requestAnimationFrame: typeof requestAnimationFrame })
      .requestAnimationFrame = (callback: FrameRequestCallback) => {
        rafId += 1;
        (linkedomWindow.setTimeout ?? setTimeout)(() => callback(0), 0);
        return rafId;
      };
    (globalThis as { cancelAnimationFrame: typeof cancelAnimationFrame })
      .cancelAnimationFrame = () => {};
  }

  if (options?.getComputedStyle) {
    (globalThis as { getComputedStyle: typeof getComputedStyle })
      .getComputedStyle = (_el: Element) =>
        ({
          font: "16px sans-serif",
          fontSize: "16px",
          fontFamily: "sans-serif",
          fontWeight: "400",
          letterSpacing: "normal",
        }) as CSSStyleDeclaration;
  }
}

// ============================================================================
// ELEMENT CREATION
// ============================================================================

/** Creates a custom element in the DOM with attributes. Append triggers connectedCallback. */
export function createCustomElement(
  doc: Document,
  tagName: string,
  attrs: Record<string, string> = {},
): HTMLElement {
  const body = doc.body;
  if (!body) throw new Error("body not found");
  const el = doc.createElement(tagName);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  body.appendChild(el);
  return el as HTMLElement;
}
