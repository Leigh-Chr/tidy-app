/**
 * File size formatting utilities.
 *
 * Provides functions to format byte values as human-readable strings
 * and parse them back.
 */

/**
 * Size units with their byte thresholds (largest first for iteration)
 */
const SIZE_UNITS = [
  { unit: 'GB', threshold: 1024 * 1024 * 1024 },
  { unit: 'MB', threshold: 1024 * 1024 },
  { unit: 'KB', threshold: 1024 },
  { unit: 'B', threshold: 1 },
] as const;

/**
 * Format bytes to human-readable string.
 *
 * Examples: "1.5MB", "256KB", "512B"
 *
 * @param bytes - The number of bytes to format
 * @returns Human-readable size string
 *
 * @example
 * formatBytes(2621440) // Returns "2.5MB"
 * formatBytes(1024) // Returns "1KB"
 * formatBytes(512) // Returns "512B"
 */
export function formatBytes(bytes: number): string {
  if (bytes < 0) {
    return '0B';
  }

  if (bytes === 0) {
    return '0B';
  }

  for (const { unit, threshold } of SIZE_UNITS) {
    if (bytes >= threshold) {
      const value = bytes / threshold;

      // Use no decimal for bytes
      if (unit === 'B') {
        return `${String(Math.round(value))}B`;
      }

      // Show 1 decimal place, but omit .0
      const formatted = value.toFixed(1);
      const display = formatted.endsWith('.0')
        ? formatted.slice(0, -2)
        : formatted;

      return `${display}${unit}`;
    }
  }

  return `${String(bytes)}B`;
}

/**
 * Parse human-readable size string back to bytes.
 *
 * For testing and validation purposes.
 *
 * @param sizeString - The size string to parse (e.g., "2.5MB", "1KB")
 * @returns Number of bytes (0 for invalid input)
 *
 * @example
 * parseBytes("2.5MB") // Returns 2621440
 * parseBytes("1KB") // Returns 1024
 */
export function parseBytes(sizeString: string): number {
  const match = sizeString.match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB)?$/i);

  if (!match?.[1]) {
    return 0;
  }

  const value = parseFloat(match[1]);
  const unit = (match[2] ?? 'B').toUpperCase();

  const multipliers: Record<string, number> = {
    B: 1,
    KB: 1024,
    MB: 1024 * 1024,
    GB: 1024 * 1024 * 1024,
  };

  return Math.round(value * (multipliers[unit] ?? 1));
}
