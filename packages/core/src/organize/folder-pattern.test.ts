/**
 * @fileoverview Tests for folder pattern validation - Story 8.1
 */

import { describe, expect, it } from 'vitest';
import {
  validateFolderPattern,
  isValidFolderPattern,
  normalizeFolderPattern,
  extractFolderPlaceholders,
  VALID_FOLDER_PLACEHOLDERS,
} from './folder-pattern.js';

describe('folder-pattern', () => {
  describe('normalizeFolderPattern', () => {
    it('should convert backslashes to forward slashes', () => {
      expect(normalizeFolderPattern('{year}\\{month}')).toBe('{year}/{month}');
    });

    it('should remove leading slash', () => {
      expect(normalizeFolderPattern('/{year}/{month}')).toBe('{year}/{month}');
    });

    it('should remove trailing slash', () => {
      expect(normalizeFolderPattern('{year}/{month}/')).toBe('{year}/{month}');
    });

    it('should collapse multiple consecutive slashes', () => {
      expect(normalizeFolderPattern('{year}//{month}')).toBe('{year}/{month}');
    });

    it('should handle mixed normalization issues', () => {
      expect(normalizeFolderPattern('\\{year}\\\\{month}\\')).toBe('{year}/{month}');
    });

    it('should handle already normalized patterns', () => {
      expect(normalizeFolderPattern('{year}/{month}')).toBe('{year}/{month}');
    });

    it('should handle pattern without placeholders', () => {
      expect(normalizeFolderPattern('photos/vacation')).toBe('photos/vacation');
    });
  });

  describe('validateFolderPattern', () => {
    describe('valid patterns', () => {
      it('should validate simple single-level pattern', () => {
        const result = validateFolderPattern('{year}');
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(result.placeholders).toEqual(['year']);
      });

      it('should validate multi-level pattern', () => {
        const result = validateFolderPattern('{year}/{month}/{day}');
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(result.placeholders).toEqual(['year', 'month', 'day']);
      });

      it('should validate pattern with mixed literals and placeholders', () => {
        const result = validateFolderPattern('Photos/{year}/Vacation');
        expect(result.valid).toBe(true);
        expect(result.placeholders).toEqual(['year']);
      });

      it('should validate pattern with date placeholder', () => {
        const result = validateFolderPattern('{date}');
        expect(result.valid).toBe(true);
        expect(result.placeholders).toEqual(['date']);
      });

      it('should validate pattern with metadata placeholders', () => {
        const result = validateFolderPattern('{author}/{title}');
        expect(result.valid).toBe(true);
        expect(result.placeholders).toEqual(['author', 'title']);
      });

      it('should normalize and validate pattern with backslashes', () => {
        const result = validateFolderPattern('{year}\\{month}');
        expect(result.valid).toBe(true);
        expect(result.normalizedPattern).toBe('{year}/{month}');
      });
    });

    describe('invalid patterns', () => {
      it('should reject empty pattern', () => {
        const result = validateFolderPattern('');
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Pattern cannot be empty');
      });

      it('should reject whitespace-only pattern', () => {
        const result = validateFolderPattern('   ');
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Pattern cannot be empty');
      });

      it('should reject pattern with unclosed brace', () => {
        const result = validateFolderPattern('{year/{month}');
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.includes('Unclosed brace'))).toBe(true);
      });

      it('should reject pattern with empty placeholder', () => {
        const result = validateFolderPattern('{}/test');
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Empty placeholder found');
      });

      it('should reject pattern with nested braces', () => {
        const result = validateFolderPattern('{{year}}');
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.includes('Nested braces'))).toBe(true);
      });

      it('should reject pattern with unexpected closing brace', () => {
        const result = validateFolderPattern('test}');
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.includes('Unexpected closing brace'))).toBe(true);
      });

      it('should reject pattern with invalid path characters', () => {
        const result = validateFolderPattern('test<file>');
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.includes('invalid path characters'))).toBe(true);
      });
    });

    describe('warnings', () => {
      it('should warn about unknown placeholders', () => {
        const result = validateFolderPattern('{unknownPlaceholder}');
        expect(result.valid).toBe(true);
        expect(result.warnings.some((w) => w.includes('Unknown placeholder'))).toBe(true);
      });

      it('should warn about Windows reserved names', () => {
        const result = validateFolderPattern('CON/{year}');
        expect(result.valid).toBe(true);
        expect(result.warnings.some((w) => w.includes('Windows reserved name'))).toBe(true);
      });

      it('should warn about segments ending with dot', () => {
        const result = validateFolderPattern('test./{year}');
        expect(result.valid).toBe(true);
        expect(result.warnings.some((w) => w.includes('ends with a dot'))).toBe(true);
      });

      it('should warn about segments ending with space', () => {
        const result = validateFolderPattern('test /{year}');
        expect(result.valid).toBe(true);
        expect(result.warnings.some((w) => w.includes('ends with a space'))).toBe(true);
      });
    });

    describe('normalization', () => {
      it('should return normalized pattern in result', () => {
        const result = validateFolderPattern('/{year}\\{month}/');
        expect(result.normalizedPattern).toBe('{year}/{month}');
      });
    });
  });

  describe('isValidFolderPattern', () => {
    it('should return true for valid patterns', () => {
      expect(isValidFolderPattern('{year}/{month}')).toBe(true);
      expect(isValidFolderPattern('Photos/{date}')).toBe(true);
    });

    it('should return false for invalid patterns', () => {
      expect(isValidFolderPattern('')).toBe(false);
      expect(isValidFolderPattern('{unclosed')).toBe(false);
      expect(isValidFolderPattern('{}')).toBe(false);
    });
  });

  describe('extractFolderPlaceholders', () => {
    it('should extract single placeholder', () => {
      expect(extractFolderPlaceholders('{year}')).toEqual(['year']);
    });

    it('should extract multiple placeholders', () => {
      expect(extractFolderPlaceholders('{year}/{month}/{day}')).toEqual([
        'year',
        'month',
        'day',
      ]);
    });

    it('should return empty array for pattern without placeholders', () => {
      expect(extractFolderPlaceholders('photos/vacation')).toEqual([]);
    });

    it('should trim whitespace from placeholder names', () => {
      expect(extractFolderPlaceholders('{ year }/{ month }')).toEqual(['year', 'month']);
    });

    it('should handle mixed content', () => {
      expect(extractFolderPlaceholders('Photos/{year}/Summer/{month}')).toEqual([
        'year',
        'month',
      ]);
    });
  });

  describe('VALID_FOLDER_PLACEHOLDERS', () => {
    it('should include date placeholders', () => {
      expect(VALID_FOLDER_PLACEHOLDERS).toContain('year');
      expect(VALID_FOLDER_PLACEHOLDERS).toContain('month');
      expect(VALID_FOLDER_PLACEHOLDERS).toContain('day');
      expect(VALID_FOLDER_PLACEHOLDERS).toContain('date');
    });

    it('should include file placeholders', () => {
      expect(VALID_FOLDER_PLACEHOLDERS).toContain('ext');
      expect(VALID_FOLDER_PLACEHOLDERS).toContain('original');
    });

    it('should include metadata placeholders', () => {
      expect(VALID_FOLDER_PLACEHOLDERS).toContain('author');
      expect(VALID_FOLDER_PLACEHOLDERS).toContain('title');
    });
  });
});
