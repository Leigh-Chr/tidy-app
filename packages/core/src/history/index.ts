/**
 * History module for operation history - Story 9.1
 *
 * Provides functions for recording, storing, and managing operation history.
 * History enables undo functionality and operation review.
 *
 * @module history
 *
 * @example
 * ```typescript
 * import { recordOperation, loadHistory, pruneHistory } from '@tidy/core';
 *
 * // Record an operation after batch rename
 * const historyResult = await recordOperation(batchRenameResult);
 *
 * // Load existing history
 * const loadResult = await loadHistory();
 * if (loadResult.ok) {
 *   console.log(`${loadResult.data.entries.length} entries`);
 * }
 *
 * // Prune old entries
 * const pruned = pruneHistory(loadResult.data, { maxEntries: 50 });
 * ```
 */

// Storage functions
export { loadHistory, saveHistory, getHistoryPath, HISTORY_FILENAME } from './storage.js';

// Recording functions
export { recordOperation, createEntryFromResult, determineOperationType } from './recorder.js';
export type { RecordOptions } from './recorder.js';

// Pruning functions
export { pruneHistory, shouldPrune, DEFAULT_PRUNE_CONFIG } from './pruner.js';

// Query functions (Story 9.2)
export { getHistory, getHistoryEntry, getHistoryCount } from './query.js';
export type { QueryOptions } from './query.js';

// Undo functions (Story 9.3)
export {
  undoOperation,
  cleanupDirectories,
  markOperationAsUndone,
  isOperationUndone,
} from './undo.js';

// Lookup functions (Story 9.4)
export {
  lookupFileHistory,
  lookupMultipleFiles,
  hasFileBeenRenamed,
  getOriginalPath,
} from './lookup.js';

// Restore functions (Story 9.4)
export { restoreFile, restoreFileWithDetails, canRestoreFile } from './restore.js';
