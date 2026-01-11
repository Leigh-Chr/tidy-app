/**
 * @fileoverview Rule evaluator for complete rule matching - Story 7.1
 *
 * Evaluates complete rules (with multiple conditions and AND/OR logic)
 * against unified metadata.
 */

import type { MetadataPatternRule, RuleEvaluationResult } from '../types/rule.js';
import type { UnifiedMetadata } from '../types/unified-metadata.js';
import type { Result } from '../types/result.js';
import { ok, err } from '../types/result.js';
import { evaluateCondition, type ConditionEvaluationError } from './condition-evaluator.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Error from rule evaluation.
 */
export interface RuleEvaluatorError {
  code: 'CONDITION_ERROR' | 'RULE_DISABLED';
  message: string;
  ruleId: string;
  conditionErrors?: ConditionEvaluationError[];
}

// =============================================================================
// Rule Evaluation
// =============================================================================

/**
 * Evaluate a single rule against unified metadata.
 *
 * @param rule - The rule to evaluate
 * @param metadata - The unified metadata to evaluate against
 * @returns Result containing evaluation result or error
 *
 * @example
 * ```ts
 * const result = evaluateRule(rule, metadata);
 * if (result.ok && result.data.matches) {
 *   console.log('Rule matched! Apply template:', rule.templateId);
 * }
 * ```
 */
export function evaluateRule(
  rule: MetadataPatternRule,
  metadata: UnifiedMetadata
): Result<RuleEvaluationResult, RuleEvaluatorError> {
  // Check if rule is enabled
  if (!rule.enabled) {
    return err({
      code: 'RULE_DISABLED',
      message: `Rule "${rule.name}" is disabled`,
      ruleId: rule.id,
    });
  }

  const matchedConditions: string[] = [];
  const unmatchedConditions: string[] = [];
  const conditionErrors: ConditionEvaluationError[] = [];

  // Evaluate all conditions
  for (const condition of rule.conditions) {
    const result = evaluateCondition(condition, metadata);

    if (!result.ok) {
      conditionErrors.push(result.error);
      unmatchedConditions.push(condition.field);
      continue;
    }

    if (result.data.matched) {
      matchedConditions.push(condition.field);
    } else {
      unmatchedConditions.push(condition.field);
    }

    // Short-circuit for 'any' mode (OR logic)
    if (rule.matchMode === 'any' && result.data.matched) {
      return ok({
        matches: true,
        matchedConditions,
        unmatchedConditions,
      });
    }

    // Short-circuit for 'all' mode (AND logic)
    if (rule.matchMode === 'all' && !result.data.matched) {
      return ok({
        matches: false,
        matchedConditions,
        unmatchedConditions,
      });
    }
  }

  // If we had condition errors, report them
  if (conditionErrors.length > 0) {
    return err({
      code: 'CONDITION_ERROR',
      message: `${conditionErrors.length} condition(s) failed to evaluate`,
      ruleId: rule.id,
      conditionErrors,
    });
  }

  // Determine final result based on match mode
  let matches: boolean;

  if (rule.matchMode === 'all') {
    // All conditions must have matched (none in unmatchedConditions)
    matches = unmatchedConditions.length === 0 && matchedConditions.length > 0;
  } else {
    // At least one condition must have matched
    matches = matchedConditions.length > 0;
  }

  return ok({
    matches,
    matchedConditions,
    unmatchedConditions,
  });
}

/**
 * Evaluate multiple rules and return the first matching rule.
 * Rules are evaluated in priority order (highest first).
 *
 * @param rules - Array of rules to evaluate
 * @param metadata - The unified metadata to evaluate against
 * @returns The first matching rule, or null if none match
 */
export function findMatchingRule(
  rules: MetadataPatternRule[],
  metadata: UnifiedMetadata
): MetadataPatternRule | null {
  // Sort by priority descending (higher priority = evaluated first)
  const sortedRules = [...rules].sort((a, b) => b.priority - a.priority);

  for (const rule of sortedRules) {
    if (!rule.enabled) {
      continue;
    }

    const result = evaluateRule(rule, metadata);

    if (result.ok && result.data.matches) {
      return rule;
    }
  }

  return null;
}

/**
 * Evaluate all rules and return all matching rules.
 * Useful for debugging to see which rules would match.
 *
 * @param rules - Array of rules to evaluate
 * @param metadata - The unified metadata to evaluate against
 * @returns Array of matching rules with their evaluation results
 */
export function findAllMatchingRules(
  rules: MetadataPatternRule[],
  metadata: UnifiedMetadata
): Array<{ rule: MetadataPatternRule; result: RuleEvaluationResult }> {
  const matches: Array<{ rule: MetadataPatternRule; result: RuleEvaluationResult }> = [];

  for (const rule of rules) {
    if (!rule.enabled) {
      continue;
    }

    const result = evaluateRule(rule, metadata);

    if (result.ok && result.data.matches) {
      matches.push({ rule, result: result.data });
    }
  }

  // Sort by priority descending
  return matches.sort((a, b) => b.rule.priority - a.rule.priority);
}

/**
 * Evaluate all rules and return detailed results for each.
 * Useful for debugging or displaying rule evaluation status.
 *
 * @param rules - Array of rules to evaluate
 * @param metadata - The unified metadata to evaluate against
 * @returns Map of rule ID to evaluation result
 */
export function evaluateAllRules(
  rules: MetadataPatternRule[],
  metadata: UnifiedMetadata
): Map<string, Result<RuleEvaluationResult, RuleEvaluatorError>> {
  const results = new Map<string, Result<RuleEvaluationResult, RuleEvaluatorError>>();

  for (const rule of rules) {
    results.set(rule.id, evaluateRule(rule, metadata));
  }

  return results;
}
