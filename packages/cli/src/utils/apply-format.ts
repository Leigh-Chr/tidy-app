/**
 * @fileoverview Apply command output formatters
 *
 * Provides formatters for the apply command output in different formats:
 * - table: Human-readable results with status indicators
 * - json: Machine-readable JSON
 * - plain: Simple list of completed renames
 */
import chalk from 'chalk';
import type {
  RenamePreview,
  RenameProposal,
  BatchRenameResult,
} from '@tidy/core';
import { RenameStatus, RenameOutcome } from '@tidy/core';
import { basename } from 'node:path';

/**
 * Options for formatters.
 */
export interface ApplyFormatOptions {
  /** Whether to use colors in output (default: true) */
  color?: boolean;
}

// =============================================================================
// Preview Formatter (before execution)
// =============================================================================

/**
 * Format the preview before applying (confirmation display).
 */
export function formatApplyPreview(
  preview: RenamePreview,
  options: ApplyFormatOptions = {}
): string {
  const useColor = options.color ?? true;
  const lines: string[] = [];

  const ready = preview.proposals.filter((p) => p.status === RenameStatus.Ready);
  const conflicts = preview.proposals.filter((p) => p.status === RenameStatus.Conflict);

  lines.push(useColor ? chalk.bold('Changes to apply:') : 'Changes to apply:');
  lines.push('');

  // Show first 10 ready files
  const displayCount = Math.min(ready.length, 10);
  for (let i = 0; i < displayCount; i++) {
    const proposal = ready[i];
    const originalName = basename(proposal.originalPath);
    const newName = proposal.newName;
    const icon = useColor ? chalk.green('\u2713') : '+';
    lines.push(`  ${icon} ${originalName} ${chalk.dim('\u2192')} ${useColor ? chalk.green(newName) : newName}`);
  }

  if (ready.length > 10) {
    lines.push(chalk.gray(`  ... and ${ready.length - 10} more`));
  }

  // Show conflicts if any
  if (conflicts.length > 0) {
    lines.push('');
    lines.push(useColor ? chalk.yellow(`${conflicts.length} file(s) have conflicts and will be skipped.`) : `${conflicts.length} file(s) have conflicts and will be skipped.`);
    lines.push(chalk.gray('Use --force to rename them anyway (will add suffix).'));
  }

  lines.push('');
  lines.push(`Total: ${ready.length} file${ready.length > 1 ? 's' : ''} to rename`);

  return lines.join('\n');
}

// =============================================================================
// Result Formatter (after execution)
// =============================================================================

/**
 * Format the execution results.
 */
export function formatApplyResult(
  result: BatchRenameResult,
  options: ApplyFormatOptions = {}
): string {
  const useColor = options.color ?? true;
  const lines: string[] = [];
  const { summary, results, directoriesCreated } = result;

  // Success header
  if (summary.succeeded > 0 && summary.failed === 0) {
    const header = `Successfully renamed ${summary.succeeded} file${summary.succeeded > 1 ? 's' : ''}`;
    lines.push(useColor ? chalk.green.bold(header) : header);
  } else if (summary.succeeded > 0 && summary.failed > 0) {
    const header = `Renamed ${summary.succeeded} file${summary.succeeded > 1 ? 's' : ''}, ${summary.failed} failed`;
    lines.push(useColor ? chalk.yellow.bold(header) : header);
  } else if (summary.failed > 0) {
    const header = `Failed to rename ${summary.failed} file${summary.failed > 1 ? 's' : ''}`;
    lines.push(useColor ? chalk.red.bold(header) : header);
  }

  lines.push('');

  // Show successful renames (up to 10)
  const succeeded = results.filter((r) => r.outcome === RenameOutcome.Success);
  if (succeeded.length > 0) {
    const displayCount = Math.min(succeeded.length, 10);
    for (let i = 0; i < displayCount; i++) {
      const r = succeeded[i];
      const originalName = basename(r.originalPath);
      const newName = basename(r.newPath);
      const icon = useColor ? chalk.green('\u2713') : '[OK]';
      lines.push(`  ${icon} ${originalName} ${chalk.dim('\u2192')} ${newName}`);
    }
    if (succeeded.length > 10) {
      lines.push(chalk.gray(`  ... and ${succeeded.length - 10} more`));
    }
  }

  // Show failures
  const failed = results.filter((r) => r.outcome === RenameOutcome.Failed);
  if (failed.length > 0) {
    lines.push('');
    lines.push(useColor ? chalk.red('Failed:') : 'Failed:');
    for (const r of failed) {
      const originalName = basename(r.originalPath);
      const icon = useColor ? chalk.red('\u2717') : '[FAIL]';
      lines.push(`  ${icon} ${originalName}: ${r.error || 'Unknown error'}`);
    }
  }

  // Show created directories
  if (directoriesCreated && directoriesCreated.length > 0) {
    lines.push('');
    lines.push(chalk.gray(`Created ${directoriesCreated.length} director${directoriesCreated.length > 1 ? 'ies' : 'y'}`));
  }

  // Show undo hint
  if (summary.succeeded > 0) {
    lines.push('');
    lines.push(chalk.gray(`Operation ID: ${result.operationId}`));
    lines.push(chalk.cyan('Run `tidy undo` to reverse this operation'));
  }

  return lines.join('\n');
}

// =============================================================================
// JSON Formatter
// =============================================================================

/**
 * Format results as JSON.
 */
export function formatApplyJson(result: BatchRenameResult & { dryRun?: boolean }): string {
  const serializable = {
    success: result.summary.failed === 0,
    dryRun: result.dryRun ?? false,
    operationId: result.operationId,
    summary: result.summary,
    results: result.results.map((r) => ({
      originalPath: r.originalPath,
      newPath: r.newPath,
      outcome: r.outcome,
      error: r.error || null,
    })),
    directoriesCreated: result.directoriesCreated || [],
  };

  return JSON.stringify(serializable, null, 2);
}

// =============================================================================
// Plain Formatter
// =============================================================================

/**
 * Format as plain text (for scripting).
 * Shows either proposals (before execution) or results (after execution).
 */
export function formatApplyPlain(
  proposals: RenameProposal[],
  result?: BatchRenameResult
): string {
  if (result) {
    // Show actual results
    return result.results
      .filter((r) => r.outcome === RenameOutcome.Success)
      .map((r) => `${r.originalPath}\t${r.newPath}`)
      .join('\n');
  }

  // Show proposals
  return proposals
    .filter((p) => p.status === RenameStatus.Ready)
    .map((p) => `${p.originalPath}\t${p.newPath || p.newName}`)
    .join('\n');
}
