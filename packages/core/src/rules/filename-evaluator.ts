/**
 * @fileoverview Filename rule evaluator - Story 7.2
 *
 * Evaluates filename pattern rules against files.
 */

import type { Result } from '../types/result.js';
import { ok, err } from '../types/result.js';
import type { FileInfo } from '../types/file-info.js';
import type {
  FilenamePatternRule,
  FilenameRuleEvaluationResult,
} from '../types/filename-rule.js';
import {
  FilenameRuleErrorCode,
  createFilenameRuleError,
  type FilenameRuleError,
} from '../types/filename-rule.js';
import { matchGlob, type GlobMatchOptions } from './glob-matcher.js';
import { isValidGlobPattern } from './pattern-validator.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Error type for filename rule evaluation.
 */
export interface FilenameEvaluatorError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Result when finding matching rules.
 */
export interface MatchedFilenameRule {
  /** The matching rule */
  rule: FilenamePatternRule;
  /** Evaluation result details */
  result: FilenameRuleEvaluationResult;
}

// =============================================================================
// Single Rule Evaluation
// =============================================================================

/**
 * Evaluate a single filename pattern rule against a file.
 *
 * @param rule - The filename pattern rule to evaluate
 * @param fileInfo - File information to match against
 * @returns Result with evaluation result or error
 *
 * @example
 * const result = evaluateFilenameRule(rule, fileInfo);
 * if (result.ok && result.data.matches) {
 *   console.log('File matches rule:', rule.name);
 * }
 */
export function evaluateFilenameRule(
  rule: FilenamePatternRule,
  fileInfo: FileInfo
): Result<FilenameRuleEvaluationResult, FilenameRuleError> {
  // Skip disabled rules
  if (!rule.enabled) {
    return ok({
      matches: false,
      pattern: rule.pattern,
      filename: fileInfo.fullName,
    });
  }

  // Validate pattern before evaluation
  if (!isValidGlobPattern(rule.pattern)) {
    return err(
      createFilenameRuleError(
        FilenameRuleErrorCode.INVALID_PATTERN,
        `Invalid pattern in rule "${rule.name}": ${rule.pattern}`,
        { ruleId: rule.id, pattern: rule.pattern }
      )
    );
  }

  // Configure matching options
  const options: GlobMatchOptions = {
    caseSensitive: rule.caseSensitive,
  };

  // Match against the full filename (name + extension)
  const matchResult = matchGlob(rule.pattern, fileInfo.fullName, options);

  return ok({
    matches: matchResult.matches,
    pattern: rule.pattern,
    filename: fileInfo.fullName,
  });
}

// =============================================================================
// Multiple Rule Evaluation
// =============================================================================

/**
 * Find the first matching filename rule for a file.
 * Rules are evaluated in priority order (higher priority first).
 *
 * @param rules - Array of filename pattern rules
 * @param fileInfo - File information to match against
 * @returns The first matching rule, or null if none match
 *
 * @example
 * const match = findMatchingFilenameRule(rules, fileInfo);
 * if (match) {
 *   console.log('File matched rule:', match.rule.name);
 * }
 */
export function findMatchingFilenameRule(
  rules: FilenamePatternRule[],
  fileInfo: FileInfo
): MatchedFilenameRule | null {
  // Sort by priority (higher first)
  const sortedRules = [...rules].sort((a, b) => b.priority - a.priority);

  for (const rule of sortedRules) {
    const result = evaluateFilenameRule(rule, fileInfo);

    if (result.ok && result.data.matches) {
      return {
        rule,
        result: result.data,
      };
    }
  }

  return null;
}

/**
 * Find all matching filename rules for a file.
 * Rules are returned in priority order (higher priority first).
 *
 * @param rules - Array of filename pattern rules
 * @param fileInfo - File information to match against
 * @returns Array of all matching rules with their results
 *
 * @example
 * const matches = findAllMatchingFilenameRules(rules, fileInfo);
 * console.log(`File matches ${matches.length} rules`);
 */
export function findAllMatchingFilenameRules(
  rules: FilenamePatternRule[],
  fileInfo: FileInfo
): MatchedFilenameRule[] {
  const matches: MatchedFilenameRule[] = [];

  // Sort by priority (higher first)
  const sortedRules = [...rules].sort((a, b) => b.priority - a.priority);

  for (const rule of sortedRules) {
    const result = evaluateFilenameRule(rule, fileInfo);

    if (result.ok && result.data.matches) {
      matches.push({
        rule,
        result: result.data,
      });
    }
  }

  return matches;
}

/**
 * Evaluate all filename rules against a file and return detailed results.
 *
 * @param rules - Array of filename pattern rules
 * @param fileInfo - File information to match against
 * @returns Map of rule ID to evaluation result
 *
 * @example
 * const results = evaluateAllFilenameRules(rules, fileInfo);
 * for (const [ruleId, result] of results) {
 *   if (result.ok) {
 *     console.log(ruleId, result.data.matches ? 'matched' : 'no match');
 *   }
 * }
 */
export function evaluateAllFilenameRules(
  rules: FilenamePatternRule[],
  fileInfo: FileInfo
): Map<string, Result<FilenameRuleEvaluationResult, FilenameRuleError>> {
  const results = new Map<string, Result<FilenameRuleEvaluationResult, FilenameRuleError>>();

  for (const rule of rules) {
    const result = evaluateFilenameRule(rule, fileInfo);
    results.set(rule.id, result);
  }

  return results;
}

// =============================================================================
// Batch Evaluation
// =============================================================================

/**
 * Result of batch evaluation for a single file.
 */
export interface FileBatchResult {
  /** The file that was evaluated */
  fileInfo: FileInfo;
  /** The first matching rule (if any) */
  matchedRule: FilenamePatternRule | null;
  /** Template ID from the matched rule (if any) */
  templateId: string | null;
}

/**
 * Evaluate filename rules against multiple files.
 * Returns the first matching rule for each file.
 *
 * @param rules - Array of filename pattern rules
 * @param files - Array of file information
 * @returns Array of results, one per file
 *
 * @example
 * const results = evaluateFilenameRulesForFiles(rules, files);
 * const filesWithTemplates = results.filter(r => r.templateId !== null);
 */
export function evaluateFilenameRulesForFiles(
  rules: FilenamePatternRule[],
  files: FileInfo[]
): FileBatchResult[] {
  return files.map((fileInfo) => {
    const match = findMatchingFilenameRule(rules, fileInfo);

    return {
      fileInfo,
      matchedRule: match?.rule ?? null,
      templateId: match?.rule.templateId ?? null,
    };
  });
}
