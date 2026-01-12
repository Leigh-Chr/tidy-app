/**
 * @fileoverview Condition evaluator for rule matching - Story 7.1
 *
 * Evaluates individual rule conditions against field values.
 * Supports: equals, contains, startsWith, endsWith, regex, exists, notExists
 */

import type { RuleCondition, RuleOperatorType } from '../types/rule.js';
import type { UnifiedMetadata } from '../types/unified-metadata.js';
import { resolveFieldPath, fieldExists } from './field-resolver.js';
import type { Result } from '../types/result.js';
import { ok, err } from '../types/result.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Result of evaluating a single condition.
 */
export interface ConditionEvaluationResult {
  /** Whether the condition matched */
  matched: boolean;
  /** The field path that was evaluated */
  fieldPath: string;
  /** The resolved field value (for debugging) */
  resolvedValue: string | null;
  /** The expected value from the condition */
  expectedValue: string | undefined;
  /** Error message if evaluation failed */
  error?: string;
}

/**
 * Error type for condition evaluation failures.
 */
export interface ConditionEvaluationError {
  code: 'INVALID_REGEX' | 'FIELD_NOT_FOUND' | 'EVALUATION_ERROR';
  message: string;
  fieldPath: string;
}

// =============================================================================
// Regex Cache for Performance (LRU with max size)
// =============================================================================

const REGEX_CACHE_MAX_SIZE = 1000;
const regexCache = new Map<string, RegExp>();

/**
 * Compile and cache a regex pattern using LRU eviction.
 * Returns null if the pattern is invalid.
 */
function compileRegex(pattern: string, caseSensitive: boolean): RegExp | null {
  const cacheKey = `${pattern}:${caseSensitive}`;

  if (regexCache.has(cacheKey)) {
    // Move to end for LRU (delete and re-add)
    const cached = regexCache.get(cacheKey)!;
    regexCache.delete(cacheKey);
    regexCache.set(cacheKey, cached);
    return cached;
  }

  try {
    const flags = caseSensitive ? '' : 'i';
    const regex = new RegExp(pattern, flags);

    // Evict oldest entries if at capacity
    if (regexCache.size >= REGEX_CACHE_MAX_SIZE) {
      // Map iterates in insertion order, so first key is oldest
      const oldestKey = regexCache.keys().next().value;
      if (oldestKey !== undefined) {
        regexCache.delete(oldestKey);
      }
    }

    regexCache.set(cacheKey, regex);
    return regex;
  } catch {
    return null;
  }
}

/**
 * Clear the regex cache (useful for testing).
 */
export function clearRegexCache(): void {
  regexCache.clear();
}

/**
 * Get current regex cache size (useful for testing/monitoring).
 */
export function getRegexCacheSize(): number {
  return regexCache.size;
}

// =============================================================================
// Operator Implementations
// =============================================================================

/**
 * Evaluate equals operator.
 */
function evaluateEquals(
  value: string,
  expected: string,
  caseSensitive: boolean
): boolean {
  if (caseSensitive) {
    return value === expected;
  }
  return value.toLowerCase() === expected.toLowerCase();
}

/**
 * Evaluate contains operator.
 */
function evaluateContains(
  value: string,
  expected: string,
  caseSensitive: boolean
): boolean {
  if (caseSensitive) {
    return value.includes(expected);
  }
  return value.toLowerCase().includes(expected.toLowerCase());
}

/**
 * Evaluate startsWith operator.
 */
function evaluateStartsWith(
  value: string,
  expected: string,
  caseSensitive: boolean
): boolean {
  if (caseSensitive) {
    return value.startsWith(expected);
  }
  return value.toLowerCase().startsWith(expected.toLowerCase());
}

/**
 * Evaluate endsWith operator.
 */
function evaluateEndsWith(
  value: string,
  expected: string,
  caseSensitive: boolean
): boolean {
  if (caseSensitive) {
    return value.endsWith(expected);
  }
  return value.toLowerCase().endsWith(expected.toLowerCase());
}

/**
 * Evaluate regex operator.
 * Returns Result to handle invalid regex patterns.
 */
function evaluateRegex(
  value: string,
  pattern: string,
  caseSensitive: boolean
): Result<boolean, string> {
  const regex = compileRegex(pattern, caseSensitive);

  if (regex === null) {
    return err(`Invalid regex pattern: ${pattern}`);
  }

  return ok(regex.test(value));
}

// =============================================================================
// Main Evaluator
// =============================================================================

/**
 * Evaluate a single condition against unified metadata.
 *
 * @param condition - The condition to evaluate
 * @param metadata - The unified metadata to evaluate against
 * @returns Result containing evaluation result or error
 *
 * @example
 * ```ts
 * const condition = { field: 'image.cameraMake', operator: 'contains', value: 'Apple' };
 * const result = evaluateCondition(condition, metadata);
 * if (result.ok && result.data.matched) {
 *   console.log('Condition matched!');
 * }
 * ```
 */
export function evaluateCondition(
  condition: RuleCondition,
  metadata: UnifiedMetadata
): Result<ConditionEvaluationResult, ConditionEvaluationError> {
  const { field, operator, value, caseSensitive = false } = condition;

  // Handle exists/notExists operators first (don't need value)
  if (operator === 'exists') {
    const exists = fieldExists(field, metadata);
    return ok({
      matched: exists,
      fieldPath: field,
      resolvedValue: exists ? 'exists' : null,
      expectedValue: undefined,
    });
  }

  if (operator === 'notExists') {
    const exists = fieldExists(field, metadata);
    return ok({
      matched: !exists,
      fieldPath: field,
      resolvedValue: exists ? 'exists' : null,
      expectedValue: undefined,
    });
  }

  // For other operators, resolve the field value
  const resolution = resolveFieldPath(field, metadata);

  // If field doesn't exist or has null value, no match
  if (!resolution.found || resolution.value === null) {
    return ok({
      matched: false,
      fieldPath: field,
      resolvedValue: null,
      expectedValue: value,
    });
  }

  const resolvedValue = resolution.value;
  const expectedValue = value ?? '';

  // Evaluate based on operator
  let matched: boolean;

  switch (operator as RuleOperatorType) {
    case 'equals':
      matched = evaluateEquals(resolvedValue, expectedValue, caseSensitive);
      break;

    case 'contains':
      matched = evaluateContains(resolvedValue, expectedValue, caseSensitive);
      break;

    case 'startsWith':
      matched = evaluateStartsWith(resolvedValue, expectedValue, caseSensitive);
      break;

    case 'endsWith':
      matched = evaluateEndsWith(resolvedValue, expectedValue, caseSensitive);
      break;

    case 'regex': {
      const regexResult = evaluateRegex(resolvedValue, expectedValue, caseSensitive);
      if (!regexResult.ok) {
        return err({
          code: 'INVALID_REGEX',
          message: regexResult.error,
          fieldPath: field,
        });
      }
      matched = regexResult.data;
      break;
    }

    default:
      return err({
        code: 'EVALUATION_ERROR',
        message: `Unknown operator: ${operator}`,
        fieldPath: field,
      });
  }

  return ok({
    matched,
    fieldPath: field,
    resolvedValue,
    expectedValue: value,
  });
}

/**
 * Evaluate multiple conditions and return all results.
 * Useful for debugging to see which conditions matched/failed.
 *
 * @param conditions - Array of conditions to evaluate
 * @param metadata - The unified metadata to evaluate against
 * @returns Array of evaluation results (one per condition)
 */
export function evaluateConditions(
  conditions: RuleCondition[],
  metadata: UnifiedMetadata
): Result<ConditionEvaluationResult, ConditionEvaluationError>[] {
  return conditions.map((condition) => evaluateCondition(condition, metadata));
}
