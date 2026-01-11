/**
 * Rename result types for batch rename operations.
 *
 * @module types/rename-result
 */

import { z } from 'zod';

// =============================================================================
// Rename Outcome
// =============================================================================

/**
 * Possible outcomes for a single file rename operation.
 */
export const RenameOutcome = {
  /** File was successfully renamed */
  SUCCESS: 'success',
  /** File was skipped (no change needed or cancelled) */
  SKIPPED: 'skipped',
  /** Rename failed with an error */
  FAILED: 'failed',
} as const;

export type RenameOutcomeType = (typeof RenameOutcome)[keyof typeof RenameOutcome];

// =============================================================================
// File Rename Result
// =============================================================================

/**
 * Zod enum derived from RenameOutcome constant for type safety.
 */
const renameOutcomeValues = [
  RenameOutcome.SUCCESS,
  RenameOutcome.SKIPPED,
  RenameOutcome.FAILED,
] as const;

/**
 * Schema for individual file rename result.
 */
export const fileRenameResultSchema = z.object({
  /** ID of the proposal this result corresponds to */
  proposalId: z.string(),
  /** Original file path */
  originalPath: z.string(),
  /** Original filename */
  originalName: z.string(),
  /** New file path (null if not renamed) */
  newPath: z.string().nullable(),
  /** New filename (null if not renamed) */
  newName: z.string().nullable(),
  /** Outcome of the rename operation - linked to RenameOutcome constant */
  outcome: z.enum(renameOutcomeValues),
  /** Error message if failed or skipped */
  error: z.string().nullable(),
});

export type FileRenameResult = z.infer<typeof fileRenameResultSchema>;

// =============================================================================
// Batch Rename Summary
// =============================================================================

/**
 * Schema for batch rename summary statistics.
 */
export const batchRenameSummarySchema = z.object({
  /** Total number of files processed */
  total: z.number(),
  /** Number of successfully renamed files */
  succeeded: z.number(),
  /** Number of skipped files */
  skipped: z.number(),
  /** Number of failed files */
  failed: z.number(),
  /** Number of directories created during execution (Story 8.4) */
  directoriesCreated: z.number(),
});

export type BatchRenameSummary = z.infer<typeof batchRenameSummarySchema>;

// =============================================================================
// Batch Rename Result
// =============================================================================

/**
 * Schema for complete batch rename operation result.
 */
export const batchRenameResultSchema = z.object({
  /** Whether the overall operation was successful (no failures) */
  success: z.boolean(),
  /** Results for each file */
  results: z.array(fileRenameResultSchema),
  /** Summary statistics */
  summary: batchRenameSummarySchema,
  /** When the operation started */
  startedAt: z.date(),
  /** When the operation completed */
  completedAt: z.date(),
  /** Duration in milliseconds */
  durationMs: z.number(),
  /** Whether the operation was aborted */
  aborted: z.boolean(),
  /** Directories created during execution (Story 8.4) */
  directoriesCreated: z.array(z.string()),
  /** History entry ID for undo support (Story 9.1) */
  historyEntryId: z.string().uuid().optional(),
});

export type BatchRenameResult = z.infer<typeof batchRenameResultSchema>;
