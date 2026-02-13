/** @file Tests for UploadDialogFileItemCustomElement
 *
 * Covers file display (name, size), ID3 metadata loading, editable fields,
 * remove button, and upload-dialog-remove event dispatch.
 *
 * Uses linkedom for a real DOM environment; wires document/window to globalThis
 * so the component can run in Deno.
 */

import { assertEquals, assertExists } from "@std/assert";
import { parseHTML } from "linkedom";

// ============================================================================
// LINKEDOM SETUP (created once, reused across tests)
// ============================================================================

const LINKEDOM_HTML = `<!DOCTYPE html>
<html>
<head></head>
<body></body>
</html>`;

const { document: linkedomDocument, window: linkedomWindow } = parseHTML(
  LINKEDOM_HTML,
  "http://localhost:8000/",
);

// ============================================================================
// DOM SETUP (must run before importing the element module)
// ============================================================================

function setupDOMEnvironment() {
  const body = linkedomDocument.body;
  if (body) {
    while (body.firstChild) body.removeChild(body.firstChild);
  }

  (globalThis as { document: Document }).document = linkedomDocument;
  (globalThis as { window: Window }).window =
    linkedomWindow as unknown as Window;
  (globalThis as { customElements: CustomElementRegistry }).customElements =
    linkedomWindow.customElements;
  (globalThis as { HTMLElement: typeof HTMLElement }).HTMLElement =
    linkedomWindow.HTMLElement;
  (globalThis as { CustomEvent: typeof CustomEvent }).CustomEvent =
    linkedomWindow.CustomEvent;
  (globalThis as { setTimeout: typeof setTimeout }).setTimeout = linkedomWindow
    .setTimeout.bind(linkedomWindow);
  (globalThis as { clearTimeout: typeof clearTimeout }).clearTimeout =
    linkedomWindow.clearTimeout.bind(linkedomWindow);
}

// ============================================================================
// TEST HELPERS
// ============================================================================

/** Creates a minimal File for testing (id3js returns null for non-MP3, so we get "Unknown" metadata). */
function createTestFile(
  name: string,
  size: number,
  lastModified?: number,
): File {
  const blob = new Blob([new Uint8Array(size)], {
    type: "application/octet-stream",
  });
  return new File([blob], name, {
    lastModified: lastModified ?? Date.now(),
  });
}

/** Creates an upload-dialog-file-item in the DOM and sets its file property.
 * Appends first so connectedCallback runs, then sets file so ID3 resolution sees isConnected. */
function createFileItem(file: File): HTMLElement & { file: File | null } {
  const body = linkedomDocument.body;
  if (!body) throw new Error("body not found");
  const el = linkedomDocument.createElement(
    "upload-dialog-file-item",
  ) as HTMLElement & { file: File | null };
  body.appendChild(el);
  el.file = file;
  return el;
}

function getById<T extends Element>(el: Element, id: string): T | null {
  return el.shadowRoot?.getElementById(id) as T | null ?? null;
}

// ============================================================================
// TESTS
// ============================================================================

Deno.test(
  "UploadDialogFileItemCustomElement - should create element with shadow root",
  async () => {
    setupDOMEnvironment();
    await import("./upload-dialog-file-item-custom-element.ts");

    const file = createTestFile("test.mp3", 1024);
    const el = createFileItem(file);

    assertExists(el);
    assertEquals(el.constructor.name, "UploadDialogFileItemCustomElement");
    assertExists(el.shadowRoot, "shadow root should exist (open mode)");
  },
);

Deno.test(
  "UploadDialogFileItemCustomElement - should set role=listitem on connect",
  async () => {
    setupDOMEnvironment();
    await import("./upload-dialog-file-item-custom-element.ts");

    const file = createTestFile("test.mp3", 1024);
    const el = createFileItem(file);

    assertEquals(
      el.getAttribute("role"),
      "listitem",
      "host should have role listitem when connected",
    );
  },
);

Deno.test(
  "UploadDialogFileItemCustomElement - should display file name and size",
  async () => {
    setupDOMEnvironment();
    await import("./upload-dialog-file-item-custom-element.ts");

    const file = createTestFile("My Song.mp3", 1536);
    const el = createFileItem(file);

    const nameEl = getById<HTMLSpanElement>(el, "name");
    const sizeEl = getById<HTMLSpanElement>(el, "size");

    assertExists(nameEl);
    assertEquals(nameEl.textContent, "My Song.mp3");
    assertExists(sizeEl);
    assertEquals(sizeEl.textContent, "1.5 KB");
  },
);

Deno.test(
  "UploadDialogFileItemCustomElement - remove button click dispatches upload-dialog-remove with fileKey",
  async () => {
    setupDOMEnvironment();
    await import("./upload-dialog-file-item-custom-element.ts");

    const file = createTestFile("track.mp3", 512);
    const el = createFileItem(file);
    const fileKey = el.fileKey;

    const removeBtn = getById<HTMLButtonElement>(el, "remove");
    assertExists(removeBtn);

    const events: CustomEvent[] = [];
    el.addEventListener("upload-dialog-remove", (e) => {
      events.push(e as CustomEvent);
    });

    removeBtn.click();

    assertEquals(events.length, 1);
    assertEquals(events[0].bubbles, true);
    assertEquals(events[0].detail?.fileKey, fileKey);
  },
);

Deno.test(
  "UploadDialogFileItemCustomElement - remove button aria-label includes file name",
  async () => {
    setupDOMEnvironment();
    await import("./upload-dialog-file-item-custom-element.ts");

    const file = createTestFile("Cool Track.mp3", 256);
    const el = createFileItem(file);

    const removeBtn = getById<HTMLButtonElement>(el, "remove");
    assertExists(removeBtn);
    assertEquals(
      removeBtn.getAttribute("aria-label"),
      "Remove Cool Track.mp3",
    );
  },
);

Deno.test(
  "UploadDialogFileItemCustomElement - metadataReady resolves after ID3 load",
  async () => {
    setupDOMEnvironment();
    await import("./upload-dialog-file-item-custom-element.ts");

    const file = createTestFile("test.mp3", 100);
    const el = createFileItem(file) as HTMLElement & {
      file: File | null;
      metadataReady: Promise<void>;
    };

    await el.metadataReady;
    // No timeout needed; metadataReady resolved
  },
);

Deno.test(
  "UploadDialogFileItemCustomElement - metadata returns Unknown when ID3 parse fails",
  async () => {
    setupDOMEnvironment();
    await import("./upload-dialog-file-item-custom-element.ts");

    const file = createTestFile("non-mp3.bin", 50);
    const el = createFileItem(file) as HTMLElement & {
      metadata: {
        artist: string;
        album: string;
        title: string;
        trackNumber: number;
      };
      metadataReady: Promise<void>;
    };

    await el.metadataReady;

    const meta = el.metadata;
    assertEquals(meta.artist, "Unknown");
    assertEquals(meta.album, "Unknown");
    assertEquals(meta.title, "Unknown");
    assertEquals(meta.trackNumber, 1);
  },
);

Deno.test(
  "UploadDialogFileItemCustomElement - disconnectedCallback does not throw",
  async () => {
    setupDOMEnvironment();
    await import("./upload-dialog-file-item-custom-element.ts");

    const file = createTestFile("test.mp3", 100);
    const el = createFileItem(file);

    linkedomDocument.body?.removeChild(el);
    // disconnectedCallback runs; no throw
  },
);

Deno.test(
  "UploadDialogFileItemCustomElement - fileKey is name-size-lastModified",
  async () => {
    setupDOMEnvironment();
    await import("./upload-dialog-file-item-custom-element.ts");

    const file = createTestFile("song.mp3", 2048, 12345);
    const el = createFileItem(file) as HTMLElement & { fileKey: string };

    assertEquals(
      el.fileKey,
      "song.mp3-2048-12345",
      "fileKey should be name-size-lastModified",
    );
  },
);

Deno.test(
  "UploadDialogFileItemCustomElement - ID3 section shows Artist Album Title Track inputs after load",
  async () => {
    setupDOMEnvironment();
    await import("./upload-dialog-file-item-custom-element.ts");

    const file = createTestFile("test.mp3", 100);
    const el = createFileItem(file);

    await (el as HTMLElement & { metadataReady: Promise<void> }).metadataReady;

    const id3Target = getById<HTMLDivElement>(el, "id3-target");
    assertExists(id3Target);

    const artistInput = id3Target.querySelector("#artist-input") as
      | HTMLInputElement
      | null;
    const albumInput = id3Target.querySelector("#album-input") as
      | HTMLInputElement
      | null;
    const titleInput = id3Target.querySelector("#title-input") as
      | HTMLInputElement
      | null;
    const trackInput = id3Target.querySelector("#track-number-input") as
      | HTMLInputElement
      | null;

    assertExists(artistInput, "Artist input should exist");
    assertExists(albumInput, "Album input should exist");
    assertExists(titleInput, "Title input should exist");
    assertExists(trackInput, "Track input should exist");

    assertEquals(artistInput.value, "Unknown");
    assertEquals(albumInput.value, "Unknown");
    assertEquals(titleInput.value, "Unknown");
    assertEquals(trackInput.value, "1");
  },
);
