/**
 * @fileoverview Glob pattern matcher for filename rules - Story 7.2
 *
 * Implements glob-style pattern matching for filenames:
 * - `*` matches any characters (zero or more)
 * - `?` matches a single character
 * - `[abc]` matches any character in the set
 * - `[a-z]` matches any character in the range
 * - `[!abc]` or `[^abc]` matches any character NOT in the set
 * - `{a,b,c}` matches any of the alternatives (brace expansion)
 */

// =============================================================================
// Pattern Matching Types
// =============================================================================

/**
 * Options for glob pattern matching.
 */
export interface GlobMatchOptions {
  /** Whether matching should be case-sensitive (default: false) */
  caseSensitive?: boolean;
}

/**
 * Result of a glob match operation.
 */
export interface GlobMatchResult {
  /** Whether the pattern matched */
  matches: boolean;
}

// =============================================================================
// Internal Pattern Compilation
// =============================================================================

/**
 * Escape a string for use in a regular expression.
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Expand brace patterns like {a,b,c} into alternatives.
 * Returns an array of patterns with braces expanded.
 *
 * @example
 * expandBraces('*.{jpg,png}') // ['*.jpg', '*.png']
 * expandBraces('{a,b}.{x,y}') // ['a.x', 'a.y', 'b.x', 'b.y']
 */
export function expandBraces(pattern: string): string[] {
  // Find the first brace group
  let braceStart = -1;
  let braceEnd = -1;
  let depth = 0;

  for (let i = 0; i < pattern.length; i++) {
    const char = pattern[i];
    const prevChar = pattern[i - 1];

    // Skip escaped characters
    if (prevChar === '\\') {
      continue;
    }

    if (char === '{') {
      if (depth === 0) {
        braceStart = i;
      }
      depth++;
    } else if (char === '}') {
      depth--;
      if (depth === 0) {
        braceEnd = i;
        break;
      }
    }
  }

  // No braces found, return original pattern
  if (braceStart === -1 || braceEnd === -1) {
    return [pattern];
  }

  // Extract brace content and split by comma (respecting nested braces)
  const prefix = pattern.slice(0, braceStart);
  const suffix = pattern.slice(braceEnd + 1);
  const braceContent = pattern.slice(braceStart + 1, braceEnd);

  // Split by top-level commas only
  const alternatives: string[] = [];
  let current = '';
  depth = 0;

  for (let i = 0; i < braceContent.length; i++) {
    const char = braceContent[i];
    const prevChar = braceContent[i - 1];

    // Skip escaped characters
    if (prevChar === '\\') {
      current += char;
      continue;
    }

    if (char === '{') {
      depth++;
      current += char;
    } else if (char === '}') {
      depth--;
      current += char;
    } else if (char === ',' && depth === 0) {
      alternatives.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  alternatives.push(current);

  // Expand each alternative and recursively expand remaining braces
  const expanded: string[] = [];
  for (const alt of alternatives) {
    const combined = prefix + alt + suffix;
    // Recursively expand any remaining braces
    expanded.push(...expandBraces(combined));
  }

  return expanded;
}

/**
 * Convert a glob pattern to a regular expression.
 *
 * @param pattern - The glob pattern
 * @returns Regular expression string
 */
function globToRegex(pattern: string): string {
  let regex = '';
  let i = 0;

  while (i < pattern.length) {
    const char = pattern[i]!;
    const nextChar = pattern[i + 1];

    // Handle escape sequences
    if (char === '\\' && nextChar !== undefined) {
      // Escape the next character literally
      regex += escapeRegExp(nextChar);
      i += 2;
      continue;
    }

    switch (char) {
      case '*':
        // * matches any characters (zero or more)
        regex += '.*';
        break;

      case '?':
        // ? matches exactly one character
        regex += '.';
        break;

      case '[':
        // Character class - find the closing bracket
        const classStart = i;
        let classEnd = -1;
        let j = i + 1;

        // Check for negation
        let negated = false;
        if (pattern[j] === '!' || pattern[j] === '^') {
          negated = true;
          j++;
        }

        // Find the closing bracket
        while (j < pattern.length) {
          if (pattern[j] === ']' && j > classStart + 1) {
            classEnd = j;
            break;
          }
          // Handle escape in character class
          if (pattern[j] === '\\' && j + 1 < pattern.length) {
            j += 2;
            continue;
          }
          j++;
        }

        if (classEnd === -1) {
          // Unclosed bracket - treat as literal
          regex += escapeRegExp(char);
        } else {
          // Build character class
          let classContent = pattern.slice(classStart + 1 + (negated ? 1 : 0), classEnd);

          // Escape special regex characters inside class (except - for ranges)
          classContent = classContent.replace(/[\]\\^]/g, '\\$&');

          if (negated) {
            regex += '[^' + classContent + ']';
          } else {
            regex += '[' + classContent + ']';
          }
          i = classEnd;
        }
        break;

      default:
        // Escape any special regex characters
        regex += escapeRegExp(char);
    }

    i++;
  }

  return regex;
}

/**
 * Compile a glob pattern into a regular expression.
 *
 * @param pattern - The glob pattern to compile
 * @param options - Match options
 * @returns Compiled regular expression
 */
export function compileGlobPattern(pattern: string, options: GlobMatchOptions = {}): RegExp {
  const { caseSensitive = false } = options;

  // Expand braces first to handle patterns like *.{jpg,png}
  const expandedPatterns = expandBraces(pattern);

  // Convert each expanded pattern to regex
  const regexPatterns = expandedPatterns.map((p) => globToRegex(p));

  // Combine with alternation if multiple patterns
  const combinedRegex =
    regexPatterns.length === 1 ? regexPatterns[0] : '(?:' + regexPatterns.join('|') + ')';

  // Create regex that matches the entire string
  const flags = caseSensitive ? '' : 'i';
  return new RegExp('^' + combinedRegex + '$', flags);
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Test if a filename matches a glob pattern.
 *
 * @param pattern - Glob pattern (e.g., "*.jpg", "IMG_*.{jpg,png}")
 * @param filename - Filename to test (e.g., "photo.jpg")
 * @param options - Match options
 * @returns Match result
 *
 * @example
 * matchGlob('*.jpg', 'photo.jpg') // { matches: true }
 * matchGlob('IMG_*.jpg', 'IMG_1234.jpg') // { matches: true }
 * matchGlob('*.{jpg,png}', 'image.png') // { matches: true }
 * matchGlob('[0-9][0-9][0-9].txt', '123.txt') // { matches: true }
 */
export function matchGlob(
  pattern: string,
  filename: string,
  options: GlobMatchOptions = {}
): GlobMatchResult {
  try {
    const regex = compileGlobPattern(pattern, options);
    const matches = regex.test(filename);
    return { matches };
  } catch {
    // Pattern compilation failed - no match
    return { matches: false };
  }
}

/**
 * Test if a filename matches a glob pattern (simple boolean version).
 *
 * @param pattern - Glob pattern
 * @param filename - Filename to test
 * @param options - Match options
 * @returns true if matches, false otherwise
 */
export function isGlobMatch(
  pattern: string,
  filename: string,
  options: GlobMatchOptions = {}
): boolean {
  return matchGlob(pattern, filename, options).matches;
}

/**
 * Find all filenames that match a glob pattern.
 *
 * @param pattern - Glob pattern
 * @param filenames - Array of filenames to test
 * @param options - Match options
 * @returns Array of matching filenames
 */
export function filterByGlob(
  pattern: string,
  filenames: string[],
  options: GlobMatchOptions = {}
): string[] {
  try {
    const regex = compileGlobPattern(pattern, options);
    return filenames.filter((filename) => regex.test(filename));
  } catch {
    return [];
  }
}
