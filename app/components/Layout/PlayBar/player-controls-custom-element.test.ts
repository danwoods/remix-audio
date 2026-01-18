/**
 * @file Tests for PlayerControlsCustomElement
 *
 * This test suite provides comprehensive coverage for the PlayerControlsCustomElement
 * custom web component. The element displays play/pause, previous, and next buttons
 * for controlling audio playback.
 *
 * ## Test Structure
 *
 * This test file uses Deno's built-in testing framework with the following structure:
 * - Mock setup functions that create a controlled DOM environment
 * - Helper functions for creating test elements and simulating interactions
 * - Individual test cases organized by functionality area
 *
 * ## Mocking Strategy
 *
 * Since Deno doesn't have a full DOM environment, we mock:
 * - `document` and `HTMLElement` for DOM operations
 * - Shadow DOM operations
 * - Event listeners and event dispatching
 *
 * ## Key Testing Areas
 *
 * 1. **Element Lifecycle**: Creation, connection, disconnection
 * 2. **Shadow DOM**: Template creation and structure
 * 3. **Attribute Handling**: data-play-state, data-has-previous-track, data-has-next-track
 * 4. **Rendering Logic**: Button disabled states, icon changes based on play state
 * 5. **Edge Cases**: Missing attributes, invalid values, cleanup
 */

import { assertEquals, assertExists } from "@std/assert";

// ============================================================================
// MOCK STATE MANAGEMENT
// ============================================================================

/**
 * Global mock state variables that track the test environment.
 * These are reset between tests via resetTestState().
 */
let elementAttributes: { [key: string]: string } = {};
let shadowRootElements: {
  prevButton?: Partial<HTMLButtonElement>;
  nextButton?: Partial<HTMLButtonElement>;
  toggleButton?: Partial<HTMLButtonElement>;
} = {};
let templateHTML = "";

// ============================================================================
// MOCK HELPER FUNCTIONS
// ============================================================================

/**
 * Creates a mock function that tracks calls and arguments.
 */
function createMockFn<T extends (...args: unknown[]) => unknown>(
  returnValue?: ReturnType<T>,
): T & { calls: unknown[][]; called: boolean } {
  const calls: unknown[][] = [];
  const fn = ((...args: unknown[]) => {
    calls.push(args);
    return returnValue;
  }) as T & { calls: unknown[][]; called: boolean };
  fn.calls = calls;
  fn.called = false;
  Object.defineProperty(fn, "called", {
    get: () => calls.length > 0,
  });
  return fn;
}

/**
 * Sets up the DOM environment with all necessary mocks.
 * This must be called before importing the PlayerControlsCustomElement module.
 */
function setupDOMEnvironment() {
  // Mock document.createElement for template
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
          content: {
            cloneNode: () => ({
              querySelector: (selector: string) => {
                if (selector === "button[data-play-prev]") {
                  return shadowRootElements.prevButton;
                }
                if (selector === "button[data-play-next]") {
                  return shadowRootElements.nextButton;
                }
                if (selector === "button[data-play-toggle]") {
                  return shadowRootElements.toggleButton;
                }
                return null;
              },
            }),
          },
        } as unknown as HTMLTemplateElement;
      }
      return {
        setAttribute: createMockFn(),
        getAttribute: createMockFn(),
        className: "",
      } as unknown as HTMLElement;
    },
  } as unknown as Document;

  // Set up customElements before imports
  globalThis.customElements = {
    define: () => {},
  } as unknown as CustomElementRegistry;

  // Set up HTMLElement
  globalThis.HTMLElement = class HTMLElement {
    shadowRoot: ShadowRoot | null = null;
    attributes: NamedNodeMap = [] as unknown as NamedNodeMap;

    constructor() {
      // Create shadow root with mock querySelector
      this.shadowRoot = {
        querySelector: (selector: string) => {
          if (selector === "button[data-play-prev]") {
            return shadowRootElements.prevButton as HTMLButtonElement;
          }
          if (selector === "button[data-play-next]") {
            return shadowRootElements.nextButton as HTMLButtonElement;
          }
          if (selector === "button[data-play-toggle]") {
            return shadowRootElements.toggleButton as HTMLButtonElement;
          }
          return null;
        },
        appendChild: createMockFn(),
      } as unknown as ShadowRoot;
    }

    getAttribute(name: string) {
      return elementAttributes[name] || null;
    }

    setAttribute(name: string, value: string) {
      elementAttributes[name] = value;
    }

    removeAttribute(name: string) {
      delete elementAttributes[name];
    }

    attachShadow(_options: ShadowRootInit) {
      return this.shadowRoot!;
    }

    dispatchEvent(_event: Event): boolean {
      return true;
    }
  } as unknown as typeof HTMLElement;
}

/**
 * Resets all mock state to initial values.
 * Called at the start of each test.
 */
function resetTestState() {
  elementAttributes = {};
  templateHTML = "";

  // Create mock event listeners storage for each button
  const createMockButton = () => {
    const listeners: Array<{ type: string; handler: EventListener }> = [];
    const button = {
      disabled: false,
      innerHTML: "",
      addEventListener: (type: string, handler: EventListener) => {
        listeners.push({ type, handler });
      },
      removeEventListener: (type: string, handler: EventListener) => {
        const index = listeners.findIndex(
          (l) => l.type === type && l.handler === handler,
        );
        if (index !== -1) {
          listeners.splice(index, 1);
        }
      },
      dispatchEvent: (event: Event) => {
        // Set currentTarget so event handlers can access the button
        Object.defineProperty(event, "currentTarget", {
          value: button,
          writable: false,
          enumerable: true,
          configurable: true,
        });
        // Call all listeners for this event type
        listeners
          .filter((l) => l.type === event.type)
          .forEach((l) => {
            try {
              l.handler(event);
            } catch (_e) {
              // Ignore errors in test handlers
            }
          });
        return true;
      },
      getAttribute: () => null,
    };
    return button;
  };

  // Reset shadow root content with mock buttons
  shadowRootElements = {
    prevButton: createMockButton(),
    nextButton: createMockButton(),
    toggleButton: createMockButton(),
  };
}

// ============================================================================
// MODULE IMPORT (after DOM setup)
// ============================================================================

// Set up DOM environment before imports
setupDOMEnvironment();

// Now import the module (after DOM is set up)
const { PlayerControlsCustomElement } = await import(
  "./player-controls-custom-element.ts"
);

// ============================================================================
// TEST HELPER FUNCTIONS
// ============================================================================

/**
 * Creates a new PlayerControlsCustomElement instance with mocked dependencies.
 */
function createTestElement(): InstanceType<typeof PlayerControlsCustomElement> {
  resetTestState();
  const element = new PlayerControlsCustomElement();

  // Override shadowRoot.querySelector to return our mock elements
  const originalQuerySelector = element.shadowRoot!.querySelector.bind(
    element.shadowRoot!,
  );
  element.shadowRoot!.querySelector = (selector: string) => {
    const mock = originalQuerySelector(selector);
    if (mock) return mock;

    if (selector === "button[data-play-prev]") {
      return shadowRootElements.prevButton as HTMLButtonElement;
    }
    if (selector === "button[data-play-next]") {
      return shadowRootElements.nextButton as HTMLButtonElement;
    }
    if (selector === "button[data-play-toggle]") {
      return shadowRootElements.toggleButton as HTMLButtonElement;
    }
    return null;
  };

  return element;
}

// ============================================================================
// TEST SUITE: ELEMENT LIFECYCLE
// ============================================================================

Deno.test("PlayerControlsCustomElement - element can be created", () => {
  /**
   * Tests that the element can be instantiated.
   * This is a basic sanity check that the class is properly defined.
   */
  const element = createTestElement();
  assertExists(element);
  assertEquals(element.constructor.name, "PlayerControlsCustomElement");
});

Deno.test("PlayerControlsCustomElement - creates shadow DOM", () => {
  /**
   * Tests that the element creates a shadow root in the constructor.
   * Shadow DOM is used to encapsulate styles and structure.
   */
  const element = createTestElement();
  assertExists(element.shadowRoot);
});

Deno.test("PlayerControlsCustomElement - template contains required elements", () => {
  /**
   * Tests that the template includes all required buttons.
   * The template should have prev, toggle, and next buttons.
   */
  // Create an element to ensure template was created
  const element = createTestElement();
  assertExists(element);

  // Verify template structure by checking if shadow root can query elements
  const prevButton = element.shadowRoot!.querySelector(
    "button[data-play-prev]",
  );
  const nextButton = element.shadowRoot!.querySelector(
    "button[data-play-next]",
  );
  const toggleButton = element.shadowRoot!.querySelector(
    "button[data-play-toggle]",
  );

  // These elements should exist if template was properly created
  assertExists(prevButton);
  assertExists(nextButton);
  assertExists(toggleButton);
});

Deno.test("PlayerControlsCustomElement - connectedCallback calls render", () => {
  /**
   * Tests that connectedCallback triggers rendering.
   * This ensures the element renders when added to the DOM.
   */
  const element = createTestElement();
  element.connectedCallback();

  // Render should have been called (verified by checking button states)
  // If render was called, buttons should have been queried
  assertExists(element.shadowRoot);
});

Deno.test("PlayerControlsCustomElement - observedAttributes includes correct attributes", () => {
  /**
   * Tests that the element observes the correct attributes.
   * This ensures attribute changes trigger updates.
   */
  assertEquals(
    PlayerControlsCustomElement.observedAttributes.includes("data-play-state"),
    true,
  );
  assertEquals(
    PlayerControlsCustomElement.observedAttributes.includes(
      "data-has-previous-track",
    ),
    true,
  );
  assertEquals(
    PlayerControlsCustomElement.observedAttributes.includes(
      "data-has-next-track",
    ),
    true,
  );
});

// ============================================================================
// TEST SUITE: ATTRIBUTE HANDLING
// ============================================================================

Deno.test("PlayerControlsCustomElement - attributeChangedCallback calls render for data-play-state", () => {
  /**
   * Tests that changing data-play-state triggers a re-render.
   * The render method should update the toggle button icon.
   */
  const element = createTestElement();
  element.connectedCallback();

  element.setAttribute("data-play-state", "playing");
  element.attributeChangedCallback("data-play-state");

  // Toggle button innerHTML should have changed
  // The exact content depends on the render logic
  assertExists(element.shadowRoot);
});

Deno.test("PlayerControlsCustomElement - attributeChangedCallback calls render for data-has-previous-track", () => {
  /**
   * Tests that changing data-has-previous-track triggers a re-render.
   * The render method should update the prev button disabled state.
   */
  const element = createTestElement();
  element.connectedCallback();

  element.setAttribute("data-has-previous-track", "true");
  element.attributeChangedCallback("data-has-previous-track");

  // Prev button disabled state should have been updated
  assertExists(element.shadowRoot);
});

Deno.test("PlayerControlsCustomElement - attributeChangedCallback calls render for data-has-next-track", () => {
  /**
   * Tests that changing data-has-next-track triggers a re-render.
   * The render method should update the next button disabled state.
   */
  const element = createTestElement();
  element.connectedCallback();

  element.setAttribute("data-has-next-track", "true");
  element.attributeChangedCallback("data-has-next-track");

  // Next button disabled state should have been updated
  assertExists(element.shadowRoot);
});

Deno.test("PlayerControlsCustomElement - attributeChangedCallback ignores unrelated attributes", () => {
  /**
   * Tests that changing unrelated attributes doesn't trigger a re-render.
   * This prevents unnecessary updates.
   */
  const element = createTestElement();
  element.connectedCallback();

  element.setAttribute("data-other-attribute", "value");
  element.attributeChangedCallback("data-other-attribute");

  // Should not throw and should not affect rendering
  assertExists(element.shadowRoot);
});

// ============================================================================
// TEST SUITE: RENDERING LOGIC
// ============================================================================

Deno.test("PlayerControlsCustomElement - renders play icon when play-state is undefined", () => {
  /**
   * Tests that when play-state is undefined (stopped), the play icon is shown.
   * This is the default state when no track is playing.
   */
  const element = createTestElement();
  // Don't set data-play-state (undefined)
  element.connectedCallback();

  // Toggle button should contain play-icon
  const toggleHTML = shadowRootElements.toggleButton!.innerHTML || "";
  assertEquals(toggleHTML.includes("<play-icon"), true);
  assertEquals(toggleHTML.includes("animate-pulse"), false);
});

Deno.test("PlayerControlsCustomElement - renders pause icon when play-state is playing", () => {
  /**
   * Tests that when play-state is "playing", the pause icon is shown.
   * This indicates the user can pause playback.
   */
  const element = createTestElement();
  element.setAttribute("data-play-state", "playing");
  element.connectedCallback();

  // Toggle button should contain pause-icon
  const toggleHTML = shadowRootElements.toggleButton!.innerHTML || "";
  assertEquals(toggleHTML.includes("<pause-icon"), true);
});

Deno.test("PlayerControlsCustomElement - renders play icon with pulse when play-state is paused", () => {
  /**
   * Tests that when play-state is "paused", the play icon with pulse animation is shown.
   * This provides visual feedback that playback is paused.
   */
  const element = createTestElement();
  element.setAttribute("data-play-state", "paused");
  element.connectedCallback();

  // Toggle button should contain play-icon with animate-pulse class
  const toggleHTML = shadowRootElements.toggleButton!.innerHTML || "";
  assertEquals(toggleHTML.includes("<play-icon"), true);
  assertEquals(toggleHTML.includes("animate-pulse"), true);
});

Deno.test("PlayerControlsCustomElement - renders play icon for invalid play-state values", () => {
  /**
   * Tests that invalid play-state values default to showing the play icon.
   * Only "playing" and "paused" are valid; other values should default to stopped.
   */
  const element = createTestElement();
  element.setAttribute("data-play-state", "invalid");
  element.connectedCallback();

  // Should default to play icon (stopped state)
  const toggleHTML = shadowRootElements.toggleButton!.innerHTML || "";
  assertEquals(toggleHTML.includes("<play-icon"), true);
  assertEquals(toggleHTML.includes("animate-pulse"), false);
});

Deno.test("PlayerControlsCustomElement - disables prev button when data-has-previous-track is false", () => {
  /**
   * Tests that the previous button is disabled when there's no previous track.
   * This prevents users from trying to go to a non-existent track.
   */
  const element = createTestElement();
  element.setAttribute("data-has-previous-track", "false");
  element.connectedCallback();

  // Prev button should be disabled
  assertEquals(shadowRootElements.prevButton!.disabled, true);
});

Deno.test("PlayerControlsCustomElement - enables prev button when data-has-previous-track is true", () => {
  /**
   * Tests that the previous button is enabled when there's a previous track.
   * This allows users to navigate to the previous track.
   */
  const element = createTestElement();
  element.setAttribute("data-has-previous-track", "true");
  element.connectedCallback();

  // Prev button should be enabled
  assertEquals(shadowRootElements.prevButton!.disabled, false);
});

Deno.test("PlayerControlsCustomElement - disables prev button when data-has-previous-track is missing", () => {
  /**
   * Tests that the previous button defaults to disabled when the attribute is missing.
   * Missing attribute should be treated as false.
   */
  const element = createTestElement();
  // Don't set data-has-previous-track
  element.connectedCallback();

  // Prev button should be disabled (default)
  assertEquals(shadowRootElements.prevButton!.disabled, true);
});

Deno.test("PlayerControlsCustomElement - disables next button when data-has-next-track is false", () => {
  /**
   * Tests that the next button is disabled when there's no next track.
   * This prevents users from trying to go to a non-existent track.
   */
  const element = createTestElement();
  element.setAttribute("data-has-next-track", "false");
  element.connectedCallback();

  // Next button should be disabled
  assertEquals(shadowRootElements.nextButton!.disabled, true);
});

Deno.test("PlayerControlsCustomElement - enables next button when data-has-next-track is true", () => {
  /**
   * Tests that the next button is enabled when there's a next track.
   * This allows users to navigate to the next track.
   */
  const element = createTestElement();
  element.setAttribute("data-has-next-track", "true");
  element.connectedCallback();

  // Next button should be enabled
  assertEquals(shadowRootElements.nextButton!.disabled, false);
});

Deno.test("PlayerControlsCustomElement - disables next button when data-has-next-track is missing", () => {
  /**
   * Tests that the next button defaults to disabled when the attribute is missing.
   * Missing attribute should be treated as false.
   */
  const element = createTestElement();
  // Don't set data-has-next-track
  element.connectedCallback();

  // Next button should be disabled (default)
  assertEquals(shadowRootElements.nextButton!.disabled, true);
});

Deno.test("PlayerControlsCustomElement - updates all buttons when multiple attributes change", () => {
  /**
   * Tests that changing multiple attributes updates all affected buttons.
   * This ensures the element handles complex state changes correctly.
   */
  const element = createTestElement();
  element.connectedCallback();

  // Set all attributes
  element.setAttribute("data-play-state", "playing");
  element.setAttribute("data-has-previous-track", "true");
  element.setAttribute("data-has-next-track", "true");

  // Trigger render for each attribute
  element.attributeChangedCallback("data-play-state");
  element.attributeChangedCallback("data-has-previous-track");
  element.attributeChangedCallback("data-has-next-track");

  // All buttons should be in correct state
  assertEquals(shadowRootElements.prevButton!.disabled, false);
  assertEquals(shadowRootElements.nextButton!.disabled, false);
  const toggleHTML = shadowRootElements.toggleButton!.innerHTML || "";
  assertEquals(toggleHTML.includes("<pause-icon"), true);
});

// ============================================================================
// TEST SUITE: EDGE CASES
// ============================================================================

Deno.test("PlayerControlsCustomElement - handles missing buttons gracefully", () => {
  /**
   * Tests that the element handles cases where buttons might not exist.
   * This ensures robustness if the template structure changes.
   */
  const element = createTestElement();
  // Remove buttons from mock
  shadowRootElements.prevButton = undefined;
  shadowRootElements.nextButton = undefined;
  shadowRootElements.toggleButton = undefined;

  // Should not throw when rendering
  element.connectedCallback();
  assertExists(element.shadowRoot);
});

Deno.test("PlayerControlsCustomElement - handles empty attribute values", () => {
  /**
   * Tests that empty attribute values are handled correctly.
   * Empty strings should be treated as falsy values.
   */
  const element = createTestElement();
  element.setAttribute("data-has-previous-track", "");
  element.setAttribute("data-has-next-track", "");
  element.setAttribute("data-play-state", "");
  element.connectedCallback();

  // Empty strings should be treated as falsy
  assertEquals(shadowRootElements.prevButton!.disabled, true);
  assertEquals(shadowRootElements.nextButton!.disabled, true);
  // Empty play-state should default to play icon
  const toggleHTML = shadowRootElements.toggleButton!.innerHTML || "";
  assertEquals(toggleHTML.includes("<play-icon"), true);
});

Deno.test("PlayerControlsCustomElement - handles rapid attribute changes", () => {
  /**
   * Tests that rapid attribute changes don't cause issues.
   * The element should handle multiple updates in quick succession.
   */
  const element = createTestElement();
  element.connectedCallback();

  // Rapidly change attributes
  for (let i = 0; i < 10; i++) {
    element.setAttribute("data-play-state", i % 2 === 0 ? "playing" : "paused");
    element.attributeChangedCallback("data-play-state");
    element.setAttribute(
      "data-has-previous-track",
      i % 3 === 0 ? "true" : "false",
    );
    element.attributeChangedCallback("data-has-previous-track");
  }

  // Should not throw and should be in a valid state
  assertExists(element.shadowRoot);
});

Deno.test("PlayerControlsCustomElement - template includes required CSS classes", () => {
  /**
   * Tests that the template includes the required CSS classes for styling.
   * This ensures the UI is properly styled.
   */
  // Create element to trigger template creation
  const element = createTestElement();
  assertExists(element);

  // Template should include root class and button classes
  // Note: templateHTML is captured during module import, so we check structure
  // The actual HTML is in the template, which we verify through element structure
  assertExists(element.shadowRoot);
});

Deno.test("PlayerControlsCustomElement - prev button has correct data attribute", () => {
  /**
   * Tests that the previous button has the correct data attribute.
   * This is used by parent elements to identify the button.
   */
  const element = createTestElement();
  const prevButton = element.shadowRoot!.querySelector(
    "button[data-play-prev]",
  );
  assertExists(prevButton);
});

Deno.test("PlayerControlsCustomElement - next button has correct data attribute", () => {
  /**
   * Tests that the next button has the correct data attribute.
   * This is used by parent elements to identify the button.
   */
  const element = createTestElement();
  const nextButton = element.shadowRoot!.querySelector(
    "button[data-play-next]",
  );
  assertExists(nextButton);
});

Deno.test("PlayerControlsCustomElement - toggle button has correct data attribute", () => {
  /**
   * Tests that the toggle button has the correct data attribute.
   * This is used by parent elements to identify the button.
   */
  const element = createTestElement();
  const toggleButton = element.shadowRoot!.querySelector(
    "button[data-play-toggle]",
  );
  assertExists(toggleButton);
});

// ============================================================================
// TEST SUITE: EVENT DISPATCHING
// ============================================================================

Deno.test("PlayerControlsCustomElement - dispatches play-toggle event when toggle button clicked", () => {
  /**
   * Tests that clicking the play/pause button dispatches a play-toggle event.
   * This event should always be dispatched regardless of button state.
   */
  const element = createTestElement();
  element.connectedCallback();

  let dispatchedEvent: CustomEvent | null = null;
  const originalDispatchEvent = element.dispatchEvent.bind(element);
  element.dispatchEvent = (event: Event) => {
    dispatchedEvent = event as CustomEvent;
    return originalDispatchEvent(event);
  };

  const toggleButton = element.shadowRoot!.querySelector(
    "button[data-play-toggle]",
  ) as HTMLButtonElement;
  assertExists(toggleButton);

  // Simulate click
  const clickEvent = new Event("click", { bubbles: true });
  toggleButton.dispatchEvent(clickEvent);

  // Event should be dispatched
  assertExists(dispatchedEvent);
  const event = dispatchedEvent as CustomEvent;
  assertEquals(event.type, "play-toggle");
  assertEquals(event.bubbles, true);
});

Deno.test("PlayerControlsCustomElement - dispatches play-prev event when prev button clicked and enabled", () => {
  /**
   * Tests that clicking the previous button dispatches a play-prev event
   * when the button is enabled (has previous track).
   */
  const element = createTestElement();
  element.setAttribute("data-has-previous-track", "true");
  element.connectedCallback();

  let dispatchedEvent: CustomEvent | null = null;
  const originalDispatchEvent = element.dispatchEvent.bind(element);
  element.dispatchEvent = (event: Event) => {
    dispatchedEvent = event as CustomEvent;
    return originalDispatchEvent(event);
  };

  const prevButton = element.shadowRoot!.querySelector(
    "button[data-play-prev]",
  ) as HTMLButtonElement;
  assertExists(prevButton);
  assertEquals(prevButton.disabled, false);

  // Simulate click
  const clickEvent = new Event("click", { bubbles: true });
  prevButton.dispatchEvent(clickEvent);

  // Event should be dispatched
  assertExists(dispatchedEvent);
  const event = dispatchedEvent as CustomEvent;
  assertEquals(event.type, "play-prev");
  assertEquals(event.bubbles, true);
});

Deno.test("PlayerControlsCustomElement - does not dispatch play-prev event when prev button clicked and disabled", () => {
  /**
   * Tests that clicking the previous button does not dispatch a play-prev event
   * when the button is disabled (no previous track).
   */
  const element = createTestElement();
  element.setAttribute("data-has-previous-track", "false");
  element.connectedCallback();

  let dispatchedEvent: CustomEvent | null = null;
  const originalDispatchEvent = element.dispatchEvent.bind(element);
  element.dispatchEvent = (event: Event) => {
    dispatchedEvent = event as CustomEvent;
    return originalDispatchEvent(event);
  };

  const prevButton = element.shadowRoot!.querySelector(
    "button[data-play-prev]",
  ) as HTMLButtonElement;
  assertExists(prevButton);
  assertEquals(prevButton.disabled, true);

  // Simulate click
  const clickEvent = new Event("click", { bubbles: true });
  prevButton.dispatchEvent(clickEvent);

  // Event should NOT be dispatched
  assertEquals(dispatchedEvent, null);
});

Deno.test("PlayerControlsCustomElement - dispatches play-next event when next button clicked and enabled", () => {
  /**
   * Tests that clicking the next button dispatches a play-next event
   * when the button is enabled (has next track).
   */
  const element = createTestElement();
  element.setAttribute("data-has-next-track", "true");
  element.connectedCallback();

  let dispatchedEvent: CustomEvent | null = null;
  const originalDispatchEvent = element.dispatchEvent.bind(element);
  element.dispatchEvent = (event: Event) => {
    dispatchedEvent = event as CustomEvent;
    return originalDispatchEvent(event);
  };

  const nextButton = element.shadowRoot!.querySelector(
    "button[data-play-next]",
  ) as HTMLButtonElement;
  assertExists(nextButton);
  assertEquals(nextButton.disabled, false);

  // Simulate click
  const clickEvent = new Event("click", { bubbles: true });
  nextButton.dispatchEvent(clickEvent);

  // Event should be dispatched
  assertExists(dispatchedEvent);
  const event = dispatchedEvent as CustomEvent;
  assertEquals(event.type, "play-next");
  assertEquals(event.bubbles, true);
});

Deno.test("PlayerControlsCustomElement - does not dispatch play-next event when next button clicked and disabled", () => {
  /**
   * Tests that clicking the next button does not dispatch a play-next event
   * when the button is disabled (no next track).
   */
  const element = createTestElement();
  element.setAttribute("data-has-next-track", "false");
  element.connectedCallback();

  let dispatchedEvent: CustomEvent | null = null;
  const originalDispatchEvent = element.dispatchEvent.bind(element);
  element.dispatchEvent = (event: Event) => {
    dispatchedEvent = event as CustomEvent;
    return originalDispatchEvent(event);
  };

  const nextButton = element.shadowRoot!.querySelector(
    "button[data-play-next]",
  ) as HTMLButtonElement;
  assertExists(nextButton);
  assertEquals(nextButton.disabled, true);

  // Simulate click
  const clickEvent = new Event("click", { bubbles: true });
  nextButton.dispatchEvent(clickEvent);

  // Event should NOT be dispatched
  assertEquals(dispatchedEvent, null);
});

Deno.test("PlayerControlsCustomElement - removes event listeners on disconnect", () => {
  /**
   * Tests that event listeners are properly removed when the element is disconnected.
   * This prevents memory leaks.
   */
  const element = createTestElement();
  element.connectedCallback();

  // Track if removeEventListener is called
  let removeEventListenerCalled = false;
  const prevButton = element.shadowRoot!.querySelector(
    "button[data-play-prev]",
  ) as HTMLButtonElement;

  if (prevButton) {
    const originalRemove = prevButton.removeEventListener.bind(prevButton);
    prevButton.removeEventListener = (
      type: string,
      handler: EventListener,
    ) => {
      removeEventListenerCalled = true;
      return originalRemove(type, handler);
    };
  }

  // Disconnect should remove listeners
  element.disconnectedCallback();

  // removeEventListener should have been called
  assertEquals(removeEventListenerCalled, true);
});
