/**
 * @fileoverview Unified rule priority module - Story 7.4
 *
 * Provides cross-type priority management for both metadata and filename rules.
 * Supports combined, metadata-first, and filename-first priority modes.
 */

import type { Result } from '../types/result.js';
import { ok, err } from '../types/result.js';
import type { MetadataPatternRule } from '../types/rule.js';
import type { FilenamePatternRule } from '../types/filename-rule.js';
import type { AppConfig } from '../config/schema.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Unified rule representation for cross-type priority management.
 */
export interface UnifiedRule {
  /** Unique identifier for the rule */
  id: string;
  /** User-friendly name for the rule */
  name: string;
  /** Type of rule: 'metadata' or 'filename' */
  type: 'metadata' | 'filename';
  /** Priority value (higher = evaluated first) */
  priority: number;
  /** Whether the rule is enabled */
  enabled: boolean;
  /** ID of the template to apply when this rule matches */
  templateId: string;
  /** Original rule reference for detailed access */
  rule: MetadataPatternRule | FilenamePatternRule;
}

/**
 * Error type for unified rule priority operations.
 */
export interface RulePriorityError {
  type: 'rule_not_found' | 'invalid_priority' | 'duplicate_ids' | 'mixed_missing_ids';
  message: string;
  details?: unknown;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Convert a metadata rule to a UnifiedRule.
 */
function toUnifiedMetadataRule(rule: MetadataPatternRule): UnifiedRule {
  return {
    id: rule.id,
    name: rule.name,
    type: 'metadata',
    priority: rule.priority,
    enabled: rule.enabled,
    templateId: rule.templateId,
    rule,
  };
}

/**
 * Convert a filename rule to a UnifiedRule.
 */
function toUnifiedFilenameRule(rule: FilenamePatternRule): UnifiedRule {
  return {
    id: rule.id,
    name: rule.name,
    type: 'filename',
    priority: rule.priority,
    enabled: rule.enabled,
    templateId: rule.templateId,
    rule,
  };
}

/**
 * Sort unified rules by priority (descending), then by createdAt (ascending - older first).
 */
function sortByPriorityThenCreatedAt(rules: UnifiedRule[]): UnifiedRule[] {
  return [...rules].sort((a, b) => {
    // Higher priority first
    if (b.priority !== a.priority) {
      return b.priority - a.priority;
    }
    // For ties, older rules first (earlier createdAt)
    const aCreatedAt = (a.rule as MetadataPatternRule | FilenamePatternRule).createdAt;
    const bCreatedAt = (b.rule as MetadataPatternRule | FilenamePatternRule).createdAt;
    return aCreatedAt.localeCompare(bCreatedAt);
  });
}

// =============================================================================
// Main Functions
// =============================================================================

/**
 * Get all rules in priority order based on the configured priority mode.
 *
 * @param config - Application configuration containing rules and preferences
 * @returns Array of unified rules sorted by effective priority
 *
 * @example
 * ```ts
 * const rules = getUnifiedRulePriorities(config);
 * // Returns all rules sorted by priority
 * console.log(rules.map(r => `${r.type}: ${r.name} (priority ${r.priority})`));
 * ```
 */
export function getUnifiedRulePriorities(config: AppConfig): UnifiedRule[] {
  const priorityMode = config.preferences.rulePriorityMode;

  // Convert all rules to unified format
  const metadataRules = config.rules.map(toUnifiedMetadataRule);
  const filenameRules = config.filenameRules.map(toUnifiedFilenameRule);

  switch (priorityMode) {
    case 'metadata-first': {
      // Metadata rules first (sorted by priority), then filename rules (sorted by priority)
      const sortedMetadata = sortByPriorityThenCreatedAt(metadataRules);
      const sortedFilename = sortByPriorityThenCreatedAt(filenameRules);
      return [...sortedMetadata, ...sortedFilename];
    }

    case 'filename-first': {
      // Filename rules first (sorted by priority), then metadata rules (sorted by priority)
      const sortedFilename = sortByPriorityThenCreatedAt(filenameRules);
      const sortedMetadata = sortByPriorityThenCreatedAt(metadataRules);
      return [...sortedFilename, ...sortedMetadata];
    }

    case 'combined':
    default: {
      // All rules mixed together, sorted by priority then createdAt
      const allRules = [...metadataRules, ...filenameRules];
      return sortByPriorityThenCreatedAt(allRules);
    }
  }
}

/**
 * Set the priority of a rule (metadata or filename).
 *
 * @param config - Application configuration
 * @param ruleId - ID of the rule to update
 * @param priority - New priority value (non-negative integer)
 * @returns Result with updated config, or error
 *
 * @example
 * ```ts
 * const result = setUnifiedRulePriority(config, 'rule-123', 10);
 * if (result.ok) {
 *   saveConfig(result.data);
 * }
 * ```
 */
export function setUnifiedRulePriority(
  config: AppConfig,
  ruleId: string,
  priority: number
): Result<AppConfig, RulePriorityError> {
  // Validate priority
  if (priority < 0 || !Number.isInteger(priority)) {
    return err({
      type: 'invalid_priority',
      message: 'Priority must be a non-negative integer',
      details: { priority },
    });
  }

  // Find the rule in metadata rules
  const metaIndex = config.rules.findIndex((r) => r.id === ruleId);
  if (metaIndex !== -1) {
    const existing = config.rules[metaIndex]!;

    // No change needed
    if (existing.priority === priority) {
      return ok(config);
    }

    const updatedRule: MetadataPatternRule = {
      ...existing,
      priority,
      updatedAt: new Date().toISOString(),
    };

    const newRules = [...config.rules];
    newRules[metaIndex] = updatedRule;

    return ok({
      ...config,
      rules: newRules,
    });
  }

  // Find the rule in filename rules
  const fileIndex = config.filenameRules.findIndex((r) => r.id === ruleId);
  if (fileIndex !== -1) {
    const existing = config.filenameRules[fileIndex]!;

    // No change needed
    if (existing.priority === priority) {
      return ok(config);
    }

    const updatedRule: FilenamePatternRule = {
      ...existing,
      priority,
      updatedAt: new Date().toISOString(),
    };

    const newFilenameRules = [...config.filenameRules];
    newFilenameRules[fileIndex] = updatedRule;

    return ok({
      ...config,
      filenameRules: newFilenameRules,
    });
  }

  // Rule not found
  return err({
    type: 'rule_not_found',
    message: `Rule with ID "${ruleId}" not found`,
    details: { ruleId },
  });
}

/**
 * Reorder rules by specifying IDs in desired order.
 * Rules will be assigned priorities based on their position (first = highest).
 *
 * **Important Behavior:**
 * - Rules in `orderedIds` are assigned priorities from `length-1` (first) to `0` (last)
 * - Rules NOT included in `orderedIds` are demoted to priority `-1`
 * - This ensures excluded rules won't interfere with the explicit ordering
 * - To preserve an existing rule's priority, include it in the `orderedIds` array
 *
 * @param config - Application configuration
 * @param orderedIds - Array of rule IDs in desired order (highest priority first)
 * @returns Result with updated config, or error
 *
 * @example
 * ```ts
 * // Drag-and-drop ready: pass IDs in visual order
 * const result = reorderUnifiedRules(config, ['file-1', 'meta-2', 'meta-1']);
 * // file-1 gets priority 2, meta-2 gets priority 1, meta-1 gets priority 0
 * // Any rules not in the list get priority -1
 * ```
 */
export function reorderUnifiedRules(
  config: AppConfig,
  orderedIds: string[]
): Result<AppConfig, RulePriorityError> {
  // Check for duplicate IDs
  const uniqueIds = new Set(orderedIds);
  if (uniqueIds.size !== orderedIds.length) {
    return err({
      type: 'duplicate_ids',
      message: 'Duplicate IDs in order array',
      details: { orderedIds },
    });
  }

  // Build a map of all rules
  const metaRuleMap = new Map(config.rules.map((r) => [r.id, r]));
  const fileRuleMap = new Map(config.filenameRules.map((r) => [r.id, r]));

  // Validate all IDs exist
  for (const id of orderedIds) {
    if (!metaRuleMap.has(id) && !fileRuleMap.has(id)) {
      return err({
        type: 'rule_not_found',
        message: `Rule with ID "${id}" not found`,
        details: { missingId: id },
      });
    }
  }

  const now = new Date().toISOString();
  const includedIds = new Set(orderedIds);

  // Assign priorities based on position
  // First item gets highest priority (length - 1)
  const idToPriority = new Map<string, number>();
  orderedIds.forEach((id, index) => {
    const newPriority = orderedIds.length - 1 - index;
    idToPriority.set(id, newPriority);
  });

  // Update metadata rules
  const newMetaRules = config.rules.map((rule) => {
    if (includedIds.has(rule.id)) {
      const newPriority = idToPriority.get(rule.id)!;
      if (rule.priority === newPriority) {
        return rule;
      }
      return {
        ...rule,
        priority: newPriority,
        updatedAt: now,
      };
    } else {
      // Not in list - demote to -1
      if (rule.priority === -1) {
        return rule;
      }
      return {
        ...rule,
        priority: -1,
        updatedAt: now,
      };
    }
  });

  // Update filename rules
  const newFilenameRules = config.filenameRules.map((rule) => {
    if (includedIds.has(rule.id)) {
      const newPriority = idToPriority.get(rule.id)!;
      if (rule.priority === newPriority) {
        return rule;
      }
      return {
        ...rule,
        priority: newPriority,
        updatedAt: now,
      };
    } else {
      // Not in list - demote to -1
      if (rule.priority === -1) {
        return rule;
      }
      return {
        ...rule,
        priority: -1,
        updatedAt: now,
      };
    }
  });

  return ok({
    ...config,
    rules: newMetaRules,
    filenameRules: newFilenameRules,
  });
}
