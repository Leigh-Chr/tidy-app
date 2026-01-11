/**
 * @fileoverview Priority preview module - Story 7.4
 *
 * Provides preview functionality to see which rule would win for a given file
 * and why, including priority tie detection.
 */

import type { AppConfig } from '../config/schema.js';
import type { FileInfo } from '../types/file-info.js';
import type { UnifiedMetadata } from '../types/unified-metadata.js';
import type { MetadataPatternRule } from '../types/rule.js';
import type { FilenamePatternRule } from '../types/filename-rule.js';
import { evaluateRule } from './evaluator.js';
import { evaluateFilenameRule } from './filename-evaluator.js';
import { getUnifiedRulePriorities, type UnifiedRule } from './unified-priority.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Skip reason for rules that won't be evaluated.
 */
export type SkipReason = 'disabled' | 'lower-priority-mode' | 'already-matched';

/**
 * An entry in the evaluation order showing a rule and its evaluation status.
 */
export interface EvaluationOrderEntry {
  /** The unified rule */
  rule: UnifiedRule;
  /** Whether this rule will be evaluated (not skipped) */
  willEvaluate: boolean;
  /** Reason if the rule is skipped */
  skipReason?: SkipReason;
  /** Whether the rule matched the file (only set if willEvaluate is true) */
  matched?: boolean;
}

/**
 * A group of rules that share the same priority value.
 */
export interface PriorityTie {
  /** The shared priority value */
  priority: number;
  /** Rules sharing this priority */
  rules: UnifiedRule[];
}

/**
 * Result of previewing rule priority for a file.
 */
export interface RulePriorityPreview {
  /** Rules in evaluation order with their status */
  evaluationOrder: EvaluationOrderEntry[];
  /** The winning rule (if any matched) */
  winningRule: UnifiedRule | null;
  /** Rules that matched but lost due to priority */
  matchedButLost: UnifiedRule[];
  /** Priority ties detected across all rules */
  priorityTies: PriorityTie[];
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Evaluate whether a unified rule matches the file.
 */
function evaluateUnifiedRule(
  rule: UnifiedRule,
  fileInfo: FileInfo,
  metadata: UnifiedMetadata
): boolean {
  if (rule.type === 'metadata') {
    const result = evaluateRule(rule.rule as MetadataPatternRule, metadata);
    return result.ok && result.data.matches;
  } else {
    const result = evaluateFilenameRule(rule.rule as FilenamePatternRule, fileInfo);
    return result.ok && result.data.matches;
  }
}

// =============================================================================
// Main Functions
// =============================================================================

/**
 * Detect priority ties across all rules in the config.
 *
 * @param config - Application configuration containing rules
 * @returns Array of priority ties (groups of rules with same priority)
 *
 * @example
 * ```ts
 * const ties = detectPriorityTies(config);
 * if (ties.length > 0) {
 *   console.warn('Priority ties detected:', ties);
 * }
 * ```
 */
export function detectPriorityTies(config: AppConfig): PriorityTie[] {
  const allRules = getUnifiedRulePriorities(config);

  // Group rules by priority
  const priorityGroups = new Map<number, UnifiedRule[]>();
  for (const rule of allRules) {
    const existing = priorityGroups.get(rule.priority) || [];
    existing.push(rule);
    priorityGroups.set(rule.priority, existing);
  }

  // Find groups with more than one rule (ties)
  const ties: PriorityTie[] = [];
  for (const [priority, rules] of priorityGroups) {
    if (rules.length > 1) {
      ties.push({ priority, rules });
    }
  }

  // Sort by priority descending (higher priority ties are more important)
  return ties.sort((a, b) => b.priority - a.priority);
}

/**
 * Preview which rule would win for a file based on the configured rules.
 *
 * This function evaluates all rules against the file and shows:
 * - The evaluation order based on priority mode
 * - Which rules would be evaluated vs skipped (and why)
 * - Which rule would win
 * - Which rules matched but lost to higher priority
 * - Any priority ties that exist
 *
 * @param fileInfo - File information for the file being processed
 * @param metadata - Unified metadata for the file
 * @param config - Application configuration containing rules and preferences
 * @returns Preview result showing evaluation details
 *
 * @example
 * ```ts
 * const preview = previewRulePriority(fileInfo, metadata, config);
 *
 * if (preview.winningRule) {
 *   console.log(`Rule "${preview.winningRule.name}" would apply`);
 * }
 *
 * if (preview.priorityTies.length > 0) {
 *   console.warn('Warning: Priority ties exist');
 * }
 * ```
 */
export function previewRulePriority(
  fileInfo: FileInfo,
  metadata: UnifiedMetadata,
  config: AppConfig
): RulePriorityPreview {
  // Get all rules in priority order
  const orderedRules = getUnifiedRulePriorities(config);

  // Detect priority ties
  const priorityTies = detectPriorityTies(config);

  // Build evaluation order
  const evaluationOrder: EvaluationOrderEntry[] = [];
  const matchedRules: UnifiedRule[] = [];
  let winningRule: UnifiedRule | null = null;

  for (const rule of orderedRules) {
    // Check if disabled
    if (!rule.enabled) {
      evaluationOrder.push({
        rule,
        willEvaluate: false,
        skipReason: 'disabled',
      });
      continue;
    }

    // Check if we already have a winner
    if (winningRule !== null) {
      // Still evaluate to see if it would have matched
      const matched = evaluateUnifiedRule(rule, fileInfo, metadata);
      evaluationOrder.push({
        rule,
        willEvaluate: true,
        matched,
      });
      if (matched) {
        matchedRules.push(rule);
      }
      continue;
    }

    // Evaluate the rule
    const matched = evaluateUnifiedRule(rule, fileInfo, metadata);
    evaluationOrder.push({
      rule,
      willEvaluate: true,
      matched,
    });

    if (matched) {
      matchedRules.push(rule);
      winningRule = rule;
    }
  }

  // All matched rules except the winner go to matchedButLost
  const matchedButLost = matchedRules.filter((r) => r.id !== winningRule?.id);

  return {
    evaluationOrder,
    winningRule,
    matchedButLost,
    priorityTies,
  };
}
