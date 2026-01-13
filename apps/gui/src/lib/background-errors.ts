/**
 * Background Error Handler (P2-003)
 *
 * Provides consistent error handling for background operations that shouldn't
 * block the UI but need to be tracked and optionally reported to the user.
 *
 * @module lib/background-errors
 */

import { toast } from "sonner";

/**
 * Severity levels for background errors.
 * Determines how the error is logged and whether the user is notified.
 */
export type ErrorSeverity = "debug" | "info" | "warn" | "error";

/**
 * Options for handling a background error.
 */
export interface BackgroundErrorOptions {
  /** The operation that failed (e.g., "load config", "record history") */
  operation: string;
  /** Severity level - determines logging and UI notification */
  severity?: ErrorSeverity;
  /** Whether to show a toast notification to the user */
  showToast?: boolean;
  /** Custom toast message (defaults to operation + error message) */
  toastMessage?: string;
  /** Toast duration in milliseconds */
  toastDuration?: number;
  /** Additional context for logging */
  context?: Record<string, unknown>;
}

/**
 * Default options for background error handling.
 */
const DEFAULT_OPTIONS: Required<Omit<BackgroundErrorOptions, "operation" | "toastMessage" | "context">> = {
  severity: "warn",
  showToast: false,
  toastDuration: 5000,
};

/**
 * Handles a background error consistently across the application.
 *
 * Use this for operations that:
 * - Run in the background (not blocking the UI)
 * - May fail without critically impacting the user experience
 * - Need consistent logging and optional user notification
 *
 * @param error - The error that occurred
 * @param options - Configuration for how to handle the error
 *
 * @example
 * ```typescript
 * // Silent logging only (default)
 * recordOperation(result).catch((err) => {
 *   handleBackgroundError(err, { operation: "record operation to history" });
 * });
 *
 * // With toast notification
 * loadVersion().catch((err) => {
 *   handleBackgroundError(err, {
 *     operation: "load version",
 *     showToast: true,
 *     severity: "error",
 *   });
 * });
 *
 * // With custom message
 * persistPreferences(prefs).catch((err) => {
 *   handleBackgroundError(err, {
 *     operation: "save preferences",
 *     showToast: true,
 *     toastMessage: "Your preferences may not have been saved",
 *   });
 * });
 * ```
 */
export function handleBackgroundError(
  error: unknown,
  options: BackgroundErrorOptions
): void {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const errorMessage = error instanceof Error ? error.message : String(error);

  // Log to console with appropriate level
  const logMessage = `Background operation failed: ${opts.operation}`;
  const logData = opts.context
    ? { error: errorMessage, ...opts.context }
    : errorMessage;

  switch (opts.severity) {
    case "debug":
      console.debug(logMessage, logData);
      break;
    case "info":
      console.info(logMessage, logData);
      break;
    case "warn":
      console.warn(logMessage, logData);
      break;
    case "error":
      console.error(logMessage, logData);
      break;
  }

  // Show toast if requested
  if (opts.showToast) {
    const toastMessage = opts.toastMessage ?? `Failed to ${opts.operation}`;

    switch (opts.severity) {
      case "error":
        toast.error(toastMessage, { duration: opts.toastDuration });
        break;
      case "warn":
        toast.warning(toastMessage, { duration: opts.toastDuration });
        break;
      default:
        toast.info(toastMessage, { duration: opts.toastDuration });
    }
  }
}
