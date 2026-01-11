/**
 * @fileoverview History recorder for operation history - Story 9.1
 *
 * Records rename/move operations to history for review and undo capabilities.
 * Creates history entries from BatchRenameResult and persists them to storage.
 *
 * @module history/recorder
 */

import { randomUUID } from 'node:crypto';
import { ok, err, type Result } from '../types/result.js';
import type { BatchRenameResult, FileRenameResult } from '../types/rename-result.js';
import { RenameOutcome } from '../types/rename-result.js';
import type {
  OperationType,
  OperationHistoryEntry,
  FileHistoryRecord,
  HistoryStore,
} from '../types/operation-history.js';
import { loadHistory, saveHistory } from './storage.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Options for recording an operation.
 */
export interface RecordOptions {
  /**
   * Provide an existing store instead of loading from disk.
   * Useful for batch operations or testing.
   */
  store?: HistoryStore;
}

// =============================================================================
// Operation Type Detection
// =============================================================================

/**
 * Determine the operation type from file results.
 *
 * Checks if any file has the isMoveOperation flag set to true.
 * If any file was moved (not just renamed), returns 'move'.
 * Otherwise returns 'rename'.
 *
 * @param results - Array of file rename results
 * @returns The determined operation type
 *
 * @example
 * ```typescript
 * const results = [{ isMoveOperation: true, ... }];
 * const type = determineOperationType(results);
 * // Returns: 'move'
 * ```
 */
export function determineOperationType(
  results: Array<FileRenameResult & { isMoveOperation?: boolean }>
): OperationType {
  const hasMove = results.some((r) => r.isMoveOperation === true);
  return hasMove ? 'move' : 'rename';
}

// =============================================================================
// Entry Creation
// =============================================================================

/**
 * Create a history entry from a batch rename result.
 *
 * Extracts all relevant information from the BatchRenameResult and creates
 * a properly structured OperationHistoryEntry with:
 * - Unique UUID identifier
 * - ISO 8601 timestamp
 * - Operation type (rename/move)
 * - File records with success/failure status
 * - Summary statistics
 *
 * @param result - The batch rename result to convert
 * @returns A new operation history entry
 *
 * @example
 * ```typescript
 * const result = await executeBatchRename(proposals);
 * const entry = createEntryFromResult(result);
 * // entry.id is a UUID
 * // entry.timestamp is ISO 8601 format
 * ```
 */
export function createEntryFromResult(result: BatchRenameResult): OperationHistoryEntry {
  const id = randomUUID();
  const timestamp = new Date().toISOString();

  // Convert file results to history records
  const files: FileHistoryRecord[] = result.results.map((fileResult) => {
    const extendedResult = fileResult as FileRenameResult & { isMoveOperation?: boolean };
    return {
      originalPath: fileResult.originalPath,
      newPath: fileResult.newPath,
      isMoveOperation: extendedResult.isMoveOperation ?? false,
      success: fileResult.outcome === RenameOutcome.SUCCESS,
      error: fileResult.error,
    };
  });

  // Determine operation type from results
  const operationType = determineOperationType(
    result.results as Array<FileRenameResult & { isMoveOperation?: boolean }>
  );

  return {
    id,
    timestamp,
    operationType,
    fileCount: result.results.length,
    summary: {
      succeeded: result.summary.succeeded,
      skipped: result.summary.skipped,
      failed: result.summary.failed,
      directoriesCreated: result.summary.directoriesCreated,
    },
    durationMs: result.durationMs,
    files,
    directoriesCreated: result.directoriesCreated,
  };
}

// =============================================================================
// Recording Function
// =============================================================================

/**
 * Record an operation to history.
 *
 * Creates a history entry from the batch rename result and persists it
 * to the history store. New entries are prepended to maintain newest-first
 * order.
 *
 * @param result - The batch rename result to record
 * @param options - Optional recording options
 * @returns The created history entry or an error
 *
 * @example
 * ```typescript
 * const renameResult = await executeBatchRename(proposals);
 * const recordResult = await recordOperation(renameResult);
 * if (recordResult.ok) {
 *   console.log(`Recorded with ID: ${recordResult.data.id}`);
 * }
 * ```
 */
export async function recordOperation(
  result: BatchRenameResult,
  options?: RecordOptions
): Promise<Result<OperationHistoryEntry, Error>> {
  // Load existing history or use provided store
  let store: HistoryStore;

  if (options?.store) {
    store = options.store;
  } else {
    const loadResult = await loadHistory();
    if (!loadResult.ok) {
      return err(loadResult.error);
    }
    store = loadResult.data;
  }

  // Create new entry
  const entry = createEntryFromResult(result);

  // Prepend to entries (newest first)
  store.entries.unshift(entry);

  // Save updated history
  const saveResult = await saveHistory(store);
  if (!saveResult.ok) {
    return err(saveResult.error);
  }

  return ok(entry);
}
