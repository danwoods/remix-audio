/**
 * @file Tests for AlbumImageCustomElement
 *
 * This test suite covers the album-image custom element that renders album art
 * from ID3 cover data. The element uses data-album-url to load the first track
 * of an album, extracts cover art via id3js, and displays it as a data URL.
 *
 * ## Test Structure
 *
 * Tests use Deno's built-in testing framework. DOM is mocked because Deno does
 * not provide a full DOM. The module is imported after DOM and fetch setup.
 *
 * ## Key Testing Areas
 *
 * 1. Element lifecycle: creation, shadow root, connectedCallback, disconnectedCallback
 * 2. Observed attributes: data-album-url, class (and style propagation)
 * 3. Class and style copied from host to inner img
 * 4. loadAlbumImage: getFirstSong + getAlbumArtAsDataUrl (mocked fetch for S3)
 * 5. AbortController cleanup on disconnect or album URL change
 */

import { assertEquals, assertExists } from "@std/assert";

// ============================================================================
// MOCK STATE
// ============================================================================

let elementAttributes: { [key: string]: string } = {};
const imgSetAttributeCalls: [string, string][] = [];
const imgAddEventListenerCalls: [string, unknown][] = [];
const imgRemoveEventListenerCalls: [string, unknown][] = [];
let imgComplete = false;
let imgNaturalHeight = 0;
let mockFetchUrl: string | null = null;

/** S3 list-type=2 XML with one track key. */
const S3_LIST_XML = `<?xml version="1.0" encoding="UTF-8"?>
<ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <Contents><Key>ArtistId/AlbumId/01__Track.mp3</Key></Contents>
</ListBucketResult>`;

// ============================================================================
// MOCK HELPER
// ============================================================================

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

// ============================================================================
// DOM SETUP (must run before importing the element module)
// ============================================================================

function setupDOMEnvironment() {
  elementAttributes = {};
  imgSetAttributeCalls.length = 0;
  imgAddEventListenerCalls.length = 0;
  imgRemoveEventListenerCalls.length = 0;
  imgComplete = false;
  imgNaturalHeight = 0;
  mockFetchUrl = null;

  const mockImg = {
    setAttribute(name: string, value: string) {
      imgSetAttributeCalls.push([name, value]);
    },
    getAttribute: createMockFn() as (name: string) => string | null,
    addEventListener(type: string, listener: unknown) {
      imgAddEventListenerCalls.push([type, listener]);
    },
    removeEventListener(type: string, listener: unknown) {
      imgRemoveEventListenerCalls.push([type, listener]);
    },
    get complete() {
      return imgComplete;
    },
    get naturalHeight() {
      return imgNaturalHeight;
    },
  };

  const mockShadowRoot = {
    appendChild: createMockFn(),
    querySelector(selector: string) {
      if (selector === "img") return mockImg;
      return null;
    },
    host: null as unknown as Element,
    mode: "open" as ShadowRootMode,
  };

  const mockTemplateContent = {
    cloneNode(_deep: boolean) {
      return mockShadowRoot;
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
    body: { appendChild: createMockFn(), removeChild: createMockFn() },
  } as unknown as Document;

  globalThis.customElements = {
    define: () => {},
  } as unknown as CustomElementRegistry;

  globalThis.HTMLElement = class HTMLElement {
    shadowRoot: ShadowRoot | null = null;

    constructor() {
      this.shadowRoot = mockShadowRoot as unknown as ShadowRoot;
    }

    attachShadow(_init: ShadowRootInit) {
      return this.shadowRoot!;
    }

    getAttribute(name: string) {
      return elementAttributes[name] ?? null;
    }

    setAttribute(name: string, value: string) {
      elementAttributes[name] = value;
    }

    removeAttribute(name: string) {
      delete elementAttributes[name];
    }

    addEventListener() {}
    removeEventListener() {}
    dispatchEvent() {
      return true;
    }
    querySelector() {
      return null;
    }
  } as unknown as typeof HTMLElement;

  globalThis.fetch = ((url: string | URL | Request) => {
    const urlStr = typeof url === "string"
      ? url
      : url instanceof URL
      ? url.href
      : url.url;
    mockFetchUrl = urlStr;
    if (urlStr.includes("list-type=2") && urlStr.includes("prefix=")) {
      return Promise.resolve(
        new Response(S3_LIST_XML, {
          headers: { "Content-Type": "application/xml" },
        }),
      );
    }
    return Promise.resolve(new Response("", { status: 404 }));
  }) as typeof fetch;
}

// ============================================================================
// MODULE IMPORT (after DOM setup)
// ============================================================================

setupDOMEnvironment();

const { AlbumImageCustomElement } = await import(
  "./album-image-custom-element.ts"
);

// ============================================================================
// TEST HELPER
// ============================================================================

function createTestElement(): InstanceType<typeof AlbumImageCustomElement> {
  elementAttributes = {};
  imgSetAttributeCalls.length = 0;
  imgAddEventListenerCalls.length = 0;
  imgRemoveEventListenerCalls.length = 0;
  imgComplete = false;
  imgNaturalHeight = 0;
  mockFetchUrl = null;

  const element = new AlbumImageCustomElement();

  const originalSetAttribute = element.setAttribute.bind(element);
  element.setAttribute = (name: string, value: string) => {
    const oldValue = element.getAttribute(name);
    originalSetAttribute(name, value);
    if (AlbumImageCustomElement.observedAttributes.includes(name)) {
      element.attributeChangedCallback(name, oldValue, value);
    }
  };

  return element;
}

// ============================================================================
// TEST SUITE: ELEMENT LIFECYCLE
// ============================================================================

Deno.test("AlbumImageCustomElement - should create element with shadow root", () => {
  const element = createTestElement();
  assertExists(element);
  assertEquals(element.constructor.name, "AlbumImageCustomElement");
  assertExists(element.shadowRoot);
  assertEquals(element.shadowRoot?.mode, "open");
});

Deno.test("AlbumImageCustomElement - should have observedAttributes data-album-url and class", () => {
  assertEquals(AlbumImageCustomElement.observedAttributes, [
    "data-album-url",
    "class",
  ]);
});

Deno.test("AlbumImageCustomElement - should copy class from host to img on connect", () => {
  const element = createTestElement();
  element.setAttribute("class", "album-cover rounded");
  element.connectedCallback();
  const classCalls = imgSetAttributeCalls.filter(([name]) => name === "class");
  assertExists(
    classCalls.find(([, value]) => value === "album-cover rounded"),
    "img class should be set from host",
  );
});

Deno.test("AlbumImageCustomElement - should copy style from host to img on connect", () => {
  const element = createTestElement();
  element.setAttribute("style", "width: 100%; border-radius: 4px;");
  element.connectedCallback();
  const styleCalls = imgSetAttributeCalls.filter(([name]) => name === "style");
  assertExists(
    styleCalls.find(([, value]) =>
      value === "width: 100%; border-radius: 4px;"
    ),
    "img style should be set from host",
  );
});

Deno.test("AlbumImageCustomElement - should update img class when class attribute changes", () => {
  const element = createTestElement();
  element.connectedCallback();
  imgSetAttributeCalls.length = 0;
  element.setAttribute("class", "new-class");
  const classCalls = imgSetAttributeCalls.filter(([name]) => name === "class");
  assertExists(
    classCalls.find(([, value]) => value === "new-class"),
    "img class should update when host class changes",
  );
});

Deno.test("AlbumImageCustomElement - should call loadAlbumImage on connect when data-album-url is set", async () => {
  const element = createTestElement();
  element.setAttribute(
    "data-album-url",
    "https://bucket.s3.region.amazonaws.com/ArtistId/AlbumId",
  );
  element.connectedCallback();
  await new Promise((r) => setTimeout(r, 50));
  assertExists(mockFetchUrl, "fetch should be called for S3 list");
  assertEquals(
    mockFetchUrl!.includes("list-type=2") &&
      mockFetchUrl!.includes("prefix=ArtistId/AlbumId/"),
    true,
  );
});

Deno.test("AlbumImageCustomElement - should not throw when disconnected", () => {
  const element = createTestElement();
  element.setAttribute(
    "data-album-url",
    "https://bucket.s3.region.amazonaws.com/ArtistId/AlbumId",
  );
  element.connectedCallback();
  element.disconnectedCallback();
});

Deno.test("AlbumImageCustomElement - should not throw when connecting with no data-album-url", () => {
  const element = createTestElement();
  element.connectedCallback();
  assertExists(element.shadowRoot);
});

Deno.test("AlbumImageCustomElement - should not fetch when data-album-url has no artist/album path", async () => {
  mockFetchUrl = null;
  const element = createTestElement();
  element.setAttribute(
    "data-album-url",
    "https://bucket.s3.region.amazonaws.com",
  );
  element.connectedCallback();
  await new Promise((r) => setTimeout(r, 30));
  const hadListFetch = mockFetchUrl !== null &&
    mockFetchUrl.includes("list-type=2") &&
    mockFetchUrl.includes("prefix=");
  assertEquals(
    hadListFetch,
    false,
    "should not call S3 list when URL has no artist/album segments",
  );
});

Deno.test("AlbumImageCustomElement - should trigger loadAlbumImage when data-album-url attribute changes", async () => {
  const element = createTestElement();
  element.connectedCallback();
  mockFetchUrl = null;
  element.setAttribute(
    "data-album-url",
    "https://bucket.s3.region.amazonaws.com/OtherArtist/OtherAlbum",
  );
  await new Promise((r) => setTimeout(r, 50));
  assertExists(
    mockFetchUrl,
    "fetch should be called when data-album-url is set",
  );
});
