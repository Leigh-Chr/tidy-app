import { describe, it, expect } from 'vitest';
import {
  validateTemplate,
  isValidTemplate,
  getTemplateErrors,
  getTemplateWarnings,
  formatValidationResult,
} from './validator.js';

describe('validateTemplate', () => {
  describe('syntax validation (AC2)', () => {
    it('detects unclosed braces', () => {
      const result = validateTemplate('{year');

      expect(result.valid).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          severity: 'error',
          type: 'unclosed_brace',
        })
      );
    });

    it('detects unclosed brace at end of pattern', () => {
      const result = validateTemplate('prefix-{year}-{month');

      expect(result.valid).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          severity: 'error',
          type: 'unclosed_brace',
        })
      );
    });

    it('detects empty placeholders', () => {
      const result = validateTemplate('prefix-{}-suffix');

      expect(result.valid).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          severity: 'error',
          type: 'empty_placeholder',
        })
      );
    });

    it('detects unexpected closing brace', () => {
      const result = validateTemplate('prefix}-suffix');

      expect(result.valid).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          severity: 'error',
          type: 'unexpected_close_brace',
        })
      );
    });

    it('reports position of syntax errors', () => {
      const result = validateTemplate('abc{def');

      expect(result.valid).toBe(false);
      const error = result.issues.find((i) => i.type === 'unclosed_brace');
      expect(error?.position).toBe(3); // Position of the unclosed brace
    });

    it('accepts valid syntax', () => {
      const result = validateTemplate('{year}-{month}-{original}');

      expect(result.valid).toBe(true);
      expect(result.issues.filter((i) => i.severity === 'error')).toHaveLength(
        0
      );
    });

    it('accepts escaped braces', () => {
      const result = validateTemplate('{{literal}}-{year}');

      expect(result.valid).toBe(true);
      expect(result.issues.filter((i) => i.severity === 'error')).toHaveLength(
        0
      );
    });

    it('detects nested braces as invalid', () => {
      const result = validateTemplate('{outer{inner}}');

      expect(result.valid).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          severity: 'error',
        })
      );
    });
  });

  describe('semantic validation (AC1)', () => {
    it('detects unknown placeholders', () => {
      const result = validateTemplate('{unknown_placeholder}');

      expect(result.valid).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          severity: 'error',
          type: 'unknown_placeholder',
          placeholder: 'unknown_placeholder',
        })
      );
    });

    it('includes "Unknown placeholder:" in error message', () => {
      const result = validateTemplate('{unknown}');

      expect(result.valid).toBe(false);
      const error = result.issues.find(
        (i) => i.type === 'unknown_placeholder'
      );
      expect(error?.message).toContain('Unknown placeholder: {unknown}');
    });

    it('suggests similar placeholders for typos', () => {
      const result = validateTemplate('{yera}'); // typo for 'year'

      expect(result.valid).toBe(false);
      const unknownIssue = result.issues.find(
        (i) => i.type === 'unknown_placeholder' && i.placeholder === 'yera'
      );
      expect(unknownIssue?.suggestion).toBe('year');
      expect(unknownIssue?.message).toContain('Did you mean {year}?');
    });

    it('suggests "month" for "mnth"', () => {
      const result = validateTemplate('{mnth}');

      const unknownIssue = result.issues.find(
        (i) => i.type === 'unknown_placeholder'
      );
      expect(unknownIssue?.suggestion).toBe('month');
    });

    it('suggests "original" for "orignal"', () => {
      const result = validateTemplate('{orignal}');

      const unknownIssue = result.issues.find(
        (i) => i.type === 'unknown_placeholder'
      );
      expect(unknownIssue?.suggestion).toBe('original');
    });

    it('does not suggest when distance is too far', () => {
      const result = validateTemplate('{completely_different_name}');

      const unknownIssue = result.issues.find(
        (i) => i.type === 'unknown_placeholder'
      );
      expect(unknownIssue?.suggestion).toBeUndefined();
    });

    it('identifies all known placeholders', () => {
      const result = validateTemplate('{year}-{month}-{title}');

      expect(result.valid).toBe(true);
      expect(result.knownPlaceholders).toContain('year');
      expect(result.knownPlaceholders).toContain('month');
      expect(result.knownPlaceholders).toContain('title');
    });

    it('separates known and unknown placeholders', () => {
      const result = validateTemplate('{year}-{custom}');

      expect(result.valid).toBe(false);
      expect(result.knownPlaceholders).toContain('year');
      expect(result.unknownPlaceholders).toContain('custom');
    });

    it('validates all known placeholder types', () => {
      const allKnown = [
        'year',
        'month',
        'day',
        'date',
        'title',
        'author',
        'camera',
        'location',
        'ext',
        'original',
        'size',
      ];

      for (const placeholder of allKnown) {
        const result = validateTemplate(`{${placeholder}}`);
        expect(result.unknownPlaceholders).not.toContain(placeholder);
      }
    });
  });

  describe('warning generation (AC5)', () => {
    it('warns about duplicate placeholders', () => {
      const result = validateTemplate('{year}-{year}');

      expect(result.valid).toBe(true); // Duplicates are valid but warned
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          severity: 'warning',
          type: 'duplicate_placeholder',
          placeholder: 'year',
        })
      );
    });

    it('warns about multiple duplicate placeholders', () => {
      const result = validateTemplate('{year}-{year}-{month}-{month}');

      const duplicateWarnings = result.issues.filter(
        (i) => i.type === 'duplicate_placeholder'
      );
      expect(duplicateWarnings).toHaveLength(2);
    });

    it('suggests adding extension placeholder', () => {
      const result = validateTemplate('{year}-{original}');

      const extWarning = result.issues.find(
        (i) => i.type === 'missing_extension'
      );
      expect(extWarning).toBeDefined();
      expect(extWarning?.severity).toBe('info');
    });

    it('does not warn about extension when {ext} is present', () => {
      const result = validateTemplate('{year}-{original}.{ext}');

      const extWarning = result.issues.find(
        (i) => i.type === 'missing_extension'
      );
      expect(extWarning).toBeUndefined();
    });

    it('does not warn about extension when literal extension is present', () => {
      const result = validateTemplate('{year}-{original}.jpg');

      const extWarning = result.issues.find(
        (i) => i.type === 'missing_extension'
      );
      expect(extWarning).toBeUndefined();
    });

    it('suggests fallback for metadata-only templates', () => {
      const result = validateTemplate('{title}-{author}');

      const suggestion = result.issues.find(
        (i) => i.type === 'suggestion' && i.message.includes('fallback')
      );
      expect(suggestion).toBeDefined();
      expect(suggestion?.severity).toBe('info');
    });

    it('does not suggest fallback when date placeholders are present', () => {
      const result = validateTemplate('{title}-{year}');

      const fallbackSuggestion = result.issues.find(
        (i) => i.type === 'suggestion' && i.message.includes('fallback')
      );
      expect(fallbackSuggestion).toBeUndefined();
    });

    it('does not suggest fallback when original is present', () => {
      const result = validateTemplate('{title}-{original}');

      const fallbackSuggestion = result.issues.find(
        (i) => i.type === 'suggestion' && i.message.includes('fallback')
      );
      expect(fallbackSuggestion).toBeUndefined();
    });
  });

  describe('valid templates (AC3)', () => {
    it('validates common date patterns', () => {
      expect(isValidTemplate('{year}-{month}-{day}_{original}')).toBe(true);
      expect(isValidTemplate('{date}_{title}.{ext}')).toBe(true);
    });

    it('validates metadata patterns', () => {
      expect(isValidTemplate('{camera}_{location}_{year}')).toBe(true);
      expect(isValidTemplate('{author}-{title}')).toBe(true);
    });

    it('validates file patterns', () => {
      expect(isValidTemplate('photo_{date}_{size}')).toBe(true);
      expect(isValidTemplate('{original}.{ext}')).toBe(true);
    });

    it('returns placeholder list for valid template', () => {
      const result = validateTemplate('{year}-{month}-{original}.{ext}');

      expect(result.valid).toBe(true);
      expect(result.placeholders).toEqual(['year', 'month', 'original', 'ext']);
    });

    it('validates templates with literal text', () => {
      const result = validateTemplate('IMG_{year}_{month}_{day}_photo.{ext}');

      expect(result.valid).toBe(true);
      expect(result.knownPlaceholders).toEqual(['year', 'month', 'day', 'ext']);
    });

    it('validates templates with special characters in literals', () => {
      expect(isValidTemplate('{year}_{month}_{day}')).toBe(true);
      expect(isValidTemplate('{year}-{month}-{day}')).toBe(true);
      expect(isValidTemplate('{year}.{month}.{day}')).toBe(true);
    });
  });

  describe('multiple errors (AC4)', () => {
    it('reports all errors, not just the first', () => {
      const result = validateTemplate('{unknown1}-{unknown2}-{unknown3}');

      expect(result.valid).toBe(false);
      const errors = result.issues.filter((i) => i.severity === 'error');
      expect(errors).toHaveLength(3);
    });

    it('reports all unknown placeholders separately', () => {
      const result = validateTemplate('{foo}-{bar}-{baz}');

      expect(result.unknownPlaceholders).toContain('foo');
      expect(result.unknownPlaceholders).toContain('bar');
      expect(result.unknownPlaceholders).toContain('baz');
    });

    it('combines errors and warnings in result', () => {
      // Has unknown placeholder (error) and duplicate (warning)
      const result = validateTemplate('{year}-{year}-{unknown}');

      const errors = result.issues.filter((i) => i.severity === 'error');
      const warnings = result.issues.filter((i) => i.severity === 'warning');

      expect(errors.length).toBeGreaterThan(0);
      expect(warnings.length).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    it('handles empty pattern', () => {
      const result = validateTemplate('');

      expect(result.valid).toBe(true);
      expect(result.placeholders).toHaveLength(0);
    });

    it('handles pattern with only literal text', () => {
      const result = validateTemplate('static-name');

      expect(result.valid).toBe(true);
      expect(result.placeholders).toHaveLength(0);
    });

    it('handles pattern with escaped braces only', () => {
      const result = validateTemplate('{{escaped}}');

      expect(result.valid).toBe(true);
      expect(result.placeholders).toHaveLength(0);
    });

    it('handles whitespace in placeholder names', () => {
      const result = validateTemplate('{ year }');

      // Parser trims whitespace, so this should recognize 'year'
      expect(result.knownPlaceholders).toContain('year');
    });

    it('handles very long patterns', () => {
      const longPattern =
        '{year}-{month}-{day}_' + 'a'.repeat(1000) + '_{original}';
      const result = validateTemplate(longPattern);

      expect(result.valid).toBe(true);
    });

    it('handles many placeholders', () => {
      const manyPlaceholders = Array(50).fill('{year}').join('-');
      const result = validateTemplate(manyPlaceholders);

      // All duplicates should be warned about
      const duplicateWarnings = result.issues.filter(
        (i) => i.type === 'duplicate_placeholder'
      );
      expect(duplicateWarnings.length).toBeGreaterThan(0);
    });
  });
});

describe('isValidTemplate', () => {
  it('returns true for valid templates', () => {
    expect(isValidTemplate('{year}-{original}')).toBe(true);
    expect(isValidTemplate('{year}-{month}-{day}.{ext}')).toBe(true);
    expect(isValidTemplate('prefix-{date}-suffix')).toBe(true);
  });

  it('returns false for invalid templates', () => {
    expect(isValidTemplate('{unclosed')).toBe(false);
    expect(isValidTemplate('{unknown}')).toBe(false);
    expect(isValidTemplate('prefix-{}-suffix')).toBe(false);
  });

  it('returns true for templates with only warnings', () => {
    // Duplicate placeholder is just a warning, not an error
    expect(isValidTemplate('{year}-{year}')).toBe(true);
  });
});

describe('getTemplateErrors', () => {
  it('returns only errors', () => {
    const errors = getTemplateErrors('{year}-{year}'); // Has warning but no error

    expect(errors).toHaveLength(0);
  });

  it('excludes warnings and info', () => {
    const errors = getTemplateErrors('{unknown}');

    expect(errors.every((e) => e.severity === 'error')).toBe(true);
  });

  it('returns multiple errors when present', () => {
    const errors = getTemplateErrors('{unknown1}-{unknown2}');

    expect(errors).toHaveLength(2);
  });
});

describe('getTemplateWarnings', () => {
  it('returns only warnings', () => {
    const warnings = getTemplateWarnings('{year}-{year}');

    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.type).toBe('duplicate_placeholder');
  });

  it('excludes errors and info', () => {
    const warnings = getTemplateWarnings('{year}-{year}');

    expect(warnings.every((w) => w.severity === 'warning')).toBe(true);
  });

  it('returns empty array when no warnings', () => {
    const warnings = getTemplateWarnings('{year}-{month}.{ext}');

    expect(warnings).toHaveLength(0);
  });
});

describe('formatValidationResult', () => {
  it('formats valid result', () => {
    const result = validateTemplate('{year}-{original}.{ext}');
    const formatted = formatValidationResult(result);

    expect(formatted).toContain('Template is valid');
    expect(formatted).toContain('{year}');
    expect(formatted).toContain('{original}');
    expect(formatted).toContain('{ext}');
  });

  it('formats invalid result with errors', () => {
    const result = validateTemplate('{unclosed');
    const formatted = formatValidationResult(result);

    expect(formatted).toContain('Template is invalid');
    expect(formatted).toContain('Errors:');
  });

  it('includes warnings section', () => {
    const result = validateTemplate('{year}-{year}');
    const formatted = formatValidationResult(result);

    expect(formatted).toContain('Warnings:');
    expect(formatted).toContain('multiple times');
  });

  it('includes suggestions section', () => {
    const result = validateTemplate('{title}');
    const formatted = formatValidationResult(result);

    expect(formatted).toContain('Suggestions:');
  });

  it('shows placeholder list for valid templates', () => {
    const result = validateTemplate('{year}-{month}-{day}');
    const formatted = formatValidationResult(result);

    expect(formatted).toContain('Placeholders:');
    expect(formatted).toContain('{year}');
    expect(formatted).toContain('{month}');
    expect(formatted).toContain('{day}');
  });

  it('handles result with no issues', () => {
    const result = validateTemplate('{year}.{ext}');
    const formatted = formatValidationResult(result);

    expect(formatted).toContain('Template is valid');
    expect(formatted).not.toContain('Errors:');
    expect(formatted).not.toContain('Warnings:');
  });
});

describe('integration: acceptance criteria verification', () => {
  it('AC1: Unknown placeholder detection', () => {
    const result = validateTemplate('{unknown}');

    expect(result.valid).toBe(false);
    const error = result.issues.find((i) => i.type === 'unknown_placeholder');
    expect(error?.message).toContain('Unknown placeholder: {unknown}');
  });

  it('AC2: Syntax error detection with position', () => {
    const result = validateTemplate('{year');

    expect(result.valid).toBe(false);
    const error = result.issues.find((i) => i.type === 'unclosed_brace');
    expect(error?.position).toBeDefined();
  });

  it('AC3: Valid template confirmation', () => {
    const result = validateTemplate('{year}-{month}-{day}');

    expect(result.valid).toBe(true);
    expect(result.knownPlaceholders).toEqual(['year', 'month', 'day']);
  });

  it('AC4: Multiple error reporting', () => {
    const result = validateTemplate('{unknown1}-{unknown2}-{unknown3}');

    expect(result.valid).toBe(false);
    const errors = result.issues.filter((i) => i.severity === 'error');
    expect(errors.length).toBe(3);
  });

  it('AC5: Warning for potential issues', () => {
    // Missing extension warning
    const result1 = validateTemplate('{year}-{month}');
    expect(result1.issues.some((i) => i.type === 'missing_extension')).toBe(
      true
    );

    // Duplicate placeholder warning
    const result2 = validateTemplate('{year}-{year}');
    expect(
      result2.issues.some((i) => i.type === 'duplicate_placeholder')
    ).toBe(true);
  });
});
