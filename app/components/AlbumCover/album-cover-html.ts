import type { Files } from "../../util/files.ts";

/**
 * Props for the album cover HTML function
 */
export interface AlbumCoverProps {
  albumId: string;
  className?: string;
  alt?: string;
  files?: Files;
  src: string | null;
  placeholder?: string;
}

/**
 * Escape HTML special characters to prevent XSS
 */
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Generate HTML string for album cover image
 *
 * Returns HTML img string. If the image fails to load, it will fallback to the placeholder.
 *
 * @param props - Album cover properties
 * @returns HTML string for an img element
 *
 * @example
 * ```ts
 * const html = albumCoverHtml({
 *   className: "w-32 h-32",
 *   alt: "Album cover",
 *   src: "https://example.com/image.jpg",
 *   placeholder: "https://placehold.co/100x100?text=."
 * });
 * ```
 */
export default function albumCoverHtml(props: AlbumCoverProps): string {
  const {
    className = "",
    alt = "album art",
    src,
    placeholder = "https://placehold.co/100x100?text=.",
  } = props;

  const classAttr = className ? ` class="${escapeHtml(className)}"` : "";
  const altAttr = ` alt="${escapeHtml(alt)}"`;

  // Use src if provided, otherwise use placeholder (or default)
  const imageSrc = src || placeholder;
  const srcAttr = ` src="${escapeHtml(imageSrc)}"`;

  // Add onerror handler to fallback to placeholder if image fails to load
  // Only add if we have a src that's different from placeholder to avoid infinite loops
  let onerrorAttr = "";
  if (src && src !== placeholder) {
    const escapedPlaceholder = escapeHtml(placeholder);
    // Set onerror to replace src with placeholder, then nullify onerror to prevent loops
    onerrorAttr =
      ` onerror="this.onerror=null;this.src='${escapedPlaceholder}'"`;
  }

  return `<img${classAttr}${altAttr}${srcAttr}${onerrorAttr} />`;
}
