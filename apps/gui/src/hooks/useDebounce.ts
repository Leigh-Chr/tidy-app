/**
 * Debounce Hook
 *
 * Provides debounced callbacks for performance optimization.
 */

import { useEffect, useRef, useCallback } from "react";

/**
 * Returns a debounced callback function that delays execution
 * until after the specified delay has passed since the last call.
 *
 * @param callback - The callback function to debounce
 * @param delay - Delay in milliseconds (default: 150ms)
 * @returns A debounced version of the callback
 */
// Using Parameters<F> as a self-referential constraint allows proper type inference
// while maintaining type safety (better than any[])
export function useDebouncedCallback<F extends (...args: Parameters<F>) => void>(
  callback: F,
  delay: number = 150
): F {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  const debouncedCallback = useCallback(
    (...args: Parameters<F>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delay);
    },
    [delay]
  ) as F;

  return debouncedCallback;
}
