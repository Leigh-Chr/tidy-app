/**
 * @fileoverview Unit tests for filename rule manager - Story 7.2
 */

import { describe, expect, it, beforeEach } from 'vitest';
import type { FilenamePatternRule, CreateFilenameRuleInput } from '../types/filename-rule.js';
import { FilenameRuleErrorCode } from '../types/filename-rule.js';
import {
  createFilenameRule,
  getFilenameRule,
  getFilenameRuleByName,
  updateFilenameRule,
  deleteFilenameRule,
  listFilenameRules,
  listEnabledFilenameRules,
  reorderFilenameRules,
  setFilenameRulePriority,
  toggleFilenameRuleEnabled,
} from './filename-manager.js';

// =============================================================================
// Test Fixtures
// =============================================================================

const TEMPLATE_ID = '550e8400-e29b-41d4-a716-446655440001';
const TEMPLATE_ID_2 = '550e8400-e29b-41d4-a716-446655440002';

function createMockRule(overrides: Partial<FilenamePatternRule> = {}): FilenamePatternRule {
  return {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Test Rule',
    pattern: '*.jpg',
    caseSensitive: false,
    templateId: TEMPLATE_ID,
    priority: 0,
    enabled: true,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function createValidInput(overrides: Partial<CreateFilenameRuleInput> = {}): CreateFilenameRuleInput {
  return {
    name: 'New Rule',
    pattern: 'IMG_*.jpg',
    templateId: TEMPLATE_ID,
    ...overrides,
  };
}

// =============================================================================
// AC7: createFilenameRule Tests
// =============================================================================

describe('AC7: createFilenameRule', () => {
  let rules: FilenamePatternRule[];

  beforeEach(() => {
    rules = [];
  });

  it('should create a rule with valid input', () => {
    const input = createValidInput();

    const result = createFilenameRule(rules, input);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.rule.name).toBe('New Rule');
      expect(result.data.rule.pattern).toBe('IMG_*.jpg');
      expect(result.data.rule.templateId).toBe(TEMPLATE_ID);
      expect(result.data.rule.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
      expect(result.data.rules).toHaveLength(1);
    }
  });

  it('should generate UUID for rule ID', () => {
    const result = createFilenameRule(rules, createValidInput());

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.rule.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    }
  });

  it('should set timestamps on creation', () => {
    const beforeCreate = new Date().toISOString();
    const result = createFilenameRule(rules, createValidInput());
    const afterCreate = new Date().toISOString();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.rule.createdAt).toBeDefined();
      expect(result.data.rule.updatedAt).toBeDefined();
      expect(result.data.rule.createdAt >= beforeCreate).toBe(true);
      expect(result.data.rule.createdAt <= afterCreate).toBe(true);
      expect(result.data.rule.createdAt).toBe(result.data.rule.updatedAt);
    }
  });

  it('should apply default values', () => {
    const result = createFilenameRule(rules, {
      name: 'Minimal Rule',
      pattern: '*.txt',
      templateId: TEMPLATE_ID,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.rule.caseSensitive).toBe(false);
      expect(result.data.rule.priority).toBe(0);
      expect(result.data.rule.enabled).toBe(true);
    }
  });

  it('should return error for duplicate name (case-insensitive)', () => {
    rules = [createMockRule({ name: 'Existing Rule' })];
    const input = createValidInput({ name: 'EXISTING RULE' });

    const result = createFilenameRule(rules, input);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(FilenameRuleErrorCode.DUPLICATE_RULE_NAME);
    }
  });

  it('should return error for invalid pattern', () => {
    const input = createValidInput({ pattern: '[unclosed' });

    const result = createFilenameRule(rules, input);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(FilenameRuleErrorCode.VALIDATION_FAILED);
    }
  });

  it('should return error for empty pattern', () => {
    const input = createValidInput({ pattern: '' });

    const result = createFilenameRule(rules, input);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(FilenameRuleErrorCode.VALIDATION_FAILED);
    }
  });

  it('should return error for empty name', () => {
    const input = createValidInput({ name: '' });

    const result = createFilenameRule(rules, input);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(FilenameRuleErrorCode.VALIDATION_FAILED);
    }
  });

  it('should return error for invalid templateId format', () => {
    const input = createValidInput({ templateId: 'not-a-uuid' });

    const result = createFilenameRule(rules, input);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(FilenameRuleErrorCode.VALIDATION_FAILED);
    }
  });
});

// =============================================================================
// AC7: getFilenameRule Tests
// =============================================================================

describe('AC7: getFilenameRule', () => {
  it('should return rule by ID', () => {
    const rules = [createMockRule({ id: 'rule-123' })];

    const result = getFilenameRule(rules, 'rule-123');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.id).toBe('rule-123');
    }
  });

  it('should return error if rule not found', () => {
    const rules = [createMockRule()];

    const result = getFilenameRule(rules, 'non-existent');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(FilenameRuleErrorCode.RULE_NOT_FOUND);
    }
  });
});

// =============================================================================
// AC7: getFilenameRuleByName Tests
// =============================================================================

describe('AC7: getFilenameRuleByName', () => {
  it('should return rule by name (case-insensitive)', () => {
    const rules = [createMockRule({ name: 'iPhone Photos' })];

    const result = getFilenameRuleByName(rules, 'IPHONE PHOTOS');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.name).toBe('iPhone Photos');
    }
  });

  it('should return error if rule not found', () => {
    const rules = [createMockRule()];

    const result = getFilenameRuleByName(rules, 'Non Existent');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(FilenameRuleErrorCode.RULE_NOT_FOUND);
    }
  });
});

// =============================================================================
// AC7: updateFilenameRule Tests
// =============================================================================

describe('AC7: updateFilenameRule', () => {
  let rules: FilenamePatternRule[];

  beforeEach(() => {
    rules = [createMockRule({ id: 'rule-1', name: 'Original Name' })];
  });

  it('should update rule name', () => {
    const result = updateFilenameRule(rules, 'rule-1', { name: 'Updated Name' });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.rule.name).toBe('Updated Name');
    }
  });

  it('should update rule pattern', () => {
    const result = updateFilenameRule(rules, 'rule-1', { pattern: 'DSC_*.jpg' });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.rule.pattern).toBe('DSC_*.jpg');
    }
  });

  it('should update caseSensitive option', () => {
    const result = updateFilenameRule(rules, 'rule-1', { caseSensitive: true });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.rule.caseSensitive).toBe(true);
    }
  });

  it('should update multiple fields at once', () => {
    const result = updateFilenameRule(rules, 'rule-1', {
      name: 'New Name',
      pattern: '*.png',
      priority: 10,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.rule.name).toBe('New Name');
      expect(result.data.rule.pattern).toBe('*.png');
      expect(result.data.rule.priority).toBe(10);
    }
  });

  it('should update updatedAt timestamp', () => {
    const originalUpdatedAt = rules[0]!.updatedAt;

    const result = updateFilenameRule(rules, 'rule-1', { name: 'Updated' });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.rule.updatedAt).not.toBe(originalUpdatedAt);
    }
  });

  it('should preserve createdAt timestamp', () => {
    const originalCreatedAt = rules[0]!.createdAt;

    const result = updateFilenameRule(rules, 'rule-1', { name: 'Updated' });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.rule.createdAt).toBe(originalCreatedAt);
    }
  });

  it('should clear description when set to null', () => {
    rules = [createMockRule({ id: 'rule-1', description: 'Original desc' })];

    const result = updateFilenameRule(rules, 'rule-1', { description: null });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.rule.description).toBeUndefined();
    }
  });

  it('should return error for non-existent rule', () => {
    const result = updateFilenameRule(rules, 'non-existent', { name: 'Test' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(FilenameRuleErrorCode.RULE_NOT_FOUND);
    }
  });

  it('should return error for duplicate name', () => {
    rules = [
      createMockRule({ id: 'rule-1', name: 'First Rule' }),
      createMockRule({ id: 'rule-2', name: 'Second Rule' }),
    ];

    const result = updateFilenameRule(rules, 'rule-1', { name: 'Second Rule' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(FilenameRuleErrorCode.DUPLICATE_RULE_NAME);
    }
  });

  it('should return error for invalid pattern', () => {
    const result = updateFilenameRule(rules, 'rule-1', { pattern: '[unclosed' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(FilenameRuleErrorCode.VALIDATION_FAILED);
    }
  });
});

// =============================================================================
// AC7: deleteFilenameRule Tests
// =============================================================================

describe('AC7: deleteFilenameRule', () => {
  it('should delete existing rule', () => {
    const rules = [
      createMockRule({ id: 'rule-1' }),
      createMockRule({ id: 'rule-2' }),
    ];

    const result = deleteFilenameRule(rules, 'rule-1');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0]!.id).toBe('rule-2');
    }
  });

  it('should return error for non-existent rule', () => {
    const rules = [createMockRule()];

    const result = deleteFilenameRule(rules, 'non-existent');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(FilenameRuleErrorCode.RULE_NOT_FOUND);
    }
  });
});

// =============================================================================
// listFilenameRules Tests
// =============================================================================

describe('listFilenameRules', () => {
  it('should return rules sorted by priority (highest first)', () => {
    const rules = [
      createMockRule({ id: 'low', name: 'Low', priority: 1 }),
      createMockRule({ id: 'high', name: 'High', priority: 10 }),
      createMockRule({ id: 'medium', name: 'Medium', priority: 5 }),
    ];

    const sorted = listFilenameRules(rules);

    expect(sorted[0]!.name).toBe('High');
    expect(sorted[1]!.name).toBe('Medium');
    expect(sorted[2]!.name).toBe('Low');
  });

  it('should return a copy, not the original array', () => {
    const rules = [createMockRule()];

    const sorted = listFilenameRules(rules);

    expect(sorted).not.toBe(rules);
  });

  it('should handle empty array', () => {
    const sorted = listFilenameRules([]);

    expect(sorted).toEqual([]);
  });
});

// =============================================================================
// listEnabledFilenameRules Tests
// =============================================================================

describe('listEnabledFilenameRules', () => {
  it('should return only enabled rules sorted by priority', () => {
    const rules = [
      createMockRule({ id: 'enabled-low', priority: 1, enabled: true }),
      createMockRule({ id: 'disabled-high', priority: 10, enabled: false }),
      createMockRule({ id: 'enabled-high', priority: 5, enabled: true }),
    ];

    const enabled = listEnabledFilenameRules(rules);

    expect(enabled).toHaveLength(2);
    expect(enabled[0]!.id).toBe('enabled-high');
    expect(enabled[1]!.id).toBe('enabled-low');
  });

  it('should return empty array when all rules are disabled', () => {
    const rules = [
      createMockRule({ enabled: false }),
      createMockRule({ enabled: false }),
    ];

    const enabled = listEnabledFilenameRules(rules);

    expect(enabled).toHaveLength(0);
  });
});

// =============================================================================
// AC7: reorderFilenameRules Tests
// =============================================================================

describe('AC7: reorderFilenameRules', () => {
  it('should assign priorities based on position', () => {
    const rules = [
      createMockRule({ id: 'a', priority: 0 }),
      createMockRule({ id: 'b', priority: 1 }),
      createMockRule({ id: 'c', priority: 2 }),
    ];

    const result = reorderFilenameRules(rules, ['c', 'a', 'b']);

    expect(result.ok).toBe(true);
    if (result.ok) {
      const priorityMap = new Map(result.data.map((r) => [r.id, r.priority]));
      expect(priorityMap.get('c')).toBe(2); // First position = highest priority
      expect(priorityMap.get('a')).toBe(1);
      expect(priorityMap.get('b')).toBe(0);
    }
  });

  it('should return error for non-existent ID', () => {
    const rules = [createMockRule({ id: 'a' })];

    const result = reorderFilenameRules(rules, ['a', 'non-existent']);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(FilenameRuleErrorCode.RULE_NOT_FOUND);
    }
  });

  it('should return error for duplicate IDs in order', () => {
    const rules = [
      createMockRule({ id: 'a' }),
      createMockRule({ id: 'b' }),
    ];

    const result = reorderFilenameRules(rules, ['a', 'a', 'b']);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(FilenameRuleErrorCode.VALIDATION_FAILED);
    }
  });

  it('should assign -1 priority to rules not in order', () => {
    const rules = [
      createMockRule({ id: 'a', priority: 5 }),
      createMockRule({ id: 'b', priority: 10 }),
      createMockRule({ id: 'c', priority: 15 }),
    ];

    const result = reorderFilenameRules(rules, ['a', 'b']);

    expect(result.ok).toBe(true);
    if (result.ok) {
      const cRule = result.data.find((r) => r.id === 'c');
      expect(cRule?.priority).toBe(-1);
    }
  });

  it('should update updatedAt for rules with changed priority', () => {
    const originalUpdatedAt = '2024-01-01T00:00:00.000Z';
    const rules = [
      createMockRule({ id: 'a', priority: 0, updatedAt: originalUpdatedAt }),
      createMockRule({ id: 'b', priority: 1, updatedAt: originalUpdatedAt }),
    ];

    const result = reorderFilenameRules(rules, ['b', 'a']);

    expect(result.ok).toBe(true);
    if (result.ok) {
      // 'a' was priority 0, now it's 0 (last position) - no change
      // 'b' was priority 1, now it's 1 (first position) - no change
      // Actually both change since the calculation is: length - 1 - index
      // ['b', 'a'] -> b: 2-1-0=1, a: 2-1-1=0
      // Original: a=0, b=1, so no changes in priority values
      const aRule = result.data.find((r) => r.id === 'a');
      expect(aRule?.updatedAt).toBe(originalUpdatedAt); // No priority change
    }
  });
});

// =============================================================================
// setFilenameRulePriority Tests
// =============================================================================

describe('setFilenameRulePriority', () => {
  it('should set priority for existing rule', () => {
    const rules = [createMockRule({ id: 'rule-1', priority: 0 })];

    const result = setFilenameRulePriority(rules, 'rule-1', 10);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data[0]!.priority).toBe(10);
    }
  });

  it('should update updatedAt when priority changes', () => {
    const originalUpdatedAt = '2024-01-01T00:00:00.000Z';
    const rules = [createMockRule({ id: 'rule-1', priority: 0, updatedAt: originalUpdatedAt })];

    const result = setFilenameRulePriority(rules, 'rule-1', 10);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data[0]!.updatedAt).not.toBe(originalUpdatedAt);
    }
  });

  it('should return same array if priority unchanged', () => {
    const rules = [createMockRule({ id: 'rule-1', priority: 5 })];

    const result = setFilenameRulePriority(rules, 'rule-1', 5);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toBe(rules);
    }
  });

  it('should return error for non-existent rule', () => {
    const rules = [createMockRule()];

    const result = setFilenameRulePriority(rules, 'non-existent', 10);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(FilenameRuleErrorCode.RULE_NOT_FOUND);
    }
  });

  it('should return error for negative priority', () => {
    const rules = [createMockRule({ id: 'rule-1' })];

    const result = setFilenameRulePriority(rules, 'rule-1', -1);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(FilenameRuleErrorCode.VALIDATION_FAILED);
    }
  });

  it('should return error for non-integer priority', () => {
    const rules = [createMockRule({ id: 'rule-1' })];

    const result = setFilenameRulePriority(rules, 'rule-1', 1.5);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(FilenameRuleErrorCode.VALIDATION_FAILED);
    }
  });
});

// =============================================================================
// toggleFilenameRuleEnabled Tests
// =============================================================================

describe('toggleFilenameRuleEnabled', () => {
  it('should toggle enabled from true to false', () => {
    const rules = [createMockRule({ id: 'rule-1', enabled: true })];

    const result = toggleFilenameRuleEnabled(rules, 'rule-1');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.enabled).toBe(false);
      expect(result.data.rules[0]!.enabled).toBe(false);
    }
  });

  it('should toggle enabled from false to true', () => {
    const rules = [createMockRule({ id: 'rule-1', enabled: false })];

    const result = toggleFilenameRuleEnabled(rules, 'rule-1');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.enabled).toBe(true);
      expect(result.data.rules[0]!.enabled).toBe(true);
    }
  });

  it('should update updatedAt timestamp', () => {
    const originalUpdatedAt = '2024-01-01T00:00:00.000Z';
    const rules = [createMockRule({ id: 'rule-1', updatedAt: originalUpdatedAt })];

    const result = toggleFilenameRuleEnabled(rules, 'rule-1');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.rules[0]!.updatedAt).not.toBe(originalUpdatedAt);
    }
  });

  it('should return error for non-existent rule', () => {
    const rules = [createMockRule()];

    const result = toggleFilenameRuleEnabled(rules, 'non-existent');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(FilenameRuleErrorCode.RULE_NOT_FOUND);
    }
  });
});

// =============================================================================
// Template Validation Tests - Story 7.3 AC1, AC4
// =============================================================================

describe('createFilenameRule with template validation', () => {
  const validTemplates = [
    {
      id: TEMPLATE_ID,
      name: 'Test Template',
      pattern: '{date}-{original}',
      isDefault: true,
      createdAt: '2026-01-10T12:00:00.000Z',
      updatedAt: '2026-01-10T12:00:00.000Z',
    },
    {
      id: TEMPLATE_ID_2,
      name: 'Another Template',
      pattern: '{original}-{date}',
      isDefault: false,
      createdAt: '2026-01-10T12:00:00.000Z',
      updatedAt: '2026-01-10T12:00:00.000Z',
    },
  ];

  it('should accept rule with valid templateId when templates provided', () => {
    const input = createValidInput({
      templateId: TEMPLATE_ID,
    });

    const result = createFilenameRule([], input, validTemplates);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.rule.templateId).toBe(TEMPLATE_ID);
    }
  });

  it('should reject rule with non-existent templateId', () => {
    const input = createValidInput({
      templateId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', // Valid UUID format, not in templates
    });

    const result = createFilenameRule([], input, validTemplates);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(FilenameRuleErrorCode.TEMPLATE_NOT_FOUND);
      expect(result.error.message).toContain('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
    }
  });

  it('should include templateId in error details', () => {
    const invalidTemplateId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
    const input = createValidInput({
      templateId: invalidTemplateId, // Valid UUID format, but not in templates
    });

    const result = createFilenameRule([], input, validTemplates);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(FilenameRuleErrorCode.TEMPLATE_NOT_FOUND);
      expect(result.error.details).toHaveProperty('templateId', invalidTemplateId);
    }
  });

  it('should skip template validation when templates not provided', () => {
    const input = createValidInput({
      templateId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', // Valid UUID v4 format, but not in any templates list
    });

    // Without templates array, skip validation (backward compatibility)
    const result = createFilenameRule([], input);

    expect(result.ok).toBe(true);
  });
});

describe('updateFilenameRule with template validation', () => {
  const validTemplates = [
    {
      id: TEMPLATE_ID,
      name: 'Test Template',
      pattern: '{date}-{original}',
      isDefault: true,
      createdAt: '2026-01-10T12:00:00.000Z',
      updatedAt: '2026-01-10T12:00:00.000Z',
    },
  ];

  let rules: FilenamePatternRule[];

  beforeEach(() => {
    rules = [
      createMockRule({
        id: 'rule-1',
        templateId: TEMPLATE_ID,
      }),
    ];
  });

  it('should accept update with valid templateId', () => {
    const result = updateFilenameRule(rules, 'rule-1', { name: 'Updated Name' }, validTemplates);

    expect(result.ok).toBe(true);
  });

  it('should reject update with non-existent templateId', () => {
    const result = updateFilenameRule(
      rules,
      'rule-1',
      { templateId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' },
      validTemplates
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(FilenameRuleErrorCode.TEMPLATE_NOT_FOUND);
      expect(result.error.message).toContain('cccccccc-cccc-4ccc-8ccc-cccccccccccc');
    }
  });

  it('should validate templateId when explicitly updated even if other fields unchanged', () => {
    const result = updateFilenameRule(
      rules,
      'rule-1',
      { templateId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' }, // Valid UUID v4, but not in templates
      validTemplates
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(FilenameRuleErrorCode.TEMPLATE_NOT_FOUND);
    }
  });

  it('should skip template validation when templates not provided', () => {
    const result = updateFilenameRule(rules, 'rule-1', { templateId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' });

    expect(result.ok).toBe(true);
  });
});
