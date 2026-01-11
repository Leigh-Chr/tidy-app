/**
 * CLI preview table formatter (Story 4.2)
 *
 * Formats rename preview data as an ASCII table for terminal display.
 *
 * @module utils/preview-table
 */

import chalk from 'chalk';
import type {
  FormattedPreview,
  ComparisonEntry,
  DiffSegment,
  RenameStatusType,
} from '@tidy/core';

// =============================================================================
// Types
// =============================================================================

/**
 * Options for table formatting.
 */
export interface TableOptions {
  /** Whether to show diff highlighting (default: true) */
  showDiff?: boolean;
  /** Maximum width for the table (default: 100) */
  maxWidth?: number;
}

// =============================================================================
// Main Function
// =============================================================================

/**
 * Format a preview as an ASCII table for terminal display.
 *
 * @param preview - The formatted preview to display
 * @param options - Table formatting options
 * @returns Formatted string ready for console output
 *
 * @example
 * ```typescript
 * const formatted = formatPreview(preview);
 * console.log(formatPreviewTable(formatted));
 * ```
 */
export function formatPreviewTable(
  preview: FormattedPreview,
  options: TableOptions = {}
): string {
  const { showDiff = true, maxWidth = 100 } = options;
  const lines: string[] = [];

  // Header
  lines.push(chalk.bold('Rename Preview'));
  lines.push('');

  // Calculate column widths
  const statusWidth = 14;
  const arrowWidth = 4;
  const availableWidth = maxWidth - statusWidth - arrowWidth;
  const nameWidth = Math.floor(availableWidth / 2);

  // Column headers
  lines.push(
    chalk.dim(
      padRight('Original', nameWidth) +
      padCenter('->', arrowWidth) +
      padRight('Proposed', nameWidth) +
      'Status'
    )
  );
  lines.push(chalk.dim('─'.repeat(maxWidth)));

  // Data rows
  for (const entry of preview.entries) {
    const line = formatRow(entry, nameWidth, arrowWidth, showDiff);
    lines.push(line);
  }

  // Summary
  lines.push('');
  lines.push(chalk.dim('─'.repeat(maxWidth)));
  lines.push(formatSummary(preview.summary));

  return lines.join('\n');
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Format a single row of the table.
 */
function formatRow(
  entry: ComparisonEntry,
  nameWidth: number,
  arrowWidth: number,
  showDiff: boolean
): string {
  const statusColor = getStatusColor(entry.status);

  let originalDisplay: string;
  let proposedDisplay: string;

  if (showDiff && entry.diff) {
    // Use diff highlighting
    originalDisplay = formatDiffSegments(entry.diff.original, 'original');
    proposedDisplay = formatDiffSegments(entry.diff.proposed, 'proposed');
  } else {
    // Plain text
    originalDisplay = entry.original.display;
    proposedDisplay = entry.proposed.display;
  }

  return (
    padRight(originalDisplay, nameWidth, stripAnsi(originalDisplay).length) +
    chalk.dim(padCenter('->', arrowWidth)) +
    padRight(proposedDisplay, nameWidth, stripAnsi(proposedDisplay).length) +
    statusColor(entry.statusLabel)
  );
}

/**
 * Format diff segments with colors.
 */
function formatDiffSegments(
  segments: DiffSegment[],
  side: 'original' | 'proposed'
): string {
  return segments
    .map((segment) => {
      switch (segment.type) {
        case 'unchanged':
          return segment.text;
        case 'removed':
          // Only show in original column
          return side === 'original'
            ? chalk.red.strikethrough(segment.text)
            : '';
        case 'added':
          // Only show in proposed column
          return side === 'proposed'
            ? chalk.green(segment.text)
            : '';
        default:
          return segment.text;
      }
    })
    .join('');
}

/**
 * Get color function for a status type.
 */
function getStatusColor(status: RenameStatusType): (text: string) => string {
  switch (status) {
    case 'ready':
      return chalk.green;
    case 'conflict':
      return chalk.red;
    case 'missing-data':
      return chalk.yellow;
    case 'no-change':
      return chalk.dim;
    case 'invalid-name':
      return chalk.red;
    default:
      return chalk.white;
  }
}

/**
 * Format summary statistics.
 */
function formatSummary(summary: FormattedPreview['summary']): string {
  const parts = [
    `${chalk.bold(String(summary.total))} files`,
    chalk.green(`${String(summary.ready)} ready`),
  ];

  if (summary.conflicts > 0) {
    parts.push(chalk.red(`${String(summary.conflicts)} conflicts`));
  }
  if (summary.issues > 0) {
    parts.push(chalk.yellow(`${String(summary.issues)} issues`));
  }
  if (summary.unchanged > 0) {
    parts.push(chalk.dim(`${String(summary.unchanged)} unchanged`));
  }

  return parts.join(' | ');
}

/**
 * Right-pad a string to a given width.
 *
 * @param str - String to pad (may contain ANSI codes)
 * @param width - Target width
 * @param visibleLength - Pre-computed visible length (without ANSI codes)
 */
function padRight(str: string, width: number, visibleLength?: number): string {
  const len = visibleLength ?? stripAnsi(str).length;
  const padding = Math.max(0, width - len);
  return str + ' '.repeat(padding);
}

/**
 * Center a string within a given width.
 */
function padCenter(str: string, width: number): string {
  const padding = Math.max(0, width - str.length);
  const left = Math.floor(padding / 2);
  const right = padding - left;
  return ' '.repeat(left) + str + ' '.repeat(right);
}

/**
 * Strip ANSI escape codes from a string.
 *
 * Used for calculating visible string length when the string
 * may contain color codes.
 */
function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}
