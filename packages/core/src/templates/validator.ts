import type { ValidationResult, ValidationIssue } from '../types/template.js';
import { PLACEHOLDER_TYPES } from '../types/template.js';
import { parseTemplate, isKnownPlaceholder } from './parser.js';
import type { ParseError } from './parser.js';

/**
 * Levenshtein distance for suggestion matching.
 * Calculates the minimum number of single-character edits required to
 * transform one string into another.
 */
function levenshteinDistance(a: string, b: string): number {
  // Handle edge cases
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // Create two rows (we only need current and previous)
  let prevRow = Array.from({ length: a.length + 1 }, (_, i) => i);
  let currRow = new Array<number>(a.length + 1).fill(0);

  for (let i = 1; i <= b.length; i++) {
    currRow[0] = i;

    for (let j = 1; j <= a.length; j++) {
      const cost = b.charAt(i - 1) === a.charAt(j - 1) ? 0 : 1;
      currRow[j] = Math.min(
        (prevRow[j] ?? 0) + 1, // deletion
        (currRow[j - 1] ?? 0) + 1, // insertion
        (prevRow[j - 1] ?? 0) + cost // substitution
      );
    }

    // Swap rows
    [prevRow, currRow] = [currRow, prevRow];
  }

  // Result is in prevRow because of the final swap
  return prevRow[a.length] ?? 0;
}

/**
 * Find the closest known placeholder to an unknown one.
 * Returns null if no close match (within 3 edits) is found.
 */
function findClosestPlaceholder(unknown: string): string | null {
  let closest: string | null = null;
  let minDistance = Infinity;

  for (const known of PLACEHOLDER_TYPES) {
    const distance = levenshteinDistance(
      unknown.toLowerCase(),
      known.toLowerCase()
    );
    if (distance < minDistance && distance <= 3) {
      // Max 3 edits to suggest
      minDistance = distance;
      closest = known;
    }
  }

  return closest;
}

/**
 * Map ParseError type to ValidationIssue type.
 */
function mapParseErrorType(
  parseErrorType: ParseError['type']
): ValidationIssue['type'] {
  switch (parseErrorType) {
    case 'unclosed_brace':
      return 'unclosed_brace';
    case 'empty_placeholder':
      return 'empty_placeholder';
    case 'unexpected_close_brace':
      return 'unexpected_close_brace';
    default:
      return 'unclosed_brace';
  }
}

/**
 * Validate template pattern syntax.
 * Checks for brace matching and empty placeholders.
 */
function validateSyntax(pattern: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const parseResult = parseTemplate(pattern);

  if (!parseResult.ok) {
    issues.push({
      severity: 'error',
      type: mapParseErrorType(parseResult.error.type),
      message: parseResult.error.message,
      position: parseResult.error.position,
    });
  }

  return issues;
}

/**
 * Validate placeholder semantics.
 * Checks that all placeholders are recognized.
 */
function validateSemantics(pattern: string): {
  issues: ValidationIssue[];
  placeholders: string[];
  known: string[];
  unknown: string[];
} {
  const issues: ValidationIssue[] = [];
  const parseResult = parseTemplate(pattern);

  if (!parseResult.ok) {
    return { issues, placeholders: [], known: [], unknown: [] };
  }

  const placeholders = parseResult.data.placeholders;
  const known: string[] = [];
  const unknown: string[] = [];

  // Check each placeholder
  for (const placeholder of placeholders) {
    if (isKnownPlaceholder(placeholder)) {
      known.push(placeholder);
    } else {
      unknown.push(placeholder);

      const suggestion = findClosestPlaceholder(placeholder);
      const issue: ValidationIssue = {
        severity: 'error',
        type: 'unknown_placeholder',
        message: `Unknown placeholder: {${placeholder}}`,
        placeholder,
      };

      if (suggestion) {
        issue.suggestion = suggestion;
        issue.message += `. Did you mean {${suggestion}}?`;
      }

      issues.push(issue);
    }
  }

  return { issues, placeholders, known, unknown };
}

/**
 * Extract all placeholder occurrences from a pattern (including duplicates).
 *
 * This intentionally duplicates extraction logic from the parser because:
 * 1. parseTemplate() returns unique placeholders (uses Set internally)
 * 2. We need ALL occurrences to detect duplicate placeholder warnings
 * 3. Modifying the parser to track duplicates would complicate its API
 *
 * The simple regex approach here is sufficient since we only call this
 * after syntax validation passes.
 */
function getAllPlaceholderOccurrences(pattern: string): string[] {
  const occurrences: string[] = [];

  // Handle escaped braces by temporarily replacing them with markers
  const escapedPattern = pattern
    .replace(/\{\{/g, '<<<OPEN_BRACE>>>')
    .replace(/\}\}/g, '<<<CLOSE_BRACE>>>');

  const regex = /\{([^{}]+)\}/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(escapedPattern)) !== null) {
    const placeholderName = (match[1] ?? '').trim();
    if (placeholderName) {
      occurrences.push(placeholderName);
    }
  }

  return occurrences;
}

/**
 * Generate warnings for potential issues.
 * These are valid templates that may have problems.
 */
function generateWarnings(
  pattern: string,
  placeholders: string[],
  known: string[]
): ValidationIssue[] {
  const warnings: ValidationIssue[] = [];

  // Check for duplicate placeholders by scanning all occurrences
  const allOccurrences = getAllPlaceholderOccurrences(pattern);
  const seen = new Set<string>();
  const warned = new Set<string>();

  for (const placeholder of allOccurrences) {
    if (seen.has(placeholder) && !warned.has(placeholder)) {
      warnings.push({
        severity: 'warning',
        type: 'duplicate_placeholder',
        message: `Placeholder {${placeholder}} appears multiple times`,
        placeholder,
      });
      warned.add(placeholder);
    }
    seen.add(placeholder);
  }

  // Check if template might produce empty result
  if (placeholders.length > 0 && known.length === 0) {
    warnings.push({
      severity: 'warning',
      type: 'potentially_empty',
      message:
        'Template contains only unknown placeholders and may produce empty results',
    });
  }

  // Check if {ext} is missing and pattern doesn't have literal extension
  if (!placeholders.includes('ext') && !/\.[a-zA-Z0-9]+$/.test(pattern)) {
    warnings.push({
      severity: 'info',
      type: 'missing_extension',
      message:
        'Template does not include file extension. Consider adding {ext} or a literal extension.',
    });
  }

  // Check for metadata placeholders without date fallback
  const metadataOnly = known.filter((p) =>
    ['title', 'author', 'camera', 'location'].includes(p)
  );
  const hasDateFallback = known.some((p) =>
    ['year', 'month', 'day', 'date', 'original'].includes(p)
  );

  if (metadataOnly.length > 0 && !hasDateFallback) {
    warnings.push({
      severity: 'info',
      type: 'suggestion',
      message:
        'Metadata placeholders may be empty for some files. Consider adding {date} or {original} as fallback.',
    });
  }

  return warnings;
}

/**
 * Validate a template pattern.
 *
 * Performs both syntax and semantic validation, returning a structured
 * result with all issues, warnings, and placeholder information.
 *
 * @param pattern - The template pattern to validate
 * @returns ValidationResult with validation status and any issues
 *
 * @example
 * ```typescript
 * const result = validateTemplate('{year}-{month}-{title}');
 * if (result.valid) {
 *   console.log('Valid placeholders:', result.knownPlaceholders);
 * } else {
 *   console.log('Errors:', result.issues.filter(i => i.severity === 'error'));
 * }
 * ```
 */
export function validateTemplate(pattern: string): ValidationResult {
  // Syntax validation
  const syntaxIssues = validateSyntax(pattern);

  // If syntax is invalid, return early with errors
  if (syntaxIssues.some((i) => i.severity === 'error')) {
    return {
      valid: false,
      pattern,
      issues: syntaxIssues,
      placeholders: [],
      knownPlaceholders: [],
      unknownPlaceholders: [],
    };
  }

  // Semantic validation
  const {
    issues: semanticIssues,
    placeholders,
    known,
    unknown,
  } = validateSemantics(pattern);

  // Generate warnings
  const warnings = generateWarnings(pattern, placeholders, known);

  // Combine all issues
  const allIssues = [...syntaxIssues, ...semanticIssues, ...warnings];

  // Valid if no errors (warnings are acceptable)
  const valid = !allIssues.some((i) => i.severity === 'error');

  return {
    valid,
    pattern,
    issues: allIssues,
    placeholders,
    knownPlaceholders: known,
    unknownPlaceholders: unknown,
  };
}

/**
 * Quick validation check (returns boolean only).
 *
 * Use validateTemplate() when you need detailed error information.
 *
 * @param pattern - The template pattern to validate
 * @returns True if the template is valid
 */
export function isValidTemplate(pattern: string): boolean {
  return validateTemplate(pattern).valid;
}

/**
 * Get only errors from validation.
 *
 * @param pattern - The template pattern to validate
 * @returns Array of error-severity issues
 */
export function getTemplateErrors(pattern: string): ValidationIssue[] {
  return validateTemplate(pattern).issues.filter((i) => i.severity === 'error');
}

/**
 * Get only warnings from validation.
 *
 * @param pattern - The template pattern to validate
 * @returns Array of warning-severity issues
 */
export function getTemplateWarnings(pattern: string): ValidationIssue[] {
  return validateTemplate(pattern).issues.filter(
    (i) => i.severity === 'warning'
  );
}

/**
 * Get template placeholder information without full validation.
 *
 * Useful when you just need to know what placeholders are in a template
 * without caring about validation errors/warnings.
 *
 * @param pattern - The template pattern to analyze
 * @returns Object with placeholder arrays, or null if pattern has syntax errors
 */
export function getTemplateInfo(pattern: string): {
  placeholders: string[];
  knownPlaceholders: string[];
  unknownPlaceholders: string[];
} | null {
  const result = validateTemplate(pattern);

  // If syntax errors prevent parsing, return null
  if (
    result.issues.some(
      (i) =>
        i.severity === 'error' &&
        (i.type === 'unclosed_brace' ||
          i.type === 'empty_placeholder' ||
          i.type === 'unexpected_close_brace')
    )
  ) {
    return null;
  }

  return {
    placeholders: result.placeholders,
    knownPlaceholders: result.knownPlaceholders,
    unknownPlaceholders: result.unknownPlaceholders,
  };
}

/**
 * Format validation result as human-readable string.
 *
 * @param result - The validation result to format
 * @returns Formatted string with validation status and issues
 */
export function formatValidationResult(result: ValidationResult): string {
  const lines: string[] = [];

  if (result.valid) {
    lines.push(`Template is valid: "${result.pattern}"`);
    if (result.knownPlaceholders.length > 0) {
      lines.push(
        `Placeholders: ${result.knownPlaceholders.map((p) => `{${p}}`).join(', ')}`
      );
    }
  } else {
    lines.push(`Template is invalid: "${result.pattern}"`);
  }

  // Group issues by severity
  const errors = result.issues.filter((i) => i.severity === 'error');
  const warnings = result.issues.filter((i) => i.severity === 'warning');
  const infos = result.issues.filter((i) => i.severity === 'info');

  if (errors.length > 0) {
    lines.push('\nErrors:');
    for (const error of errors) {
      lines.push(`  - ${error.message}`);
    }
  }

  if (warnings.length > 0) {
    lines.push('\nWarnings:');
    for (const warning of warnings) {
      lines.push(`  - ${warning.message}`);
    }
  }

  if (infos.length > 0) {
    lines.push('\nSuggestions:');
    for (const info of infos) {
      lines.push(`  - ${info.message}`);
    }
  }

  return lines.join('\n');
}
