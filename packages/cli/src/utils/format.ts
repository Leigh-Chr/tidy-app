/**
 * @fileoverview Output formatting utilities - Story 5.5, 5.7
 *
 * Provides formatters for CLI output in different formats:
 * - table: Human-readable table with headers
 * - json: Machine-readable JSON
 * - plain: One path per line (for piping to other tools)
 *
 * AC covered (5.7):
 * - AC1: JSON format outputs valid JSON
 * - AC2: Table format shows formatted ASCII table
 * - AC3: Plain format outputs one item per line
 * - AC4: Default format is table
 */
import chalk from 'chalk';
import type { FileInfo } from '@tidy/core';

/**
 * Options for formatters that support color control.
 */
export interface FormatOptions {
  /** Whether to use colors in output (default: true) */
  color?: boolean;
}

/**
 * Format files as a human-readable table.
 *
 * AC2: Table format shows formatted ASCII table
 * - Columns are aligned properly
 * - Header row is included
 */
export function formatTable(files: FileInfo[], options: FormatOptions = {}): string {
  const useColor = options.color ?? true;
  const lines: string[] = [];

  // Header
  const header = 'Name'.padEnd(40) + 'Type'.padEnd(10) + 'Size';
  lines.push(useColor ? chalk.bold(header) : header);
  lines.push('-'.repeat(60));

  // Rows
  for (const file of files) {
    const name =
      file.fullName.length > 38
        ? file.fullName.slice(0, 35) + '...'
        : file.fullName.padEnd(40);
    const type = (file.extension || '-').padEnd(10);
    const size = formatSize(file.size);

    lines.push(`${name}${type}${size}`);
  }

  // Footer
  lines.push('-'.repeat(60));
  const footer = `Total: ${files.length} file${files.length !== 1 ? 's' : ''}`;
  lines.push(useColor ? chalk.gray(footer) : footer);

  return lines.join('\n');
}

/**
 * Serializable file info for JSON output.
 * Converts Date objects to ISO strings.
 */
interface SerializableFileInfo {
  path: string;
  name: string;
  fullName: string;
  extension: string | null;
  size: number;
  createdAt: string;
  modifiedAt: string;
  relativePath?: string;
  category?: string;
}

/**
 * Format files as JSON (suitable for piping to jq).
 *
 * AC1: JSON format outputs valid JSON
 * - Output is valid JSON (parseable by jq)
 * - Output can be piped to other commands
 * - Dates are serialized as ISO strings for compatibility
 */
export function formatJson(files: FileInfo[]): string {
  // Transform dates to ISO strings for JSON compatibility
  const serializable: SerializableFileInfo[] = files.map((file) => ({
    path: file.path,
    name: file.name,
    fullName: file.fullName,
    extension: file.extension,
    size: file.size,
    createdAt: file.createdAt.toISOString(),
    modifiedAt: file.modifiedAt.toISOString(),
    relativePath: file.relativePath,
    category: file.category,
  }));

  return JSON.stringify(serializable, null, 2);
}

/**
 * Format files as plain text (one path per line, for xargs/while read).
 */
export function formatPlain(files: FileInfo[]): string {
  return files.map((f) => f.path).join('\n');
}

/**
 * Format byte size as human-readable string.
 */
function formatSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  // Use 0 decimal places for bytes, 1 for KB/MB/GB
  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}
