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
 * Returns HTML immediately with a placeholder. For dynamic loading,
 * use the async version or the custom element.
 *
 * @param props - Album cover properties
 * @returns HTML string for an img element
 *
 * @example
 * ```ts
 * // With default placeholder
 * const html = albumCoverHtml({
 *   albumId: "artist/album",
 *   className: "w-32 h-32",
 *   alt: "Album cover"
 * });
 *
 * // With custom placeholder
 * const html2 = albumCoverHtml({
 *   albumId: "artist/album",
 *   placeholder: "/path/to/placeholder.png"
 * });
 *
 * // With explicit src
 * const html3 = albumCoverHtml({
 *   albumId: "artist/album",
 *   src: "/path/to/image.jpg"
 * });
 * ```
 */
export default function albumCoverHtml(props: AlbumCoverProps): string {
  const {
    albumId,
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

  // If files are provided, we can add a data attribute for the custom element
  // to pick up and load dynamically
  const dataAttr = props.files ? ` data-album-id="${escapeHtml(albumId)}"` : "";

  return `<img${classAttr}${altAttr}${srcAttr}${dataAttr} />`;
}
