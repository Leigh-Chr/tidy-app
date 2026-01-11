/**
 * @fileoverview Filename rule manager - CRUD operations for filename pattern rules - Story 7.2
 *
 * Provides functions to create, read, update, delete, and reorder filename pattern rules.
 * All operations return Result<T, E> types following project conventions.
 */

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { ok, err } from '../types/result.js';
import type { Result } from '../types/result.js';
import type {
  FilenamePatternRule,
  CreateFilenameRuleInput,
  UpdateFilenameRuleInput,
  FilenameRuleError,
} from '../types/filename-rule.js';
import {
  createFilenameRuleInputSchema,
  updateFilenameRuleInputSchema,
  FilenameRuleErrorCode,
  createFilenameRuleError,
} from '../types/filename-rule.js';
import type { Template } from '../config/schema.js';

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

// =============================================================================
// CRUD Operations
// =============================================================================

/**
 * Create a new filename pattern rule.
 *
 * @param rules - The current array of filename rules
 * @param input - Rule creation input
 * @param templates - Optional array of templates for templateId validation
 * @returns Result with updated rules array and created rule, or error
 *
 * @example
 * ```typescript
 * const result = createFilenameRule(rules, {
 *   name: 'iPhone Photos',
 *   pattern: 'IMG_*.{jpg,jpeg,heic}',
 *   caseSensitive: false,
 *   templateId: 'some-uuid',
 *   priority: 10,
 * }, templates);
 *
 * if (result.ok) {
 *   console.log(result.data.rule.id);
 * }
 * ```
 */
export function createFilenameRule(
  rules: FilenamePatternRule[],
  input: CreateFilenameRuleInput,
  templates?: Template[]
): Result<{ rules: FilenamePatternRule[]; rule: FilenamePatternRule }, FilenameRuleError> {
  // Validate input schema (includes pattern validation)
  const validation = createFilenameRuleInputSchema.safeParse(input);
  if (!validation.success) {
    return err(
      createFilenameRuleError(FilenameRuleErrorCode.VALIDATION_FAILED, 'Invalid rule input', {
        issues: z.treeifyError(validation.error),
      })
    );
  }

  // Validate template exists (Story 7.3 AC1, AC4)
  if (!validateTemplateExists(input.templateId, templates)) {
    return err(
      createFilenameRuleError(
        FilenameRuleErrorCode.TEMPLATE_NOT_FOUND,
        `Template "${input.templateId}" not found`,
        { templateId: input.templateId }
      )
    );
  }

  // Check for duplicate name (case-insensitive)
  const nameExists = rules.some((r) => r.name.toLowerCase() === input.name.toLowerCase());
  if (nameExists) {
    return err(
      createFilenameRuleError(
        FilenameRuleErrorCode.DUPLICATE_RULE_NAME,
        `A filename rule named "${input.name}" already exists`
      )
    );
  }

  const now = new Date().toISOString();
  const rule: FilenamePatternRule = {
    id: randomUUID(),
    name: input.name,
    description: input.description,
    pattern: input.pattern,
    caseSensitive: input.caseSensitive ?? false,
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
 * Get a filename rule by its unique ID.
 *
 * @param rules - The array of filename rules
 * @param id - The rule ID
 * @returns Result with the rule, or RULE_NOT_FOUND error
 */
export function getFilenameRule(
  rules: FilenamePatternRule[],
  id: string
): Result<FilenamePatternRule, FilenameRuleError> {
  const rule = rules.find((r) => r.id === id);

  if (!rule) {
    return err(
      createFilenameRuleError(FilenameRuleErrorCode.RULE_NOT_FOUND, `Rule with ID "${id}" not found`)
    );
  }

  return ok(rule);
}

/**
 * Get a filename rule by its name (case-insensitive).
 *
 * @param rules - The array of filename rules
 * @param name - The rule name
 * @returns Result with the rule, or RULE_NOT_FOUND error
 */
export function getFilenameRuleByName(
  rules: FilenamePatternRule[],
  name: string
): Result<FilenamePatternRule, FilenameRuleError> {
  const rule = rules.find((r) => r.name.toLowerCase() === name.toLowerCase());

  if (!rule) {
    return err(
      createFilenameRuleError(
        FilenameRuleErrorCode.RULE_NOT_FOUND,
        `Rule named "${name}" not found`
      )
    );
  }

  return ok(rule);
}

/**
 * Update an existing filename rule.
 *
 * @param rules - The array of filename rules
 * @param id - The ID of the rule to update
 * @param input - Fields to update (all optional)
 * @param templates - Optional array of templates for templateId validation
 * @returns Result with updated rules array and rule, or error
 */
export function updateFilenameRule(
  rules: FilenamePatternRule[],
  id: string,
  input: UpdateFilenameRuleInput,
  templates?: Template[]
): Result<{ rules: FilenamePatternRule[]; rule: FilenamePatternRule }, FilenameRuleError> {
  // Validate input schema (includes pattern validation if pattern is provided)
  const validation = updateFilenameRuleInputSchema.safeParse(input);
  if (!validation.success) {
    return err(
      createFilenameRuleError(FilenameRuleErrorCode.VALIDATION_FAILED, 'Invalid update input', {
        issues: z.treeifyError(validation.error),
      })
    );
  }

  // Validate template exists if templateId is being updated (Story 7.3 AC1, AC4)
  if (input.templateId !== undefined && !validateTemplateExists(input.templateId, templates)) {
    return err(
      createFilenameRuleError(
        FilenameRuleErrorCode.TEMPLATE_NOT_FOUND,
        `Template "${input.templateId}" not found`,
        { templateId: input.templateId }
      )
    );
  }

  const ruleIndex = rules.findIndex((r) => r.id === id);
  const existing = rules[ruleIndex];

  if (ruleIndex === -1 || !existing) {
    return err(
      createFilenameRuleError(
        FilenameRuleErrorCode.RULE_NOT_FOUND,
        `Rule with ID "${id}" not found`
      )
    );
  }

  // Check for duplicate name if name is being changed
  const newName = input.name;
  if (newName && newName.toLowerCase() !== existing.name.toLowerCase()) {
    const nameExists = rules.some((r) => r.name.toLowerCase() === newName.toLowerCase());
    if (nameExists) {
      return err(
        createFilenameRuleError(
          FilenameRuleErrorCode.DUPLICATE_RULE_NAME,
          `A filename rule named "${newName}" already exists`
        )
      );
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

  const updated: FilenamePatternRule = {
    id: existing.id,
    name: input.name ?? existing.name,
    description: newDescription,
    pattern: input.pattern ?? existing.pattern,
    caseSensitive: input.caseSensitive ?? existing.caseSensitive,
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
 * Delete a filename rule.
 *
 * @param rules - The array of filename rules
 * @param id - The ID of the rule to delete
 * @returns Result with updated rules array, or error
 */
export function deleteFilenameRule(
  rules: FilenamePatternRule[],
  id: string
): Result<FilenamePatternRule[], FilenameRuleError> {
  const ruleExists = rules.some((r) => r.id === id);

  if (!ruleExists) {
    return err(
      createFilenameRuleError(
        FilenameRuleErrorCode.RULE_NOT_FOUND,
        `Rule with ID "${id}" not found`
      )
    );
  }

  return ok(rules.filter((r) => r.id !== id));
}

/**
 * List all filename rules sorted by priority (highest first).
 *
 * @param rules - The array of filename rules
 * @returns Sorted array of rules (copy, not reference)
 */
export function listFilenameRules(rules: FilenamePatternRule[]): FilenamePatternRule[] {
  return [...rules].sort((a, b) => b.priority - a.priority);
}

/**
 * List only enabled filename rules sorted by priority (highest first).
 *
 * @param rules - The array of filename rules
 * @returns Sorted array of enabled rules
 */
export function listEnabledFilenameRules(rules: FilenamePatternRule[]): FilenamePatternRule[] {
  return rules.filter((r) => r.enabled).sort((a, b) => b.priority - a.priority);
}

// =============================================================================
// Priority / Reorder Operations
// =============================================================================

/**
 * Reorder filename rules by specifying new order of IDs.
 * Rules will be assigned priorities based on their position in the new order
 * (first item gets highest priority).
 *
 * @param rules - The array of filename rules
 * @param orderedIds - Array of rule IDs in desired order (highest priority first)
 * @returns Result with reordered rules array, or error if any ID is not found
 *
 * @example
 * ```typescript
 * // Move rule 'abc' to highest priority
 * const result = reorderFilenameRules(rules, ['abc', 'def', 'ghi']);
 * // abc gets priority 2, def gets priority 1, ghi gets priority 0
 * ```
 */
export function reorderFilenameRules(
  rules: FilenamePatternRule[],
  orderedIds: string[]
): Result<FilenamePatternRule[], FilenameRuleError> {
  // Validate all IDs exist
  const ruleMap = new Map(rules.map((r) => [r.id, r]));

  for (const id of orderedIds) {
    if (!ruleMap.has(id)) {
      return err(
        createFilenameRuleError(
          FilenameRuleErrorCode.RULE_NOT_FOUND,
          `Rule with ID "${id}" not found`,
          { missingId: id }
        )
      );
    }
  }

  // Check for duplicate IDs in the order
  const uniqueIds = new Set(orderedIds);
  if (uniqueIds.size !== orderedIds.length) {
    return err(
      createFilenameRuleError(
        FilenameRuleErrorCode.VALIDATION_FAILED,
        'Duplicate IDs in order array',
        { orderedIds }
      )
    );
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
 * Set the priority of a single filename rule.
 *
 * @param rules - The array of filename rules
 * @param id - The ID of the rule to update
 * @param priority - The new priority value (higher = evaluated first)
 * @returns Result with updated rules array, or error
 */
export function setFilenameRulePriority(
  rules: FilenamePatternRule[],
  id: string,
  priority: number
): Result<FilenamePatternRule[], FilenameRuleError> {
  if (priority < 0 || !Number.isInteger(priority)) {
    return err(
      createFilenameRuleError(
        FilenameRuleErrorCode.VALIDATION_FAILED,
        'Priority must be a non-negative integer',
        { priority }
      )
    );
  }

  const ruleIndex = rules.findIndex((r) => r.id === id);

  if (ruleIndex === -1) {
    return err(
      createFilenameRuleError(
        FilenameRuleErrorCode.RULE_NOT_FOUND,
        `Rule with ID "${id}" not found`
      )
    );
  }

  const existing = rules[ruleIndex]!;
  if (existing.priority === priority) {
    // No change needed
    return ok(rules);
  }

  const updated: FilenamePatternRule = {
    ...existing,
    priority,
    updatedAt: new Date().toISOString(),
  };

  const newRules = [...rules];
  newRules[ruleIndex] = updated;

  return ok(newRules);
}

/**
 * Toggle a filename rule's enabled status.
 *
 * @param rules - The array of filename rules
 * @param id - The ID of the rule to toggle
 * @returns Result with updated rules array and new enabled status, or error
 */
export function toggleFilenameRuleEnabled(
  rules: FilenamePatternRule[],
  id: string
): Result<{ rules: FilenamePatternRule[]; enabled: boolean }, FilenameRuleError> {
  const ruleIndex = rules.findIndex((r) => r.id === id);

  if (ruleIndex === -1) {
    return err(
      createFilenameRuleError(
        FilenameRuleErrorCode.RULE_NOT_FOUND,
        `Rule with ID "${id}" not found`
      )
    );
  }

  const existing = rules[ruleIndex]!;
  const updated: FilenamePatternRule = {
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
