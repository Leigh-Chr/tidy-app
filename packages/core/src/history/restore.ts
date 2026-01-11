/**
 * @fileoverview Restore engine for restoring files to original names - Story 9.4
 *
 * Provides functions to restore files to their original names using history.
 * Can restore individual files by path or delegate to undo for operation-level restores.
 *
 * @module history/restore
 */

import { rename } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { ok, err, type Result } from '../types/result.js';
import type { RestoreResult, RestoreOptions } from '../types/restore-result.js';
import {
  createSuccessRestoreResult,
  createFailedRestoreResult,
  createMessageRestoreResult,
} from '../types/restore-result.js';
import { lookupFileHistory } from './lookup.js';
import { undoOperation } from './undo.js';

// =============================================================================
// Main Restore Function
// =============================================================================

/**
 * Restore a file to its original name using history.
 *
 * This function can:
 * 1. Restore a specific file by path to its original name
 * 2. Lookup file history without restoring (when lookup=true)
 * 3. Restore all files from an operation (delegates to undo when operationId provided)
 * 4. Preview the restore without executing (when dryRun=true)
 *
 * @param path - The file path to restore (can be current or original path)
 * @param options - Restore options
 * @returns Result with restore details or error
 *
 * @example
 * ```typescript
 * // Restore a file to its original name
 * const result = await restoreFile('/photos/renamed-photo.jpg');
 *
 * // Preview restore without executing
 * const result = await restoreFile('/photos/renamed-photo.jpg', { dryRun: true });
 *
 * // Just lookup file history
 * const result = await restoreFile('/photos/photo.jpg', { lookup: true });
 *
 * // Restore all files from an operation
 * const result = await restoreFile('', { operationId: 'uuid-here' });
 * ```
 */
export async function restoreFile(
  path: string,
  options: RestoreOptions = {}
): Promise<Result<RestoreResult, Error>> {
  const startTime = Date.now();
  const { dryRun = false, operationId, lookup = false } = options;

  // If operation ID provided, delegate to undo
  if (operationId) {
    return restoreByOperationId(operationId, path, dryRun, startTime);
  }

  // Validate path is provided for file-based restore
  if (!path) {
    return ok(createFailedRestoreResult(
      '',
      'File path is required',
      Date.now() - startTime
    ));
  }

  // Lookup file history
  const lookupResult = await lookupFileHistory(path);
  if (!lookupResult.ok) {
    return err(lookupResult.error);
  }

  // File not in history
  if (!lookupResult.data) {
    return ok(createFailedRestoreResult(
      path,
      `No history found for file: ${path}`,
      Date.now() - startTime
    ));
  }

  const fileHistory = lookupResult.data;

  // If lookup mode, return the lookup info as a result
  if (lookup) {
    return ok({
      success: true,
      dryRun: true, // Lookup is always a preview
      searchedPath: path,
      originalPath: fileHistory.originalPath,
      previousPath: fileHistory.currentPath,
      operationId: fileHistory.lastOperationId,
      error: null,
      message: 'Lookup completed',
      durationMs: Date.now() - startTime,
    });
  }

  // Check if already at original location
  if (fileHistory.isAtOriginal) {
    return ok(createMessageRestoreResult(
      path,
      'File is already at original location',
      Date.now() - startTime,
      fileHistory.originalPath,
      fileHistory.lastOperationId
    ));
  }

  // Validate current file exists
  if (!fileHistory.currentPath || !existsSync(fileHistory.currentPath)) {
    return ok(createFailedRestoreResult(
      path,
      'File no longer exists at expected location. It may have been moved or deleted.',
      Date.now() - startTime,
      fileHistory.originalPath,
      fileHistory.currentPath,
      fileHistory.lastOperationId
    ));
  }

  // Validate original path is not occupied
  if (fileHistory.originalPath && existsSync(fileHistory.originalPath)) {
    return ok(createFailedRestoreResult(
      path,
      'Original path is now occupied by another file',
      Date.now() - startTime,
      fileHistory.originalPath,
      fileHistory.currentPath,
      fileHistory.lastOperationId
    ));
  }

  // Validate original path has valid parent directory
  if (fileHistory.originalPath) {
    const originalDir = dirname(fileHistory.originalPath);
    if (!existsSync(originalDir)) {
      return ok(createFailedRestoreResult(
        path,
        `Parent directory does not exist: ${originalDir}`,
        Date.now() - startTime,
        fileHistory.originalPath,
        fileHistory.currentPath,
        fileHistory.lastOperationId
      ));
    }
  }

  // Dry-run: return preview without executing
  if (dryRun) {
    return ok({
      success: true,
      dryRun: true,
      searchedPath: path,
      originalPath: fileHistory.originalPath,
      previousPath: fileHistory.currentPath,
      operationId: fileHistory.lastOperationId,
      error: null,
      message: null,
      durationMs: Date.now() - startTime,
    });
  }

  // Final safety check for original path
  if (!fileHistory.originalPath) {
    return ok(createFailedRestoreResult(
      path,
      'Original path is unknown',
      Date.now() - startTime,
      null,
      fileHistory.currentPath,
      fileHistory.lastOperationId
    ));
  }

  // Execute the restore
  try {
    await rename(fileHistory.currentPath, fileHistory.originalPath);
    return ok(createSuccessRestoreResult(
      path,
      fileHistory.originalPath,
      fileHistory.currentPath,
      fileHistory.lastOperationId,
      Date.now() - startTime
    ));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return ok(createFailedRestoreResult(
      path,
      message,
      Date.now() - startTime,
      fileHistory.originalPath,
      fileHistory.currentPath,
      fileHistory.lastOperationId
    ));
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Restore all files from an operation by delegating to undo.
 *
 * @param operationId - The operation ID to restore
 * @param searchedPath - The original path searched (for result)
 * @param dryRun - Whether to preview only
 * @param startTime - Start time for duration calculation
 * @returns RestoreResult converted from UndoResult
 */
async function restoreByOperationId(
  operationId: string,
  searchedPath: string,
  dryRun: boolean,
  startTime: number
): Promise<Result<RestoreResult, Error>> {
  const undoResult = await undoOperation(operationId, { dryRun });

  if (!undoResult.ok) {
    return err(undoResult.error);
  }

  const undo = undoResult.data;

  // Convert UndoResult to RestoreResult
  // For operation-level restore, we summarize the undo result
  if (!undo.success && undo.filesFailed > 0) {
    return ok({
      success: false,
      dryRun: undo.dryRun,
      searchedPath: searchedPath || `operation:${operationId}`,
      originalPath: null,
      previousPath: null,
      operationId: undo.operationId,
      error: `Restore failed: ${undo.filesFailed} file(s) could not be restored`,
      message: null,
      durationMs: Date.now() - startTime,
    });
  }

  return ok({
    success: undo.success,
    dryRun: undo.dryRun,
    searchedPath: searchedPath || `operation:${operationId}`,
    originalPath: null, // Multiple files, no single path
    previousPath: null,
    operationId: undo.operationId,
    error: null,
    message: `Restored ${undo.filesRestored} file(s) from operation`,
    durationMs: Date.now() - startTime,
  });
}

/**
 * Restore a file and return detailed result.
 *
 * Convenience wrapper that provides more detailed error messages.
 *
 * @param path - File path to restore
 * @param dryRun - Whether to preview only
 * @returns Detailed restore result
 */
export async function restoreFileWithDetails(
  path: string,
  dryRun: boolean = false
): Promise<Result<RestoreResult, Error>> {
  return restoreFile(path, { dryRun });
}

/**
 * Check if a file can be restored.
 *
 * Performs all validation checks without actually restoring.
 *
 * @param path - File path to check
 * @returns true if file can be restored, false otherwise
 */
export async function canRestoreFile(
  path: string
): Promise<Result<boolean, Error>> {
  const result = await restoreFile(path, { dryRun: true });

  if (!result.ok) {
    return err(result.error);
  }

  return ok(result.data.success && !result.data.message);
}
