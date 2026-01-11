/**
 * @fileoverview Unit tests for pattern validator - Story 7.2
 */

import { describe, expect, it } from 'vitest';
import {
  validateGlobPattern,
  isValidGlobPattern,
  PatternValidationMessages,
  PatternExamples,
  getPatternErrorHelp,
} from './pattern-validator.js';

// =============================================================================
// AC3: Pattern Validation Tests
// =============================================================================

describe('AC3: Pattern Validation', () => {
  describe('invalid syntax detection', () => {
    it('should detect unclosed brackets', () => {
      const result = validateGlobPattern('[abc.txt');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Unclosed character class');
    });

    it('should detect unclosed braces', () => {
      const result = validateGlobPattern('*.{jpg,png');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Unclosed brace expansion');
    });

    it('should provide clear error messages', () => {
      // Empty pattern
      let result = validateGlobPattern('');
      expect(result.valid).toBe(false);
      expect(result.error).toBe(PatternValidationMessages.EMPTY);

      // Unclosed bracket
      result = validateGlobPattern('[abc');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Unclosed');

      // Empty alternative
      result = validateGlobPattern('*.{jpg,,png}');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Empty alternative');
    });

    it('should accept valid patterns', () => {
      expect(validateGlobPattern('*.txt').valid).toBe(true);
      expect(validateGlobPattern('IMG_*.{jpg,png}').valid).toBe(true);
      expect(validateGlobPattern('[a-z][0-9].txt').valid).toBe(true);
    });

    it('should reject empty patterns', () => {
      expect(validateGlobPattern('').valid).toBe(false);
      expect(validateGlobPattern('   ').valid).toBe(false);
      expect(validateGlobPattern('\t\n').valid).toBe(false);
    });
  });

  describe('isValidGlobPattern helper', () => {
    it('should return true for valid patterns', () => {
      expect(isValidGlobPattern('*.txt')).toBe(true);
      expect(isValidGlobPattern('[abc].txt')).toBe(true);
      expect(isValidGlobPattern('*.{jpg,png}')).toBe(true);
    });

    it('should return false for invalid patterns', () => {
      expect(isValidGlobPattern('')).toBe(false);
      expect(isValidGlobPattern('[unclosed')).toBe(false);
      expect(isValidGlobPattern('{unclosed')).toBe(false);
    });
  });
});

// =============================================================================
// Constants Tests
// =============================================================================

describe('PatternValidationMessages', () => {
  it('should define all expected messages', () => {
    expect(PatternValidationMessages.EMPTY).toBeDefined();
    expect(PatternValidationMessages.UNCLOSED_BRACKET).toBeDefined();
    expect(PatternValidationMessages.UNCLOSED_BRACE).toBeDefined();
    expect(PatternValidationMessages.EMPTY_CLASS).toBeDefined();
    expect(PatternValidationMessages.EMPTY_ALTERNATIVE).toBeDefined();
    expect(PatternValidationMessages.TRAILING_COMMA).toBeDefined();
  });
});

describe('PatternExamples', () => {
  it('should provide examples for all pattern types', () => {
    expect(PatternExamples.WILDCARD).toContain('*.txt');
    expect(PatternExamples.SINGLE_CHAR).toContain('?');
    expect(PatternExamples.CHAR_CLASS).toContain('[abc]');
    expect(PatternExamples.CHAR_RANGE).toContain('[0-9]');
    expect(PatternExamples.NEGATED_CLASS).toContain('[!');
    expect(PatternExamples.BRACE_EXPANSION).toContain('{');
  });
});

// =============================================================================
// Help Message Tests
// =============================================================================

describe('getPatternErrorHelp', () => {
  it('should add example for empty pattern error', () => {
    const help = getPatternErrorHelp('Pattern cannot be empty');
    expect(help).toContain('empty');
    expect(help).toContain('Example');
  });

  it('should add example for character class error', () => {
    const help = getPatternErrorHelp('Unclosed character class');
    expect(help).toContain('character class');
    expect(help).toContain('Example');
  });

  it('should add example for brace error', () => {
    const help = getPatternErrorHelp('Unclosed brace expansion');
    expect(help).toContain('brace');
    expect(help).toContain('Example');
  });

  it('should return original error for unknown types', () => {
    const help = getPatternErrorHelp('Some unknown error');
    expect(help).toBe('Some unknown error');
  });
});

// =============================================================================
// Edge Cases
// =============================================================================

describe('Pattern validation edge cases', () => {
  it('should handle nested brackets', () => {
    // Nested brackets are not standard glob - treated as literal
    expect(validateGlobPattern('[[abc]]').valid).toBe(true);
  });

  it('should handle escaped special characters', () => {
    expect(validateGlobPattern('file\\[1\\].txt').valid).toBe(true);
    expect(validateGlobPattern('file\\{a\\}.txt').valid).toBe(true);
  });

  it('should handle patterns with only special chars', () => {
    expect(validateGlobPattern('*').valid).toBe(true);
    expect(validateGlobPattern('?').valid).toBe(true);
    expect(validateGlobPattern('***').valid).toBe(true);
    expect(validateGlobPattern('???').valid).toBe(true);
  });

  it('should handle very long patterns', () => {
    const longPattern = 'a'.repeat(1000) + '*.txt';
    expect(validateGlobPattern(longPattern).valid).toBe(true);
  });

  it('should handle unicode characters', () => {
    expect(validateGlobPattern('*.日本語').valid).toBe(true);
    expect(validateGlobPattern('文件_*.txt').valid).toBe(true);
  });

  it('should provide position for errors where possible', () => {
    const result = validateGlobPattern('[abc');
    expect(result.valid).toBe(false);
    expect(result.position).toBe(0);
  });
});
