/**
 * @fileoverview Directory creation utility - Story 8.4
 *
 * Provides functions to ensure directories exist and find existing ancestor
 * directories for permission checking.
 *
 * @module rename/ensure-directory
 */

import { mkdir, stat, access } from 'node:fs/promises';
import { dirname } from 'node:path';
import { ok, err, type Result } from '../types/result.js';
import { constants } from 'node:fs';

// =============================================================================
// Types
// =============================================================================

/**
 * Result of directory creation operation.
 * - `true`: Directory was created
 * - `false`: Directory already existed
 */
export type DirectoryCreated = boolean;

// =============================================================================
// Main Functions
// =============================================================================

/**
 * Ensure a directory exists, creating it (and all parent directories) if necessary.
 *
 * Uses `mkdir` with `recursive: true` for atomic, idempotent directory creation.
 * Handles race conditions gracefully - concurrent calls to create the same
 * directory will all succeed.
 *
 * @param path - Path to the directory to ensure exists
 * @returns Result with `true` if directory was created, `false` if it already existed
 *
 * @example
 * ```typescript
 * const result = await ensureDirectory('/base/2026/01/photos');
 * if (result.ok) {
 *   if (result.data) {
 *     console.log('Directory created');
 *   } else {
 *     console.log('Directory already existed');
 *   }
 * } else {
 *   console.error('Failed to create directory:', result.error.message);
 * }
 * ```
 */
export async function ensureDirectory(
  path: string
): Promise<Result<DirectoryCreated, Error>> {
  try {
    // Check if directory already exists BEFORE mkdir
    // (mkdir recursive: true doesn't throw EEXIST, it succeeds silently)
    let existedBefore = false;
    try {
      await access(path, constants.F_OK);
      existedBefore = true;
    } catch {
      // Directory doesn't exist - this is expected
    }

    await mkdir(path, { recursive: true });

    // Return true if we created it, false if it already existed
    return ok(!existedBefore);
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;

    // EEXIST can still occur in race conditions where directory is created
    // between our access check and mkdir call - treat as success
    if (nodeError.code === 'EEXIST') {
      return ok(false);
    }

    // All other errors are actual failures
    return err(error as Error);
  }
}

/**
 * Find the nearest existing ancestor directory for a given path.
 *
 * Traverses up the directory tree until it finds an existing directory.
 * This is useful for permission checking - to create `/a/b/c/d`, we need
 * write permission on the nearest existing ancestor (e.g., `/a` if `b`, `c`, `d`
 * don't exist yet).
 *
 * @param path - Path to start searching from
 * @returns Result with the path of the nearest existing ancestor directory
 *
 * @example
 * ```typescript
 * // If /base exists but /base/2026/01 doesn't:
 * const result = await findExistingAncestor('/base/2026/01/photos');
 * // result.data === '/base'
 * ```
 */
export async function findExistingAncestor(
  path: string
): Promise<Result<string, Error>> {
  let current = path;

  while (true) {
    try {
      const stats = await stat(current);

      // Found an existing path - verify it's a directory
      if (stats.isDirectory()) {
        return ok(current);
      }

      // Path exists but is not a directory (e.g., it's a file)
      // Continue to parent
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;

      // ENOENT means path doesn't exist - continue to parent
      if (nodeError.code === 'ENOENT') {
        // Continue to parent directory
      } else {
        // Other errors (EACCES, EPERM, etc.) are actual failures
        return err(error as Error);
      }
    }

    // Move to parent directory
    const parent = dirname(current);

    // Reached root - stop
    if (parent === current) {
      // Return the root as the existing ancestor
      return ok(current);
    }

    current = parent;
  }
}
