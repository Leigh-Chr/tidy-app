/**
 * @fileoverview Unit tests for filename rule type definitions - Story 7.2
 */

import { describe, expect, it } from 'vitest';
import {
  validateGlobPattern,
  isValidGlobPattern,
  FilenameRuleErrorCode,
  createFilenameRuleError,
  filenamePatternRuleSchema,
  createFilenameRuleInputSchema,
  updateFilenameRuleInputSchema,
  filenameRuleEvaluationResultSchema,
  type FilenamePatternRule,
  type CreateFilenameRuleInput,
  type UpdateFilenameRuleInput,
} from './filename-rule.js';

// =============================================================================
// Pattern Validation Tests
// =============================================================================

describe('validateGlobPattern', () => {
  describe('valid patterns', () => {
    it('should accept simple wildcard patterns', () => {
      expect(validateGlobPattern('*.txt')).toEqual({ valid: true });
      expect(validateGlobPattern('file*')).toEqual({ valid: true });
      expect(validateGlobPattern('*.*')).toEqual({ valid: true });
      expect(validateGlobPattern('***')).toEqual({ valid: true });
    });

    it('should accept single character wildcard patterns', () => {
      expect(validateGlobPattern('file?.txt')).toEqual({ valid: true });
      expect(validateGlobPattern('???.jpg')).toEqual({ valid: true });
      expect(validateGlobPattern('a?b?c')).toEqual({ valid: true });
    });

    it('should accept character class patterns', () => {
      expect(validateGlobPattern('[abc].txt')).toEqual({ valid: true });
      expect(validateGlobPattern('[a-z].txt')).toEqual({ valid: true });
      expect(validateGlobPattern('[0-9][0-9].txt')).toEqual({ valid: true });
      expect(validateGlobPattern('[!abc].txt')).toEqual({ valid: true });
      expect(validateGlobPattern('[a-zA-Z0-9].txt')).toEqual({ valid: true });
    });

    it('should accept brace expansion patterns', () => {
      expect(validateGlobPattern('*.{jpg,png}')).toEqual({ valid: true });
      expect(validateGlobPattern('{a,b,c}.txt')).toEqual({ valid: true });
      expect(validateGlobPattern('file.{jpg,jpeg,png,gif}')).toEqual({ valid: true });
    });

    it('should accept combined patterns', () => {
      expect(validateGlobPattern('IMG_*.{jpg,jpeg}')).toEqual({ valid: true });
      expect(validateGlobPattern('[0-9][0-9][0-9][0-9]_*.{jpg,png}')).toEqual({ valid: true });
      expect(validateGlobPattern('*_vacation_*.{jpg,png}')).toEqual({ valid: true });
    });

    it('should accept patterns with escaped characters', () => {
      expect(validateGlobPattern('file\\[1\\].txt')).toEqual({ valid: true });
      expect(validateGlobPattern('file\\{a\\}.txt')).toEqual({ valid: true });
      expect(validateGlobPattern('file\\*.txt')).toEqual({ valid: true });
    });

    it('should accept patterns with regular text', () => {
      expect(validateGlobPattern('exact-filename.txt')).toEqual({ valid: true });
      expect(validateGlobPattern('file_name-123.doc')).toEqual({ valid: true });
    });
  });

  describe('invalid patterns', () => {
    it('should reject empty patterns', () => {
      const result = validateGlobPattern('');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('empty');
    });

    it('should reject whitespace-only patterns', () => {
      expect(validateGlobPattern('   ')).toEqual({
        valid: false,
        error: 'Pattern cannot be empty or whitespace-only',
      });
      expect(validateGlobPattern('\t\n')).toEqual({
        valid: false,
        error: 'Pattern cannot be empty or whitespace-only',
      });
    });

    it('should reject unclosed brackets', () => {
      const result = validateGlobPattern('[abc.txt');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Unclosed character class');
      expect(result.position).toBe(0);
    });

    it('should reject unclosed braces', () => {
      const result = validateGlobPattern('*.{jpg,png');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Unclosed brace expansion');
    });

    it('should reject empty character classes', () => {
      const result = validateGlobPattern('[].txt');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Empty character class');
    });

    it('should reject empty alternatives in braces', () => {
      const result = validateGlobPattern('*.{jpg,,png}');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Empty alternative');
    });

    it('should reject trailing comma in braces', () => {
      const result = validateGlobPattern('*.{jpg,png,}');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Trailing comma');
    });

    it('should reject completely empty brace expansion', () => {
      const result = validateGlobPattern('*.{,}');
      expect(result.valid).toBe(false);
    });
  });
});

describe('isValidGlobPattern', () => {
  it('should return true for valid patterns', () => {
    expect(isValidGlobPattern('*.txt')).toBe(true);
    expect(isValidGlobPattern('IMG_*.{jpg,png}')).toBe(true);
  });

  it('should return false for invalid patterns', () => {
    expect(isValidGlobPattern('')).toBe(false);
    expect(isValidGlobPattern('[unclosed')).toBe(false);
  });
});

// =============================================================================
// Error Type Tests
// =============================================================================

describe('FilenameRuleErrorCode', () => {
  it('should define all expected error codes', () => {
    expect(FilenameRuleErrorCode.INVALID_PATTERN).toBe('INVALID_PATTERN');
    expect(FilenameRuleErrorCode.RULE_NOT_FOUND).toBe('RULE_NOT_FOUND');
    expect(FilenameRuleErrorCode.DUPLICATE_RULE_NAME).toBe('DUPLICATE_RULE_NAME');
    expect(FilenameRuleErrorCode.VALIDATION_FAILED).toBe('VALIDATION_FAILED');
    expect(FilenameRuleErrorCode.TEMPLATE_NOT_FOUND).toBe('TEMPLATE_NOT_FOUND');
  });
});

describe('createFilenameRuleError', () => {
  it('should create error with code and message', () => {
    const error = createFilenameRuleError(
      FilenameRuleErrorCode.INVALID_PATTERN,
      'Invalid pattern syntax'
    );
    expect(error.code).toBe('INVALID_PATTERN');
    expect(error.message).toBe('Invalid pattern syntax');
    expect(error.details).toBeUndefined();
  });

  it('should create error with details', () => {
    const error = createFilenameRuleError(
      FilenameRuleErrorCode.RULE_NOT_FOUND,
      'Rule not found',
      { ruleId: '123' }
    );
    expect(error.code).toBe('RULE_NOT_FOUND');
    expect(error.message).toBe('Rule not found');
    expect(error.details).toEqual({ ruleId: '123' });
  });
});

// =============================================================================
// Schema Validation Tests
// =============================================================================

describe('filenamePatternRuleSchema', () => {
  const validRule: FilenamePatternRule = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'iPhone Photos',
    description: 'Match iPhone photo files',
    pattern: 'IMG_*.{jpg,jpeg,heic}',
    caseSensitive: false,
    templateId: '550e8400-e29b-41d4-a716-446655440001',
    priority: 10,
    enabled: true,
    createdAt: '2026-01-10T10:00:00.000Z',
    updatedAt: '2026-01-10T10:00:00.000Z',
  };

  it('should accept valid rule', () => {
    const result = filenamePatternRuleSchema.safeParse(validRule);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(validRule);
    }
  });

  // Story 8.2: folderStructureId tests
  it('should accept rule with optional folderStructureId', () => {
    const ruleWithFolder = {
      ...validRule,
      folderStructureId: '550e8400-e29b-41d4-a716-446655440002',
    };
    const result = filenamePatternRuleSchema.safeParse(ruleWithFolder);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.folderStructureId).toBe('550e8400-e29b-41d4-a716-446655440002');
    }
  });

  it('should accept rule without folderStructureId', () => {
    const result = filenamePatternRuleSchema.safeParse(validRule);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.folderStructureId).toBeUndefined();
    }
  });

  it('should reject rule with invalid folderStructureId (not UUID)', () => {
    const rule = { ...validRule, folderStructureId: 'not-a-uuid' };
    const result = filenamePatternRuleSchema.safeParse(rule);
    expect(result.success).toBe(false);
  });

  it('should require id to be UUID', () => {
    const invalid = { ...validRule, id: 'not-a-uuid' };
    const result = filenamePatternRuleSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should require name to be non-empty', () => {
    const invalid = { ...validRule, name: '' };
    const result = filenamePatternRuleSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should enforce name max length of 100', () => {
    const invalid = { ...validRule, name: 'a'.repeat(101) };
    const result = filenamePatternRuleSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should require pattern to be valid glob syntax', () => {
    const invalid = { ...validRule, pattern: '[unclosed' };
    const result = filenamePatternRuleSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should reject empty pattern', () => {
    const invalid = { ...validRule, pattern: '' };
    const result = filenamePatternRuleSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should require templateId to be UUID', () => {
    const invalid = { ...validRule, templateId: 'not-a-uuid' };
    const result = filenamePatternRuleSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should enforce priority >= 0', () => {
    const invalid = { ...validRule, priority: -1 };
    const result = filenamePatternRuleSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should require datetime format for timestamps', () => {
    const invalid = { ...validRule, createdAt: 'invalid-date' };
    const result = filenamePatternRuleSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should default caseSensitive to false', () => {
    const withoutCaseSensitive = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Test',
      pattern: '*.txt',
      templateId: '550e8400-e29b-41d4-a716-446655440001',
      priority: 0,
      enabled: true,
      createdAt: '2026-01-10T10:00:00.000Z',
      updatedAt: '2026-01-10T10:00:00.000Z',
    };
    const result = filenamePatternRuleSchema.safeParse(withoutCaseSensitive);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.caseSensitive).toBe(false);
    }
  });

  it('should default priority to 0', () => {
    const withoutPriority = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Test',
      pattern: '*.txt',
      caseSensitive: false,
      templateId: '550e8400-e29b-41d4-a716-446655440001',
      enabled: true,
      createdAt: '2026-01-10T10:00:00.000Z',
      updatedAt: '2026-01-10T10:00:00.000Z',
    };
    const result = filenamePatternRuleSchema.safeParse(withoutPriority);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.priority).toBe(0);
    }
  });

  it('should default enabled to true', () => {
    const withoutEnabled = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Test',
      pattern: '*.txt',
      caseSensitive: false,
      templateId: '550e8400-e29b-41d4-a716-446655440001',
      priority: 0,
      createdAt: '2026-01-10T10:00:00.000Z',
      updatedAt: '2026-01-10T10:00:00.000Z',
    };
    const result = filenamePatternRuleSchema.safeParse(withoutEnabled);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.enabled).toBe(true);
    }
  });

  it('should allow optional description', () => {
    const withoutDescription = { ...validRule };
    delete (withoutDescription as Partial<FilenamePatternRule>).description;
    const result = filenamePatternRuleSchema.safeParse(withoutDescription);
    expect(result.success).toBe(true);
  });
});

describe('createFilenameRuleInputSchema', () => {
  const validInput: CreateFilenameRuleInput = {
    name: 'Test Rule',
    pattern: '*.pdf',
    templateId: '550e8400-e29b-41d4-a716-446655440001',
  };

  it('should accept valid input with minimal fields', () => {
    const result = createFilenameRuleInputSchema.safeParse(validInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Test Rule');
      expect(result.data.pattern).toBe('*.pdf');
      expect(result.data.caseSensitive).toBe(false);
      expect(result.data.priority).toBe(0);
      expect(result.data.enabled).toBe(true);
    }
  });

  it('should accept valid input with all fields', () => {
    const fullInput: CreateFilenameRuleInput = {
      name: 'Full Rule',
      description: 'A complete rule',
      pattern: 'IMG_*.{jpg,png}',
      caseSensitive: true,
      templateId: '550e8400-e29b-41d4-a716-446655440001',
      priority: 5,
      enabled: false,
    };
    const result = createFilenameRuleInputSchema.safeParse(fullInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.caseSensitive).toBe(true);
      expect(result.data.priority).toBe(5);
      expect(result.data.enabled).toBe(false);
    }
  });

  it('should reject input with invalid pattern', () => {
    const invalid = { ...validInput, pattern: '[unclosed' };
    const result = createFilenameRuleInputSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should reject input with invalid templateId', () => {
    const invalid = { ...validInput, templateId: 'not-uuid' };
    const result = createFilenameRuleInputSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  // Story 8.2: folderStructureId in create input
  it('should accept input with folderStructureId', () => {
    const input = {
      ...validInput,
      folderStructureId: '550e8400-e29b-41d4-a716-446655440002',
    };
    const result = createFilenameRuleInputSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.folderStructureId).toBe('550e8400-e29b-41d4-a716-446655440002');
    }
  });

  it('should reject input with invalid folderStructureId', () => {
    const input = { ...validInput, folderStructureId: 'not-a-uuid' };
    const result = createFilenameRuleInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});

describe('updateFilenameRuleInputSchema', () => {
  it('should accept empty object (no updates)', () => {
    const result = updateFilenameRuleInputSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('should accept partial updates', () => {
    const result = updateFilenameRuleInputSchema.safeParse({ name: 'New Name' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('New Name');
    }
  });

  it('should allow null description to clear it', () => {
    const result = updateFilenameRuleInputSchema.safeParse({ description: null });
    expect(result.success).toBe(true);
  });

  it('should validate pattern if provided', () => {
    const invalid = { pattern: '[unclosed' };
    const result = updateFilenameRuleInputSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should accept valid pattern update', () => {
    const result = updateFilenameRuleInputSchema.safeParse({ pattern: '*.{jpg,png}' });
    expect(result.success).toBe(true);
  });

  // Story 8.2: folderStructureId in update input
  it('should accept update with folderStructureId', () => {
    const result = updateFilenameRuleInputSchema.safeParse({
      folderStructureId: '550e8400-e29b-41d4-a716-446655440002',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.folderStructureId).toBe('550e8400-e29b-41d4-a716-446655440002');
    }
  });

  it('should allow null folderStructureId to clear it', () => {
    const result = updateFilenameRuleInputSchema.safeParse({ folderStructureId: null });
    expect(result.success).toBe(true);
  });

  it('should reject update with invalid folderStructureId', () => {
    const result = updateFilenameRuleInputSchema.safeParse({ folderStructureId: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });
});

describe('filenameRuleEvaluationResultSchema', () => {
  it('should accept valid evaluation result', () => {
    const result = filenameRuleEvaluationResultSchema.safeParse({
      matches: true,
      pattern: '*.jpg',
      filename: 'photo.jpg',
    });
    expect(result.success).toBe(true);
  });

  it('should accept non-matching result', () => {
    const result = filenameRuleEvaluationResultSchema.safeParse({
      matches: false,
      pattern: '*.jpg',
      filename: 'document.pdf',
    });
    expect(result.success).toBe(true);
  });

  it('should require all fields', () => {
    const result = filenameRuleEvaluationResultSchema.safeParse({
      matches: true,
    });
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// Type Inference Tests
// =============================================================================

describe('Type Inference', () => {
  it('should properly infer FilenamePatternRule type', () => {
    const rule: FilenamePatternRule = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Test',
      pattern: '*.txt',
      caseSensitive: false,
      templateId: '550e8400-e29b-41d4-a716-446655440001',
      priority: 0,
      enabled: true,
      createdAt: '2026-01-10T10:00:00.000Z',
      updatedAt: '2026-01-10T10:00:00.000Z',
    };

    // Type check - these should compile
    expect(rule.id).toBeDefined();
    expect(rule.name).toBeDefined();
    expect(rule.pattern).toBeDefined();
    expect(rule.caseSensitive).toBeDefined();
    expect(rule.templateId).toBeDefined();
    expect(rule.priority).toBeDefined();
    expect(rule.enabled).toBeDefined();
    expect(rule.createdAt).toBeDefined();
    expect(rule.updatedAt).toBeDefined();
  });

  it('should properly infer CreateFilenameRuleInput type', () => {
    const input: CreateFilenameRuleInput = {
      name: 'Test',
      pattern: '*.txt',
      templateId: '550e8400-e29b-41d4-a716-446655440001',
    };

    // Type check - id should NOT exist on create input
    expect((input as unknown as { id?: string }).id).toBeUndefined();
    expect(input.name).toBeDefined();
    expect(input.pattern).toBeDefined();
  });

  it('should properly infer UpdateFilenameRuleInput type', () => {
    const input: UpdateFilenameRuleInput = {
      name: 'Updated Name',
    };

    // Type check - all fields should be optional
    expect(input.name).toBeDefined();
    expect(input.pattern).toBeUndefined();
  });
});
