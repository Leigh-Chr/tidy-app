/**
 * @fileoverview Scan command implementation - Story 5.5, 5.6, 5.7, 5.8
 *
 * Commands:
 * - tidy scan [folder]: Scan folder and display files
 *
 * AC covered (5.5):
 * - AC3: Scan command accepts folder argument
 * - AC4: Subcommand help is available
 *
 * AC covered (5.6):
 * - AC1: Folder argument accepts absolute paths
 * - AC2: Folder argument accepts relative paths
 * - AC3: No folder argument uses current directory
 * - AC4: Paths with spaces handled correctly
 * - AC5: Invalid path shows clear error
 * - AC6: Home directory expansion works
 *
 * AC covered (5.7):
 * - AC1: JSON format outputs valid JSON
 * - AC2: Table format shows formatted ASCII table
 * - AC3: Plain format outputs one item per line
 * - AC4: Default format is table
 * - AC5: Output is pipeable
 * - AC6: Colors disabled when not TTY
 *
 * AC covered (5.8):
 * - AC1: Exit code 0 on success
 * - AC2: Exit code 1 on error
 */
import { Command } from 'commander';
import chalk from 'chalk';
import { scanFolder, type ScanOptions } from '@tidy/core';
import { getFolderToScan } from '../utils/path.js';
import { formatTable, formatJson, formatPlain } from '../utils/format.js';
import { shouldUseColor, configureColors } from '../utils/output.js';
import { ExitCode } from '../utils/exit-codes.js';

export type OutputFormat = 'table' | 'json' | 'plain';

export interface ScanCommandOptions {
  format: OutputFormat;
  recursive: boolean;
  color: boolean; // Commander's --no-color creates a 'color' boolean (inverted)
}

export function createScanCommand(): Command {
  const scan = new Command('scan');

  scan
    .description('Scan a folder and list files with metadata')
    .argument('[folder]', 'Folder to scan (defaults to current directory)')
    .option('-f, --format <type>', 'Output format: table, json, plain', 'table')
    .option('-r, --recursive', 'Scan subfolders recursively', false)
    .option('--no-color', 'Disable colored output')
    .addHelpText(
      'after',
      `
Output Formats:
  ${chalk.cyan('table')}   ASCII table with columns (default, human-readable)
  ${chalk.cyan('json')}    Valid JSON array (pipeable to jq)
  ${chalk.cyan('plain')}   One file path per line (for xargs, while read)

Examples:
  ${chalk.gray('# Scan current directory')}
  $ tidy scan

  ${chalk.gray('# Scan specific folder')}
  $ tidy scan /path/to/folder

  ${chalk.gray('# Scan folder with spaces in name')}
  $ tidy scan "/path/to/my folder"

  ${chalk.gray('# Scan home directory')}
  $ tidy scan ~/Downloads

  ${chalk.gray('# Scan relative path')}
  $ tidy scan ./projects/client-work

  ${chalk.gray('# Recursive scan with JSON output')}
  $ tidy scan ~/Downloads --recursive --format json

  ${chalk.gray('# JSON for scripting with jq')}
  $ tidy scan --format json | jq '.[] | select(.size > 1000000)'

  ${chalk.gray('# Plain for piping to other commands')}
  $ tidy scan --format plain | xargs -I {} du -h {}

  ${chalk.gray('# Disable colors when redirecting')}
  $ tidy scan --no-color > files.txt
`
    )
    .action(async (folder: string | undefined, options: ScanCommandOptions) => {
      // Validate format option (AC4 - default is table)
      const validFormats: OutputFormat[] = ['table', 'json', 'plain'];
      if (!validFormats.includes(options.format)) {
        console.error(chalk.red(`Error: Invalid format '${options.format}'`));
        console.error(`Valid formats: ${validFormats.join(', ')}`);
        process.exit(ExitCode.ERROR);
      }

      // Configure colors based on TTY and options (AC6)
      // Commander's --no-color creates options.color = false
      const useColor = shouldUseColor({ noColor: !options.color });
      configureColors(useColor);

      await executeScan(folder, options, useColor);
    });

  return scan;
}

async function executeScan(
  folder: string | undefined,
  options: ScanCommandOptions,
  useColor: boolean
): Promise<void> {
  // Resolve and validate folder (AC1, AC2, AC3, AC4, AC5, AC6)
  const folderResult = await getFolderToScan(folder);

  if (!folderResult.ok) {
    console.error(chalk.red(`Error: ${folderResult.error.message}`));
    process.exit(ExitCode.ERROR);
  }

  const { path: folderPath, isDefault } = folderResult.data;

  // Inform user which directory is being scanned (5.6 AC3)
  // Only show for table format (not json/plain which need clean output for piping - 5.7 AC5)
  if (options.format === 'table') {
    if (isDefault) {
      console.log(chalk.gray(`Scanning current directory: ${folderPath}`));
    } else {
      console.log(chalk.gray(`Scanning: ${folderPath}`));
    }
    console.log();
  }

  // Perform scan
  const scanOptions: ScanOptions = {
    recursive: options.recursive,
  };

  const result = await scanFolder(folderPath, scanOptions);

  if (!result.ok) {
    console.error(chalk.red(`Error: ${result.error.message}`));
    process.exit(ExitCode.ERROR);
  }

  const files = result.data;

  // Handle empty results (AC5 - pipeable, output consistent format)
  if (files.length === 0) {
    if (options.format === 'json') {
      // Output empty JSON array for consistent piping (AC5)
      console.log('[]');
    } else if (options.format === 'plain') {
      // Plain format outputs nothing for empty results
      return;
    } else {
      console.log(chalk.yellow('No files found.'));
    }
    return;
  }

  // Output based on format (AC1, AC2, AC3, AC4)
  switch (options.format) {
    case 'json':
      // AC1: Valid JSON output
      console.log(formatJson(files));
      break;
    case 'plain':
      // AC3: One path per line
      console.log(formatPlain(files));
      break;
    case 'table':
    default:
      // AC2: Formatted ASCII table with color control (AC6)
      console.log(formatTable(files, { color: useColor }));
      break;
  }
}
