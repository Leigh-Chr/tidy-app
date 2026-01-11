/**
 * @fileoverview History command implementation - Story 9.2
 *
 * Commands:
 * - tidy history: List recent operations
 * - tidy history <id>: View details of a specific operation
 *
 * AC covered (9.2):
 * - AC1: View history via CLI command
 * - AC2: Empty history handling
 * - AC3: Limit history results
 * - AC4: View single entry details
 * - AC5: Invalid entry ID handling
 * - AC6: JSON output format
 * - AC7: Table output format
 * - AC8: Filter by operation type
 */
import { Command } from 'commander';
import chalk from 'chalk';
import { getHistory, getHistoryEntry, type QueryOptions, type OperationType } from '@tidy/core';
import {
  formatHistoryTable,
  formatHistoryJson,
  formatHistoryPlain,
  formatHistoryEntryDetail,
} from '../utils/history-format.js';
import { shouldUseColor, configureColors } from '../utils/output.js';
import { ExitCode } from '../utils/exit-codes.js';

export type OutputFormat = 'table' | 'json' | 'plain';

export interface HistoryCommandOptions {
  limit: string;
  format: OutputFormat;
  type?: string;
  color: boolean; // Commander's --no-color creates a 'color' boolean (inverted)
}

/**
 * Create the history command.
 *
 * @returns Configured Commander command
 */
export function createHistoryCommand(): Command {
  const history = new Command('history');

  history
    .description('View operation history')
    .argument('[id]', 'Optional entry ID to view details')
    .option('-l, --limit <n>', 'Maximum entries to show', '10')
    .option('-f, --format <type>', 'Output format: table, json, plain', 'table')
    .option('-t, --type <type>', 'Filter by operation type: rename, move, organize')
    .option('--no-color', 'Disable colored output')
    .addHelpText(
      'after',
      `
Output Formats:
  ${chalk.cyan('table')}   ASCII table with columns (default, human-readable)
  ${chalk.cyan('json')}    Valid JSON array (pipeable to jq)
  ${chalk.cyan('plain')}   One entry ID per line (for scripting)

Operation Types:
  ${chalk.cyan('rename')}    Files renamed in place
  ${chalk.cyan('move')}      Files moved to different directories
  ${chalk.cyan('organize')}  Files organized using folder structures

Examples:
  ${chalk.gray('# View recent operations (default: last 10)')}
  $ tidy history

  ${chalk.gray('# View last 5 operations')}
  $ tidy history --limit 5

  ${chalk.gray('# View only rename operations')}
  $ tidy history --type rename

  ${chalk.gray('# View details of a specific operation')}
  $ tidy history 550e8400-e29b-41d4-a716-446655440000

  ${chalk.gray('# JSON output for scripting')}
  $ tidy history --format json | jq '.[0]'

  ${chalk.gray('# List entry IDs for scripting')}
  $ tidy history --format plain | head -1
`
    )
    .action(async (id: string | undefined, options: HistoryCommandOptions) => {
      // Validate format option (AC7 - default is table)
      const validFormats: OutputFormat[] = ['table', 'json', 'plain'];
      if (!validFormats.includes(options.format)) {
        console.error(chalk.red(`Error: Invalid format '${options.format}'`));
        console.error(`Valid formats: ${validFormats.join(', ')}`);
        process.exit(ExitCode.ERROR);
      }

      // Validate type option if provided (AC8)
      const validTypes: OperationType[] = ['rename', 'move', 'organize'];
      if (options.type && !validTypes.includes(options.type as OperationType)) {
        console.error(chalk.red(`Error: Invalid type '${options.type}'`));
        console.error(`Valid types: ${validTypes.join(', ')}`);
        process.exit(ExitCode.ERROR);
      }

      // Configure colors based on TTY and options
      const useColor = shouldUseColor({ noColor: !options.color });
      configureColors(useColor);

      if (id) {
        // AC4, AC5: Show single entry details or error
        await executeShowEntry(id, useColor);
      } else {
        // AC1, AC2, AC3, AC6, AC7, AC8: List entries
        await executeListHistory(options, useColor);
      }
    });

  return history;
}

/**
 * Execute the list history operation.
 */
async function executeListHistory(
  options: HistoryCommandOptions,
  useColor: boolean
): Promise<void> {
  // Parse limit option (AC3)
  const limit = parseInt(options.limit, 10);
  if (isNaN(limit) || limit < 0) {
    console.error(chalk.red(`Error: Invalid limit '${options.limit}'`));
    console.error('Limit must be a non-negative number.');
    process.exit(ExitCode.ERROR);
  }

  // Build query options (AC3, AC8)
  const queryOptions: QueryOptions = {};

  if (limit > 0) {
    queryOptions.limit = limit;
  }

  if (options.type) {
    queryOptions.type = options.type as OperationType;
  }

  // Get history entries
  const result = await getHistory(queryOptions);

  if (!result.ok) {
    console.error(chalk.red(`Error: ${result.error.message}`));
    process.exit(ExitCode.ERROR);
  }

  const entries = result.data;

  // AC2: Handle empty history
  if (entries.length === 0) {
    if (options.format === 'json') {
      // Output empty JSON array for consistent piping
      console.log('[]');
    } else if (options.format === 'plain') {
      // Plain format outputs nothing for empty results
      return;
    } else {
      console.log('No operation history found.');
    }
    return;
  }

  // Output based on format (AC6, AC7)
  switch (options.format) {
    case 'json':
      // AC6: Valid JSON output
      console.log(formatHistoryJson(entries));
      break;
    case 'plain':
      // Plain: One ID per line
      console.log(formatHistoryPlain(entries));
      break;
    case 'table':
    default:
      // AC7: Formatted ASCII table with color control
      console.log(formatHistoryTable(entries, { color: useColor }));
      break;
  }
}

/**
 * Execute the show single entry operation.
 */
async function executeShowEntry(id: string, useColor: boolean): Promise<void> {
  // AC4: Get entry details
  const result = await getHistoryEntry(id);

  if (!result.ok) {
    console.error(chalk.red(`Error: ${result.error.message}`));
    process.exit(ExitCode.ERROR);
  }

  // AC5: Handle invalid entry ID
  if (!result.data) {
    console.error(chalk.red(`History entry not found: ${id}`));
    process.exit(ExitCode.ERROR);
  }

  // AC4: Show detailed information
  console.log(formatHistoryEntryDetail(result.data, { color: useColor }));
}
