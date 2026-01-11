/**
 * @fileoverview Filename pattern rule type definitions - Story 7.2
 *
 * Defines schemas and types for rules that match files based on filename patterns
 * using glob-style syntax (*, ?, [], {}).
 */

import { z } from 'zod';

// =============================================================================
// Pattern Validation Result
// =============================================================================

/**
 * Result of validating a glob pattern.
 */
export interface PatternValidationResult {
  /** Whether the pattern is valid */
  valid: boolean;
  /** Error message if invalid */
  error?: string;
  /** Specific location of the error in the pattern */
  position?: number;
}

/**
 * Validate a glob pattern for syntax errors.
 *
 * Checks for:
 * - Empty or whitespace-only patterns
 * - Unclosed brackets []
 * - Unclosed braces {}
 * - Empty brace alternatives
 * - Invalid escape sequences
 */
export function validateGlobPattern(pattern: string): PatternValidationResult {
  // Check for empty or whitespace-only patterns
  if (!pattern || pattern.trim().length === 0) {
    return {
      valid: false,
      error: 'Pattern cannot be empty or whitespace-only',
    };
  }

  // Track bracket/brace nesting
  let bracketDepth = 0;
  let braceDepth = 0;
  let bracketStart = -1;
  let braceStart = -1;
  let i = 0;

  while (i < pattern.length) {
    const char = pattern[i];
    const nextChar = pattern[i + 1];

    // Handle escape sequences
    if (char === '\\' && nextChar !== undefined) {
      // Skip the escaped character
      i += 2;
      continue;
    }

    switch (char) {
      case '[':
        if (bracketDepth === 0) {
          bracketStart = i;
        }
        bracketDepth++;
        break;

      case ']':
        if (bracketDepth > 0) {
          bracketDepth--;
          // Check for empty bracket class []
          if (bracketStart === i - 1) {
            return {
              valid: false,
              error: 'Empty character class [] is not allowed',
              position: bracketStart,
            };
          }
        }
        break;

      case '{':
        if (braceDepth === 0) {
          braceStart = i;
        }
        braceDepth++;
        break;

      case '}':
        if (braceDepth > 0) {
          braceDepth--;
        }
        break;

      case ',':
        // Check for empty alternatives in braces {a,,b}
        if (braceDepth > 0) {
          const prevChar = pattern[i - 1];
          if (prevChar === '{' || prevChar === ',') {
            return {
              valid: false,
              error: 'Empty alternative in brace expansion is not allowed',
              position: i,
            };
          }
        }
        break;
    }

    i++;
  }

  // Check for unclosed brackets
  if (bracketDepth > 0) {
    return {
      valid: false,
      error: 'Unclosed character class [',
      position: bracketStart,
    };
  }

  // Check for unclosed braces
  if (braceDepth > 0) {
    return {
      valid: false,
      error: 'Unclosed brace expansion {',
      position: braceStart,
    };
  }

  // Check for empty brace content {,}
  const emptyBraceMatch = pattern.match(/\{,\}/);
  if (emptyBraceMatch) {
    return {
      valid: false,
      error: 'Empty brace expansion {,} is not allowed',
      position: pattern.indexOf('{,}'),
    };
  }

  // Check for trailing comma in braces {a,b,}
  const trailingCommaMatch = pattern.match(/,\}/);
  if (trailingCommaMatch) {
    return {
      valid: false,
      error: 'Trailing comma in brace expansion is not allowed',
      position: pattern.indexOf(',}'),
    };
  }

  return { valid: true };
}

/**
 * Check if a pattern is valid.
 */
export function isValidGlobPattern(pattern: string): boolean {
  return validateGlobPattern(pattern).valid;
}

// =============================================================================
// Filename Pattern Rule Error Types
// =============================================================================

/**
 * Error codes for filename rule operations.
 */
export const FilenameRuleErrorCode = {
  /** Pattern syntax is invalid */
  INVALID_PATTERN: 'INVALID_PATTERN',
  /** Rule with given ID not found */
  RULE_NOT_FOUND: 'RULE_NOT_FOUND',
  /** A rule with this name already exists */
  DUPLICATE_RULE_NAME: 'DUPLICATE_RULE_NAME',
  /** Rule validation failed */
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  /** Template referenced by rule does not exist */
  TEMPLATE_NOT_FOUND: 'TEMPLATE_NOT_FOUND',
} as const;

export type FilenameRuleErrorCodeType =
  (typeof FilenameRuleErrorCode)[keyof typeof FilenameRuleErrorCode];

/**
 * Error type for filename rule operations.
 */
export interface FilenameRuleError {
  code: FilenameRuleErrorCodeType;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Create a FilenameRuleError instance.
 */
export function createFilenameRuleError(
  code: FilenameRuleErrorCodeType,
  message: string,
  details?: Record<string, unknown>
): FilenameRuleError {
  return { code, message, details };
}

// =============================================================================
// Filename Pattern Rule Schema
// =============================================================================

/**
 * Custom refinement for pattern validation in Zod schema.
 */
const patternValidation = z.string().min(1, 'Pattern is required').superRefine((pattern, ctx) => {
  const result = validateGlobPattern(pattern);
  if (!result.valid) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: result.error ?? 'Invalid pattern',
    });
  }
});

/**
 * A filename pattern rule for matching files by name.
 *
 * Uses glob-style patterns:
 * - `*` matches any characters (zero or more)
 * - `?` matches a single character
 * - `[abc]` matches any character in the set
 * - `[a-z]` matches any character in the range
 * - `[!abc]` matches any character NOT in the set
 * - `{a,b,c}` matches any of the alternatives
 */
export const filenamePatternRuleSchema = z.object({
  /** Unique identifier for the rule */
  id: z.string().uuid(),

  /** User-friendly name for the rule */
  name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or less'),

  /** Optional description of what this rule does */
  description: z.string().optional(),

  /** Glob-style pattern (e.g., "IMG_*.jpg", "*.{pdf,docx}") */
  pattern: patternValidation,

  /** Whether pattern matching is case-sensitive (default: false) */
  caseSensitive: z.boolean().default(false),

  /** ID of the template to apply when this rule matches */
  templateId: z.string().uuid(),

  /** Optional ID of the folder structure to apply when this rule matches (Story 8.2) */
  folderStructureId: z.string().uuid().optional(),

  /** Priority for rule ordering (higher = evaluated first) */
  priority: z.number().int().min(0).default(0),

  /** Whether the rule is enabled */
  enabled: z.boolean().default(true),

  /** When the rule was created */
  createdAt: z.string().datetime(),

  /** When the rule was last updated */
  updatedAt: z.string().datetime(),
});

export type FilenamePatternRule = z.infer<typeof filenamePatternRuleSchema>;

// =============================================================================
// Rule Creation/Update Input Types
// =============================================================================

/**
 * Input for creating a new filename pattern rule.
 * ID and timestamps are auto-generated.
 */
export const createFilenameRuleInputSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  pattern: patternValidation,
  caseSensitive: z.boolean().default(false),
  templateId: z.string().uuid(),
  folderStructureId: z.string().uuid().optional(),
  priority: z.number().int().min(0).default(0),
  enabled: z.boolean().default(true),
});

export type CreateFilenameRuleInput = z.infer<typeof createFilenameRuleInputSchema>;

/**
 * Input for updating an existing filename pattern rule.
 * All fields are optional - only provided fields will be updated.
 */
export const updateFilenameRuleInputSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().nullable().optional(),
  pattern: patternValidation.optional(),
  caseSensitive: z.boolean().optional(),
  templateId: z.string().uuid().optional(),
  folderStructureId: z.string().uuid().nullable().optional(),
  priority: z.number().int().min(0).optional(),
  enabled: z.boolean().optional(),
});

export type UpdateFilenameRuleInput = z.infer<typeof updateFilenameRuleInputSchema>;

// =============================================================================
// Filename Rule Evaluation Result
// =============================================================================

/**
 * Result of evaluating a filename pattern rule against a file.
 */
export const filenameRuleEvaluationResultSchema = z.object({
  /** Whether the rule matched */
  matches: z.boolean(),

  /** The pattern that was evaluated */
  pattern: z.string(),

  /** The filename that was tested */
  filename: z.string(),
});

export type FilenameRuleEvaluationResult = z.infer<typeof filenameRuleEvaluationResultSchema>;
