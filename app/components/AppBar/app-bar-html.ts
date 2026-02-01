/**
 * Props for the app bar HTML function
 */
export interface AppBarProps {
  appName?: string;
  pathname?: string;
  startContent?: string;
  endContent?: string;
  isAdmin?: boolean;
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
    isAdmin = false,
    className = "",
  } = props;

  const escapedAppName = escapeHtml(appName);
  const escapedStartContent = startContent;
  const escapedEndContent = endContent;

  const adminUploadForm = isAdmin
    ? `<form method="post" enctype="multipart/form-data" class="flex items-center gap-2" aria-label="Upload files">
  <label class="sr-only" for="admin-upload-files">Upload audio files</label>
  <input id="admin-upload-files" type="file" name="files" multiple class="file-input file-input-sm" />
  <button type="submit" class="btn btn-primary btn-sm">Upload</button>
</form>`
    : "";
  const resolvedEndContent = [escapedEndContent, adminUploadForm]
    .filter(Boolean)
    .join("\n");

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
  <div class="flex-1 flex justify-center lg:justify-start">
    <a href="/" class="text-xl font-bold">${escapedAppName}</a>
  </div>
  <div class="flex-1 flex justify-end">${resolvedEndContent}</div>
</div>`;
}
