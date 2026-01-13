/**
 * Throttle Hook (SEC-006)
 *
 * Provides throttled callbacks to prevent rapid repeated executions.
 * Unlike debounce which waits for quiet periods, throttle ensures
 * the function runs at most once per interval.
 */

import { useRef, useCallback, useEffect } from "react";

/**
 * Returns a throttled callback function that executes at most once
 * per specified interval. Useful for rate-limiting expensive operations.
 *
 * @param callback - The callback function to throttle
 * @param interval - Minimum interval between executions in milliseconds (default: 1000ms)
 * @returns A throttled version of the callback
 *
 * @example
 * ```typescript
 * const throttledScan = useThrottledCallback(
 *   () => scanFolder(path),
 *   2000 // At most once every 2 seconds
 * );
 * ```
 */
export function useThrottledCallback<T extends unknown[]>(
  callback: (...args: T) => void,
  interval: number = 1000
): (...args: T) => void {
  const lastExecutionRef = useRef<number>(0);
  const callbackRef = useRef(callback);

  // Update callback ref on each render
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const throttledCallback = useCallback(
    (...args: T) => {
      const now = Date.now();
      const timeSinceLastExecution = now - lastExecutionRef.current;

      if (timeSinceLastExecution >= interval) {
        lastExecutionRef.current = now;
        callbackRef.current(...args);
      }
    },
    [interval]
  );

  return throttledCallback;
}

/**
 * Returns a throttled callback that queues the last call if throttled.
 * This ensures the final call is always executed after the interval.
 *
 * @param callback - The callback function to throttle
 * @param interval - Minimum interval between executions in milliseconds (default: 1000ms)
 * @returns A throttled version of the callback with trailing execution
 *
 * @example
 * ```typescript
 * const throttledUpdate = useThrottledCallbackWithTrailing(
 *   (value) => updateConfig(value),
 *   500
 * );
 * // Rapid calls will execute first immediately, then last after interval
 * ```
 */
export function useThrottledCallbackWithTrailing<T extends unknown[]>(
  callback: (...args: T) => void,
  interval: number = 1000
): (...args: T) => void {
  const lastExecutionRef = useRef<number>(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingArgsRef = useRef<T | null>(null);
  const callbackRef = useRef(callback);

  // Update callback ref on each render
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const throttledCallback = useCallback(
    (...args: T) => {
      const now = Date.now();
      const timeSinceLastExecution = now - lastExecutionRef.current;

      if (timeSinceLastExecution >= interval) {
        // Execute immediately
        lastExecutionRef.current = now;
        callbackRef.current(...args);
        pendingArgsRef.current = null;

        // Clear any pending trailing call
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
      } else {
        // Queue for trailing execution
        pendingArgsRef.current = args;

        if (!timeoutRef.current) {
          const remainingTime = interval - timeSinceLastExecution;
          timeoutRef.current = setTimeout(() => {
            if (pendingArgsRef.current) {
              lastExecutionRef.current = Date.now();
              callbackRef.current(...pendingArgsRef.current);
              pendingArgsRef.current = null;
            }
            timeoutRef.current = null;
          }, remainingTime);
        }
      }
    },
    [interval]
  );

  return throttledCallback;
}

/**
 * Returns a function to check if an action is throttled and mark execution.
 * Useful for rate-limiting user actions.
 *
 * @param interval - Cooldown interval in milliseconds
 * @returns Object with checkThrottled and markExecuted functions
 *
 * @example
 * ```typescript
 * const throttle = useThrottleState(2000);
 *
 * const handleClick = () => {
 *   if (throttle.isThrottled()) return;
 *   throttle.markExecuted();
 *   performAction();
 * };
 * ```
 */
export function useThrottleState(interval: number = 1000): {
  isThrottled: () => boolean;
  markExecuted: () => void;
} {
  const lastExecutionRef = useRef<number>(0);

  const isThrottled = useCallback(() => {
    return Date.now() - lastExecutionRef.current < interval;
  }, [interval]);

  const markExecuted = useCallback(() => {
    lastExecutionRef.current = Date.now();
  }, []);

  return { isThrottled, markExecuted };
}
