/**
 * @fileoverview Case normalization utilities for filenames and folder names
 *
 * Provides functions to normalize string casing for consistent file naming.
 * Default recommendation: kebab-case for maximum compatibility.
 *
 * Why kebab-case?
 * - URL-friendly (no encoding needed)
 * - CLI-friendly (no quoting needed)
 * - Cross-platform compatible
 * - Readable (words clearly separated)
 * - SEO-friendly (hyphens as word separators)
 */

import { z } from 'zod';

// =============================================================================
// Types and Schemas
// =============================================================================

/**
 * Supported case normalization styles.
 */
export const caseStyleSchema = z.enum([
  'none',        // No transformation
  'lowercase',   // all lowercase
  'uppercase',   // ALL UPPERCASE
  'capitalize',  // First letter uppercase
  'title-case',  // Each Word Capitalized
  'kebab-case',  // words-separated-by-hyphens (RECOMMENDED)
  'snake_case',  // words_separated_by_underscores
  'camelCase',   // wordsJoinedWithCamelCase
  'PascalCase',  // WordsJoinedWithPascalCase
]);

export type CaseStyle = z.infer<typeof caseStyleSchema>;

/**
 * Options for case normalization.
 */
export interface CaseNormalizationOptions {
  /** The case style to apply (default: 'kebab-case') */
  style: CaseStyle;
  /** Preserve existing acronyms like "PDF", "API" (default: false) */
  preserveAcronyms?: boolean;
  /** Custom word separators to recognize (default: [' ', '_', '-', '.']) */
  separators?: string[];
}

/**
 * Result of case normalization.
 */
export interface CaseNormalizationResult {
  /** Original input string */
  original: string;
  /** Normalized output string */
  normalized: string;
  /** Style that was applied */
  style: CaseStyle;
  /** Whether any transformation occurred */
  changed: boolean;
}

// =============================================================================
// Default Configuration
// =============================================================================

/** Default case style - kebab-case for maximum compatibility */
export const DEFAULT_CASE_STYLE: CaseStyle = 'kebab-case';

/** Default separators to recognize when splitting words */
const DEFAULT_SEPARATORS = [' ', '_', '-', '.'];

/** Common acronyms to preserve when preserveAcronyms is true */
const COMMON_ACRONYMS = new Set([
  'PDF', 'API', 'URL', 'HTML', 'CSS', 'JSON', 'XML', 'SQL',
  'USB', 'HDMI', 'RGB', 'GPS', 'EXIF', 'JPEG', 'PNG', 'GIF',
  'MP3', 'MP4', 'AVI', 'MOV', 'WAV', 'FLAC', 'RAW', 'HEIC',
  'ID', 'UI', 'UX', 'AI', 'ML', 'VR', 'AR', 'IoT',
]);

// =============================================================================
// Word Splitting
// =============================================================================

/**
 * Split a string into words, handling various formats.
 * Recognizes: spaces, underscores, hyphens, dots, camelCase, PascalCase.
 */
function splitIntoWords(input: string, separators: string[] = DEFAULT_SEPARATORS): string[] {
  if (!input) return [];

  // First, replace all separators with a common delimiter
  let normalized = input;
  for (const sep of separators) {
    normalized = normalized.split(sep).join('|');
  }

  // Split on the delimiter
  let words = normalized.split('|').filter(Boolean);

  // Further split camelCase/PascalCase within each word
  words = words.flatMap((word) => {
    // Match: lowercase followed by uppercase, or uppercase followed by lowercase (for acronyms)
    // Examples: "camelCase" → ["camel", "Case"], "HTMLParser" → ["HTML", "Parser"]
    const parts = word
      .replace(/([a-z])([A-Z])/g, '$1|$2')     // camelCase split
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1|$2') // ACRONYM + Word split
      .split('|')
      .filter(Boolean);
    return parts;
  });

  return words;
}

// =============================================================================
// Case Transformations
// =============================================================================

/**
 * Convert a word to lowercase.
 */
function toLower(word: string): string {
  return word.toLowerCase();
}

/**
 * Convert a word to uppercase.
 */
function toUpper(word: string): string {
  return word.toUpperCase();
}

/**
 * Capitalize first letter of a word.
 */
function capitalize(word: string): string {
  if (!word) return '';
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

/**
 * Check if a word is a known acronym.
 */
function isAcronym(word: string): boolean {
  return COMMON_ACRONYMS.has(word.toUpperCase());
}

// =============================================================================
// Main Normalization Functions
// =============================================================================

/**
 * Apply case normalization to a string.
 *
 * @param input - The string to normalize
 * @param options - Normalization options or just the style
 * @returns The normalization result
 *
 * @example
 * normalizeCase('My Document Title', 'kebab-case')
 * // Returns: { original: 'My Document Title', normalized: 'my-document-title', style: 'kebab-case', changed: true }
 *
 * @example
 * normalizeCase('user_profile_photo', 'kebab-case')
 * // Returns: { original: 'user_profile_photo', normalized: 'user-profile-photo', style: 'kebab-case', changed: true }
 */
export function normalizeCase(
  input: string,
  options: CaseStyle | CaseNormalizationOptions
): CaseNormalizationResult {
  const opts: CaseNormalizationOptions =
    typeof options === 'string' ? { style: options } : options;

  const { style, preserveAcronyms = false, separators = DEFAULT_SEPARATORS } = opts;

  // Handle 'none' style - no transformation
  if (style === 'none' || !input) {
    return {
      original: input,
      normalized: input,
      style,
      changed: false,
    };
  }

  const words = splitIntoWords(input, separators);

  let normalized: string;

  switch (style) {
    case 'lowercase':
      normalized = words.map(toLower).join(' ');
      break;

    case 'uppercase':
      normalized = words.map(toUpper).join(' ');
      break;

    case 'capitalize': {
      const firstWord = words[0];
      if (firstWord) {
        normalized = capitalize(firstWord) + (words.length > 1 ? ' ' + words.slice(1).map(toLower).join(' ') : '');
      } else {
        normalized = '';
      }
      break;
    }

    case 'title-case':
      normalized = words
        .map((word) => {
          if (preserveAcronyms && isAcronym(word)) {
            return word.toUpperCase();
          }
          return capitalize(word);
        })
        .join(' ');
      break;

    case 'kebab-case':
      normalized = words
        .map((word) => {
          if (preserveAcronyms && isAcronym(word)) {
            return word.toUpperCase();
          }
          return toLower(word);
        })
        .join('-');
      break;

    case 'snake_case':
      normalized = words
        .map((word) => {
          if (preserveAcronyms && isAcronym(word)) {
            return word.toUpperCase();
          }
          return toLower(word);
        })
        .join('_');
      break;

    case 'camelCase':
      normalized = words
        .map((word, index) => {
          if (preserveAcronyms && isAcronym(word)) {
            return index === 0 ? word.toLowerCase() : word.toUpperCase();
          }
          return index === 0 ? toLower(word) : capitalize(word);
        })
        .join('');
      break;

    case 'PascalCase':
      normalized = words
        .map((word) => {
          if (preserveAcronyms && isAcronym(word)) {
            return word.toUpperCase();
          }
          return capitalize(word);
        })
        .join('');
      break;

    default:
      normalized = input;
  }

  return {
    original: input,
    normalized,
    style,
    changed: normalized !== input,
  };
}

/**
 * Normalize a filename with special handling for extensions.
 *
 * Extensions are always lowercased regardless of the style chosen.
 * The name part is normalized according to the specified style.
 *
 * @param filename - The filename to normalize (with or without extension)
 * @param style - The case style to apply to the name part
 * @returns The normalized filename
 *
 * @example
 * normalizeFilename('My Document.PDF', 'kebab-case')
 * // Returns: 'my-document.pdf'
 *
 * @example
 * normalizeFilename('USER_PHOTO.JPEG', 'kebab-case')
 * // Returns: 'user-photo.jpeg'
 */
export function normalizeFilename(
  filename: string,
  style: CaseStyle | CaseNormalizationOptions
): string {
  if (!filename) return '';

  const styleOpts = typeof style === 'string' ? { style } : style;

  // If style is 'none', return as-is
  if (styleOpts.style === 'none') {
    return filename;
  }

  // Handle hidden files (starting with .)
  const isHidden = filename.startsWith('.');
  const workingName = isHidden ? filename.substring(1) : filename;

  // Split name and extension
  const lastDotIndex = workingName.lastIndexOf('.');
  const hasExtension = lastDotIndex > 0; // Has a dot that's not at start

  const name = hasExtension ? workingName.substring(0, lastDotIndex) : workingName;
  const extension = hasExtension ? workingName.substring(lastDotIndex) : '';

  // Normalize the name part
  const { normalized: normalizedName } = normalizeCase(name, styleOpts);

  // Extension is always lowercase
  const normalizedExtension = extension.toLowerCase();

  // Reconstruct with hidden dot if needed
  const prefix = isHidden ? '.' : '';
  return prefix + normalizedName + normalizedExtension;
}

/**
 * Normalize a folder/directory name.
 *
 * Similar to filename normalization but without extension handling.
 *
 * @param folderName - The folder name to normalize
 * @param style - The case style to apply
 * @returns The normalized folder name
 *
 * @example
 * normalizeFolderName('My Documents', 'kebab-case')
 * // Returns: 'my-documents'
 */
export function normalizeFolderName(
  folderName: string,
  style: CaseStyle | CaseNormalizationOptions
): string {
  if (!folderName) return '';

  const styleOpts = typeof style === 'string' ? { style } : style;

  // If style is 'none', return as-is
  if (styleOpts.style === 'none') {
    return folderName;
  }

  const { normalized } = normalizeCase(folderName, styleOpts);
  return normalized;
}

/**
 * Normalize a full path, applying normalization to each segment.
 *
 * @param path - The path to normalize (forward slashes)
 * @param style - The case style to apply
 * @param options - Additional options
 * @returns The normalized path
 *
 * @example
 * normalizePath('My Documents/Photos/Vacation', 'kebab-case')
 * // Returns: 'my-documents/photos/vacation'
 */
export function normalizePath(
  path: string,
  style: CaseStyle | CaseNormalizationOptions,
  options?: { preserveRoot?: boolean }
): string {
  if (!path) return '';

  const styleOpts = typeof style === 'string' ? { style } : style;

  // If style is 'none', return as-is
  if (styleOpts.style === 'none') {
    return path;
  }

  // Split on forward slashes
  const segments = path.split('/');

  // Normalize each segment (except empty ones from leading/trailing slashes)
  const normalized = segments.map((segment, index) => {
    // Preserve empty segments (from leading/trailing slashes)
    if (!segment) return segment;

    // Optionally preserve root segment (e.g., drive letter on Windows)
    if (options?.preserveRoot && index === 0) {
      return segment;
    }

    return normalizeFolderName(segment, styleOpts);
  });

  return normalized.join('/');
}
