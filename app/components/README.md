# Component Testing

This document describes the component unit testing setup for AI agents creating
or refactoring component tests in this codebase.

## Overview

- **Framework**: Deno's built-in test runner
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

1. **Linkedom setup** — Create a linkedom document/window once (reused across
   tests):
   ```ts
   const { document: linkedomDocument, window: linkedomWindow } = parseHTML(
     `<!DOCTYPE html><html><head></head><body></body></html>`,
     "http://localhost:8000/",
   );
   ```
2. **`setupDOMEnvironment(options?)`** — Resets DOM state, clears `body`, wires
   globals:
   - `document`, `window`, `customElements`, `HTMLElement`
   - `setTimeout`, `clearTimeout`
   - Optionally: `Event`, `CustomEvent`, `DOMParser`, `fetch`, `location`,
     `history`, `sessionStorage`
3. **Create elements via DOM** — Use `document.createElement("tag-name")` and
   `appendChild` so `connectedCallback` fires naturally:
   ```ts
   const el = linkedomDocument.createElement("album-image-custom-element");
   el.setAttribute("data-album-url", "https://...");
   linkedomDocument.body.appendChild(el);
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
`appBarHtml`, `horizontalRowWithTitleHtml`).

**Key pattern**: Call the function, parse the returned HTML with linkedom, and
assert on DOM structure instead of raw strings.

**Structure**:

1. **`parseHtmlFragment(html)`** — Wrap HTML in a full document and parse:
   ```ts
   function parseHtmlFragment(html: string): Document {
     const { document } = parseHTML(
       `<!DOCTYPE html><html><head></head><body>${html}</body></html>`,
       "http://localhost:8000/",
     );
     return document;
   }
   ```
2. **Assert on DOM** — Use `querySelector`, `getAttribute`, `textContent`,
   `querySelectorAll`, etc.:
   ```ts
   const document = parseHtmlFragment(html);
   const navLink = document.querySelector('nav-link[href="/"]');
   assertExists(navLink);
   assertEquals(navLink?.textContent?.trim(), "Remix Audio");
   ```

**Reference tests**: `AppBar/app-bar-html.test.ts`,
`AlbumTile/album-tile-html.test.ts`,
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
