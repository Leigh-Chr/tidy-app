/**
 * @fileoverview Restore operation result types - Story 9.4
 *
 * Types for representing the result of restoring a file to its original name
 * and looking up file history. Used by the restore engine to report success,
 * failures, and history information.
 *
 * @module types/restore-result
 */

import { z } from 'zod';

// =============================================================================
// File Operation History Entry (for lookup results)
// =============================================================================

/**
 * Schema for a single operation that affected a file.
 */
export const fileOperationEntrySchema = z.object({
  /** The operation ID */
  operationId: z.string().uuid(),
  /** When the operation occurred */
  timestamp: z.string(),
  /** Type of operation (rename, move, organize) */
  operationType: z.string(),
  /** Original path before operation */
  originalPath: z.string(),
  /** New path after operation (null if operation failed) */
  newPath: z.string().nullable(),
});

/**
 * A single operation that affected a file.
 */
export type FileOperationEntry = z.infer<typeof fileOperationEntrySchema>;

// =============================================================================
// File History Lookup
// =============================================================================

/**
 * Schema for the result of looking up a file's history.
 */
export const fileHistoryLookupSchema = z.object({
  /** The path that was searched */
  searchedPath: z.string(),
  /** Whether the file was found in history */
  found: z.boolean(),
  /** Original path before any operations */
  originalPath: z.string().nullable(),
  /** Current path (most recent newPath from history) */
  currentPath: z.string().nullable(),
  /** Operation ID that last modified this file */
  lastOperationId: z.string().uuid().nullable(),
  /** Timestamp of last modification */
  lastModified: z.string().nullable(),
  /** Whether the file is currently at its original location */
  isAtOriginal: z.boolean(),
  /** All operations that affected this file */
  operations: z.array(fileOperationEntrySchema),
});

/**
 * Result of looking up a file's history.
 */
export type FileHistoryLookup = z.infer<typeof fileHistoryLookupSchema>;

// =============================================================================
// Restore Result
// =============================================================================

/**
 * Schema for the result of a restore operation.
 */
export const restoreResultSchema = z.object({
  /** Whether the restore was successful */
  success: z.boolean(),
  /** Whether this was a dry-run (preview only) */
  dryRun: z.boolean(),
  /** The path that was searched/restored */
  searchedPath: z.string(),
  /** Original path the file was restored to */
  originalPath: z.string().nullable(),
  /** Path the file was at before restoration */
  previousPath: z.string().nullable(),
  /** Operation ID this file belonged to */
  operationId: z.string().uuid().nullable(),
  /** Error message if failed */
  error: z.string().nullable(),
  /** Message for informational cases (e.g., already at original) */
  message: z.string().nullable(),
  /** Duration of the restore operation in milliseconds */
  durationMs: z.number().int().nonnegative(),
});

/**
 * Result of a restore operation.
 */
export type RestoreResult = z.infer<typeof restoreResultSchema>;

// =============================================================================
// Restore Options
// =============================================================================

/**
 * Schema for restore operation options.
 */
export const restoreOptionsSchema = z.object({
  /** If true, preview changes without executing */
  dryRun: z.boolean().optional(),
  /** Restore all files from a specific operation (delegates to undo) */
  operationId: z.string().uuid().optional(),
  /** Just lookup file history, don't restore */
  lookup: z.boolean().optional(),
});

/**
 * Options for restore operation.
 */
export interface RestoreOptions {
  /** If true, preview changes without executing */
  dryRun?: boolean;
  /** Restore all files from a specific operation (delegates to undo) */
  operationId?: string;
  /** Just lookup file history, don't restore */
  lookup?: boolean;
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a RestoreResult for a successful restoration.
 *
 * @param searchedPath - The path that was searched
 * @param originalPath - The original path the file was restored to
 * @param previousPath - The path the file was at before restoration
 * @param operationId - The operation ID this file belonged to
 * @param durationMs - Duration of the operation
 * @returns Success RestoreResult
 */
export function createSuccessRestoreResult(
  searchedPath: string,
  originalPath: string,
  previousPath: string,
  operationId: string | null,
  durationMs: number
): RestoreResult {
  return {
    success: true,
    dryRun: false,
    searchedPath,
    originalPath,
    previousPath,
    operationId,
    error: null,
    message: null,
    durationMs,
  };
}

/**
 * Create a RestoreResult for a failed restoration.
 *
 * @param searchedPath - The path that was searched
 * @param error - Error message describing the failure
 * @param durationMs - Duration of the operation
 * @param originalPath - The original path (if known)
 * @param previousPath - The previous path (if known)
 * @param operationId - The operation ID (if known)
 * @returns Failed RestoreResult
 */
export function createFailedRestoreResult(
  searchedPath: string,
  error: string,
  durationMs: number,
  originalPath: string | null = null,
  previousPath: string | null = null,
  operationId: string | null = null
): RestoreResult {
  return {
    success: false,
    dryRun: false,
    searchedPath,
    originalPath,
    previousPath,
    operationId,
    error,
    message: null,
    durationMs,
  };
}

/**
 * Create a RestoreResult with an informational message.
 *
 * @param searchedPath - The path that was searched
 * @param message - Informational message
 * @param durationMs - Duration of the operation
 * @param originalPath - The original path
 * @param operationId - The operation ID
 * @returns RestoreResult with message
 */
export function createMessageRestoreResult(
  searchedPath: string,
  message: string,
  durationMs: number,
  originalPath: string | null = null,
  operationId: string | null = null
): RestoreResult {
  return {
    success: true,
    dryRun: false,
    searchedPath,
    originalPath,
    previousPath: originalPath, // Same as original when already at original
    operationId,
    error: null,
    message,
    durationMs,
  };
}

/**
 * Create an empty FileHistoryLookup for files not found in history.
 *
 * @param searchedPath - The path that was searched
 * @returns Empty FileHistoryLookup
 */
export function createEmptyFileHistoryLookup(searchedPath: string): FileHistoryLookup {
  return {
    searchedPath,
    found: false,
    originalPath: null,
    currentPath: null,
    lastOperationId: null,
    lastModified: null,
    isAtOriginal: false,
    operations: [],
  };
}
