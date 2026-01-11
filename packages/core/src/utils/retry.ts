import type { Result } from '../types/result.js';
import { ok, err } from '../types/result.js';

/**
 * Retry configuration options.
 */
export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Initial delay in milliseconds (default: 100) */
  initialDelay?: number;
  /** Maximum delay in milliseconds (default: 5000) */
  maxDelay?: number;
  /** Exponential backoff multiplier (default: 2) */
  backoffMultiplier?: number;
  /** Function to determine if error is retryable (default: all errors are retryable) */
  shouldRetry?: (error: Error, attempt: number) => boolean;
  /** Callback when a retry occurs */
  onRetry?: (error: Error, attempt: number, delay: number) => void;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
}

/**
 * Default retry predicate - retries on transient errors.
 */
export function isTransientError(error: Error): boolean {
  const message = error.message.toLowerCase();

  // File system transient errors
  if (message.includes('ebusy') || message.includes('resource busy')) {
    return true;
  }
  if (message.includes('emfile') || message.includes('too many open files')) {
    return true;
  }
  if (message.includes('eagain') || message.includes('try again')) {
    return true;
  }
  if (message.includes('etimedout') || message.includes('timeout')) {
    return true;
  }
  if (message.includes('econnreset') || message.includes('connection reset')) {
    return true;
  }

  return false;
}

/**
 * Calculate delay with exponential backoff and optional jitter.
 */
export function calculateBackoffDelay(
  attempt: number,
  initialDelay: number,
  maxDelay: number,
  multiplier: number
): number {
  // Exponential backoff: initialDelay * (multiplier ^ attempt)
  const exponentialDelay = initialDelay * Math.pow(multiplier, attempt);

  // Add jitter (±25% variation) to prevent thundering herd
  const jitter = exponentialDelay * 0.25 * (Math.random() * 2 - 1);
  const delayWithJitter = exponentialDelay + jitter;

  // Clamp to maxDelay
  return Math.min(delayWithJitter, maxDelay);
}

/**
 * Sleep for a specified duration.
 */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('Aborted'));
      return;
    }

    let abortHandler: (() => void) | undefined;

    const timeout = setTimeout(() => {
      // Clean up abort listener on normal completion
      if (abortHandler && signal) {
        signal.removeEventListener('abort', abortHandler);
      }
      resolve();
    }, ms);

    if (signal) {
      abortHandler = (): void => {
        clearTimeout(timeout);
        reject(new Error('Aborted'));
      };
      signal.addEventListener('abort', abortHandler);
    }
  });
}

/**
 * Execute a function with automatic retries on failure.
 *
 * Uses exponential backoff with jitter to space out retries.
 * Only retries on transient errors by default.
 *
 * @param fn - Async function to execute
 * @param options - Retry configuration
 * @returns Result containing success value or final error
 *
 * @example
 * ```typescript
 * const result = await withRetry(
 *   async () => {
 *     const data = await fetchData();
 *     return data;
 *   },
 *   {
 *     maxRetries: 3,
 *     onRetry: (error, attempt, delay) => {
 *       console.log(`Retry ${attempt} after ${delay}ms: ${error.message}`);
 *     },
 *   }
 * );
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<Result<T>> {
  const {
    maxRetries = 3,
    initialDelay = 100,
    maxDelay = 5000,
    backoffMultiplier = 2,
    shouldRetry = isTransientError,
    onRetry,
    signal,
  } = options;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Check for abort before each attempt
      if (signal?.aborted) {
        return err(new Error('Aborted'));
      }

      const result = await fn();
      return ok(result);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if we should retry
      const isLastAttempt = attempt >= maxRetries;
      const canRetry = !isLastAttempt && shouldRetry(lastError, attempt);

      if (!canRetry) {
        break;
      }

      // Calculate delay with backoff
      const delay = calculateBackoffDelay(
        attempt,
        initialDelay,
        maxDelay,
        backoffMultiplier
      );

      // Call retry callback
      onRetry?.(lastError, attempt + 1, delay);

      // Wait before next attempt
      try {
        await sleep(delay, signal);
      } catch {
        // Aborted during sleep
        return err(new Error('Aborted'));
      }
    }
  }

  return err(lastError ?? new Error('Unknown error'));
}

/**
 * Execute a Result-returning function with automatic retries.
 *
 * Similar to withRetry but for functions that already return Result types.
 *
 * @param fn - Async function returning Result
 * @param options - Retry configuration
 * @returns Result containing success value or final error
 *
 * @example
 * ```typescript
 * const result = await withRetryResult(
 *   async () => extractMetadata(file),
 *   { maxRetries: 2 }
 * );
 * ```
 */
export async function withRetryResult<T, E extends Error>(
  fn: () => Promise<Result<T, E>>,
  options: RetryOptions = {}
): Promise<Result<T, E | Error>> {
  const {
    maxRetries = 3,
    initialDelay = 100,
    maxDelay = 5000,
    backoffMultiplier = 2,
    shouldRetry = isTransientError,
    onRetry,
    signal,
  } = options;

  let lastError: E | Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // Check for abort before each attempt
    if (signal?.aborted) {
      return err(new Error('Aborted'));
    }

    const result = await fn();

    if (result.ok) {
      return result;
    }

    lastError = result.error;

    // Check if we should retry
    const isLastAttempt = attempt >= maxRetries;
    const canRetry = !isLastAttempt && shouldRetry(lastError, attempt);

    if (!canRetry) {
      break;
    }

    // Calculate delay with backoff
    const delay = calculateBackoffDelay(
      attempt,
      initialDelay,
      maxDelay,
      backoffMultiplier
    );

    // Call retry callback
    onRetry?.(lastError, attempt + 1, delay);

    // Wait before next attempt
    try {
      await sleep(delay, signal);
    } catch {
      return err(new Error('Aborted'));
    }
  }

  return err(lastError ?? new Error('Unknown error'));
}
