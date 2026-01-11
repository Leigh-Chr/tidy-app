/**
 * Formatting utilities for tidy-app GUI
 */

/**
 * Format bytes into human-readable string
 *
 * @param bytes - Number of bytes to format
 * @returns Formatted string like "1.5 KB" or "2.3 GB"
 *
 * @example
 * formatBytes(0)       // "0 B"
 * formatBytes(1024)    // "1 KB"
 * formatBytes(1536)    // "1.5 KB"
 * formatBytes(1048576) // "1 MB"
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  if (bytes < 0) return "0 B"; // Handle negative values gracefully

  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(
    Math.floor(Math.log(bytes) / Math.log(k)),
    sizes.length - 1
  );

  const value = bytes / Math.pow(k, i);
  // Use toFixed(1) and remove trailing .0
  const formatted = value.toFixed(1).replace(/\.0$/, "");

  return `${formatted} ${sizes[i]}`;
}
