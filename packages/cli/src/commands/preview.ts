/**
 * @fileoverview Preview command implementation
 *
 * Commands:
 * - tidy preview [folder]: Preview rename proposals based on templates and rules
 *
 * Features:
 * - Uses templates to generate new filenames
 * - Applies metadata and filename pattern rules
 * - Detects conflicts and issues before execution
 * - Supports multiple output formats (table, json, plain)
 */
import { Command } from 'commander';
import chalk from 'chalk';
import {
  scanAndApplyRules,
  type ScanAndApplyOptions,
} from '@tidy/core';
import type { CliContext } from '../index.js';
import { getFolderToScan } from '../utils/path.js';
import {
  formatPreviewTable,
  formatPreviewJson,
  formatPreviewPlain,
  formatPreviewSummary,
} from '../utils/preview-format.js';
import { shouldUseColor, configureColors } from '../utils/output.js';
import { ExitCode } from '../utils/exit-codes.js';
import { createProgressReporter } from '../utils/progress.js';

export type PreviewOutputFormat = 'table' | 'json' | 'plain';

export interface PreviewCommandOptions {
  format: PreviewOutputFormat;
  template?: string;
  withRules: boolean;
  recursive: boolean;
  extensions?: string;
  color: boolean;
  verbose: boolean;
}

/**
 * Create the preview command.
 */
export function createPreviewCommand(): Command {
  const preview = new Command('preview');

  preview
    .description('Preview rename proposals for files in a folder')
    .argument('[folder]', 'Folder to preview (defaults to current directory)')
    .option('-f, --format <type>', 'Output format: table, json, plain', 'table')
    .option('-t, --template <name>', 'Use a specific template by name')
    .option('-R, --with-rules', 'Apply metadata and filename pattern rules', false)
    .option('-r, --recursive', 'Scan subfolders recursively', false)
    .option('-e, --extensions <list>', 'Filter by extensions (comma-separated, e.g., jpg,png,pdf)')
    .option('--no-color', 'Disable colored output')
    .option('-v, --verbose', 'Show detailed progress information', false)
    .addHelpText(
      'after',
      `
Output Formats:
  ${chalk.cyan('table')}   Detailed table showing original → new names (default)
  ${chalk.cyan('json')}    Valid JSON with full proposal details (for scripting)
  ${chalk.cyan('plain')}   Simple list of changes (for piping)

Examples:
  ${chalk.gray('# Preview renames in current directory')}
  $ tidy preview

  ${chalk.gray('# Preview with a specific template')}
  $ tidy preview ~/Downloads --template "dated-photos"

  ${chalk.gray('# Preview with rules applied (metadata + filename patterns)')}
  $ tidy preview ~/Documents --with-rules

  ${chalk.gray('# Preview only images, recursively')}
  $ tidy preview ~/Photos --recursive --extensions jpg,png,heic

  ${chalk.gray('# Get JSON output for scripting')}
  $ tidy preview ~/Downloads --format json | jq '.proposals | length'

  ${chalk.gray('# Preview then apply')}
  $ tidy preview ~/Downloads && tidy apply ~/Downloads

Related Commands:
  ${chalk.cyan('tidy apply')}     Execute the previewed renames
  ${chalk.cyan('tidy scan')}      Just list files without rename proposals
  ${chalk.cyan('tidy analyze')}   Get AI-powered naming suggestions
`
    )
    .action(async (folder: string | undefined, options: PreviewCommandOptions, command) => {
      // Validate format option
      const validFormats: PreviewOutputFormat[] = ['table', 'json', 'plain'];
      if (!validFormats.includes(options.format)) {
        console.error(chalk.red(`Error: Invalid format '${options.format}'`));
        console.error(`Valid formats: ${validFormats.join(', ')}`);
        process.exit(ExitCode.ERROR);
      }

      // Configure colors
      const useColor = shouldUseColor({ noColor: !options.color });
      configureColors(useColor);

      // Get context for config
      const context = command.parent?.opts()._context as CliContext | undefined;

      await executePreview(folder, options, context, useColor);
    });

  return preview;
}

/**
 * Execute the preview operation.
 */
async function executePreview(
  folder: string | undefined,
  options: PreviewCommandOptions,
  context: CliContext | undefined,
  useColor: boolean
): Promise<void> {
  // Resolve folder path
  const folderResult = await getFolderToScan(folder);

  if (!folderResult.ok) {
    console.error(chalk.red(`Error: ${folderResult.error.message}`));
    process.exit(ExitCode.ERROR);
  }

  const { path: folderPath, isDefault } = folderResult.data;

  // Show scanning message for table format
  if (options.format === 'table') {
    if (isDefault) {
      console.log(chalk.gray(`Previewing renames in current directory: ${folderPath}`));
    } else {
      console.log(chalk.gray(`Previewing renames in: ${folderPath}`));
    }
    console.log();
  }

  // Get config
  const config = context?.config;
  if (!config) {
    console.error(chalk.red('Error: Configuration not loaded'));
    process.exit(ExitCode.ERROR);
  }

  // Parse extensions if provided
  const extensions = options.extensions
    ? options.extensions.split(',').map((e) => e.trim().toLowerCase().replace(/^\./, ''))
    : undefined;

  // Build options for scanAndApplyRules
  const scanOptions: ScanAndApplyOptions = {
    recursive: options.recursive,
    extensions,
    baseDirectory: folderPath,
  };

  // Add progress callback for verbose mode
  if (options.verbose && options.format === 'table') {
    const progress = createProgressReporter();
    scanOptions.onProgress = (current, total, phase) => {
      progress.update(phase, current, total);
    };
  }

  // Determine which template to use
  let effectiveConfig = config;
  if (options.template) {
    // Find the template by name
    const template = config.templates.find((t) => t.name === options.template);
    if (!template) {
      console.error(chalk.red(`Error: Template '${options.template}' not found`));
      console.error(chalk.gray('Available templates:'));
      for (const t of config.templates) {
        console.error(chalk.gray(`  - ${t.name}`));
      }
      process.exit(ExitCode.ERROR);
    }
    // Create a modified config with this template as default
    effectiveConfig = {
      ...config,
      preferences: {
        ...config.preferences,
        defaultTemplate: options.template,
      },
    };
  }

  // Execute scan and apply rules
  const result = await scanAndApplyRules(folderPath, effectiveConfig, scanOptions);

  if (!result.ok) {
    const error = result.error;
    if (error.type === 'cancelled') {
      console.error(chalk.yellow('Preview cancelled'));
      process.exit(ExitCode.ERROR);
    }
    if (error.type === 'no_default_template') {
      console.error(chalk.red('Error: No default template configured'));
      console.error(chalk.gray('Set a default template with: tidy config set preferences.defaultTemplate <name>'));
      process.exit(ExitCode.ERROR);
    }
    console.error(chalk.red(`Error: ${error.message}`));
    process.exit(ExitCode.ERROR);
  }

  const preview = result.data;

  // Handle empty results
  if (preview.proposals.length === 0) {
    if (options.format === 'json') {
      console.log(JSON.stringify({ proposals: [], summary: preview.summary }, null, 2));
    } else if (options.format === 'plain') {
      // Plain format outputs nothing for empty results
    } else {
      console.log(chalk.yellow('No files found to preview.'));
    }
    process.exit(ExitCode.SUCCESS);
  }

  // Output based on format
  switch (options.format) {
    case 'json':
      console.log(formatPreviewJson(preview));
      break;
    case 'plain':
      console.log(formatPreviewPlain(preview));
      break;
    case 'table':
    default:
      console.log(formatPreviewTable(preview, { color: useColor, verbose: options.verbose }));
      console.log();
      console.log(formatPreviewSummary(preview, { color: useColor }));
      break;
  }

  // Determine exit code based on preview status
  const hasErrors = preview.summary.conflict > 0 || preview.summary.error > 0;
  const hasWarnings = preview.summary.skipped > 0;

  if (hasErrors) {
    process.exit(ExitCode.ERROR);
  } else if (hasWarnings) {
    process.exit(ExitCode.WARNING);
  } else {
    process.exit(ExitCode.SUCCESS);
  }
}
