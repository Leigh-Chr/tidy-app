/**
 * @fileoverview Rule manager - CRUD operations for metadata pattern rules - Story 7.1
 *
 * Provides functions to create, read, update, delete, and reorder rules.
 * All operations return Result<T, E> types following project conventions.
 */

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { ok, err } from '../types/result.js';
import type { Result } from '../types/result.js';
import type {
  MetadataPatternRule,
  CreateRuleInput,
  UpdateRuleInput,
} from '../types/rule.js';
import {
  createRuleInputSchema,
  updateRuleInputSchema,
  isValidFieldPath,
} from '../types/rule.js';
import type { Template } from '../config/schema.js';

// =============================================================================
// Error Types
// =============================================================================

/**
 * Error types that can occur during rule management operations.
 */
export interface RuleManagerError {
  type:
    | 'not_found'
    | 'validation_error'
    | 'duplicate_name'
    | 'invalid_field_path'
    | 'invalid_regex'
    | 'template_not_found';
  message: string;
  details?: unknown;
}

// =============================================================================
// Validation Helpers
// =============================================================================

/**
 * Check if a template with the given ID exists.
 * Returns true if templates array is not provided (backward compatibility),
 * or if the templateId exists in the templates array.
 */
function validateTemplateExists(templateId: string, templates?: Template[]): boolean {
  // If templates not provided, skip validation (backward compatibility)
  if (!templates) {
    return true;
  }
  return templates.some((t) => t.id === templateId);
}

/**
 * Validate all field paths in a rule's conditions.
 * Returns array of invalid field paths, or empty array if all valid.
 */
function validateFieldPaths(conditions: CreateRuleInput['conditions']): string[] {
  const invalid: string[] = [];
  for (const condition of conditions) {
    if (!isValidFieldPath(condition.field)) {
      invalid.push(condition.field);
    }
  }
  return invalid;
}

/**
 * Validate all regex patterns in a rule's conditions.
 * Returns array of invalid regex patterns, or empty array if all valid.
 */
function validateRegexPatterns(
  conditions: CreateRuleInput['conditions']
): Array<{ field: string; pattern: string; error: string }> {
  const invalid: Array<{ field: string; pattern: string; error: string }> = [];

  for (const condition of conditions) {
    if (condition.operator === 'regex' && condition.value) {
      try {
        new RegExp(condition.value);
      } catch (e) {
        invalid.push({
          field: condition.field,
          pattern: condition.value,
          error: e instanceof Error ? e.message : 'Invalid regex pattern',
        });
      }
    }
  }

  return invalid;
}

// =============================================================================
// CRUD Operations
// =============================================================================

/**
 * Create a new metadata pattern rule.
 *
 * @param rules - The current array of rules
 * @param input - Rule creation input
 * @param templates - Optional array of templates for templateId validation
 * @returns Result with updated rules array and created rule, or error
 *
 * @example
 * ```typescript
 * const result = createRule(rules, {
 *   name: 'iPhone Photos',
 *   conditions: [
 *     { field: 'image.cameraMake', operator: 'contains', value: 'Apple' },
 *   ],
 *   matchMode: 'all',
 *   templateId: 'some-uuid',
 *   priority: 10,
 * }, templates);
 *
 * if (result.ok) {
 *   console.log(result.data.rule.id);
 * }
 * ```
 */
export function createRule(
  rules: MetadataPatternRule[],
  input: CreateRuleInput,
  templates?: Template[]
): Result<{ rules: MetadataPatternRule[]; rule: MetadataPatternRule }, RuleManagerError> {
  // Validate input schema
  const validation = createRuleInputSchema.safeParse(input);
  if (!validation.success) {
    return err({
      type: 'validation_error',
      message: 'Invalid rule input',
      details: z.treeifyError(validation.error),
    });
  }

  // Validate field paths
  const invalidPaths = validateFieldPaths(input.conditions);
  if (invalidPaths.length > 0) {
    return err({
      type: 'invalid_field_path',
      message: `Invalid field path(s): ${invalidPaths.join(', ')}`,
      details: { invalidPaths },
    });
  }

  // Validate regex patterns
  const invalidRegex = validateRegexPatterns(input.conditions);
  if (invalidRegex.length > 0) {
    return err({
      type: 'invalid_regex',
      message: `Invalid regex pattern(s) in conditions`,
      details: { invalidRegex },
    });
  }

  // Validate template exists (Story 7.3 AC1, AC4)
  if (!validateTemplateExists(input.templateId, templates)) {
    return err({
      type: 'template_not_found',
      message: `Template "${input.templateId}" not found`,
      details: { templateId: input.templateId },
    });
  }

  // Check for duplicate name (case-insensitive)
  const nameExists = rules.some((r) => r.name.toLowerCase() === input.name.toLowerCase());
  if (nameExists) {
    return err({
      type: 'duplicate_name',
      message: `A rule named "${input.name}" already exists`,
    });
  }

  const now = new Date().toISOString();
  const rule: MetadataPatternRule = {
    id: randomUUID(),
    name: input.name,
    description: input.description,
    conditions: input.conditions,
    matchMode: input.matchMode ?? 'all',
    templateId: input.templateId,
    priority: input.priority ?? 0,
    enabled: input.enabled ?? true,
    createdAt: now,
    updatedAt: now,
  };

  return ok({
    rules: [...rules, rule],
    rule,
  });
}

/**
 * Get a rule by its unique ID.
 *
 * @param rules - The array of rules
 * @param id - The rule ID
 * @returns Result with the rule, or not_found error
 */
export function getRule(
  rules: MetadataPatternRule[],
  id: string
): Result<MetadataPatternRule, RuleManagerError> {
  const rule = rules.find((r) => r.id === id);

  if (!rule) {
    return err({
      type: 'not_found',
      message: `Rule with ID "${id}" not found`,
    });
  }

  return ok(rule);
}

/**
 * Get a rule by its name (case-insensitive).
 *
 * @param rules - The array of rules
 * @param name - The rule name
 * @returns Result with the rule, or not_found error
 */
export function getRuleByName(
  rules: MetadataPatternRule[],
  name: string
): Result<MetadataPatternRule, RuleManagerError> {
  const rule = rules.find((r) => r.name.toLowerCase() === name.toLowerCase());

  if (!rule) {
    return err({
      type: 'not_found',
      message: `Rule named "${name}" not found`,
    });
  }

  return ok(rule);
}

/**
 * Update an existing rule.
 *
 * @param rules - The array of rules
 * @param id - The ID of the rule to update
 * @param input - Fields to update (all optional)
 * @param templates - Optional array of templates for templateId validation
 * @returns Result with updated rules array and rule, or error
 */
export function updateRule(
  rules: MetadataPatternRule[],
  id: string,
  input: UpdateRuleInput,
  templates?: Template[]
): Result<{ rules: MetadataPatternRule[]; rule: MetadataPatternRule }, RuleManagerError> {
  // Validate input schema
  const validation = updateRuleInputSchema.safeParse(input);
  if (!validation.success) {
    return err({
      type: 'validation_error',
      message: 'Invalid update input',
      details: z.treeifyError(validation.error),
    });
  }

  // Validate field paths if conditions are being updated
  if (input.conditions) {
    const invalidPaths = validateFieldPaths(input.conditions);
    if (invalidPaths.length > 0) {
      return err({
        type: 'invalid_field_path',
        message: `Invalid field path(s): ${invalidPaths.join(', ')}`,
        details: { invalidPaths },
      });
    }

    const invalidRegex = validateRegexPatterns(input.conditions);
    if (invalidRegex.length > 0) {
      return err({
        type: 'invalid_regex',
        message: `Invalid regex pattern(s) in conditions`,
        details: { invalidRegex },
      });
    }
  }

  // Validate template exists if templateId is being updated (Story 7.3 AC1, AC4)
  if (input.templateId !== undefined && !validateTemplateExists(input.templateId, templates)) {
    return err({
      type: 'template_not_found',
      message: `Template "${input.templateId}" not found`,
      details: { templateId: input.templateId },
    });
  }

  const ruleIndex = rules.findIndex((r) => r.id === id);
  const existing = rules[ruleIndex];

  if (ruleIndex === -1 || !existing) {
    return err({
      type: 'not_found',
      message: `Rule with ID "${id}" not found`,
    });
  }

  // Check for duplicate name if name is being changed
  const newName = input.name;
  if (newName && newName.toLowerCase() !== existing.name.toLowerCase()) {
    const nameExists = rules.some((r) => r.name.toLowerCase() === newName.toLowerCase());
    if (nameExists) {
      return err({
        type: 'duplicate_name',
        message: `A rule named "${newName}" already exists`,
      });
    }
  }

  // Handle description: null means clear, undefined means keep existing
  let newDescription: string | undefined;
  if (input.description === null) {
    newDescription = undefined;
  } else if (input.description !== undefined) {
    newDescription = input.description;
  } else {
    newDescription = existing.description;
  }

  const updated: MetadataPatternRule = {
    id: existing.id,
    name: input.name ?? existing.name,
    description: newDescription,
    conditions: input.conditions ?? existing.conditions,
    matchMode: input.matchMode ?? existing.matchMode,
    templateId: input.templateId ?? existing.templateId,
    priority: input.priority ?? existing.priority,
    enabled: input.enabled ?? existing.enabled,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };

  const newRules = [...rules];
  newRules[ruleIndex] = updated;

  return ok({
    rules: newRules,
    rule: updated,
  });
}

/**
 * Delete a rule.
 *
 * @param rules - The array of rules
 * @param id - The ID of the rule to delete
 * @returns Result with updated rules array, or error
 */
export function deleteRule(
  rules: MetadataPatternRule[],
  id: string
): Result<MetadataPatternRule[], RuleManagerError> {
  const ruleExists = rules.some((r) => r.id === id);

  if (!ruleExists) {
    return err({
      type: 'not_found',
      message: `Rule with ID "${id}" not found`,
    });
  }

  return ok(rules.filter((r) => r.id !== id));
}

/**
 * List all rules sorted by priority (highest first).
 *
 * @param rules - The array of rules
 * @returns Sorted array of rules (copy, not reference)
 */
export function listRules(rules: MetadataPatternRule[]): MetadataPatternRule[] {
  return [...rules].sort((a, b) => b.priority - a.priority);
}

/**
 * List only enabled rules sorted by priority (highest first).
 *
 * @param rules - The array of rules
 * @returns Sorted array of enabled rules
 */
export function listEnabledRules(rules: MetadataPatternRule[]): MetadataPatternRule[] {
  return rules.filter((r) => r.enabled).sort((a, b) => b.priority - a.priority);
}

// =============================================================================
// Priority / Reorder Operations
// =============================================================================

/**
 * Reorder rules by specifying new order of IDs.
 * Rules will be assigned priorities based on their position in the new order
 * (first item gets highest priority).
 *
 * @param rules - The array of rules
 * @param orderedIds - Array of rule IDs in desired order (highest priority first)
 * @returns Result with reordered rules array, or error if any ID is not found
 *
 * @example
 * ```typescript
 * // Move rule 'abc' to highest priority
 * const result = reorderRules(rules, ['abc', 'def', 'ghi']);
 * // abc gets priority 2, def gets priority 1, ghi gets priority 0
 * ```
 */
export function reorderRules(
  rules: MetadataPatternRule[],
  orderedIds: string[]
): Result<MetadataPatternRule[], RuleManagerError> {
  // Validate all IDs exist
  const ruleMap = new Map(rules.map((r) => [r.id, r]));

  for (const id of orderedIds) {
    if (!ruleMap.has(id)) {
      return err({
        type: 'not_found',
        message: `Rule with ID "${id}" not found`,
        details: { missingId: id },
      });
    }
  }

  // Check for duplicate IDs in the order
  const uniqueIds = new Set(orderedIds);
  if (uniqueIds.size !== orderedIds.length) {
    return err({
      type: 'validation_error',
      message: 'Duplicate IDs in order array',
      details: { orderedIds },
    });
  }

  // Assign priorities based on position (reverse index = priority)
  // First item in array gets highest priority
  const now = new Date().toISOString();
  const reordered = orderedIds.map((id, index) => {
    const rule = ruleMap.get(id)!;
    const newPriority = orderedIds.length - 1 - index;

    // Only update if priority changed
    if (rule.priority === newPriority) {
      return rule;
    }

    return {
      ...rule,
      priority: newPriority,
      updatedAt: now,
    };
  });

  // Include any rules not in orderedIds (assign priority -1 or lowest)
  const includedIds = new Set(orderedIds);
  const excluded = rules.filter((r) => !includedIds.has(r.id));
  const lowestPriority = -1;

  const excludedWithPriority = excluded.map((rule) => {
    if (rule.priority === lowestPriority) {
      return rule;
    }
    return {
      ...rule,
      priority: lowestPriority,
      updatedAt: now,
    };
  });

  return ok([...reordered, ...excludedWithPriority]);
}

/**
 * Set the priority of a single rule.
 *
 * @param rules - The array of rules
 * @param id - The ID of the rule to update
 * @param priority - The new priority value (higher = evaluated first)
 * @returns Result with updated rules array, or error
 */
export function setRulePriority(
  rules: MetadataPatternRule[],
  id: string,
  priority: number
): Result<MetadataPatternRule[], RuleManagerError> {
  if (priority < 0 || !Number.isInteger(priority)) {
    return err({
      type: 'validation_error',
      message: 'Priority must be a non-negative integer',
      details: { priority },
    });
  }

  const ruleIndex = rules.findIndex((r) => r.id === id);

  if (ruleIndex === -1) {
    return err({
      type: 'not_found',
      message: `Rule with ID "${id}" not found`,
    });
  }

  const existing = rules[ruleIndex]!;
  if (existing.priority === priority) {
    // No change needed
    return ok(rules);
  }

  const updated: MetadataPatternRule = {
    ...existing,
    priority,
    updatedAt: new Date().toISOString(),
  };

  const newRules = [...rules];
  newRules[ruleIndex] = updated;

  return ok(newRules);
}

/**
 * Toggle a rule's enabled status.
 *
 * @param rules - The array of rules
 * @param id - The ID of the rule to toggle
 * @returns Result with updated rules array, or error
 */
export function toggleRuleEnabled(
  rules: MetadataPatternRule[],
  id: string
): Result<{ rules: MetadataPatternRule[]; enabled: boolean }, RuleManagerError> {
  const ruleIndex = rules.findIndex((r) => r.id === id);

  if (ruleIndex === -1) {
    return err({
      type: 'not_found',
      message: `Rule with ID "${id}" not found`,
    });
  }

  const existing = rules[ruleIndex]!;
  const updated: MetadataPatternRule = {
    ...existing,
    enabled: !existing.enabled,
    updatedAt: new Date().toISOString(),
  };

  const newRules = [...rules];
  newRules[ruleIndex] = updated;

  return ok({
    rules: newRules,
    enabled: updated.enabled,
  });
}
