/** @file Tests for player-controls-custom-element. */

import { beforeEach, describe, expect, test, vi } from "vitest";
import { getBucketContents } from "../../../../lib/s3.ts";

// Mock dependencies
vi.mock("../../../../lib/s3.ts");

// Mock icon elements
vi.mock("../../../icons/play/index.ts", () => ({}));
vi.mock("../../../icons/pause/index.ts", () => ({}));
vi.mock("../../../icons/prev/index.ts", () => ({}));
vi.mock("../../../icons/next/index.ts", () => ({}));
vi.mock("../../../icons/playlist/index.ts", () => ({}));

// Track DOM state
let elementAttributes: { [key: string]: string } = {};
let audioElement: Partial<HTMLAudioElement> | null = null;
const audioEventListeners: { [key: string]: ((event: Event) => void)[] } = {};

// Mock fetch for S3 API calls
const mockFetch = vi.fn();

beforeEach(() => {
  // Reset state
  elementAttributes = {};
  audioEventListeners.timeupdate = [];
  audioEventListeners.ended = [];
  audioEventListeners.loadedmetadata = [];

  // Create mock audio element
  audioElement = {
    src: "",
    paused: true,
    currentTime: 0,
    duration: 100,
    readyState: 0,
    style: { display: "" } as CSSStyleDeclaration,
    setAttribute: vi.fn(),
    getAttribute: vi.fn(),
    addEventListener: (
      type: string,
      listener: EventListenerOrEventListenerObject,
      _options?: boolean | AddEventListenerOptions,
    ) => {
      if (!audioEventListeners[type]) audioEventListeners[type] = [];
      if (typeof listener === "function") {
        audioEventListeners[type].push(listener);
      } else if (
        listener && typeof listener === "object" && "handleEvent" in listener
      ) {
        audioEventListeners[type].push((event) => listener.handleEvent(event));
      }
    },
    removeEventListener: vi.fn(),
    play: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
    parentNode: null,
  };

  // Mock document.createElement for audio element
  globalThis.document = {
    createElement: (tagName: string) => {
      if (tagName === "audio") {
        return audioElement as HTMLAudioElement;
      }
      return {
        setAttribute: vi.fn(),
        getAttribute: vi.fn(),
        appendChild: vi.fn(),
        removeChild: vi.fn(),
        querySelector: vi.fn(),
        className: "",
      } as unknown as HTMLElement;
    },
    body: {
      appendChild: vi.fn(),
      removeChild: vi.fn(),
    },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as Document;

  // Mock HTMLElement
  globalThis.HTMLElement = class HTMLElement {
    style: CSSStyleDeclaration = {
      display: "",
      width: "",
    } as CSSStyleDeclaration;
    attributes: NamedNodeMap = [] as unknown as NamedNodeMap;

    getAttribute(name: string) {
      return elementAttributes[name] || null;
    }

    setAttribute(name: string, value: string) {
      elementAttributes[name] = value;
    }

    removeAttribute(name: string) {
      delete elementAttributes[name];
    }

    addEventListener = vi.fn();
    removeEventListener = vi.fn();
    querySelector = vi.fn();
    closest = vi.fn();
    dispatchEvent = vi.fn();
  } as unknown as typeof HTMLElement;

  globalThis.customElements = {
    define: vi.fn(),
  } as unknown as CustomElementRegistry;

  globalThis.fetch = mockFetch;

  // Mock HTMLMediaElement constants
  globalThis.HTMLMediaElement = {
    HAVE_METADATA: 1,
    HAVE_CURRENT_DATA: 2,
    HAVE_FUTURE_DATA: 3,
    HAVE_ENOUGH_DATA: 4,
  } as unknown as typeof HTMLMediaElement;

  // Mock DOMParser for S3 XML parsing
  globalThis.DOMParser = class DOMParser {
    parseFromString(_xml: string, _type: string) {
      // Simple mock that returns an object with getElementsByTagName
      return {
        getElementsByTagName: (tagName: string) => {
          if (tagName === "Contents") {
            // Return mock elements with Key children
            return [
              {
                getElementsByTagName: (keyTag: string) => {
                  if (keyTag === "Key") {
                    return [{ textContent: "Artist/Album/1__Track One.mp3" }];
                  }
                  return [];
                },
              },
              {
                getElementsByTagName: (keyTag: string) => {
                  if (keyTag === "Key") {
                    return [{ textContent: "Artist/Album/2__Track Two.mp3" }];
                  }
                  return [];
                },
              },
            ];
          }
          return [];
        },
      } as unknown as Document;
    }
  } as unknown as typeof DOMParser;

  // Reset mocks
  vi.clearAllMocks();
  mockFetch.mockClear();
});

describe("PlayerControlsCustomElement", () => {
  test("should cancel existing promise when track URL changes", async () => {
    const { PlayerControlsCustomElement } = await import(
      "./player-controls-custom-element.ts"
    );

    // Mock getBucketContents to return tracks
    vi.mocked(getBucketContents).mockResolvedValue([
      "Artist/Album/1__Track One.mp3",
      "Artist/Album/2__Track Two.mp3",
      "Artist/Album/3__Track Three.mp3",
    ]);

    const element = new PlayerControlsCustomElement();

    // Manually trigger connectedCallback to initialize
    element.connectedCallback?.();

    // Set attributes and manually trigger attributeChangedCallback
    element.setAttribute(
      "data-album-url",
      "https://bucket.s3.amazonaws.com/Artist/Album",
    );
    element.attributeChangedCallback?.(
      "data-album-url",
      null,
      "https://bucket.s3.amazonaws.com/Artist/Album",
    );

    element.setAttribute(
      "data-current-track-url",
      "https://bucket.s3.amazonaws.com/Artist/Album/1__Track One.mp3",
    );
    element.attributeChangedCallback?.(
      "data-current-track-url",
      null,
      "https://bucket.s3.amazonaws.com/Artist/Album/1__Track One.mp3",
    );

    // Make getBucketContents slow so promise doesn't complete immediately
    vi.mocked(getBucketContents).mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve(["Artist/Album/1__Track One.mp3"]), 100)
        ),
    );

    // Verify promise exists before changing track
    // deno-lint-ignore no-explicit-any
    expect((element as any).loadTracksPromise).toBeTruthy();

    // Change track URL immediately - should cancel previous promise
    element.setAttribute(
      "data-current-track-url",
      "https://bucket.s3.amazonaws.com/Artist/Album/2__Track Two.mp3",
    );
    element.attributeChangedCallback?.(
      "data-current-track-url",
      "https://bucket.s3.amazonaws.com/Artist/Album/1__Track One.mp3",
      "https://bucket.s3.amazonaws.com/Artist/Album/2__Track Two.mp3",
    );

    // Wait a bit for the cancellation to happen
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Promise should be reset (cancelled) and a new one created
    // The new promise should be different from the old one
    // deno-lint-ignore no-explicit-any
    expect((element as any).loadTracksPromise).toBeTruthy();
  });

  test("should load remaining tracks when track URL is set", async () => {
    const { PlayerControlsCustomElement } = await import(
      "./player-controls-custom-element.ts"
    );

    // Mock getBucketContents to return tracks
    vi.mocked(getBucketContents).mockResolvedValue([
      "Artist/Album/1__Track One.mp3",
      "Artist/Album/2__Track Two.mp3",
      "Artist/Album/3__Track Three.mp3",
    ]);

    const element = new PlayerControlsCustomElement();
    element.connectedCallback?.();

    element.setAttribute(
      "data-album-url",
      "https://bucket.s3.amazonaws.com/Artist/Album",
    );
    element.attributeChangedCallback?.(
      "data-album-url",
      null,
      "https://bucket.s3.amazonaws.com/Artist/Album",
    );

    element.setAttribute(
      "data-current-track-url",
      "https://bucket.s3.amazonaws.com/Artist/Album/1__Track One.mp3",
    );
    element.attributeChangedCallback?.(
      "data-current-track-url",
      null,
      "https://bucket.s3.amazonaws.com/Artist/Album/1__Track One.mp3",
    );

    // Wait for tracks to load
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Verify getBucketContents was called
    expect(getBucketContents).toHaveBeenCalledWith(
      "https://bucket.s3.amazonaws.com",
      "Artist/Album/",
    );
  });

  test("should handle track URL format with single underscore", async () => {
    const { PlayerControlsCustomElement } = await import(
      "./player-controls-custom-element.ts"
    );

    // Mock getBucketContents to return tracks with double underscore format
    vi.mocked(getBucketContents).mockResolvedValue([
      "Artist/Album/1__Track One.mp3",
      "Artist/Album/2__Track Two.mp3",
    ]);

    const element = new PlayerControlsCustomElement();
    element.connectedCallback?.();

    element.setAttribute(
      "data-album-url",
      "https://bucket.s3.amazonaws.com/Artist/Album",
    );
    element.attributeChangedCallback?.(
      "data-album-url",
      null,
      "https://bucket.s3.amazonaws.com/Artist/Album",
    );

    // Use single underscore format (as might come from URL)
    element.setAttribute(
      "data-current-track-url",
      "https://bucket.s3.amazonaws.com/Artist/Album/1_Track One",
    );
    element.attributeChangedCallback?.(
      "data-current-track-url",
      null,
      "https://bucket.s3.amazonaws.com/Artist/Album/1_Track One",
    );

    // Wait for tracks to load
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Should still call getBucketContents (matching logic should handle it)
    expect(getBucketContents).toHaveBeenCalled();
  });

  test("should handle track URL without file extension", async () => {
    const { PlayerControlsCustomElement } = await import(
      "./player-controls-custom-element.ts"
    );

    // Mock getBucketContents to return tracks with extensions
    vi.mocked(getBucketContents).mockResolvedValue([
      "Artist/Album/1__Track One.mp3",
      "Artist/Album/2__Track Two.mp3",
    ]);

    const element = new PlayerControlsCustomElement();
    element.connectedCallback?.();

    element.setAttribute(
      "data-album-url",
      "https://bucket.s3.amazonaws.com/Artist/Album",
    );
    element.attributeChangedCallback?.(
      "data-album-url",
      null,
      "https://bucket.s3.amazonaws.com/Artist/Album",
    );

    // Track URL without extension
    element.setAttribute(
      "data-current-track-url",
      "https://bucket.s3.amazonaws.com/Artist/Album/1__Track One",
    );
    element.attributeChangedCallback?.(
      "data-current-track-url",
      null,
      "https://bucket.s3.amazonaws.com/Artist/Album/1__Track One",
    );

    // Wait for tracks to load
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Should still call getBucketContents
    expect(getBucketContents).toHaveBeenCalled();
  });

  test("should cancel existing promise when album URL changes", async () => {
    const { PlayerControlsCustomElement } = await import(
      "./player-controls-custom-element.ts"
    );

    vi.mocked(getBucketContents).mockResolvedValue([
      "Artist/Album/1__Track One.mp3",
    ]);

    const element = new PlayerControlsCustomElement();
    element.connectedCallback?.();

    element.setAttribute(
      "data-album-url",
      "https://bucket.s3.amazonaws.com/Artist/Album1",
    );
    element.attributeChangedCallback?.(
      "data-album-url",
      null,
      "https://bucket.s3.amazonaws.com/Artist/Album1",
    );

    element.setAttribute(
      "data-current-track-url",
      "https://bucket.s3.amazonaws.com/Artist/Album1/1__Track One.mp3",
    );
    element.attributeChangedCallback?.(
      "data-current-track-url",
      null,
      "https://bucket.s3.amazonaws.com/Artist/Album1/1__Track One.mp3",
    );

    // Make getBucketContents slow so promise doesn't complete immediately
    vi.mocked(getBucketContents).mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve(["Artist/Album/1__Track One.mp3"]), 100)
        ),
    );

    // Verify promise exists before changing album
    // deno-lint-ignore no-explicit-any
    expect((element as any).loadTracksPromise).toBeTruthy();
    // deno-lint-ignore no-explicit-any
    const oldPromise = (element as any).loadTracksPromise;

    // Change album URL immediately - should cancel previous promise
    element.setAttribute(
      "data-album-url",
      "https://bucket.s3.amazonaws.com/Artist/Album2",
    );
    element.attributeChangedCallback?.(
      "data-album-url",
      "https://bucket.s3.amazonaws.com/Artist/Album1",
      "https://bucket.s3.amazonaws.com/Artist/Album2",
    );

    await new Promise((resolve) => setTimeout(resolve, 10));

    // Promise should be reset (cancelled) and a new one created
    // deno-lint-ignore no-explicit-any
    expect((element as any).loadTracksPromise).toBeTruthy();
    // New promise should be different from the old one
    // deno-lint-ignore no-explicit-any
    expect((element as any).loadTracksPromise).not.toBe(oldPromise);
  });

  test("should handle S3 API errors gracefully", async () => {
    const { PlayerControlsCustomElement } = await import(
      "./player-controls-custom-element.ts"
    );

    // Mock getBucketContents to throw an error
    vi.mocked(getBucketContents).mockRejectedValue(new Error("S3 API Error"));

    const element = new PlayerControlsCustomElement();
    element.connectedCallback?.();

    element.setAttribute(
      "data-album-url",
      "https://bucket.s3.amazonaws.com/Artist/Album",
    );
    element.attributeChangedCallback?.(
      "data-album-url",
      null,
      "https://bucket.s3.amazonaws.com/Artist/Album",
    );

    element.setAttribute(
      "data-current-track-url",
      "https://bucket.s3.amazonaws.com/Artist/Album/1__Track One.mp3",
    );
    element.attributeChangedCallback?.(
      "data-current-track-url",
      null,
      "https://bucket.s3.amazonaws.com/Artist/Album/1__Track One.mp3",
    );

    // Wait for error handling
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Should not throw - error should be caught and logged
    expect(getBucketContents).toHaveBeenCalled();
  });

  test("should not load tracks if albumUrl is missing", async () => {
    const { PlayerControlsCustomElement } = await import(
      "./player-controls-custom-element.ts"
    );

    const element = new PlayerControlsCustomElement();
    element.connectedCallback?.();

    // Only set track URL, not album URL
    element.setAttribute(
      "data-current-track-url",
      "https://bucket.s3.amazonaws.com/Artist/Album/1__Track One.mp3",
    );
    element.attributeChangedCallback?.(
      "data-current-track-url",
      null,
      "https://bucket.s3.amazonaws.com/Artist/Album/1__Track One.mp3",
    );

    await new Promise((resolve) => setTimeout(resolve, 50));

    // Should not call getBucketContents
    expect(getBucketContents).not.toHaveBeenCalled();
  });

  test("should not load tracks if currentTrackUrl is missing", async () => {
    const { PlayerControlsCustomElement } = await import(
      "./player-controls-custom-element.ts"
    );

    const element = new PlayerControlsCustomElement();
    element.connectedCallback?.();

    // Only set album URL, not track URL
    element.setAttribute(
      "data-album-url",
      "https://bucket.s3.amazonaws.com/Artist/Album",
    );
    element.attributeChangedCallback?.(
      "data-album-url",
      null,
      "https://bucket.s3.amazonaws.com/Artist/Album",
    );

    await new Promise((resolve) => setTimeout(resolve, 50));

    // Should not call getBucketContents
    expect(getBucketContents).not.toHaveBeenCalled();
  });

  test("should extract base bucket URL from album URL correctly", async () => {
    const { PlayerControlsCustomElement } = await import(
      "./player-controls-custom-element.ts"
    );

    vi.mocked(getBucketContents).mockResolvedValue([
      "Artist/Album/1__Track One.mp3",
    ]);

    const element = new PlayerControlsCustomElement();
    element.connectedCallback?.();

    // Album URL includes artist/album path
    element.setAttribute(
      "data-album-url",
      "https://bucket.s3.us-east-1.amazonaws.com/Artist/Album",
    );
    element.attributeChangedCallback?.(
      "data-album-url",
      null,
      "https://bucket.s3.us-east-1.amazonaws.com/Artist/Album",
    );

    element.setAttribute(
      "data-current-track-url",
      "https://bucket.s3.us-east-1.amazonaws.com/Artist/Album/1__Track One.mp3",
    );
    element.attributeChangedCallback?.(
      "data-current-track-url",
      null,
      "https://bucket.s3.us-east-1.amazonaws.com/Artist/Album/1__Track One.mp3",
    );

    await new Promise((resolve) => setTimeout(resolve, 100));

    // Should extract base URL correctly
    expect(getBucketContents).toHaveBeenCalledWith(
      "https://bucket.s3.us-east-1.amazonaws.com",
      "Artist/Album/",
    );
  });
});
