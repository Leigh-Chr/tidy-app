/**
 * @fileoverview Tests for rule type schemas - Story 7.1
 */

import { describe, it, expect } from 'vitest';
import { ZodError } from 'zod';
import {
  RuleOperator,
  FieldNamespace,
  VALID_FIELD_PATHS,
  getAllValidFieldPaths,
  ruleConditionSchema,
  metadataPatternRuleSchema,
  createRuleInputSchema,
  updateRuleInputSchema,
  ruleEvaluationResultSchema,
  RuleErrorCode,
  createRuleError,
  parseFieldPath,
  isValidFieldPath,
  type RuleCondition,
  type MetadataPatternRule,
  type CreateRuleInput,
} from './rule.js';

// =============================================================================
// RuleOperator Tests
// =============================================================================

describe('RuleOperator', () => {
  it('defines all expected operators', () => {
    expect(RuleOperator.EQUALS).toBe('equals');
    expect(RuleOperator.CONTAINS).toBe('contains');
    expect(RuleOperator.STARTS_WITH).toBe('startsWith');
    expect(RuleOperator.ENDS_WITH).toBe('endsWith');
    expect(RuleOperator.REGEX).toBe('regex');
    expect(RuleOperator.EXISTS).toBe('exists');
    expect(RuleOperator.NOT_EXISTS).toBe('notExists');
  });
});

// =============================================================================
// FieldNamespace Tests
// =============================================================================

describe('FieldNamespace', () => {
  it('defines all expected namespaces', () => {
    expect(FieldNamespace.IMAGE).toBe('image');
    expect(FieldNamespace.PDF).toBe('pdf');
    expect(FieldNamespace.OFFICE).toBe('office');
    expect(FieldNamespace.FILE).toBe('file');
  });
});

describe('VALID_FIELD_PATHS', () => {
  it('contains image metadata paths', () => {
    expect(VALID_FIELD_PATHS.image).toContain('image.cameraMake');
    expect(VALID_FIELD_PATHS.image).toContain('image.dateTaken');
    expect(VALID_FIELD_PATHS.image).toContain('image.gps.latitude');
  });

  it('contains PDF metadata paths', () => {
    expect(VALID_FIELD_PATHS.pdf).toContain('pdf.author');
    expect(VALID_FIELD_PATHS.pdf).toContain('pdf.title');
    expect(VALID_FIELD_PATHS.pdf).toContain('pdf.pageCount');
  });

  it('contains Office metadata paths', () => {
    expect(VALID_FIELD_PATHS.office).toContain('office.creator');
    expect(VALID_FIELD_PATHS.office).toContain('office.title');
    expect(VALID_FIELD_PATHS.office).toContain('office.wordCount');
  });

  it('contains file info paths', () => {
    expect(VALID_FIELD_PATHS.file).toContain('file.name');
    expect(VALID_FIELD_PATHS.file).toContain('file.extension');
    expect(VALID_FIELD_PATHS.file).toContain('file.category');
  });
});

describe('getAllValidFieldPaths', () => {
  it('returns all field paths as flat array', () => {
    const allPaths = getAllValidFieldPaths();
    expect(allPaths).toContain('image.cameraMake');
    expect(allPaths).toContain('pdf.author');
    expect(allPaths).toContain('office.creator');
    expect(allPaths).toContain('file.extension');
  });
});

// =============================================================================
// ruleConditionSchema Tests
// =============================================================================

describe('ruleConditionSchema', () => {
  it('validates a basic equals condition', () => {
    const condition: RuleCondition = {
      field: 'image.cameraMake',
      operator: 'equals',
      value: 'Apple',
      caseSensitive: false,
    };
    expect(() => ruleConditionSchema.parse(condition)).not.toThrow();
  });

  it('validates a contains condition', () => {
    const condition = {
      field: 'pdf.author',
      operator: 'contains',
      value: 'John',
    };
    const parsed = ruleConditionSchema.parse(condition);
    expect(parsed.caseSensitive).toBe(false); // default
  });

  it('validates exists operator without value', () => {
    const condition = {
      field: 'image.gps',
      operator: 'exists',
    };
    expect(() => ruleConditionSchema.parse(condition)).not.toThrow();
  });

  it('validates notExists operator without value', () => {
    const condition = {
      field: 'pdf.keywords',
      operator: 'notExists',
    };
    expect(() => ruleConditionSchema.parse(condition)).not.toThrow();
  });

  it('validates regex operator', () => {
    const condition = {
      field: 'file.name',
      operator: 'regex',
      value: '^IMG_\\d+$',
    };
    expect(() => ruleConditionSchema.parse(condition)).not.toThrow();
  });

  it('rejects empty field path', () => {
    const condition = {
      field: '',
      operator: 'equals',
      value: 'test',
    };
    expect(() => ruleConditionSchema.parse(condition)).toThrow(ZodError);
  });

  it('rejects equals operator without value', () => {
    const condition = {
      field: 'image.cameraMake',
      operator: 'equals',
    };
    expect(() => ruleConditionSchema.parse(condition)).toThrow(ZodError);
  });

  it('rejects contains operator with empty value', () => {
    const condition = {
      field: 'image.cameraMake',
      operator: 'contains',
      value: '',
    };
    expect(() => ruleConditionSchema.parse(condition)).toThrow(ZodError);
  });

  it('rejects invalid operator', () => {
    const condition = {
      field: 'image.cameraMake',
      operator: 'invalidOp',
      value: 'test',
    };
    expect(() => ruleConditionSchema.parse(condition)).toThrow(ZodError);
  });

  it('allows caseSensitive option', () => {
    const condition = {
      field: 'file.name',
      operator: 'startsWith',
      value: 'IMG',
      caseSensitive: true,
    };
    const parsed = ruleConditionSchema.parse(condition);
    expect(parsed.caseSensitive).toBe(true);
  });
});

// =============================================================================
// metadataPatternRuleSchema Tests
// =============================================================================

describe('metadataPatternRuleSchema', () => {
  const validRule: MetadataPatternRule = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'iPhone Photos',
    description: 'Match photos taken with iPhone',
    conditions: [
      { field: 'image.cameraMake', operator: 'contains', value: 'Apple', caseSensitive: false },
    ],
    matchMode: 'all',
    templateId: '550e8400-e29b-41d4-a716-446655440001',
    priority: 10,
    enabled: true,
    createdAt: '2026-01-10T12:00:00.000Z',
    updatedAt: '2026-01-10T12:00:00.000Z',
  };

  // Story 8.2: folderStructureId tests
  it('validates rule with optional folderStructureId', () => {
    const ruleWithFolder = {
      ...validRule,
      folderStructureId: '550e8400-e29b-41d4-a716-446655440002',
    };
    const parsed = metadataPatternRuleSchema.parse(ruleWithFolder);
    expect(parsed.folderStructureId).toBe('550e8400-e29b-41d4-a716-446655440002');
  });

  it('validates rule without folderStructureId', () => {
    const parsed = metadataPatternRuleSchema.parse(validRule);
    expect(parsed.folderStructureId).toBeUndefined();
  });

  it('rejects rule with invalid folderStructureId (not UUID)', () => {
    const rule = { ...validRule, folderStructureId: 'not-a-uuid' };
    expect(() => metadataPatternRuleSchema.parse(rule)).toThrow();
  });

  it('validates a complete rule', () => {
    expect(() => metadataPatternRuleSchema.parse(validRule)).not.toThrow();
  });

  it('validates rule with multiple conditions', () => {
    const rule = {
      ...validRule,
      conditions: [
        { field: 'image.cameraMake', operator: 'contains', value: 'Apple' },
        { field: 'file.category', operator: 'equals', value: 'image' },
      ],
    };
    expect(() => metadataPatternRuleSchema.parse(rule)).not.toThrow();
  });

  it('validates rule with matchMode "any"', () => {
    const rule = { ...validRule, matchMode: 'any' };
    expect(() => metadataPatternRuleSchema.parse(rule)).not.toThrow();
  });

  it('rejects rule without conditions', () => {
    const rule = { ...validRule, conditions: [] };
    expect(() => metadataPatternRuleSchema.parse(rule)).toThrow(ZodError);
  });

  it('rejects rule with empty name', () => {
    const rule = { ...validRule, name: '' };
    expect(() => metadataPatternRuleSchema.parse(rule)).toThrow(ZodError);
  });

  it('rejects rule with name over 100 characters', () => {
    const rule = { ...validRule, name: 'a'.repeat(101) };
    expect(() => metadataPatternRuleSchema.parse(rule)).toThrow(ZodError);
  });

  it('rejects rule with invalid UUID for id', () => {
    const rule = { ...validRule, id: 'not-a-uuid' };
    expect(() => metadataPatternRuleSchema.parse(rule)).toThrow(ZodError);
  });

  it('rejects rule with invalid UUID for templateId', () => {
    const rule = { ...validRule, templateId: 'not-a-uuid' };
    expect(() => metadataPatternRuleSchema.parse(rule)).toThrow(ZodError);
  });

  it('rejects rule with negative priority', () => {
    const rule = { ...validRule, priority: -1 };
    expect(() => metadataPatternRuleSchema.parse(rule)).toThrow(ZodError);
  });

  it('rejects rule with invalid matchMode', () => {
    const rule = { ...validRule, matchMode: 'invalid' };
    expect(() => metadataPatternRuleSchema.parse(rule)).toThrow(ZodError);
  });

  it('applies default matchMode', () => {
    const rule = { ...validRule };
    delete (rule as Record<string, unknown>).matchMode;
    const parsed = metadataPatternRuleSchema.parse(rule);
    expect(parsed.matchMode).toBe('all');
  });

  it('applies default priority', () => {
    const rule = { ...validRule };
    delete (rule as Record<string, unknown>).priority;
    const parsed = metadataPatternRuleSchema.parse(rule);
    expect(parsed.priority).toBe(0);
  });

  it('applies default enabled', () => {
    const rule = { ...validRule };
    delete (rule as Record<string, unknown>).enabled;
    const parsed = metadataPatternRuleSchema.parse(rule);
    expect(parsed.enabled).toBe(true);
  });
});

// =============================================================================
// createRuleInputSchema Tests
// =============================================================================

describe('createRuleInputSchema', () => {
  it('validates minimal create input', () => {
    const input: CreateRuleInput = {
      name: 'Test Rule',
      conditions: [{ field: 'file.extension', operator: 'equals', value: 'jpg', caseSensitive: false }],
      templateId: '550e8400-e29b-41d4-a716-446655440001',
    };
    const parsed = createRuleInputSchema.parse(input);
    expect(parsed.matchMode).toBe('all');
    expect(parsed.priority).toBe(0);
    expect(parsed.enabled).toBe(true);
  });

  it('validates full create input', () => {
    const input = {
      name: 'Test Rule',
      description: 'A test rule',
      conditions: [{ field: 'file.extension', operator: 'equals', value: 'jpg' }],
      matchMode: 'any',
      templateId: '550e8400-e29b-41d4-a716-446655440001',
      priority: 5,
      enabled: false,
    };
    expect(() => createRuleInputSchema.parse(input)).not.toThrow();
  });

  // Story 8.2: folderStructureId in create input
  it('validates create input with folderStructureId', () => {
    const input = {
      name: 'Test Rule',
      conditions: [{ field: 'file.extension', operator: 'equals', value: 'jpg' }],
      templateId: '550e8400-e29b-41d4-a716-446655440001',
      folderStructureId: '550e8400-e29b-41d4-a716-446655440002',
    };
    const parsed = createRuleInputSchema.parse(input);
    expect(parsed.folderStructureId).toBe('550e8400-e29b-41d4-a716-446655440002');
  });

  it('rejects create input with invalid folderStructureId', () => {
    const input = {
      name: 'Test Rule',
      conditions: [{ field: 'file.extension', operator: 'equals', value: 'jpg' }],
      templateId: '550e8400-e29b-41d4-a716-446655440001',
      folderStructureId: 'not-a-uuid',
    };
    expect(() => createRuleInputSchema.parse(input)).toThrow();
  });
});

// =============================================================================
// updateRuleInputSchema Tests
// =============================================================================

describe('updateRuleInputSchema', () => {
  it('validates partial update with name only', () => {
    const input = { name: 'Updated Name' };
    expect(() => updateRuleInputSchema.parse(input)).not.toThrow();
  });

  it('validates partial update with conditions only', () => {
    const input = {
      conditions: [{ field: 'file.name', operator: 'contains', value: 'photo' }],
    };
    expect(() => updateRuleInputSchema.parse(input)).not.toThrow();
  });

  it('validates empty update (no fields)', () => {
    expect(() => updateRuleInputSchema.parse({})).not.toThrow();
  });

  it('allows null description to clear it', () => {
    const input = { description: null };
    expect(() => updateRuleInputSchema.parse(input)).not.toThrow();
  });

  // Story 8.2: folderStructureId in update input
  it('validates update with folderStructureId', () => {
    const input = { folderStructureId: '550e8400-e29b-41d4-a716-446655440002' };
    const parsed = updateRuleInputSchema.parse(input);
    expect(parsed.folderStructureId).toBe('550e8400-e29b-41d4-a716-446655440002');
  });

  it('allows null folderStructureId to clear it', () => {
    const input = { folderStructureId: null };
    expect(() => updateRuleInputSchema.parse(input)).not.toThrow();
  });

  it('rejects update with invalid folderStructureId', () => {
    const input = { folderStructureId: 'not-a-uuid' };
    expect(() => updateRuleInputSchema.parse(input)).toThrow();
  });
});

// =============================================================================
// ruleEvaluationResultSchema Tests
// =============================================================================

describe('ruleEvaluationResultSchema', () => {
  it('validates match result', () => {
    const result = {
      matches: true,
      matchedConditions: ['image.cameraMake', 'file.category'],
    };
    expect(() => ruleEvaluationResultSchema.parse(result)).not.toThrow();
  });

  it('validates no-match result', () => {
    const result = {
      matches: false,
      matchedConditions: [],
      unmatchedConditions: ['image.cameraMake'],
    };
    expect(() => ruleEvaluationResultSchema.parse(result)).not.toThrow();
  });
});

// =============================================================================
// RuleErrorCode Tests
// =============================================================================

describe('RuleErrorCode', () => {
  it('defines all expected error codes', () => {
    expect(RuleErrorCode.INVALID_FIELD_PATH).toBe('INVALID_FIELD_PATH');
    expect(RuleErrorCode.INVALID_REGEX).toBe('INVALID_REGEX');
    expect(RuleErrorCode.RULE_NOT_FOUND).toBe('RULE_NOT_FOUND');
    expect(RuleErrorCode.DUPLICATE_RULE_NAME).toBe('DUPLICATE_RULE_NAME');
    expect(RuleErrorCode.VALIDATION_FAILED).toBe('VALIDATION_FAILED');
    expect(RuleErrorCode.TEMPLATE_NOT_FOUND).toBe('TEMPLATE_NOT_FOUND');
  });
});

describe('createRuleError', () => {
  it('creates error with code and message', () => {
    const error = createRuleError('RULE_NOT_FOUND', 'Rule not found');
    expect(error.code).toBe('RULE_NOT_FOUND');
    expect(error.message).toBe('Rule not found');
    expect(error.details).toBeUndefined();
  });

  it('creates error with details', () => {
    const error = createRuleError('VALIDATION_FAILED', 'Invalid field', { field: 'name' });
    expect(error.code).toBe('VALIDATION_FAILED');
    expect(error.message).toBe('Invalid field');
    expect(error.details).toEqual({ field: 'name' });
  });
});

// =============================================================================
// parseFieldPath Tests
// =============================================================================

describe('parseFieldPath', () => {
  it('parses simple field path', () => {
    const result = parseFieldPath('image.cameraMake');
    expect(result.namespace).toBe('image');
    expect(result.path).toEqual(['cameraMake']);
  });

  it('parses nested field path', () => {
    const result = parseFieldPath('image.gps.latitude');
    expect(result.namespace).toBe('image');
    expect(result.path).toEqual(['gps', 'latitude']);
  });

  it('parses pdf namespace', () => {
    const result = parseFieldPath('pdf.author');
    expect(result.namespace).toBe('pdf');
    expect(result.path).toEqual(['author']);
  });

  it('parses office namespace', () => {
    const result = parseFieldPath('office.creator');
    expect(result.namespace).toBe('office');
    expect(result.path).toEqual(['creator']);
  });

  it('parses file namespace', () => {
    const result = parseFieldPath('file.extension');
    expect(result.namespace).toBe('file');
    expect(result.path).toEqual(['extension']);
  });

  it('returns null for invalid namespace', () => {
    const result = parseFieldPath('invalid.field');
    expect(result.namespace).toBeNull();
    expect(result.path).toEqual([]);
  });

  it('returns null for path without dot', () => {
    const result = parseFieldPath('image');
    expect(result.namespace).toBeNull();
    expect(result.path).toEqual([]);
  });

  it('returns null for empty string', () => {
    const result = parseFieldPath('');
    expect(result.namespace).toBeNull();
    expect(result.path).toEqual([]);
  });
});

// =============================================================================
// isValidFieldPath Tests
// =============================================================================

describe('isValidFieldPath', () => {
  it('returns true for valid image path', () => {
    expect(isValidFieldPath('image.cameraMake')).toBe(true);
  });

  it('returns true for valid pdf path', () => {
    expect(isValidFieldPath('pdf.author')).toBe(true);
  });

  it('returns true for valid office path', () => {
    expect(isValidFieldPath('office.title')).toBe(true);
  });

  it('returns true for valid file path', () => {
    expect(isValidFieldPath('file.extension')).toBe(true);
  });

  it('returns true for nested path', () => {
    expect(isValidFieldPath('image.gps.latitude')).toBe(true);
  });

  it('returns false for invalid namespace', () => {
    expect(isValidFieldPath('invalid.field')).toBe(false);
  });

  it('returns false for namespace only', () => {
    expect(isValidFieldPath('image')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isValidFieldPath('')).toBe(false);
  });
});
