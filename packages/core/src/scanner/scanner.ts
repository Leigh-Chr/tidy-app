import { readdir, stat } from 'node:fs/promises';
import { join, parse, relative } from 'node:path';
import type { Result } from '../types/result.js';
import { ok, err } from '../types/result.js';
import type { FileInfo } from '../types/file-info.js';
import { getCategoryForExtension } from '../types/file-category.js';
import {
  getMetadataCapability,
  isMetadataSupportedByRegistry,
} from '../types/file-type-registry.js';

/**
 * Options for folder scanning.
 */
export interface ScanOptions {
  /** Scan subdirectories recursively (default: false) */
  recursive?: boolean;
  /** Filter by file extensions (without dot, e.g., ['jpg', 'png']) */
  extensions?: string[];
  /** Progress callback (current files found, total unknown = -1) */
  onProgress?: (current: number, total: number) => void;
  /** AbortSignal for cancellation support */
  signal?: AbortSignal;
}

interface InternalScanOptions extends ScanOptions {
  basePath: string;
}

/**
 * Normalize file system errors to descriptive messages.
 */
function normalizeError(error: NodeJS.ErrnoException): Error {
  switch (error.code) {
    case 'ENOENT':
      return new Error(`Path does not exist: ${error.path ?? 'unknown'}`);
    case 'EACCES':
      return new Error(`Permission denied: ${error.path ?? 'unknown'}`);
    case 'ENOTDIR':
      return new Error(`Not a directory: ${error.path ?? 'unknown'}`);
    default:
      return new Error(`Failed to scan: ${error.message}`);
  }
}

/**
 * Internal recursive directory scanner.
 */
async function scanDirectory(
  currentPath: string,
  files: FileInfo[],
  options: InternalScanOptions
): Promise<void> {
  // Check for cancellation
  if (options.signal?.aborted) {
    throw new Error('Scan cancelled');
  }

  const entries = await readdir(currentPath, { withFileTypes: true });

  for (const entry of entries) {
    // Check for cancellation during iteration
    if (options.signal?.aborted) {
      throw new Error('Scan cancelled');
    }

    const fullPath = join(currentPath, entry.name);

    if (entry.isFile()) {
      const parsed = parse(entry.name);
      const ext = parsed.ext.startsWith('.') ? parsed.ext.slice(1) : parsed.ext;

      // Filter by extension if specified
      if (options.extensions && options.extensions.length > 0) {
        if (!options.extensions.includes(ext.toLowerCase())) {
          continue;
        }
      }

      const stats = await stat(fullPath);
      const fileInfo: FileInfo = {
        path: fullPath,
        name: parsed.name,
        extension: ext,
        fullName: entry.name,
        size: stats.size,
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime,
        relativePath: relative(options.basePath, fullPath),
        category: getCategoryForExtension(ext),
        metadataSupported: isMetadataSupportedByRegistry(ext),
        metadataCapability: getMetadataCapability(ext),
      };

      files.push(fileInfo);
      options.onProgress?.(files.length, -1);
    } else if (entry.isDirectory() && options.recursive) {
      // Don't follow symlinks to avoid potential loops
      if (!entry.isSymbolicLink()) {
        await scanDirectory(fullPath, files, options);
      }
    }
  }
}

/**
 * Scan a folder and return information about all files within it.
 *
 * @param folderPath - Path to the folder to scan
 * @param options - Scan options (recursive, extensions filter, progress callback)
 * @returns Result containing array of FileInfo or an error
 *
 * @example
 * ```typescript
 * const result = await scanFolder('/path/to/folder');
 * if (result.ok) {
 *   console.log(`Found ${result.data.length} files`);
 * } else {
 *   console.error(result.error.message);
 * }
 * ```
 */
export async function scanFolder(
  folderPath: string,
  options: ScanOptions = {}
): Promise<Result<FileInfo[]>> {
  const { recursive = false, extensions, onProgress, signal } = options;

  try {
    const files: FileInfo[] = [];
    await scanDirectory(folderPath, files, {
      recursive,
      extensions,
      onProgress,
      signal,
      basePath: folderPath,
    });
    return ok(files);
  } catch (error) {
    if (error instanceof Error && error.message === 'Scan cancelled') {
      return err(error);
    }
    return err(normalizeError(error as NodeJS.ErrnoException));
  }
}
