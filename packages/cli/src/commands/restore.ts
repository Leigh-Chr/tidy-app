/**
 * @fileoverview Restore command implementation - Story 9.4
 *
 * Commands:
 * - tidy restore <path>: Restore a file to its original name
 * - tidy restore <path> --lookup: View file history without restoring
 * - tidy restore --operation <id>: Restore all files from an operation
 *
 * AC covered (9.4):
 * - AC1: Restore command via CLI
 * - AC2: Restore by operation ID
 * - AC3: Lookup file history
 * - AC4: Restore preview (dry-run)
 * - AC5: File not in history
 * - AC6: File already at original name
 * - AC7: Handle missing files
 * - AC8: JSON output for restore results
 */
import { Command } from 'commander';
import chalk from 'chalk';
import { restoreFile, lookupFileHistory } from '@tidy/core';
import {
  formatRestorePreview,
  formatRestoreResult,
  formatRestoreJson,
  formatRestorePlain,
  formatFileLookup,
  formatFileLookupJson,
} from '../utils/restore-format.js';
import { shouldUseColor, configureColors } from '../utils/output.js';
import { ExitCode } from '../utils/exit-codes.js';

export type RestoreOutputFormat = 'table' | 'json' | 'plain';

export interface RestoreCommandOptions {
  operation?: string;
  lookup: boolean;
  dryRun: boolean;
  format: RestoreOutputFormat;
  color: boolean; // Commander's --no-color creates a 'color' boolean (inverted)
}

/**
 * Create the restore command.
 *
 * @returns Configured Commander command
 */
export function createRestoreCommand(): Command {
  const restore = new Command('restore');

  restore
    .description('Restore a file to its original name from history')
    .argument('<path>', 'File path to restore (use "-" with --operation)')
    .option('-o, --operation <id>', 'Restore all files from operation (same as undo)')
    .option('-l, --lookup', 'Just lookup file history, don\'t restore', false)
    .option('-n, --dry-run', 'Preview changes without executing', false)
    .option('-f, --format <type>', 'Output format: table, json, plain', 'table')
    .option('--no-color', 'Disable colored output')
    .addHelpText(
      'after',
      `
Output Formats:
  ${chalk.cyan('table')}   Detailed output with status indicators (default)
  ${chalk.cyan('json')}    Valid JSON output (pipeable to jq)
  ${chalk.cyan('plain')}   Simple text output (for scripting)

Examples:
  ${chalk.gray('# Restore a file to its original name')}
  $ tidy restore /photos/renamed-photo.jpg

  ${chalk.gray('# Preview what would be restored')}
  $ tidy restore /photos/renamed-photo.jpg --dry-run

  ${chalk.gray('# View file history without restoring')}
  $ tidy restore /photos/photo.jpg --lookup

  ${chalk.gray('# Restore all files from a specific operation')}
  $ tidy restore - --operation 550e8400-e29b-41d4-a716-446655440000

  ${chalk.gray('# Get restore result as JSON')}
  $ tidy restore /photos/photo.jpg --format json
`
    )
    .action(async (path: string, options: RestoreCommandOptions) => {
      // Validate path argument (required unless using --operation)
      if (!path || !path.trim()) {
        console.error(chalk.red('Error: File path cannot be empty'));
        process.exit(ExitCode.ERROR);
      }

      // Validate format option
      const validFormats: RestoreOutputFormat[] = ['table', 'json', 'plain'];
      if (!validFormats.includes(options.format)) {
        console.error(chalk.red(`Error: Invalid format '${options.format}'`));
        console.error(`Valid formats: ${validFormats.join(', ')}`);
        process.exit(ExitCode.ERROR);
      }

      // Configure colors based on TTY and options
      const useColor = shouldUseColor({ noColor: !options.color });
      configureColors(useColor);

      // Handle lookup mode (AC3)
      if (options.lookup) {
        await executeLookup(path, options, useColor);
      } else {
        await executeRestore(path, options, useColor);
      }
    });

  return restore;
}

/**
 * Execute the lookup operation (AC3).
 */
async function executeLookup(
  path: string,
  options: RestoreCommandOptions,
  useColor: boolean
): Promise<void> {
  const result = await lookupFileHistory(path);

  // Handle errors
  if (!result.ok) {
    console.error(chalk.red(`Error: ${result.error.message}`));
    process.exit(ExitCode.ERROR);
  }

  // AC5: File not in history
  // Note: Using console.log consistently for all formats (not an error, just "not found")
  if (!result.data) {
    if (options.format === 'json') {
      console.log(JSON.stringify({ found: false, searchedPath: path }, null, 2));
    } else if (options.format === 'plain') {
      console.log('not-found');
    } else {
      console.log(chalk.yellow(`No history found for file: ${path}`));
    }
    process.exit(ExitCode.ERROR);
  }

  // Output based on format
  switch (options.format) {
    case 'json':
      console.log(formatFileLookupJson(result.data));
      break;
    case 'plain':
      // Plain format: one key=value per line
      console.log(`found=true`);
      console.log(`original=${result.data.originalPath ?? 'N/A'}`);
      console.log(`current=${result.data.currentPath ?? 'N/A'}`);
      console.log(`at-original=${result.data.isAtOriginal}`);
      break;
    case 'table':
    default:
      console.log(formatFileLookup(result.data, { color: useColor }));
      break;
  }

  process.exit(ExitCode.SUCCESS);
}

/**
 * Execute the restore operation.
 *
 * AC1: Restore command via CLI
 * AC2: Restore by operation ID
 * AC4: Restore preview (dry-run)
 * AC5: File not in history
 * AC6: File already at original name
 * AC7: Handle missing files
 * AC8: JSON output format
 */
async function executeRestore(
  path: string,
  options: RestoreCommandOptions,
  useColor: boolean
): Promise<void> {
  // Execute the restore operation
  const result = await restoreFile(path, {
    dryRun: options.dryRun,
    operationId: options.operation,
  });

  // Handle errors
  if (!result.ok) {
    console.error(chalk.red(`Error: ${result.error.message}`));
    process.exit(ExitCode.ERROR);
  }

  const restoreResult = result.data;

  // Output based on format (AC4 preview, AC8 JSON)
  switch (options.format) {
    case 'json':
      // AC8: Valid JSON output
      console.log(formatRestoreJson(restoreResult));
      break;
    case 'plain':
      console.log(formatRestorePlain(restoreResult));
      break;
    case 'table':
    default:
      // AC4: Preview or AC1: Result
      if (restoreResult.dryRun) {
        console.log(formatRestorePreview(restoreResult, { color: useColor }));
      } else {
        console.log(formatRestoreResult(restoreResult, { color: useColor }));
      }
      break;
  }

  // Determine exit code based on result
  if (restoreResult.dryRun) {
    // Dry-run: exit based on whether restore WOULD succeed
    process.exit(restoreResult.success ? ExitCode.SUCCESS : ExitCode.ERROR);
  } else if (restoreResult.success) {
    // AC1: Restore succeeded (including AC6: already at original)
    process.exit(ExitCode.SUCCESS);
  } else {
    // AC5, AC7: Restore failed (not in history, missing file, etc.)
    process.exit(ExitCode.ERROR);
  }
}
