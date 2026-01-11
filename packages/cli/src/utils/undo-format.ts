/**
 * @fileoverview Undo output formatting utilities - Story 9.3
 *
 * Provides formatters for undo CLI output in different formats:
 * - table: Human-readable table with status indicators
 * - json: Machine-readable JSON
 * - plain: Simple text output
 * - preview: Dry-run preview format
 *
 * AC covered (9.3):
 * - AC3: Preview undo changes (dry-run)
 * - AC8: JSON output for undo results
 */
import chalk from 'chalk';
import type { UndoResult, UndoFileResult } from '@tidy/core';

/**
 * Options for formatters that support color control.
 */
export interface FormatOptions {
  /** Whether to use colors in output (default: true) */
  color?: boolean;
}

// =============================================================================
// Preview Formatter (Dry-Run)
// =============================================================================

/**
 * Format undo preview showing proposed changes without executing.
 *
 * Displays:
 * - Operation ID being previewed
 * - File restoration plan with arrows (new → original)
 * - Summary of what would happen
 *
 * @param result - Undo result from dry-run
 * @param options - Formatting options
 * @returns Formatted preview string
 */
export function formatUndoPreview(result: UndoResult, options: FormatOptions = {}): string {
  const useColor = options.color ?? true;
  const lines: string[] = [];

  // Header
  const header = 'Undo Preview';
  lines.push(useColor ? chalk.bold.underline(header) : header);
  lines.push('');

  // Operation ID
  lines.push(`Operation: ${result.operationId}`);
  lines.push('');

  // Files section
  if (result.files.length > 0) {
    const filesHeader = 'Proposed Changes:';
    lines.push(useColor ? chalk.bold(filesHeader) : filesHeader);
    lines.push('');

    for (const file of result.files) {
      const line = formatPreviewFileLine(file, useColor);
      lines.push(`  ${line}`);
    }
    lines.push('');
  }

  // Summary
  const summaryHeader = 'Summary:';
  lines.push(useColor ? chalk.bold(summaryHeader) : summaryHeader);

  const restoreText = `  Would restore: ${result.filesRestored} file${result.filesRestored !== 1 ? 's' : ''}`;
  const skipText = `  Would skip:    ${result.filesSkipped} file${result.filesSkipped !== 1 ? 's' : ''}`;
  const failText = `  Cannot undo:   ${result.filesFailed} file${result.filesFailed !== 1 ? 's' : ''}`;

  lines.push(useColor && result.filesRestored > 0 ? chalk.green(restoreText) : restoreText);
  if (result.filesSkipped > 0) {
    lines.push(useColor ? chalk.yellow(skipText) : skipText);
  }
  if (result.filesFailed > 0) {
    lines.push(useColor ? chalk.red(failText) : failText);
  }

  // Directories that would be removed
  if (result.directoriesRemoved.length > 0) {
    lines.push('');
    const dirHeader = 'Directories to remove:';
    lines.push(useColor ? chalk.bold(dirHeader) : dirHeader);
    for (const dir of result.directoriesRemoved) {
      const dirLine = `  - ${dir}`;
      lines.push(useColor ? chalk.cyan(dirLine) : dirLine);
    }
  }

  return lines.join('\n');
}

/**
 * Format a single file line for preview.
 */
function formatPreviewFileLine(file: UndoFileResult, useColor: boolean): string {
  if (file.success) {
    // Would succeed: show the reversal path
    const arrow = useColor ? chalk.gray('→') : '→';
    const text = `${file.currentPath} ${arrow} ${file.originalPath}`;
    return useColor ? chalk.green('✓') + ' ' + text : '✓ ' + text;
  } else if (file.skipReason) {
    // Would skip: show original path and reason
    const text = `${file.originalPath} (${file.skipReason})`;
    return useColor ? chalk.yellow('○') + ' ' + text : '○ ' + text;
  } else {
    // Would fail: show path and error
    const text = `${file.currentPath ?? file.originalPath} (${file.error ?? 'Unknown error'})`;
    return useColor ? chalk.red('✗') + ' ' + text : '✗ ' + text;
  }
}

// =============================================================================
// Result Formatter (Post-Execution)
// =============================================================================

/**
 * Format undo result after execution.
 *
 * Displays:
 * - Success/failure status
 * - Files restored with indicators
 * - Directories removed
 * - Summary statistics
 *
 * @param result - Undo result from execution
 * @param options - Formatting options
 * @returns Formatted result string
 */
export function formatUndoResult(result: UndoResult, options: FormatOptions = {}): string {
  const useColor = options.color ?? true;
  const lines: string[] = [];

  // Header based on success
  const headerText = result.success ? 'Undo Completed' : 'Undo Partially Completed';
  const header = useColor
    ? result.success
      ? chalk.bold.green(headerText)
      : chalk.bold.yellow(headerText)
    : headerText;
  lines.push(header);
  lines.push('');

  // Operation ID
  lines.push(`Operation: ${result.operationId}`);
  lines.push(`Duration:  ${result.durationMs}ms`);
  lines.push('');

  // Files section
  if (result.files.length > 0) {
    const filesHeader = 'Files:';
    lines.push(useColor ? chalk.bold(filesHeader) : filesHeader);
    lines.push('');

    for (const file of result.files) {
      const line = formatResultFileLine(file, useColor);
      lines.push(`  ${line}`);
    }
    lines.push('');
  }

  // Directories removed
  if (result.directoriesRemoved.length > 0) {
    const dirHeader = 'Directories Removed:';
    lines.push(useColor ? chalk.bold(dirHeader) : dirHeader);
    for (const dir of result.directoriesRemoved) {
      const dirLine = `  - ${dir}`;
      lines.push(useColor ? chalk.cyan(dirLine) : dirLine);
    }
    lines.push('');
  }

  // Summary
  const summaryHeader = 'Summary:';
  lines.push(useColor ? chalk.bold(summaryHeader) : summaryHeader);

  const restoreText = `  Restored: ${result.filesRestored} file${result.filesRestored !== 1 ? 's' : ''}`;
  lines.push(useColor && result.filesRestored > 0 ? chalk.green(restoreText) : restoreText);

  if (result.filesSkipped > 0) {
    const skipText = `  Skipped:  ${result.filesSkipped} file${result.filesSkipped !== 1 ? 's' : ''}`;
    lines.push(useColor ? chalk.yellow(skipText) : skipText);
  }

  if (result.filesFailed > 0) {
    const failText = `  Failed:   ${result.filesFailed} file${result.filesFailed !== 1 ? 's' : ''}`;
    lines.push(useColor ? chalk.red(failText) : failText);
  }

  if (result.directoriesRemoved.length > 0) {
    const dirText = `  Dirs:     ${result.directoriesRemoved.length} removed`;
    lines.push(useColor ? chalk.cyan(dirText) : dirText);
  }

  return lines.join('\n');
}

/**
 * Format a single file line for result output.
 */
function formatResultFileLine(file: UndoFileResult, useColor: boolean): string {
  if (file.success) {
    // Succeeded: show restoration path
    const arrow = useColor ? chalk.gray('→') : '→';
    const text = `${file.currentPath} ${arrow} ${file.originalPath}`;
    return useColor ? chalk.green('✓') + ' ' + text : '✓ ' + text;
  } else if (file.skipReason) {
    // Skipped: show original path and reason
    const text = `${file.originalPath} (${file.skipReason})`;
    return useColor ? chalk.yellow('○') + ' ' + text : '○ ' + text;
  } else {
    // Failed: show path and error
    const text = `${file.currentPath ?? file.originalPath}`;
    const errorText = file.error ? `\n      Error: ${file.error}` : '';
    const prefix = useColor ? chalk.red('✗') : '✗';
    const errorFormatted = useColor ? chalk.red(errorText) : errorText;
    return `${prefix} ${text}${errorFormatted}`;
  }
}

// =============================================================================
// JSON Formatter
// =============================================================================

/**
 * Format undo result as JSON.
 *
 * Output is valid JSON with:
 * - operationId: The undone operation ID
 * - filesRestored: Count of restored files
 * - filesSkipped: Count of skipped files
 * - filesFailed: Count of failed files
 * - directoriesRemoved: Array of removed directory paths
 * - files: Detailed file results (optional based on verbosity)
 *
 * @param result - Undo result to format
 * @returns JSON string
 */
export function formatUndoJson(result: UndoResult): string {
  return JSON.stringify(
    {
      operationId: result.operationId,
      success: result.success,
      dryRun: result.dryRun,
      filesRestored: result.filesRestored,
      filesSkipped: result.filesSkipped,
      filesFailed: result.filesFailed,
      directoriesRemoved: result.directoriesRemoved,
      files: result.files,
      durationMs: result.durationMs,
    },
    null,
    2
  );
}

// =============================================================================
// Plain Formatter
// =============================================================================

/**
 * Format undo result as plain text.
 *
 * Simple output showing:
 * - Operation ID on first line
 * - Status on second line
 * - Counts on third line
 *
 * @param result - Undo result to format
 * @returns Plain text string
 */
export function formatUndoPlain(result: UndoResult): string {
  const status = result.dryRun ? 'preview' : result.success ? 'success' : 'partial';
  const counts = `restored=${result.filesRestored} skipped=${result.filesSkipped} failed=${result.filesFailed}`;
  return `${result.operationId}\n${status}\n${counts}`;
}
