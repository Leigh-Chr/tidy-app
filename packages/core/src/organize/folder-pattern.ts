/**
 * @fileoverview Folder pattern validation and normalization - Story 8.1
 *
 * Provides functions to validate and normalize folder structure patterns
 * that use placeholders (same as naming templates) for organizing files.
 */

import type { FolderPatternValidationResult } from '../types/folder-structure.js';
import { PLACEHOLDER_TYPES } from '../types/template.js';

// =============================================================================
// Constants
// =============================================================================

/**
 * Valid placeholders for folder patterns (same as naming templates).
 */
export const VALID_FOLDER_PLACEHOLDERS: readonly string[] = PLACEHOLDER_TYPES;

/**
 * Characters that are invalid in folder names on most operating systems.
 */
const INVALID_PATH_CHARS = /[<>:"|?*\x00-\x1f]/;

/**
 * Windows reserved folder names (case-insensitive).
 */
const WINDOWS_RESERVED_NAMES = new Set([
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

// =============================================================================
// Pattern Normalization (AC6: normalize path separators)
// =============================================================================

/**
 * Normalizes a folder pattern by:
 * - Standardizing path separators to forward slashes
 * - Removing leading/trailing slashes
 * - Collapsing multiple consecutive slashes
 *
 * @param pattern - The folder pattern to normalize
 * @returns Normalized pattern string
 *
 * @example
 * ```typescript
 * normalizeFolderPattern('\\year\\month\\');  // 'year/month'
 * normalizeFolderPattern('{year}//{month}/'); // '{year}/{month}'
 * ```
 */
export function normalizeFolderPattern(pattern: string): string {
  return (
    pattern
      // Replace backslashes with forward slashes
      .replace(/\\/g, '/')
      // Collapse multiple consecutive slashes
      .replace(/\/+/g, '/')
      // Remove leading slash
      .replace(/^\//, '')
      // Remove trailing slash
      .replace(/\/$/, '')
  );
}

// =============================================================================
// Pattern Validation (AC6: validate folder patterns)
// =============================================================================

/**
 * Validates a folder pattern and returns detailed validation results.
 *
 * Checks for:
 * - Valid placeholder syntax
 * - Known vs unknown placeholders
 * - Invalid path characters
 * - Windows reserved names
 * - Empty pattern segments
 *
 * @param pattern - The folder pattern to validate
 * @returns Validation result with errors, warnings, and placeholders found
 *
 * @example
 * ```typescript
 * const result = validateFolderPattern('{year}/{month}');
 * if (result.valid) {
 *   console.log('Placeholders:', result.placeholders);
 * } else {
 *   console.log('Errors:', result.errors);
 * }
 * ```
 */
export function validateFolderPattern(pattern: string): FolderPatternValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const placeholders: string[] = [];

  // Empty pattern check
  if (!pattern || pattern.trim() === '') {
    return {
      valid: false,
      errors: ['Pattern cannot be empty'],
      warnings: [],
      placeholders: [],
      normalizedPattern: '',
    };
  }

  // Normalize the pattern first
  const normalizedPattern = normalizeFolderPattern(pattern);

  // Check for invalid characters outside of placeholders
  const withoutPlaceholders = normalizedPattern.replace(/\{[^{}]*\}/g, '');
  if (INVALID_PATH_CHARS.test(withoutPlaceholders)) {
    const matches = withoutPlaceholders.match(INVALID_PATH_CHARS);
    errors.push(
      `Pattern contains invalid path characters: ${matches?.join(', ') ?? 'unknown'}`
    );
  }

  // Check for unclosed braces
  let braceDepth = 0;
  let inPlaceholder = false;
  let currentPlaceholder = '';

  for (let i = 0; i < normalizedPattern.length; i++) {
    const char = normalizedPattern[i];

    if (char === '{') {
      if (inPlaceholder) {
        errors.push(`Nested braces at position ${i}`);
      }
      braceDepth++;
      inPlaceholder = true;
      currentPlaceholder = '';
    } else if (char === '}') {
      if (!inPlaceholder) {
        errors.push(`Unexpected closing brace at position ${i}`);
      } else {
        // Validate the placeholder name
        const placeholderName = currentPlaceholder.trim();
        if (placeholderName === '') {
          errors.push('Empty placeholder found');
        } else {
          placeholders.push(placeholderName);

          // Check if it's a known placeholder
          if (!VALID_FOLDER_PLACEHOLDERS.includes(placeholderName)) {
            warnings.push(
              `Unknown placeholder '{${placeholderName}}' - may not resolve at runtime`
            );
          }
        }
      }
      braceDepth--;
      inPlaceholder = false;
      currentPlaceholder = '';
    } else if (inPlaceholder) {
      currentPlaceholder += char;
    }
  }

  // Check for unclosed braces at end
  if (braceDepth !== 0) {
    errors.push('Unclosed brace in pattern');
  }

  // Check each path segment
  const segments = normalizedPattern.split('/').filter((s) => s !== '');
  for (const segment of segments) {
    // Skip segments that are purely placeholders
    const segmentWithoutPlaceholders = segment.replace(/\{[^{}]*\}/g, '');

    // Check for empty segments after removing placeholders
    if (segment === '') {
      errors.push('Pattern contains empty path segments');
    }

    // Check for Windows reserved names (only warn, don't error)
    const lowerSegment = segmentWithoutPlaceholders.toLowerCase();
    if (WINDOWS_RESERVED_NAMES.has(lowerSegment)) {
      warnings.push(
        `Path segment '${segmentWithoutPlaceholders}' is a Windows reserved name`
      );
    }

    // Check for segments ending with dot or space (Windows issue)
    if (segmentWithoutPlaceholders.endsWith('.')) {
      warnings.push(`Path segment '${segment}' ends with a dot (may cause issues on Windows)`);
    }
    if (segmentWithoutPlaceholders.endsWith(' ')) {
      warnings.push(
        `Path segment '${segment}' ends with a space (may cause issues on Windows)`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    placeholders,
    normalizedPattern,
  };
}

/**
 * Checks if a folder pattern is valid (no errors).
 *
 * @param pattern - The folder pattern to check
 * @returns True if the pattern is valid
 *
 * @example
 * ```typescript
 * if (isValidFolderPattern('{year}/{month}')) {
 *   // Pattern is safe to use
 * }
 * ```
 */
export function isValidFolderPattern(pattern: string): boolean {
  return validateFolderPattern(pattern).valid;
}

/**
 * Extracts placeholder names from a folder pattern.
 *
 * @param pattern - The folder pattern to extract from
 * @returns Array of placeholder names found
 *
 * @example
 * ```typescript
 * extractFolderPlaceholders('{year}/{month}/{title}');
 * // Returns: ['year', 'month', 'title']
 * ```
 */
export function extractFolderPlaceholders(pattern: string): string[] {
  const matches = pattern.match(/\{([^{}]+)\}/g) ?? [];
  return matches.map((m) => m.slice(1, -1).trim());
}
