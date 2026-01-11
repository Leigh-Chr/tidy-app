/**
 * Issue detection module (Story 4.3)
 *
 * Detects and categorizes issues with rename proposals including:
 * - Duplicate proposed names
 * - File existence conflicts
 * - Case-only conflicts
 * - Missing metadata
 * - Invalid names
 *
 * @module rename/issues
 */

import { dirname } from 'node:path';
import { existsSync } from 'node:fs';
import type { RenameProposal, RenameIssue } from '../types/rename-proposal.js';

// =============================================================================
// Issue Codes
// =============================================================================

/**
 * Issue codes for categorizing rename problems.
 */
export const IssueCode = {
  // Conflict issues
  DUPLICATE_PROPOSED: 'DUPLICATE_PROPOSED',
  FILE_EXISTS: 'FILE_EXISTS',
  CASE_CONFLICT: 'CASE_CONFLICT',

  // Metadata issues
  MISSING_REQUIRED: 'MISSING_REQUIRED',
  INVALID_DATE: 'INVALID_DATE',
  EMPTY_VALUE: 'EMPTY_VALUE',

  // Name issues
  INVALID_CHARACTERS: 'INVALID_CHARACTERS',
  NAME_TOO_LONG: 'NAME_TOO_LONG',
  RESERVED_NAME: 'RESERVED_NAME',

  // Processing issues
  TEMPLATE_ERROR: 'TEMPLATE_ERROR',
  SANITIZATION_REQUIRED: 'SANITIZATION_REQUIRED',
} as const;

export type IssueCodeType = (typeof IssueCode)[keyof typeof IssueCode];

// =============================================================================
// Issue Severity
// =============================================================================

/**
 * Severity levels for issues.
 */
export const IssueSeverity = {
  /** Blocks rename - must be resolved */
  ERROR: 'error',
  /** Rename possible but may have issues */
  WARNING: 'warning',
  /** Informational only */
  INFO: 'info',
} as const;

export type IssueSeverityType = (typeof IssueSeverity)[keyof typeof IssueSeverity];

// =============================================================================
// Types
// =============================================================================

/**
 * Extended issue with severity, suggestions, and auto-fix capability.
 */
export interface DetailedIssue extends RenameIssue {
  /** Severity level of the issue */
  severity: IssueSeverityType;
  /** Human-readable suggestion for resolving the issue */
  suggestion?: string;
  /** Whether this issue can be automatically fixed */
  autoFixable: boolean;
  /** Function that returns the fixed value (if autoFixable) */
  autoFixAction?: () => string;
}

/**
 * Report of issues for a single proposal.
 */
export interface IssueReport {
  /** ID of the proposal */
  proposalId: string;
  /** Path to the original file */
  filePath: string;
  /** Original filename */
  fileName: string;
  /** List of detected issues */
  issues: DetailedIssue[];
  /** Whether rename can proceed despite issues */
  canProceed: boolean;
}

/**
 * Context for issue detection.
 */
export interface DetectionContext {
  /** All proposals in the batch (for duplicate detection) */
  proposals: RenameProposal[];
  /** Whether to check filesystem for existing files */
  checkFileSystem?: boolean;
  /** Set of existing file paths (for testing without filesystem access) */
  existingFiles?: Set<string>;
}

// =============================================================================
// Main Detection Function
// =============================================================================

/**
 * Detect issues with a rename proposal.
 *
 * @param proposal - The proposal to check
 * @param context - Detection context with other proposals
 * @returns Array of detailed issues found
 *
 * @example
 * ```typescript
 * const issues = detectIssues(proposal, { proposals: allProposals });
 * if (issues.some(i => i.severity === 'error')) {
 *   console.log('Cannot proceed with rename');
 * }
 * ```
 */
export function detectIssues(
  proposal: RenameProposal,
  context: DetectionContext
): DetailedIssue[] {
  const issues: DetailedIssue[] = [];
  const proposals = context.proposals;

  // Check for duplicate proposed names within batch (exact match)
  const duplicates = findDuplicateNames(proposal, proposals);
  if (duplicates.length > 0) {
    // Calculate sequential counter based on position in batch
    const counter = calculateSequentialCounter(proposal, proposals);
    issues.push({
      code: IssueCode.DUPLICATE_PROPOSED,
      message: `${String(duplicates.length)} other file(s) would have the same name`,
      severity: IssueSeverity.ERROR,
      suggestion: 'Add unique identifier like counter or timestamp',
      autoFixable: true,
      autoFixAction: () => addCounter(proposal.proposedName, counter),
    });
  }

  // Check if file already exists at proposed path
  if (context.checkFileSystem) {
    const fileExists = context.existingFiles
      ? context.existingFiles.has(proposal.proposedPath)
      : existsSync(proposal.proposedPath);

    if (fileExists) {
      issues.push({
        code: IssueCode.FILE_EXISTS,
        message: 'A file with this name already exists',
        severity: IssueSeverity.ERROR,
        suggestion: 'Choose a different name or add a suffix',
        autoFixable: true,
        autoFixAction: () => addSuffix(proposal.proposedName, '_new'),
      });
    }
  }

  // Check for case-only conflicts (important for case-insensitive filesystems)
  const caseConflicts = findCaseConflicts(proposal, proposals);
  if (caseConflicts.length > 0) {
    issues.push({
      code: IssueCode.CASE_CONFLICT,
      message: 'Name differs only in letter case from another file',
      severity: IssueSeverity.WARNING,
      suggestion: 'On some systems, these may be considered the same file',
      autoFixable: false,
    });
  }

  return issues;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Find proposals with duplicate names (exact match) in the same directory.
 */
function findDuplicateNames(
  proposal: RenameProposal,
  allProposals: RenameProposal[]
): RenameProposal[] {
  const dir = dirname(proposal.proposedPath);
  return allProposals.filter(
    (p) =>
      p.id !== proposal.id &&
      dirname(p.proposedPath) === dir &&
      p.proposedName === proposal.proposedName
  );
}

/**
 * Calculate a sequential counter for a proposal among its duplicates.
 * Each duplicate gets a unique counter (1, 2, 3, ...) based on position.
 */
function calculateSequentialCounter(
  proposal: RenameProposal,
  allProposals: RenameProposal[]
): number {
  const dir = dirname(proposal.proposedPath);
  // Find all proposals with same name in same directory (including this one)
  const sameNameProposals = allProposals.filter(
    (p) => dirname(p.proposedPath) === dir && p.proposedName === proposal.proposedName
  );
  // Find this proposal's position among duplicates
  const index = sameNameProposals.findIndex((p) => p.id === proposal.id);
  // Return 1-based counter (first gets _2, second gets _3, etc. since original would be _1)
  return index + 1;
}

/**
 * Find proposals with case-only conflicts (same name, different case).
 */
function findCaseConflicts(
  proposal: RenameProposal,
  allProposals: RenameProposal[]
): RenameProposal[] {
  const dir = dirname(proposal.proposedPath);
  return allProposals.filter(
    (p) =>
      p.id !== proposal.id &&
      dirname(p.proposedPath) === dir &&
      p.proposedName.toLowerCase() === proposal.proposedName.toLowerCase() &&
      p.proposedName !== proposal.proposedName
  );
}

/**
 * Add a counter suffix to a filename to make it unique.
 */
export function addCounter(name: string, index: number): string {
  const lastDot = name.lastIndexOf('.');
  if (lastDot === -1) {
    return `${name}_${String(index + 1)}`;
  }
  return `${name.slice(0, lastDot)}_${String(index + 1)}${name.slice(lastDot)}`;
}

/**
 * Add a suffix to a filename before the extension.
 */
export function addSuffix(name: string, suffix: string): string {
  const lastDot = name.lastIndexOf('.');
  if (lastDot === -1) {
    return `${name}${suffix}`;
  }
  return `${name.slice(0, lastDot)}${suffix}${name.slice(lastDot)}`;
}

/**
 * Convert proposal issues to detailed issues.
 *
 * Proposal issues come from template preview (missing data, invalid names).
 * This function enriches them with severity and fixability information.
 */
export function convertProposalIssues(
  proposalIssues: RenameIssue[]
): DetailedIssue[] {
  return proposalIssues.map((issue) => {
    const severity = getSeverityForCode(issue.code);
    const suggestion = getSuggestionForCode(issue.code, issue.field);

    return {
      ...issue,
      severity,
      suggestion,
      autoFixable: isAutoFixable(issue.code),
    };
  });
}

/**
 * Get severity for an issue code.
 */
function getSeverityForCode(code: string): IssueSeverityType {
  if (code.includes('MISSING') || code.includes('EMPTY')) {
    return IssueSeverity.WARNING;
  }
  if (code.includes('INVALID') || code.includes('CONFLICT') || code.includes('EXISTS')) {
    return IssueSeverity.ERROR;
  }
  return IssueSeverity.INFO;
}

/**
 * Get suggestion for an issue code.
 */
function getSuggestionForCode(code: string, field?: string): string | undefined {
  if (code.includes('MISSING') && field) {
    return `Provide a value for ${field} or use a fallback`;
  }
  if (code.includes('EMPTY')) {
    return 'Use a fallback value or different placeholder';
  }
  if (code.includes('INVALID')) {
    return 'Remove or replace invalid characters';
  }
  return undefined;
}

/**
 * Check if an issue code is auto-fixable.
 */
function isAutoFixable(code: string): boolean {
  return code.includes('DUPLICATE') || code.includes('EXISTS') || code.includes('SANITIZATION');
}

/**
 * Create an issue report from a proposal and its issues.
 */
export function createIssueReport(
  proposal: RenameProposal,
  issues: DetailedIssue[]
): IssueReport {
  const hasBlockingIssue = issues.some((i) => i.severity === IssueSeverity.ERROR);

  return {
    proposalId: proposal.id,
    filePath: proposal.originalPath,
    fileName: proposal.originalName,
    issues,
    canProceed: !hasBlockingIssue,
  };
}
