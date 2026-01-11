/**
 * Result type for operations that can fail.
 * Use this instead of throwing exceptions.
 */
export type Result<T, E = Error> =
  | { ok: true; data: T }
  | { ok: false; error: E };

/**
 * Create a successful result.
 */
export function ok<T>(data: T): Result<T, never> {
  return { ok: true, data };
}

/**
 * Create an error result.
 */
export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}
