/**
 * Filename sanitization utilities.
 *
 * Provides functions to sanitize strings for safe use in filenames
 * across all major operating systems (Windows, macOS, Linux).
 */

/**
 * Characters that are invalid in filenames across all platforms.
 * Includes control characters (\x00-\x1F) and reserved characters.
 * Uses \u002F for forward slash to avoid regex parsing issues.
 */
// eslint-disable-next-line no-control-regex
const INVALID_CHARS_REGEX = /[<>:"\u002F\\|?*\u0000-\u001F]/g;

/**
 * Same pattern without global flag for validation (avoids lastIndex issues).
 */
// eslint-disable-next-line no-control-regex
const INVALID_CHARS_TEST = /[<>:"\u002F\\|?*\u0000-\u001F]/;

/**
 * Maximum filename length (conservative for all platforms).
 * Windows has a 255 character limit, macOS/Linux typically 255.
 * Using 200 to leave room for extensions and path components.
 */
const MAX_FILENAME_LENGTH = 200;

/**
 * Reserved filenames on Windows (case-insensitive).
 */
const WINDOWS_RESERVED_NAMES = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/i;

/**
 * Sanitize a string for safe use in filenames.
 *
 * @param input - The string to sanitize
 * @returns A filename-safe version of the string
 *
 * @example
 * sanitizeFilename('Report: Q4/2024 <draft>') // Returns 'Report_Q4_2024_draft'
 * sanitizeFilename('file\\name:test') // Returns 'file_name_test'
 */
export function sanitizeFilename(input: string): string {
  if (!input) return '';

  let result = input
    // Remove or replace invalid characters with underscore
    .replace(INVALID_CHARS_REGEX, '_')
    // Collapse multiple underscores, spaces, or dashes into single underscore
    .replace(/[-_\s]+/g, '_')
    // Remove leading/trailing underscores
    .replace(/^_+|_+$/g, '')
    // Trim whitespace
    .trim();

  // Truncate if too long, avoiding cutting in the middle of a word
  if (result.length > MAX_FILENAME_LENGTH) {
    result = result.substring(0, MAX_FILENAME_LENGTH);
    const lastUnderscore = result.lastIndexOf('_');
    if (lastUnderscore > MAX_FILENAME_LENGTH * 0.8) {
      result = result.substring(0, lastUnderscore);
    }
  }

  return result;
}

/**
 * Check if a filename is valid on all platforms.
 *
 * @param name - The filename to validate
 * @returns True if the filename is valid on all platforms
 *
 * @example
 * isValidFilename('document.pdf') // Returns true
 * isValidFilename('file:name.txt') // Returns false (contains colon)
 * isValidFilename('CON') // Returns false (Windows reserved name)
 */
export function isValidFilename(name: string): boolean {
  if (!name || name.length === 0) return false;
  if (name.length > MAX_FILENAME_LENGTH) return false;
  if (INVALID_CHARS_TEST.test(name)) return false;

  // Check for reserved names on Windows (without extension)
  const nameWithoutExt = name.includes('.')
    ? name.substring(0, name.lastIndexOf('.'))
    : name;
  if (WINDOWS_RESERVED_NAMES.test(nameWithoutExt)) return false;

  // Check for leading/trailing dots or spaces (problematic on Windows)
  if (name.startsWith('.') || name.startsWith(' ')) return false;
  if (name.endsWith('.') || name.endsWith(' ')) return false;

  return true;
}
