/**
 * @fileoverview Exit handler utilities - Story 5.8
 *
 * Provides utilities for handling CLI exits:
 * - Cleanup handlers before exit
 * - Warning collection and tracking
 * - Consistent exit code usage
 *
 * AC covered (5.8):
 * - AC1: Exit code 0 on success
 * - AC2: Exit code 1 on error
 * - AC3: Exit code 2 on warning
 */
import chalk from 'chalk';
import { ExitCode, type ExitCodeValue } from './exit-codes.js';

/**
 * Context for exit handling.
 */
interface ExitContext {
  cleanupHandlers: Array<() => void | Promise<void>>;
  hasExited: boolean;
}

const context: ExitContext = {
  cleanupHandlers: [],
  hasExited: false,
};

/**
 * Register a cleanup function to run before exit.
 *
 * @param handler - Function to run before exit
 */
export function onExit(handler: () => void | Promise<void>): void {
  context.cleanupHandlers.push(handler);
}

/**
 * Remove a previously registered cleanup handler.
 *
 * @param handler - Handler to remove
 */
export function offExit(handler: () => void | Promise<void>): void {
  const index = context.cleanupHandlers.indexOf(handler);
  if (index !== -1) {
    context.cleanupHandlers.splice(index, 1);
  }
}

/**
 * Perform cleanup and exit with the specified code.
 *
 * @param code - Exit code value
 */
export async function exit(code: ExitCodeValue): Promise<never> {
  if (context.hasExited) {
    process.exit(code);
  }

  context.hasExited = true;

  // Run cleanup handlers in reverse order (LIFO)
  for (const handler of [...context.cleanupHandlers].reverse()) {
    try {
      await handler();
    } catch {
      console.error(chalk.yellow('Warning: Cleanup handler failed'));
    }
  }

  process.exit(code);
}

/**
 * Exit with success (code 0).
 */
export async function exitSuccess(): Promise<never> {
  return exit(ExitCode.SUCCESS);
}

/**
 * Exit with error (code 1) and display error message.
 *
 * @param message - Error message to display
 * @param details - Optional additional details
 */
export async function exitError(
  message: string,
  details?: string
): Promise<never> {
  console.error(chalk.red(`Error: ${message}`));
  if (details) {
    console.error(chalk.gray(details));
  }
  return exit(ExitCode.ERROR);
}

/**
 * Exit with warning (code 2) and display warning message.
 *
 * @param message - Warning message to display
 */
export async function exitWarning(message: string): Promise<never> {
  console.warn(chalk.yellow(`Warning: ${message}`));
  return exit(ExitCode.WARNING);
}

/**
 * Report a warning without exiting.
 *
 * @param message - Warning message to display
 */
export function reportWarning(message: string): void {
  console.warn(chalk.yellow(`Warning: ${message}`));
}

/**
 * Tracks warnings during command execution.
 * Provides appropriate exit code based on collected warnings.
 */
export class WarningCollector {
  private warnings: string[] = [];

  /**
   * Add a warning and display it.
   *
   * @param message - Warning message
   */
  add(message: string): void {
    this.warnings.push(message);
    reportWarning(message);
  }

  /**
   * Check if any warnings have been collected.
   */
  hasWarnings(): boolean {
    return this.warnings.length > 0;
  }

  /**
   * Get a copy of all collected warnings.
   */
  getWarnings(): string[] {
    return [...this.warnings];
  }

  /**
   * Get the appropriate exit code based on warnings.
   * Returns WARNING (2) if warnings exist, SUCCESS (0) otherwise.
   */
  getExitCode(): ExitCodeValue {
    return this.hasWarnings() ? ExitCode.WARNING : ExitCode.SUCCESS;
  }
}

/**
 * Reset the exit context (for testing).
 */
export function resetExitContext(): void {
  context.cleanupHandlers = [];
  context.hasExited = false;
}
