/**
 * @fileoverview Operation history types for tracking rename/move operations - Story 9.1
 *
 * These types define the structure for recording operation history,
 * enabling undo functionality and operation auditing.
 *
 * @module types/operation-history
 */

import { z } from 'zod';

// =============================================================================
// Constants
// =============================================================================

/**
 * Current version of the history store schema.
 * Increment when making breaking changes to enable migrations.
 */
export const HISTORY_STORE_VERSION = 1;

// =============================================================================
// Operation Type
// =============================================================================

/**
 * Schema for operation types that can be recorded.
 */
export const operationTypeSchema = z.enum(['rename', 'move', 'organize']);

/**
 * Types of operations that can be recorded in history.
 * - rename: Files were renamed in place (same directory)
 * - move: Files were moved to different directories
 * - organize: Files were organized using folder structures
 */
export type OperationType = z.infer<typeof operationTypeSchema>;

// =============================================================================
// File History Record
// =============================================================================

/**
 * Schema for a single file operation record within a batch.
 * Contains all information needed to undo a single file operation.
 */
export const fileHistoryRecordSchema = z.object({
  /** Original file path before operation */
  originalPath: z.string(),
  /** New file path after operation (null if failed) */
  newPath: z.string().nullable(),
  /** Whether this was a move (different directory) */
  isMoveOperation: z.boolean(),
  /** Whether this specific file operation succeeded */
  success: z.boolean(),
  /** Error message if failed */
  error: z.string().nullable(),
});

/**
 * Record of a single file operation within a batch.
 */
export type FileHistoryRecord = z.infer<typeof fileHistoryRecordSchema>;

// =============================================================================
// Operation History Entry
// =============================================================================

/**
 * Schema for summary statistics of an operation.
 */
export const operationSummarySchema = z.object({
  /** Number of successfully renamed/moved files */
  succeeded: z.number().int().nonnegative(),
  /** Number of skipped files */
  skipped: z.number().int().nonnegative(),
  /** Number of failed files */
  failed: z.number().int().nonnegative(),
  /** Number of directories created during operation */
  directoriesCreated: z.number().int().nonnegative(),
});

/**
 * Summary statistics for an operation.
 */
export type OperationSummary = z.infer<typeof operationSummarySchema>;

/**
 * Schema for a single history entry representing one batch operation.
 */
export const operationHistoryEntrySchema = z.object({
  /** Unique identifier for this entry (UUID) */
  id: z.string().uuid(),
  /** When the operation was performed (ISO 8601) */
  timestamp: z.string().datetime(),
  /** Type of operation */
  operationType: operationTypeSchema,
  /** Number of files in the operation */
  fileCount: z.number().int().nonnegative(),
  /** Summary statistics */
  summary: operationSummarySchema,
  /** Duration of the operation in milliseconds */
  durationMs: z.number().int().nonnegative(),
  /** Detailed file records for undo capability */
  files: z.array(fileHistoryRecordSchema),
  /** Directories that were created (for cleanup during undo) */
  directoriesCreated: z.array(z.string()),
  /** When this operation was undone (ISO 8601, null/undefined if not undone) - Story 9.3 */
  undoneAt: z.string().datetime().nullable().optional(),
});

/**
 * A single history entry representing one batch operation.
 * Contains all information needed to review and undo the operation.
 */
export type OperationHistoryEntry = z.infer<typeof operationHistoryEntrySchema>;

// =============================================================================
// History Store
// =============================================================================

/**
 * Schema for the complete history store.
 */
export const historyStoreSchema = z.object({
  /** Schema version for future migrations */
  version: z.number().int().nonnegative(),
  /** Last time pruning was performed (ISO 8601, null if never) */
  lastPruned: z.string().datetime().nullable(),
  /** Operation history entries (newest first) */
  entries: z.array(operationHistoryEntrySchema),
});

/**
 * The complete history store containing all operation entries.
 */
export type HistoryStore = z.infer<typeof historyStoreSchema>;

// =============================================================================
// Prune Configuration
// =============================================================================

/**
 * Schema for history pruning configuration.
 */
export const pruneConfigSchema = z.object({
  /** Maximum number of entries to keep (0 = unlimited) */
  maxEntries: z.number().int().nonnegative().default(100),
  /** Maximum age of entries in days (0 = unlimited) */
  maxAgeDays: z.number().int().nonnegative().default(30),
});

/**
 * Configuration for history pruning.
 */
export type PruneConfig = z.infer<typeof pruneConfigSchema>;

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create an empty history store with default values.
 *
 * @returns A new empty HistoryStore
 */
export function createEmptyHistoryStore(): HistoryStore {
  return {
    version: HISTORY_STORE_VERSION,
    lastPruned: null,
    entries: [],
  };
}
