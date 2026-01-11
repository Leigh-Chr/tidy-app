/**
 * @fileoverview Tests for rule evaluator - Story 7.1
 */

import { describe, it, expect } from 'vitest';
import {
  evaluateRule,
  findMatchingRule,
  findAllMatchingRules,
  evaluateAllRules,
} from './evaluator.js';
import type { MetadataPatternRule } from '../types/rule.js';
import type { UnifiedMetadata } from '../types/unified-metadata.js';
import { FileCategory } from '../types/file-category.js';
import { MetadataCapability } from '../types/metadata-capability.js';

// =============================================================================
// Test Fixtures
// =============================================================================

function createTestMetadata(): UnifiedMetadata {
  return {
    file: {
      path: '/photos/IMG_1234.jpg',
      name: 'IMG_1234',
      extension: 'jpg',
      fullName: 'IMG_1234.jpg',
      size: 2500000,
      createdAt: new Date('2026-01-10T10:00:00Z'),
      modifiedAt: new Date('2026-01-10T11:00:00Z'),
      relativePath: 'photos/IMG_1234.jpg',
      mimeType: 'image/jpeg',
      category: FileCategory.IMAGE,
      metadataSupported: true,
      metadataCapability: MetadataCapability.FULL,
    },
    image: {
      dateTaken: new Date('2026-01-05T14:30:00Z'),
      cameraMake: 'Apple',
      cameraModel: 'iPhone 15 Pro',
      gps: { latitude: 48.8584, longitude: 2.2945 },
      width: 4032,
      height: 3024,
      orientation: 1,
      exposureTime: '1/125',
      fNumber: 1.78,
      iso: 100,
    },
    pdf: null,
    office: null,
    extractionStatus: 'success',
    extractionError: null,
  };
}

function createTestRule(overrides: Partial<MetadataPatternRule> = {}): MetadataPatternRule {
  return {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Test Rule',
    conditions: [
      { field: 'image.cameraMake', operator: 'equals', value: 'Apple', caseSensitive: false },
    ],
    matchMode: 'all',
    templateId: '550e8400-e29b-41d4-a716-446655440001',
    priority: 0,
    enabled: true,
    createdAt: '2026-01-10T12:00:00.000Z',
    updatedAt: '2026-01-10T12:00:00.000Z',
    ...overrides,
  };
}

// =============================================================================
// evaluateRule Tests
// =============================================================================

describe('evaluateRule', () => {
  const metadata = createTestMetadata();

  describe('single condition rules', () => {
    it('matches when condition is satisfied', () => {
      const rule = createTestRule();

      const result = evaluateRule(rule, metadata);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.matches).toBe(true);
        expect(result.data.matchedConditions).toContain('image.cameraMake');
      }
    });

    it('does not match when condition fails', () => {
      const rule = createTestRule({
        conditions: [
          { field: 'image.cameraMake', operator: 'equals', value: 'Samsung', caseSensitive: false },
        ],
      });

      const result = evaluateRule(rule, metadata);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.matches).toBe(false);
        expect(result.data.unmatchedConditions).toContain('image.cameraMake');
      }
    });
  });

  describe('matchMode: all (AND logic)', () => {
    it('matches when all conditions are satisfied', () => {
      const rule = createTestRule({
        matchMode: 'all',
        conditions: [
          { field: 'image.cameraMake', operator: 'equals', value: 'Apple', caseSensitive: false },
          { field: 'file.category', operator: 'equals', value: 'image', caseSensitive: false },
          { field: 'file.extension', operator: 'equals', value: 'jpg', caseSensitive: false },
        ],
      });

      const result = evaluateRule(rule, metadata);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.matches).toBe(true);
        expect(result.data.matchedConditions).toHaveLength(3);
      }
    });

    it('does not match when one condition fails', () => {
      const rule = createTestRule({
        matchMode: 'all',
        conditions: [
          { field: 'image.cameraMake', operator: 'equals', value: 'Apple', caseSensitive: false },
          { field: 'image.cameraMake', operator: 'equals', value: 'Samsung', caseSensitive: false }, // This fails
        ],
      });

      const result = evaluateRule(rule, metadata);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.matches).toBe(false);
      }
    });

    it('short-circuits on first failure', () => {
      const rule = createTestRule({
        matchMode: 'all',
        conditions: [
          { field: 'file.extension', operator: 'equals', value: 'png', caseSensitive: false }, // Fails first
          { field: 'image.cameraMake', operator: 'equals', value: 'Apple', caseSensitive: false },
        ],
      });

      const result = evaluateRule(rule, metadata);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.matches).toBe(false);
        // Should short-circuit after first condition
        expect(result.data.unmatchedConditions).toContain('file.extension');
      }
    });
  });

  describe('matchMode: any (OR logic)', () => {
    it('matches when any condition is satisfied', () => {
      const rule = createTestRule({
        matchMode: 'any',
        conditions: [
          { field: 'image.cameraMake', operator: 'equals', value: 'Samsung', caseSensitive: false }, // Fails
          { field: 'image.cameraMake', operator: 'equals', value: 'Apple', caseSensitive: false }, // Matches
        ],
      });

      const result = evaluateRule(rule, metadata);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.matches).toBe(true);
      }
    });

    it('does not match when all conditions fail', () => {
      const rule = createTestRule({
        matchMode: 'any',
        conditions: [
          { field: 'image.cameraMake', operator: 'equals', value: 'Samsung', caseSensitive: false },
          { field: 'image.cameraMake', operator: 'equals', value: 'Sony', caseSensitive: false },
        ],
      });

      const result = evaluateRule(rule, metadata);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.matches).toBe(false);
      }
    });

    it('short-circuits on first match', () => {
      const rule = createTestRule({
        matchMode: 'any',
        conditions: [
          { field: 'image.cameraMake', operator: 'equals', value: 'Apple', caseSensitive: false }, // Matches first
          { field: 'file.extension', operator: 'equals', value: 'png', caseSensitive: false },
        ],
      });

      const result = evaluateRule(rule, metadata);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.matches).toBe(true);
        expect(result.data.matchedConditions).toContain('image.cameraMake');
      }
    });
  });

  describe('disabled rules', () => {
    it('returns error for disabled rule', () => {
      const rule = createTestRule({ enabled: false });

      const result = evaluateRule(rule, metadata);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('RULE_DISABLED');
        expect(result.error.ruleId).toBe(rule.id);
      }
    });
  });

  describe('error handling', () => {
    it('reports condition errors', () => {
      const rule = createTestRule({
        conditions: [
          { field: 'file.name', operator: 'regex', value: '[invalid(regex', caseSensitive: false },
        ],
      });

      const result = evaluateRule(rule, metadata);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('CONDITION_ERROR');
        expect(result.error.conditionErrors).toHaveLength(1);
      }
    });
  });

  describe('exists/notExists in rules', () => {
    it('matches with exists condition', () => {
      const rule = createTestRule({
        conditions: [
          { field: 'image.gps', operator: 'exists', caseSensitive: false },
        ],
      });

      const result = evaluateRule(rule, metadata);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.matches).toBe(true);
      }
    });

    it('matches with notExists for missing field', () => {
      const rule = createTestRule({
        conditions: [
          { field: 'pdf.author', operator: 'notExists', caseSensitive: false },
        ],
      });

      const result = evaluateRule(rule, metadata);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.matches).toBe(true);
      }
    });
  });
});

// =============================================================================
// findMatchingRule Tests
// =============================================================================

describe('findMatchingRule', () => {
  const metadata = createTestMetadata();

  it('returns first matching rule by priority', () => {
    const rules: MetadataPatternRule[] = [
      createTestRule({
        id: 'rule-1',
        name: 'Low Priority',
        priority: 1,
        conditions: [{ field: 'image.cameraMake', operator: 'equals', value: 'Apple', caseSensitive: false }],
      }),
      createTestRule({
        id: 'rule-2',
        name: 'High Priority',
        priority: 10,
        conditions: [{ field: 'file.category', operator: 'equals', value: 'image', caseSensitive: false }],
      }),
    ];

    const result = findMatchingRule(rules, metadata);

    expect(result).not.toBeNull();
    expect(result?.id).toBe('rule-2'); // Higher priority
  });

  it('returns null when no rules match', () => {
    const rules: MetadataPatternRule[] = [
      createTestRule({
        conditions: [{ field: 'image.cameraMake', operator: 'equals', value: 'Samsung', caseSensitive: false }],
      }),
    ];

    const result = findMatchingRule(rules, metadata);

    expect(result).toBeNull();
  });

  it('skips disabled rules', () => {
    const rules: MetadataPatternRule[] = [
      createTestRule({
        id: 'disabled-rule',
        priority: 100,
        enabled: false,
        conditions: [{ field: 'image.cameraMake', operator: 'equals', value: 'Apple', caseSensitive: false }],
      }),
      createTestRule({
        id: 'enabled-rule',
        priority: 1,
        enabled: true,
        conditions: [{ field: 'image.cameraMake', operator: 'equals', value: 'Apple', caseSensitive: false }],
      }),
    ];

    const result = findMatchingRule(rules, metadata);

    expect(result?.id).toBe('enabled-rule');
  });

  it('returns null for empty rules array', () => {
    const result = findMatchingRule([], metadata);
    expect(result).toBeNull();
  });
});

// =============================================================================
// findAllMatchingRules Tests
// =============================================================================

describe('findAllMatchingRules', () => {
  const metadata = createTestMetadata();

  it('returns all matching rules sorted by priority', () => {
    const rules: MetadataPatternRule[] = [
      createTestRule({
        id: 'rule-1',
        priority: 1,
        conditions: [{ field: 'image.cameraMake', operator: 'contains', value: 'Apple', caseSensitive: false }],
      }),
      createTestRule({
        id: 'rule-2',
        priority: 10,
        conditions: [{ field: 'file.category', operator: 'equals', value: 'image', caseSensitive: false }],
      }),
      createTestRule({
        id: 'rule-3',
        priority: 5,
        conditions: [{ field: 'file.extension', operator: 'equals', value: 'jpg', caseSensitive: false }],
      }),
    ];

    const results = findAllMatchingRules(rules, metadata);

    expect(results).toHaveLength(3);
    expect(results[0].rule.id).toBe('rule-2'); // Priority 10
    expect(results[1].rule.id).toBe('rule-3'); // Priority 5
    expect(results[2].rule.id).toBe('rule-1'); // Priority 1
  });

  it('excludes non-matching rules', () => {
    const rules: MetadataPatternRule[] = [
      createTestRule({
        id: 'matching',
        conditions: [{ field: 'image.cameraMake', operator: 'equals', value: 'Apple', caseSensitive: false }],
      }),
      createTestRule({
        id: 'non-matching',
        conditions: [{ field: 'image.cameraMake', operator: 'equals', value: 'Samsung', caseSensitive: false }],
      }),
    ];

    const results = findAllMatchingRules(rules, metadata);

    expect(results).toHaveLength(1);
    expect(results[0].rule.id).toBe('matching');
  });

  it('skips disabled rules', () => {
    const rules: MetadataPatternRule[] = [
      createTestRule({ id: 'enabled', enabled: true }),
      createTestRule({ id: 'disabled', enabled: false }),
    ];

    const results = findAllMatchingRules(rules, metadata);

    expect(results).toHaveLength(1);
    expect(results[0].rule.id).toBe('enabled');
  });

  it('returns empty array for empty rules', () => {
    const results = findAllMatchingRules([], metadata);
    expect(results).toHaveLength(0);
  });
});

// =============================================================================
// evaluateAllRules Tests
// =============================================================================

describe('evaluateAllRules', () => {
  const metadata = createTestMetadata();

  it('returns results for all rules', () => {
    const rules: MetadataPatternRule[] = [
      createTestRule({ id: 'rule-1' }),
      createTestRule({ id: 'rule-2' }),
    ];

    const results = evaluateAllRules(rules, metadata);

    expect(results.size).toBe(2);
    expect(results.has('rule-1')).toBe(true);
    expect(results.has('rule-2')).toBe(true);
  });

  it('includes disabled rule errors', () => {
    const rules: MetadataPatternRule[] = [
      createTestRule({ id: 'enabled', enabled: true }),
      createTestRule({ id: 'disabled', enabled: false }),
    ];

    const results = evaluateAllRules(rules, metadata);

    const enabledResult = results.get('enabled');
    const disabledResult = results.get('disabled');

    expect(enabledResult?.ok).toBe(true);
    expect(disabledResult?.ok).toBe(false);
    if (!disabledResult?.ok) {
      expect(disabledResult?.error.code).toBe('RULE_DISABLED');
    }
  });

  it('returns empty map for empty rules', () => {
    const results = evaluateAllRules([], metadata);
    expect(results.size).toBe(0);
  });
});
