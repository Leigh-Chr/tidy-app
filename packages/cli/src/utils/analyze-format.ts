/**
 * @fileoverview Analyze command output formatters
 *
 * Provides formatters for the analyze command output in different formats:
 * - table: Human-readable table with AI suggestions
 * - json: Machine-readable JSON
 * - plain: Simple list of suggestions
 */
import chalk from 'chalk';
import { basename } from 'node:path';
import type { AnalysisResultWithPath } from '../commands/analyze.js';

/**
 * Options for formatters.
 */
export interface AnalyzeFormatOptions {
  /** Whether to use colors in output (default: true) */
  color?: boolean;
}

/**
 * Summary of analysis results.
 */
export interface AnalyzeSummary {
  total: number;
  analyzed: number;
  skipped: number;
  errors: number;
}

// =============================================================================
// Table Formatter
// =============================================================================

/**
 * Format analysis results as a human-readable table.
 */
export function formatAnalyzeTable(
  results: AnalysisResultWithPath[],
  options: AnalyzeFormatOptions = {}
): string {
  const useColor = options.color ?? true;
  const lines: string[] = [];

  // Group by status
  const analyzed = results.filter((r) => r.suggestion);
  const skipped = results.filter((r) => r.skipped);
  const errors = results.filter((r) => r.error && !r.skipped);

  // Analyzed files with suggestions
  if (analyzed.length > 0) {
    lines.push(useColor ? chalk.green.bold('AI Suggestions:') : 'AI Suggestions:');
    lines.push('');

    for (const result of analyzed) {
      const originalName = basename(result.filePath);
      const suggestion = result.suggestion!;
      const confidence = Math.round(suggestion.confidence * 100);

      // Format confidence indicator
      let confidenceColor = chalk.gray;
      if (confidence >= 80) confidenceColor = chalk.green;
      else if (confidence >= 50) confidenceColor = chalk.yellow;
      else confidenceColor = chalk.red;

      const confidenceText = useColor
        ? confidenceColor(`${confidence}%`)
        : `${confidence}%`;

      // Icon based on source
      const icon = result.source === 'vision' ? '\uD83D\uDC41' : '\uD83E\uDD16'; // 👁 or 🤖

      lines.push(`  ${icon} ${originalName}`);
      lines.push(`     ${chalk.dim('\u2192')} ${useColor ? chalk.cyan(suggestion.suggestedName) : suggestion.suggestedName} ${chalk.dim(`(${confidenceText})`)}`);

      // Show reasoning if available
      if (suggestion.reasoning) {
        const reasoning = suggestion.reasoning.length > 60
          ? suggestion.reasoning.slice(0, 57) + '...'
          : suggestion.reasoning;
        lines.push(`     ${chalk.dim(reasoning)}`);
      }

      lines.push('');
    }
  }

  // Skipped files
  if (skipped.length > 0) {
    lines.push(useColor ? chalk.gray.bold('Skipped:') : 'Skipped:');
    lines.push('');

    for (const result of skipped.slice(0, 5)) {
      const originalName = basename(result.filePath);
      lines.push(`  ${chalk.gray('-')} ${chalk.gray(originalName)}`);
      if (result.skipReason) {
        lines.push(`     ${chalk.dim(result.skipReason)}`);
      }
    }

    if (skipped.length > 5) {
      lines.push(chalk.gray(`  ... and ${skipped.length - 5} more skipped`));
    }
    lines.push('');
  }

  // Errors
  if (errors.length > 0) {
    lines.push(useColor ? chalk.red.bold('Errors:') : 'Errors:');
    lines.push('');

    for (const result of errors.slice(0, 5)) {
      const originalName = basename(result.filePath);
      lines.push(`  ${chalk.red('\u2717')} ${originalName}`);
      if (result.error) {
        lines.push(`     ${chalk.red(result.error)}`);
      }
    }

    if (errors.length > 5) {
      lines.push(chalk.red(`  ... and ${errors.length - 5} more errors`));
    }
    lines.push('');
  }

  return lines.join('\n');
}

// =============================================================================
// Summary Formatter
// =============================================================================

/**
 * Format analysis summary.
 */
export function formatAnalyzeSummary(
  summary: AnalyzeSummary,
  options: AnalyzeFormatOptions = {}
): string {
  const useColor = options.color ?? true;
  const lines: string[] = [];

  lines.push(useColor ? chalk.bold('Summary:') : 'Summary:');

  const parts: string[] = [];

  if (summary.analyzed > 0) {
    const text = `${summary.analyzed} analyzed`;
    parts.push(useColor ? chalk.green(text) : text);
  }

  if (summary.skipped > 0) {
    const text = `${summary.skipped} skipped`;
    parts.push(useColor ? chalk.gray(text) : text);
  }

  if (summary.errors > 0) {
    const text = `${summary.errors} error${summary.errors > 1 ? 's' : ''}`;
    parts.push(useColor ? chalk.red(text) : text);
  }

  lines.push(`  ${parts.join(', ')} (${summary.total} total)`);

  // Add hint about using results
  if (summary.analyzed > 0) {
    lines.push('');
    lines.push(chalk.gray('Use these suggestions to inform your template choices,'));
    lines.push(chalk.gray('or copy suggested names directly.'));
  }

  return lines.join('\n');
}

// =============================================================================
// JSON Formatter
// =============================================================================

/**
 * Format analysis results as JSON.
 */
export function formatAnalyzeJson(
  results: AnalysisResultWithPath[],
  summary: AnalyzeSummary
): string {
  const serializable = {
    results: results.map((r) => ({
      filePath: r.filePath,
      fileName: r.fileName,
      analyzed: !!r.suggestion,
      suggestion: r.suggestion
        ? {
            suggestedName: r.suggestion.suggestedName,
            confidence: r.suggestion.confidence,
            reasoning: r.suggestion.reasoning || null,
            keywords: r.suggestion.keywords || [],
          }
        : null,
      skipped: r.skipped || false,
      skipReason: r.skipReason || null,
      error: r.error || null,
      source: r.source,
    })),
    summary,
  };

  return JSON.stringify(serializable, null, 2);
}

// =============================================================================
// Plain Formatter
// =============================================================================

/**
 * Format as plain text (suggestions only).
 * Format: original_name -> suggested_name
 */
export function formatAnalyzePlain(results: AnalysisResultWithPath[]): string {
  return results
    .filter((r) => r.suggestion)
    .map((r) => `${r.fileName}\t${r.suggestion!.suggestedName}`)
    .join('\n');
}
