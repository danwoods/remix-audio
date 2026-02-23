/** @file Tests for TrackInfoCustomElement
 *
 * Covers track info display: parses data-track-url via getParentDataFromTrackUrl,
 * renders track name (primary), album/artist (secondary), and album image URL.
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

function setupDOMEnvironment() {
  wireLinkedomToGlobal(linkedomWindow, linkedomDocument, {
    event: true,
    requestAnimationFrame: true,
    getComputedStyle: true,
    fetch: () => Promise.resolve(new Response("", { status: 404 })),
  });
}

function createTrackInfo(attrs: Record<string, string> = {}): HTMLElement {
  return createCustomElement(
    linkedomDocument,
    "track-info-custom-element",
    attrs,
  );
}

function getAlbumImage(el: HTMLElement): HTMLElement | null {
  return el.shadowRoot?.querySelector("album-image-custom-element") ?? null;
}

function getPrimaryScrollingText(el: HTMLElement): HTMLElement | null {
  return el.shadowRoot?.querySelector(
    "scrolling-text-custom-element.primary",
  ) ??
    null;
}

function getSecondaryScrollingText(el: HTMLElement): HTMLElement | null {
  return el.shadowRoot?.querySelector(
    "scrolling-text-custom-element.secondary",
  ) ?? null;
}

// ============================================================================
// TESTS
// ============================================================================

Deno.test(
  "TrackInfoCustomElement - should create element with shadow root",
  async () => {
    setupDOMEnvironment();
    await import("./track-info-custom-element.ts");

    const el = createTrackInfo();

    assertExists(el);
    assertEquals(el.constructor.name, "TrackInfoCustomElement");
    assertExists(el.shadowRoot, "shadow root should exist (open mode)");

    await new Promise((r) => setTimeout(r, 20));
  },
);

Deno.test(
  "TrackInfoCustomElement - should have observedAttributes data-track-url",
  async () => {
    setupDOMEnvironment();
    const { TrackInfoCustomElement } = await import(
      "./track-info-custom-element.ts"
    );

    assertEquals(TrackInfoCustomElement.observedAttributes, [
      "data-track-url",
    ]);
  },
);

Deno.test(
  "TrackInfoCustomElement - should render track name, album/artist, and album URL from data-track-url",
  async () => {
    setupDOMEnvironment();
    await import("./track-info-custom-element.ts");

    const trackUrl =
      "https://bucket.s3.region.amazonaws.com/Artist Name/Album Title/01__Track Name.mp3";

    const el = createTrackInfo({ "data-track-url": trackUrl });

    const albumImage = getAlbumImage(el);
    const primary = getPrimaryScrollingText(el);
    const secondary = getSecondaryScrollingText(el);

    assertExists(albumImage);
    assertEquals(
      albumImage.getAttribute("data-album-url"),
      "https://bucket.s3.region.amazonaws.com/Artist Name/Album Title",
      "album URL should be base path without track filename",
    );

    assertExists(primary);
    assertEquals(
      primary.textContent,
      "Track Name.mp3",
      "primary scrolling text should show track name",
    );

    assertExists(secondary);
    assertEquals(
      secondary.textContent,
      "Album Title, Artist Name",
      "secondary scrolling text should show album, artist",
    );

    await new Promise((r) => setTimeout(r, 20));
  },
);

Deno.test(
  "TrackInfoCustomElement - should not render when data-track-url is empty",
  async () => {
    setupDOMEnvironment();
    await import("./track-info-custom-element.ts");

    const el = createTrackInfo();

    const primary = getPrimaryScrollingText(el);
    const secondary = getSecondaryScrollingText(el);

    assertExists(primary);
    assertEquals(
      primary.textContent ?? "",
      "",
      "primary should be empty when no track URL",
    );

    assertExists(secondary);
    assertEquals(
      secondary.textContent ?? "",
      "",
      "secondary should be empty when no track URL",
    );

    await new Promise((r) => setTimeout(r, 20));
  },
);

Deno.test(
  "TrackInfoCustomElement - should update when data-track-url attribute changes",
  async () => {
    setupDOMEnvironment();
    await import("./track-info-custom-element.ts");

    const el = createTrackInfo({
      "data-track-url":
        "https://bucket.s3.amazonaws.com/ArtistA/AlbumA/01__TrackA.mp3",
    });

    el.setAttribute(
      "data-track-url",
      "https://bucket.s3.amazonaws.com/ArtistB/AlbumB/02__TrackB.mp3",
    );

    const albumImage = getAlbumImage(el);
    const primary = getPrimaryScrollingText(el);
    const secondary = getSecondaryScrollingText(el);

    assertExists(albumImage);
    assertEquals(
      albumImage.getAttribute("data-album-url"),
      "https://bucket.s3.amazonaws.com/ArtistB/AlbumB",
    );

    assertExists(primary);
    assertEquals(primary.textContent, "TrackB.mp3");

    assertExists(secondary);
    assertEquals(secondary.textContent, "AlbumB, ArtistB");

    await new Promise((r) => setTimeout(r, 20));
  },
);

Deno.test(
  "TrackInfoCustomElement - should have root structure with album-image and text-container",
  async () => {
    setupDOMEnvironment();
    await import("./track-info-custom-element.ts");

    const el = createTrackInfo({
      "data-track-url":
        "https://bucket.s3.amazonaws.com/Artist/Album/01__Track.mp3",
    });

    const root = el.shadowRoot?.querySelector(".root");
    const albumImage = el.shadowRoot?.querySelector(".album-image");
    const textContainer = el.shadowRoot?.querySelector(".text-container");

    assertExists(root, "root div should exist");
    assertExists(albumImage, "album-image wrapper should exist");
    assertExists(textContainer, "text-container should exist");

    await new Promise((r) => setTimeout(r, 20));
  },
);
