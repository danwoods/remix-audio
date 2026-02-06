/** @file Custom element for the upload dialog.
 *
 * Renders a trigger button that opens a modal for file uploads. The modal is
 * appended to document.body (like the original FilePicker) so document CSS
 * (daisyUI modal, btn, etc.) applies. Uses heroicons-style SVGs for plus and close.
 */

// TEMPLATE ///////////////////////////////////////////////////////////////////

const template = document.createElement("template");

/** Plus circle icon (heroicons 24 solid). */
const plusCircleSvg =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-6"><path fill-rule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM12.75 9a.75.75 0 0 0-1.5 0v2.25H9a.75.75 0 0 0 0 1.5h2.25V15a.75.75 0 0 0 1.5 0v-2.25H15a.75.75 0 0 0 0-1.5h-2.25V9Z" clip-rule="evenodd" /></svg>`;

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
 * The modal is rendered into document.body so document-level styles (daisyUI)
 * apply. Supports optional trigger button classes via the `class` attribute.
 *
 * @customElement upload-dialog-custom-element
 *
 * @example
 * ```html
 * <upload-dialog-custom-element class="btn btn-ghost btn-circle max-md:hidden"></upload-dialog-custom-element>
 * ```
 */
export class UploadDialogCustomElement extends HTMLElement {
  static observedAttributes = ["class"];

  private _showUploadUI = false;
  private _isSubmitting = false;
  private _hasDroppedFiles = false;
  private _dialogContainer: HTMLDivElement | null = null;
  private _keydownHandler: ((e: KeyboardEvent) => void) | null = null;

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

  /** Hide modal and cleanup. */
  private _close() {
    if (this._keydownHandler) {
      document.removeEventListener("keydown", this._keydownHandler);
      this._keydownHandler = null;
    }
    this._showUploadUI = false;
    this._hasDroppedFiles = false;
    this._isSubmitting = false;
    if (this._dialogContainer?.parentNode) {
      this._dialogContainer.parentNode.removeChild(this._dialogContainer);
    }
    this._dialogContainer = null;
  }

  private _renderDialog() {
    if (!this._showUploadUI || this._dialogContainer) return;

    const container = document.createElement("div");
    this._dialogContainer = container;
    container.style.cssText =
      "position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:9999;background:rgba(0,0,0,0.5);";

    /** X mark icon (heroicons 24 solid). */
    const xMarkSvg =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-4"><path fill-rule="evenodd" d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd" /></svg>`;

    container.innerHTML = `
      <dialog open class="modal" style="margin:0 auto;max-width:min(32rem,90vw);width:100%;position:relative;">
        <form method="post" enctype="multipart/form-data" id="upload-form">
          <div class="modal-box bg-base-300 flex flex-col justify-center rounded">
            <div class="flex justify-end">
              <button class="btn" type="button" id="close-btn" aria-label="close">${xMarkSvg}</button>
            </div>
            <div class="p-4">
              <input
                id="files"
                type="file"
                name="files"
                multiple
                class="file-input w-full"
              />
            </div>
            <button
              type="submit"
              id="submit-btn"
              class="btn mt-6"
            >
              ${
      this._isSubmitting
        ? '<span class="loading loading-spinner"></span>'
        : "Upload"
    }
            </button>
          </div>
        </form>
      </dialog>
    `;

    document.body.appendChild(container);

    const form = container.querySelector("#upload-form") as HTMLFormElement;
    const closeBtn = container.querySelector("#close-btn") as HTMLButtonElement;
    const fileInput = container.querySelector("#files") as HTMLInputElement;
    const submitBtn = container.querySelector(
      "#submit-btn",
    ) as HTMLButtonElement;

    const updateSubmitState = () => {
      if (submitBtn) {
        const disabled = this._isSubmitting || !this._hasDroppedFiles;
        submitBtn.disabled = disabled;
        submitBtn.classList.toggle("disabled", disabled);
        submitBtn.innerHTML = this._isSubmitting
          ? '<span class="loading loading-spinner"></span>'
          : "Upload";
      }
      if (fileInput) {
        fileInput.disabled = this._isSubmitting;
      }
    };

    updateSubmitState();

    const close = () => {
      this._close();
    };

    closeBtn?.addEventListener("click", close);

    container.addEventListener("click", (e) => {
      if (e.target === container) close();
    });

    this._keydownHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", this._keydownHandler);

    fileInput?.addEventListener("change", () => {
      if (fileInput.files && fileInput.files.length > 0) {
        this._hasDroppedFiles = true;
        updateSubmitState();
      }
    });

    form?.addEventListener("submit", async (e) => {
      e.preventDefault();
      this._isSubmitting = true;
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.classList.add("disabled");
        submitBtn.innerHTML = '<span class="loading loading-spinner"></span>';
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
