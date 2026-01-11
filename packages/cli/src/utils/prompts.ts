/**
 * @fileoverview Interactive prompt utilities - Story 5.4
 *
 * Provides reusable confirmation prompts with:
 * - Non-TTY detection (fails gracefully in CI/scripts)
 * - Ctrl+C handling (clean cancellation)
 * - Configurable defaults
 */
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

export interface ConfirmOptions {
  /** Default value if user presses Enter (default: false) */
  defaultValue?: boolean;
  /** Message shown before the prompt (optional) */
  preMessage?: string;
}

export interface ConfirmResult {
  /** Whether user confirmed */
  confirmed: boolean;
  /** Whether operation was cancelled (Ctrl+C or non-TTY without force) */
  cancelled: boolean;
  /** Reason for cancellation if cancelled */
  reason?: 'user-declined' | 'ctrl-c' | 'non-interactive';
}

/**
 * Check if running in interactive mode.
 * Respects TIDY_FORCE_INTERACTIVE env var for testing.
 */
function isInteractive(): boolean {
  if (process.env.TIDY_FORCE_INTERACTIVE === '1') {
    return true;
  }
  return stdin.isTTY === true;
}

/**
 * Prompts user for confirmation with y/n.
 *
 * Handles:
 * - Non-TTY mode: Returns cancelled with reason 'non-interactive'
 * - Ctrl+C: Returns cancelled with reason 'ctrl-c'
 * - Empty input: Uses defaultValue
 *
 * Set TIDY_FORCE_INTERACTIVE=1 to bypass TTY check (for testing).
 *
 * @example
 * ```typescript
 * const result = await confirm('Delete all files?');
 * if (result.cancelled) {
 *   console.log('Operation cancelled');
 *   process.exit(1);
 * }
 * if (result.confirmed) {
 *   // proceed
 * }
 * ```
 */
export async function confirm(
  message: string,
  options: ConfirmOptions = {}
): Promise<ConfirmResult> {
  const { defaultValue = false, preMessage } = options;

  // Check for non-interactive mode
  if (!isInteractive()) {
    return {
      confirmed: false,
      cancelled: true,
      reason: 'non-interactive',
    };
  }

  const rl = createInterface({ input: stdin, output: stdout });

  // Handle Ctrl+C
  let ctrlCPressed = false;
  const sigintHandler = () => {
    ctrlCPressed = true;
    rl.close();
  };
  process.once('SIGINT', sigintHandler);

  try {
    if (preMessage) {
      console.log(preMessage);
    }

    const suffix = defaultValue ? '(Y/n)' : '(y/N)';
    const answer = await rl.question(`${message} ${suffix}: `);

    // Check if Ctrl+C was pressed during question
    if (ctrlCPressed) {
      return {
        confirmed: false,
        cancelled: true,
        reason: 'ctrl-c',
      };
    }

    // Empty answer = use default
    if (answer.trim() === '') {
      return {
        confirmed: defaultValue,
        cancelled: !defaultValue,
        reason: defaultValue ? undefined : 'user-declined',
      };
    }

    const isYes =
      answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';

    return {
      confirmed: isYes,
      cancelled: !isYes,
      reason: isYes ? undefined : 'user-declined',
    };
  } catch {
    // readline can throw on close during input
    if (ctrlCPressed) {
      return {
        confirmed: false,
        cancelled: true,
        reason: 'ctrl-c',
      };
    }
    throw new Error('Unexpected error during prompt');
  } finally {
    process.removeListener('SIGINT', sigintHandler);
    rl.close();
  }
}

/**
 * Simple text prompt.
 *
 * @param message - The prompt message
 * @returns The user's input, or null if cancelled/non-TTY
 */
export async function prompt(message: string): Promise<string | null> {
  if (!stdin.isTTY) {
    return null;
  }

  const rl = createInterface({ input: stdin, output: stdout });

  let ctrlCPressed = false;
  const sigintHandler = () => {
    ctrlCPressed = true;
    rl.close();
  };
  process.once('SIGINT', sigintHandler);

  try {
    const answer = await rl.question(message);
    if (ctrlCPressed) {
      return null;
    }
    return answer;
  } catch {
    return null;
  } finally {
    process.removeListener('SIGINT', sigintHandler);
    rl.close();
  }
}
