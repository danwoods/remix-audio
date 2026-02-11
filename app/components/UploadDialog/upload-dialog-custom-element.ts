/** @file Custom element for the upload dialog.
 *
 * Renders a trigger button that opens a modal for file uploads. Uses the native
 * <dialog> API (showModal() / close()) for focus trapping, Escape handling, and
 * ::backdrop. The dialog is appended to document.body so document-level styles
 * apply. Uses heroicons-style SVGs for plus and close.
 */

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
 * The modal is rendered into document.body so document-level styles apply.
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
  static observedAttributes = ["class"];

  private _showUploadUI = false;
  private _isSubmitting = false;
  private _hasDroppedFiles = false;
  private _dialog: HTMLDialogElement | null = null;

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.shadowRoot!.appendChild(template.content.cloneNode(true));
  }

  connectedCallback() {
    const trigger = this.shadowRoot!.getElementById("trigger");
    if (trigger) {
      trigger.addEventListener("click", this._onTriggerClick);
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
      trigger.removeEventListener("click", this._onTriggerClick);
    }
    this._close();
  }

  onAttributeChange(name: string, _oldValue: string, _newValue: string) {
    if (name === "buttonStyle") {
      const buttonStyle = this.getAttribute("buttonStyle");
      if (buttonStyle) {
        this.shadowRoot!.getElementById("trigger")!.style.cssText = buttonStyle;
      }
    }
  }

  private _onTriggerClick = () => {
    this._showUploadUI = true;
    this._hasDroppedFiles = false;
    this._isSubmitting = false;
    this._renderDialog();
  };

  /** Hide modal and cleanup. Called from dialog 'close' event (Escape, close button, backdrop). */
  private _close() {
    this._showUploadUI = false;
    this._hasDroppedFiles = false;
    this._isSubmitting = false;
    if (this._dialog?.parentNode) {
      this._dialog.parentNode.removeChild(this._dialog);
    }
    this._dialog = null;
  }

  private _renderDialog() {
    if (!this._showUploadUI || this._dialog) return;

    const dialog = document.createElement("dialog");
    this._dialog = dialog;

    /** X mark icon (heroicons 24 solid). */
    const xMarkSvg =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd" /></svg>`;

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
                class="upload-dialog-file-input"
              />
              <span aria-hidden="true">Choose files</span>
              <span class="upload-dialog-file-label" id="file-label">No files selected</span>
            </div>
          </div>
          <div class="upload-dialog-footer">
            <button
              type="submit"
              id="submit-btn"
              class="upload-dialog-submit"
            >
            ${
      this._isSubmitting
        ? '<span class="upload-dialog-loading" aria-hidden="true"></span>'
        : "Upload"
    }
            </button>
          </div>
        </div>
      </form>
    `;

    document.body.appendChild(dialog);
    dialog.showModal();

    dialog.addEventListener("close", () => {
      this._close();
    });

    const form = dialog.querySelector("#upload-form") as HTMLFormElement;
    const closeBtn = dialog.querySelector("#close-btn") as HTMLButtonElement;
    const fileInput = dialog.querySelector("#files") as HTMLInputElement;
    const fileLabel = dialog.querySelector("#file-label") as HTMLSpanElement;
    const submitBtn = dialog.querySelector(
      "#submit-btn",
    ) as HTMLButtonElement;

    const updateFileLabel = () => {
      if (!fileLabel || !fileInput?.files) return;
      const count = fileInput.files.length;
      if (count === 0) {
        fileLabel.textContent = "No files selected";
      } else if (count === 1) {
        fileLabel.textContent = fileInput.files[0].name;
      } else {
        fileLabel.textContent = `${count} files selected`;
      }
    };

    const updateSubmitState = () => {
      if (submitBtn) {
        const disabled = this._isSubmitting || !this._hasDroppedFiles;
        submitBtn.disabled = disabled;
        submitBtn.innerHTML = this._isSubmitting
          ? '<span class="upload-dialog-loading" aria-hidden="true"></span>'
          : "Upload";
      }
      if (fileInput) {
        fileInput.disabled = this._isSubmitting;
      }
    };

    updateSubmitState();
    updateFileLabel();

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
        this._hasDroppedFiles = true;
        updateFileLabel();
        updateSubmitState();
      }
    });

    form?.addEventListener("submit", async (e) => {
      e.preventDefault();
      this._isSubmitting = true;
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML =
          '<span class="upload-dialog-loading" aria-hidden="true"></span>';
      }
      // Build FormData before disabling the file input: disabled controls are
      // not successful and are omitted from FormData.
      const formData = new FormData(form!);
      if (fileInput) fileInput.disabled = true;

      try {
        const response = await fetch("/", {
          method: "POST",
          body: formData,
        });

        if (response.ok) {
          globalThis.location.href = "/";
        } else {
          console.error("Upload failed:", response.statusText);
          this._isSubmitting = false;
          updateSubmitState();
        }
      } catch (error) {
        console.error("Upload error:", error);
        this._isSubmitting = false;
        updateSubmitState();
      }
    });
  }
}

customElements.define(
  "upload-dialog-custom-element",
  UploadDialogCustomElement,
);
