import { ok, err } from '../types/result.js';
import type { Result } from '../types/result.js';
import type {
  ParsedTemplate,
  TemplateToken,
  PlaceholderType,
} from '../types/template.js';
import { PLACEHOLDER_TYPES } from '../types/template.js';

/**
 * Error types that can occur during template parsing
 */
export interface ParseError {
  type: 'unclosed_brace' | 'empty_placeholder' | 'unexpected_close_brace';
  position: number;
  message: string;
}

// Match placeholders including empty ones: {content} or {}
const PLACEHOLDER_REGEX = /\{([^{}]*)\}/g;

// Markers for escaped braces (using unlikely sequences to avoid regex issues)
const OPEN_MARKER = '<<<OPEN_BRACE>>>';
const CLOSE_MARKER = '<<<CLOSE_BRACE>>>';

/**
 * Parse a template string into a structured representation.
 *
 * Handles:
 * - Single and multiple placeholders
 * - Literal text between placeholders
 * - Escaped braces: `{{` becomes `{` and `}}` becomes `}`
 *
 * @param pattern - The template pattern to parse
 * @returns Result with ParsedTemplate or ParseError
 *
 * @example
 * ```typescript
 * const result = parseTemplate('{year}-{month}-{title}');
 * if (result.ok) {
 *   console.log(result.data.placeholders); // ['year', 'month', 'title']
 * }
 * ```
 */
export function parseTemplate(
  pattern: string
): Result<ParsedTemplate, ParseError> {
  // Check for unclosed braces first
  const unclosedCheck = checkUnclosedBraces(pattern);
  if (unclosedCheck) {
    return err(unclosedCheck);
  }

  // Handle escaped braces by temporarily replacing them with markers
  const escapedPattern = pattern
    .replace(/\{\{/g, OPEN_MARKER)
    .replace(/\}\}/g, CLOSE_MARKER);

  const tokens: TemplateToken[] = [];
  const placeholders: string[] = [];
  let lastIndex = 0;

  // Create a new regex instance for each parse
  const regex = new RegExp(PLACEHOLDER_REGEX.source, 'g');
  let match: RegExpExecArray | null;

  while ((match = regex.exec(escapedPattern)) !== null) {
    // Add literal text before this match
    if (match.index > lastIndex) {
      const literalText = restoreEscapedBraces(
        escapedPattern.slice(lastIndex, match.index)
      );
      tokens.push({ type: 'literal', value: literalText });
    }

    const placeholderName = (match[1] ?? '').trim();

    // Check for empty placeholder
    if (!placeholderName) {
      return err({
        type: 'empty_placeholder',
        position: match.index,
        message: 'Empty placeholder {} is not allowed',
      });
    }

    tokens.push({ type: 'placeholder', name: placeholderName });

    // Track unique placeholders
    if (!placeholders.includes(placeholderName)) {
      placeholders.push(placeholderName);
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining literal text
  if (lastIndex < escapedPattern.length) {
    const literalText = restoreEscapedBraces(escapedPattern.slice(lastIndex));
    tokens.push({ type: 'literal', value: literalText });
  }

  return ok({
    pattern,
    tokens,
    placeholders,
  });
}

/**
 * Extract all placeholder names from a template string.
 *
 * @param pattern - The template pattern
 * @returns Array of placeholder names, or empty array if parsing fails
 */
export function extractPlaceholders(pattern: string): string[] {
  const result = parseTemplate(pattern);
  if (!result.ok) {
    return [];
  }
  return result.data.placeholders;
}

/**
 * Check if a placeholder name is a known/supported type.
 *
 * @param name - The placeholder name to check
 * @returns True if the placeholder is a known type
 */
export function isKnownPlaceholder(name: string): name is PlaceholderType {
  return (PLACEHOLDER_TYPES as readonly string[]).includes(name);
}

/**
 * Get all known placeholders used in a template.
 *
 * @param pattern - The template pattern
 * @returns Array of known placeholder types
 */
export function getKnownPlaceholders(pattern: string): PlaceholderType[] {
  return extractPlaceholders(pattern).filter(isKnownPlaceholder);
}

/**
 * Get all unknown/custom placeholders in a template.
 * Useful for validation warnings.
 *
 * @param pattern - The template pattern
 * @returns Array of placeholder names that are not known types
 */
export function getUnknownPlaceholders(pattern: string): string[] {
  return extractPlaceholders(pattern).filter((p) => !isKnownPlaceholder(p));
}

/**
 * Restore escaped brace markers back to literal braces.
 */
function restoreEscapedBraces(text: string): string {
  return text.replace(/<<<OPEN_BRACE>>>/g, '{').replace(/<<<CLOSE_BRACE>>>/g, '}');
}

/**
 * Check for unclosed or mismatched braces in a pattern.
 *
 * @param pattern - The template pattern to validate
 * @returns ParseError if braces are unclosed, null otherwise
 */
function checkUnclosedBraces(pattern: string): ParseError | null {
  let braceDepth = 0;
  let openPosition = 0;

  for (let i = 0; i < pattern.length; i++) {
    const char = pattern[i];
    const nextChar = pattern[i + 1];

    // Skip escaped braces ({{ or }})
    if (
      (char === '{' && nextChar === '{') ||
      (char === '}' && nextChar === '}')
    ) {
      i++; // Skip the next character
      continue;
    }

    if (char === '{') {
      braceDepth++;
      openPosition = i;
    } else if (char === '}') {
      if (braceDepth === 0) {
        return {
          type: 'unexpected_close_brace',
          position: i,
          message: `Unexpected closing brace at position ${String(i)}`,
        };
      }
      braceDepth--;
    }
  }

  if (braceDepth > 0) {
    return {
      type: 'unclosed_brace',
      position: openPosition,
      message: `Unclosed brace at position ${String(openPosition)}`,
    };
  }

  return null;
}
