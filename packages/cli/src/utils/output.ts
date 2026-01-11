/**
 * @fileoverview Output and TTY utilities - Story 5.7
 *
 * Provides utilities for controlling CLI output based on environment:
 * - TTY detection for color control
 * - NO_COLOR standard support (https://no-color.org/)
 * - Chalk configuration
 *
 * AC covered (5.7):
 * - AC5: Output is pipeable
 * - AC6: Colors disabled when not TTY
 */
import chalk from 'chalk';

/**
 * Options for color detection.
 */
export interface ColorOptions {
  /** Explicit --no-color flag from CLI */
  noColor?: boolean;
}

/**
 * Determines if colors should be used in output.
 *
 * Colors are disabled when:
 * - stdout is not a TTY (piping)
 * - --no-color flag is set
 * - NO_COLOR environment variable is set (https://no-color.org/)
 * - TERM=dumb
 *
 * @param options - Color options from CLI flags
 * @returns Whether colors should be used
 */
export function shouldUseColor(options: ColorOptions = {}): boolean {
  // Respect --no-color flag
  if (options.noColor) {
    return false;
  }

  // Respect NO_COLOR environment variable (https://no-color.org/)
  if (process.env.NO_COLOR !== undefined) {
    return false;
  }

  // Respect TERM=dumb
  if (process.env.TERM === 'dumb') {
    return false;
  }

  // Disable colors when piping (stdout not a TTY)
  if (!process.stdout.isTTY) {
    return false;
  }

  return true;
}

/**
 * Configures chalk based on color preference.
 *
 * @param useColor - Whether to enable colors
 */
export function configureColors(useColor: boolean): void {
  chalk.level = useColor ? 3 : 0;
}
