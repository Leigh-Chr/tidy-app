/**
 * @fileoverview Pattern validation for filename rules - Story 7.2
 *
 * Provides validation for glob-style patterns used in filename rules.
 * Re-exports from types/filename-rule.ts for better module organization.
 */

// Re-export validation functions from the types module
export {
  validateGlobPattern,
  isValidGlobPattern,
  type PatternValidationResult,
} from '../types/filename-rule.js';

/**
 * Error messages for common pattern validation failures.
 */
export const PatternValidationMessages = {
  EMPTY: 'Pattern cannot be empty or whitespace-only',
  UNCLOSED_BRACKET: 'Unclosed character class [',
  UNCLOSED_BRACE: 'Unclosed brace expansion {',
  EMPTY_CLASS: 'Empty character class [] is not allowed',
  EMPTY_ALTERNATIVE: 'Empty alternative in brace expansion is not allowed',
  TRAILING_COMMA: 'Trailing comma in brace expansion is not allowed',
  EMPTY_BRACE: 'Empty brace expansion {,} is not allowed',
} as const;

/**
 * Pattern syntax examples for user guidance.
 */
export const PatternExamples = {
  WILDCARD: '*.txt - matches any .txt file',
  SINGLE_CHAR: 'file?.txt - matches file1.txt, fileA.txt',
  CHAR_CLASS: '[abc].txt - matches a.txt, b.txt, c.txt',
  CHAR_RANGE: '[0-9].txt - matches 0.txt through 9.txt',
  NEGATED_CLASS: '[!abc].txt - matches any single char except a, b, c',
  BRACE_EXPANSION: '*.{jpg,png} - matches .jpg and .png files',
  COMBINED: 'IMG_*.{jpg,jpeg,heic} - matches iPhone photos',
} as const;

/**
 * Get user-friendly description of a pattern validation error.
 *
 * @param error - The error message from validateGlobPattern
 * @returns User-friendly description with example of correct usage
 */
export function getPatternErrorHelp(error: string): string {
  if (error.includes('empty')) {
    return `${error}. Example: ${PatternExamples.WILDCARD}`;
  }
  if (error.includes('character class')) {
    return `${error}. Example: ${PatternExamples.CHAR_CLASS}`;
  }
  if (error.includes('brace')) {
    return `${error}. Example: ${PatternExamples.BRACE_EXPANSION}`;
  }
  return error;
}
