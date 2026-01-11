/**
 * @fileoverview Preview output formatters
 *
 * Provides formatters for the preview command output in different formats:
 * - table: Human-readable table with status indicators
 * - json: Machine-readable JSON
 * - plain: Simple list of changes for piping
 */
import chalk from 'chalk';
import type { RenamePreview, RenameProposal } from '@tidy/core';
import { RenameStatus } from '@tidy/core';
import { basename, dirname, relative } from 'node:path';

/**
 * Options for formatters that support customization.
 */
export interface PreviewFormatOptions {
  /** Whether to use colors in output (default: true) */
  color?: boolean;
  /** Show verbose details (default: false) */
  verbose?: boolean;
  /** Base path for relative path display */
  basePath?: string;
}

// =============================================================================
// Status Icons and Colors
// =============================================================================

const STATUS_ICONS = {
  ready: '\u2713',      // ✓
  conflict: '\u2717',   // ✗
  skipped: '-',
  error: '!',
  'no-change': '=',
  'missing-data': '?',
} as const;

const STATUS_COLORS = {
  ready: chalk.green,
  conflict: chalk.red,
  skipped: chalk.gray,
  error: chalk.red,
  'no-change': chalk.gray,
  'missing-data': chalk.yellow,
} as const;

function getStatusIcon(status: string): string {
  return STATUS_ICONS[status as keyof typeof STATUS_ICONS] || '?';
}

function getStatusColor(status: string): typeof chalk {
  return STATUS_COLORS[status as keyof typeof STATUS_COLORS] || chalk.white;
}

// =============================================================================
// Table Formatter
// =============================================================================

/**
 * Format preview as a human-readable table.
 */
export function formatPreviewTable(
  preview: RenamePreview,
  options: PreviewFormatOptions = {}
): string {
  const useColor = options.color ?? true;
  const verbose = options.verbose ?? false;
  const lines: string[] = [];

  // Group proposals by status for better readability
  const ready = preview.proposals.filter((p) => p.status === RenameStatus.Ready);
  const noChange = preview.proposals.filter((p) => p.status === RenameStatus.NoChange);
  const conflicts = preview.proposals.filter((p) => p.status === RenameStatus.Conflict);
  const errors = preview.proposals.filter(
    (p) => p.status === RenameStatus.Error || p.status === RenameStatus.MissingData
  );
  const skipped = preview.proposals.filter((p) => p.status === RenameStatus.Skipped);

  // Ready to rename section
  if (ready.length > 0) {
    lines.push(formatSectionHeader('Ready to Rename', ready.length, useColor, 'green'));
    lines.push('');
    for (const proposal of ready) {
      lines.push(formatProposalRow(proposal, useColor, verbose));
    }
    lines.push('');
  }

  // No change section (only in verbose mode)
  if (noChange.length > 0 && verbose) {
    lines.push(formatSectionHeader('No Change Needed', noChange.length, useColor, 'gray'));
    lines.push('');
    for (const proposal of noChange) {
      lines.push(formatProposalRow(proposal, useColor, verbose));
    }
    lines.push('');
  }

  // Conflicts section
  if (conflicts.length > 0) {
    lines.push(formatSectionHeader('Conflicts', conflicts.length, useColor, 'red'));
    lines.push('');
    for (const proposal of conflicts) {
      lines.push(formatProposalRow(proposal, useColor, verbose));
      if (proposal.issues && proposal.issues.length > 0) {
        for (const issue of proposal.issues) {
          const issueText = `    ${chalk.dim('\u2514')} ${issue.message}`;
          lines.push(useColor ? chalk.red(issueText) : issueText);
        }
      }
    }
    lines.push('');
  }

  // Errors section
  if (errors.length > 0) {
    lines.push(formatSectionHeader('Errors', errors.length, useColor, 'yellow'));
    lines.push('');
    for (const proposal of errors) {
      lines.push(formatProposalRow(proposal, useColor, verbose));
      if (proposal.issues && proposal.issues.length > 0) {
        for (const issue of proposal.issues) {
          const issueText = `    ${chalk.dim('\u2514')} ${issue.message}`;
          lines.push(useColor ? chalk.yellow(issueText) : issueText);
        }
      }
    }
    lines.push('');
  }

  // Skipped section (only in verbose mode)
  if (skipped.length > 0 && verbose) {
    lines.push(formatSectionHeader('Skipped', skipped.length, useColor, 'gray'));
    lines.push('');
    for (const proposal of skipped) {
      lines.push(formatProposalRow(proposal, useColor, verbose));
    }
    lines.push('');
  }

  return lines.join('\n');
}

function formatSectionHeader(
  title: string,
  count: number,
  useColor: boolean,
  colorName: 'green' | 'red' | 'yellow' | 'gray'
): string {
  const header = `${title} (${count})`;
  const colorFn = useColor ? chalk[colorName] : (s: string) => s;
  return colorFn(chalk.bold(header));
}

function formatProposalRow(
  proposal: RenameProposal,
  useColor: boolean,
  verbose: boolean
): string {
  const icon = getStatusIcon(proposal.status);
  const colorFn = useColor ? getStatusColor(proposal.status) : (s: string) => s;

  const originalName = basename(proposal.originalPath);
  const newName = proposal.newName;
  const originalDir = dirname(proposal.originalPath);

  // Determine if it's a move or just a rename
  const newDir = proposal.newPath ? dirname(proposal.newPath) : originalDir;
  const isMove = newDir !== originalDir;

  let line: string;

  if (proposal.status === RenameStatus.NoChange) {
    line = `  ${colorFn(icon)} ${chalk.gray(originalName)} ${chalk.dim('(no change)')}`;
  } else if (isMove && proposal.newPath) {
    // Show move with destination folder
    const destFolder = relative(originalDir, newDir) || newDir;
    line = `  ${colorFn(icon)} ${originalName} ${chalk.dim('\u2192')} ${colorFn(newName)} ${chalk.cyan(`[${destFolder}]`)}`;
  } else {
    line = `  ${colorFn(icon)} ${originalName} ${chalk.dim('\u2192')} ${colorFn(newName)}`;
  }

  // Add directory context in verbose mode
  if (verbose && proposal.status !== RenameStatus.NoChange) {
    line += chalk.dim(`  (${originalDir})`);
  }

  return line;
}

// =============================================================================
// Summary Formatter
// =============================================================================

/**
 * Format preview summary statistics.
 */
export function formatPreviewSummary(
  preview: RenamePreview,
  options: PreviewFormatOptions = {}
): string {
  const useColor = options.color ?? true;
  const { summary } = preview;
  const lines: string[] = [];

  lines.push(useColor ? chalk.bold('Summary:') : 'Summary:');

  const parts: string[] = [];

  if (summary.ready > 0) {
    const text = `${summary.ready} ready`;
    parts.push(useColor ? chalk.green(text) : text);
  }

  if (summary.noChange > 0) {
    const text = `${summary.noChange} unchanged`;
    parts.push(useColor ? chalk.gray(text) : text);
  }

  if (summary.conflict > 0) {
    const text = `${summary.conflict} conflict${summary.conflict > 1 ? 's' : ''}`;
    parts.push(useColor ? chalk.red(text) : text);
  }

  if (summary.error > 0) {
    const text = `${summary.error} error${summary.error > 1 ? 's' : ''}`;
    parts.push(useColor ? chalk.red(text) : text);
  }

  if (summary.skipped > 0) {
    const text = `${summary.skipped} skipped`;
    parts.push(useColor ? chalk.gray(text) : text);
  }

  lines.push(`  ${parts.join(', ')} (${summary.total} total)`);

  // Add actionable message
  if (summary.ready > 0 && summary.conflict === 0 && summary.error === 0) {
    lines.push('');
    const applyHint = useColor
      ? chalk.cyan('Run `tidy apply` to execute these renames')
      : 'Run `tidy apply` to execute these renames';
    lines.push(applyHint);
  } else if (summary.conflict > 0 || summary.error > 0) {
    lines.push('');
    const fixHint = useColor
      ? chalk.yellow('Fix conflicts/errors before applying, or use `tidy apply --force`')
      : 'Fix conflicts/errors before applying, or use `tidy apply --force`';
    lines.push(fixHint);
  }

  return lines.join('\n');
}

// =============================================================================
// JSON Formatter
// =============================================================================

/**
 * Format preview as JSON.
 */
export function formatPreviewJson(preview: RenamePreview): string {
  // Create a serializable version
  const serializable = {
    proposals: preview.proposals.map((p) => ({
      id: p.id,
      originalPath: p.originalPath,
      originalName: basename(p.originalPath),
      newName: p.newName,
      newPath: p.newPath,
      status: p.status,
      issues: p.issues || [],
      appliedRule: p.appliedRule || null,
    })),
    summary: preview.summary,
  };

  return JSON.stringify(serializable, null, 2);
}

// =============================================================================
// Plain Formatter
// =============================================================================

/**
 * Format preview as plain text (one change per line).
 * Format: original_path -> new_path
 */
export function formatPreviewPlain(preview: RenamePreview): string {
  return preview.proposals
    .filter((p) => p.status === RenameStatus.Ready)
    .map((p) => `${p.originalPath}\t${p.newPath || p.newName}`)
    .join('\n');
}
