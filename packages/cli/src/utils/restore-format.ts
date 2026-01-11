/**
 * @fileoverview Restore output formatting utilities - Story 9.4
 *
 * Provides formatters for restore CLI output in different formats:
 * - table: Human-readable table with status indicators
 * - json: Machine-readable JSON
 * - plain: Simple text output
 * - preview: Dry-run preview format
 * - lookup: File history lookup display
 *
 * AC covered (9.4):
 * - AC3: Lookup file history
 * - AC4: Restore preview (dry-run)
 * - AC8: JSON output for restore results
 */
import chalk from 'chalk';
import type { RestoreResult, FileHistoryLookup } from '@tidy/core';

/**
 * Options for restore output formatters.
 *
 * Controls formatting behavior such as color output for CLI display.
 * Used by formatRestorePreview, formatRestoreResult, and formatFileLookup.
 *
 * @example
 * ```typescript
 * // Disable colors for piping to files
 * const output = formatRestoreResult(result, { color: false });
 *
 * // Use defaults (colors enabled)
 * const output = formatRestorePreview(result);
 * ```
 */
export interface FormatOptions {
  /**
   * Whether to use ANSI color codes in output.
   * Set to false when output is piped or redirected.
   * @default true
   */
  color?: boolean;
}

// =============================================================================
// Preview Formatter (Dry-Run)
// =============================================================================

/**
 * Format restore preview showing proposed changes without executing.
 *
 * Displays:
 * - File path being restored
 * - Current → Original path arrow
 * - Operation ID reference
 *
 * @param result - Restore result from dry-run
 * @param options - Formatting options
 * @returns Formatted preview string
 */
export function formatRestorePreview(result: RestoreResult, options: FormatOptions = {}): string {
  const useColor = options.color ?? true;
  const lines: string[] = [];

  // Header
  const header = 'Restore Preview';
  lines.push(useColor ? chalk.bold.underline(header) : header);
  lines.push('');

  // Status
  if (result.success) {
    if (result.message) {
      // File already at original - informational
      const msgLine = useColor ? chalk.yellow(`ℹ ${result.message}`) : `ℹ ${result.message}`;
      lines.push(msgLine);
    } else {
      // Would succeed - show path change
      const arrow = useColor ? chalk.gray('→') : '→';
      const pathLine = `${result.previousPath} ${arrow} ${result.originalPath}`;
      const successLine = useColor ? chalk.green('✓') + ' ' + pathLine : '✓ ' + pathLine;
      lines.push(successLine);
    }
  } else {
    // Would fail
    const errorLine = useColor
      ? chalk.red('✗') + ' ' + (result.error ?? 'Unknown error')
      : '✗ ' + (result.error ?? 'Unknown error');
    lines.push(errorLine);
    if (result.previousPath) {
      lines.push(`  Current:  ${result.previousPath}`);
    }
    if (result.originalPath) {
      lines.push(`  Original: ${result.originalPath}`);
    }
  }

  lines.push('');

  // Operation reference
  if (result.operationId) {
    lines.push(`Operation: ${result.operationId}`);
  }

  return lines.join('\n');
}

// =============================================================================
// Result Formatter (Post-Execution)
// =============================================================================

/**
 * Format restore result after execution.
 *
 * Displays:
 * - Success/failure status
 * - Restored file path
 * - Duration
 *
 * @param result - Restore result from execution
 * @param options - Formatting options
 * @returns Formatted result string
 */
export function formatRestoreResult(result: RestoreResult, options: FormatOptions = {}): string {
  const useColor = options.color ?? true;
  const lines: string[] = [];

  // Header based on success
  let headerText: string;
  if (result.message) {
    headerText = result.message;
  } else if (result.success) {
    headerText = 'File Restored';
  } else {
    headerText = 'Restore Failed';
  }

  const header = useColor
    ? result.success
      ? result.message
        ? chalk.bold.yellow(headerText)
        : chalk.bold.green(headerText)
      : chalk.bold.red(headerText)
    : headerText;
  lines.push(header);
  lines.push('');

  // Path information
  if (result.success && !result.message) {
    const arrow = useColor ? chalk.gray('→') : '→';
    lines.push(`  ${result.previousPath} ${arrow} ${result.originalPath}`);
  } else if (!result.success && result.error) {
    const errorText = useColor ? chalk.red(`  Error: ${result.error}`) : `  Error: ${result.error}`;
    lines.push(errorText);
    if (result.previousPath) {
      lines.push(`  Current:  ${result.previousPath}`);
    }
    if (result.originalPath) {
      lines.push(`  Original: ${result.originalPath}`);
    }
  }

  lines.push('');

  // Operation reference and duration
  if (result.operationId) {
    lines.push(`Operation: ${result.operationId}`);
  }
  lines.push(`Duration:  ${result.durationMs}ms`);

  return lines.join('\n');
}

// =============================================================================
// JSON Formatter
// =============================================================================

/**
 * Format restore result as JSON.
 *
 * Output is valid JSON with:
 * - success: Whether restore succeeded
 * - originalPath: Path restored to
 * - currentPath: Path restored from
 * - operationId: Related operation ID
 *
 * @param result - Restore result to format
 * @returns JSON string
 */
export function formatRestoreJson(result: RestoreResult): string {
  return JSON.stringify(
    {
      success: result.success,
      dryRun: result.dryRun,
      searchedPath: result.searchedPath,
      originalPath: result.originalPath,
      previousPath: result.previousPath,
      operationId: result.operationId,
      error: result.error,
      message: result.message,
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
 * Format restore result as plain text.
 *
 * Simple output showing:
 * - Status on first line (success/failed/already-at-original)
 * - Original path on second line (if available)
 * - Current path on third line (if different)
 *
 * @param result - Restore result to format
 * @returns Plain text string
 */
export function formatRestorePlain(result: RestoreResult): string {
  let status: string;
  if (result.message) {
    status = 'already-at-original';
  } else if (result.dryRun) {
    status = result.success ? 'preview' : 'preview-failed';
  } else {
    status = result.success ? 'success' : 'failed';
  }

  const lines = [status];

  if (result.originalPath) {
    lines.push(`original=${result.originalPath}`);
  }
  if (result.previousPath && result.previousPath !== result.originalPath) {
    lines.push(`previous=${result.previousPath}`);
  }
  if (result.error) {
    lines.push(`error=${result.error}`);
  }

  return lines.join('\n');
}

// =============================================================================
// Lookup Formatter (File History)
// =============================================================================

/**
 * Format file history lookup result.
 *
 * Displays:
 * - File found/not found status
 * - Original and current paths
 * - Whether at original location
 * - List of operations that affected file
 *
 * @param lookup - File history lookup result
 * @param options - Formatting options
 * @returns Formatted lookup string
 */
export function formatFileLookup(lookup: FileHistoryLookup, options: FormatOptions = {}): string {
  const useColor = options.color ?? true;
  const lines: string[] = [];

  // Header
  const header = 'File History';
  lines.push(useColor ? chalk.bold.underline(header) : header);
  lines.push('');

  // Not found
  if (!lookup.found) {
    const notFoundText = `No history found for: ${lookup.searchedPath}`;
    lines.push(useColor ? chalk.yellow(notFoundText) : notFoundText);
    return lines.join('\n');
  }

  // File info
  lines.push(`Searched: ${lookup.searchedPath}`);
  lines.push(`Original: ${lookup.originalPath ?? 'N/A'}`);
  lines.push(`Current:  ${lookup.currentPath ?? 'N/A'}`);
  lines.push('');

  // Status
  const statusHeader = 'Status:';
  lines.push(useColor ? chalk.bold(statusHeader) : statusHeader);

  if (lookup.isAtOriginal) {
    const atOriginal = '  ✓ File is at original location';
    lines.push(useColor ? chalk.green(atOriginal) : atOriginal);
  } else {
    const notAtOriginal = '  ○ File has been renamed';
    lines.push(useColor ? chalk.yellow(notAtOriginal) : notAtOriginal);
  }

  // Last modification
  if (lookup.lastModified) {
    const date = new Date(lookup.lastModified).toLocaleString();
    lines.push(`  Last modified: ${date}`);
  }

  lines.push('');

  // Operations history
  if (lookup.operations.length > 0) {
    const opsHeader = 'Operations:';
    lines.push(useColor ? chalk.bold(opsHeader) : opsHeader);
    lines.push('');

    for (const op of lookup.operations) {
      const date = new Date(op.timestamp).toLocaleDateString();
      const opLine = `  [${op.operationType}] ${date}`;
      lines.push(useColor ? chalk.cyan(opLine) : opLine);
      lines.push(`    ID: ${op.operationId}`);
      const arrow = useColor ? chalk.gray('→') : '→';
      lines.push(`    ${op.originalPath} ${arrow} ${op.newPath ?? 'N/A'}`);
      lines.push('');
    }
  }

  return lines.join('\n');
}

/**
 * Format file history lookup as JSON.
 *
 * @param lookup - File history lookup result
 * @returns JSON string
 */
export function formatFileLookupJson(lookup: FileHistoryLookup): string {
  return JSON.stringify(lookup, null, 2);
}
