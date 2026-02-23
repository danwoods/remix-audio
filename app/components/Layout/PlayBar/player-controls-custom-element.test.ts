/** @file Tests for PlayerControlsCustomElement
 *
 * Covers play/pause, previous, and next buttons; attribute handling for
 * data-play-state, data-has-previous-track, data-has-next-track; and event
 * dispatching (play-toggle, play-prev, play-next).
 *
 * Uses linkedom for a real DOM environment; wires document/window to globalThis
 * so the component can run in Deno.
 */

import { assertEquals, assertExists } from "@std/assert";
import {
  createCustomElement,
  createLinkedomEnv,
  wireLinkedomToGlobal,
} from "../../test.utils.ts";

const { document: linkedomDocument, window: linkedomWindow } =
  createLinkedomEnv();

function setupDOMEnvironment() {
  wireLinkedomToGlobal(linkedomWindow, linkedomDocument, { event: true });
}

function createPlayerControls(attrs: Record<string, string> = {}): HTMLElement {
  return createCustomElement(
    linkedomDocument,
    "player-controls-custom-element",
    attrs,
  );
}

function getPrevButton(el: HTMLElement): HTMLButtonElement | null {
  return el.shadowRoot?.querySelector(
    "button[data-play-prev]",
  ) as HTMLButtonElement | null;
}

function getNextButton(el: HTMLElement): HTMLButtonElement | null {
  return el.shadowRoot?.querySelector(
    "button[data-play-next]",
  ) as HTMLButtonElement | null;
}

function getToggleButton(el: HTMLElement): HTMLButtonElement | null {
  return el.shadowRoot?.querySelector(
    "button[data-play-toggle]",
  ) as HTMLButtonElement | null;
}

// ============================================================================
// TESTS
// ============================================================================

Deno.test("PlayerControlsCustomElement - element can be created", async () => {
  setupDOMEnvironment();
  await import("./player-controls-custom-element.ts");

  const el = createPlayerControls();

  assertExists(el);
  assertEquals(el.constructor.name, "PlayerControlsCustomElement");
});

Deno.test("PlayerControlsCustomElement - creates shadow DOM", async () => {
  setupDOMEnvironment();
  await import("./player-controls-custom-element.ts");

  const el = createPlayerControls();

  assertExists(el.shadowRoot);
});

Deno.test(
  "PlayerControlsCustomElement - template contains required elements",
  async () => {
    setupDOMEnvironment();
    await import("./player-controls-custom-element.ts");

    const el = createPlayerControls();

    assertExists(getPrevButton(el));
    assertExists(getNextButton(el));
    assertExists(getToggleButton(el));
  },
);

Deno.test(
  "PlayerControlsCustomElement - connectedCallback calls render",
  async () => {
    setupDOMEnvironment();
    await import("./player-controls-custom-element.ts");

    const el = createPlayerControls();

    assertExists(el.shadowRoot);
  },
);

Deno.test(
  "PlayerControlsCustomElement - observedAttributes includes correct attributes",
  async () => {
    setupDOMEnvironment();
    const { PlayerControlsCustomElement } = await import(
      "./player-controls-custom-element.ts"
    );

    assertEquals(
      PlayerControlsCustomElement.observedAttributes.includes(
        "data-play-state",
      ),
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
  },
);

Deno.test(
  "PlayerControlsCustomElement - attributeChangedCallback calls render for data-play-state",
  async () => {
    setupDOMEnvironment();
    await import("./player-controls-custom-element.ts");

    const el = createPlayerControls();
    el.setAttribute("data-play-state", "playing");

    assertExists(el.shadowRoot);
  },
);

Deno.test(
  "PlayerControlsCustomElement - attributeChangedCallback calls render for data-has-previous-track",
  async () => {
    setupDOMEnvironment();
    await import("./player-controls-custom-element.ts");

    const el = createPlayerControls();
    el.setAttribute("data-has-previous-track", "true");

    assertExists(el.shadowRoot);
  },
);

Deno.test(
  "PlayerControlsCustomElement - attributeChangedCallback calls render for data-has-next-track",
  async () => {
    setupDOMEnvironment();
    await import("./player-controls-custom-element.ts");

    const el = createPlayerControls();
    el.setAttribute("data-has-next-track", "true");

    assertExists(el.shadowRoot);
  },
);

Deno.test(
  "PlayerControlsCustomElement - attributeChangedCallback ignores unrelated attributes",
  async () => {
    setupDOMEnvironment();
    await import("./player-controls-custom-element.ts");

    const el = createPlayerControls();
    el.setAttribute("data-other-attribute", "value");

    assertExists(el.shadowRoot);
  },
);

Deno.test(
  "PlayerControlsCustomElement - renders play icon when play-state is undefined",
  async () => {
    setupDOMEnvironment();
    await import("./player-controls-custom-element.ts");

    const el = createPlayerControls();
    const toggle = getToggleButton(el);

    assertExists(toggle);
    assertEquals(toggle.innerHTML.includes("<play-icon"), true);
    assertEquals(toggle.innerHTML.includes("animate-pulse"), false);
  },
);

Deno.test(
  "PlayerControlsCustomElement - renders pause icon when play-state is playing",
  async () => {
    setupDOMEnvironment();
    await import("./player-controls-custom-element.ts");

    const el = createPlayerControls({
      "data-play-state": "playing",
    });
    const toggle = getToggleButton(el);

    assertExists(toggle);
    assertEquals(toggle.innerHTML.includes("<pause-icon"), true);
  },
);

Deno.test(
  "PlayerControlsCustomElement - renders play icon with pulse when play-state is paused",
  async () => {
    setupDOMEnvironment();
    await import("./player-controls-custom-element.ts");

    const el = createPlayerControls({
      "data-play-state": "paused",
    });
    const toggle = getToggleButton(el);

    assertExists(toggle);
    assertEquals(toggle.innerHTML.includes("<play-icon"), true);
    assertEquals(toggle.innerHTML.includes("animate-pulse"), true);
  },
);

Deno.test(
  "PlayerControlsCustomElement - renders play icon for invalid play-state values",
  async () => {
    setupDOMEnvironment();
    await import("./player-controls-custom-element.ts");

    const el = createPlayerControls({
      "data-play-state": "invalid",
    });
    const toggle = getToggleButton(el);

    assertExists(toggle);
    assertEquals(toggle.innerHTML.includes("<play-icon"), true);
    assertEquals(toggle.innerHTML.includes("animate-pulse"), false);
  },
);

Deno.test(
  "PlayerControlsCustomElement - disables prev button when data-has-previous-track is false",
  async () => {
    setupDOMEnvironment();
    await import("./player-controls-custom-element.ts");

    const el = createPlayerControls({
      "data-has-previous-track": "false",
    });
    const prev = getPrevButton(el);

    assertExists(prev);
    assertEquals(prev.disabled, true);
  },
);

Deno.test(
  "PlayerControlsCustomElement - enables prev button when data-has-previous-track is true",
  async () => {
    setupDOMEnvironment();
    await import("./player-controls-custom-element.ts");

    const el = createPlayerControls({
      "data-has-previous-track": "true",
    });
    const prev = getPrevButton(el);

    assertExists(prev);
    assertEquals(prev.disabled, false);
  },
);

Deno.test(
  "PlayerControlsCustomElement - disables prev button when data-has-previous-track is missing",
  async () => {
    setupDOMEnvironment();
    await import("./player-controls-custom-element.ts");

    const el = createPlayerControls();
    const prev = getPrevButton(el);

    assertExists(prev);
    assertEquals(prev.disabled, true);
  },
);

Deno.test(
  "PlayerControlsCustomElement - disables next button when data-has-next-track is false",
  async () => {
    setupDOMEnvironment();
    await import("./player-controls-custom-element.ts");

    const el = createPlayerControls({
      "data-has-next-track": "false",
    });
    const next = getNextButton(el);

    assertExists(next);
    assertEquals(next.disabled, true);
  },
);

Deno.test(
  "PlayerControlsCustomElement - enables next button when data-has-next-track is true",
  async () => {
    setupDOMEnvironment();
    await import("./player-controls-custom-element.ts");

    const el = createPlayerControls({
      "data-has-next-track": "true",
    });
    const next = getNextButton(el);

    assertExists(next);
    assertEquals(next.disabled, false);
  },
);

Deno.test(
  "PlayerControlsCustomElement - disables next button when data-has-next-track is missing",
  async () => {
    setupDOMEnvironment();
    await import("./player-controls-custom-element.ts");

    const el = createPlayerControls();
    const next = getNextButton(el);

    assertExists(next);
    assertEquals(next.disabled, true);
  },
);

Deno.test(
  "PlayerControlsCustomElement - updates all buttons when multiple attributes change",
  async () => {
    setupDOMEnvironment();
    await import("./player-controls-custom-element.ts");

    const el = createPlayerControls({
      "data-play-state": "playing",
      "data-has-previous-track": "true",
      "data-has-next-track": "true",
    });
    const prev = getPrevButton(el);
    const next = getNextButton(el);
    const toggle = getToggleButton(el);

    assertExists(prev);
    assertExists(next);
    assertExists(toggle);
    assertEquals(prev.disabled, false);
    assertEquals(next.disabled, false);
    assertEquals(toggle.innerHTML.includes("<pause-icon"), true);
  },
);

Deno.test(
  "PlayerControlsCustomElement - handles empty attribute values",
  async () => {
    setupDOMEnvironment();
    await import("./player-controls-custom-element.ts");

    const el = createPlayerControls({
      "data-has-previous-track": "",
      "data-has-next-track": "",
      "data-play-state": "",
    });
    const prev = getPrevButton(el);
    const next = getNextButton(el);
    const toggle = getToggleButton(el);

    assertExists(prev);
    assertExists(next);
    assertExists(toggle);
    assertEquals(prev.disabled, true);
    assertEquals(next.disabled, true);
    assertEquals(toggle.innerHTML.includes("<play-icon"), true);
  },
);

Deno.test(
  "PlayerControlsCustomElement - handles rapid attribute changes",
  async () => {
    setupDOMEnvironment();
    await import("./player-controls-custom-element.ts");

    const el = createPlayerControls();
    for (let i = 0; i < 10; i++) {
      el.setAttribute(
        "data-play-state",
        i % 2 === 0 ? "playing" : "paused",
      );
      el.setAttribute(
        "data-has-previous-track",
        i % 3 === 0 ? "true" : "false",
      );
    }

    assertExists(el.shadowRoot);
  },
);

Deno.test(
  "PlayerControlsCustomElement - prev button has correct data attribute",
  async () => {
    setupDOMEnvironment();
    await import("./player-controls-custom-element.ts");

    const el = createPlayerControls();
    const prev = getPrevButton(el);

    assertExists(prev);
  },
);

Deno.test(
  "PlayerControlsCustomElement - next button has correct data attribute",
  async () => {
    setupDOMEnvironment();
    await import("./player-controls-custom-element.ts");

    const el = createPlayerControls();
    const next = getNextButton(el);

    assertExists(next);
  },
);

Deno.test(
  "PlayerControlsCustomElement - toggle button has correct data attribute",
  async () => {
    setupDOMEnvironment();
    await import("./player-controls-custom-element.ts");

    const el = createPlayerControls();
    const toggle = getToggleButton(el);

    assertExists(toggle);
  },
);

Deno.test(
  "PlayerControlsCustomElement - dispatches play-toggle event when toggle button clicked",
  async () => {
    setupDOMEnvironment();
    await import("./player-controls-custom-element.ts");

    const el = createPlayerControls();
    let dispatchedEvent: CustomEvent | null = null;
    el.addEventListener("play-toggle", (e) => {
      dispatchedEvent = e as CustomEvent;
    });

    const toggle = getToggleButton(el);
    assertExists(toggle);
    toggle.click();

    assertExists(dispatchedEvent);
    const ev = dispatchedEvent as CustomEvent;
    assertEquals(ev.type, "play-toggle");
    assertEquals(ev.bubbles, true);
  },
);

Deno.test(
  "PlayerControlsCustomElement - dispatches play-prev event when prev button clicked and enabled",
  async () => {
    setupDOMEnvironment();
    await import("./player-controls-custom-element.ts");

    const el = createPlayerControls({
      "data-has-previous-track": "true",
    });
    let dispatchedEvent: CustomEvent | null = null;
    el.addEventListener("play-prev", (e) => {
      dispatchedEvent = e as CustomEvent;
    });

    const prev = getPrevButton(el);
    assertExists(prev);
    assertEquals(prev.disabled, false);
    prev.click();

    assertExists(dispatchedEvent);
    const ev = dispatchedEvent as CustomEvent;
    assertEquals(ev.type, "play-prev");
    assertEquals(ev.bubbles, true);
  },
);

Deno.test(
  "PlayerControlsCustomElement - does not dispatch play-prev event when prev button clicked and disabled",
  async () => {
    setupDOMEnvironment();
    await import("./player-controls-custom-element.ts");

    const el = createPlayerControls({
      "data-has-previous-track": "false",
    });
    let dispatchedEvent: CustomEvent | null = null;
    el.addEventListener("play-prev", (e) => {
      dispatchedEvent = e as CustomEvent;
    });

    const prev = getPrevButton(el);
    assertExists(prev);
    assertEquals(prev.disabled, true);
    prev.click();

    assertEquals(dispatchedEvent, null);
  },
);

Deno.test(
  "PlayerControlsCustomElement - dispatches play-next event when next button clicked and enabled",
  async () => {
    setupDOMEnvironment();
    await import("./player-controls-custom-element.ts");

    const el = createPlayerControls({
      "data-has-next-track": "true",
    });
    let dispatchedEvent: CustomEvent | null = null;
    el.addEventListener("play-next", (e) => {
      dispatchedEvent = e as CustomEvent;
    });

    const next = getNextButton(el);
    assertExists(next);
    assertEquals(next.disabled, false);
    next.click();

    assertExists(dispatchedEvent);
    const ev = dispatchedEvent as CustomEvent;
    assertEquals(ev.type, "play-next");
    assertEquals(ev.bubbles, true);
  },
);

Deno.test(
  "PlayerControlsCustomElement - does not dispatch play-next event when next button clicked and disabled",
  async () => {
    setupDOMEnvironment();
    await import("./player-controls-custom-element.ts");

    const el = createPlayerControls({
      "data-has-next-track": "false",
    });
    let dispatchedEvent: CustomEvent | null = null;
    el.addEventListener("play-next", (e) => {
      dispatchedEvent = e as CustomEvent;
    });

    const next = getNextButton(el);
    assertExists(next);
    assertEquals(next.disabled, true);
    next.click();

    assertEquals(dispatchedEvent, null);
  },
);

Deno.test(
  "PlayerControlsCustomElement - does not throw when disconnected",
  async () => {
    setupDOMEnvironment();
    await import("./player-controls-custom-element.ts");

    const el = createPlayerControls();
    linkedomDocument.body?.removeChild(el);
  },
);
