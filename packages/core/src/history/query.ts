/**
 * @fileoverview History query functions - Story 9.2
 *
 * Provides functions to query and filter operation history.
 * Built on top of the history storage module from Story 9.1.
 *
 * @module history/query
 */

import { ok, type Result } from '../types/result.js';
import { loadHistory } from './storage.js';
import type { OperationHistoryEntry, OperationType } from '../types/operation-history.js';

// =============================================================================
// Query Options
// =============================================================================

/**
 * Options for querying history entries.
 */
export interface QueryOptions {
  /** Maximum number of entries to return (default: all) */
  limit?: number;
  /** Filter by operation type */
  type?: OperationType;
}

// =============================================================================
// Query Functions
// =============================================================================

/**
 * Get history entries with optional filtering.
 *
 * Retrieves operation history from storage with support for:
 * - Limiting the number of results
 * - Filtering by operation type (rename, move, organize)
 *
 * Entries are returned in chronological descending order (newest first).
 *
 * @param options - Query options for filtering and limiting results
 * @returns Array of history entries or error
 *
 * @example
 * ```typescript
 * // Get last 10 entries
 * const result = await getHistory({ limit: 10 });
 *
 * // Get all rename operations
 * const result = await getHistory({ type: 'rename' });
 *
 * // Get last 5 move operations
 * const result = await getHistory({ limit: 5, type: 'move' });
 * ```
 */
export async function getHistory(
  options?: QueryOptions
): Promise<Result<OperationHistoryEntry[], Error>> {
  const storeResult = await loadHistory();
  if (!storeResult.ok) {
    return storeResult;
  }

  let entries = storeResult.data.entries;

  // Filter by type
  if (options?.type) {
    entries = entries.filter((e) => e.operationType === options.type);
  }

  // Apply limit (only if positive)
  if (options?.limit !== undefined && options.limit > 0) {
    entries = entries.slice(0, options.limit);
  }

  return ok(entries);
}

/**
 * Get a single history entry by ID.
 *
 * Looks up a specific operation history entry by its UUID.
 * Returns null if no entry with the given ID exists.
 *
 * @param id - UUID of the history entry
 * @returns The history entry, null if not found, or error
 *
 * @example
 * ```typescript
 * const result = await getHistoryEntry('550e8400-e29b-41d4-a716-446655440000');
 * if (result.ok && result.data) {
 *   console.log(`Operation: ${result.data.operationType}`);
 *   console.log(`Files: ${result.data.fileCount}`);
 * } else if (result.ok && !result.data) {
 *   console.log('Entry not found');
 * }
 * ```
 */
export async function getHistoryEntry(
  id: string
): Promise<Result<OperationHistoryEntry | null, Error>> {
  const storeResult = await loadHistory();
  if (!storeResult.ok) {
    return storeResult;
  }

  const entry = storeResult.data.entries.find((e) => e.id === id);
  return ok(entry ?? null);
}

/**
 * Get the total count of history entries.
 *
 * Optionally filter by operation type before counting.
 *
 * @param type - Optional operation type filter
 * @returns Count of matching entries or error
 *
 * @example
 * ```typescript
 * // Get total entry count
 * const result = await getHistoryCount();
 *
 * // Get count of rename operations only
 * const result = await getHistoryCount('rename');
 * ```
 */
export async function getHistoryCount(
  type?: OperationType
): Promise<Result<number, Error>> {
  const storeResult = await loadHistory();
  if (!storeResult.ok) {
    return storeResult;
  }

  let entries = storeResult.data.entries;

  if (type) {
    entries = entries.filter((e) => e.operationType === type);
  }

  return ok(entries.length);
}
