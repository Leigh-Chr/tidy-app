/**
 * Statistics calculation and formatting utilities.
 * Provides aggregated file statistics with optional formatting.
 */

import type { FileInfo } from '../types/file-info.js';
import type { ScanStatistics } from '../types/scan-result.js';
import { FileCategory } from '../types/file-category.js';

/**
 * Calculate statistics from an array of FileInfo.
 *
 * @param files - Array of FileInfo objects
 * @returns ScanStatistics with aggregated data
 *
 * @example
 * ```typescript
 * const files = await scanFolder('/path');
 * if (files.ok) {
 *   const stats = calculateStatistics(files.data);
 *   console.log(`Total: ${stats.totalFiles} files, ${stats.totalSize} bytes`);
 * }
 * ```
 */
export function calculateStatistics(files: FileInfo[]): ScanStatistics {
  const byCategory: Record<string, number> = {
    [FileCategory.IMAGE]: 0,
    [FileCategory.DOCUMENT]: 0,
    [FileCategory.VIDEO]: 0,
    [FileCategory.AUDIO]: 0,
    [FileCategory.ARCHIVE]: 0,
    [FileCategory.CODE]: 0,
    [FileCategory.DATA]: 0,
    [FileCategory.OTHER]: 0,
  };

  let totalSize = 0;
  let metadataSupportedCount = 0;

  for (const file of files) {
    totalSize += file.size;
    byCategory[file.category] = (byCategory[file.category] ?? 0) + 1;
    if (file.metadataSupported) {
      metadataSupportedCount++;
    }
  }

  return {
    totalFiles: files.length,
    totalSize,
    byCategory,
    metadataSupportedCount,
  };
}

/**
 * Category breakdown entry with count and percentage.
 */
export interface CategoryBreakdown {
  category: FileCategory;
  count: number;
  percentage: number;
}

/**
 * Extended statistics with formatted output strings.
 */
export interface FormattedStatistics extends ScanStatistics {
  /** Human-readable total size (e.g., "1.50 MB") */
  formattedSize: string;
  /** Human-readable file count (e.g., "42 files") */
  formattedCount: string;
  /** Category breakdown sorted by count (descending), excludes zero-count categories */
  categoryBreakdown: CategoryBreakdown[];
}

/**
 * Size formatting units.
 */
const SIZE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const;

/**
 * Format bytes into a human-readable string.
 *
 * @param bytes - Size in bytes
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string with appropriate unit
 *
 * @example
 * ```typescript
 * formatBytes(0)        // "0 B"
 * formatBytes(1024)     // "1.00 KB"
 * formatBytes(1536)     // "1.50 KB"
 * formatBytes(1048576)  // "1.00 MB"
 * ```
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 B';
  if (bytes < 0) return 'Invalid size';

  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const unitIndex = Math.min(i, SIZE_UNITS.length - 1);

  const value = bytes / Math.pow(k, unitIndex);
  const unit = SIZE_UNITS[unitIndex] as string;
  return `${value.toFixed(decimals)} ${unit}`;
}

/**
 * Format a file count into a human-readable string.
 *
 * @param count - Number of files
 * @returns Formatted string (e.g., "No files", "1 file", "42 files")
 *
 * @example
 * ```typescript
 * formatCount(0)    // "No files"
 * formatCount(1)    // "1 file"
 * formatCount(42)   // "42 files"
 * formatCount(1000) // "1,000 files"
 * ```
 */
export function formatCount(count: number): string {
  if (count === 0) return 'No files';
  if (count === 1) return '1 file';
  return `${count.toLocaleString()} files`;
}

/**
 * Format statistics into human-readable form with category breakdown.
 *
 * @param stats - Raw scan statistics
 * @returns Statistics with formatted strings and category breakdown
 *
 * @example
 * ```typescript
 * const stats = calculateStatistics(files);
 * const formatted = formatStatistics(stats);
 * console.log(formatted.formattedCount); // "42 files"
 * console.log(formatted.formattedSize);  // "1.50 MB"
 * ```
 */
export function formatStatistics(stats: ScanStatistics): FormattedStatistics {
  const categoryBreakdown = Object.entries(stats.byCategory)
    .filter(([, count]) => count > 0)
    .map(([category, count]) => ({
      category: category as FileCategory,
      count,
      percentage:
        stats.totalFiles > 0
          ? Math.round((count / stats.totalFiles) * 100)
          : 0,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    ...stats,
    formattedSize: formatBytes(stats.totalSize),
    formattedCount: formatCount(stats.totalFiles),
    categoryBreakdown,
  };
}
