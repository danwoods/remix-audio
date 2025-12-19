# Custom Elements Pattern

This document describes the standard pattern for creating custom elements in
this project.

## Pattern Overview

All custom elements should follow this structure:

1. **Template Definition** - Create a template element with encapsulated styles
   and HTML
2. **Shadow Root** - Use shadow DOM to encapsulate styles and content
3. **Class Definition** - Extend `HTMLElement` and initialize shadow root in
   constructor
4. **Registration** - Register the custom element with `customElements.define()`

## Standard Structure

````typescript
/** @file Custom element for [description] */

// TEMPLATE ///////////////////////////////////////////////////////////////////

const template = document.createElement("template");

template.innerHTML = `
  <style>
    /* Encapsulated styles */
    svg {
      display: block;
      width: 100%;
      height: 100%;
    }
  </style>
  <!-- HTML content -->
  <svg>...</svg>
`;

// ELEMENT ////////////////////////////////////////////////////////////////////

/**
 * Custom element that [description].
 *
 * @customElement element-name
 *
 * @example
 * ```html
 * <element-name></element-name>
 * ```
 *
 * @remarks
 * Additional notes about usage, styling, or behavior.
 */
export class ElementNameCustomElement extends HTMLElement {
  static observedAttributes = ["data-attribute"]; // Optional

  constructor() {
    super();

    // Create shadow root in constructor to encapsulate styles
    this.attachShadow({ mode: "open" });

    // Clone the template content and append it to the shadow root
    this.shadowRoot!.appendChild(template.content.cloneNode(true));
  }

  connectedCallback() {
    // Optional: initialization logic
  }

  disconnectedCallback() {
    // Optional: cleanup logic
  }

  attributeChangedCallback(
    name: string,
    _oldValue: string | null,
    _newValue: string | null,
  ) {
    // Optional: handle attribute changes
  }
}

customElements.define("element-name", ElementNameCustomElement);
````

## Key Points

1. **Template Section**:
   - Define template outside the class
   - Include `<style>` tags for encapsulated CSS
   - Include HTML content (SVG, elements, etc.)

2. **Shadow Root**:
   - Always create shadow root in constructor:
     `this.attachShadow({ mode: "open" })`
   - Clone template content:
     `this.shadowRoot!.appendChild(template.content.cloneNode(true))`
   - This ensures styles and content are encapsulated

3. **Class Naming**:
   - Class name: `[ElementName]CustomElement` (PascalCase)
   - Element name: `[element-name]` (kebab-case)
   - Example: `PlayIconCustomElement` → `<play-icon>`

4. **File Organization**:
   - Custom elements go in `app/components/` or `app/icons/`
   - File naming: `[element-name]-custom-element.ts` or `index.ts` for icons
   - Register in `app/components/register-custom-elements.ts` if needed globally

## Examples

### Simple Icon Element

See: `app/icons/play/index.ts`

### Complex Component Element

See: `app/components/AlbumImage/album-image-custom-element.ts`

## Benefits

- **Style Encapsulation**: Shadow DOM prevents style conflicts
- **Reusability**: Self-contained components can be used anywhere
- **Maintainability**: Clear structure makes code easy to understand
- **Consistency**: All custom elements follow the same pattern
