/** @file Tests for album-image-custom-element. */

import { beforeEach, describe, expect, test, vi } from "vitest";
import * as album from "../../../lib/album.ts";
import * as id3 from "id3js";
import { Buffer } from "node:buffer";

// Mock dependencies
vi.mock("../../../lib/album.ts");
vi.mock("id3js");

// Store template HTML to test it
let capturedTemplateHTML = "";
let imgAltAttribute = "";
let imgSrcAttribute = "";
let imgComplete = false;
let imgNaturalHeight = 0;
const imgEventListeners: { [key: string]: ((event: Event) => void)[] } = {};
let elementAttributes: { [key: string]: string } = {};
let mockImgElement: Partial<HTMLImageElement> | null = null;

// Set up DOM environment
beforeEach(() => {
  capturedTemplateHTML = "";
  imgAltAttribute = "";
  imgSrcAttribute = "";
  imgComplete = false;
  imgNaturalHeight = 0;
  imgEventListeners.load = [];
  imgEventListeners.error = [];
  elementAttributes = {};
  mockImgElement = null;

  // Create the mock img element that will be reused
  mockImgElement = {
    setAttribute: (name: string, value: string) => {
      if (name === "alt") imgAltAttribute = value;
      if (name === "src") {
        imgSrcAttribute = value;
        // Simulate image loading - set complete immediately
        imgComplete = true;
        imgNaturalHeight = 100;
        // Fire load event on next tick to allow event listeners to be attached first
        setTimeout(() => {
          const event = new Event("load");
          imgEventListeners.load.forEach((fn) => fn(event));
        }, 0);
      }
    },
    getAttribute: (name: string) => {
      if (name === "alt") return imgAltAttribute;
      if (name === "src") return imgSrcAttribute;
      return null;
    },
    addEventListener: (
      type: string,
      listener: EventListenerOrEventListenerObject,
      _options?: boolean | AddEventListenerOptions,
    ) => {
      if (!imgEventListeners[type]) imgEventListeners[type] = [];
      // Handle both function listeners and object listeners
      if (typeof listener === "function") {
        imgEventListeners[type].push(listener);
      } else if (
        listener && typeof listener === "object" && "handleEvent" in listener
      ) {
        imgEventListeners[type].push((event) => listener.handleEvent(event));
      }
    },
    get complete() {
      return imgComplete;
    },
    get naturalHeight() {
      return imgNaturalHeight;
    },
    className: "",
  };

  // Create a minimal DOM environment that captures template.innerHTML
  globalThis.document = {
    createElement: (tagName: string) => {
      if (tagName === "template") {
        const template = {
          set innerHTML(value: string) {
            capturedTemplateHTML = value;
          },
          get innerHTML() {
            return capturedTemplateHTML;
          },
          content: {
            cloneNode: () => ({
              querySelector: (selector: string) => {
                if (selector === "img") {
                  return mockImgElement;
                }
                return null;
              },
            }),
          },
        };
        return template;
      }
      if (tagName === "img") {
        return mockImgElement;
      }
      return {
        setAttribute: () => {},
        getAttribute: () => null,
        appendChild: () => {},
        querySelector: () => null,
        className: "",
        shadowRoot: null,
      };
    },
    body: {
      appendChild: () => {},
      removeChild: () => {},
    },
  } as unknown as Document;

  globalThis.HTMLElement = class HTMLElement {
    shadowRoot: ShadowRoot | null = null;
    className = "";
    attributes: NamedNodeMap = [] as unknown as NamedNodeMap;

    constructor() {
      this.shadowRoot = {
        appendChild: () => {},
        querySelector: (selector: string) => {
          if (selector === "img") {
            return mockImgElement;
          }
          return null;
        },
      } as unknown as ShadowRoot;
    }

    getAttribute(name: string) {
      return elementAttributes[name] || null;
    }

    setAttribute(name: string, value: string) {
      elementAttributes[name] = value;
    }

    attachShadow() {
      return this.shadowRoot!;
    }
  } as unknown as typeof HTMLElement;

  globalThis.customElements = {
    define: vi.fn(),
  } as unknown as CustomElementRegistry;

  // Mock btoa for base64 encoding
  globalThis.btoa = (str: string) => {
    // Use Node.js Buffer if available (test environment)
    const BufferImpl = (globalThis as { Buffer?: typeof Buffer }).Buffer;
    if (BufferImpl) {
      return BufferImpl.from(str, "binary").toString("base64");
    }
    // Fallback: minimal base64 implementation for testing
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let result = "";
    for (let i = 0; i < str.length; i += 3) {
      const a = str.charCodeAt(i);
      const b = str.charCodeAt(i + 1) || 0;
      const c = str.charCodeAt(i + 2) || 0;
      const bitmap = (a << 16) | (b << 8) | c;
      result += chars.charAt((bitmap >> 18) & 63) +
        chars.charAt((bitmap >> 12) & 63) +
        (i + 1 < str.length ? chars.charAt((bitmap >> 6) & 63) : "=") +
        (i + 2 < str.length ? chars.charAt(bitmap & 63) : "=");
    }
    return result;
  };

  // Reset mocks before each test
  vi.clearAllMocks();

  // Mock getFirstSong to return a track file
  vi.mocked(album.getFirstSong).mockResolvedValue("track1.mp3");

  // Mock id3.fromUrl to return image data
  vi.mocked(id3.fromUrl).mockResolvedValue({
    images: [
      {
        data: new Uint8Array([1, 2, 3]),
        mime: "image/jpeg",
      },
    ],
  } as unknown as Awaited<ReturnType<typeof id3.fromUrl>>);
});

describe("AlbumImageCustomElement", () => {
  test("should not show alt text 'Album Art' in template to prevent flash", async () => {
    // Import the module to execute the template creation
    await import("./album-image-custom-element.ts");

    // Check that the template HTML does not contain alt="Album Art"
    expect(capturedTemplateHTML).not.toContain('alt="Album Art"');

    // Check that it should have empty alt instead
    expect(capturedTemplateHTML).toContain('alt=""');
  });

  test("should handle missing data-album-url gracefully", async () => {
    await import("./album-image-custom-element.ts");

    elementAttributes["data-album-url"] = "";

    // Should not throw when creating element with empty URL
    expect(() => {
      document.createElement("album-image-custom-element");
    }).not.toThrow();
  });

  test("should handle invalid URL format gracefully", async () => {
    await import("./album-image-custom-element.ts");

    elementAttributes["data-album-url"] = "invalid-url";

    // Should not throw when creating element with invalid URL
    expect(() => {
      document.createElement("album-image-custom-element");
    }).not.toThrow();
  });

  test("should handle ID3 parsing errors gracefully", async () => {
    await import("./album-image-custom-element.ts");

    // Mock id3.fromUrl to throw an error
    vi.mocked(id3.fromUrl).mockRejectedValueOnce(new Error("Network error"));

    elementAttributes["data-album-url"] =
      "https://bucket.s3.region.amazonaws.com/artist1/album1";

    // Element should be created without throwing
    const element = document.createElement("album-image-custom-element");
    expect(element).toBeDefined();

    // Wait a bit for async operations
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Should not have set src (error occurred)
    expect(imgSrcAttribute).toBe("");
  });

  test("should handle empty contents array", async () => {
    await import("./album-image-custom-element.ts");

    // Mock getFirstSong to return empty array
    vi.mocked(album.getFirstSong).mockResolvedValueOnce("track1.mp3");

    elementAttributes["data-album-url"] =
      "https://bucket.s3.region.amazonaws.com/artist1/album1";

    const element = document.createElement("album-image-custom-element");
    expect(element).toBeDefined();

    // Wait a bit for async operations
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Should not have set src (no contents)
    expect(imgSrcAttribute).toBe("");
  });

  test("should handle no album art found", async () => {
    await import("./album-image-custom-element.ts");

    // Mock id3.fromUrl to return no images
    vi.mocked(id3.fromUrl).mockResolvedValueOnce({
      images: [],
    } as unknown as Awaited<ReturnType<typeof id3.fromUrl>>);

    elementAttributes["data-album-url"] =
      "https://bucket.s3.region.amazonaws.com/artist1/album1";

    const element = document.createElement("album-image-custom-element");
    expect(element).toBeDefined();

    // Wait a bit for async operations
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Should not have set src (no album art)
    expect(imgSrcAttribute).toBe("");
  });

  test("should cache album art requests for the same album URL and not reload when album URL hasn't changed", async () => {
    await import("./album-image-custom-element.ts");

    // Mock id3.fromUrl to track how many times it's called
    const mockId3 = vi.mocked(id3.fromUrl);
    mockId3.mockResolvedValue({
      images: [
        {
          data: new Uint8Array([1, 2, 3]),
          mime: "image/jpeg",
        },
      ],
    } as unknown as Awaited<ReturnType<typeof id3.fromUrl>>);

    // Mock getFirstSong to return the full S3 key path
    vi.mocked(album.getFirstSong).mockResolvedValue(
      "artist1/album1/track1.mp3",
    );

    const albumUrl = "https://bucket.s3.region.amazonaws.com/artist1/album1";

    // Create first element - should trigger one ID3 call
    elementAttributes["data-album-url"] = albumUrl;
    const element1 = document.createElement("album-image-custom-element");
    await new Promise((resolve) => setTimeout(resolve, 50));

    const firstCallCount = mockId3.mock.calls.length;
    expect(firstCallCount).toBeGreaterThan(0);

    // Set the same album URL again - should NOT reload (early return check)
    element1.setAttribute("data-album-url", albumUrl);
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Should still be the same number of calls (no reload for same album)
    expect(mockId3.mock.calls.length).toBe(firstCallCount);

    // Create second element with same album URL - should use cache, no additional ID3 call
    const _element2 = document.createElement("album-image-custom-element");
    elementAttributes["data-album-url"] = albumUrl;
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Should still be the same number of calls (cached)
    expect(mockId3.mock.calls.length).toBe(firstCallCount);
  });
});
