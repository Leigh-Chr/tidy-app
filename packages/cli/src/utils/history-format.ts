/**
 * @fileoverview History output formatting utilities - Story 9.2
 *
 * Provides formatters for history CLI output in different formats:
 * - table: Human-readable table with headers
 * - json: Machine-readable JSON
 * - plain: One ID per line (for piping to other tools)
 * - detail: Detailed view of a single entry
 *
 * AC covered (9.2):
 * - AC6: JSON format outputs valid JSON
 * - AC7: Table format shows formatted ASCII table with colors
 */
import chalk from 'chalk';
import type { OperationHistoryEntry } from '@tidy/core';

/**
 * Options for formatters that support color control.
 */
export interface FormatOptions {
  /** Whether to use colors in output (default: true) */
  color?: boolean;
}

// =============================================================================
// Table Formatter
// =============================================================================

/**
 * Format history entries as a human-readable table.
 *
 * Displays:
 * - Date (locale-aware formatting)
 * - Operation type
 * - File count
 * - Result summary (succeeded/total)
 *
 * @param entries - History entries to format
 * @param options - Formatting options
 * @returns Formatted table string
 */
export function formatHistoryTable(
  entries: OperationHistoryEntry[],
  options: FormatOptions = {}
): string {
  const useColor = options.color ?? true;
  const lines: string[] = [];

  // Header
  const header = 'Date'.padEnd(22) + 'Type'.padEnd(10) + 'Files'.padEnd(8) + 'Result';
  lines.push(useColor ? chalk.bold(header) : header);
  lines.push('-'.repeat(65));

  // Rows
  for (const entry of entries) {
    const date = formatDate(entry.timestamp).padEnd(22);
    const type = entry.operationType.padEnd(10);
    const files = entry.fileCount.toString().padEnd(8);
    const result = formatResult(entry, useColor);

    lines.push(`${date}${type}${files}${result}`);
  }

  // Footer
  lines.push('-'.repeat(65));
  const footer = `Total: ${entries.length} operation${entries.length !== 1 ? 's' : ''}`;
  lines.push(useColor ? chalk.gray(footer) : footer);

  return lines.join('\n');
}

/**
 * Format operation result with color coding.
 */
function formatResult(entry: OperationHistoryEntry, useColor: boolean): string {
  const { succeeded, failed, skipped } = entry.summary;
  const total = entry.fileCount;

  if (failed === 0 && skipped === 0) {
    // All succeeded
    const text = `${succeeded}/${total} succeeded`;
    return useColor ? chalk.green(text) : text;
  } else if (succeeded === 0 && failed > 0) {
    // All failed
    const text = `${failed}/${total} failed`;
    return useColor ? chalk.red(text) : text;
  } else {
    // Mixed results
    const text = `${succeeded}/${total} succeeded`;
    return useColor ? chalk.yellow(text) : text;
  }
}

/**
 * Format ISO timestamp to locale-aware date string.
 * Truncates to max 20 characters to prevent table column overflow.
 */
function formatDate(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  const formatted = date.toLocaleString(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  // Truncate to prevent overflow in table columns (max 20 chars for 22-char column)
  return formatted.length > 20 ? formatted.slice(0, 20) : formatted;
}

// =============================================================================
// JSON Formatter
// =============================================================================

/**
 * Format history entries as JSON (suitable for piping to jq).
 *
 * Output is valid JSON with:
 * - All fields preserved
 * - Timestamps as ISO strings
 * - Pretty-printed with 2-space indentation
 *
 * @param entries - History entries to format
 * @returns JSON string
 */
export function formatHistoryJson(entries: OperationHistoryEntry[]): string {
  return JSON.stringify(entries, null, 2);
}

// =============================================================================
// Plain Formatter
// =============================================================================

/**
 * Format history entries as plain text (one ID per line).
 *
 * Suitable for piping to xargs or while read loops.
 *
 * @param entries - History entries to format
 * @returns One ID per line
 */
export function formatHistoryPlain(entries: OperationHistoryEntry[]): string {
  return entries.map((e) => e.id).join('\n');
}

// =============================================================================
// Detail Formatter
// =============================================================================

/**
 * Format a single history entry with full details.
 *
 * Displays:
 * - Entry metadata (ID, date, type, duration)
 * - Result summary
 * - Directories created (if any)
 * - File list with status indicators
 *
 * @param entry - History entry to format
 * @param options - Formatting options
 * @returns Formatted detail string
 */
export function formatHistoryEntryDetail(
  entry: OperationHistoryEntry,
  options: FormatOptions = {}
): string {
  const useColor = options.color ?? true;
  const lines: string[] = [];

  // Header section
  const sectionHeader = (text: string) =>
    useColor ? chalk.bold.underline(text) : text;

  lines.push(sectionHeader('Operation Details'));
  lines.push('');

  // Metadata
  lines.push(`ID:        ${entry.id}`);
  lines.push(`Date:      ${formatDate(entry.timestamp)}`);
  lines.push(`Type:      ${entry.operationType}`);
  lines.push(`Duration:  ${entry.durationMs}ms`);
  lines.push('');

  // Results summary
  lines.push(sectionHeader('Results'));
  lines.push('');
  const { succeeded, skipped, failed, directoriesCreated } = entry.summary;

  const successText = `Succeeded: ${succeeded}`;
  const skipText = `Skipped:   ${skipped}`;
  const failText = `Failed:    ${failed}`;

  lines.push(useColor && succeeded > 0 ? chalk.green(successText) : successText);
  lines.push(useColor && skipped > 0 ? chalk.yellow(skipText) : skipText);
  lines.push(useColor && failed > 0 ? chalk.red(failText) : failText);

  if (directoriesCreated > 0) {
    lines.push(`Directories created: ${directoriesCreated}`);
  }
  lines.push('');

  // Directories created list (if any)
  if (entry.directoriesCreated.length > 0) {
    lines.push(sectionHeader('Directories Created'));
    lines.push('');
    for (const dir of entry.directoriesCreated) {
      const dirLine = `  + ${dir}`;
      lines.push(useColor ? chalk.cyan(dirLine) : dirLine);
    }
    lines.push('');
  }

  // Files section
  lines.push(sectionHeader('Files'));
  lines.push('');

  for (const file of entry.files) {
    const status = file.success ? '✓' : '✗';
    const statusColored = useColor
      ? file.success
        ? chalk.green(status)
        : chalk.red(status)
      : status;

    const arrow = file.newPath ? ` → ${file.newPath}` : '';
    lines.push(`  ${statusColored} ${file.originalPath}${arrow}`);

    if (file.error) {
      const errorLine = `      Error: ${file.error}`;
      lines.push(useColor ? chalk.red(errorLine) : errorLine);
    }
  }

  return lines.join('\n');
}
