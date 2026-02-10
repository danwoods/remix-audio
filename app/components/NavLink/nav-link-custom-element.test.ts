/** @file Tests for NavLinkCustomElement
 *
 * Covers client-side navigation: click on nav-link fetches fragment JSON,
 * updates main content and title, and pushes history state.
 */

import { assertEquals, assertExists } from "@std/assert";

// ============================================================================
// MOCK STATE
// ============================================================================

const fetchCalls: { url: string; headers: Record<string, string> }[] = [];
const pushStateCalls: unknown[][] = [];
let mainInnerHTML = "";
let documentTitle = "";
let preventDefaultCalled = false;

// ============================================================================
// MOCK HELPERS
// ============================================================================

function createMockFn<T extends (...args: unknown[]) => unknown>(
  returnValue?: ReturnType<T>,
): T & { calls: unknown[][] } {
  const calls: unknown[][] = [];
  const fn = ((...args: unknown[]) => {
    calls.push(args);
    return returnValue;
  }) as T & { calls: unknown[][] };
  fn.calls = calls;
  return fn;
}

// ============================================================================
// DOM SETUP (must run before importing the element module)
// ============================================================================

function setupDOMEnvironment() {
  fetchCalls.length = 0;
  pushStateCalls.length = 0;
  mainInnerHTML = "";
  documentTitle = "";
  preventDefaultCalled = false;

  const mainEl = {
    get innerHTML() {
      return mainInnerHTML;
    },
    set innerHTML(value: string) {
      mainInnerHTML = value;
    },
  };

  const mockTemplateContent = {
    cloneNode(_deep: boolean) {
      return { appendChild: createMockFn() };
    },
  };

  globalThis.document = {
    createElement(tagName: string) {
      if (tagName === "template") {
        return {
          innerHTML: "",
          content: mockTemplateContent,
        } as unknown as HTMLTemplateElement;
      }
      return {} as HTMLElement;
    },
    querySelector(selector: string) {
      if (selector === "main") return mainEl;
      return null;
    },
    get title() {
      return documentTitle;
    },
    set title(value: string) {
      documentTitle = value;
    },
    baseURI: "http://localhost:8000/",
    head: {
      appendChild: createMockFn(),
      querySelector: () => null,
      querySelectorAll: () => [],
      removeChild: () => {},
    },
    getElementById: () => null,
  } as unknown as Document;

  const mockLocation = {
    origin: "http://localhost:8000",
    href: "http://localhost:8000/",
  };
  const mockHistory = {
    pushState: (...args: unknown[]) => {
      pushStateCalls.push(args);
    },
  };
  const mockAddEventListener = () => {};

  (globalThis as {
    window: typeof globalThis & {
      location: typeof mockLocation;
      history: typeof mockHistory;
      addEventListener: typeof mockAddEventListener;
    };
  }).window = {
    ...globalThis,
    location: mockLocation,
    history: mockHistory,
    addEventListener: mockAddEventListener,
  };

  // Component uses globalThis.location/history/addEventListener; in Deno those
  // are not set, so point them at the same mocks as window.
  (globalThis as { location: typeof mockLocation }).location = mockLocation;
  (globalThis as { history: typeof mockHistory }).history = mockHistory;
  (globalThis as { addEventListener: typeof mockAddEventListener })
    .addEventListener = mockAddEventListener;

  (globalThis as { customElements: { define: () => void } }).customElements = {
    define: () => {},
  };

  globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string"
      ? input
      : input instanceof URL
      ? input.href
      : (input as Request).url;
    const headers: Record<string, string> = {};
    if (init?.headers) {
      if (init.headers instanceof Headers) {
        init.headers.forEach((v: string, k: string) => {
          headers[k] = v;
        });
      } else {
        for (
          const [k, v] of Object.entries(init.headers as Record<string, string>)
        ) {
          headers[k] = String(v);
        }
      }
    }
    fetchCalls.push({ url, headers });
    return Promise.resolve({
      ok: true,
      headers: new Headers({ "Content-Type": "application/json" }),
      json: () =>
        Promise.resolve({
          title: "New Title",
          html: "<div>new content</div>",
          meta: [],
        }),
    } as Response);
  };
}

class MockHTMLElement {
  _attrs: Record<string, string> = {};
  _listeners: Record<string, (e: Event) => void> = {};
  shadowRoot: { appendChild: (node: unknown) => void } | null = null;

  attachShadow(_opts: { mode: string }) {
    this.shadowRoot = { appendChild: () => {} };
    return this.shadowRoot;
  }

  getAttribute(name: string): string | null {
    return this._attrs[name] ?? null;
  }

  setAttribute(name: string, value: string) {
    this._attrs[name] = value;
  }

  removeAttribute(name: string) {
    delete this._attrs[name];
  }

  addEventListener(type: string, fn: (e: Event) => void) {
    this._listeners[type] = fn;
  }

  removeEventListener(type: string) {
    delete this._listeners[type];
  }

  dispatchEvent(e: Event): boolean {
    const fn = this._listeners[e.type];
    if (fn) fn(e);
    return true;
  }
}

(globalThis as { HTMLElement: typeof MockHTMLElement }).HTMLElement =
  MockHTMLElement as unknown as typeof HTMLElement;

// ============================================================================
// TESTS
// ============================================================================

Deno.test("NavLinkCustomElement - popstate triggers fetch and applyEnvelope", async () => {
  setupDOMEnvironment();

  const popstateUrl = "http://localhost:8000/artists/a/albums/b";
  let popstateListener: (() => void) | null = null;

  const popstateWindow = {
    ...globalThis,
    location: {
      origin: "http://localhost:8000",
      get href() {
        return popstateUrl;
      },
    },
    history: { pushState: () => {} },
    addEventListener(type: string, fn: () => void) {
      if (type === "popstate") popstateListener = fn;
    },
  } as unknown as Window;
  (globalThis as { window: Window }).window = popstateWindow;
  (globalThis as { location: typeof popstateWindow.location }).location =
    popstateWindow.location;
  (globalThis as { history: typeof popstateWindow.history }).history =
    popstateWindow.history;
  (globalThis as { addEventListener: typeof popstateWindow.addEventListener })
    .addEventListener = popstateWindow.addEventListener;

  globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string"
      ? input
      : input instanceof URL
      ? input.href
      : (input as Request).url;
    const headers: Record<string, string> = {};
    if (init?.headers) {
      if (init.headers instanceof Headers) {
        init.headers.forEach((v: string, k: string) => {
          headers[k] = v;
        });
      } else {
        for (
          const [k, v] of Object.entries(init.headers as Record<string, string>)
        ) {
          headers[k] = String(v);
        }
      }
    }
    fetchCalls.push({ url, headers });
    return Promise.resolve({
      ok: true,
      headers: new Headers({ "Content-Type": "application/json" }),
      json: () =>
        Promise.resolve({
          title: "Popstate Title",
          html: "<div>popstate content</div>",
          meta: [],
        }),
    }) as Promise<Response>;
  };

  const { NavLinkCustomElement } = await import(
    "./nav-link-custom-element.ts"
  );

  const el = new NavLinkCustomElement() as unknown as
    & InstanceType<
      typeof MockHTMLElement
    >
    & { connectedCallback?: () => void };
  if (
    typeof (el as { connectedCallback?: () => void }).connectedCallback ===
      "function"
  ) {
    (el as { connectedCallback: () => void }).connectedCallback();
  }

  assertExists(popstateListener, "popstate listener should be registered");
  popstateListener!();

  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));

  assertEquals(fetchCalls.length, 1);
  assertEquals(fetchCalls[0].url, popstateUrl);
  assertEquals(fetchCalls[0].headers["X-Requested-With"], "fetch");
  assertEquals(mainInnerHTML, "<div>popstate content</div>");
  assertEquals(documentTitle, "Popstate Title");
});

Deno.test("NavLinkCustomElement - popstate shows error after 4 fragment load failures and does not reload", async () => {
  setupDOMEnvironment();

  const popstateUrl = "http://localhost:8000/artists/a/albums/b";
  let popstateListener: (() => void) | null = null;
  const reloadCalls: unknown[] = [];
  const storage: Record<string, string> = {};

  const popstateWindow = {
    ...globalThis,
    location: {
      origin: "http://localhost:8000",
      get href() {
        return popstateUrl;
      },
      reload() {
        reloadCalls.push(undefined);
      },
    },
    history: { pushState: () => {} },
    addEventListener(type: string, fn: () => void) {
      if (type === "popstate") popstateListener = fn;
    },
    get sessionStorage() {
      return {
        getItem(key: string) {
          return storage[key] ?? null;
        },
        setItem(key: string, value: string) {
          storage[key] = value;
        },
        removeItem(key: string) {
          delete storage[key];
        },
      };
    },
  } as unknown as Window & { sessionStorage: Storage };
  (globalThis as { window: Window }).window = popstateWindow;
  (globalThis as { location: typeof popstateWindow.location }).location =
    popstateWindow.location;
  (globalThis as { history: typeof popstateWindow.history }).history =
    popstateWindow.history;
  (globalThis as { addEventListener: typeof popstateWindow.addEventListener })
    .addEventListener = popstateWindow.addEventListener;
  (globalThis as { sessionStorage: Storage }).sessionStorage =
    popstateWindow.sessionStorage;

  globalThis.fetch = () =>
    Promise.resolve({ ok: false, status: 503 }) as Promise<Response>;

  const { NavLinkCustomElement, _testResetPopstateState } = await import(
    "./nav-link-custom-element.ts"
  );
  _testResetPopstateState();

  const el = new NavLinkCustomElement() as unknown as
    & InstanceType<typeof MockHTMLElement>
    & { connectedCallback?: () => void };
  if (
    typeof (el as { connectedCallback?: () => void }).connectedCallback ===
      "function"
  ) {
    (el as { connectedCallback: () => void }).connectedCallback();
  }

  assertExists(popstateListener, "popstate listener should be registered");

  for (let i = 0; i < 4; i++) {
    popstateListener!();
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
  }

  assertEquals(
    reloadCalls.length,
    0,
    "reload must not be called; error should be shown after 4 failures",
  );
  assertEquals(
    mainInnerHTML.includes("Couldn't load this page"),
    true,
    "main should show error message after 4 failures",
  );
});

Deno.test("NavLinkCustomElement - click fetches with X-Requested-With header and updates main and title", async () => {
  setupDOMEnvironment();

  const { NavLinkCustomElement } = await import(
    "./nav-link-custom-element.ts"
  );

  const el = new NavLinkCustomElement() as unknown as
    & InstanceType<
      typeof MockHTMLElement
    >
    & { connectedCallback?: () => void };
  el.setAttribute("href", "/");
  if (
    typeof (el as { connectedCallback?: () => void }).connectedCallback ===
      "function"
  ) {
    (el as { connectedCallback: () => void }).connectedCallback();
  }

  const preventDefault = () => {
    preventDefaultCalled = true;
  };
  const clickEvent = {
    type: "click",
    bubbles: true,
    preventDefault,
  } as unknown as Event;

  el.dispatchEvent(clickEvent);

  // Flush microtasks and task queue so fetch and applyEnvelope complete before assertions.
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));

  assertEquals(fetchCalls.length, 1);
  assertEquals(fetchCalls[0].url, "http://localhost:8000/");
  assertEquals(fetchCalls[0].headers["X-Requested-With"], "fetch");
  assertEquals(mainInnerHTML, "<div>new content</div>");
  assertEquals(documentTitle, "New Title");
  assertEquals(pushStateCalls.length, 1);
  assertExists(pushStateCalls[0][2]);
  assertEquals(pushStateCalls[0][2] as string, "http://localhost:8000/");
});

Deno.test("NavLinkCustomElement - click with cross-origin href does not preventDefault and does not fetch", async () => {
  setupDOMEnvironment();

  const { NavLinkCustomElement } = await import(
    "./nav-link-custom-element.ts"
  );

  const el = new NavLinkCustomElement() as unknown as
    & InstanceType<
      typeof MockHTMLElement
    >
    & { connectedCallback?: () => void };
  el.setAttribute("href", "https://example.com/");
  if (
    typeof (el as { connectedCallback?: () => void }).connectedCallback ===
      "function"
  ) {
    (el as { connectedCallback: () => void }).connectedCallback();
  }

  const preventDefault = () => {
    preventDefaultCalled = true;
  };
  const clickEvent = {
    type: "click",
    bubbles: true,
    preventDefault,
  } as unknown as Event;

  el.dispatchEvent(clickEvent);

  assertEquals(
    preventDefaultCalled,
    false,
    "cross-origin link should not prevent default",
  );
  assertEquals(
    fetchCalls.length,
    0,
    "cross-origin link should not trigger fetch",
  );
});

Deno.test("NavLinkCustomElement - click with metaKey (Cmd+click) does not preventDefault and does not fetch", async () => {
  setupDOMEnvironment();

  const { NavLinkCustomElement } = await import(
    "./nav-link-custom-element.ts"
  );

  const el = new NavLinkCustomElement() as unknown as
    & InstanceType<
      typeof MockHTMLElement
    >
    & { connectedCallback?: () => void };
  el.setAttribute("href", "/");
  if (
    typeof (el as { connectedCallback?: () => void }).connectedCallback ===
      "function"
  ) {
    (el as { connectedCallback: () => void }).connectedCallback();
  }

  const preventDefault = () => {
    preventDefaultCalled = true;
  };
  const clickEvent = {
    type: "click",
    bubbles: true,
    preventDefault,
    metaKey: true,
  } as unknown as Event;

  el.dispatchEvent(clickEvent);

  assertEquals(
    preventDefaultCalled,
    false,
    "Cmd+click should not prevent default (allows open in new tab)",
  );
  assertEquals(
    fetchCalls.length,
    0,
    "Cmd+click should not trigger fragment fetch",
  );
});

Deno.test("NavLinkCustomElement - keydown Enter triggers same fetch as click", async () => {
  setupDOMEnvironment();

  const { NavLinkCustomElement } = await import(
    "./nav-link-custom-element.ts"
  );

  const el = new NavLinkCustomElement() as unknown as
    & InstanceType<
      typeof MockHTMLElement
    >
    & { connectedCallback?: () => void };
  el.setAttribute("href", "/");
  if (
    typeof (el as { connectedCallback?: () => void }).connectedCallback ===
      "function"
  ) {
    (el as { connectedCallback: () => void }).connectedCallback();
  }

  const preventDefault = () => {
    preventDefaultCalled = true;
  };
  const keydownEvent = {
    type: "keydown",
    key: "Enter",
    bubbles: true,
    preventDefault,
  } as unknown as Event;

  el.dispatchEvent(keydownEvent);

  // Flush microtasks and task queue so fetch and applyEnvelope complete before assertions.
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));

  assertEquals(fetchCalls.length, 1);
  assertEquals(fetchCalls[0].url, "http://localhost:8000/");
  assertEquals(fetchCalls[0].headers["X-Requested-With"], "fetch");
  assertEquals(preventDefaultCalled, true);
});

Deno.test("NavLinkCustomElement - keydown Enter with cross-origin href does not preventDefault and does not fetch", async () => {
  setupDOMEnvironment();

  const { NavLinkCustomElement } = await import(
    "./nav-link-custom-element.ts"
  );

  const el = new NavLinkCustomElement() as unknown as
    & InstanceType<
      typeof MockHTMLElement
    >
    & { connectedCallback?: () => void };
  el.setAttribute("href", "https://example.com/");
  if (
    typeof (el as { connectedCallback?: () => void }).connectedCallback ===
      "function"
  ) {
    (el as { connectedCallback: () => void }).connectedCallback();
  }

  const preventDefault = () => {
    preventDefaultCalled = true;
  };
  const keydownEvent = {
    type: "keydown",
    key: "Enter",
    bubbles: true,
    preventDefault,
  } as unknown as Event;

  el.dispatchEvent(keydownEvent);

  assertEquals(
    preventDefaultCalled,
    false,
    "cross-origin keydown should not prevent default",
  );
  assertEquals(
    fetchCalls.length,
    0,
    "cross-origin keydown should not trigger fetch",
  );
});

Deno.test("NavLinkCustomElement - fallback to location.href when fetch fails", async () => {
  setupDOMEnvironment();
  let locationHrefSet = "";
  const fallbackLocation = {
    origin: "http://localhost:8000",
    get href() {
      return locationHrefSet || "http://localhost:8000/";
    },
    set href(value: string) {
      locationHrefSet = value;
    },
  };
  const fallbackWindow = {
    ...globalThis,
    location: fallbackLocation,
    history: { pushState: () => {} },
    addEventListener: () => {},
  } as unknown as Window;
  (globalThis as { window: Window }).window = fallbackWindow;
  (globalThis as { location: typeof fallbackLocation }).location =
    fallbackLocation;

  globalThis.fetch = () =>
    Promise.resolve({ ok: false, status: 500 } as Response);

  const { NavLinkCustomElement } = await import(
    "./nav-link-custom-element.ts"
  );

  const el = new NavLinkCustomElement() as unknown as
    & InstanceType<
      typeof MockHTMLElement
    >
    & { connectedCallback?: () => void };
  el.setAttribute("href", "/");
  if (
    typeof (el as { connectedCallback?: () => void }).connectedCallback ===
      "function"
  ) {
    (el as { connectedCallback: () => void }).connectedCallback();
  }

  const clickEvent = {
    type: "click",
    bubbles: true,
    preventDefault: () => {},
  } as unknown as Event;
  el.dispatchEvent(clickEvent);

  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));

  assertEquals(locationHrefSet, "http://localhost:8000/");
});

Deno.test("NavLinkCustomElement - fallback to location.href when fragment response Content-Type is not application/json", async () => {
  setupDOMEnvironment();
  let locationHrefSet = "";
  const fallbackLocation = {
    origin: "http://localhost:8000",
    get href() {
      return locationHrefSet || "http://localhost:8000/";
    },
    set href(value: string) {
      locationHrefSet = value;
    },
  };
  const fallbackWindow = {
    ...globalThis,
    location: fallbackLocation,
    history: { pushState: () => {} },
    addEventListener: () => {},
  } as unknown as Window;
  (globalThis as { window: Window }).window = fallbackWindow;
  (globalThis as { location: typeof fallbackLocation }).location =
    fallbackLocation;

  globalThis.fetch = () =>
    Promise.resolve({
      ok: true,
      headers: new Headers({ "Content-Type": "text/html" }),
      json: () =>
        Promise.resolve({
          title: "Untrusted",
          html: "<p>should not be applied</p>",
          meta: [],
        }),
    } as Response);

  const { NavLinkCustomElement } = await import(
    "./nav-link-custom-element.ts"
  );

  const el = new NavLinkCustomElement() as unknown as
    & InstanceType<typeof MockHTMLElement>
    & { connectedCallback?: () => void };
  el.setAttribute("href", "/");
  if (
    typeof (el as { connectedCallback?: () => void }).connectedCallback ===
      "function"
  ) {
    (el as { connectedCallback: () => void }).connectedCallback();
  }

  const clickEvent = {
    type: "click",
    bubbles: true,
    preventDefault: () => {},
  } as unknown as Event;
  el.dispatchEvent(clickEvent);

  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));

  assertEquals(
    mainInnerHTML,
    "",
    "main must not be updated when Content-Type is not application/json",
  );
  assertEquals(locationHrefSet, "http://localhost:8000/");
});

Deno.test("NavLinkCustomElement - fragment with empty meta clears OG meta from head", async () => {
  setupDOMEnvironment();

  const removeChildCalls: unknown[] = [];
  const mockOgMeta = [{}, {}];
  const doc = globalThis.document as {
    head: {
      appendChild: ReturnType<typeof createMockFn>;
      querySelector: () => null;
      querySelectorAll: (sel: string) => unknown[];
      removeChild: (child: unknown) => void;
    };
  };
  doc.head.querySelectorAll = (sel: string) =>
    sel === 'meta[property^="og:"]' ? mockOgMeta : [];
  doc.head.removeChild = (child: unknown) => {
    removeChildCalls.push(child);
  };

  const { NavLinkCustomElement } = await import(
    "./nav-link-custom-element.ts"
  );

  const el = new NavLinkCustomElement() as unknown as
    & InstanceType<
      typeof MockHTMLElement
    >
    & { connectedCallback?: () => void };
  el.setAttribute("href", "/");
  if (
    typeof (el as { connectedCallback?: () => void }).connectedCallback ===
      "function"
  ) {
    (el as { connectedCallback: () => void }).connectedCallback();
  }

  const clickEvent = {
    type: "click",
    bubbles: true,
    preventDefault: () => {},
  } as unknown as Event;
  el.dispatchEvent(clickEvent);

  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));

  assertEquals(
    removeChildCalls.length,
    2,
    "removeChild should be called for each OG meta",
  );
});

Deno.test("NavLinkCustomElement - fragment with new meta clears previous OG tags before applying", async () => {
  setupDOMEnvironment();

  const removeChildCalls: unknown[] = [];
  const mockOgMeta = [{}, {}, {}, {}, {}];
  const doc = globalThis.document as {
    head: {
      appendChild: ReturnType<typeof createMockFn>;
      querySelector: () => null;
      querySelectorAll: (sel: string) => unknown[];
      removeChild: (child: unknown) => void;
    };
  };
  doc.head.querySelectorAll = (sel: string) =>
    sel === 'meta[property^="og:"]' ? mockOgMeta : [];
  doc.head.removeChild = (child: unknown) => {
    removeChildCalls.push(child);
  };

  globalThis.fetch = () =>
    Promise.resolve({
      ok: true,
      headers: new Headers({ "Content-Type": "application/json" }),
      json: () =>
        Promise.resolve({
          title: "Home",
          html: "<div>home content</div>",
          meta: [
            { property: "og:title", content: "BoomBox" },
            { property: "og:description", content: "Music player" },
          ],
        }),
    } as Response);

  const { NavLinkCustomElement } = await import(
    "./nav-link-custom-element.ts"
  );

  const el = new NavLinkCustomElement() as unknown as
    & InstanceType<typeof MockHTMLElement>
    & { connectedCallback?: () => void };
  el.setAttribute("href", "/");
  if (
    typeof (el as { connectedCallback?: () => void }).connectedCallback ===
      "function"
  ) {
    (el as { connectedCallback: () => void }).connectedCallback();
  }

  const clickEvent = {
    type: "click",
    bubbles: true,
    preventDefault: () => {},
  } as unknown as Event;
  el.dispatchEvent(clickEvent);

  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));

  assertEquals(
    removeChildCalls.length,
    5,
    "removeChild should be called for each previous OG meta before applying new subset",
  );
});

Deno.test("NavLinkCustomElement - fragment with styles injects critical CSS into head", async () => {
  setupDOMEnvironment();

  const appendedToHead: unknown[] = [];
  const doc = globalThis.document as {
    head: {
      appendChild: (node: unknown) => void;
      querySelector: () => null;
      querySelectorAll: () => [];
      removeChild: () => void;
    };
  };
  doc.head.appendChild = (node: unknown) => {
    appendedToHead.push(node);
  };

  const criticalCss = "<style>.album-page-main { flex: 1; }</style>";
  globalThis.fetch = () =>
    Promise.resolve({
      ok: true,
      headers: new Headers({ "Content-Type": "application/json" }),
      json: () =>
        Promise.resolve({
          title: "Album",
          html: "<div>album content</div>",
          meta: [],
          styles: criticalCss,
        }),
    } as Response);

  const { NavLinkCustomElement } = await import(
    "./nav-link-custom-element.ts"
  );

  const el = new NavLinkCustomElement() as unknown as
    & InstanceType<
      typeof MockHTMLElement
    >
    & { connectedCallback?: () => void };
  el.setAttribute("href", "/artists/foo/albums/bar");
  if (
    typeof (el as { connectedCallback?: () => void }).connectedCallback ===
      "function"
  ) {
    (el as { connectedCallback: () => void }).connectedCallback();
  }

  const clickEvent = {
    type: "click",
    bubbles: true,
    preventDefault: () => {},
  } as unknown as Event;
  el.dispatchEvent(clickEvent);

  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));

  assertEquals(appendedToHead.length, 1);
  const styleEl = appendedToHead[0] as { id: string; textContent: string };
  assertEquals(styleEl.id, "fragment-critical-styles");
  assertEquals(styleEl.textContent.trim(), ".album-page-main { flex: 1; }");
});

Deno.test("NavLinkCustomElement - fragment with no styles removes existing critical-styles element", async () => {
  setupDOMEnvironment();

  let removeCalled = false;
  const mockStylesEl = {
    id: "fragment-critical-styles",
    remove: () => {
      removeCalled = true;
    },
  };
  const doc = globalThis.document as {
    getElementById: (id: string) => unknown;
  };
  doc.getElementById = (id: string) =>
    id === "fragment-critical-styles" ? mockStylesEl : null;

  globalThis.fetch = () =>
    Promise.resolve({
      ok: true,
      headers: new Headers({ "Content-Type": "application/json" }),
      json: () =>
        Promise.resolve({
          title: "Home",
          html: "<div>home</div>",
          meta: [],
          styles: undefined,
        }),
    } as Response);

  const { NavLinkCustomElement } = await import(
    "./nav-link-custom-element.ts"
  );

  const el = new NavLinkCustomElement() as unknown as
    & InstanceType<
      typeof MockHTMLElement
    >
    & { connectedCallback?: () => void };
  el.setAttribute("href", "/");
  if (
    typeof (el as { connectedCallback?: () => void }).connectedCallback ===
      "function"
  ) {
    (el as { connectedCallback: () => void }).connectedCallback();
  }

  const clickEvent = {
    type: "click",
    bubbles: true,
    preventDefault: () => {},
  } as unknown as Event;
  el.dispatchEvent(clickEvent);

  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));

  assertEquals(
    removeCalled,
    true,
    "existing fragment-critical-styles element should be removed",
  );
});
