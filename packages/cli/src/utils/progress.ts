/**
 * @fileoverview Progress reporting utilities for CLI operations
 *
 * Provides simple progress indicators for long-running operations
 * without external dependencies.
 */

/**
 * Progress reporter for multi-phase operations.
 */
export interface ProgressReporter {
  /** Update progress display */
  update(phase: string, current: number, total: number): void;
  /** Clear progress display */
  clear(): void;
  /** Mark operation as complete */
  complete(message?: string): void;
}

/**
 * Phase display names for user-friendly output.
 */
const PHASE_NAMES: Record<string, string> = {
  scanning: 'Scanning files',
  extracting: 'Extracting metadata',
  applying: 'Applying templates',
  analyzing: 'Analyzing with AI',
  renaming: 'Renaming files',
  validating: 'Validating',
};

/**
 * Create a simple progress reporter that writes to stderr.
 * Uses carriage return to update in place on TTY.
 */
export function createProgressReporter(): ProgressReporter {
  const isTTY = process.stderr.isTTY;
  let lastLine = '';

  return {
    update(phase: string, current: number, total: number): void {
      const phaseName = PHASE_NAMES[phase] || phase;
      const percent = total > 0 ? Math.round((current / total) * 100) : 0;
      const progressBar = createProgressBar(percent, 20);

      let line: string;
      if (total > 0) {
        line = `${phaseName}: ${progressBar} ${current}/${total} (${percent}%)`;
      } else {
        line = `${phaseName}: ${current} files...`;
      }

      if (isTTY) {
        // Clear previous line and write new one
        process.stderr.write(`\r${' '.repeat(lastLine.length)}\r${line}`);
      }
      lastLine = line;
    },

    clear(): void {
      if (isTTY && lastLine) {
        process.stderr.write(`\r${' '.repeat(lastLine.length)}\r`);
        lastLine = '';
      }
    },

    complete(message?: string): void {
      this.clear();
      if (message) {
        process.stderr.write(`${message}\n`);
      }
    },
  };
}

/**
 * Create a simple ASCII progress bar.
 */
function createProgressBar(percent: number, width: number): string {
  const filled = Math.round((percent / 100) * width);
  const empty = width - filled;
  return `[${'='.repeat(filled)}${' '.repeat(empty)}]`;
}

/**
 * Simple spinner for indeterminate progress.
 */
export interface Spinner {
  /** Start the spinner */
  start(message: string): void;
  /** Update the spinner message */
  update(message: string): void;
  /** Stop the spinner with success */
  succeed(message: string): void;
  /** Stop the spinner with failure */
  fail(message: string): void;
  /** Stop the spinner */
  stop(): void;
}

const SPINNER_FRAMES = ['\u280B', '\u2819', '\u2839', '\u2838', '\u283C', '\u2834', '\u2826', '\u2827', '\u2807', '\u280F'];

/**
 * Create a simple CLI spinner.
 */
export function createSpinner(): Spinner {
  const isTTY = process.stderr.isTTY;
  let interval: ReturnType<typeof setInterval> | null = null;
  let frameIndex = 0;
  let currentMessage = '';

  const render = () => {
    if (!isTTY) return;
    const frame = SPINNER_FRAMES[frameIndex % SPINNER_FRAMES.length];
    process.stderr.write(`\r${frame} ${currentMessage}`);
    frameIndex++;
  };

  const clear = () => {
    if (!isTTY) return;
    process.stderr.write(`\r${' '.repeat(currentMessage.length + 2)}\r`);
  };

  return {
    start(message: string): void {
      currentMessage = message;
      if (isTTY) {
        interval = setInterval(render, 80);
        render();
      } else {
        process.stderr.write(`${message}...\n`);
      }
    },

    update(message: string): void {
      clear();
      currentMessage = message;
      if (!isTTY) {
        process.stderr.write(`${message}...\n`);
      }
    },

    succeed(message: string): void {
      this.stop();
      const icon = isTTY ? '\u2713' : '[OK]';
      process.stderr.write(`${icon} ${message}\n`);
    },

    fail(message: string): void {
      this.stop();
      const icon = isTTY ? '\u2717' : '[FAIL]';
      process.stderr.write(`${icon} ${message}\n`);
    },

    stop(): void {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
      clear();
    },
  };
}
