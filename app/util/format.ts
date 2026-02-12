/** @file Formatting utilities for display. */

/**
 * Formats a byte count as a human-readable string (B, KB, MB).
 *
 * @param bytes - Number of bytes to format
 * @returns Formatted string (e.g. "512 B", "1.5 KB", "2.3 MB")
 *
 * @example
 * ```ts
 * import { formatFileSize } from "./format.ts";
 * formatFileSize(0);       // "0 B"
 * formatFileSize(512);    // "512 B"
 * formatFileSize(1536);   // "1.5 KB"
 * formatFileSize(2500000); // "2.4 MB"
 * ```
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
