/**
 * @fileoverview Undo operation result types - Story 9.3
 *
 * Types for representing the result of undoing a rename/move operation.
 * Used by the undo engine to report success, failures, and partial results.
 *
 * @module types/undo-result
 */

import { z } from 'zod';

// =============================================================================
// Undo File Result
// =============================================================================

/**
 * Schema for the result of undoing a single file operation.
 */
export const undoFileResultSchema = z.object({
  /** Original path from history (where file should be restored to) */
  originalPath: z.string(),
  /** Current path (where file was moved to, null if original operation failed) */
  currentPath: z.string().nullable(),
  /** Whether this file was successfully restored */
  success: z.boolean(),
  /** Error message if failed */
  error: z.string().nullable(),
  /** Reason if skipped (e.g., original operation failed) */
  skipReason: z.string().nullable(),
});

/**
 * Result of undoing a single file operation.
 */
export type UndoFileResult = z.infer<typeof undoFileResultSchema>;

// =============================================================================
// Undo Result
// =============================================================================

/**
 * Schema for the complete result of an undo operation.
 */
export const undoResultSchema = z.object({
  /** The operation ID that was undone */
  operationId: z.string().uuid(),
  /** Whether the undo was successful overall */
  success: z.boolean(),
  /** Whether this was a dry-run (preview only) */
  dryRun: z.boolean(),
  /** Number of files successfully restored */
  filesRestored: z.number().int().nonnegative(),
  /** Number of files skipped (original operation failed) */
  filesSkipped: z.number().int().nonnegative(),
  /** Number of files that failed to restore */
  filesFailed: z.number().int().nonnegative(),
  /** Directories that were removed (empty dirs created by original operation) */
  directoriesRemoved: z.array(z.string()),
  /** Detailed results per file */
  files: z.array(undoFileResultSchema),
  /** Duration of the undo operation in milliseconds */
  durationMs: z.number().int().nonnegative(),
});

/**
 * Result of an undo operation.
 */
export type UndoResult = z.infer<typeof undoResultSchema>;

// =============================================================================
// Undo Options
// =============================================================================

/**
 * Schema for undo operation options.
 */
export const undoOptionsSchema = z.object({
  /** If true, preview changes without executing */
  dryRun: z.boolean().optional(),
  /** Force undo even if some files can't be restored */
  force: z.boolean().optional(),
});

/**
 * Options for undo operation.
 */
export interface UndoOptions {
  /** If true, preview changes without executing */
  dryRun?: boolean;
  /** Force undo even if some files can't be restored */
  force?: boolean;
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create an empty UndoResult for initialization.
 *
 * @param operationId - The operation ID being undone
 * @param dryRun - Whether this is a dry-run
 * @returns A new UndoResult with zero counts
 */
export function createEmptyUndoResult(operationId: string, dryRun: boolean = false): UndoResult {
  return {
    operationId,
    success: true,
    dryRun,
    filesRestored: 0,
    filesSkipped: 0,
    filesFailed: 0,
    directoriesRemoved: [],
    files: [],
    durationMs: 0,
  };
}

/**
 * Create an UndoFileResult for a successful restoration.
 *
 * @param originalPath - Where the file was restored to
 * @param currentPath - Where the file was before restoration
 * @returns Success UndoFileResult
 */
export function createSuccessFileResult(originalPath: string, currentPath: string): UndoFileResult {
  return {
    originalPath,
    currentPath,
    success: true,
    error: null,
    skipReason: null,
  };
}

/**
 * Create an UndoFileResult for a failed restoration.
 *
 * @param originalPath - Where the file should have been restored to
 * @param currentPath - Where the file currently is (or null if unknown)
 * @param error - Error message describing the failure
 * @returns Failed UndoFileResult
 */
export function createFailedFileResult(
  originalPath: string,
  currentPath: string | null,
  error: string
): UndoFileResult {
  return {
    originalPath,
    currentPath,
    success: false,
    error,
    skipReason: null,
  };
}

/**
 * Create an UndoFileResult for a skipped file.
 *
 * @param originalPath - The original path from history
 * @param currentPath - Where the file currently is (or null)
 * @param skipReason - Reason the file was skipped
 * @returns Skipped UndoFileResult
 */
export function createSkippedFileResult(
  originalPath: string,
  currentPath: string | null,
  skipReason: string
): UndoFileResult {
  return {
    originalPath,
    currentPath,
    success: false,
    error: null,
    skipReason,
  };
}
