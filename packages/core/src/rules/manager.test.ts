/**
 * @fileoverview Tests for rule manager - Story 7.1
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createRule,
  getRule,
  getRuleByName,
  updateRule,
  deleteRule,
  listRules,
  listEnabledRules,
  reorderRules,
  setRulePriority,
  toggleRuleEnabled,
} from './manager.js';
import type { MetadataPatternRule, CreateRuleInput } from '../types/rule.js';

// =============================================================================
// Test Fixtures
// =============================================================================

function createValidInput(overrides: Partial<CreateRuleInput> = {}): CreateRuleInput {
  return {
    name: 'Test Rule',
    conditions: [
      { field: 'image.cameraMake', operator: 'equals', value: 'Apple', caseSensitive: false },
    ],
    matchMode: 'all',
    templateId: '550e8400-e29b-41d4-a716-446655440000',
    priority: 0,
    enabled: true,
    ...overrides,
  };
}

function createTestRule(overrides: Partial<MetadataPatternRule> = {}): MetadataPatternRule {
  return {
    id: '550e8400-e29b-41d4-a716-446655440001',
    name: 'Test Rule',
    conditions: [
      { field: 'image.cameraMake', operator: 'equals', value: 'Apple', caseSensitive: false },
    ],
    matchMode: 'all',
    templateId: '550e8400-e29b-41d4-a716-446655440000',
    priority: 0,
    enabled: true,
    createdAt: '2026-01-10T12:00:00.000Z',
    updatedAt: '2026-01-10T12:00:00.000Z',
    ...overrides,
  };
}

// =============================================================================
// createRule Tests
// =============================================================================

describe('createRule', () => {
  it('creates a new rule with valid input', () => {
    const input = createValidInput();
    const result = createRule([], input);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.rule.name).toBe('Test Rule');
      expect(result.data.rule.id).toBeDefined();
      expect(result.data.rule.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
      expect(result.data.rule.createdAt).toBeDefined();
      expect(result.data.rule.updatedAt).toBeDefined();
      expect(result.data.rules).toHaveLength(1);
    }
  });

  it('applies default values for optional fields', () => {
    const input: CreateRuleInput = {
      name: 'Minimal Rule',
      conditions: [{ field: 'file.extension', operator: 'equals', value: 'jpg' }],
      templateId: '550e8400-e29b-41d4-a716-446655440000',
    };

    const result = createRule([], input);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.rule.matchMode).toBe('all');
      expect(result.data.rule.priority).toBe(0);
      expect(result.data.rule.enabled).toBe(true);
    }
  });

  it('rejects duplicate rule name (case-insensitive)', () => {
    const existing = [createTestRule({ name: 'Photo Rule' })];
    const input = createValidInput({ name: 'PHOTO RULE' });

    const result = createRule(existing, input);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe('duplicate_name');
    }
  });

  it('rejects invalid field path', () => {
    const input = createValidInput({
      conditions: [{ field: 'invalid.field.path', operator: 'equals', value: 'test' }],
    });

    const result = createRule([], input);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe('invalid_field_path');
    }
  });

  it('rejects invalid regex pattern', () => {
    const input = createValidInput({
      conditions: [
        { field: 'file.name', operator: 'regex', value: '[invalid(regex', caseSensitive: false },
      ],
    });

    const result = createRule([], input);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe('invalid_regex');
    }
  });

  it('rejects empty name', () => {
    const input = createValidInput({ name: '' });

    const result = createRule([], input);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe('validation_error');
    }
  });

  it('rejects empty conditions array', () => {
    const input = createValidInput({ conditions: [] });

    const result = createRule([], input);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe('validation_error');
    }
  });
});

// =============================================================================
// getRule / getRuleByName Tests
// =============================================================================

describe('getRule', () => {
  const rules = [
    createTestRule({ id: 'rule-1', name: 'Rule One' }),
    createTestRule({ id: 'rule-2', name: 'Rule Two' }),
  ];

  it('returns rule by ID', () => {
    const result = getRule(rules, 'rule-1');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.name).toBe('Rule One');
    }
  });

  it('returns error for non-existent ID', () => {
    const result = getRule(rules, 'non-existent');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe('not_found');
    }
  });
});

describe('getRuleByName', () => {
  const rules = [
    createTestRule({ id: 'rule-1', name: 'Photo Rule' }),
    createTestRule({ id: 'rule-2', name: 'Document Rule' }),
  ];

  it('returns rule by exact name', () => {
    const result = getRuleByName(rules, 'Photo Rule');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.id).toBe('rule-1');
    }
  });

  it('returns rule by name (case-insensitive)', () => {
    const result = getRuleByName(rules, 'PHOTO RULE');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.id).toBe('rule-1');
    }
  });

  it('returns error for non-existent name', () => {
    const result = getRuleByName(rules, 'Non-existent');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe('not_found');
    }
  });
});

// =============================================================================
// updateRule Tests
// =============================================================================

describe('updateRule', () => {
  let rules: MetadataPatternRule[];

  beforeEach(() => {
    rules = [
      createTestRule({ id: 'rule-1', name: 'Original Name', priority: 5 }),
      createTestRule({ id: 'rule-2', name: 'Other Rule', priority: 10 }),
    ];
  });

  it('updates rule name', () => {
    const result = updateRule(rules, 'rule-1', { name: 'New Name' });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.rule.name).toBe('New Name');
      expect(result.data.rule.id).toBe('rule-1');
      expect(result.data.rules).toHaveLength(2);
    }
  });

  it('updates rule priority', () => {
    const result = updateRule(rules, 'rule-1', { priority: 100 });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.rule.priority).toBe(100);
    }
  });

  it('updates rule conditions', () => {
    const newConditions = [
      { field: 'file.extension', operator: 'equals' as const, value: 'png', caseSensitive: false },
    ];
    const result = updateRule(rules, 'rule-1', { conditions: newConditions });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.rule.conditions).toEqual(newConditions);
    }
  });

  it('updates updatedAt timestamp', () => {
    const originalUpdatedAt = rules[0]!.updatedAt;
    const result = updateRule(rules, 'rule-1', { name: 'New Name' });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.rule.updatedAt).not.toBe(originalUpdatedAt);
    }
  });

  it('clears description when set to null', () => {
    const rulesWithDesc = [createTestRule({ id: 'rule-1', description: 'Some description' })];
    const result = updateRule(rulesWithDesc, 'rule-1', { description: null });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.rule.description).toBeUndefined();
    }
  });

  it('preserves description when undefined', () => {
    const rulesWithDesc = [createTestRule({ id: 'rule-1', description: 'Some description' })];
    const result = updateRule(rulesWithDesc, 'rule-1', { name: 'New Name' });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.rule.description).toBe('Some description');
    }
  });

  it('rejects update to duplicate name', () => {
    const result = updateRule(rules, 'rule-1', { name: 'Other Rule' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe('duplicate_name');
    }
  });

  it('allows update to same name with different case', () => {
    const result = updateRule(rules, 'rule-1', { name: 'ORIGINAL NAME' });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.rule.name).toBe('ORIGINAL NAME');
    }
  });

  it('returns error for non-existent rule', () => {
    const result = updateRule(rules, 'non-existent', { name: 'New Name' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe('not_found');
    }
  });

  it('rejects invalid field path in conditions update', () => {
    const result = updateRule(rules, 'rule-1', {
      conditions: [{ field: 'invalid.field', operator: 'equals', value: 'test' }],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe('invalid_field_path');
    }
  });
});

// =============================================================================
// deleteRule Tests
// =============================================================================

describe('deleteRule', () => {
  let rules: MetadataPatternRule[];

  beforeEach(() => {
    rules = [
      createTestRule({ id: 'rule-1', name: 'Rule One' }),
      createTestRule({ id: 'rule-2', name: 'Rule Two' }),
    ];
  });

  it('deletes a rule', () => {
    const result = deleteRule(rules, 'rule-1');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0]!.id).toBe('rule-2');
    }
  });

  it('returns error for non-existent rule', () => {
    const result = deleteRule(rules, 'non-existent');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe('not_found');
    }
  });
});

// =============================================================================
// listRules / listEnabledRules Tests
// =============================================================================

describe('listRules', () => {
  it('returns rules sorted by priority (highest first)', () => {
    const rules = [
      createTestRule({ id: 'low', priority: 1 }),
      createTestRule({ id: 'high', priority: 10 }),
      createTestRule({ id: 'medium', priority: 5 }),
    ];

    const sorted = listRules(rules);

    expect(sorted[0]!.id).toBe('high');
    expect(sorted[1]!.id).toBe('medium');
    expect(sorted[2]!.id).toBe('low');
  });

  it('returns empty array for empty input', () => {
    const sorted = listRules([]);
    expect(sorted).toHaveLength(0);
  });

  it('returns a copy, not the original array', () => {
    const rules = [createTestRule()];
    const sorted = listRules(rules);

    expect(sorted).not.toBe(rules);
  });
});

describe('listEnabledRules', () => {
  it('returns only enabled rules', () => {
    const rules = [
      createTestRule({ id: 'enabled-1', enabled: true }),
      createTestRule({ id: 'disabled', enabled: false }),
      createTestRule({ id: 'enabled-2', enabled: true }),
    ];

    const enabled = listEnabledRules(rules);

    expect(enabled).toHaveLength(2);
    expect(enabled.every((r) => r.enabled)).toBe(true);
  });

  it('returns enabled rules sorted by priority', () => {
    const rules = [
      createTestRule({ id: 'low', priority: 1, enabled: true }),
      createTestRule({ id: 'high', priority: 10, enabled: true }),
      createTestRule({ id: 'disabled', priority: 100, enabled: false }),
    ];

    const enabled = listEnabledRules(rules);

    expect(enabled[0]!.id).toBe('high');
    expect(enabled[1]!.id).toBe('low');
  });
});

// =============================================================================
// reorderRules Tests
// =============================================================================

describe('reorderRules', () => {
  let rules: MetadataPatternRule[];

  beforeEach(() => {
    rules = [
      createTestRule({ id: 'a', priority: 0 }),
      createTestRule({ id: 'b', priority: 1 }),
      createTestRule({ id: 'c', priority: 2 }),
    ];
  });

  it('reorders rules by ID array', () => {
    const result = reorderRules(rules, ['c', 'a', 'b']);

    expect(result.ok).toBe(true);
    if (result.ok) {
      const sorted = listRules(result.data);
      expect(sorted[0]!.id).toBe('c'); // highest priority
      expect(sorted[1]!.id).toBe('a');
      expect(sorted[2]!.id).toBe('b'); // lowest priority
    }
  });

  it('assigns correct priorities based on position', () => {
    const result = reorderRules(rules, ['c', 'b', 'a']);

    expect(result.ok).toBe(true);
    if (result.ok) {
      const ruleMap = new Map(result.data.map((r) => [r.id, r]));
      expect(ruleMap.get('c')!.priority).toBe(2); // first = highest
      expect(ruleMap.get('b')!.priority).toBe(1);
      expect(ruleMap.get('a')!.priority).toBe(0); // last = lowest
    }
  });

  it('returns error for non-existent ID', () => {
    const result = reorderRules(rules, ['a', 'non-existent', 'c']);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe('not_found');
    }
  });

  it('returns error for duplicate IDs', () => {
    const result = reorderRules(rules, ['a', 'a', 'b']);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe('validation_error');
    }
  });

  it('handles partial reorder (some rules not in order array)', () => {
    const result = reorderRules(rules, ['b', 'a']); // 'c' excluded

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(3);
      const cRule = result.data.find((r) => r.id === 'c');
      expect(cRule!.priority).toBe(-1); // excluded rules get -1
    }
  });
});

// =============================================================================
// setRulePriority Tests
// =============================================================================

describe('setRulePriority', () => {
  let rules: MetadataPatternRule[];

  beforeEach(() => {
    rules = [createTestRule({ id: 'rule-1', priority: 5 })];
  });

  it('sets priority for a rule', () => {
    const result = setRulePriority(rules, 'rule-1', 100);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data[0]!.priority).toBe(100);
    }
  });

  it('returns original array if priority unchanged', () => {
    const result = setRulePriority(rules, 'rule-1', 5);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toBe(rules);
    }
  });

  it('returns error for non-existent rule', () => {
    const result = setRulePriority(rules, 'non-existent', 10);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe('not_found');
    }
  });

  it('rejects negative priority', () => {
    const result = setRulePriority(rules, 'rule-1', -1);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe('validation_error');
    }
  });

  it('rejects non-integer priority', () => {
    const result = setRulePriority(rules, 'rule-1', 5.5);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe('validation_error');
    }
  });
});

// =============================================================================
// toggleRuleEnabled Tests
// =============================================================================

describe('toggleRuleEnabled', () => {
  it('toggles enabled to disabled', () => {
    const rules = [createTestRule({ id: 'rule-1', enabled: true })];
    const result = toggleRuleEnabled(rules, 'rule-1');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.enabled).toBe(false);
      expect(result.data.rules[0]!.enabled).toBe(false);
    }
  });

  it('toggles disabled to enabled', () => {
    const rules = [createTestRule({ id: 'rule-1', enabled: false })];
    const result = toggleRuleEnabled(rules, 'rule-1');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.enabled).toBe(true);
      expect(result.data.rules[0]!.enabled).toBe(true);
    }
  });

  it('updates updatedAt timestamp', () => {
    const rules = [createTestRule({ id: 'rule-1' })];
    const originalUpdatedAt = rules[0]!.updatedAt;

    const result = toggleRuleEnabled(rules, 'rule-1');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.rules[0]!.updatedAt).not.toBe(originalUpdatedAt);
    }
  });

  it('returns error for non-existent rule', () => {
    const result = toggleRuleEnabled([], 'non-existent');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe('not_found');
    }
  });
});

// =============================================================================
// Template Validation Tests - Story 7.3 AC1, AC4
// =============================================================================

describe('createRule with template validation', () => {
  const validTemplates = [
    {
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Test Template',
      pattern: '{date}-{original}',
      isDefault: true,
      createdAt: '2026-01-10T12:00:00.000Z',
      updatedAt: '2026-01-10T12:00:00.000Z',
    },
    {
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      name: 'Another Template',
      pattern: '{original}-{date}',
      isDefault: false,
      createdAt: '2026-01-10T12:00:00.000Z',
      updatedAt: '2026-01-10T12:00:00.000Z',
    },
  ];

  it('accepts rule with valid templateId when templates provided', () => {
    const input = createValidInput({
      templateId: '550e8400-e29b-41d4-a716-446655440000',
    });

    const result = createRule([], input, validTemplates);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.rule.templateId).toBe('550e8400-e29b-41d4-a716-446655440000');
    }
  });

  it('rejects rule with non-existent templateId', () => {
    const input = createValidInput({
      templateId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', // Valid UUID format, not in templates
    });

    const result = createRule([], input, validTemplates);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe('template_not_found');
      expect(result.error.message).toContain('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
    }
  });

  it('skips template validation when templates not provided', () => {
    const input = createValidInput({
      templateId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', // Valid UUID format, but not in any templates list
    });

    // Without templates array, skip validation (backward compatibility)
    const result = createRule([], input);

    expect(result.ok).toBe(true);
  });
});

describe('updateRule with template validation', () => {
  const validTemplates = [
    {
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Test Template',
      pattern: '{date}-{original}',
      isDefault: true,
      createdAt: '2026-01-10T12:00:00.000Z',
      updatedAt: '2026-01-10T12:00:00.000Z',
    },
  ];

  let rules: MetadataPatternRule[];

  beforeEach(() => {
    rules = [
      createTestRule({
        id: 'rule-1',
        templateId: '550e8400-e29b-41d4-a716-446655440000',
      }),
    ];
  });

  it('accepts update with valid templateId', () => {
    const result = updateRule(rules, 'rule-1', { name: 'Updated Name' }, validTemplates);

    expect(result.ok).toBe(true);
  });

  it('rejects update with non-existent templateId', () => {
    const result = updateRule(
      rules,
      'rule-1',
      { templateId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' },
      validTemplates
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe('template_not_found');
      expect(result.error.message).toContain('cccccccc-cccc-4ccc-8ccc-cccccccccccc');
    }
  });

  it('validates templateId when explicitly updated even if other fields unchanged', () => {
    const result = updateRule(
      rules,
      'rule-1',
      { templateId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' }, // Valid UUID, but not in templates
      validTemplates
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe('template_not_found');
    }
  });

  it('skips template validation when templates not provided', () => {
    const result = updateRule(rules, 'rule-1', { templateId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' });

    expect(result.ok).toBe(true);
  });
});
