/**
 * @file Tests for ProgressIndicatorCustomElement
 *
 * This test suite covers the track progress / scrub bar custom element
 * used in the playbar. The element displays current position and emits
 * seek events when the user clicks or drags.
 */

import { assertEquals, assertExists } from "@std/assert";

// ============================================================================
// MOCK STATE
// ============================================================================

let elementAttributes: { [key: string]: string } = {};
let fillStyleWidth = "";
let wrapAriaValuenow = "";
let wrapListeners: Array<{ type: string; handler: EventListener }> = [];
let documentPointerListeners: Array<{ type: string; handler: EventListener }> =
  [];
let seekEventListeners: ((event: Event) => void)[] = [];

function createMockFn<T extends (...args: unknown[]) => unknown>(
  returnValue?: ReturnType<T>,
): T & { calls: unknown[][]; called: boolean } {
  const calls: unknown[][] = [];
  const fn = ((...args: unknown[]) => {
    calls.push(args);
    return returnValue;
  }) as T & { calls: unknown[][]; called: boolean };
  fn.calls = calls;
  fn.called = false;
  Object.defineProperty(fn, "called", {
    get: () => calls.length > 0,
  });
  return fn;
}

function setupDOMEnvironment() {
  globalThis.document = {
    addEventListener: (type: string, handler: EventListener) => {
      if (type === "pointermove" || type === "pointerup") {
        documentPointerListeners.push({ type, handler });
      }
    },
    removeEventListener: (type: string, handler: EventListener) => {
      const i = documentPointerListeners.findIndex(
        (l) => l.type === type && l.handler === handler,
      );
      if (i !== -1) documentPointerListeners.splice(i, 1);
    },
    createElement: (tagName: string) => {
      if (tagName === "template") {
        return {
          innerHTML: "",
          content: {
            cloneNode: () => ({
              querySelector: (selector: string) => {
                if (selector === ".progress-fill") {
                  return {
                    style: {
                      get width() {
                        return fillStyleWidth;
                      },
                      set width(v: string) {
                        fillStyleWidth = v;
                      },
                    },
                  };
                }
                if (selector === ".progress-wrap") {
                  return {
                    setAttribute: (name: string, value: string) => {
                      if (name === "aria-valuenow") wrapAriaValuenow = value;
                    },
                    getAttribute: () => null,
                    getBoundingClientRect: () => ({ left: 0, width: 100 }),
                    addEventListener: (
                      type: string,
                      handler: EventListener,
                    ) => {
                      wrapListeners.push({ type, handler });
                    },
                    removeEventListener: (
                      type: string,
                      handler: EventListener,
                    ) => {
                      const i = wrapListeners.findIndex(
                        (l) => l.type === type && l.handler === handler,
                      );
                      if (i !== -1) wrapListeners.splice(i, 1);
                    },
                    setPointerCapture: () => {},
                  };
                }
                return null;
              },
            }),
          },
        } as unknown as HTMLTemplateElement;
      }
      return {} as unknown as HTMLElement;
    },
  } as unknown as Document;

  globalThis.customElements = {
    define: () => {},
  } as unknown as CustomElementRegistry;

  globalThis.HTMLElement = class HTMLElement {
    shadowRoot: ShadowRoot | null = null;

    constructor() {
      this.shadowRoot = {
        querySelector: (selector: string) => {
          if (selector === ".progress-fill") {
            return {
              style: {
                get width() {
                  return fillStyleWidth;
                },
                set width(v: string) {
                  fillStyleWidth = v;
                },
              },
            };
          }
          if (selector === ".progress-wrap") {
            return {
              setAttribute: (name: string, value: string) => {
                if (name === "aria-valuenow") wrapAriaValuenow = value;
              },
              getAttribute: () => null,
              getBoundingClientRect: () => ({ left: 0, width: 100 }),
              addEventListener: (type: string, handler: EventListener) => {
                wrapListeners.push({ type, handler });
              },
              removeEventListener: (
                type: string,
                handler: EventListener,
              ) => {
                const i = wrapListeners.findIndex(
                  (l) => l.type === type && l.handler === handler,
                );
                if (i !== -1) wrapListeners.splice(i, 1);
              },
              setPointerCapture: () => {},
            };
          }
          return null;
        },
        appendChild: createMockFn(),
      } as unknown as ShadowRoot;
    }

    addEventListener(
      type: string,
      listener: EventListenerOrEventListenerObject,
    ) {
      if (type === "seek" && typeof listener === "function") {
        seekEventListeners.push(listener);
      } else if (
        type === "seek" &&
        listener &&
        typeof listener === "object" &&
        "handleEvent" in listener
      ) {
        seekEventListeners.push((e) =>
          (listener as EventListenerObject).handleEvent(e)
        );
      }
    }

    removeEventListener(
      type: string,
      listener: EventListenerOrEventListenerObject,
    ) {
      if (type === "seek") {
        const i = seekEventListeners.indexOf(
          listener as (event: Event) => void,
        );
        if (i !== -1) seekEventListeners.splice(i, 1);
      }
    }

    getAttribute(name: string) {
      return elementAttributes[name] ?? null;
    }

    setAttribute(name: string, value: string) {
      elementAttributes[name] = value;
    }

    attachShadow() {
      return this.shadowRoot!;
    }

    dispatchEvent(event: Event): boolean {
      if (event.type === "seek") {
        seekEventListeners.forEach((listener) => {
          try {
            listener(event);
          } catch (_e) {
            // ignore
          }
        });
      }
      return true;
    }
  } as unknown as typeof HTMLElement;
}

function resetTestState() {
  elementAttributes = {};
  fillStyleWidth = "";
  wrapAriaValuenow = "";
  wrapListeners = [];
  documentPointerListeners = [];
  seekEventListeners = [];
}

// ============================================================================
// MODULE IMPORT
// ============================================================================

setupDOMEnvironment();
const { ProgressIndicatorCustomElement } = await import(
  "./progress-indicator-custom-element.ts"
);

function createTestElement(): InstanceType<
  typeof ProgressIndicatorCustomElement
> {
  resetTestState();
  return new ProgressIndicatorCustomElement();
}

// ============================================================================
// TESTS
// ============================================================================

Deno.test("ProgressIndicatorCustomElement - renders fill width from data-current-time and data-duration", () => {
  const el = createTestElement();
  el.setAttribute("data-current-time", "50");
  el.setAttribute("data-duration", "100");
  el.connectedCallback();
  assertEquals(fillStyleWidth, "50%");
  assertEquals(wrapAriaValuenow, "50");
});

Deno.test("ProgressIndicatorCustomElement - dispatches seek event with detail.time on pointerdown", () => {
  const el = createTestElement();
  el.setAttribute("data-current-time", "0");
  el.setAttribute("data-duration", "100");
  el.connectedCallback();

  let seekDetail: { time: number } | null = null;
  el.addEventListener(
    "seek",
    ((e: Event) => {
      seekDetail = (e as CustomEvent<{ time: number }>).detail;
    }) as EventListener,
  );

  const pointerdownHandler = wrapListeners.find((l) => l.type === "pointerdown")
    ?.handler;
  assertExists(pointerdownHandler);
  const syntheticPointerEvent = {
    button: 0,
    clientX: 50,
    pointerId: 0,
    preventDefault: () => {},
    target: { setPointerCapture: () => {} },
  };
  pointerdownHandler(syntheticPointerEvent as unknown as Event);

  assertExists(seekDetail, "seek event should be dispatched");
  assertEquals((seekDetail as { time: number }).time, 50);
});

Deno.test("ProgressIndicatorCustomElement - dispatches seek event on ArrowRight keydown", () => {
  const el = createTestElement();
  el.setAttribute("data-current-time", "50");
  el.setAttribute("data-duration", "100");
  el.connectedCallback();

  let seekDetail: { time: number } | null = null;
  el.addEventListener(
    "seek",
    ((e: Event) => {
      seekDetail = (e as CustomEvent<{ time: number }>).detail;
    }) as EventListener,
  );

  const keydownHandler = wrapListeners.find((l) => l.type === "keydown")
    ?.handler;
  assertExists(keydownHandler);
  const syntheticKeyEvent = {
    key: "ArrowRight",
    preventDefault: () => {},
  };
  keydownHandler(syntheticKeyEvent as unknown as Event);

  assertExists(seekDetail, "seek event should be dispatched");
  assertEquals((seekDetail as { time: number }).time, 55);
});

Deno.test("ProgressIndicatorCustomElement - removes document pointer listeners on disconnect", () => {
  const el = createTestElement();
  el.setAttribute("data-current-time", "0");
  el.setAttribute("data-duration", "100");
  el.connectedCallback();

  const pointerdownHandler = wrapListeners.find((l) => l.type === "pointerdown")
    ?.handler;
  assertExists(pointerdownHandler);
  const syntheticPointerEvent = {
    button: 0,
    clientX: 50,
    pointerId: 0,
    preventDefault: () => {},
    target: { setPointerCapture: () => {} },
  };
  pointerdownHandler(syntheticPointerEvent as unknown as Event);

  assertEquals(
    documentPointerListeners.length,
    2,
    "pointermove and pointerup should be on document after pointerdown",
  );

  el.disconnectedCallback();

  assertEquals(
    documentPointerListeners.length,
    0,
    "document pointer listeners should be removed on disconnect",
  );
});
