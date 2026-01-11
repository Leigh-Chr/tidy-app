/**
 * @fileoverview File Type Filter for LLM Analysis - Story 10.4
 *
 * Determines whether a file should be analyzed by the LLM based on
 * the file type configuration. Uses preset categories, explicit
 * include/exclude lists with proper priority handling.
 *
 * Priority order:
 * 1. Excluded extensions (always skip)
 * 2. Included extensions (explicit include)
 * 3. Preset category (default behavior)
 *
 * @module llm/file-type-filter
 */

import { ok, type Result } from '../types/result.js';
import type { LlmFileTypes } from './types.js';
import { getPresetExtensions } from './file-type-presets.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Result of file type filter check.
 */
export interface FilterResult {
  /** Whether the file should be analyzed by LLM */
  shouldAnalyze: boolean;
  /** Human-readable reason for the decision */
  reason: string;
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Extract extension from a file path.
 *
 * @param filePath - Path to the file
 * @returns The extension without dot, or empty string if none
 *
 * @example
 * ```typescript
 * getExtension('/path/to/file.pdf')  // 'pdf'
 * getExtension('/path/to/file.PDF')  // 'PDF' (case preserved)
 * getExtension('/path/to/file')      // ''
 * getExtension('/path/to/.gitignore') // 'gitignore'
 * ```
 */
export function getExtension(filePath: string): string {
  const lastSlash = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
  const basename = filePath.slice(lastSlash + 1);
  const lastDot = basename.lastIndexOf('.');

  // No dot found, or dot is first character (hidden file with no extension)
  if (lastDot <= 0) {
    return '';
  }

  return basename.slice(lastDot + 1);
}

/**
 * Normalize an extension for comparison.
 *
 * Removes leading dots and converts to lowercase.
 *
 * @param ext - Extension to normalize
 * @returns Normalized extension
 *
 * @example
 * ```typescript
 * normalizeExt('.PDF')  // 'pdf'
 * normalizeExt('pdf')   // 'pdf'
 * normalizeExt('..jpg') // '.jpg' (only removes one leading dot)
 * ```
 */
export function normalizeExt(ext: string): string {
  return ext.replace(/^\./, '').toLowerCase();
}

/**
 * Check if an extension is in a list (case-insensitive, with/without dot).
 *
 * @param ext - Extension to check
 * @param list - List of extensions to check against
 * @returns True if extension is in the list
 */
function isExtensionInList(ext: string, list: readonly string[]): boolean {
  const normalizedExt = normalizeExt(ext);
  return list.some((e) => normalizeExt(e) === normalizedExt);
}

// =============================================================================
// Main Filter Function
// =============================================================================

/**
 * Determines if a file should be analyzed by LLM based on configuration.
 *
 * This is the main entry point for file type filtering. It applies the
 * following priority order:
 *
 * 1. **Excluded extensions** - Always skip these files
 * 2. **Included extensions** - If non-empty, only these are allowed
 * 3. **Preset category** - Fall back to preset extensions
 *
 * @param filePath - Path to the file to check
 * @param config - LLM file type configuration
 * @returns Result with filter decision and reason
 *
 * @example
 * ```typescript
 * const config: LlmFileTypes = {
 *   preset: 'documents',
 *   includedExtensions: [],
 *   excludedExtensions: ['exe', 'dll'],
 *   skipWithMetadata: true,
 * };
 *
 * // Excluded file
 * shouldAnalyzeFile('/path/to/file.exe', config);
 * // { ok: true, data: { shouldAnalyze: false, reason: "Extension 'exe' is excluded" } }
 *
 * // Document file (in preset)
 * shouldAnalyzeFile('/path/to/report.pdf', config);
 * // { ok: true, data: { shouldAnalyze: true, reason: "Extension 'pdf' matches preset 'documents'" } }
 *
 * // Image file (not in documents preset)
 * shouldAnalyzeFile('/path/to/photo.jpg', config);
 * // { ok: true, data: { shouldAnalyze: false, reason: "Extension 'jpg' not in preset 'documents'" } }
 * ```
 */
export function shouldAnalyzeFile(
  filePath: string,
  config: LlmFileTypes
): Result<FilterResult> {
  const rawExt = getExtension(filePath);
  const ext = normalizeExt(rawExt);

  // Handle files with no extension
  if (ext === '') {
    return ok({
      shouldAnalyze: false,
      reason: 'File has no extension',
    });
  }

  // Priority 1: Check exclusions first (highest priority)
  if (config.excludedExtensions.length > 0) {
    if (isExtensionInList(ext, config.excludedExtensions)) {
      return ok({
        shouldAnalyze: false,
        reason: `Extension '${ext}' is excluded`,
      });
    }
  }

  // Priority 2: Check explicit inclusions
  if (config.includedExtensions.length > 0) {
    const included = isExtensionInList(ext, config.includedExtensions);
    return ok({
      shouldAnalyze: included,
      reason: included
        ? `Extension '${ext}' is explicitly included`
        : `Extension '${ext}' not in include list`,
    });
  }

  // Priority 3: Fall back to preset
  const presetExts = getPresetExtensions(config.preset);

  // Custom preset with no included extensions means nothing is analyzed
  if (config.preset === 'custom' && presetExts.length === 0) {
    return ok({
      shouldAnalyze: false,
      reason: "Preset 'custom' has no extensions defined",
    });
  }

  const inPreset = isExtensionInList(ext, presetExts);
  return ok({
    shouldAnalyze: inPreset,
    reason: inPreset
      ? `Extension '${ext}' matches preset '${config.preset}'`
      : `Extension '${ext}' not in preset '${config.preset}'`,
  });
}

// =============================================================================
// Batch Filter Function
// =============================================================================

/**
 * Result of filtering multiple files.
 */
export interface BatchFilterResult {
  /** Files that should be analyzed */
  toAnalyze: string[];
  /** Files that were skipped with their reasons */
  skipped: Map<string, FilterResult>;
}

/**
 * Filter multiple files based on LLM file type configuration.
 *
 * Separates files into those that should be analyzed and those
 * that should be skipped.
 *
 * @param filePaths - Array of file paths to filter
 * @param config - LLM file type configuration
 * @returns Filtered results
 *
 * @example
 * ```typescript
 * const config: LlmFileTypes = {
 *   preset: 'documents',
 *   includedExtensions: [],
 *   excludedExtensions: [],
 *   skipWithMetadata: true,
 * };
 *
 * const files = [
 *   '/path/report.pdf',
 *   '/path/photo.jpg',
 *   '/path/data.xlsx',
 * ];
 *
 * const result = filterFiles(files, config);
 * // result.toAnalyze = ['/path/report.pdf', '/path/data.xlsx']
 * // result.skipped has '/path/photo.jpg' with reason
 * ```
 */
export function filterFiles(
  filePaths: string[],
  config: LlmFileTypes
): BatchFilterResult {
  const toAnalyze: string[] = [];
  const skipped = new Map<string, FilterResult>();

  for (const filePath of filePaths) {
    const result = shouldAnalyzeFile(filePath, config);

    // shouldAnalyzeFile always returns ok
    if (result.ok) {
      if (result.data.shouldAnalyze) {
        toAnalyze.push(filePath);
      } else {
        skipped.set(filePath, result.data);
      }
    }
  }

  return { toAnalyze, skipped };
}

/**
 * Get a summary of filter results.
 *
 * @param result - Batch filter result
 * @returns Human-readable summary
 */
export function getFilterSummary(result: BatchFilterResult): string {
  const total = result.toAnalyze.length + result.skipped.size;
  const analyzed = result.toAnalyze.length;
  const skipped = result.skipped.size;

  if (total === 0) {
    return 'No files to filter';
  }

  if (skipped === 0) {
    return `All ${analyzed} file(s) will be analyzed`;
  }

  if (analyzed === 0) {
    return `All ${skipped} file(s) will be skipped`;
  }

  return `${analyzed} file(s) to analyze, ${skipped} file(s) skipped`;
}
