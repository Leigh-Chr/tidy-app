/**
 * @fileoverview Tests for unified rule priority module - Story 7.4
 *
 * Tests for:
 * - UnifiedRule type and conversion
 * - getUnifiedRulePriorities() function
 * - setUnifiedRulePriority() function
 * - reorderUnifiedRules() function
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { AppConfig } from '../config/schema.js';
import type { MetadataPatternRule } from '../types/rule.js';
import type { FilenamePatternRule } from '../types/filename-rule.js';
import {
  getUnifiedRulePriorities,
  setUnifiedRulePriority,
  reorderUnifiedRules,
  type UnifiedRule,
  type RulePriorityError,
} from './unified-priority.js';

// =============================================================================
// Test Fixtures
// =============================================================================

const createMetadataRule = (overrides: Partial<MetadataPatternRule> = {}): MetadataPatternRule => ({
  id: 'meta-rule-1',
  name: 'Metadata Rule 1',
  conditions: [{ field: 'image.cameraMake', operator: 'equals', value: 'Apple' }],
  matchMode: 'all',
  templateId: 'template-1',
  priority: 0,
  enabled: true,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  ...overrides,
});

const createFilenameRule = (overrides: Partial<FilenamePatternRule> = {}): FilenamePatternRule => ({
  id: 'file-rule-1',
  name: 'Filename Rule 1',
  pattern: '*.jpg',
  caseSensitive: false,
  templateId: 'template-2',
  priority: 0,
  enabled: true,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  ...overrides,
});

const createConfig = (
  rules: MetadataPatternRule[] = [],
  filenameRules: FilenamePatternRule[] = [],
  rulePriorityMode: 'combined' | 'metadata-first' | 'filename-first' = 'combined'
): AppConfig => ({
  version: 1,
  templates: [
    {
      id: 'template-1',
      name: 'Template 1',
      pattern: '{date}-{original}',
      isDefault: true,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    },
    {
      id: 'template-2',
      name: 'Template 2',
      pattern: '{year}/{month}/{original}',
      isDefault: false,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    },
  ],
  preferences: {
    defaultOutputFormat: 'table',
    colorOutput: true,
    confirmBeforeApply: true,
    recursiveScan: false,
    rulePriorityMode,
  },
  recentFolders: [],
  rules,
  filenameRules,
});

// =============================================================================
// getUnifiedRulePriorities Tests
// =============================================================================

describe('getUnifiedRulePriorities', () => {
  describe('empty rules', () => {
    it('should return empty array when no rules exist', () => {
      const config = createConfig([], []);
      const result = getUnifiedRulePriorities(config);
      expect(result).toEqual([]);
    });
  });

  describe('single rule type', () => {
    it('should return metadata rules as UnifiedRule with type "metadata"', () => {
      const metaRule = createMetadataRule({ id: 'meta-1', name: 'Meta Rule', priority: 5 });
      const config = createConfig([metaRule], []);

      const result = getUnifiedRulePriorities(config);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'meta-1',
        name: 'Meta Rule',
        type: 'metadata',
        priority: 5,
        enabled: true,
        templateId: 'template-1',
      });
      expect(result[0]!.rule).toBe(metaRule);
    });

    it('should return filename rules as UnifiedRule with type "filename"', () => {
      const fileRule = createFilenameRule({ id: 'file-1', name: 'File Rule', priority: 3 });
      const config = createConfig([], [fileRule]);

      const result = getUnifiedRulePriorities(config);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'file-1',
        name: 'File Rule',
        type: 'filename',
        priority: 3,
        enabled: true,
        templateId: 'template-2',
      });
      expect(result[0]!.rule).toBe(fileRule);
    });
  });

  describe('combined mode sorting', () => {
    it('should sort all rules by priority descending in combined mode', () => {
      const metaRule1 = createMetadataRule({ id: 'meta-1', priority: 10 });
      const metaRule2 = createMetadataRule({ id: 'meta-2', name: 'Meta 2', priority: 5 });
      const fileRule1 = createFilenameRule({ id: 'file-1', priority: 8 });
      const fileRule2 = createFilenameRule({ id: 'file-2', name: 'File 2', priority: 3 });

      const config = createConfig([metaRule1, metaRule2], [fileRule1, fileRule2], 'combined');
      const result = getUnifiedRulePriorities(config);

      expect(result.map((r) => r.id)).toEqual(['meta-1', 'file-1', 'meta-2', 'file-2']);
      expect(result.map((r) => r.priority)).toEqual([10, 8, 5, 3]);
    });

    it('should break priority ties by createdAt (older first)', () => {
      const metaRule = createMetadataRule({
        id: 'meta-1',
        priority: 5,
        createdAt: '2024-01-02T00:00:00.000Z',
      });
      const fileRule = createFilenameRule({
        id: 'file-1',
        priority: 5,
        createdAt: '2024-01-01T00:00:00.000Z',
      });

      const config = createConfig([metaRule], [fileRule], 'combined');
      const result = getUnifiedRulePriorities(config);

      // Older rule (fileRule) should come first when priorities are equal
      expect(result.map((r) => r.id)).toEqual(['file-1', 'meta-1']);
    });
  });

  describe('metadata-first mode', () => {
    it('should list metadata rules before filename rules', () => {
      const metaRule = createMetadataRule({ id: 'meta-1', priority: 1 });
      const fileRule = createFilenameRule({ id: 'file-1', priority: 10 });

      const config = createConfig([metaRule], [fileRule], 'metadata-first');
      const result = getUnifiedRulePriorities(config);

      // Metadata rules first, regardless of priority
      expect(result.map((r) => r.id)).toEqual(['meta-1', 'file-1']);
    });

    it('should sort within each type by priority', () => {
      const metaRule1 = createMetadataRule({ id: 'meta-1', priority: 5 });
      const metaRule2 = createMetadataRule({ id: 'meta-2', name: 'Meta 2', priority: 10 });
      const fileRule1 = createFilenameRule({ id: 'file-1', priority: 3 });
      const fileRule2 = createFilenameRule({ id: 'file-2', name: 'File 2', priority: 8 });

      const config = createConfig([metaRule1, metaRule2], [fileRule1, fileRule2], 'metadata-first');
      const result = getUnifiedRulePriorities(config);

      expect(result.map((r) => r.id)).toEqual(['meta-2', 'meta-1', 'file-2', 'file-1']);
    });
  });

  describe('filename-first mode', () => {
    it('should list filename rules before metadata rules', () => {
      const metaRule = createMetadataRule({ id: 'meta-1', priority: 10 });
      const fileRule = createFilenameRule({ id: 'file-1', priority: 1 });

      const config = createConfig([metaRule], [fileRule], 'filename-first');
      const result = getUnifiedRulePriorities(config);

      // Filename rules first, regardless of priority
      expect(result.map((r) => r.id)).toEqual(['file-1', 'meta-1']);
    });

    it('should sort within each type by priority', () => {
      const metaRule1 = createMetadataRule({ id: 'meta-1', priority: 5 });
      const metaRule2 = createMetadataRule({ id: 'meta-2', name: 'Meta 2', priority: 10 });
      const fileRule1 = createFilenameRule({ id: 'file-1', priority: 3 });
      const fileRule2 = createFilenameRule({ id: 'file-2', name: 'File 2', priority: 8 });

      const config = createConfig([metaRule1, metaRule2], [fileRule1, fileRule2], 'filename-first');
      const result = getUnifiedRulePriorities(config);

      expect(result.map((r) => r.id)).toEqual(['file-2', 'file-1', 'meta-2', 'meta-1']);
    });
  });
});

// =============================================================================
// setUnifiedRulePriority Tests
// =============================================================================

describe('setUnifiedRulePriority', () => {
  describe('metadata rules', () => {
    it('should update priority of a metadata rule', () => {
      const metaRule = createMetadataRule({ id: 'meta-1', priority: 5 });
      const config = createConfig([metaRule], []);

      const result = setUnifiedRulePriority(config, 'meta-1', 10);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.rules[0]!.priority).toBe(10);
        expect(result.data.rules[0]!.updatedAt).not.toBe(metaRule.updatedAt);
      }
    });
  });

  describe('filename rules', () => {
    it('should update priority of a filename rule', () => {
      const fileRule = createFilenameRule({ id: 'file-1', priority: 3 });
      const config = createConfig([], [fileRule]);

      const result = setUnifiedRulePriority(config, 'file-1', 7);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.filenameRules[0]!.priority).toBe(7);
        expect(result.data.filenameRules[0]!.updatedAt).not.toBe(fileRule.updatedAt);
      }
    });
  });

  describe('error handling', () => {
    it('should return error for non-existent rule ID', () => {
      const config = createConfig([], []);

      const result = setUnifiedRulePriority(config, 'non-existent', 5);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('rule_not_found');
        expect(result.error.message).toContain('non-existent');
      }
    });

    it('should return error for negative priority', () => {
      const metaRule = createMetadataRule({ id: 'meta-1' });
      const config = createConfig([metaRule], []);

      const result = setUnifiedRulePriority(config, 'meta-1', -1);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('invalid_priority');
      }
    });

    it('should return error for non-integer priority', () => {
      const metaRule = createMetadataRule({ id: 'meta-1' });
      const config = createConfig([metaRule], []);

      const result = setUnifiedRulePriority(config, 'meta-1', 5.5);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('invalid_priority');
      }
    });
  });

  describe('no-op when priority unchanged', () => {
    it('should return unchanged config when priority is same', () => {
      const metaRule = createMetadataRule({ id: 'meta-1', priority: 5 });
      const config = createConfig([metaRule], []);

      const result = setUnifiedRulePriority(config, 'meta-1', 5);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Should return same config object since no change
        expect(result.data.rules[0]!.updatedAt).toBe(metaRule.updatedAt);
      }
    });
  });
});

// =============================================================================
// reorderUnifiedRules Tests
// =============================================================================

describe('reorderUnifiedRules', () => {
  describe('mixed rule types', () => {
    it('should reorder rules across types', () => {
      const metaRule1 = createMetadataRule({ id: 'meta-1', priority: 0 });
      const metaRule2 = createMetadataRule({ id: 'meta-2', name: 'Meta 2', priority: 1 });
      const fileRule1 = createFilenameRule({ id: 'file-1', priority: 2 });
      const fileRule2 = createFilenameRule({ id: 'file-2', name: 'File 2', priority: 3 });

      const config = createConfig([metaRule1, metaRule2], [fileRule1, fileRule2]);

      // New order: file-1, meta-2, meta-1, file-2
      const result = reorderUnifiedRules(config, ['file-1', 'meta-2', 'meta-1', 'file-2']);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Get unified view to verify order
        const unified = getUnifiedRulePriorities(result.data);
        expect(unified.map((r) => r.id)).toEqual(['file-1', 'meta-2', 'meta-1', 'file-2']);
      }
    });

    it('should assign priorities based on position (first = highest)', () => {
      const metaRule = createMetadataRule({ id: 'meta-1', priority: 0 });
      const fileRule = createFilenameRule({ id: 'file-1', priority: 0 });

      const config = createConfig([metaRule], [fileRule]);

      const result = reorderUnifiedRules(config, ['file-1', 'meta-1']);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // file-1 should have highest priority (1)
        // meta-1 should have lower priority (0)
        expect(result.data.filenameRules[0]!.priority).toBe(1);
        expect(result.data.rules[0]!.priority).toBe(0);
      }
    });
  });

  describe('partial reorder', () => {
    it('should handle subset of rule IDs', () => {
      const metaRule1 = createMetadataRule({ id: 'meta-1', priority: 5 });
      const metaRule2 = createMetadataRule({ id: 'meta-2', name: 'Meta 2', priority: 3 });
      const fileRule = createFilenameRule({ id: 'file-1', priority: 10 });

      const config = createConfig([metaRule1, metaRule2], [fileRule]);

      // Only reorder some rules
      const result = reorderUnifiedRules(config, ['meta-2', 'meta-1']);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // meta-2 should be highest in the specified list
        expect(result.data.rules.find((r) => r.id === 'meta-2')!.priority).toBe(1);
        expect(result.data.rules.find((r) => r.id === 'meta-1')!.priority).toBe(0);
        // file-1 not in list, should be demoted (priority -1)
        expect(result.data.filenameRules[0]!.priority).toBe(-1);
      }
    });
  });

  describe('error handling', () => {
    it('should return error for non-existent rule ID', () => {
      const metaRule = createMetadataRule({ id: 'meta-1' });
      const config = createConfig([metaRule], []);

      const result = reorderUnifiedRules(config, ['meta-1', 'non-existent']);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('rule_not_found');
        expect(result.error.message).toContain('non-existent');
      }
    });

    it('should return error for duplicate IDs', () => {
      const metaRule = createMetadataRule({ id: 'meta-1' });
      const config = createConfig([metaRule], []);

      const result = reorderUnifiedRules(config, ['meta-1', 'meta-1']);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('duplicate_ids');
      }
    });

    it('should return empty config unchanged for empty order array', () => {
      const metaRule = createMetadataRule({ id: 'meta-1', priority: 5 });
      const config = createConfig([metaRule], []);

      const result = reorderUnifiedRules(config, []);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Rule not in list should be demoted
        expect(result.data.rules[0]!.priority).toBe(-1);
      }
    });
  });
});

// =============================================================================
// UnifiedRule Type Tests
// =============================================================================

describe('UnifiedRule type', () => {
  it('should expose original rule reference', () => {
    const metaRule = createMetadataRule({ id: 'meta-1' });
    const config = createConfig([metaRule], []);

    const unified = getUnifiedRulePriorities(config);

    expect(unified[0]!.rule).toBe(metaRule);
  });

  it('should include description from original rule', () => {
    const metaRule = createMetadataRule({
      id: 'meta-1',
      description: 'Test description',
    });
    const config = createConfig([metaRule], []);

    const unified = getUnifiedRulePriorities(config);

    // Access description through the original rule reference
    expect((unified[0]!.rule as MetadataPatternRule).description).toBe('Test description');
  });
});
