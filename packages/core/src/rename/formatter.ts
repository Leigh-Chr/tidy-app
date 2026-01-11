/**
 * Rename formatter - Side-by-side comparison view formatting (Story 4.2)
 *
 * Provides functions to format rename proposals for display,
 * including diff highlighting and truncation for long filenames.
 *
 * @module rename/formatter
 */

import type {
  RenamePreview,
  RenameProposal,
  RenameStatusType,
} from '../types/rename-proposal.js';

// =============================================================================
// Types
// =============================================================================

/**
 * A segment of a string diff.
 */
export interface DiffSegment {
  /** The text content */
  text: string;
  /** Type of segment: unchanged, removed, or added */
  type: 'unchanged' | 'removed' | 'added';
}

/**
 * Diff result showing changes between original and proposed names.
 */
export interface StringDiff {
  /** Segments for the original string */
  original: DiffSegment[];
  /** Segments for the proposed string */
  proposed: DiffSegment[];
}

/**
 * Display information for a filename.
 */
export interface FileDisplay {
  /** Full filename */
  name: string;
  /** Full path */
  path: string;
  /** Truncated name for display */
  display: string;
}

/**
 * A formatted comparison entry for display.
 */
export interface ComparisonEntry {
  /** Unique ID from the proposal */
  id: string;
  /** Original file information */
  original: FileDisplay;
  /** Proposed file information */
  proposed: FileDisplay;
  /** Status of the proposal */
  status: RenameStatusType;
  /** Human-readable status label */
  statusLabel: string;
  /** Whether original and proposed names are identical */
  isUnchanged: boolean;
  /** Diff segments for highlighting (null if unchanged or diff disabled) */
  diff: StringDiff | null;
}

/**
 * Summary statistics for the formatted preview.
 */
export interface FormattedSummary {
  /** Total number of files */
  total: number;
  /** Files ready to rename */
  ready: number;
  /** Files with naming conflicts */
  conflicts: number;
  /** Files with issues (missing data + invalid name) */
  issues: number;
  /** Files that would be unchanged */
  unchanged: number;
}

/**
 * Complete formatted preview for display.
 */
export interface FormattedPreview {
  /** Formatted entries for each file */
  entries: ComparisonEntry[];
  /** Summary statistics */
  summary: FormattedSummary;
}

/**
 * Options for formatting a preview.
 */
export interface FormatOptions {
  /** Maximum length for displayed filenames (default: 50) */
  maxNameLength?: number;
  /** Whether to compute diffs for changed files (default: true) */
  showDiff?: boolean;
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Human-readable labels for rename status values.
 */
const STATUS_LABELS: Record<RenameStatusType, string> = {
  'ready': 'Ready',
  'conflict': 'Conflict',
  'missing-data': 'Missing Data',
  'no-change': 'No Change',
  'invalid-name': 'Invalid Name',
};

// =============================================================================
// Main Functions
// =============================================================================

/**
 * Format a rename preview for side-by-side display.
 *
 * @param preview - The rename preview to format
 * @param options - Formatting options
 * @returns Formatted preview with entries and summary
 *
 * @example
 * ```typescript
 * const formatted = formatPreview(preview, { maxNameLength: 40 });
 * for (const entry of formatted.entries) {
 *   console.log(`${entry.original.display} -> ${entry.proposed.display}`);
 * }
 * ```
 */
export function formatPreview(
  preview: RenamePreview,
  options: FormatOptions = {}
): FormattedPreview {
  const { maxNameLength = 50, showDiff = true } = options;

  const entries = preview.proposals.map((proposal) =>
    formatEntry(proposal, maxNameLength, showDiff)
  );

  return {
    entries,
    summary: {
      total: preview.summary.total,
      ready: preview.summary.ready,
      conflicts: preview.summary.conflicts,
      issues: preview.summary.missingData + preview.summary.invalidName,
      unchanged: preview.summary.noChange,
    },
  };
}

/**
 * Format a single proposal as a comparison entry.
 */
function formatEntry(
  proposal: RenameProposal,
  maxLength: number,
  showDiff: boolean
): ComparisonEntry {
  const isUnchanged = proposal.originalName === proposal.proposedName;

  return {
    id: proposal.id,
    original: {
      name: proposal.originalName,
      path: proposal.originalPath,
      display: truncateFilename(proposal.originalName, maxLength),
    },
    proposed: {
      name: proposal.proposedName,
      path: proposal.proposedPath,
      display: truncateFilename(proposal.proposedName, maxLength),
    },
    status: proposal.status,
    statusLabel: STATUS_LABELS[proposal.status],
    isUnchanged,
    diff: showDiff && !isUnchanged
      ? computeDiff(proposal.originalName, proposal.proposedName)
      : null,
  };
}

/**
 * Truncate a filename to fit within a maximum length.
 *
 * Preserves the file extension when possible. If the string is already
 * within the limit, returns it unchanged.
 *
 * @param str - The filename to truncate
 * @param maxLength - Maximum length for the result
 * @returns Truncated filename with ellipsis if needed
 *
 * @example
 * ```typescript
 * truncateFilename('very_long_filename.jpg', 20)
 * // Returns: 'very_long_fil....jpg'
 * ```
 */
export function truncateFilename(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;

  // Find extension
  const lastDot = str.lastIndexOf('.');
  const hasExtension = lastDot > 0 && lastDot < str.length - 1;
  const ext = hasExtension ? str.slice(lastDot) : '';

  // Calculate how much space we have for the base name
  // Need at least 3 chars for '...'
  const maxBase = maxLength - ext.length - 3;

  if (maxBase < 1) {
    // Not enough space to preserve extension, just truncate end
    return str.slice(0, maxLength - 3) + '...';
  }

  return str.slice(0, maxBase) + '...' + ext;
}

/**
 * Compute a character-level diff between two strings.
 *
 * Uses a simple algorithm that finds common prefix and suffix,
 * then marks the middle portions as removed/added.
 *
 * @param original - The original string
 * @param proposed - The proposed string
 * @returns Diff with segments for both strings
 *
 * @example
 * ```typescript
 * const diff = computeDiff('photo.jpg', '2026-01-15_photo.jpg');
 * // diff.proposed includes { text: '2026-01-15_', type: 'added' }
 * ```
 */
export function computeDiff(original: string, proposed: string): StringDiff {
  // Handle identical strings
  if (original === proposed) {
    return {
      original: original ? [{ text: original, type: 'unchanged' }] : [],
      proposed: proposed ? [{ text: proposed, type: 'unchanged' }] : [],
    };
  }

  // Handle empty strings
  if (original === '') {
    return {
      original: [],
      proposed: proposed ? [{ text: proposed, type: 'added' }] : [],
    };
  }

  if (proposed === '') {
    return {
      original: original ? [{ text: original, type: 'removed' }] : [],
      proposed: [],
    };
  }

  // Find common prefix
  let prefixEnd = 0;
  const minLen = Math.min(original.length, proposed.length);
  while (prefixEnd < minLen && original[prefixEnd] === proposed[prefixEnd]) {
    prefixEnd++;
  }

  // Find common suffix (but don't overlap with prefix)
  let suffixLen = 0;
  while (
    suffixLen < original.length - prefixEnd &&
    suffixLen < proposed.length - prefixEnd &&
    original[original.length - 1 - suffixLen] === proposed[proposed.length - 1 - suffixLen]
  ) {
    suffixLen++;
  }

  // Extract segments
  const commonPrefix = original.slice(0, prefixEnd);
  const commonSuffix = suffixLen > 0 ? original.slice(original.length - suffixLen) : '';
  const originalMiddle = original.slice(prefixEnd, original.length - suffixLen);
  const proposedMiddle = proposed.slice(prefixEnd, proposed.length - suffixLen);

  // Build segments for original
  const originalSegments: DiffSegment[] = [];
  if (commonPrefix) {
    originalSegments.push({ text: commonPrefix, type: 'unchanged' });
  }
  if (originalMiddle) {
    originalSegments.push({ text: originalMiddle, type: 'removed' });
  }
  if (commonSuffix) {
    originalSegments.push({ text: commonSuffix, type: 'unchanged' });
  }

  // Build segments for proposed
  const proposedSegments: DiffSegment[] = [];
  if (commonPrefix) {
    proposedSegments.push({ text: commonPrefix, type: 'unchanged' });
  }
  if (proposedMiddle) {
    proposedSegments.push({ text: proposedMiddle, type: 'added' });
  }
  if (commonSuffix) {
    proposedSegments.push({ text: commonSuffix, type: 'unchanged' });
  }

  // Ensure non-empty result if strings differ
  return {
    original: originalSegments.length > 0 ? originalSegments : [{ text: original, type: 'removed' }],
    proposed: proposedSegments.length > 0 ? proposedSegments : [{ text: proposed, type: 'added' }],
  };
}
