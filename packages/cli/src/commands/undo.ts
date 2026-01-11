/**
 * @fileoverview Undo command implementation - Story 9.3
 *
 * Commands:
 * - tidy undo: Undo the most recent operation
 * - tidy undo <id>: Undo a specific operation by ID
 *
 * AC covered (9.3):
 * - AC1: Undo single operation via CLI
 * - AC2: Undo most recent operation (no ID)
 * - AC3: Preview undo changes (dry-run)
 * - AC4: Handle partial undo
 * - AC5: Invalid operation ID handling
 * - AC6: Prevent double undo
 * - AC7: Remove empty directories created during original operation
 * - AC8: JSON output format
 */
import { Command } from 'commander';
import chalk from 'chalk';
import { undoOperation } from '@tidy/core';
import {
  formatUndoPreview,
  formatUndoResult,
  formatUndoJson,
  formatUndoPlain,
} from '../utils/undo-format.js';
import { shouldUseColor, configureColors } from '../utils/output.js';
import { ExitCode } from '../utils/exit-codes.js';

export type UndoOutputFormat = 'table' | 'json' | 'plain';

export interface UndoCommandOptions {
  dryRun: boolean;
  format: UndoOutputFormat;
  force: boolean;
  color: boolean; // Commander's --no-color creates a 'color' boolean (inverted)
}

/**
 * Create the undo command.
 *
 * @returns Configured Commander command
 */
export function createUndoCommand(): Command {
  const undo = new Command('undo');

  undo
    .description('Undo a rename/move operation')
    .argument('[id]', 'Operation ID to undo (defaults to most recent)')
    .option('-n, --dry-run', 'Preview changes without executing', false)
    .option('-f, --format <type>', 'Output format: table, json, plain', 'table')
    .option('--force', 'Force undo even if some files cannot be restored', false)
    .option('--no-color', 'Disable colored output')
    .addHelpText(
      'after',
      `
Output Formats:
  ${chalk.cyan('table')}   Detailed output with status indicators (default)
  ${chalk.cyan('json')}    Valid JSON output (pipeable to jq)
  ${chalk.cyan('plain')}   Simple text output (for scripting)

Examples:
  ${chalk.gray('# Undo the most recent operation')}
  $ tidy undo

  ${chalk.gray('# Undo a specific operation by ID')}
  $ tidy undo 550e8400-e29b-41d4-a716-446655440000

  ${chalk.gray('# Preview what would be undone without executing')}
  $ tidy undo --dry-run

  ${chalk.gray('# Force undo even if some files cannot be restored')}
  $ tidy undo --force

  ${chalk.gray('# Get undo result as JSON')}
  $ tidy undo --format json

  ${chalk.gray('# Get operation ID from history and undo')}
  $ tidy undo $(tidy history --format plain | head -1)
`
    )
    .action(async (id: string | undefined, options: UndoCommandOptions) => {
      // Validate format option
      const validFormats: UndoOutputFormat[] = ['table', 'json', 'plain'];
      if (!validFormats.includes(options.format)) {
        console.error(chalk.red(`Error: Invalid format '${options.format}'`));
        console.error(`Valid formats: ${validFormats.join(', ')}`);
        process.exit(ExitCode.ERROR);
      }

      // Configure colors based on TTY and options
      const useColor = shouldUseColor({ noColor: !options.color });
      configureColors(useColor);

      await executeUndo(id, options, useColor);
    });

  return undo;
}

/**
 * Execute the undo operation.
 *
 * AC1: Undo single operation via CLI (with ID)
 * AC2: Undo most recent operation (without ID)
 * AC3: Preview undo changes (dry-run)
 * AC4: Handle partial undo
 * AC5: Invalid operation ID handling
 * AC6: Prevent double undo
 * AC7: Remove empty directories
 * AC8: JSON output format
 */
async function executeUndo(
  id: string | undefined,
  options: UndoCommandOptions,
  useColor: boolean
): Promise<void> {
  // Execute the undo operation
  const result = await undoOperation(id ?? null, {
    dryRun: options.dryRun,
    force: options.force,
  });

  // Handle errors (AC5: invalid ID, AC6: already undone)
  if (!result.ok) {
    const errorMessage = result.error.message;

    // AC5: Operation not found
    if (errorMessage.includes('Operation not found')) {
      console.error(chalk.red(`Error: ${errorMessage}`));
      process.exit(ExitCode.ERROR);
    }

    // AC6: Operation already undone
    if (errorMessage.includes('Operation already undone')) {
      console.error(chalk.red(`Error: ${errorMessage}`));
      process.exit(ExitCode.ERROR);
    }

    // AC2: No operations in history
    if (errorMessage.includes('No operations in history')) {
      console.error(chalk.red('No operations in history to undo.'));
      process.exit(ExitCode.ERROR);
    }

    // Other errors
    console.error(chalk.red(`Error: ${errorMessage}`));
    process.exit(ExitCode.ERROR);
  }

  const undoResult = result.data;

  // Output based on format (AC3 preview, AC8 JSON)
  switch (options.format) {
    case 'json':
      // AC8: Valid JSON output
      console.log(formatUndoJson(undoResult));
      break;
    case 'plain':
      console.log(formatUndoPlain(undoResult));
      break;
    case 'table':
    default:
      // AC3: Preview or AC1: Result
      if (undoResult.dryRun) {
        console.log(formatUndoPreview(undoResult, { color: useColor }));
      } else {
        console.log(formatUndoResult(undoResult, { color: useColor }));
      }
      break;
  }

  // Determine exit code based on result (AC4: partial success)
  if (undoResult.dryRun) {
    // Dry-run always exits with success
    process.exit(ExitCode.SUCCESS);
  } else if (undoResult.success) {
    // AC1: All files restored successfully
    process.exit(ExitCode.SUCCESS);
  } else if (undoResult.filesRestored > 0) {
    // AC4: Partial success - some files restored, some failed
    process.exit(ExitCode.WARNING);
  } else {
    // All files failed to restore
    process.exit(ExitCode.ERROR);
  }
}
