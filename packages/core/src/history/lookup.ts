/**
 * @fileoverview File history lookup - Story 9.4
 *
 * Provides functions to look up a file's history in operation records.
 * Searches by either original or current (new) path.
 *
 * @module history/lookup
 */

import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { ok, err, type Result } from '../types/result.js';
import type {
  FileHistoryLookup,
  FileOperationEntry,
} from '../types/restore-result.js';
import { loadHistory } from './storage.js';
import type {
  OperationHistoryEntry,
  FileHistoryRecord,
} from '../types/operation-history.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Internal type for tracking matched file records with their parent entry.
 */
interface FileMatch {
  entry: OperationHistoryEntry;
  record: FileHistoryRecord;
}

// =============================================================================
// Lookup Functions
// =============================================================================

/**
 * Look up the history of a file by its path.
 *
 * Searches through all operation history entries for records where either
 * the originalPath or newPath matches the searched path. Returns all
 * operations that affected this file, sorted by timestamp (most recent first).
 *
 * The returned `FileHistoryLookup` indicates:
 * - `found`: Whether the file exists in history
 * - `originalPath`: The file's original name before any operations
 * - `currentPath`: The file's most recent path after operations
 * - `isAtOriginal`: Whether the file currently exists at its original location
 * - `operations`: List of all operations that affected this file
 *
 * @param path - The file path to look up (can be original or current path)
 * @returns File history lookup result or null if not found, or error
 *
 * @example
 * ```typescript
 * // Look up by current path
 * const result = await lookupFileHistory('/photos/renamed-photo.jpg');
 * if (result.ok && result.data) {
 *   console.log(`Original: ${result.data.originalPath}`);
 *   console.log(`Operations: ${result.data.operations.length}`);
 * }
 *
 * // Look up by original path
 * const result = await lookupFileHistory('/photos/original-name.jpg');
 * ```
 */
export async function lookupFileHistory(
  path: string
): Promise<Result<FileHistoryLookup | null, Error>> {
  const historyResult = await loadHistory();
  if (!historyResult.ok) {
    return err(historyResult.error);
  }

  const store = historyResult.data;

  // Normalize the search path
  const normalizedPath = normalizePath(path);

  // Find all entries that reference this file
  const matches = findFileMatches(store.entries, normalizedPath);

  // No matches - file not in history
  if (matches.length === 0) {
    return ok(null);
  }

  // Build the lookup result from matches
  const lookup = buildLookupResult(normalizedPath, matches);

  return ok(lookup);
}

/**
 * Look up multiple files at once for efficiency.
 *
 * Useful when checking history for multiple files without
 * loading history separately for each one.
 *
 * @param paths - Array of file paths to look up
 * @returns Map of path to lookup result, or error
 *
 * @example
 * ```typescript
 * const result = await lookupMultipleFiles(['/path/a.txt', '/path/b.txt']);
 * if (result.ok) {
 *   for (const [path, lookup] of result.data) {
 *     console.log(`${path}: ${lookup?.found ? 'found' : 'not found'}`);
 *   }
 * }
 * ```
 */
export async function lookupMultipleFiles(
  paths: string[]
): Promise<Result<Map<string, FileHistoryLookup | null>, Error>> {
  const historyResult = await loadHistory();
  if (!historyResult.ok) {
    return err(historyResult.error);
  }

  const store = historyResult.data;
  const results = new Map<string, FileHistoryLookup | null>();

  for (const path of paths) {
    const normalizedPath = normalizePath(path);
    const matches = findFileMatches(store.entries, normalizedPath);

    if (matches.length === 0) {
      results.set(path, null);
    } else {
      results.set(path, buildLookupResult(normalizedPath, matches));
    }
  }

  return ok(results);
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Normalize a path for consistent comparison.
 *
 * @param path - Path to normalize
 * @returns Normalized absolute path
 */
function normalizePath(path: string): string {
  return resolve(path);
}

/**
 * Find all history entries that reference a file.
 *
 * @param entries - History entries to search
 * @param normalizedPath - Normalized path to match
 * @returns Array of matches with entry and record
 */
function findFileMatches(
  entries: OperationHistoryEntry[],
  normalizedPath: string
): FileMatch[] {
  const matches: FileMatch[] = [];

  for (const entry of entries) {
    for (const record of entry.files) {
      // Normalize paths from history for comparison
      const recordOriginal = normalizePath(record.originalPath);
      const recordNew = record.newPath ? normalizePath(record.newPath) : null;

      // Match if either original or new path matches
      if (recordOriginal === normalizedPath || recordNew === normalizedPath) {
        matches.push({ entry, record });
      }
    }
  }

  return matches;
}

/**
 * Build a FileHistoryLookup result from matches.
 *
 * @param searchedPath - The path that was searched
 * @param matches - Array of matching file records
 * @returns FileHistoryLookup result
 */
function buildLookupResult(
  searchedPath: string,
  matches: FileMatch[]
): FileHistoryLookup {
  // Sort by timestamp (most recent first)
  const sortedMatches = [...matches].sort((a, b) =>
    new Date(b.entry.timestamp).getTime() - new Date(a.entry.timestamp).getTime()
  );

  // Get the most recent match for primary fields
  const latest = sortedMatches[0]!;

  // Determine the original path (from first operation chronologically)
  // and current path (from most recent operation)
  const firstMatch = sortedMatches[sortedMatches.length - 1]!;
  const originalPath = firstMatch.record.originalPath;
  const currentPath = latest.record.newPath;

  // Check if file exists at original location
  const isAtOriginal = existsSync(originalPath);

  // Build operations list
  const operations: FileOperationEntry[] = sortedMatches.map((m) => ({
    operationId: m.entry.id,
    timestamp: m.entry.timestamp,
    operationType: m.entry.operationType,
    originalPath: m.record.originalPath,
    newPath: m.record.newPath,
  }));

  return {
    searchedPath,
    found: true,
    originalPath,
    currentPath,
    lastOperationId: latest.entry.id,
    lastModified: latest.entry.timestamp,
    isAtOriginal,
    operations,
  };
}

/**
 * Check if a file has been renamed (exists in history with different current path).
 *
 * @param path - File path to check
 * @returns true if file was renamed, false otherwise, or error
 *
 * @example
 * ```typescript
 * const result = await hasFileBeenRenamed('/photos/image.jpg');
 * if (result.ok && result.data) {
 *   console.log('File was renamed - can be restored');
 * }
 * ```
 */
export async function hasFileBeenRenamed(
  path: string
): Promise<Result<boolean, Error>> {
  const lookupResult = await lookupFileHistory(path);
  if (!lookupResult.ok) {
    return err(lookupResult.error);
  }

  if (!lookupResult.data) {
    return ok(false);
  }

  // File was renamed if it's in history and not at original location
  return ok(!lookupResult.data.isAtOriginal);
}

/**
 * Get the original path for a file if it was renamed.
 *
 * Returns null if file not in history or already at original.
 *
 * @param path - Current file path
 * @returns Original path or null, or error
 *
 * @example
 * ```typescript
 * const result = await getOriginalPath('/photos/renamed.jpg');
 * if (result.ok && result.data) {
 *   console.log(`Original: ${result.data}`);
 * }
 * ```
 */
export async function getOriginalPath(
  path: string
): Promise<Result<string | null, Error>> {
  const lookupResult = await lookupFileHistory(path);
  if (!lookupResult.ok) {
    return err(lookupResult.error);
  }

  if (!lookupResult.data) {
    return ok(null);
  }

  // Return original if different from current location
  if (!lookupResult.data.isAtOriginal) {
    return ok(lookupResult.data.originalPath);
  }

  return ok(null);
}
