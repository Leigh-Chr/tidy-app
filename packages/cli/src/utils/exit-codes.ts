/**
 * @fileoverview Exit code constants for CLI - Story 5.8
 *
 * Standard exit codes for tidy-app CLI.
 * Following Unix conventions and adding domain-specific codes.
 *
 * Reference: https://tldp.org/LDP/abs/html/exitcodes.html
 *
 * AC covered (5.8):
 * - AC1: Exit code 0 on success
 * - AC2: Exit code 1 on error
 * - AC3: Exit code 2 on warning
 * - AC4: Exit code 130 on user cancellation
 */

/**
 * Exit codes for the CLI application.
 */
export const ExitCode = {
  /** Operation completed successfully */
  SUCCESS: 0,

  /** General error (invalid input, operation failed) */
  ERROR: 1,

  /** Operation succeeded with warnings (partial success, skipped files) */
  WARNING: 2,

  /** Command not found or invalid usage */
  USAGE_ERROR: 64,

  /** Data format error (invalid config, corrupted file) */
  DATA_ERROR: 65,

  /** Cannot open input (file not found) */
  NO_INPUT: 66,

  /** Permission denied */
  NO_PERMISSION: 77,

  /** Configuration error */
  CONFIG_ERROR: 78,

  /** User cancelled operation (Ctrl+C / SIGINT) */
  SIGINT: 130,

  /** Terminated (SIGTERM) */
  SIGTERM: 143,
} as const;

/**
 * Type for exit code values.
 */
export type ExitCodeValue = (typeof ExitCode)[keyof typeof ExitCode];

/**
 * Exit code descriptions for documentation and help text.
 */
const exitCodeDescriptions: Record<ExitCodeValue, string> = {
  [ExitCode.SUCCESS]: 'Success',
  [ExitCode.ERROR]: 'General error',
  [ExitCode.WARNING]: 'Completed with warnings',
  [ExitCode.USAGE_ERROR]: 'Invalid command usage',
  [ExitCode.DATA_ERROR]: 'Data format error',
  [ExitCode.NO_INPUT]: 'Input not found',
  [ExitCode.NO_PERMISSION]: 'Permission denied',
  [ExitCode.CONFIG_ERROR]: 'Configuration error',
  [ExitCode.SIGINT]: 'Interrupted by user',
  [ExitCode.SIGTERM]: 'Terminated',
};

/**
 * Returns a human-readable description for an exit code.
 *
 * @param code - The exit code value
 * @returns Description string or "Unknown" for unrecognized codes
 */
export function getExitCodeDescription(code: ExitCodeValue): string {
  return exitCodeDescriptions[code] || 'Unknown';
}
