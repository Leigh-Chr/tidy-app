/**
 * @fileoverview Unit tests for filename rule evaluator - Story 7.2
 */

import { describe, expect, it } from 'vitest';
import type { FileInfo } from '../types/file-info.js';
import { FileCategory } from '../types/file-category.js';
import { MetadataCapability } from '../types/metadata-capability.js';
import type { FilenamePatternRule } from '../types/filename-rule.js';
import {
  evaluateFilenameRule,
  findMatchingFilenameRule,
  findAllMatchingFilenameRules,
  evaluateAllFilenameRules,
  evaluateFilenameRulesForFiles,
} from './filename-evaluator.js';

// =============================================================================
// Test Fixtures
// =============================================================================

function createMockFileInfo(overrides: Partial<FileInfo> = {}): FileInfo {
  return {
    path: '/photos/IMG_1234.jpg',
    name: 'IMG_1234',
    extension: 'jpg',
    fullName: 'IMG_1234.jpg',
    size: 1024,
    createdAt: new Date('2024-01-01'),
    modifiedAt: new Date('2024-01-01'),
    category: FileCategory.IMAGE,
    metadataSupported: true,
    metadataCapability: MetadataCapability.FULL,
    ...overrides,
  };
}

function createMockRule(overrides: Partial<FilenamePatternRule> = {}): FilenamePatternRule {
  return {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Test Rule',
    pattern: '*.jpg',
    caseSensitive: false,
    templateId: '550e8400-e29b-41d4-a716-446655440001',
    priority: 0,
    enabled: true,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

// =============================================================================
// AC5: evaluateFilenameRule Tests
// =============================================================================

describe('AC5: Rule Evaluation Function', () => {
  describe('evaluateFilenameRule', () => {
    it('should return { matches: true } for matching file', () => {
      const rule = createMockRule({ pattern: 'IMG_*.jpg' });
      const fileInfo = createMockFileInfo({ fullName: 'IMG_1234.jpg' });

      const result = evaluateFilenameRule(rule, fileInfo);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.matches).toBe(true);
        expect(result.data.pattern).toBe('IMG_*.jpg');
        expect(result.data.filename).toBe('IMG_1234.jpg');
      }
    });

    it('should return { matches: false } for non-matching file', () => {
      const rule = createMockRule({ pattern: 'IMG_*.jpg' });
      const fileInfo = createMockFileInfo({ fullName: 'DSC_1234.jpg' });

      const result = evaluateFilenameRule(rule, fileInfo);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.matches).toBe(false);
      }
    });

    it('should short-circuit (return false) for disabled rules', () => {
      const rule = createMockRule({ pattern: 'IMG_*.jpg', enabled: false });
      const fileInfo = createMockFileInfo({ fullName: 'IMG_1234.jpg' });

      const result = evaluateFilenameRule(rule, fileInfo);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.matches).toBe(false);
      }
    });

    it('should return error for invalid pattern', () => {
      const rule = createMockRule({ pattern: '[unclosed' });
      const fileInfo = createMockFileInfo();

      const result = evaluateFilenameRule(rule, fileInfo);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('INVALID_PATTERN');
      }
    });

    it('should respect caseSensitive option', () => {
      const caseInsensitiveRule = createMockRule({
        pattern: 'IMG_*.jpg',
        caseSensitive: false,
      });
      const caseSensitiveRule = createMockRule({
        pattern: 'IMG_*.jpg',
        caseSensitive: true,
      });
      const lowerCaseFile = createMockFileInfo({ fullName: 'img_1234.jpg' });

      const insensitiveResult = evaluateFilenameRule(caseInsensitiveRule, lowerCaseFile);
      expect(insensitiveResult.ok).toBe(true);
      if (insensitiveResult.ok) {
        expect(insensitiveResult.data.matches).toBe(true);
      }

      const sensitiveResult = evaluateFilenameRule(caseSensitiveRule, lowerCaseFile);
      expect(sensitiveResult.ok).toBe(true);
      if (sensitiveResult.ok) {
        expect(sensitiveResult.data.matches).toBe(false);
      }
    });
  });
});

// =============================================================================
// findMatchingFilenameRule Tests
// =============================================================================

describe('findMatchingFilenameRule', () => {
  it('should return first matching rule by priority', () => {
    const rules: FilenamePatternRule[] = [
      createMockRule({
        id: 'rule-1',
        name: 'Low Priority',
        pattern: '*.jpg',
        priority: 1,
      }),
      createMockRule({
        id: 'rule-2',
        name: 'High Priority',
        pattern: 'IMG_*.jpg',
        priority: 10,
      }),
      createMockRule({
        id: 'rule-3',
        name: 'Medium Priority',
        pattern: 'IMG_*.{jpg,png}',
        priority: 5,
      }),
    ];
    const fileInfo = createMockFileInfo({ fullName: 'IMG_1234.jpg' });

    const match = findMatchingFilenameRule(rules, fileInfo);

    expect(match).not.toBeNull();
    expect(match?.rule.name).toBe('High Priority');
  });

  it('should return null when no rules match', () => {
    const rules: FilenamePatternRule[] = [
      createMockRule({ pattern: '*.pdf' }),
      createMockRule({ pattern: 'DSC_*.jpg' }),
    ];
    const fileInfo = createMockFileInfo({ fullName: 'IMG_1234.jpg' });

    const match = findMatchingFilenameRule(rules, fileInfo);

    expect(match).toBeNull();
  });

  it('should skip disabled rules', () => {
    const rules: FilenamePatternRule[] = [
      createMockRule({
        id: 'rule-1',
        name: 'Disabled',
        pattern: 'IMG_*.jpg',
        priority: 10,
        enabled: false,
      }),
      createMockRule({
        id: 'rule-2',
        name: 'Enabled',
        pattern: '*.jpg',
        priority: 1,
        enabled: true,
      }),
    ];
    const fileInfo = createMockFileInfo({ fullName: 'IMG_1234.jpg' });

    const match = findMatchingFilenameRule(rules, fileInfo);

    expect(match?.rule.name).toBe('Enabled');
  });

  it('should handle empty rules array', () => {
    const fileInfo = createMockFileInfo();

    const match = findMatchingFilenameRule([], fileInfo);

    expect(match).toBeNull();
  });
});

// =============================================================================
// findAllMatchingFilenameRules Tests
// =============================================================================

describe('findAllMatchingFilenameRules', () => {
  it('should return all matching rules in priority order', () => {
    const rules: FilenamePatternRule[] = [
      createMockRule({
        id: 'rule-1',
        name: 'All JPGs',
        pattern: '*.jpg',
        priority: 1,
      }),
      createMockRule({
        id: 'rule-2',
        name: 'IMG Pattern',
        pattern: 'IMG_*',
        priority: 10,
      }),
      createMockRule({
        id: 'rule-3',
        name: 'PDFs Only',
        pattern: '*.pdf',
        priority: 5,
      }),
    ];
    const fileInfo = createMockFileInfo({ fullName: 'IMG_1234.jpg' });

    const matches = findAllMatchingFilenameRules(rules, fileInfo);

    expect(matches).toHaveLength(2);
    expect(matches[0].rule.name).toBe('IMG Pattern'); // Higher priority first
    expect(matches[1].rule.name).toBe('All JPGs');
  });

  it('should return empty array when no rules match', () => {
    const rules: FilenamePatternRule[] = [createMockRule({ pattern: '*.pdf' })];
    const fileInfo = createMockFileInfo({ fullName: 'photo.jpg' });

    const matches = findAllMatchingFilenameRules(rules, fileInfo);

    expect(matches).toHaveLength(0);
  });
});

// =============================================================================
// evaluateAllFilenameRules Tests
// =============================================================================

describe('evaluateAllFilenameRules', () => {
  it('should return results for all rules', () => {
    const rules: FilenamePatternRule[] = [
      createMockRule({ id: 'rule-1', pattern: '*.jpg' }),
      createMockRule({ id: 'rule-2', pattern: '*.pdf' }),
      createMockRule({ id: 'rule-3', pattern: 'IMG_*' }),
    ];
    const fileInfo = createMockFileInfo({ fullName: 'IMG_1234.jpg' });

    const results = evaluateAllFilenameRules(rules, fileInfo);

    expect(results.size).toBe(3);

    const jpgResult = results.get('rule-1');
    expect(jpgResult?.ok).toBe(true);
    if (jpgResult?.ok) {
      expect(jpgResult.data.matches).toBe(true);
    }

    const pdfResult = results.get('rule-2');
    expect(pdfResult?.ok).toBe(true);
    if (pdfResult?.ok) {
      expect(pdfResult.data.matches).toBe(false);
    }

    const imgResult = results.get('rule-3');
    expect(imgResult?.ok).toBe(true);
    if (imgResult?.ok) {
      expect(imgResult.data.matches).toBe(true);
    }
  });

  it('should include errors for invalid patterns', () => {
    const rules: FilenamePatternRule[] = [
      createMockRule({ id: 'rule-1', pattern: '*.jpg' }),
      createMockRule({ id: 'rule-2', pattern: '[unclosed' }),
    ];
    const fileInfo = createMockFileInfo();

    const results = evaluateAllFilenameRules(rules, fileInfo);

    const validResult = results.get('rule-1');
    expect(validResult?.ok).toBe(true);

    const invalidResult = results.get('rule-2');
    expect(invalidResult?.ok).toBe(false);
  });
});

// =============================================================================
// evaluateFilenameRulesForFiles Tests
// =============================================================================

describe('evaluateFilenameRulesForFiles', () => {
  it('should evaluate rules against multiple files', () => {
    const rules: FilenamePatternRule[] = [
      createMockRule({
        id: 'rule-1',
        pattern: 'IMG_*.jpg',
        templateId: 'template-iphone',
        priority: 10,
      }),
      createMockRule({
        id: 'rule-2',
        pattern: '*.pdf',
        templateId: 'template-pdf',
        priority: 5,
      }),
    ];

    const files: FileInfo[] = [
      createMockFileInfo({ fullName: 'IMG_1234.jpg' }),
      createMockFileInfo({ fullName: 'document.pdf', category: FileCategory.PDF }),
      createMockFileInfo({ fullName: 'other.txt', category: FileCategory.OTHER }),
    ];

    const results = evaluateFilenameRulesForFiles(rules, files);

    expect(results).toHaveLength(3);

    expect(results[0].matchedRule?.name).toBe('Test Rule');
    expect(results[0].templateId).toBe('template-iphone');

    expect(results[1].matchedRule?.name).toBe('Test Rule');
    expect(results[1].templateId).toBe('template-pdf');

    expect(results[2].matchedRule).toBeNull();
    expect(results[2].templateId).toBeNull();
  });

  it('should handle empty files array', () => {
    const rules: FilenamePatternRule[] = [createMockRule()];

    const results = evaluateFilenameRulesForFiles(rules, []);

    expect(results).toHaveLength(0);
  });

  it('should handle empty rules array', () => {
    const files: FileInfo[] = [createMockFileInfo()];

    const results = evaluateFilenameRulesForFiles([], files);

    expect(results).toHaveLength(1);
    expect(results[0].matchedRule).toBeNull();
  });
});

// =============================================================================
// Complex Pattern Tests
// =============================================================================

describe('Complex pattern evaluation', () => {
  it('should match iPhone photo pattern', () => {
    const rule = createMockRule({ pattern: 'IMG_*.{jpg,jpeg,heic}' });

    expect(evaluateFilenameRule(rule, createMockFileInfo({ fullName: 'IMG_0001.jpg' })).ok).toBe(
      true
    );
    expect(evaluateFilenameRule(rule, createMockFileInfo({ fullName: 'IMG_0001.jpeg' })).ok).toBe(
      true
    );
    expect(evaluateFilenameRule(rule, createMockFileInfo({ fullName: 'IMG_0001.heic' })).ok).toBe(
      true
    );
  });

  it('should match date-prefixed files', () => {
    const rule = createMockRule({ pattern: '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]*' });

    const result = evaluateFilenameRule(rule, createMockFileInfo({ fullName: '2024-01-15_report.pdf' }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.matches).toBe(true);
    }
  });

  it('should match vacation photo pattern from AC4', () => {
    const rule = createMockRule({ pattern: '*_vacation_*.{jpg,png}' });

    const match1 = evaluateFilenameRule(
      rule,
      createMockFileInfo({ fullName: '2024_vacation_beach.jpg' })
    );
    expect(match1.ok && match1.data.matches).toBe(true);

    const match2 = evaluateFilenameRule(
      rule,
      createMockFileInfo({ fullName: 'summer_vacation_photo.png' })
    );
    expect(match2.ok && match2.data.matches).toBe(true);

    const noMatch = evaluateFilenameRule(
      rule,
      createMockFileInfo({ fullName: '2024_vacation_beach.gif' })
    );
    expect(noMatch.ok && noMatch.data.matches).toBe(false);
  });
});
