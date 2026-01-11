/**
 * @fileoverview Template resolver for rule-based template selection - Story 7.3
 *
 * Resolves which template to use for a file based on matching rules.
 * Supports both metadata pattern rules and filename pattern rules with
 * configurable priority modes.
 */

import type { MetadataPatternRule } from '../types/rule.js';
import type { FilenamePatternRule } from '../types/filename-rule.js';
import type { FileInfo } from '../types/file-info.js';
import type { UnifiedMetadata } from '../types/unified-metadata.js';
import type { Template } from '../config/schema.js';
import { evaluateRule } from './evaluator.js';
import { evaluateFilenameRule } from './filename-evaluator.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Priority mode for rule evaluation.
 * - 'combined': All rules sorted by priority regardless of type
 * - 'metadata-first': Metadata rules evaluated before filename rules
 * - 'filename-first': Filename rules evaluated before metadata rules
 */
export type RulePriorityMode = 'combined' | 'metadata-first' | 'filename-first';

/**
 * Information about a matched rule.
 */
export interface RuleMatch {
  /** ID of the matched rule */
  ruleId: string;
  /** Name of the matched rule */
  ruleName: string;
  /** Type of rule that matched */
  ruleType: 'metadata' | 'filename';
  /** ID of the template assigned to the rule */
  templateId: string;
  /** Priority of the matched rule */
  priority: number;
  /** ID of the folder structure assigned to the rule (Story 8.2) */
  folderStructureId?: string;
}

/**
 * Options for template resolution.
 */
export interface TemplateResolverOptions {
  /**
   * How to prioritize rule types.
   * - 'combined': All rules sorted by priority regardless of type (default)
   * - 'metadata-first': Metadata rules evaluated before filename rules
   * - 'filename-first': Filename rules evaluated before metadata rules
   */
  priorityMode?: RulePriorityMode;
}

/**
 * Result of template resolution.
 */
export interface TemplateResolutionResult {
  /** ID of the resolved template, or null if no match */
  templateId: string | null;
  /** Information about the matched rule, or null if no match */
  matchedRule: RuleMatch | null;
  /** Reason for fallback if no template was resolved */
  fallbackReason?: 'no-match' | 'template-not-found' | 'rule-disabled';
  /** ID of the folder structure from the matched rule (Story 8.2) */
  folderStructureId?: string;
}

// =============================================================================
// Internal Types for Rule Evaluation
// =============================================================================

/**
 * A rule candidate for evaluation (either metadata or filename rule).
 */
interface RuleCandidate {
  ruleType: 'metadata' | 'filename';
  rule: MetadataPatternRule | FilenamePatternRule;
  priority: number;
}

// =============================================================================
// Main Function
// =============================================================================

/**
 * Resolve which template to use for a file based on matching rules.
 *
 * This function evaluates both metadata pattern rules and filename pattern rules
 * to find the highest priority matching rule, then returns its assigned template.
 *
 * @param metadataRules - Array of metadata pattern rules to evaluate
 * @param filenameRules - Array of filename pattern rules to evaluate
 * @param fileInfo - File information for the file being processed
 * @param metadata - Unified metadata for the file
 * @param templates - Available templates for validation
 * @param options - Resolution options (priority mode)
 * @returns Resolution result with template ID and matched rule info
 *
 * @example
 * ```ts
 * const result = resolveTemplateForRule(
 *   config.rules,
 *   config.filenameRules,
 *   fileInfo,
 *   metadata,
 *   config.templates
 * );
 *
 * if (result.templateId) {
 *   const template = templates.find(t => t.id === result.templateId);
 *   // Use template for rename preview
 * }
 * ```
 */
export function resolveTemplateForRule(
  metadataRules: MetadataPatternRule[],
  filenameRules: FilenamePatternRule[],
  fileInfo: FileInfo,
  metadata: UnifiedMetadata,
  templates: Template[],
  options: TemplateResolverOptions = {}
): TemplateResolutionResult {
  const { priorityMode = 'combined' } = options;

  // Create a set of valid template IDs for fast lookup
  const validTemplateIds = new Set(templates.map((t) => t.id));

  // Get matching rules based on priority mode
  const matchingRules = findMatchingRulesInOrder(
    metadataRules,
    filenameRules,
    fileInfo,
    metadata,
    priorityMode
  );

  // No rules matched
  if (matchingRules.length === 0) {
    return {
      templateId: null,
      matchedRule: null,
      fallbackReason: 'no-match',
    };
  }

  // Find the first matching rule with a valid template
  for (const match of matchingRules) {
    if (validTemplateIds.has(match.templateId)) {
      return {
        templateId: match.templateId,
        matchedRule: match,
        folderStructureId: match.folderStructureId,
      };
    }
  }

  // Rules matched but no valid templates found
  return {
    templateId: null,
    matchedRule: null,
    fallbackReason: 'template-not-found',
  };
}

// =============================================================================
// Internal Functions
// =============================================================================

/**
 * Find all matching rules in the specified priority order.
 */
function findMatchingRulesInOrder(
  metadataRules: MetadataPatternRule[],
  filenameRules: FilenamePatternRule[],
  fileInfo: FileInfo,
  metadata: UnifiedMetadata,
  priorityMode: RulePriorityMode
): RuleMatch[] {
  switch (priorityMode) {
    case 'metadata-first':
      return findMatchingRulesMetadataFirst(metadataRules, filenameRules, fileInfo, metadata);

    case 'filename-first':
      return findMatchingRulesFilenameFirst(metadataRules, filenameRules, fileInfo, metadata);

    case 'combined':
    default:
      return findMatchingRulesCombined(metadataRules, filenameRules, fileInfo, metadata);
  }
}

/**
 * Find matching rules with combined priority (both types sorted together).
 */
function findMatchingRulesCombined(
  metadataRules: MetadataPatternRule[],
  filenameRules: FilenamePatternRule[],
  fileInfo: FileInfo,
  metadata: UnifiedMetadata
): RuleMatch[] {
  // Create candidates from both rule types
  const candidates: RuleCandidate[] = [
    ...metadataRules.filter((r) => r.enabled).map((rule) => ({
      ruleType: 'metadata' as const,
      rule,
      priority: rule.priority,
    })),
    ...filenameRules.filter((r) => r.enabled).map((rule) => ({
      ruleType: 'filename' as const,
      rule,
      priority: rule.priority,
    })),
  ];

  // Sort by priority descending (higher first)
  candidates.sort((a, b) => b.priority - a.priority);

  // Evaluate candidates and collect matches
  return evaluateCandidates(candidates, fileInfo, metadata);
}

/**
 * Find matching rules with metadata rules evaluated first.
 */
function findMatchingRulesMetadataFirst(
  metadataRules: MetadataPatternRule[],
  filenameRules: FilenamePatternRule[],
  fileInfo: FileInfo,
  metadata: UnifiedMetadata
): RuleMatch[] {
  // Evaluate metadata rules first (sorted by priority)
  const metadataMatches = evaluateMetadataRules(metadataRules, metadata);

  // If we have metadata matches, return them
  if (metadataMatches.length > 0) {
    return metadataMatches;
  }

  // Fall back to filename rules
  return evaluateFilenameRules(filenameRules, fileInfo);
}

/**
 * Find matching rules with filename rules evaluated first.
 */
function findMatchingRulesFilenameFirst(
  metadataRules: MetadataPatternRule[],
  filenameRules: FilenamePatternRule[],
  fileInfo: FileInfo,
  metadata: UnifiedMetadata
): RuleMatch[] {
  // Evaluate filename rules first (sorted by priority)
  const filenameMatches = evaluateFilenameRules(filenameRules, fileInfo);

  // If we have filename matches, return them
  if (filenameMatches.length > 0) {
    return filenameMatches;
  }

  // Fall back to metadata rules
  return evaluateMetadataRules(metadataRules, metadata);
}

/**
 * Evaluate candidates and return matches.
 */
function evaluateCandidates(
  candidates: RuleCandidate[],
  fileInfo: FileInfo,
  metadata: UnifiedMetadata
): RuleMatch[] {
  const matches: RuleMatch[] = [];

  for (const candidate of candidates) {
    if (candidate.ruleType === 'metadata') {
      const rule = candidate.rule as MetadataPatternRule;
      const result = evaluateRule(rule, metadata);

      if (result.ok && result.data.matches) {
        matches.push({
          ruleId: rule.id,
          ruleName: rule.name,
          ruleType: 'metadata',
          templateId: rule.templateId,
          priority: rule.priority,
          folderStructureId: rule.folderStructureId,
        });
      }
    } else {
      const rule = candidate.rule as FilenamePatternRule;
      const result = evaluateFilenameRule(rule, fileInfo);

      if (result.ok && result.data.matches) {
        matches.push({
          ruleId: rule.id,
          ruleName: rule.name,
          ruleType: 'filename',
          templateId: rule.templateId,
          priority: rule.priority,
          folderStructureId: rule.folderStructureId,
        });
      }
    }
  }

  return matches;
}

/**
 * Evaluate metadata rules and return matches sorted by priority.
 */
function evaluateMetadataRules(
  rules: MetadataPatternRule[],
  metadata: UnifiedMetadata
): RuleMatch[] {
  const matches: RuleMatch[] = [];

  // Sort by priority descending
  const sortedRules = [...rules].filter((r) => r.enabled).sort((a, b) => b.priority - a.priority);

  for (const rule of sortedRules) {
    const result = evaluateRule(rule, metadata);

    if (result.ok && result.data.matches) {
      matches.push({
        ruleId: rule.id,
        ruleName: rule.name,
        ruleType: 'metadata',
        templateId: rule.templateId,
        priority: rule.priority,
        folderStructureId: rule.folderStructureId,
      });
    }
  }

  return matches;
}

/**
 * Evaluate filename rules and return matches sorted by priority.
 */
function evaluateFilenameRules(
  rules: FilenamePatternRule[],
  fileInfo: FileInfo
): RuleMatch[] {
  const matches: RuleMatch[] = [];

  // Sort by priority descending
  const sortedRules = [...rules].filter((r) => r.enabled).sort((a, b) => b.priority - a.priority);

  for (const rule of sortedRules) {
    const result = evaluateFilenameRule(rule, fileInfo);

    if (result.ok && result.data.matches) {
      matches.push({
        ruleId: rule.id,
        ruleName: rule.name,
        ruleType: 'filename',
        templateId: rule.templateId,
        priority: rule.priority,
        folderStructureId: rule.folderStructureId,
      });
    }
  }

  return matches;
}
