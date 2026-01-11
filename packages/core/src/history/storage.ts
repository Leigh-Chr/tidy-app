/**
 * @fileoverview History storage for operation history - Story 9.1
 *
 * Provides functions to load and save operation history to disk.
 * History is stored in the standard config location (~/.config/tidy-app/history.json).
 *
 * @module history/storage
 */

import { readFile, writeFile, mkdir, rename, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import envPaths from 'env-paths';
import { ok, err, type Result } from '../types/result.js';
import {
  historyStoreSchema,
  createEmptyHistoryStore,
  type HistoryStore,
} from '../types/operation-history.js';

// =============================================================================
// Constants
// =============================================================================

/**
 * Filename for the history storage file.
 */
export const HISTORY_FILENAME = 'history.json';

/**
 * Get OS-appropriate paths for tidy-app.
 */
const paths = envPaths('tidy-app', { suffix: '' });

// =============================================================================
// Path Resolution
// =============================================================================

/**
 * Get the full path to the history file.
 *
 * Returns the OS-appropriate history file path:
 * - macOS: ~/Library/Application Support/tidy-app/history.json
 * - Windows: %APPDATA%/tidy-app/history.json
 * - Linux: ~/.config/tidy-app/history.json
 *
 * @returns Absolute path to history file
 */
export function getHistoryPath(): string {
  return join(paths.config, HISTORY_FILENAME);
}

// =============================================================================
// Storage Functions
// =============================================================================

/**
 * Load history from disk.
 *
 * Behavior:
 * - Returns empty history if file doesn't exist
 * - Validates loaded JSON against schema
 * - Backs up and resets corrupted files
 *
 * @returns History store or error
 *
 * @example
 * ```typescript
 * const result = await loadHistory();
 * if (result.ok) {
 *   console.log(`Loaded ${result.data.entries.length} history entries`);
 * }
 * ```
 */
export async function loadHistory(): Promise<Result<HistoryStore, Error>> {
  const historyPath = getHistoryPath();

  try {
    const content = await readFile(historyPath, { encoding: 'utf-8' });

    // Parse JSON
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      // Corrupted JSON - backup and reset
      await backupCorruptedFile(historyPath);
      return ok(createEmptyHistoryStore());
    }

    // Validate against schema
    const parseResult = historyStoreSchema.safeParse(parsed);
    if (!parseResult.success) {
      // Invalid schema - backup and reset
      await backupCorruptedFile(historyPath);
      return ok(createEmptyHistoryStore());
    }

    return ok(parseResult.data);
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;

    // File doesn't exist - return empty history
    if (nodeError.code === 'ENOENT') {
      return ok(createEmptyHistoryStore());
    }

    // Other errors (permission denied, I/O error, etc.)
    return err(error as Error);
  }
}

/**
 * Save history to disk.
 *
 * Creates the config directory if it doesn't exist.
 * Formats JSON with 2-space indentation for readability.
 *
 * @param store - History store to save
 * @returns Success or error
 *
 * @example
 * ```typescript
 * const result = await saveHistory(store);
 * if (!result.ok) {
 *   console.error('Failed to save history:', result.error.message);
 * }
 * ```
 */
export async function saveHistory(store: HistoryStore): Promise<Result<void, Error>> {
  const historyPath = getHistoryPath();
  const configDir = dirname(historyPath);

  try {
    // Ensure config directory exists
    await mkdir(configDir, { recursive: true });

    // Format JSON with indentation for readability
    const content = JSON.stringify(store, null, 2);

    // Write file
    await writeFile(historyPath, content, { encoding: 'utf-8' });

    return ok(undefined);
  } catch (error) {
    return err(error as Error);
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Backup a corrupted history file before resetting.
 * Creates a backup with timestamp suffix.
 *
 * @param filePath - Path to the corrupted file
 */
async function backupCorruptedFile(filePath: string): Promise<void> {
  try {
    // Check if file exists
    await access(filePath);

    // Create backup with timestamp
    const timestamp = Date.now();
    const backupPath = `${filePath}.backup.${timestamp}`;
    await rename(filePath, backupPath);
  } catch {
    // File doesn't exist or backup failed - ignore
  }
}
