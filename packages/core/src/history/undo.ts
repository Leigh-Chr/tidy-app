/**
 * @fileoverview Undo engine for reversing rename/move operations - Story 9.3
 *
 * Provides functions to undo operations recorded in history by reversing
 * file renames and cleaning up directories created during the original operation.
 *
 * @module history/undo
 */

import { rename } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { readdir, rmdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { ok, err, type Result } from '../types/result.js';
import type {
  OperationHistoryEntry,
  FileHistoryRecord,
} from '../types/operation-history.js';
import type { UndoResult, UndoFileResult, UndoOptions } from '../types/undo-result.js';
import {
  createSuccessFileResult,
  createFailedFileResult,
  createSkippedFileResult,
} from '../types/undo-result.js';
import { getHistory, getHistoryEntry } from './query.js';
import { loadHistory, saveHistory } from './storage.js';

// =============================================================================
// Main Undo Function
// =============================================================================

/**
 * Undo a recorded operation by reversing file renames and cleaning up directories.
 *
 * @param id - The operation ID to undo (or undefined/null for most recent)
 * @param options - Undo options (dryRun, force)
 * @returns Result with undo details or error
 *
 * @example
 * ```typescript
 * // Undo specific operation
 * const result = await undoOperation('550e8400-e29b-41d4-a716-446655440000');
 *
 * // Undo most recent operation
 * const result = await undoOperation();
 *
 * // Preview undo without executing
 * const result = await undoOperation('id', { dryRun: true });
 * ```
 */
export async function undoOperation(
  id?: string | null,
  options: UndoOptions = {}
): Promise<Result<UndoResult, Error>> {
  const startTime = Date.now();
  const { dryRun = false, force = false } = options;

  // 1. Find the operation to undo
  let entry: OperationHistoryEntry | null;

  if (id) {
    const entryResult = await getHistoryEntry(id);
    if (!entryResult.ok) {
      return err(entryResult.error);
    }
    entry = entryResult.data;
    if (!entry) {
      return err(new Error(`Operation not found: ${id}`));
    }
  } else {
    // Get most recent operation
    const historyResult = await getHistory({ limit: 1 });
    if (!historyResult.ok) {
      return err(historyResult.error);
    }
    if (historyResult.data.length === 0) {
      return err(new Error('No operations in history to undo'));
    }
    entry = historyResult.data[0]!;
  }

  // 2. Check if already undone
  if (entry.undoneAt) {
    return err(new Error('Operation already undone'));
  }

  // 3. Validate and collect file reversals
  const fileResults: UndoFileResult[] = [];
  let filesRestored = 0;
  let filesSkipped = 0;
  let filesFailed = 0;

  for (const record of entry.files) {
    const fileResult = await validateFileReversal(record, dryRun);
    fileResults.push(fileResult);

    if (fileResult.success) {
      filesRestored++;
    } else if (fileResult.skipReason) {
      filesSkipped++;
    } else {
      filesFailed++;
    }
  }

  // 4. Check if we should proceed (if not force and there are failures)
  const hasFailures = filesFailed > 0;
  if (hasFailures && !force && !dryRun) {
    // Return preview result without actually undoing
    return ok({
      operationId: entry.id,
      success: false,
      dryRun: true, // Treat as preview since we're not executing
      filesRestored: 0,
      filesSkipped,
      filesFailed,
      directoriesRemoved: [],
      files: fileResults,
      durationMs: Date.now() - startTime,
    });
  }

  // 5. If dry-run, return preview result
  if (dryRun) {
    return ok({
      operationId: entry.id,
      success: filesFailed === 0,
      dryRun: true,
      filesRestored,
      filesSkipped,
      filesFailed,
      directoriesRemoved: [], // Would be calculated but not executed
      files: fileResults,
      durationMs: Date.now() - startTime,
    });
  }

  // 6. Execute the actual undo
  const executionResults: UndoFileResult[] = [];
  filesRestored = 0;
  filesSkipped = 0;
  filesFailed = 0;

  for (const record of entry.files) {
    const fileResult = await executeFileReversal(record);
    executionResults.push(fileResult);

    if (fileResult.success) {
      filesRestored++;
    } else if (fileResult.skipReason) {
      filesSkipped++;
    } else {
      filesFailed++;
    }
  }

  // 7. Clean up empty directories that were created during original operation
  const directoriesRemoved = await cleanupDirectories(entry.directoriesCreated);

  // 8. Mark operation as undone in history
  const markResult = await markOperationAsUndone(entry.id);
  if (!markResult.ok) {
    // Log warning but don't fail the undo
    console.warn(`Failed to mark operation as undone: ${markResult.error.message}`);
  }

  // 9. Return result
  return ok({
    operationId: entry.id,
    success: filesFailed === 0,
    dryRun: false,
    filesRestored,
    filesSkipped,
    filesFailed,
    directoriesRemoved,
    files: executionResults,
    durationMs: Date.now() - startTime,
  });
}

// =============================================================================
// File Reversal Functions
// =============================================================================

/**
 * Validate if a file can be reversed without executing.
 *
 * @param record - The file history record
 * @param dryRun - Whether this is a dry-run validation
 * @returns UndoFileResult with validation status
 */
async function validateFileReversal(
  record: FileHistoryRecord,
  dryRun: boolean
): Promise<UndoFileResult> {
  // Skip files that weren't successfully renamed in the original operation
  if (!record.success) {
    return createSkippedFileResult(
      record.originalPath,
      record.newPath,
      'Original operation failed for this file'
    );
  }

  // Skip files that have no new path (operation failed)
  if (!record.newPath) {
    return createSkippedFileResult(
      record.originalPath,
      null,
      'No destination path recorded'
    );
  }

  // Check if file exists at the new location
  if (!existsSync(record.newPath)) {
    return createFailedFileResult(
      record.originalPath,
      record.newPath,
      'File no longer exists at expected location'
    );
  }

  // Check if original path is already occupied
  if (existsSync(record.originalPath)) {
    return createFailedFileResult(
      record.originalPath,
      record.newPath,
      'Original path is now occupied by another file'
    );
  }

  // For dry-run, return success (we validated it can be done)
  if (dryRun) {
    return createSuccessFileResult(record.originalPath, record.newPath);
  }

  // Return success for validation
  return createSuccessFileResult(record.originalPath, record.newPath);
}

/**
 * Execute the actual file reversal (rename newPath → originalPath).
 *
 * @param record - The file history record
 * @returns UndoFileResult with execution status
 */
async function executeFileReversal(record: FileHistoryRecord): Promise<UndoFileResult> {
  // Skip files that weren't successfully renamed
  if (!record.success) {
    return createSkippedFileResult(
      record.originalPath,
      record.newPath,
      'Original operation failed for this file'
    );
  }

  if (!record.newPath) {
    return createSkippedFileResult(
      record.originalPath,
      null,
      'No destination path recorded'
    );
  }

  // Check if file exists at new location
  if (!existsSync(record.newPath)) {
    return createFailedFileResult(
      record.originalPath,
      record.newPath,
      'File no longer exists at expected location'
    );
  }

  // Check if original path is occupied
  if (existsSync(record.originalPath)) {
    return createFailedFileResult(
      record.originalPath,
      record.newPath,
      'Original path is now occupied by another file'
    );
  }

  // Ensure parent directory of original path exists
  const originalDir = dirname(record.originalPath);
  if (!existsSync(originalDir)) {
    return createFailedFileResult(
      record.originalPath,
      record.newPath,
      `Parent directory does not exist: ${originalDir}`
    );
  }

  // Execute the rename
  try {
    await rename(record.newPath, record.originalPath);
    return createSuccessFileResult(record.originalPath, record.newPath);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return createFailedFileResult(record.originalPath, record.newPath, message);
  }
}

// =============================================================================
// Directory Cleanup Functions
// =============================================================================

/**
 * Clean up empty directories that were created during the original operation.
 *
 * Directories are processed in reverse order (deepest first) to ensure
 * parent directories can be removed after their children.
 *
 * @param directories - List of directories created during original operation
 * @returns List of directories that were successfully removed
 */
export async function cleanupDirectories(directories: string[]): Promise<string[]> {
  const removed: string[] = [];

  // Sort by path length (longest first = deepest directories)
  const sorted = [...directories].sort((a, b) => b.length - a.length);

  for (const dir of sorted) {
    const removeResult = await tryRemoveEmptyDirectory(dir);
    if (removeResult) {
      removed.push(dir);
    }
  }

  return removed;
}

/**
 * Try to remove a directory if it exists and is empty.
 *
 * @param dir - Directory path to remove
 * @returns true if directory was removed, false otherwise
 */
async function tryRemoveEmptyDirectory(dir: string): Promise<boolean> {
  try {
    if (!existsSync(dir)) {
      return false;
    }

    const contents = await readdir(dir);
    if (contents.length > 0) {
      // Directory is not empty, preserve it
      return false;
    }

    await rmdir(dir);
    return true;
  } catch {
    // Failed to remove, preserve the directory
    return false;
  }
}

// =============================================================================
// History Update Functions
// =============================================================================

/**
 * Mark an operation as undone in the history store.
 *
 * @param id - The operation ID to mark as undone
 * @returns Result indicating success or failure
 */
export async function markOperationAsUndone(id: string): Promise<Result<void, Error>> {
  const loadResult = await loadHistory();
  if (!loadResult.ok) {
    return err(loadResult.error);
  }

  const store = loadResult.data;
  const entry = store.entries.find((e) => e.id === id);

  if (!entry) {
    return err(new Error(`Operation not found: ${id}`));
  }

  entry.undoneAt = new Date().toISOString();

  const saveResult = await saveHistory(store);
  if (!saveResult.ok) {
    return err(saveResult.error);
  }

  return ok(undefined);
}

/**
 * Check if an operation has been undone.
 *
 * @param id - The operation ID to check
 * @returns Result with boolean indicating if undone, or error
 */
export async function isOperationUndone(id: string): Promise<Result<boolean, Error>> {
  const entryResult = await getHistoryEntry(id);
  if (!entryResult.ok) {
    return err(entryResult.error);
  }

  if (!entryResult.data) {
    return err(new Error(`Operation not found: ${id}`));
  }

  return ok(entryResult.data.undoneAt !== undefined && entryResult.data.undoneAt !== null);
}
