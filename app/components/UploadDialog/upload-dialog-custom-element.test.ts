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
 * 3. Dialog open/close behavior (when trigger clicked, dialog appended to body)
 * 4. Escape key and backdrop click close the dialog
 */

import { assertEquals, assertExists } from "@std/assert";

// ============================================================================
// MOCK STATE
// ============================================================================

let templateHTML = "";
const shadowRootAppendChildCalls: unknown[] = [];
let mockTriggerButton: Partial<HTMLButtonElement> | null = null;
let triggerClickHandler: (() => void) | null = null;
let documentKeydownHandler: ((e: KeyboardEvent) => void) | null = null;
let bodyAppendChildCalls: unknown[] = [];
let bodyRemoveChildCalls: unknown[] = [];
let containerClickHandler: ((e: { target: unknown }) => void) | null = null;

/** File input mock for regression test: FormData must be built before disabling. */
let mockFileInput: {
  disabled: boolean;
  files: File[];
  addEventListener: () => void;
} | null = null;

/** Form mock for regression test: stores submit handler. */
let mockFormWithSubmit: {
  _submitHandler: ((e: Event) => void) | null;
  querySelector: (sel: string) => unknown;
  addEventListener: (type: string, fn: (e: Event) => void) => void;
  action: string;
} | null = null;

function createMockContainer() {
  const fileInput = {
    disabled: false,
    files: [] as File[],
    addEventListener: () => {},
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

  const container = {
    style: { cssText: "" },
    innerHTML: "",
    parentNode: null as unknown as ParentNode,
    addEventListener: (type: string, fn: (e: { target: unknown }) => void) => {
      if (type === "click") containerClickHandler = fn;
    },
    querySelector: (sel: string) => {
      if (sel === "#upload-form") return form;
      if (sel === "#files") return fileInput;
      if (sel === "#close-btn" || sel === "#submit-btn") return genericNode;
      return null;
    },
  };
  return container;
}

// ============================================================================
// DOM SETUP (must run before importing the element module)
// ============================================================================

function setupDOMEnvironment() {
  triggerClickHandler = null;
  documentKeydownHandler = null;
  containerClickHandler = null;
  bodyAppendChildCalls = [];
  bodyRemoveChildCalls = [];

  mockTriggerButton = {
    id: "trigger",
    addEventListener: (type: string, fn: (e?: Event) => void) => {
      if (type === "click") triggerClickHandler = fn as () => void;
    },
  };

  const mockBody = {
    appendChild: (node: unknown) => {
      bodyAppendChildCalls.push(node);
      (node as { parentNode: unknown }).parentNode = mockBody;
    },
    removeChild: (node: unknown) => {
      bodyRemoveChildCalls.push(node);
    },
    parentNode: null as unknown as ParentNode,
  };

  const mockTemplateContent = {
    cloneNode: (_deep: boolean) => ({
      getElementById: (id: string) =>
        id === "trigger" ? mockTriggerButton : null,
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
          },
          get innerHTML() {
            return templateHTML;
          },
          content: mockTemplateContent,
        } as unknown as HTMLTemplateElement;
      }
      if (tagName === "div") {
        return createMockContainer() as unknown as HTMLDivElement;
      }
      return {} as HTMLElement;
    },
    addEventListener: (type: string, handler: (e: KeyboardEvent) => void) => {
      if (type === "keydown") documentKeydownHandler = handler;
    },
    removeEventListener: (
      _type: string,
      handler: (e: KeyboardEvent) => void,
    ) => {
      if (handler === documentKeydownHandler) documentKeydownHandler = null;
    },
    body: mockBody,
  } as unknown as Document;

  globalThis.HTMLElement = class HTMLElement {
    shadowRoot: ShadowRoot | null = null;

    hasAttribute(_name: string) {
      return false;
    }
    getAttribute(_name: string) {
      return null;
    }

    attachShadow(_init: ShadowRootInit) {
      const shadow = {
        appendChild(child: unknown) {
          shadowRootAppendChildCalls.push(child);
          return child;
        },
        getElementById(id: string) {
          return id === "trigger" ? mockTriggerButton : null;
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

Deno.test("UploadDialogCustomElement - observedAttributes includes class", () => {
  /**
   * Tests that the element observes the class attribute for styling.
   */
  assertEquals(
    UploadDialogCustomElement.observedAttributes.includes("class"),
    true,
  );
});

Deno.test("UploadDialogCustomElement - Escape key closes the dialog", () => {
  /**
   * Tests that pressing Escape while the dialog is open closes it and
   * removes the dialog container from the body.
   */
  bodyAppendChildCalls = [];
  bodyRemoveChildCalls = [];
  const element = new UploadDialogCustomElement();
  element.connectedCallback();
  assertExists(
    triggerClickHandler,
    "trigger click handler should be registered",
  );
  triggerClickHandler!();
  assertExists(
    documentKeydownHandler,
    "keydown handler should be registered when dialog opens",
  );
  assertEquals(
    bodyAppendChildCalls.length,
    1,
    "dialog container should be appended to body",
  );
  documentKeydownHandler!({ key: "Escape" } as KeyboardEvent);
  assertEquals(
    bodyRemoveChildCalls.length,
    1,
    "dialog container should be removed from body on Escape",
  );
});

Deno.test("UploadDialogCustomElement - backdrop click closes the dialog", () => {
  /**
   * Tests that clicking the backdrop (container) while the dialog is open
   * closes it and removes the dialog container from the body.
   */
  bodyAppendChildCalls = [];
  bodyRemoveChildCalls = [];
  const element = new UploadDialogCustomElement();
  element.connectedCallback();
  assertExists(
    triggerClickHandler,
    "trigger click handler should be registered",
  );
  triggerClickHandler!();
  assertExists(
    containerClickHandler,
    "container click handler should be registered when dialog opens",
  );
  assertEquals(
    bodyAppendChildCalls.length,
    1,
    "dialog container should be appended to body",
  );
  const container = bodyAppendChildCalls[0];
  containerClickHandler!({ target: container });
  assertEquals(
    bodyRemoveChildCalls.length,
    1,
    "dialog container should be removed from body on backdrop click",
  );
});

Deno.test(
  "UploadDialogCustomElement - regression: FormData is built before file input is disabled so fetch receives files",
  async () => {
    /**
     * Regression test for upload 400 "No files provided". The client must
     * build FormData(form) before setting fileInput.disabled = true, because
     * disabled form controls are omitted from FormData.
     */
    interface BodyWithGetAll {
      getAll(k: string): File[];
    }
    let capturedBody: BodyWithGetAll | null = null;
    const OriginalFormData = globalThis.FormData;
    const OriginalFetch = globalThis.fetch;

    class MockFormData {
      constructor(form: unknown) {
        const f = form as {
          querySelector: (s: string) => { disabled: boolean; files: File[] };
        };
        const input = f.querySelector("#files");
        const disabled = input?.disabled ?? true;
        const files = input?.files ?? [];
        const list = Array.isArray(files) ? files : [...files];
        (this as unknown as { _getAll: (k: string) => File[] })._getAll = (
          k: string,
        ) => (k === "files" && !disabled ? list : []);
      }
      getAll(k: string): File[] {
        return (this as unknown as { _getAll: (k: string) => File[] })._getAll(
          k,
        );
      }
    }
    (globalThis as { FormData: typeof FormData }).FormData =
      MockFormData as unknown as typeof FormData;

    (globalThis as { fetch: typeof fetch }).fetch = function (
      _url: unknown,
      init?: RequestInit,
    ) {
      capturedBody = (init?.body as BodyWithGetAll) ?? null;
      return Promise.resolve(
        new Response(null, { status: 303, headers: { Location: "/" } }),
      );
    };

    bodyAppendChildCalls = [];
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
    mockFileInput.disabled = false;
    await mockFormWithSubmit!._submitHandler!({
      preventDefault: () => {},
    } as Event);

    assertExists(
      capturedBody,
      "fetch should be called with body",
    );
    const body = capturedBody as BodyWithGetAll;
    assertEquals(
      body.getAll("files").length,
      1,
      "FormData passed to fetch must include files (build FormData before disabling file input)",
    );

    (globalThis as { FormData: typeof FormData }).FormData = OriginalFormData;
    (globalThis as { fetch: typeof fetch }).fetch = OriginalFetch;
  },
);
