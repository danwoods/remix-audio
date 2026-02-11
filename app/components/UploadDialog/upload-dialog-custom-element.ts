/** @file Custom element for the upload dialog.
 *
 * Renders a trigger button that opens a modal for file uploads. Uses the native
 * <dialog> API (showModal() / close()) for focus trapping, Escape handling, and
 * ::backdrop. The dialog is appended to the element's shadow root so IDs stay
 * scoped. Before submit, a file list shows selected file names and sizes; each
 * row can be removed. ID3 metadata (artist, album, title, track number, cover
 * art) is shown per file when available. Uses heroicons-style SVGs for plus,
 * close, and remove.
 */

import { getID3TagsFromFile } from "../../util/id3.browser.ts";

// TEMPLATE ///////////////////////////////////////////////////////////////////

const template = document.createElement("template");

/** Plus circle icon (heroicons 24 solid). */
const plusCircleSvg =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM12.75 9a.75.75 0 0 0-1.5 0v2.25H9a.75.75 0 0 0 0 1.5h2.25V15a.75.75 0 0 0 1.5 0v-2.25H15a.75.75 0 0 0 0-1.5h-2.25V9Z" clip-rule="evenodd" /></svg>`;

template.innerHTML = `
  <style>
    :host {
      display: inline-flex;
    }
    button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
      background: transparent;
      border: none;
      cursor: pointer;
      padding: 0;
      color: inherit;
    }
    button:focus {
      outline: none;
    }
    #trigger svg {
      width: 1.5rem;
      height: 1.5rem;
    }
  </style>
  <button type="button" aria-label="add files" id="trigger">
    ${plusCircleSvg}
  </button>
`;

// ELEMENT ////////////////////////////////////////////////////////////////////

/**
 * Custom element for the upload dialog.
 *
 * Provides a trigger button that opens a modal for selecting and uploading files.
 * The modal is rendered into the element's shadow root (IDs stay scoped).
 * Before submit, selected files are listed with name and size; users can remove
 * individual files. ID3 metadata (artist, album, title, track number, cover art)
 * is loaded per file and shown when available. Submit sends the current list.
 * Supports optional trigger styling via the `class` and `buttonStyle` attributes.
 *
 * @customElement upload-dialog-custom-element
 *
 * @example
 * ```html
 * <upload-dialog-custom-element></upload-dialog-custom-element>
 * ```
 */
export class UploadDialogCustomElement extends HTMLElement {
  static observedAttributes = ["class", "buttonStyle"];

  #showUploadUI = false;
  #isSubmitting = false;
  /** Selected files drive the list and submit; single source of truth. */
  #selectedFiles: File[] = [];
  #dialog: HTMLDialogElement | null = null;

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.shadowRoot!.appendChild(template.content.cloneNode(true));
  }

  connectedCallback() {
    const trigger = this.shadowRoot!.getElementById("trigger");
    if (trigger) {
      trigger.addEventListener("click", this.#onTriggerClick);
    }

    if (this.hasAttribute("buttonStyle")) {
      const buttonStyle = this.getAttribute("buttonStyle");
      if (buttonStyle) {
        trigger!.style.cssText = buttonStyle;
      }
    }
  }

  disconnectedCallback() {
    const trigger = this.shadowRoot?.getElementById("trigger");
    if (trigger) {
      trigger.removeEventListener("click", this.#onTriggerClick);
    }
    this.#close();
  }

  attributeChangedCallback(
    name: string,
    _oldValue: string,
    _newValue: string,
  ) {
    if (name === "buttonStyle") {
      const trigger = this.shadowRoot?.getElementById("trigger");
      if (trigger) {
        const buttonStyle = this.getAttribute("buttonStyle");
        trigger.style.cssText = buttonStyle ?? "";
      }
    }
  }

  #onTriggerClick = () => {
    this.#showUploadUI = true;
    this.#selectedFiles = [];
    this.#isSubmitting = false;
    this.#renderDialog();
  };

  /** Hide modal and cleanup. Called from dialog 'close' event (Escape, close button, backdrop). */
  #close() {
    this.#showUploadUI = false;
    this.#selectedFiles = [];
    this.#isSubmitting = false;
    if (this.#dialog?.parentNode) {
      this.#dialog.parentNode.removeChild(this.#dialog);
    }
    this.#dialog = null;
  }

  #renderDialog() {
    if (!this.#showUploadUI || this.#dialog) return;

    const dialog = document.createElement("dialog");
    this.#dialog = dialog;

    /** X mark icon (heroicons 24 solid). */
    const xMarkSvg =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd" /></svg>`;
    /** Trash icon (heroicons 24 solid). */
    const trashSvg =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M16.5 4.478v.227a48.816 48.816 0 0 1 3.878.512.75.75 0 1 1-.256 1.478l-.209-.035-1.005 13.07a3 3 0 0 1-2.991 2.77H8.084a3 3 0 0 1-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 0 1-.256-1.478A48.567 48.567 0 0 1 7.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 0 1 3.369 0c1.603.051 2.815 1.387 2.815 2.951Zm-6.136-1.452a51.196 51.196 0 0 1 3.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 0 0-6 0v-.113c0-.794.609-1.428 1.364-1.452Zm-.355 5.945a.75.75 0 1 0-1.5.058l.347 9a.75.75 0 1 0 1.499-.058l-.346-9Zm5.48.058a.75.75 0 1 0-1.498-.058l-.347 9a.75.75 0 0 0 1.5.058l.345-9Z" clip-rule="evenodd" /></svg>`;

    dialog.innerHTML = `
      <style>
        dialog {
          margin: 0 auto;
          max-width: min(32rem, 90vw);
          width: 100%;
          position: relative;
          font-family: inherit;
          color: #fff;
          background: transparent;
          border: none;
          padding: 0;
        }
        dialog::backdrop {
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(4px);
        }
        .upload-dialog-box {
          background: #121212;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 0.5rem;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 1.25rem 1.5rem;
          overflow: hidden;
        }
        .upload-dialog-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        }
        .upload-dialog-title {
          font-size: 1.125rem;
          font-weight: 400;
          margin: 0;
        }
        .upload-dialog-close-btn {
          background: transparent;
          border: none;
          color: inherit;
          cursor: pointer;
          padding: 0.5rem;
          border-radius: 0.25rem;
          transition: background 150ms cubic-bezier(0.4, 0, 0.2, 1);
        }
        .upload-dialog-close-btn:hover {
          background: rgba(255, 255, 255, 0.08);
        }
        .upload-dialog-close-btn:focus {
          outline: none;
        }
        .upload-dialog-close-btn:focus-visible {
          outline: 2px solid currentColor;
          outline-offset: 2px;
        }
        .upload-dialog-close-btn svg {
          width: 1rem;
          height: 1rem;
        }
        .upload-dialog-body {
          padding: 0;
        }
        .upload-dialog-drop-zone {
          position: relative;
          display: block;
          padding: 1.25rem;
          background: rgba(255, 255, 255, 0.05);
          border: 2px dashed rgba(255, 255, 255, 0.2);
          border-radius: 0.5rem;
          text-align: center;
          cursor: pointer;
          transition: border-color 150ms cubic-bezier(0.4, 0, 0.2, 1),
            background 150ms cubic-bezier(0.4, 0, 0.2, 1);
        }
        .upload-dialog-drop-zone:hover {
          border-color: rgba(255, 255, 255, 0.35);
          background: rgba(255, 255, 255, 0.08);
        }
        .upload-dialog-file-input {
          position: absolute;
          inset: 0;
          opacity: 0;
          width: 100%;
          height: 100%;
          cursor: pointer;
        }
        .upload-dialog-file-label {
          display: block;
          font-size: 0.875rem;
          color: rgba(255, 255, 255, 0.7);
          margin-top: 0.25rem;
        }
        .upload-dialog-footer {
          margin-top: 1.5rem;
          display: flex;
          justify-content: flex-end;
        }
        .upload-dialog-submit {
          padding: 0.5rem 1.25rem;
          background: var(--color-blue-500, #3b82f6);
          color: #fff;
          border: none;
          border-radius: 0.5rem;
          cursor: pointer;
          font-family: inherit;
          font-size: 1rem;
          transition: background 150ms cubic-bezier(0.4, 0, 0.2, 1),
            transform 150ms cubic-bezier(0.4, 0, 0.2, 1);
        }
        .upload-dialog-submit:hover:not(:disabled) {
          background: oklch(67% 0.214 259.815);
        }
        .upload-dialog-submit:active:not(:disabled) {
          transform: scale(0.98);
        }
        .upload-dialog-submit:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .upload-dialog-submit:focus {
          outline: none;
        }
        .upload-dialog-submit:focus-visible {
          outline: 2px solid currentColor;
          outline-offset: 2px;
        }
        @keyframes upload-dialog-spin {
          to { transform: rotate(360deg); }
        }
        .upload-dialog-loading {
          display: inline-block;
          width: 1rem;
          height: 1rem;
          border: 2px solid currentColor;
          border-right-color: transparent;
          border-radius: 50%;
          animation: upload-dialog-spin 0.6s linear infinite;
          vertical-align: middle;
        }
        .upload-dialog-file-list {
          list-style: none;
          margin: 1rem 0 0;
          padding: 0;
          max-height: 12rem;
          overflow-y: auto;
        }
        .upload-dialog-file-item {
          display: flex;
          flex-wrap: wrap;
          align-items: flex-start;
          gap: 0.75rem;
          padding: 0.5rem 0;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          font-size: 0.875rem;
        }
        .upload-dialog-file-item:last-child {
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
        .upload-dialog-file-item-remove svg {
          width: 1rem;
          height: 1rem;
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
      <form method="post" enctype="multipart/form-data" id="upload-form">
        <div class="upload-dialog-box">
          <div class="upload-dialog-header">
            <h2 class="upload-dialog-title" id="upload-dialog-title">Upload files</h2>
            <button class="upload-dialog-close-btn" type="button" id="close-btn" aria-label="close">${xMarkSvg}</button>
          </div>
          <div class="upload-dialog-body">
            <div class="upload-dialog-drop-zone">
              <input
                id="files"
                type="file"
                name="files"
                multiple
                accept="audio/*"
                class="upload-dialog-file-input"
              />
              <span aria-hidden="true">Choose files</span>
              <span class="upload-dialog-file-label" id="file-label">No files selected</span>
            </div>
            <ul id="file-list" class="upload-dialog-file-list" aria-label="Selected files"></ul>
          </div>
          <div class="upload-dialog-footer">
            <button
              type="submit"
              id="submit-btn"
              class="upload-dialog-submit"
            >
            ${
      this.#isSubmitting
        ? '<span class="upload-dialog-loading" aria-hidden="true"></span>'
        : "Upload"
    }
            </button>
          </div>
        </div>
      </form>
    `;

    this.shadowRoot!.appendChild(dialog);
    dialog.showModal();

    dialog.addEventListener("close", () => {
      this.#close();
    });

    const form = dialog.querySelector("#upload-form") as HTMLFormElement;
    const closeBtn = dialog.querySelector("#close-btn") as HTMLButtonElement;
    const fileInput = dialog.querySelector("#files") as HTMLInputElement;
    const fileLabel = dialog.querySelector("#file-label") as HTMLSpanElement;
    const fileListEl = dialog.querySelector("#file-list") as HTMLUListElement;
    const submitBtn = dialog.querySelector(
      "#submit-btn",
    ) as HTMLButtonElement;

    let listGeneration = 0;

    const formatFileSize = (bytes: number): string => {
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const updateFileLabel = () => {
      if (!fileLabel) return;
      const count = this.#selectedFiles.length;
      if (count === 0) {
        fileLabel.textContent = "No files selected";
      } else if (count === 1) {
        fileLabel.textContent = this.#selectedFiles[0].name;
      } else {
        fileLabel.textContent = `${count} files selected`;
      }
    };

    const updateSubmitState = () => {
      if (submitBtn) {
        const disabled = this.#isSubmitting || this.#selectedFiles.length === 0;
        submitBtn.disabled = disabled;
        submitBtn.innerHTML = this.#isSubmitting
          ? '<span class="upload-dialog-loading" aria-hidden="true"></span>'
          : "Upload";
      }
      if (fileInput) {
        fileInput.disabled = this.#isSubmitting;
      }
    };

    const updateFileList = () => {
      if (!fileListEl) return;
      listGeneration++;
      const gen = listGeneration;
      fileListEl.replaceChildren();
      for (let i = 0; i < this.#selectedFiles.length; i++) {
        const file = this.#selectedFiles[i];
        const fileKey = `${file.name}-${file.size}-${file.lastModified}`;
        const li = document.createElement("li");
        li.className = "upload-dialog-file-item";
        li.dataset.fileKey = fileKey;
        const nameSpan = document.createElement("span");
        nameSpan.className = "upload-dialog-file-item-name";
        nameSpan.textContent = file.name;
        const sizeSpan = document.createElement("span");
        sizeSpan.className = "upload-dialog-file-item-size";
        sizeSpan.textContent = formatFileSize(file.size);
        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "upload-dialog-file-item-remove";
        removeBtn.setAttribute("aria-label", `Remove ${file.name}`);
        removeBtn.innerHTML = trashSvg;
        const id3Target = document.createElement("div");
        id3Target.className = "upload-dialog-file-item-id3";
        id3Target.dataset.id3Target = "";
        id3Target.textContent = "Loading…";
        const index = i;
        removeBtn.addEventListener("click", () => {
          this.#selectedFiles.splice(index, 1);
          updateFileList();
          updateFileLabel();
          updateSubmitState();
        });
        li.append(nameSpan, sizeSpan, removeBtn, id3Target);
        fileListEl.appendChild(li);

        getID3TagsFromFile(file).then((tags) => {
          if (gen !== listGeneration) return;
          const item = Array.from(fileListEl.children).find(
            (el) =>
              (el as HTMLElement).getAttribute("data-file-key") === fileKey,
          );
          if (!item) return;
          const target = item.querySelector("[data-id3-target]");
          if (!target) return;
          if (tags) {
            const parts: string[] = [];
            if (tags.artist) parts.push(tags.artist);
            if (tags.album) parts.push(tags.album);
            if (tags.title) parts.push(tags.title);
            if (tags.trackNumber) parts.push(tags.trackNumber.toString());
            const text = parts.join(" · ");
            target.replaceChildren();
            if (tags.image) {
              const img = document.createElement("img");
              img.src = tags.image;
              img.alt = "";
              img.setAttribute("aria-hidden", "true");
              target.appendChild(img);
            }
            target.appendChild(document.createTextNode(text || "—"));
          } else {
            target.textContent = "No metadata";
          }
        });
      }
    };

    updateSubmitState();
    updateFileLabel();
    updateFileList();

    closeBtn?.addEventListener("click", () => {
      dialog.close();
    });

    dialog.addEventListener("click", (e) => {
      if (e.target === dialog) {
        dialog.close();
      }
    });

    fileInput?.addEventListener("change", () => {
      if (fileInput.files && fileInput.files.length > 0) {
        this.#selectedFiles = Array.from(fileInput.files);
        fileInput.value = "";
        updateFileLabel();
        updateFileList();
        updateSubmitState();
      }
    });

    form?.addEventListener("submit", async (e) => {
      e.preventDefault();
      this.#isSubmitting = true;
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML =
          '<span class="upload-dialog-loading" aria-hidden="true"></span>';
      }
      if (fileInput) fileInput.disabled = true;

      const formData = new FormData();
      for (const f of this.#selectedFiles) {
        formData.append("files", f);
      }

      try {
        const response = await fetch("/", {
          method: "POST",
          body: formData,
        });

        if (response.ok) {
          globalThis.location.href = "/";
        } else {
          console.error("Upload failed:", response.statusText);
          this.#isSubmitting = false;
          if (this.#dialog?.isConnected) updateSubmitState();
        }
      } catch (error) {
        console.error("Upload error:", error);
        this.#isSubmitting = false;
        if (this.#dialog?.isConnected) updateSubmitState();
      }
    });
  }
}

customElements.define(
  "upload-dialog-custom-element",
  UploadDialogCustomElement,
);
