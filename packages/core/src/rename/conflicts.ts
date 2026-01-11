/**
 * Conflict detection module (Story 4.6)
 *
 * Detects and prevents filename conflicts before renaming.
 *
 * @module rename/conflicts
 */

import { existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { platform } from 'node:os';
import type { RenameProposal } from '../types/rename-proposal.js';
import { ok, err, type Result } from '../types/result.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Conflict codes for different types of filename conflicts.
 */
export const ConflictCode = {
  /** Multiple files in batch would have the same proposed name */
  DUPLICATE_PROPOSED: 'DUPLICATE_PROPOSED',
  /** A file already exists at the proposed path */
  FILE_EXISTS: 'FILE_EXISTS',
  /**
   * Case-only conflict on case-insensitive filesystem.
   * Reserved for future use - currently case conflicts are detected
   * as DUPLICATE_PROPOSED during batch duplicate detection.
   */
  CASE_CONFLICT: 'CASE_CONFLICT',
} as const;

export type ConflictCode = (typeof ConflictCode)[keyof typeof ConflictCode];

/**
 * Information about a single conflict.
 */
export interface ConflictInfo {
  /** Type of conflict */
  code: ConflictCode;
  /** Human-readable description of the conflict */
  message: string;
  /** Paths or proposal IDs of conflicting files */
  conflictingWith: string[];
  /** Suggested resolution (e.g., alternate filename) */
  suggestion?: string;
}

/**
 * Full report of all detected conflicts.
 */
export interface ConflictReport {
  /** Whether any conflicts were detected */
  hasConflicts: boolean;
  /** Map of proposal ID to list of conflicts */
  conflicts: Map<string, ConflictInfo[]>;
  /** Summary counts by conflict type */
  summary: {
    /** Number of proposals with conflicts */
    totalConflicts: number;
    /** Number of duplicate proposed name conflicts */
    duplicateCount: number;
    /** Number of existing file conflicts */
    existingFileCount: number;
    /** Number of case-only conflicts */
    caseConflictCount: number;
  };
}

/**
 * Options for filesystem collision detection.
 */
export interface FilesystemCheckOptions {
  /** Whether to check filesystem for existing files (default: true) */
  checkFileSystem?: boolean;
  /** Whether filesystem is case-sensitive (auto-detected from OS if not specified) */
  caseSensitive?: boolean;
}

// =============================================================================
// Batch Duplicate Detection (AC1)
// =============================================================================

/**
 * Detect duplicate proposed names within a batch of proposals.
 *
 * Uses case-insensitive comparison for cross-platform compatibility.
 * Only detects duplicates within the same directory.
 *
 * @param proposals - Rename proposals to check
 * @returns Map of proposal ID to conflict info
 */
export function detectBatchDuplicates(
  proposals: RenameProposal[]
): Map<string, ConflictInfo[]> {
  const conflicts = new Map<string, ConflictInfo[]>();

  // Build index of proposed names by directory (case-insensitive)
  const nameIndex = new Map<string, RenameProposal[]>();

  for (const proposal of proposals) {
    const dir = dirname(proposal.proposedPath);
    const key = `${dir}:${proposal.proposedName.toLowerCase()}`;

    const existing = nameIndex.get(key) ?? [];
    existing.push(proposal);
    nameIndex.set(key, existing);
  }

  // Find duplicates (entries with more than one proposal)
  for (const [_key, duplicates] of nameIndex) {
    if (duplicates.length > 1) {
      const conflictingPaths = duplicates.map((p) => p.originalPath);

      for (const proposal of duplicates) {
        const others = conflictingPaths.filter((p) => p !== proposal.originalPath);
        const index = duplicates.findIndex((p) => p.id === proposal.id);

        const conflictInfo: ConflictInfo = {
          code: ConflictCode.DUPLICATE_PROPOSED,
          message: `${duplicates.length - 1} other file(s) would have the same name: "${proposal.proposedName}"`,
          conflictingWith: others,
          suggestion: generateCounterSuggestion(proposal.proposedName, index),
        };

        const existing = conflicts.get(proposal.id) ?? [];
        existing.push(conflictInfo);
        conflicts.set(proposal.id, existing);
      }
    }
  }

  return conflicts;
}

/**
 * Generate a suggested filename with counter suffix.
 *
 * @param name - Original filename
 * @param index - Index in duplicate group (0-based)
 * @returns Suggested filename with counter
 */
function generateCounterSuggestion(name: string, index: number): string {
  const lastDot = name.lastIndexOf('.');
  const counter = index + 1;

  if (lastDot === -1) {
    return `${name}_${counter}`;
  }
  return `${name.slice(0, lastDot)}_${counter}${name.slice(lastDot)}`;
}

// =============================================================================
// Filesystem Collision Detection (AC2)
// =============================================================================

/**
 * Detect collisions with existing files on the filesystem.
 *
 * Checks if any proposed path already exists (excluding self-renames).
 * Handles case-sensitivity differences per OS.
 *
 * @param proposals - Rename proposals to check
 * @param options - Filesystem check options
 * @returns Map of proposal ID to conflict info
 */
export function detectFilesystemCollisions(
  proposals: RenameProposal[],
  options: FilesystemCheckOptions = {}
): Map<string, ConflictInfo[]> {
  const { checkFileSystem = true, caseSensitive = detectCaseSensitivity() } = options;
  const conflicts = new Map<string, ConflictInfo[]>();

  if (!checkFileSystem) {
    return conflicts;
  }

  for (const proposal of proposals) {
    // Skip if no actual rename (same path)
    if (proposal.originalPath === proposal.proposedPath) {
      continue;
    }

    // Check case-only rename on case-insensitive systems
    if (
      !caseSensitive &&
      proposal.originalPath.toLowerCase() === proposal.proposedPath.toLowerCase()
    ) {
      // This is a case-only rename on case-insensitive FS - allowed
      continue;
    }

    // Check if target exists
    if (existsSync(proposal.proposedPath)) {
      const conflictInfo: ConflictInfo = {
        code: ConflictCode.FILE_EXISTS,
        message: `A file already exists at "${proposal.proposedPath}"`,
        conflictingWith: [proposal.proposedPath],
        suggestion: generateUniqueSuffix(proposal.proposedName),
      };

      const existing = conflicts.get(proposal.id) ?? [];
      existing.push(conflictInfo);
      conflicts.set(proposal.id, existing);
    }
  }

  return conflicts;
}

/**
 * Detect filesystem case sensitivity based on OS.
 *
 * @returns True if filesystem is case-sensitive (Linux)
 */
function detectCaseSensitivity(): boolean {
  const os = platform();
  // macOS and Windows are case-insensitive by default
  // Linux is case-sensitive
  return os === 'linux';
}

/**
 * Generate a unique suffix using timestamp.
 *
 * @param name - Original filename
 * @returns Filename with timestamp suffix
 */
function generateUniqueSuffix(name: string): string {
  const timestamp = Date.now().toString(36);
  const lastDot = name.lastIndexOf('.');

  if (lastDot === -1) {
    return `${name}_${timestamp}`;
  }
  return `${name.slice(0, lastDot)}_${timestamp}${name.slice(lastDot)}`;
}

// =============================================================================
// Conflict Aggregation
// =============================================================================

/**
 * Detect all conflicts (batch duplicates and filesystem collisions).
 *
 * @param proposals - Rename proposals to check
 * @param options - Filesystem check options
 * @returns Full conflict report
 */
export function detectAllConflicts(
  proposals: RenameProposal[],
  options: FilesystemCheckOptions = {}
): ConflictReport {
  const batchConflicts = detectBatchDuplicates(proposals);
  const fsConflicts = detectFilesystemCollisions(proposals, options);

  // Merge conflicts
  const allConflicts = new Map<string, ConflictInfo[]>();

  for (const [id, conflicts] of batchConflicts) {
    allConflicts.set(id, [...conflicts]);
  }

  for (const [id, conflicts] of fsConflicts) {
    const existing = allConflicts.get(id) ?? [];
    allConflicts.set(id, [...existing, ...conflicts]);
  }

  // Calculate summary
  let duplicateCount = 0;
  let existingFileCount = 0;
  let caseConflictCount = 0;

  for (const conflicts of allConflicts.values()) {
    for (const conflict of conflicts) {
      switch (conflict.code) {
        case ConflictCode.DUPLICATE_PROPOSED:
          duplicateCount++;
          break;
        case ConflictCode.FILE_EXISTS:
          existingFileCount++;
          break;
        case ConflictCode.CASE_CONFLICT:
          caseConflictCount++;
          break;
      }
    }
  }

  return {
    hasConflicts: allConflicts.size > 0,
    conflicts: allConflicts,
    summary: {
      totalConflicts: allConflicts.size,
      duplicateCount,
      existingFileCount,
      caseConflictCount,
    },
  };
}

// =============================================================================
// Execution Blocker (AC3)
// =============================================================================

/**
 * Check for conflicts and return error if any detected.
 *
 * Use this before executing rename operations to ensure safety.
 *
 * @param proposals - Rename proposals to validate
 * @returns Ok if no conflicts, Err with descriptive message otherwise
 */
export function blockOnConflicts(proposals: RenameProposal[]): Result<void> {
  const report = detectAllConflicts(proposals, { checkFileSystem: true });

  if (!report.hasConflicts) {
    return ok(undefined);
  }

  const lines = ['Cannot proceed: filename conflicts detected'];
  lines.push('');
  lines.push(`Total conflicts: ${report.summary.totalConflicts}`);

  if (report.summary.duplicateCount > 0) {
    lines.push(`  - ${report.summary.duplicateCount} duplicate proposed names`);
  }
  if (report.summary.existingFileCount > 0) {
    lines.push(`  - ${report.summary.existingFileCount} files would overwrite existing files`);
  }
  if (report.summary.caseConflictCount > 0) {
    lines.push(`  - ${report.summary.caseConflictCount} case conflicts`);
  }

  lines.push('');
  lines.push('Resolve conflicts before executing rename.');

  return err(new Error(lines.join('\n')));
}
