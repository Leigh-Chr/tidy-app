/**
 * @fileoverview Path resolution utilities - Story 5.6
 *
 * Provides cross-platform path handling:
 * - Tilde expansion (~)
 * - Relative path resolution
 * - Path normalization
 * - Folder validation
 */
import { resolve, normalize, isAbsolute } from 'node:path';
import { homedir } from 'node:os';
import { access, stat } from 'node:fs/promises';
import { constants } from 'node:fs';
import type { Result } from '@tidy/core';

/**
 * Resolves a user-provided path to an absolute path.
 *
 * Handles:
 * - Tilde expansion (~)
 * - Relative path resolution
 * - Path normalization (removes .., ., multiple slashes)
 *
 * @param inputPath - User-provided path (may contain ~ or be relative)
 * @param cwd - Current working directory for relative resolution (defaults to process.cwd())
 * @returns Absolute, normalized path
 */
export function resolvePath(inputPath: string, cwd?: string): string {
  let resolved = inputPath;

  // Handle tilde expansion
  if (resolved.startsWith('~')) {
    resolved = resolved.replace(/^~/, homedir());
  }

  // Resolve relative to cwd (or process.cwd if not provided)
  if (!isAbsolute(resolved)) {
    resolved = resolve(cwd || process.cwd(), resolved);
  }

  // Normalize the path (handles .., ., multiple slashes)
  return normalize(resolved);
}

/**
 * Validates that a path exists and is a directory.
 *
 * @param folderPath - Absolute path to validate
 * @returns Result with path if valid, or error with specific message
 */
export async function validateFolder(
  folderPath: string
): Promise<Result<string>> {
  try {
    // Check if path exists and is accessible
    await access(folderPath, constants.R_OK);

    // Check if it's a directory
    const stats = await stat(folderPath);
    if (!stats.isDirectory()) {
      return {
        ok: false,
        error: new Error(`Not a directory: ${folderPath}`),
      };
    }

    return { ok: true, data: folderPath };
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;

    if (nodeError.code === 'ENOENT') {
      return {
        ok: false,
        error: new Error(`Path does not exist: ${folderPath}`),
      };
    }

    if (nodeError.code === 'EACCES') {
      return {
        ok: false,
        error: new Error(`Permission denied: ${folderPath}`),
      };
    }

    return {
      ok: false,
      error: new Error(`Cannot access path: ${folderPath}`),
    };
  }
}

/**
 * Gets the folder to scan, with resolution and validation.
 *
 * Uses current directory if no folder specified.
 *
 * @param inputFolder - User-provided folder path (optional)
 * @returns Result with resolved path and isDefault flag
 */
export async function getFolderToScan(
  inputFolder?: string
): Promise<Result<{ path: string; isDefault: boolean }>> {
  const isDefault = !inputFolder || inputFolder === '.';
  const cwd = process.cwd();

  // Resolve the path
  const resolved = inputFolder ? resolvePath(inputFolder, cwd) : cwd;

  // Validate the folder
  const validation = await validateFolder(resolved);
  if (!validation.ok) {
    return validation as Result<never>;
  }

  return {
    ok: true,
    data: { path: resolved, isDefault },
  };
}
