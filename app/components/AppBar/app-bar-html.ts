/**
 * Props for the app bar HTML function
 */
export interface AppBarProps {
  appName?: string;
  pathname?: string;
  startContent?: string;
  endContent?: string;
  className?: string;
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
 * Generate HTML string for application bar/navbar
 *
 * Returns HTML immediately with a navbar containing logo/title and optional start/end content.
 *
 * @param props - App bar properties
 * @returns HTML string for a navbar element
 *
 * @example
 * ```ts
 * const html = appBarHtml({
 *   appName: "Remix Audio",
 *   pathname: "/",
 *   endContent: '<button class="p-2 rounded-full" aria-label="search">Search</button>'
 * });
 * ```
 */
export default function appBarHtml(props: AppBarProps = {}): string {
  const {
    appName = "Remix Audio",
    pathname = "/",
    startContent = "",
    endContent = "",
    className = "",
  } = props;

  const escapedAppName = escapeHtml(appName);
  const escapedStartContent = startContent;
  const escapedEndContent = endContent;

  // Determine if navbar should be sticky (only on home page)
  const stickyClass = pathname === "/" ? "sticky top-0" : "";
  const baseClasses =
    "flex items-center justify-between w-full relative py-2 px-4 bg-black";
  const allClasses = className
    ? `${baseClasses} ${stickyClass} ${className}`.trim()
    : `${baseClasses} ${stickyClass}`.trim();
  const classAttr = ` class="${escapeHtml(allClasses)}"`;

  return `<div${classAttr}>
  <div class="flex-1">${escapedStartContent}</div>
  <div class="flex-1 flex justify-center">
    <a href="/" class="text-xl font-bold">${escapedAppName}</a>
  </div>
  <div class="flex-1 flex justify-end">${escapedEndContent}</div>
</div>`;
}
