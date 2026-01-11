/**
 * File filtering utilities.
 * Filter FileInfo arrays by category, extension, or other criteria.
 */

import type { FileInfo } from '../types/file-info.js';
import { FileCategory } from '../types/file-category.js';

/**
 * Options for filtering files.
 */
export interface FilterOptions {
  /** Filter by one or more categories (OR logic) */
  categories?: FileCategory[];
  /** Filter by file extensions (without dot, case insensitive, OR logic) */
  extensions?: string[];
  /** Minimum file size in bytes */
  minSize?: number;
  /** Maximum file size in bytes */
  maxSize?: number;
  /** Only include files modified after this date */
  modifiedAfter?: Date;
  /** Only include files modified before this date */
  modifiedBefore?: Date;
}

/**
 * Check if a file matches the given filter options.
 *
 * @param file - File to check
 * @param options - Filter criteria
 * @returns true if file matches all specified criteria
 */
function matchesFilter(file: FileInfo, options: FilterOptions): boolean {
  // Category filter (OR logic - match any category)
  if (options.categories && options.categories.length > 0) {
    if (!options.categories.includes(file.category)) {
      return false;
    }
  }

  // Extension filter (OR logic - match any extension)
  if (options.extensions && options.extensions.length > 0) {
    const extLower = file.extension.toLowerCase();
    if (!options.extensions.some((e) => e.toLowerCase() === extLower)) {
      return false;
    }
  }

  // Size filters
  if (options.minSize !== undefined && file.size < options.minSize) {
    return false;
  }
  if (options.maxSize !== undefined && file.size > options.maxSize) {
    return false;
  }

  // Date filters
  if (options.modifiedAfter && file.modifiedAt < options.modifiedAfter) {
    return false;
  }
  if (options.modifiedBefore && file.modifiedAt > options.modifiedBefore) {
    return false;
  }

  return true;
}

/**
 * Filter files using flexible filter options.
 *
 * @param files - Array of FileInfo to filter
 * @param options - Filter criteria
 * @returns New array containing only files that match all criteria
 *
 * @example
 * ```typescript
 * // Filter for images under 1MB
 * const result = filterFiles(files, {
 *   categories: [FileCategory.IMAGE],
 *   maxSize: 1024 * 1024
 * });
 * ```
 */
export function filterFiles(
  files: FileInfo[],
  options: FilterOptions
): FileInfo[] {
  return files.filter((file) => matchesFilter(file, options));
}

/**
 * Filter files by one or more categories.
 *
 * @param files - Array of FileInfo to filter
 * @param categories - Single category or array of categories (OR logic)
 * @returns New array containing only files matching any of the categories
 *
 * @example
 * ```typescript
 * // Single category
 * const images = filterByCategory(files, FileCategory.IMAGE);
 *
 * // Multiple categories (OR logic)
 * const docs = filterByCategory(files, [FileCategory.PDF, FileCategory.DOCUMENT]);
 * ```
 */
export function filterByCategory(
  files: FileInfo[],
  categories: FileCategory | FileCategory[]
): FileInfo[] {
  const categoryArray = Array.isArray(categories) ? categories : [categories];
  return files.filter((file) => categoryArray.includes(file.category));
}

/**
 * Filter files by file extensions.
 *
 * @param files - Array of FileInfo to filter
 * @param extensions - Array of extensions to match (without dot, case insensitive)
 * @returns New array containing only files with matching extensions
 *
 * @example
 * ```typescript
 * const jpgAndPng = filterByExtensions(files, ['jpg', 'jpeg', 'png']);
 * ```
 */
export function filterByExtensions(
  files: FileInfo[],
  extensions: string[]
): FileInfo[] {
  const extSet = new Set(extensions.map((e) => e.toLowerCase()));
  return files.filter((file) => extSet.has(file.extension.toLowerCase()));
}

/**
 * Convenience function to filter only image files.
 *
 * @param files - Array of FileInfo to filter
 * @returns New array containing only image files
 */
export function filterImages(files: FileInfo[]): FileInfo[] {
  return filterByCategory(files, FileCategory.IMAGE);
}

/**
 * Convenience function to filter all document types.
 * Includes DOCUMENT (doc, docx, txt, md, rtf, odt), PDF, SPREADSHEET (xls, xlsx, csv, ods),
 * and PRESENTATION (ppt, pptx, odp) categories.
 *
 * @param files - Array of FileInfo to filter
 * @returns New array containing only document files
 */
export function filterDocuments(files: FileInfo[]): FileInfo[] {
  return filterByCategory(files, [
    FileCategory.DOCUMENT,
    FileCategory.PDF,
    FileCategory.SPREADSHEET,
    FileCategory.PRESENTATION,
  ]);
}

/**
 * Filter files that support metadata extraction.
 *
 * @param files - Array of FileInfo to filter
 * @returns New array containing only files that support metadata extraction
 */
export function filterMetadataSupported(files: FileInfo[]): FileInfo[] {
  return files.filter((file) => file.metadataSupported);
}
