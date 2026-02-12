/** @file Tests for UploadDialogCustomElement
 *
 * This test suite covers the upload-dialog custom element that provides
 * a trigger button and modal for file uploads.
 *
 * ## Test Structure
 *
 * Tests use Deno's built-in testing framework. DOM is mocked because Deno
 * does not provide a full DOM. The module is imported after DOM setup.
 *
 * ## Key Testing Areas
 *
 * 1. Element lifecycle: creation, shadow root, trigger button
 * 2. Observed attributes
 * 3. Dialog open/close behavior (when trigger clicked, dialog appended to shadow root)
 * 4. Native dialog API: close event cleanup; backdrop click closes the dialog
 *
 * ## Manual verification checklist
 *
 * After changing dialog styling or markup, run the app and confirm:
 * 1. Start app: `deno task start` (or `dev`), open in a browser.
 * 2. Open the upload dialog (click the upload trigger).
 * 3. Backdrop: darker overlay; optional blur.
 * 4. Panel: dark background (#121212), white text, visible shadow and border.
 * 5. Title: "Upload files" visible in the header.
 * 6. Close: hover shows background; Tab focus shows focus-visible ring; click closes.
 * 7. File input: styled drop zone; "No files selected" or file names; choosing files updates state.
 * 8. File list: shows names and sizes; after a moment ID3 (artist, album, title, track, cover); remove works; submit sends the listed files.
 * 9. Submit: blue primary button; disabled when no files; hover/active states; focus-visible ring; loading spinner when submitting.
 * 10. Escape / backdrop click: still closes the dialog.
 */

import { assert, assertEquals, assertExists } from "@std/assert";

// ============================================================================
// MOCK STATE
// ============================================================================

let templateHTML = "";
/** Last template HTML that looks like the dialog (contains upload-form). */
let dialogTemplateHTML = "";
const shadowRootAppendChildCalls: unknown[] = [];
const shadowRootRemoveChildCalls: unknown[] = [];
let mockTriggerButton: Partial<HTMLButtonElement> | null = null;
let triggerClickHandler: (() => void) | null = null;
let dialogClickHandler: ((e: { target: unknown }) => void) | null = null;
let dialogCloseHandler: (() => void) | null = null;
let fileListRemoveHandler:
  | ((e: CustomEvent<{ fileKey: string }>) => void)
  | null = null;
let fileItemRemoveClickHandler: (() => void) | null = null;

/** File input mock for regression test and file list tests. */
let mockFileInput: {
  disabled: boolean;
  files: File[];
  value: string;
  addEventListener: (type: string, fn: () => void) => void;
  _changeHandler?: () => void;
} | null = null;

/** Form mock for regression test: stores submit handler. */
let mockFormWithSubmit: {
  _submitHandler: ((e: Event) => void) | null;
  querySelector: (sel: string) => unknown;
  addEventListener: (type: string, fn: (e: Event) => void) => void;
  action: string;
} | null = null;

/** Error element mock for error handling tests. */
let mockUploadErrorEl: {
  textContent: string;
  hidden: boolean;
} | null = null;

function createMockDialog() {
  const fileInput = {
    disabled: false,
    files: [] as File[],
    value: "",
    addEventListener(type: string, fn: () => void) {
      if (type === "change") {
        (fileInput as { _changeHandler?: () => void })._changeHandler = fn;
      }
    },
  };
  mockFileInput = fileInput;

  const form = {
    _submitHandler: null as ((e: Event) => void) | null,
    querySelector(sel: string) {
      return sel === "#files" ? fileInput : null;
    },
    addEventListener(type: string, fn: (e: Event) => void) {
      if (type === "submit") {
        (form as { _submitHandler: ((e: Event) => void) | null })
          ._submitHandler = fn;
      }
    },
    action: "http://localhost:8000/",
  };
  mockFormWithSubmit = form;

  const genericNode = {
    addEventListener: () => {},
    disabled: false,
    classList: { toggle: () => {}, add: () => {} },
    innerHTML: "",
  };

  const submitBtnMock = {
    addEventListener: () => {},
    disabled: false,
    innerHTML: "",
  };

  const fileListChildren: unknown[] = [];
  const fileListEl = {
    _children: fileListChildren,
    get children() {
      return fileListChildren;
    },
    replaceChildren() {
      fileListChildren.length = 0;
    },
    appendChild(child: unknown) {
      fileListChildren.push(child);
      (child as { parentElement?: unknown }).parentElement = fileListEl;
      return child;
    },
    removeChild(child: unknown) {
      const idx = fileListChildren.indexOf(child);
      if (idx >= 0) fileListChildren.splice(idx, 1);
      (child as { parentElement?: unknown }).parentElement = null;
      return child;
    },
    querySelectorAll(sel: string) {
      if (sel === "upload-dialog-file-item") {
        return fileListChildren as unknown[];
      }
      return [];
    },
    addEventListener(
      type: string,
      fn: (e: CustomEvent<{ fileKey: string }>) => void,
    ) {
      if (type === "upload-dialog-remove") fileListRemoveHandler = fn;
    },
  };

  const uploadErrorEl = {
    textContent: "",
    hidden: true,
  };
  mockUploadErrorEl = uploadErrorEl;

  const dialog = {
    style: { cssText: "" },
    parentNode: null as unknown as ParentNode,
    appendChild(_child: unknown) {
      return _child;
    },
    get innerHTML() {
      return dialogTemplateHTML || templateHTML;
    },
    addEventListener(type: string, fn: (e?: { target: unknown }) => void) {
      if (type === "click") {
        dialogClickHandler = fn as (e: { target: unknown }) => void;
      }
      if (type === "close") dialogCloseHandler = fn as () => void;
    },
    close() {
      if (dialogCloseHandler) dialogCloseHandler();
    },
    showModal: () => {},
    querySelector(sel: string) {
      if (sel === "#upload-form") return form;
      if (sel === "#files") return fileInput;
      if (sel === "#file-list") return fileListEl;
      if (sel === "#upload-error") return uploadErrorEl;
      if (sel === "#close-btn") return genericNode;
      if (sel === "#submit-btn") return submitBtnMock;
      return null;
    },
  };
  return dialog;
}

// ============================================================================
// DOM SETUP (must run before importing the element module)
// ============================================================================

function setupDOMEnvironment() {
  triggerClickHandler = null;
  dialogClickHandler = null;
  dialogCloseHandler = null;
  fileListRemoveHandler = null;
  fileItemRemoveClickHandler = null;
  shadowRootAppendChildCalls.length = 0;
  shadowRootRemoveChildCalls.length = 0;

  mockTriggerButton = {
    id: "trigger",
    style: { cssText: "" } as unknown as CSSStyleDeclaration,
    addEventListener: (type: string, fn: (e?: Event) => void) => {
      if (type === "click") triggerClickHandler = fn as () => void;
    },
  };

  const mockBody = {
    appendChild(node: unknown) {
      (node as { parentNode?: unknown }).parentNode = mockBody;
    },
    removeChild: () => {},
    parentNode: null as unknown as ParentNode,
  };

  const fileItemNameEl = { textContent: "" };
  const fileItemSizeEl = { textContent: "" };
  const fileItemRemoveBtn = {
    addEventListener(_type: string, fn: () => void) {
      if (_type === "click") fileItemRemoveClickHandler = fn as () => void;
    },
    setAttribute: () => {},
  };
  const fileItemId3Target = {
    textContent: "Loading…",
    replaceChildren: () => {},
    appendChild: () => {},
  };
  const mockTemplateContent = {
    cloneNode: (_deep: boolean) => ({
      getElementById: (id: string) => {
        if (id === "trigger") return mockTriggerButton;
        if (id === "name") return fileItemNameEl;
        if (id === "size") return fileItemSizeEl;
        if (id === "remove") return fileItemRemoveBtn;
        if (id === "id3-target") return fileItemId3Target;
        return null;
      },
      querySelector: () => null,
      childNodes: [],
    }),
  };

  globalThis.document = {
    createElement: (tagName: string) => {
      if (tagName === "template") {
        return {
          set innerHTML(value: string) {
            templateHTML = value;
            if (value.includes("upload-form")) dialogTemplateHTML = value;
          },
          get innerHTML() {
            return templateHTML;
          },
          content: mockTemplateContent,
        } as unknown as HTMLTemplateElement;
      }
      if (tagName === "dialog") {
        return createMockDialog() as unknown as HTMLDialogElement;
      }
      if (tagName === "upload-dialog-file-item") {
        let _file: File | null = null;
        let _fileKey = "";
        const fileItem = {
          set file(value: File | null) {
            _file = value;
            if (value) {
              _fileKey = `${value.name}-${value.size}-${value.lastModified}`;
            }
          },
          get file() {
            return _file;
          },
          get metadata() {
            return {
              artist: "Test Artist",
              album: "Test Album",
              title: "Test Title",
              trackNumber: 1,
            };
          },
          parentElement: null as unknown as ParentNode,
          _simulateRemove() {
            fileListRemoveHandler?.(
              {
                target: fileItem,
                detail: { fileKey: _fileKey },
              } as unknown as CustomEvent<{ fileKey: string }>,
            );
          },
        };
        return fileItem as unknown as HTMLElement;
      }
      if (tagName === "li") {
        const children: unknown[] = [];
        const li = {
          dataset: {} as Record<string, string>,
          className: "",
          append(...args: unknown[]) {
            children.push(...args);
          },
          _children: children,
          getAttribute(name: string) {
            if (name === "data-file-key") return li.dataset.fileKey ?? null;
            return null;
          },
          querySelector(sel: string) {
            if (sel === "[data-id3-target]") return children[3] ?? null;
            return null;
          },
        };
        return li as unknown as HTMLElement;
      }
      if (tagName === "span") {
        return {
          className: "",
          textContent: "",
          addEventListener: () => {},
        } as unknown as HTMLElement;
      }
      if (tagName === "div") {
        return {
          className: "",
          textContent: "",
          dataset: {} as Record<string, string>,
          replaceChildren: () => {},
          appendChild: () => {},
          setAttribute: () => {},
          querySelector: () => null,
        } as unknown as HTMLElement;
      }
      if (tagName === "input") {
        return {
          setAttribute: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
          type: "text",
          value: "",
          id: "",
          min: "",
        } as unknown as HTMLElement;
      }
      if (tagName === "label") {
        return {
          htmlFor: "",
          textContent: "",
          appendChild: () => {},
          setAttribute: () => {},
        } as unknown as HTMLElement;
      }
      if (tagName === "button") {
        const button: {
          type: string;
          className: string;
          setAttribute: () => void;
          innerHTML: string;
          addEventListener: (type: string, fn: () => void) => void;
          _clickHandler?: () => void;
        } = {
          type: "",
          className: "",
          setAttribute: () => {},
          innerHTML: "",
          addEventListener(type: string, fn: () => void) {
            if (type === "click") button._clickHandler = fn;
          },
        };
        return button as unknown as HTMLElement;
      }
      return {} as HTMLElement;
    },
    addEventListener: () => {},
    removeEventListener: () => {},
    body: mockBody,
  } as unknown as Document;

  globalThis.HTMLElement = class HTMLElement {
    shadowRoot: ShadowRoot | null = null;
    private _attrs: Record<string, string> = {};
    private _listeners: Record<string, ((e: Event) => void)[]> = {};
    parentNode: ParentNode | null = null;
    get isConnected(): boolean {
      return this.parentNode != null;
    }

    hasAttribute(name: string) {
      return name in this._attrs;
    }
    getAttribute(name: string) {
      return this._attrs[name] ?? null;
    }
    setAttribute(name: string, value: string) {
      this._attrs[name] = value;
    }
    addEventListener(type: string, fn: (e: Event) => void) {
      if (!this._listeners[type]) this._listeners[type] = [];
      this._listeners[type].push(fn);
    }
    removeEventListener(_type: string, _fn: (e: Event) => void) {}
    dispatchEvent(e: Event) {
      const fns = this._listeners[(e as CustomEvent).type] ?? [];
      for (const fn of fns) fn(e);
      return true;
    }

    attachShadow(_init: ShadowRootInit) {
      const shadow = {
        appendChild(child: unknown) {
          shadowRootAppendChildCalls.push(child);
          (child as { parentNode: unknown }).parentNode = shadow;
          return child;
        },
        removeChild(child: unknown) {
          shadowRootRemoveChildCalls.push(child);
        },
        getElementById(id: string) {
          if (id === "trigger") return mockTriggerButton;
          const lastChild = shadowRootAppendChildCalls[
            shadowRootAppendChildCalls.length - 1
          ] as { getElementById?: (id: string) => unknown } | undefined;
          return lastChild?.getElementById?.(id) ?? null;
        },
        querySelector: () => null,
        addEventListener: () => {},
        removeEventListener: () => {},
        get childNodes() {
          return [];
        },
      } as unknown as ShadowRoot;
      (this as { shadowRoot: ShadowRoot }).shadowRoot = shadow;
      return shadow;
    }
  } as unknown as typeof HTMLElement;

  globalThis.customElements = {
    define: () => {},
  } as unknown as CustomElementRegistry;
}

setupDOMEnvironment();

const { UploadDialogCustomElement } = await import(
  "./upload-dialog-custom-element.ts"
);
const { UploadDialogFileItemCustomElement } = await import(
  "./upload-dialog-file-item-custom-element.ts"
);

// ============================================================================
// TEST SUITE: ELEMENT LIFECYCLE
// ============================================================================

Deno.test("UploadDialogCustomElement - element can be created", () => {
  /**
   * Tests that the element can be instantiated.
   */
  const element = new UploadDialogCustomElement();
  assertExists(element);
  assertEquals(element.constructor.name, "UploadDialogCustomElement");
});

Deno.test("UploadDialogCustomElement - creates shadow root with trigger button", () => {
  /**
   * Tests that the element has a shadow root and a trigger button.
   */
  const element = new UploadDialogCustomElement();
  assertExists(element.shadowRoot);
  const trigger = element.shadowRoot!.getElementById("trigger");
  assertExists(trigger);
});

Deno.test("UploadDialogCustomElement - observedAttributes includes class and buttonStyle", () => {
  /**
   * Tests that the element observes class and buttonStyle for styling.
   */
  assertEquals(
    UploadDialogCustomElement.observedAttributes.includes("class"),
    true,
  );
  assertEquals(
    UploadDialogCustomElement.observedAttributes.includes("buttonStyle"),
    true,
  );
});

Deno.test("UploadDialogCustomElement - attributeChangedCallback applies buttonStyle to trigger", () => {
  /**
   * Tests that when buttonStyle attribute changes, attributeChangedCallback
   * applies the style to the trigger button (browser calls this automatically).
   */
  const element = new UploadDialogCustomElement();
  element.connectedCallback();
  const trigger = element.shadowRoot!.getElementById("trigger") as {
    style: { cssText: string };
  };
  assertExists(trigger);
  assertExists(trigger.style);
  element.setAttribute("buttonStyle", "width: 100px; height: 50px");
  element.attributeChangedCallback(
    "buttonStyle",
    "",
    "width: 100px; height: 50px",
  );
  assertEquals(
    trigger.style.cssText,
    "width: 100px; height: 50px",
    "trigger style should be applied from buttonStyle attribute",
  );
});

Deno.test("UploadDialogCustomElement - dialog close removes it from shadow root", () => {
  /**
   * Tests that when the native dialog is closed (Escape, close button, or
   * backdrop click all call dialog.close()), the 'close' event runs and
   * the dialog is removed from the shadow root.
   */
  shadowRootAppendChildCalls.length = 0;
  shadowRootRemoveChildCalls.length = 0;
  const element = new UploadDialogCustomElement();
  element.connectedCallback();
  assertExists(
    triggerClickHandler,
    "trigger click handler should be registered",
  );
  triggerClickHandler!();
  assertEquals(
    shadowRootAppendChildCalls.length,
    2,
    "shadow root should have template and dialog appended",
  );
  const dialog = shadowRootAppendChildCalls[1] as { close: () => void };
  assertExists(dialog.close, "dialog should have close()");
  dialog.close();
  assertEquals(
    shadowRootRemoveChildCalls.length,
    1,
    "dialog should be removed from shadow root when closed",
  );
});

Deno.test("UploadDialogCustomElement - backdrop click closes the dialog", () => {
  /**
   * Tests that clicking the backdrop (the dialog element itself) while open
   * calls dialog.close() and removes the dialog from the shadow root.
   */
  shadowRootAppendChildCalls.length = 0;
  shadowRootRemoveChildCalls.length = 0;
  const element = new UploadDialogCustomElement();
  element.connectedCallback();
  assertExists(
    triggerClickHandler,
    "trigger click handler should be registered",
  );
  triggerClickHandler!();
  assertExists(
    dialogClickHandler,
    "dialog click handler should be registered when dialog opens",
  );
  assertEquals(
    shadowRootAppendChildCalls.length,
    2,
    "shadow root should have template and dialog appended",
  );
  const dialog = shadowRootAppendChildCalls[1];
  dialogClickHandler!({ target: dialog });
  assertEquals(
    shadowRootRemoveChildCalls.length,
    1,
    "dialog should be removed from shadow root on backdrop click",
  );
});

Deno.test("UploadDialogCustomElement - dialog markup includes styling and title", () => {
  /**
   * Asserts that the generated dialog template includes the expected structure
   * and styles (title, box-shadow, focus-visible, primary button color) to
   * guard against regressions that remove them.
   */
  shadowRootAppendChildCalls.length = 0;
  const element = new UploadDialogCustomElement();
  element.connectedCallback();
  assertExists(
    triggerClickHandler,
    "trigger click handler should be registered",
  );
  triggerClickHandler!();
  assertEquals(
    shadowRootAppendChildCalls.length,
    2,
    "shadow root should have template and dialog appended",
  );
  const dialog = shadowRootAppendChildCalls[1] as { innerHTML: string };
  const html = dialog.innerHTML;
  assert(
    html.includes("Upload files"),
    "dialog markup should include title 'Upload files'",
  );
  assert(
    html.includes("box-shadow"),
    "dialog markup should include box-shadow in styles",
  );
  assert(
    html.includes("focus-visible"),
    "dialog markup should include focus-visible in styles",
  );
  assert(
    html.includes("--color-blue-500") || html.includes("#3b82f6"),
    "dialog markup should include primary button color (--color-blue-500 or fallback)",
  );
  assert(
    html.includes('id="upload-error"'),
    "dialog markup should include upload-error element for error display",
  );
});

Deno.test("UploadDialogCustomElement - file input restricts to audio uploads", () => {
  /**
   * Tests that the file input has accept="audio/*" so the file picker
   * only offers audio file types.
   */
  shadowRootAppendChildCalls.length = 0;
  const element = new UploadDialogCustomElement();
  element.connectedCallback();
  assertExists(
    triggerClickHandler,
    "trigger click handler should be registered",
  );
  triggerClickHandler!();
  assertEquals(
    shadowRootAppendChildCalls.length,
    2,
    "shadow root should have template and dialog appended",
  );
  const dialog = shadowRootAppendChildCalls[1] as { innerHTML: string };
  const html = dialog.innerHTML;
  assert(
    html.includes('accept="audio/*"'),
    'file input should have accept="audio/*" to restrict to audio uploads only',
  );
});

Deno.test("UploadDialogCustomElement - file list updated when files selected", () => {
  /**
   * Tests that when the user selects files (change event), the file list
   * is updated and submit becomes enabled.
   */
  shadowRootAppendChildCalls.length = 0;
  const element = new UploadDialogCustomElement();
  element.connectedCallback();
  assertExists(triggerClickHandler);
  triggerClickHandler!();
  const dialog = shadowRootAppendChildCalls[1] as {
    querySelector: (s: string) => { _children: unknown[] };
  };
  const fileListEl = dialog.querySelector("#file-list");
  assertExists(fileListEl);
  assertExists(mockFileInput);
  assertExists(mockFileInput._changeHandler);
  const mockFile = new File(["x"], "test.mp3", { type: "audio/mpeg" });
  mockFileInput.files = [mockFile];
  mockFileInput._changeHandler!();
  assertEquals(
    fileListEl._children.length,
    1,
    "file list should have one item after selecting one file",
  );
});

Deno.test("UploadDialogCustomElement - remove file updates list and disables submit", () => {
  /**
   * Tests that clicking remove on a file updates the list and disables
   * submit when no files remain.
   */
  shadowRootAppendChildCalls.length = 0;
  const element = new UploadDialogCustomElement();
  element.connectedCallback();
  assertExists(triggerClickHandler);
  triggerClickHandler!();
  const dialog = shadowRootAppendChildCalls[1] as {
    querySelector: (s: string) => unknown;
  };
  const fileListEl = dialog.querySelector("#file-list") as {
    _children: unknown[];
  };
  const submitBtn = dialog.querySelector("#submit-btn") as {
    disabled: boolean;
  };
  assertExists(mockFileInput);
  assertExists(mockFileInput._changeHandler);
  const mockFile = new File(["x"], "test.mp3", { type: "audio/mpeg" });
  mockFileInput.files = [mockFile];
  mockFileInput._changeHandler!();
  assertEquals(fileListEl._children.length, 1);
  const fileItem = fileListEl._children[0] as { _simulateRemove?: () => void };
  assertExists(fileItem._simulateRemove);
  fileItem._simulateRemove!();
  assertEquals(
    fileListEl._children.length,
    0,
    "file list should be empty after remove",
  );
  assert(
    submitBtn.disabled,
    "submit should be disabled when no files remain",
  );
});

Deno.test("UploadDialogFileItemCustomElement - renders file name and size when file is set", () => {
  const element = new UploadDialogFileItemCustomElement();
  const file = new File(["content"], "test.mp3", {
    type: "audio/mpeg",
    lastModified: 12345,
  });
  Object.defineProperty(file, "size", { value: 1024 });
  element.file = file;
  element.connectedCallback();
  const nameEl = element.shadowRoot?.getElementById("name") as
    | { textContent: string }
    | null;
  const sizeEl = element.shadowRoot?.getElementById("size") as
    | { textContent: string }
    | null;
  assertExists(nameEl);
  assertExists(sizeEl);
  assertEquals(nameEl.textContent, "test.mp3");
  assertEquals(sizeEl.textContent, "1.0 KB");
});

Deno.test("UploadDialogFileItemCustomElement - dispatches upload-dialog-remove when remove is clicked", () => {
  let capturedDetail: { fileKey: string } | null = null;
  fileItemRemoveClickHandler = null;
  const element = new UploadDialogFileItemCustomElement();
  const file = new File(["x"], "song.mp3", {
    type: "audio/mpeg",
    lastModified: 99999,
  });
  Object.defineProperty(file, "size", { value: 512 });
  element.file = file;
  element.connectedCallback();
  element.addEventListener(
    "upload-dialog-remove",
    (e) => {
      capturedDetail = (e as CustomEvent<{ fileKey: string }>).detail;
    },
  );
  assertExists(
    fileItemRemoveClickHandler,
    "remove button click handler should be registered",
  );
  (fileItemRemoveClickHandler as () => void)();
  assertExists(capturedDetail, "upload-dialog-remove should be dispatched");
  assertEquals(
    (capturedDetail as { fileKey: string }).fileKey,
    "song.mp3-512-99999",
    "event detail should include fileKey",
  );
});

Deno.test(
  "UploadDialogCustomElement - shows server error message when upload fails",
  async () => {
    /**
     * Tests that when the server returns a non-ok response (e.g. 500), the
     * error message from the response body is shown in the upload-error element.
     */
    const OriginalFetch = globalThis.fetch;
    (globalThis as { fetch: typeof fetch }).fetch = function () {
      return Promise.resolve(
        new Response("Upload failed for all files: S3 connection error", {
          status: 500,
        }),
      );
    };

    shadowRootAppendChildCalls.length = 0;
    const element = new UploadDialogCustomElement();
    element.connectedCallback();
    assertExists(triggerClickHandler);
    triggerClickHandler!();
    assertExists(mockFormWithSubmit);
    assertExists(mockFileInput);
    assertExists(mockFileInput._changeHandler);
    const mockFile = new File(["x"], "test.mp3", { type: "audio/mpeg" });
    mockFileInput.files = [mockFile];
    mockFileInput.value = "";
    mockFileInput._changeHandler!();

    await mockFormWithSubmit!._submitHandler!({
      preventDefault: () => {},
    } as Event);

    assertExists(
      mockUploadErrorEl,
      "upload error element should exist when dialog is open",
    );
    assertEquals(
      mockUploadErrorEl.textContent,
      "Upload failed for all files: S3 connection error",
      "error message from server should be shown",
    );
    assert(
      !mockUploadErrorEl.hidden,
      "error element should be visible when error occurs",
    );

    (globalThis as { fetch: typeof fetch }).fetch = OriginalFetch;
  },
);

Deno.test(
  "UploadDialogCustomElement - shows network error message when fetch throws",
  async () => {
    /**
     * Tests that when fetch throws (network error, etc.), a user-friendly
     * message is shown in the upload-error element.
     */
    const OriginalFetch = globalThis.fetch;
    (globalThis as { fetch: typeof fetch }).fetch = function () {
      return Promise.reject(new Error("Failed to fetch"));
    };

    shadowRootAppendChildCalls.length = 0;
    const element = new UploadDialogCustomElement();
    element.connectedCallback();
    assertExists(triggerClickHandler);
    triggerClickHandler!();
    assertExists(mockFormWithSubmit);
    assertExists(mockFileInput);
    assertExists(mockFileInput._changeHandler);
    const mockFile = new File(["x"], "test.mp3", { type: "audio/mpeg" });
    mockFileInput.files = [mockFile];
    mockFileInput.value = "";
    mockFileInput._changeHandler!();

    await mockFormWithSubmit!._submitHandler!({
      preventDefault: () => {},
    } as Event);

    assertExists(mockUploadErrorEl);
    assertEquals(
      mockUploadErrorEl.textContent,
      "Failed to fetch",
      "error message from thrown Error should be shown",
    );
    assert(!mockUploadErrorEl.hidden, "error element should be visible");

    (globalThis as { fetch: typeof fetch }).fetch = OriginalFetch;
  },
);

Deno.test(
  "UploadDialogCustomElement - clears error when user selects new files",
  async () => {
    /**
     * Tests that when an error is shown and the user selects new files,
     * the error is cleared so they can retry without seeing stale messages.
     */
    const OriginalFetch = globalThis.fetch;
    (globalThis as { fetch: typeof fetch }).fetch = function () {
      return Promise.resolve(
        new Response("Server error", { status: 500 }),
      );
    };

    shadowRootAppendChildCalls.length = 0;
    const element = new UploadDialogCustomElement();
    element.connectedCallback();
    assertExists(triggerClickHandler);
    triggerClickHandler!();
    assertExists(mockFormWithSubmit);
    assertExists(mockFileInput);
    assertExists(mockFileInput._changeHandler);
    const mockFile = new File(["x"], "test.mp3", { type: "audio/mpeg" });
    mockFileInput.files = [mockFile];
    mockFileInput.value = "";
    mockFileInput._changeHandler!();
    await mockFormWithSubmit!._submitHandler!({
      preventDefault: () => {},
    } as Event);

    assertEquals(
      mockUploadErrorEl?.textContent,
      "Server error",
      "error should be shown after failed submit",
    );
    assert(!mockUploadErrorEl?.hidden);

    const newFile = new File(["y"], "song2.mp3", { type: "audio/mpeg" });
    mockFileInput.files = [newFile];
    mockFileInput.value = "";
    mockFileInput._changeHandler!();

    assertEquals(
      mockUploadErrorEl?.textContent,
      "",
      "error should be cleared when user selects new files",
    );
    assert(
      mockUploadErrorEl?.hidden,
      "error element should be hidden when cleared",
    );

    (globalThis as { fetch: typeof fetch }).fetch = OriginalFetch;
  },
);

Deno.test(
  "UploadDialogCustomElement - regression: FormData is built from selected files so fetch receives files",
  async () => {
    /**
     * Regression test for upload 400 "No files provided". Submit builds
     * FormData from _selectedFiles (populated when user selects files).
     * We simulate file selection by firing the change handler, then submit.
     */
    let capturedBody: FormData | null = null;
    const OriginalFetch = globalThis.fetch;

    (globalThis as { fetch: typeof fetch }).fetch = function (
      _url: unknown,
      init?: RequestInit,
    ) {
      capturedBody = (init?.body as FormData) ?? null;
      return Promise.resolve(
        new Response(null, { status: 303, headers: { Location: "/" } }),
      );
    };

    shadowRootAppendChildCalls.length = 0;
    const element = new UploadDialogCustomElement();
    element.connectedCallback();
    assertExists(triggerClickHandler);
    triggerClickHandler!();
    assertExists(
      mockFormWithSubmit,
      "form should be created when dialog opens",
    );
    assertExists(mockFileInput, "file input should exist");
    const mockFile = new File(["x"], "test.mp3", { type: "audio/mpeg" });
    mockFileInput.files = [mockFile];
    mockFileInput.value = "";
    assertExists(
      mockFileInput._changeHandler,
      "change handler should be registered",
    );
    mockFileInput._changeHandler!();

    await mockFormWithSubmit!._submitHandler!({
      preventDefault: () => {},
    } as Event);

    assertExists(
      capturedBody,
      "fetch should be called with body",
    );
    const body = capturedBody as FormData;
    assertEquals(
      body.getAll("files").length,
      1,
      "FormData passed to fetch must include selected files",
    );
    const metadata0 = body.get("metadata:0");
    assertExists(
      metadata0,
      "FormData should include metadata:0 when file items exist",
    );
    const parsed = JSON.parse(metadata0 as string) as {
      artist: string;
      album: string;
      title: string;
      trackNumber: number;
    };
    assertEquals(parsed.artist, "Test Artist");
    assertEquals(parsed.album, "Test Album");
    assertEquals(parsed.title, "Test Title");
    assertEquals(parsed.trackNumber, 1);

    (globalThis as { fetch: typeof fetch }).fetch = OriginalFetch;
  },
);

Deno.test("UploadDialogFileItemCustomElement - metadata getter returns editable values and trackNumber clamps to 1", async () => {
  /**
   * Tests that when ID3 loads (or returns null), the metadata getter returns
   * the current values and trackNumber is at least 1.
   */
  const element = new UploadDialogFileItemCustomElement();
  const file = new File(["x"], "track.mp3", {
    type: "audio/mpeg",
    lastModified: 11111,
  });
  Object.defineProperty(file, "size", { value: 256 });
  element.file = file;
  element.connectedCallback();
  await new Promise((r) => setTimeout(r, 50));
  const meta = element.metadata;
  assertExists(meta, "metadata getter should return object");
  assertEquals(typeof meta.artist, "string");
  assertEquals(typeof meta.album, "string");
  assertEquals(typeof meta.title, "string");
  assertEquals(typeof meta.trackNumber, "number");
  assert(meta.trackNumber >= 1, "trackNumber should be at least 1");
});

Deno.test("UploadDialogFileItemCustomElement - metadata uses Unknown when ID3 returns null", async () => {
  /**
   * When getID3TagsFromFile returns null (Deno has no window), metadata must
   * use "Unknown" not "" so server does not get empty overrides that produce
   * invalid S3 keys (//1__) and invisible files.
   */
  const element = new UploadDialogFileItemCustomElement();
  document.body.appendChild(element);
  element.connectedCallback();
  const file = new File(["x"], "nocover.wav", {
    type: "audio/wav",
    lastModified: 22222,
  });
  Object.defineProperty(file, "size", { value: 128 });
  element.file = file;
  await new Promise((r) => setTimeout(r, 100));
  const meta = element.metadata;
  assertEquals(meta.artist, "Unknown");
  assertEquals(meta.album, "Unknown");
  assertEquals(meta.title, "Unknown");
});
