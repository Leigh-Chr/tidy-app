/**
 * @fileoverview Signal handlers for graceful shutdown - Story 5.8
 *
 * Handles SIGINT (Ctrl+C) and SIGTERM signals for graceful shutdown.
 *
 * AC covered (5.8):
 * - AC4: Exit code 130 on user cancellation
 */
import chalk from 'chalk';
import { ExitCode } from './exit-codes.js';
import { exit } from './exit-handler.js';

let isShuttingDown = false;

/**
 * Setup signal handlers for graceful shutdown.
 * Call this early in the CLI entry point.
 */
export function setupSignalHandlers(): void {
  // Handle Ctrl+C (SIGINT)
  process.on('SIGINT', async () => {
    if (isShuttingDown) {
      // Force exit on second Ctrl+C
      console.error(chalk.red('\nForce quitting...'));
      process.exit(ExitCode.SIGINT);
    }

    isShuttingDown = true;
    console.log(chalk.yellow('\nReceived interrupt signal. Cleaning up...'));

    await exit(ExitCode.SIGINT);
  });

  // Handle termination signal (SIGTERM)
  process.on('SIGTERM', async () => {
    isShuttingDown = true;
    console.log(chalk.yellow('\nReceived termination signal. Cleaning up...'));
    await exit(ExitCode.SIGTERM);
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', async (error) => {
    console.error(chalk.red('Fatal error:'), error.message);
    await exit(ExitCode.ERROR);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', async (reason) => {
    console.error(chalk.red('Unhandled rejection:'), reason);
    await exit(ExitCode.ERROR);
  });
}

/**
 * Check if shutdown is in progress.
 * Commands can use this to abort long-running operations.
 */
export function isInterrupted(): boolean {
  return isShuttingDown;
}

/**
 * Reset signal state (for testing).
 */
export function resetSignalState(): void {
  isShuttingDown = false;
}
