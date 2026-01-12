/**
 * Rename engine module (Story 4.4)
 *
 * Executes batch rename operations with validation, progress reporting,
 * and cancellation support.
 *
 * @module rename/engine
 */

import { rename } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { access, constants } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { RenameProposal } from '../types/rename-proposal.js';
import type {
  BatchRenameResult,
  FileRenameResult,
  BatchRenameSummary,
} from '../types/rename-result.js';
import { RenameOutcome } from '../types/rename-result.js';
import { ok, err, type Result } from '../types/result.js';
import { findExistingAncestor, ensureDirectory } from './ensure-directory.js';
import { recordOperation } from '../history/recorder.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Options for batch rename execution.
 */
export interface ExecuteRenameOptions {
  /**
   * Callback for progress updates.
   * @param completed - Number of files processed
   * @param total - Total number of files to process
   * @param current - Result of the current file operation
   */
  onProgress?: (completed: number, total: number, current: FileRenameResult) => void;
  /**
   * AbortSignal for cancellation support.
   */
  signal?: AbortSignal;
  /**
   * Skip pre-flight validation (for testing only).
   * @internal
   */
  skipValidation?: boolean;
  /**
   * Create destination directories if they don't exist for move operations.
   * Default: true (Story 8.4)
   *
   * When false, move operations to non-existing directories will fail validation.
   */
  createDirectories?: boolean;
  /**
   * Record operation to history for undo support.
   * Default: true (Story 9.1)
   *
   * When false, the operation will not be recorded to history.
   * Recording failures are handled gracefully (logged, but don't fail the rename).
   */
  recordHistory?: boolean;
}

/**
 * Validation error codes.
 */
export type ValidationErrorCode =
  | 'SOURCE_NOT_FOUND'
  | 'TARGET_EXISTS'
  | 'NO_WRITE_PERMISSION'
  | 'NO_PERMISSION_TO_CREATE_DIRECTORY';

/**
 * Validation error for a single proposal.
 */
export interface ValidationError {
  /** ID of the proposal with the error */
  proposalId: string;
  /** File path related to the error */
  filePath: string;
  /** Error code */
  code: ValidationErrorCode;
  /** Human-readable error message */
  message: string;
}

/**
 * Result of batch validation.
 */
export interface ValidationResult {
  /** Whether all validations passed */
  valid: boolean;
  /** List of validation errors */
  errors: ValidationError[];
}

// =============================================================================
// Validation
// =============================================================================

/**
 * Options for batch rename validation.
 */
export interface ValidateBatchRenameOptions {
  /**
   * Whether directories will be created for move operations.
   * Default: true (Story 8.4)
   *
   * When true, validation skips directory existence checks for move operations
   * and instead checks write permission on the existing ancestor.
   */
  createDirectories?: boolean;
}

/**
 * Validate batch rename proposals before execution.
 *
 * Checks:
 * - All source files exist
 * - No target files would be overwritten (unless same path)
 * - Write permissions on directories
 *
 * @param proposals - Proposals to validate
 * @param options - Validation options
 * @returns Validation result with any errors
 */
export async function validateBatchRename(
  proposals: RenameProposal[],
  options: ValidateBatchRenameOptions = {}
): Promise<Result<ValidationResult, Error>> {
  const { createDirectories = true } = options;
  const errors: ValidationError[] = [];

  try {
    for (const proposal of proposals) {
      // Skip if no change needed
      if (proposal.status === 'no-change') continue;
      // Skip if not ready
      if (proposal.status !== 'ready') continue;

      // Check source file exists
      if (!existsSync(proposal.originalPath)) {
        errors.push({
          proposalId: proposal.id,
          filePath: proposal.originalPath,
          code: 'SOURCE_NOT_FOUND',
          message: `Source file does not exist: ${proposal.originalPath}`,
        });
        continue;
      }

      // Check target doesn't exist (unless it's same file - case change on same path)
      if (
        proposal.proposedPath !== proposal.originalPath &&
        existsSync(proposal.proposedPath)
      ) {
        errors.push({
          proposalId: proposal.id,
          filePath: proposal.proposedPath,
          code: 'TARGET_EXISTS',
          message: `Target file already exists: ${proposal.proposedPath}`,
        });
        continue;
      }

      // Check write permission on source directory
      const sourceDir = dirname(proposal.originalPath);
      try {
        await access(sourceDir, constants.W_OK);
      } catch {
        errors.push({
          proposalId: proposal.id,
          filePath: sourceDir,
          code: 'NO_WRITE_PERMISSION',
          message: `No write permission on source directory: ${sourceDir}`,
        });
        continue;
      }

      // Check write permission on target directory (if different from source)
      const targetDir = dirname(proposal.proposedPath);
      if (targetDir !== sourceDir) {
        // Story 8.4: For move operations with createDirectories=true,
        // check permission on existing ancestor (we'll create missing directories during execution)
        if (createDirectories && proposal.isMoveOperation === true && !existsSync(targetDir)) {
          // Find the nearest existing ancestor and check write permission there
          const ancestorResult = await findExistingAncestor(targetDir);
          if (!ancestorResult.ok) {
            errors.push({
              proposalId: proposal.id,
              filePath: targetDir,
              code: 'NO_PERMISSION_TO_CREATE_DIRECTORY',
              message: `Cannot check directory for creation: ${ancestorResult.error.message}`,
            });
          } else {
            const existingAncestor = ancestorResult.data;
            try {
              await access(existingAncestor, constants.W_OK);
            } catch {
              errors.push({
                proposalId: proposal.id,
                filePath: existingAncestor,
                code: 'NO_PERMISSION_TO_CREATE_DIRECTORY',
                message: `No write permission to create directories under: ${existingAncestor}`,
              });
            }
          }
        } else {
          // Target directory exists or not a move operation - check it directly
          try {
            await access(targetDir, constants.W_OK);
          } catch {
            errors.push({
              proposalId: proposal.id,
              filePath: targetDir,
              code: 'NO_WRITE_PERMISSION',
              message: `No write permission on target directory: ${targetDir}`,
            });
          }
        }
      }
    }

    return ok({
      valid: errors.length === 0,
      errors,
    });
  } catch (error) {
    return err(new Error(`Validation failed: ${(error as Error).message}`));
  }
}

// =============================================================================
// Main Execution
// =============================================================================

/**
 * Execute batch rename operation.
 *
 * Features:
 * - Pre-flight validation (NFR-R2, NFR-R4)
 * - Progress reporting
 * - Cancellation support via AbortSignal
 * - Detailed result tracking
 *
 * @param proposals - Rename proposals to execute
 * @param options - Execution options
 * @returns Batch rename result
 *
 * @example
 * ```typescript
 * const result = await executeBatchRename(proposals, {
 *   onProgress: (completed, total, current) => {
 *     console.log(`[${completed}/${total}] ${current.originalName}`);
 *   },
 * });
 *
 * if (result.ok && result.data.success) {
 *   console.log(`Renamed ${result.data.summary.succeeded} files`);
 * }
 * ```
 */
export async function executeBatchRename(
  proposals: RenameProposal[],
  options: ExecuteRenameOptions = {}
): Promise<Result<BatchRenameResult, Error>> {
  const { onProgress, signal, skipValidation = false, createDirectories = true, recordHistory = true } = options;
  const startedAt = new Date();
  const results: FileRenameResult[] = [];

  // Filter to only actionable proposals (ready status, name or path changes)
  // Story 8.4: Include move operations even if filename stays the same
  const actionable = proposals.filter(
    (p) => p.status === 'ready' && (p.originalName !== p.proposedName || p.isMoveOperation === true)
  );

  // Pre-flight validation (critical for NFR-R2 and NFR-R4)
  if (!skipValidation && actionable.length > 0) {
    const validation = await validateBatchRename(actionable, { createDirectories });
    if (!validation.ok) {
      return err(validation.error);
    }
    if (!validation.data.valid) {
      const firstError = validation.data.errors[0];
      return err(
        new Error(
          `Validation failed: ${String(validation.data.errors.length)} error(s). ` +
            `First: [${firstError?.code}] ${firstError?.message}`
        )
      );
    }
  }

  let aborted = false;
  const directoriesCreated: string[] = [];
  const createdDirSet = new Set<string>(); // Track unique directories

  try {
    // Process each actionable proposal
    for (let i = 0; i < actionable.length; i++) {
      // Check for cancellation
      if (signal?.aborted) {
        aborted = true;
        // Mark remaining as skipped
        for (let j = i; j < actionable.length; j++) {
          // SAFETY: j is bounds-checked in loop condition
          results.push(createSkippedResult(actionable[j]!, 'Operation cancelled'));
        }
        break;
      }

      // SAFETY: i is bounds-checked in loop condition
      const proposal = actionable[i]!;
      const renameResult = await renameFileWithDirCreation(proposal, createdDirSet, createDirectories);
      results.push(renameResult.result);

      // Track newly created directory
      if (renameResult.createdDirectory) {
        directoriesCreated.push(renameResult.createdDirectory);
      }

      // Report progress
      onProgress?.(i + 1, actionable.length, renameResult.result);
    }

    // Add skipped entries for non-actionable proposals
    for (const proposal of proposals) {
      if (proposal.status === 'no-change') {
        results.push(createSkippedResult(proposal, 'No change needed'));
      } else if (proposal.status !== 'ready') {
        results.push(createSkippedResult(proposal, `Status: ${proposal.status}`));
      } else if (proposal.originalName === proposal.proposedName && proposal.isMoveOperation !== true) {
        // Story 8.4: Only skip if name unchanged AND not a move operation
        results.push(createSkippedResult(proposal, 'Name unchanged'));
      }
    }

    const completedAt = new Date();

    const batchResult: BatchRenameResult = {
      success: !results.some((r) => r.outcome === RenameOutcome.FAILED),
      results,
      summary: calculateSummary(results, directoriesCreated.length),
      startedAt,
      completedAt,
      durationMs: completedAt.getTime() - startedAt.getTime(),
      aborted,
      directoriesCreated,
    };

    // Story 9.1: Record operation to history (graceful failure handling)
    if (recordHistory) {
      const historyResult = await recordOperation(batchResult);
      if (historyResult.ok) {
        batchResult.historyEntryId = historyResult.data.id;
      }
      // Recording failures are logged but don't fail the rename operation
    }

    return ok(batchResult);
  } catch (error) {
    // Unexpected error during batch operation - propagate as error Result
    // Note: Individual file failures are captured in results array, not here
    const errorMessage = error instanceof Error ? error.message : String(error);
    return err(new Error(`Batch rename failed unexpectedly: ${errorMessage}`));
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Result of renaming a file, including any directory that was created.
 */
interface RenameWithDirResult {
  result: FileRenameResult;
  createdDirectory?: string;
}

/**
 * Rename a single file, creating the destination directory if needed for move operations.
 * Story 8.4: Integrated directory creation for move operations.
 *
 * @param proposal - The rename proposal
 * @param createdDirs - Set of directories already created (to avoid duplicate tracking)
 * @param createDirectories - Whether to create missing directories (default: true)
 */
async function renameFileWithDirCreation(
  proposal: RenameProposal,
  createdDirs: Set<string>,
  createDirectories: boolean = true
): Promise<RenameWithDirResult> {
  let createdDirectory: string | undefined;

  try {
    // Story 8.4: Create destination directory for move operations if it doesn't exist
    if (createDirectories && proposal.isMoveOperation === true) {
      const targetDir = dirname(proposal.proposedPath);

      if (!existsSync(targetDir)) {
        const dirResult = await ensureDirectory(targetDir);

        if (!dirResult.ok) {
          // Directory creation failed - mark file as failed
          return {
            result: {
              proposalId: proposal.id,
              originalPath: proposal.originalPath,
              originalName: proposal.originalName,
              newPath: null,
              newName: null,
              outcome: RenameOutcome.FAILED,
              error: `Failed to create directory: ${dirResult.error.message}`,
            },
          };
        }

        // Track newly created directory (only if not already tracked)
        if (dirResult.data && !createdDirs.has(targetDir)) {
          createdDirs.add(targetDir);
          createdDirectory = targetDir;
        }
      }
    }

    // Perform the actual rename/move
    await rename(proposal.originalPath, proposal.proposedPath);

    return {
      result: {
        proposalId: proposal.id,
        originalPath: proposal.originalPath,
        originalName: proposal.originalName,
        newPath: proposal.proposedPath,
        newName: proposal.proposedName,
        outcome: RenameOutcome.SUCCESS,
        error: null,
      },
      createdDirectory,
    };
  } catch (error) {
    return {
      result: {
        proposalId: proposal.id,
        originalPath: proposal.originalPath,
        originalName: proposal.originalName,
        newPath: null,
        newName: null,
        outcome: RenameOutcome.FAILED,
        error: (error as Error).message,
      },
    };
  }
}

/**
 * Create a skipped result for a proposal.
 */
function createSkippedResult(proposal: RenameProposal, reason: string): FileRenameResult {
  return {
    proposalId: proposal.id,
    originalPath: proposal.originalPath,
    originalName: proposal.originalName,
    newPath: null,
    newName: null,
    outcome: RenameOutcome.SKIPPED,
    error: reason,
  };
}

/**
 * Calculate summary statistics from results.
 * Uses single-pass reduce for efficiency with large batches (NFR-P4).
 *
 * @param results - Array of file rename results
 * @param directoriesCreatedCount - Number of directories created during execution (Story 8.4)
 */
function calculateSummary(results: FileRenameResult[], directoriesCreatedCount: number = 0): BatchRenameSummary {
  const counts = results.reduce(
    (acc, r) => {
      if (r.outcome === RenameOutcome.SUCCESS) acc.succeeded++;
      else if (r.outcome === RenameOutcome.SKIPPED) acc.skipped++;
      else if (r.outcome === RenameOutcome.FAILED) acc.failed++;
      return acc;
    },
    { succeeded: 0, skipped: 0, failed: 0 }
  );

  return {
    total: results.length,
    ...counts,
    directoriesCreated: directoriesCreatedCount,
  };
}
