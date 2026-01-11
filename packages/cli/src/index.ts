/**
 * @tidy/cli - Command-line interface for tidy-app
 *
 * Usage:
 *   tidy info              Display app info and LLM status
 *   tidy scan <folder>     Scan folder for files
 *   tidy preview           Preview renames
 *   tidy apply             Apply renames
 *   tidy config            Manage configuration
 *   tidy history           View operation history
 *   tidy undo [id]         Undo a rename/move operation
 *   tidy restore <path>    Restore a file to its original name
 *
 * Story 5.2: Custom config via --config argument
 * Story 5.8: Exit codes for scripting
 * Story 9.2: View operation history
 * Story 9.3: Undo operations
 * Story 9.4: Restore original filenames
 * Story 10.1: LLM status in info command
 */

import { Command, Option } from 'commander';
import chalk from 'chalk';
import { resolve } from 'node:path';
import {
  VERSION,
  loadConfig,
  resolveConfigPath,
  type AppConfig,
} from '@tidy/core';
import { createConfigCommand } from './commands/config.js';
import { createHistoryCommand } from './commands/history.js';
import { createUndoCommand } from './commands/undo.js';
import { createRestoreCommand } from './commands/restore.js';
import { createScanCommand } from './commands/scan.js';
import { createInfoCommand } from './commands/info.js';
import { setupSignalHandlers } from './utils/signals.js';
import { ExitCode } from './utils/exit-codes.js';

// Setup signal handlers before anything else (Story 5.8)
setupSignalHandlers();

// =============================================================================
// CLI Context (Story 5.2 - AC4: Config persists across subcommands)
// =============================================================================

/**
 * Shared context passed to all command handlers.
 */
export interface CliContext {
  /** Resolved config path (if custom path provided) */
  configPath?: string;
  /** Loaded application config */
  config: AppConfig;
}

// =============================================================================
// Program Setup
// =============================================================================

const program = new Command();

program
  .name('tidy')
  .description('Intelligent file organization tool')
  .version(`tidy-app v${VERSION}`, '-V, --version', 'Display version number')
  .addOption(
    new Option('-c, --config <path>', 'Path to config file')
      .env('TIDY_CONFIG')
  )
  .hook('preAction', async (thisCommand) => {
    const options = thisCommand.opts<{ config?: string }>();

    // Resolve config path using precedence: --config > TIDY_CONFIG > default
    const configPath = options.config
      ? resolve(process.cwd(), options.config)
      : resolveConfigPath();

    // Load config - strict mode for custom paths
    const isCustomPath = !!options.config || !!process.env.TIDY_CONFIG;
    const configResult = await loadConfig({
      configPath,
      strict: isCustomPath,
    });

    if (!configResult.ok) {
      console.error(chalk.red(`Error: ${configResult.error.message}`));
      process.exit(ExitCode.ERROR);
    }

    // Attach context to command for subcommands to access
    thisCommand.setOptionValue('_context', {
      configPath: isCustomPath ? configPath : undefined,
      config: configResult.data,
    } satisfies CliContext);
  });

// Info command (Story 10.1 - AC5: LLM status display)
program.addCommand(createInfoCommand());

// Scan command (Story 5.5)
program.addCommand(createScanCommand());

// Config command (Story 5.3)
program.addCommand(createConfigCommand());

// History command (Story 9.2)
program.addCommand(createHistoryCommand());

// Undo command (Story 9.3)
program.addCommand(createUndoCommand());

// Restore command (Story 9.4)
program.addCommand(createRestoreCommand());

// Handle unknown commands (Story 5.5 - AC5)
program.on('command:*', (operands) => {
  console.error(chalk.red(`Error: Unknown command '${operands[0]}'`));
  console.error();
  console.error('Run ' + chalk.cyan('tidy --help') + ' to see available commands.');
  process.exit(ExitCode.ERROR);
});

// Add exit code documentation to help (Story 5.8 - AC5)
program.addHelpText('after', `
${chalk.bold('Exit Codes:')}
  0    Success - operation completed without errors
  1    Error - operation failed
  2    Warning - operation completed with warnings
  130  Interrupted - user pressed Ctrl+C
  143  Terminated - process received SIGTERM signal

${chalk.bold('Examples:')}
  ${chalk.gray('# Check if scan succeeded')}
  $ tidy scan ~/Downloads && echo "Success!"

  ${chalk.gray('# Handle different exit codes')}
  $ tidy scan /invalid/path
  $ if [ $? -eq 1 ]; then echo "Error occurred"; fi

  ${chalk.gray('# Use in CI/CD pipelines')}
  $ tidy scan . --format json || exit 1
`);

program.parse();
