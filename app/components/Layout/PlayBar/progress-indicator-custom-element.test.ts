/** @file Tests for ProgressIndicatorCustomElement
 *
 * Covers the track progress / scrub bar: fill width from data-current-time/data-duration,
 * seek event on pointerdown and keydown ArrowRight, and document listener cleanup on disconnect.
 *
 * Uses linkedom for a real DOM environment; wires document/window to globalThis
 * so the component can run in Deno.
 */

import { assertEquals, assertExists } from "@std/assert";
import {
  createCustomElement,
  createLinkedomEnv,
  wireLinkedomToGlobal,
} from "../../test.utils.ts";

const { document: linkedomDocument, window: linkedomWindow } =
  createLinkedomEnv();

/** Tracks document pointer listeners for cleanup verification. */
const documentPointerListenerCount: { add: number; remove: number } = {
  add: 0,
  remove: 0,
};

function setupDOMEnvironment(options?: {
  /** When true, wraps document add/removeEventListener to track pointer listeners. */
  trackDocumentPointerListeners?: boolean;
}) {
  documentPointerListenerCount.add = 0;
  documentPointerListenerCount.remove = 0;

  wireLinkedomToGlobal(linkedomWindow, linkedomDocument, { event: true });

  if (options?.trackDocumentPointerListeners) {
    const origAdd = linkedomDocument.addEventListener.bind(linkedomDocument);
    const origRemove = linkedomDocument.removeEventListener.bind(
      linkedomDocument,
    );
    linkedomDocument.addEventListener = function (
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: AddEventListenerOptions | boolean,
    ) {
      if (type === "pointermove" || type === "pointerup") {
        documentPointerListenerCount.add++;
      }
      return origAdd(type, listener, options);
    };
    linkedomDocument.removeEventListener = function (
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: EventListenerOptions | boolean,
    ) {
      if (type === "pointermove" || type === "pointerup") {
        documentPointerListenerCount.remove++;
      }
      return origRemove(type, listener, options);
    };
  }
}

function createProgressIndicator(
  attrs: Record<string, string> = {},
): HTMLElement {
  return createCustomElement(
    linkedomDocument,
    "progress-indicator-custom-element",
    attrs,
  );
}

function getProgressFill(el: HTMLElement): HTMLElement | null {
  return el.shadowRoot?.querySelector(".progress-fill") as HTMLElement | null;
}

function getProgressWrap(el: HTMLElement): HTMLElement | null {
  return el.shadowRoot?.querySelector(".progress-wrap") as HTMLElement | null;
}

/** Creates a pointerdown-like event for tests. Linkedom lacks PointerEvent. */
function createPointerDownEvent(init: {
  clientX: number;
  button?: number;
  pointerId?: number;
}): Event {
  const ev = new linkedomWindow.Event("pointerdown", {
    bubbles: true,
    cancelable: true,
  });
  return Object.assign(ev, {
    clientX: init.clientX,
    button: init.button ?? 0,
    pointerId: init.pointerId ?? 0,
  });
}

/** Creates a keydown event for tests. Linkedom may lack KeyboardEvent. */
function createKeydownEvent(key: string): Event {
  const ev = new linkedomWindow.Event("keydown", {
    bubbles: true,
    cancelable: true,
  });
  return Object.assign(ev, { key });
}

// ============================================================================
// TESTS
// ============================================================================

Deno.test(
  "ProgressIndicatorCustomElement - renders fill width from data-current-time and data-duration",
  async () => {
    setupDOMEnvironment();
    await import("./progress-indicator-custom-element.ts");

    const el = createProgressIndicator({
      "data-current-time": "50",
      "data-duration": "100",
    });
    const fill = getProgressFill(el);
    const wrap = getProgressWrap(el);

    assertExists(fill);
    assertExists(wrap);
    assertEquals(fill.style.width, "50%");
    assertEquals(wrap.getAttribute("aria-valuenow"), "50");
  },
);

Deno.test(
  "ProgressIndicatorCustomElement - dispatches seek event with detail.time on pointerdown",
  async () => {
    setupDOMEnvironment();
    await import("./progress-indicator-custom-element.ts");

    const el = createProgressIndicator({
      "data-current-time": "0",
      "data-duration": "100",
    });
    const wrap = getProgressWrap(el);
    assertExists(wrap);

    // Patch getBoundingClientRect so clientX 50 maps to 50% = 50s
    wrap.getBoundingClientRect = () => ({
      left: 0,
      width: 100,
      top: 0,
      right: 100,
      bottom: 0,
      height: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);

    let seekDetail: { time: number } | null = null;
    el.addEventListener("seek", (e: Event) => {
      seekDetail = (e as CustomEvent<{ time: number }>).detail;
    });

    const pointerEvent = createPointerDownEvent({ clientX: 50 });
    wrap.dispatchEvent(pointerEvent);

    assertExists(seekDetail, "seek event should be dispatched");
    assertEquals((seekDetail as { time: number }).time, 50);
  },
);

Deno.test(
  "ProgressIndicatorCustomElement - dispatches seek event on ArrowRight keydown",
  async () => {
    setupDOMEnvironment();
    await import("./progress-indicator-custom-element.ts");

    const el = createProgressIndicator({
      "data-current-time": "50",
      "data-duration": "100",
    });
    const wrap = getProgressWrap(el);
    assertExists(wrap);

    let seekDetail: { time: number } | null = null;
    el.addEventListener("seek", (e: Event) => {
      seekDetail = (e as CustomEvent<{ time: number }>).detail;
    });

    const keyEvent = createKeydownEvent("ArrowRight");
    wrap.dispatchEvent(keyEvent);

    assertExists(seekDetail, "seek event should be dispatched");
    assertEquals((seekDetail as { time: number }).time, 55);
  },
);

Deno.test(
  "ProgressIndicatorCustomElement - removes document pointer listeners on disconnect",
  async () => {
    setupDOMEnvironment({ trackDocumentPointerListeners: true });
    await import("./progress-indicator-custom-element.ts");

    const el = createProgressIndicator({
      "data-current-time": "0",
      "data-duration": "100",
    });
    const wrap = getProgressWrap(el);
    assertExists(wrap);

    wrap.getBoundingClientRect = () => ({
      left: 0,
      width: 100,
      top: 0,
      right: 100,
      bottom: 0,
      height: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);

    const pointerEvent = createPointerDownEvent({ clientX: 50 });
    wrap.dispatchEvent(pointerEvent);

    assertEquals(
      documentPointerListenerCount.add,
      2,
      "pointermove and pointerup should be on document after pointerdown",
    );

    linkedomDocument.body?.removeChild(el);

    assertEquals(
      documentPointerListenerCount.remove,
      2,
      "document pointer listeners should be removed on disconnect",
    );
  },
);
