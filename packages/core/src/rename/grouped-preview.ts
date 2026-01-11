/**
 * Grouped preview module (Story 4.3)
 *
 * Groups rename proposals by status for clearer display.
 * Separates ready files from problematic ones and categorizes issues.
 *
 * @module rename/grouped-preview
 */

import type { RenamePreview, RenameProposal } from '../types/rename-proposal.js';
import {
  detectIssues,
  convertProposalIssues,
  createIssueReport,
  type IssueReport,
  type DetailedIssue,
} from './issues.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Preview grouped by status for display.
 */
export interface GroupedPreview {
  /** Files ready to be renamed (no issues) */
  ready: RenameProposal[];
  /** Files with issues, categorized by type */
  issues: {
    /** Files with naming conflicts (duplicates, collisions) */
    conflicts: IssueReport[];
    /** Files with missing metadata */
    missingData: IssueReport[];
    /** Files with invalid proposed names */
    invalidNames: IssueReport[];
    /** Other issues */
    other: IssueReport[];
  };
  /** Files that would not change */
  unchanged: RenameProposal[];
  /** Summary statistics */
  summary: GroupedSummary;
}

/**
 * Summary statistics for grouped preview.
 */
export interface GroupedSummary {
  /** Count of files ready to rename */
  totalReady: number;
  /** Count of files with issues */
  totalIssues: number;
  /** Count of unchanged files */
  totalUnchanged: number;
  /** Count of files that can proceed (ready + warnings) */
  canProceedCount: number;
  /** Count of files blocked by errors */
  blockedCount: number;
  /** Total number of files in the preview */
  totalFiles: number;
  /** Percentage of files ready to rename (0-100) */
  readyPercent: number;
  /** Percentage of files with issues (0-100) */
  issuesPercent: number;
  /** Percentage of files that can proceed (0-100) */
  canProceedPercent: number;
}

/**
 * Options for grouping.
 */
export interface GroupOptions {
  /** Whether to check filesystem for existing files */
  checkFileSystem?: boolean;
  /** Set of existing file paths (for testing) */
  existingFiles?: Set<string>;
}

// =============================================================================
// Main Function
// =============================================================================

/**
 * Group preview proposals by status.
 *
 * @param preview - The rename preview to group
 * @param options - Grouping options
 * @returns Grouped preview with categorized issues
 *
 * @example
 * ```typescript
 * const grouped = groupPreviewByStatus(preview);
 * console.log(`${grouped.summary.totalReady} ready, ${grouped.summary.totalIssues} issues`);
 * ```
 */
export function groupPreviewByStatus(
  preview: RenamePreview,
  options: GroupOptions = {}
): GroupedPreview {
  const ready: RenameProposal[] = [];
  const unchanged: RenameProposal[] = [];
  const conflicts: IssueReport[] = [];
  const missingData: IssueReport[] = [];
  const invalidNames: IssueReport[] = [];
  const other: IssueReport[] = [];

  const context = {
    proposals: preview.proposals,
    checkFileSystem: options.checkFileSystem,
    existingFiles: options.existingFiles,
  };

  for (const proposal of preview.proposals) {
    // Handle unchanged files first
    if (proposal.status === 'no-change') {
      unchanged.push(proposal);
      continue;
    }

    // Detect additional issues (duplicates, etc.)
    const detectedIssues = detectIssues(proposal, context);

    // Convert proposal's existing issues to detailed issues
    const existingDetailedIssues = convertProposalIssues(proposal.issues);

    // Combine all issues
    const allIssues: DetailedIssue[] = [...existingDetailedIssues, ...detectedIssues];

    // If no issues and status is ready, add to ready list
    if (proposal.status === 'ready' && allIssues.length === 0) {
      ready.push(proposal);
    } else if (allIssues.length > 0 || proposal.status !== 'ready') {
      // Create issue report and categorize
      const report = createIssueReport(proposal, allIssues);
      categorizeIssueReport(proposal, report, { conflicts, missingData, invalidNames, other });
    } else {
      // Ready with no issues
      ready.push(proposal);
    }
  }

  return {
    ready,
    issues: { conflicts, missingData, invalidNames, other },
    unchanged,
    summary: calculateGroupedSummary(
      ready,
      unchanged,
      [...conflicts, ...missingData, ...invalidNames, ...other]
    ),
  };
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Categorize an issue report based on the primary issue type.
 */
function categorizeIssueReport(
  proposal: RenameProposal,
  report: IssueReport,
  categories: {
    conflicts: IssueReport[];
    missingData: IssueReport[];
    invalidNames: IssueReport[];
    other: IssueReport[];
  }
): void {
  // Categorize by proposal status first, then by primary issue code
  if (proposal.status === 'conflict') {
    categories.conflicts.push(report);
    return;
  }

  if (proposal.status === 'missing-data') {
    categories.missingData.push(report);
    return;
  }

  if (proposal.status === 'invalid-name') {
    categories.invalidNames.push(report);
    return;
  }

  // Fall back to issue code analysis
  const primaryCode = report.issues[0]?.code ?? '';

  if (
    primaryCode.includes('DUPLICATE') ||
    primaryCode.includes('EXISTS') ||
    primaryCode.includes('CONFLICT')
  ) {
    categories.conflicts.push(report);
  } else if (primaryCode.includes('MISSING') || primaryCode.includes('EMPTY')) {
    categories.missingData.push(report);
  } else if (
    primaryCode.includes('INVALID') ||
    primaryCode.includes('LONG') ||
    primaryCode.includes('RESERVED')
  ) {
    categories.invalidNames.push(report);
  } else {
    categories.other.push(report);
  }
}

/**
 * Calculate summary statistics for grouped preview.
 */
function calculateGroupedSummary(
  ready: RenameProposal[],
  unchanged: RenameProposal[],
  issueReports: IssueReport[]
): GroupedSummary {
  const canProceedReports = issueReports.filter((r) => r.canProceed);
  const blockedReports = issueReports.filter((r) => !r.canProceed);

  const totalFiles = ready.length + unchanged.length + issueReports.length;
  const canProceedCount = ready.length + canProceedReports.length;

  // Calculate percentages (avoid division by zero)
  const calcPercent = (count: number): number =>
    totalFiles === 0 ? 0 : Math.round((count / totalFiles) * 100);

  return {
    totalReady: ready.length,
    totalIssues: issueReports.length,
    totalUnchanged: unchanged.length,
    canProceedCount,
    blockedCount: blockedReports.length,
    totalFiles,
    readyPercent: calcPercent(ready.length),
    issuesPercent: calcPercent(issueReports.length),
    canProceedPercent: calcPercent(canProceedCount),
  };
}
