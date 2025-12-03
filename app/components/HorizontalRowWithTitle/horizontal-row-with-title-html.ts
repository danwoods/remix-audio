/**
 * Props for the horizontal row with title HTML function
 */
export interface HorizontalRowWithTitleProps {
  title: string;
  children: string[];
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
 * Generate HTML string for horizontal scrolling row with title
 *
 * Returns HTML immediately with a horizontal scrolling grid of items.
 *
 * @param props - Horizontal row properties
 * @returns HTML string for a section element with title and grid
 *
 * @example
 * ```ts
 * const html = horizontalRowWithTitleHtml({
 *   title: "Recently Played",
 *   children: [
 *     '<img src="/album1.jpg" alt="Album 1" />',
 *     '<img src="/album2.jpg" alt="Album 2" />',
 *     '<img src="/album3.jpg" alt="Album 3" />',
 *   ]
 * });
 * ```
 */
export default function horizontalRowWithTitleHtml(
  props: HorizontalRowWithTitleProps,
): string {
  const { title, children } = props;

  const escapedTitle = escapeHtml(title);
  const childrenHtml = children.join("");

  return `<section class="py-4 pl-4">
  <p class="text-lg font-bold mb-2">${escapedTitle}</p>
  <div class="grid gap-x-4 md:gap-x-6 overflow-x-auto grid-cols-[repeat(5,calc(40%-40px))] md:grid-cols-[repeat(5,calc(25%-40px))]">
    ${childrenHtml}
  </div>
</section>`;
}
