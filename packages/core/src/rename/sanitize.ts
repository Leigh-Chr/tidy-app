/**
 * Filename sanitization module (Story 4.7)
 *
 * Ensures filenames are valid across operating systems by:
 * - Replacing invalid characters with safe alternatives
 * - Handling Windows reserved names
 * - Truncating long filenames while preserving extensions
 *
 * @module rename/sanitize
 */

import { platform } from 'node:os';

// =============================================================================
// Constants
// =============================================================================

/**
 * Characters invalid on at least one major OS.
 * These should be replaced for cross-platform compatibility.
 */
export const INVALID_CHARS_UNIVERSAL = /[/\\:*?"<>|]/g;

/**
 * Characters invalid on Windows (includes control characters).
 */
export const INVALID_CHARS_WINDOWS = /[/\\:*?"<>|\x00-\x1f]/g;

/**
 * Characters invalid on macOS (basically just / and NUL).
 */
export const INVALID_CHARS_MACOS = /[/\x00]/g;

/**
 * Characters invalid on Linux (just / and NUL).
 */
export const INVALID_CHARS_LINUX = /[/\x00]/g;

/**
 * Windows reserved device names (case-insensitive).
 * These cannot be used as filenames on Windows.
 */
export const WINDOWS_RESERVED_NAMES = new Set([
  'con',
  'prn',
  'aux',
  'nul',
  'com1',
  'com2',
  'com3',
  'com4',
  'com5',
  'com6',
  'com7',
  'com8',
  'com9',
  'lpt1',
  'lpt2',
  'lpt3',
  'lpt4',
  'lpt5',
  'lpt6',
  'lpt7',
  'lpt8',
  'lpt9',
]);

/**
 * Maximum filename length for most filesystems.
 */
export const MAX_FILENAME_LENGTH = 255;

// =============================================================================
// Types
// =============================================================================

/**
 * Options for filename sanitization.
 */
export interface SanitizeOptions {
  /**
   * Character to replace invalid characters with.
   * @default '_'
   */
  replacement?: string;

  /**
   * Target platform(s) for validation.
   * 'all' ensures cross-platform compatibility.
   * @default 'all'
   */
  targetPlatform?: 'all' | 'windows' | 'macos' | 'linux' | 'current';

  /**
   * Maximum filename length (including extension).
   * @default 255
   */
  maxLength?: number;

  /**
   * How to handle truncation.
   * 'ellipsis' adds '...' before extension.
   * 'none' truncates silently.
   * @default 'ellipsis'
   */
  truncationStyle?: 'ellipsis' | 'none';
}

/**
 * Type of change made during sanitization.
 */
export type SanitizeChangeType =
  | 'char_replacement'
  | 'reserved_name'
  | 'truncation'
  | 'trailing_fix';

/**
 * Information about a single sanitization change.
 */
export interface SanitizeChange {
  /** Type of change made */
  type: SanitizeChangeType;
  /** Original content that was changed */
  original: string;
  /** What it was replaced with */
  replacement: string;
  /** Optional position where the change occurred */
  position?: number;
  /** Human-readable description of the change */
  message: string;
}

/**
 * Result of sanitizing a filename.
 */
export interface SanitizeResult {
  /** The sanitized filename */
  sanitized: string;
  /** The original filename */
  original: string;
  /** List of changes made */
  changes: SanitizeChange[];
  /** Whether any modifications were made */
  wasModified: boolean;
}

// =============================================================================
// Main Function
// =============================================================================

/**
 * Sanitize a filename to be valid across operating systems.
 *
 * Applies the following transformations in order:
 * 1. Replace invalid characters
 * 2. Collapse consecutive replacement characters
 * 3. Handle Windows reserved names
 * 4. Fix trailing spaces and periods (Windows)
 * 5. Truncate if too long
 *
 * @param filename - The filename to sanitize
 * @param options - Sanitization options
 * @returns The sanitized result with change tracking
 *
 * @example
 * ```typescript
 * const result = sanitizeFilename('photo:2024.jpg');
 * // result.sanitized = 'photo_2024.jpg'
 * // result.wasModified = true
 * // result.changes[0].type = 'char_replacement'
 * ```
 */
export function sanitizeFilename(
  filename: string,
  options: SanitizeOptions = {}
): SanitizeResult {
  const {
    replacement = '_',
    targetPlatform = 'all',
    maxLength = MAX_FILENAME_LENGTH,
    truncationStyle = 'ellipsis',
  } = options;

  const changes: SanitizeChange[] = [];
  let result = filename;

  // Handle empty filename
  if (!filename) {
    return {
      sanitized: filename,
      original: filename,
      changes: [],
      wasModified: false,
    };
  }

  // Step 1: Replace invalid characters
  const invalidPattern = getInvalidCharsPattern(targetPlatform);
  const charMatches = result.match(invalidPattern);

  if (charMatches) {
    const uniqueChars = [...new Set(charMatches)];
    changes.push({
      type: 'char_replacement',
      original: uniqueChars.join(''),
      replacement: replacement.repeat(uniqueChars.length),
      message: `Replaced invalid characters: ${uniqueChars.map((c) => `"${c}"`).join(', ')}`,
    });
    result = result.replace(invalidPattern, replacement);
  }

  // Step 2: Collapse multiple consecutive replacements
  if (replacement) {
    const multipleReplacements = new RegExp(`${escapeRegex(replacement)}{2,}`, 'g');
    result = result.replace(multipleReplacements, replacement);
  }

  // Step 3: Handle Windows reserved names
  if (shouldCheckReservedNames(targetPlatform)) {
    const { name: nameWithoutExt, ext } = splitFilename(result);

    if (WINDOWS_RESERVED_NAMES.has(nameWithoutExt.toLowerCase())) {
      const newName = `${nameWithoutExt}_file${ext}`;
      changes.push({
        type: 'reserved_name',
        original: nameWithoutExt,
        replacement: `${nameWithoutExt}_file`,
        message: `"${nameWithoutExt}" is a reserved name on Windows`,
      });
      result = newName;
    }
  }

  // Step 4: Fix trailing spaces and periods (Windows issue)
  // This applies to both the name portion and the whole filename
  if (shouldCheckTrailingChars(targetPlatform)) {
    // First, handle the name portion (before extension)
    const { name: nameWithoutExt, ext } = splitFilename(result);
    const trimmedName = nameWithoutExt.replace(/[. ]+$/, '');

    if (trimmedName !== nameWithoutExt) {
      changes.push({
        type: 'trailing_fix',
        original: nameWithoutExt.slice(trimmedName.length),
        replacement: '',
        message: 'Removed trailing spaces/periods (invalid on Windows)',
      });
      result = trimmedName + ext;
    }

    // Also handle trailing chars at end of whole filename (no extension case)
    const trimmedFull = result.replace(/[. ]+$/, '');
    if (trimmedFull !== result) {
      // Only add change if not already recorded
      if (trimmedName === nameWithoutExt) {
        changes.push({
          type: 'trailing_fix',
          original: result.slice(trimmedFull.length),
          replacement: '',
          message: 'Removed trailing spaces/periods (invalid on Windows)',
        });
      }
      result = trimmedFull;
    }
  }

  // Step 5: Handle length truncation
  if (result.length > maxLength) {
    result = truncateFilename(result, maxLength, truncationStyle, changes);
  }

  return {
    sanitized: result,
    original: filename,
    changes,
    wasModified: result !== filename,
  };
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get the appropriate invalid character pattern for the target platform.
 */
function getInvalidCharsPattern(
  targetPlatform: SanitizeOptions['targetPlatform']
): RegExp {
  switch (targetPlatform) {
    case 'windows':
      return INVALID_CHARS_WINDOWS;
    case 'macos':
      return INVALID_CHARS_MACOS;
    case 'linux':
      return INVALID_CHARS_LINUX;
    case 'current':
      return platform() === 'win32' ? INVALID_CHARS_WINDOWS : INVALID_CHARS_UNIVERSAL;
    case 'all':
    default:
      return INVALID_CHARS_UNIVERSAL;
  }
}

/**
 * Determine if we should check for Windows reserved names.
 */
function shouldCheckReservedNames(
  targetPlatform: SanitizeOptions['targetPlatform']
): boolean {
  return (
    targetPlatform === 'all' ||
    targetPlatform === 'windows' ||
    (targetPlatform === 'current' && platform() === 'win32')
  );
}

/**
 * Determine if we should check for trailing spaces/periods.
 */
function shouldCheckTrailingChars(
  targetPlatform: SanitizeOptions['targetPlatform']
): boolean {
  return (
    targetPlatform === 'all' ||
    targetPlatform === 'windows' ||
    (targetPlatform === 'current' && platform() === 'win32')
  );
}

/**
 * Escape special regex characters in a string.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Split a filename into name and extension.
 * Handles edge cases like dotfiles and multiple extensions.
 */
function splitFilename(filename: string): { name: string; ext: string } {
  // Handle empty filename
  if (!filename) {
    return { name: '', ext: '' };
  }

  // Handle dotfiles like .gitignore
  if (filename.startsWith('.') && !filename.slice(1).includes('.')) {
    return { name: filename, ext: '' };
  }

  const lastDot = filename.lastIndexOf('.');

  // No extension
  if (lastDot === -1 || lastDot === 0) {
    return { name: filename, ext: '' };
  }

  return {
    name: filename.slice(0, lastDot),
    ext: filename.slice(lastDot),
  };
}

/**
 * Truncate a filename while preserving the extension.
 */
function truncateFilename(
  filename: string,
  maxLength: number,
  style: 'ellipsis' | 'none',
  changes: SanitizeChange[]
): string {
  const { name: nameWithoutExt, ext } = splitFilename(filename);

  // Reserve space for extension
  const maxNameLength = maxLength - ext.length;

  // Handle edge case where extension alone is too long
  if (maxNameLength < 1) {
    changes.push({
      type: 'truncation',
      original: filename,
      replacement: filename.slice(0, maxLength),
      message: `Truncated from ${filename.length} to ${maxLength} characters (extension too long)`,
    });
    return filename.slice(0, maxLength);
  }

  // Truncate name portion
  let truncatedName: string;

  if (style === 'ellipsis') {
    const ellipsis = '...';
    const availableLength = maxNameLength - ellipsis.length;

    if (availableLength > 0) {
      truncatedName = nameWithoutExt.slice(0, availableLength) + ellipsis;
    } else {
      truncatedName = nameWithoutExt.slice(0, maxNameLength);
    }
  } else {
    truncatedName = nameWithoutExt.slice(0, maxNameLength);
  }

  const result = truncatedName + ext;

  changes.push({
    type: 'truncation',
    original: filename,
    replacement: result,
    message: `Truncated from ${filename.length} to ${result.length} characters`,
  });

  return result;
}
