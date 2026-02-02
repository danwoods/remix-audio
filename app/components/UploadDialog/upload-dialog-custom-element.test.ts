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

function createMockContainer() {
  const container = {
    style: { cssText: "" },
    innerHTML: "",
    parentNode: null as unknown as ParentNode,
    addEventListener: (type: string, fn: (e: { target: unknown }) => void) => {
      if (type === "click") containerClickHandler = fn;
    },
    querySelector: (sel: string) => {
      const node = {
        addEventListener: () => {},
        disabled: false,
        classList: { toggle: () => {} },
        innerHTML: "",
      };
      return sel === "#upload-form" || sel === "#close-btn" ||
          sel === "#files" || sel === "#submit-btn"
        ? node
        : null;
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
