# Component Testing

This document describes the component unit testing setup for AI agents creating
or refactoring component tests in this codebase.

## Overview

- **Framework**: Deno's built-in test runner
- **Shared utilities**: [`test.utils.ts`](./test.utils.ts) —
  `parseHtmlFragment`, `createLinkedomEnv`, `wireLinkedomToGlobal`,
  `createCustomElement`
- **DOM environment**: [linkedom](https://github.com/WebReflection/linkedom) — a
  real DOM implementation that runs in Deno (no browser required)
- **Assertions**: `@std/assert` (`assertEquals`, `assertExists`, `assert`, etc.)

## Run Tests

```bash
deno task test:components
```

## Two Test Patterns

### 1. Custom Element Tests (`*-custom-element.test.ts`)

Tests for web components that extend `HTMLElement`, use shadow DOM, and respond
to lifecycle callbacks and events.

**Key pattern**: Use linkedom for a real DOM; wire `document`, `window`, and
globals to `globalThis` so the component runs in Deno. Import the element module
**after** `setupDOMEnvironment()` so it sees the mocked environment.

**Structure**:

1. **Linkedom setup** — Use `createLinkedomEnv()` from test.utils (or pass
   custom HTML for e.g. nav/main):
   ```ts
   const { document: linkedomDocument, window: linkedomWindow } =
     createLinkedomEnv();
   ```
2. **`setupDOMEnvironment(options?)`** — Call
   `wireLinkedomToGlobal(linkedomWindow,
   linkedomDocument, options)` plus any
   test-specific patches. Resets DOM state, globals:
   - `document`, `window`, `customElements`, `HTMLElement`
   - `setTimeout`, `clearTimeout`
   - Optionally: `Event`, `CustomEvent`, `DOMParser`, `fetch`, `location`,
     `history`, `sessionStorage`
3. **Create elements via DOM** — Use
   `createCustomElement(doc, "tag-name", attrs)` or `document.createElement` +
   `appendChild` so `connectedCallback` fires:
   ```ts
   const el = createCustomElement(
     linkedomDocument,
     "album-image-custom-element",
     { "data-album-url": "https://..." },
   );
   ```
4. **Import module inside each test** — Ensures the component sees the mocked
   env:
   ```ts
   setupDOMEnvironment();
   await import("./album-image-custom-element.ts");
   const el = createAlbumImage({ "data-album-url": "..." });
   ```
5. **Mock external APIs** — Override `fetch`, `Audio`, etc. via
   `setupDOMEnvironment({ fetch: mockFetch })`.

**Reference tests**: `AlbumImage/album-image-custom-element.test.ts`,
`NavLink/nav-link-custom-element.test.ts`,
`Layout/PlayBar/playbar-custom-element.test.ts`

### 2. HTML Function Tests (`*-html.test.ts`)

Tests for pure functions that return HTML strings (e.g. `albumTileHtml`,
`horizontalRowWithTitleHtml`).

**Key pattern**: Call the function, parse the returned HTML with linkedom, and
assert on DOM structure instead of raw strings.

**Structure**:

1. **`parseHtmlFragment(html)`** — Import from test.utils:
   ```ts
   import { parseHtmlFragment } from "../test.utils.ts";
   const document = parseHtmlFragment(html);
   ```
2. **Assert on DOM** — Use `querySelector`, `getAttribute`, `textContent`,
   `querySelectorAll`, etc.:
   ```ts
   const document = parseHtmlFragment(html);
   const navLink = document.querySelector('nav-link[href="/"]');
   assertExists(navLink);
   assertEquals(navLink?.textContent?.trim(), "Remix Audio");
   ```

**Reference tests**: `AlbumTile/album-tile-html.test.ts`,
`HorizontalRowWithTitle/horizontal-row-with-title-html.test.ts`

## Conventions

| Convention          | Details                                                                                                                       |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Co-location**     | Test file lives next to source: `album-image-custom-element.test.ts` next to `album-image-custom-element.ts`                  |
| **File naming**     | `*-custom-element.test.ts` for custom elements; `*-html.test.ts` for HTML functions                                           |
| **Section headers** | Use `// ============ ... ============` to separate LINKEDOM SETUP, MOCK STATE, DOM SETUP, TEST HELPERS, TESTS                 |
| **Async tests**     | Use `async () => { ... }` when tests await imports or `setTimeout`; `await new Promise(r => setTimeout(r, N))` for async work |
| **State reset**     | Each test should start clean: `setupDOMEnvironment()` clears body and mock state; avoid shared mutable state across tests     |

## Mocking

- **Fetch**: Provide a function via
  `setupDOMEnvironment({ fetch: (input) => Promise.resolve(mockResponse) })`.
  Record calls in an array for assertions.
- **Audio**: linkedom's `createElement("audio")` returns a minimal element;
  patch `play`, `pause`, `currentTime`, `duration`, `paused`, etc. on top (see
  PlayBar tests).
- **MediaMetadata**: Polyfill `globalThis.MediaMetadata` if the component uses
  the Media Session API.
- **Location/History**: Override via
  `setupDOMEnvironment({ location, history })` for nav/fragment tests.

## Coverage Expectations

- Custom elements: lifecycle (connect/disconnect), observed attributes, events,
  DOM structure, cleanup
- HTML functions: structure (elements, classes), content, XSS escaping where
  user input is rendered
