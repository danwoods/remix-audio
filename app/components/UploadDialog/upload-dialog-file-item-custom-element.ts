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
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      gap: 0.75rem;
      padding: 0.5rem 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      font-size: 0.875rem;
    }
    :host(:last-child) {
      border-bottom: none;
    }
    .upload-dialog-file-item-name {
      flex: 1;
      min-width: 0;
      color: rgba(255, 255, 255, 0.9);
    }
    .upload-dialog-file-item-size {
      color: rgba(255, 255, 255, 0.5);
      flex-shrink: 0;
    }
    .upload-dialog-file-item-remove {
      background: transparent;
      border: none;
      color: inherit;
      cursor: pointer;
      padding: 0.25rem;
      border-radius: 0.25rem;
      transition: background 150ms cubic-bezier(0.4, 0, 0.2, 1);
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
    .upload-dialog-file-item-remove trash-icon {
      width: 1rem;
      height: 1rem;
      display: block;
    }
    .upload-dialog-file-item-id3 {
      flex: 1 1 100%;
      font-size: 0.75rem;
      color: rgba(255, 255, 255, 0.6);
      margin-top: 0.25rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .upload-dialog-file-item-id3 img {
      width: 2.5rem;
      height: 2.5rem;
      object-fit: cover;
      border-radius: 0.25rem;
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
        id3Target.appendChild(document.createTextNode(text || "—"));
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
