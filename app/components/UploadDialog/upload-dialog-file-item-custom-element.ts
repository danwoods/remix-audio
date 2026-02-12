/** @file Custom element for a single file row in the upload dialog.
 *
 * Displays file name, size, a remove button, and loads ID3 metadata (artist,
 * album, title, track, cover art) asynchronously. Dispatches `upload-dialog-remove`
 * when the remove button is clicked.
 */

import "../../icons/trash/index.ts";
import { formatFileSize } from "../../util/format.ts";
import { getID3TagsFromFile } from "../../util/id3.browser.ts";

// TEMPLATE ///////////////////////////////////////////////////////////////////

const template = document.createElement("template");
template.innerHTML = `
  <style>
    :host {
      display: grid;
      grid-template-columns: 1fr auto auto;
      grid-template-rows: auto auto;
      gap: 0.5rem 1rem;
      padding: 0.75rem 1rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      font-size: var(--text-sm, 0.875rem);
    }
    :host(:last-child) {
      border-bottom: none;
    }
    .upload-dialog-file-item-name {
      grid-column: 1;
      grid-row: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: rgba(255, 255, 255, 0.9);
    }
    .upload-dialog-file-item-size {
      grid-column: 2;
      grid-row: 1;
      color: rgba(255, 255, 255, 0.5);
    }
    .upload-dialog-file-item-remove {
      grid-column: 3;
      grid-row: 1;
      align-self: start;
      background: transparent;
      border: none;
      color: inherit;
      cursor: pointer;
      padding: 0.25rem;
      border-radius: 0.25rem;
      transition: background var(--default-transition-duration, 150ms) var(--default-transition-timing-function, cubic-bezier(0.4, 0, 0.2, 1));
    }
    .upload-dialog-file-item-remove:hover {
      background: rgba(255, 255, 255, 0.08);
    }
    .upload-dialog-file-item-remove:focus {
      outline: none;
    }
    .upload-dialog-file-item-remove:focus-visible {
      outline: 2px solid currentColor;
      outline-offset: 2px;
    }
    @media (prefers-reduced-motion: reduce) {
      .upload-dialog-file-item-remove {
        transition: none;
      }
    }
    .upload-dialog-file-item-remove trash-icon {
      width: 1rem;
      height: 1rem;
      display: block;
    }
    .upload-dialog-file-item-id3 {
      grid-column: 1 / -1;
      grid-row: 2;
      min-width: 0;
      font-size: 0.75rem;
      color: rgba(255, 255, 255, 0.6);
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .upload-dialog-file-item-id3-text {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .upload-dialog-file-item-id3 img {
      width: 2.5rem;
      height: 2.5rem;
      object-fit: cover;
      border-radius: 0.25rem;
      flex-shrink: 0;
    }
  </style>
  <span class="upload-dialog-file-item-name" id="name"></span>
  <span class="upload-dialog-file-item-size" id="size"></span>
  <button type="button" class="upload-dialog-file-item-remove" id="remove" aria-label="Remove">
    <trash-icon class="size-4"></trash-icon>
  </button>
  <div class="upload-dialog-file-item-id3" id="id3-target">Loading…</div>
`;

// ELEMENT ////////////////////////////////////////////////////////////////////

/**
 * Custom element for a single file row in the upload dialog file list.
 *
 * Displays file name, size, and loads ID3 metadata. Dispatches `upload-dialog-remove`
 * when the remove button is clicked. Used only by upload-dialog-custom-element.
 *
 * @customElement upload-dialog-file-item
 */
export class UploadDialogFileItemCustomElement extends HTMLElement {
  #file: File | null = null;
  #fileKey = "";

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.shadowRoot!.appendChild(template.content.cloneNode(true));
  }

  connectedCallback() {
    this.setAttribute("role", "listitem");
    const removeBtn = this.shadowRoot!.getElementById("remove");
    if (removeBtn) {
      removeBtn.addEventListener("click", this.#onRemoveClick);
    }
  }

  disconnectedCallback() {
    const removeBtn = this.shadowRoot?.getElementById("remove");
    if (removeBtn) {
      removeBtn.removeEventListener("click", this.#onRemoveClick);
    }
  }

  /**
   * The file to display. When set, updates the UI and starts ID3 loading.
   */
  get file(): File | null {
    return this.#file;
  }

  set file(value: File | null) {
    this.#file = value;
    if (value) {
      this.#fileKey = `${value.name}-${value.size}-${value.lastModified}`;
      this.#render(value);
    }
  }

  /** Stable key for this file (name-size-lastModified). */
  get fileKey(): string {
    return this.#fileKey;
  }

  #onRemoveClick = () => {
    this.dispatchEvent(
      new CustomEvent("upload-dialog-remove", {
        bubbles: true,
        detail: { fileKey: this.#fileKey },
      }),
    );
  };

  #render(file: File) {
    const nameEl = this.shadowRoot!.getElementById("name");
    const sizeEl = this.shadowRoot!.getElementById("size");
    const id3Target = this.shadowRoot!.getElementById("id3-target");
    const removeBtn = this.shadowRoot!.getElementById("remove");

    if (nameEl) nameEl.textContent = file.name;
    if (sizeEl) sizeEl.textContent = formatFileSize(file.size);
    if (removeBtn) removeBtn.setAttribute("aria-label", `Remove ${file.name}`);
    if (id3Target) id3Target.textContent = "Loading…";

    getID3TagsFromFile(file).then((tags) => {
      if (!this.isConnected || !id3Target) return;
      id3Target.replaceChildren();
      if (tags) {
        const parts: string[] = [];
        if (tags.artist) parts.push(tags.artist);
        if (tags.album) parts.push(tags.album);
        if (tags.title) parts.push(tags.title);
        if (tags.trackNumber) parts.push(tags.trackNumber.toString());
        const text = parts.join(" · ");
        if (tags.image) {
          const img = document.createElement("img");
          img.src = tags.image;
          img.alt = "";
          img.setAttribute("aria-hidden", "true");
          id3Target.appendChild(img);
        }
        const textSpan = document.createElement("span");
        textSpan.className = "upload-dialog-file-item-id3-text";
        textSpan.textContent = text || "—";
        id3Target.appendChild(textSpan);
      } else {
        id3Target.textContent = "No metadata";
      }
    });
  }
}

customElements.define(
  "upload-dialog-file-item",
  UploadDialogFileItemCustomElement,
);
