import { describe, it, expect } from 'vitest';
import {
  parseTemplate,
  extractPlaceholders,
  isKnownPlaceholder,
  getKnownPlaceholders,
  getUnknownPlaceholders,
} from './parser.js';

describe('parseTemplate', () => {
  describe('single placeholder', () => {
    it('parses template with single placeholder', () => {
      const result = parseTemplate('{year}');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.tokens).toHaveLength(1);
        expect(result.data.tokens[0]).toEqual({
          type: 'placeholder',
          name: 'year',
        });
        expect(result.data.placeholders).toEqual(['year']);
        expect(result.data.pattern).toBe('{year}');
      }
    });

    it('trims whitespace from placeholder names', () => {
      const result = parseTemplate('{ year }');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.tokens[0]).toEqual({
          type: 'placeholder',
          name: 'year',
        });
      }
    });
  });

  describe('multiple placeholders', () => {
    it('parses template with multiple placeholders', () => {
      const result = parseTemplate('{year}-{month}-{day}');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.tokens).toHaveLength(5);
        expect(result.data.placeholders).toEqual(['year', 'month', 'day']);
      }
    });

    it('deduplicates repeated placeholders', () => {
      const result = parseTemplate('{year}-{year}');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.placeholders).toEqual(['year']);
        expect(result.data.tokens).toHaveLength(3);
      }
    });
  });

  describe('literal text preservation', () => {
    it('preserves literal text between placeholders', () => {
      const result = parseTemplate('photo_{year}_final');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.tokens).toEqual([
          { type: 'literal', value: 'photo_' },
          { type: 'placeholder', name: 'year' },
          { type: 'literal', value: '_final' },
        ]);
      }
    });

    it('handles leading literal text', () => {
      const result = parseTemplate('prefix_{year}');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.tokens[0]).toEqual({
          type: 'literal',
          value: 'prefix_',
        });
      }
    });

    it('handles trailing literal text', () => {
      const result = parseTemplate('{year}_suffix');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.tokens[1]).toEqual({
          type: 'literal',
          value: '_suffix',
        });
      }
    });

    it('handles template with no placeholders', () => {
      const result = parseTemplate('static_name');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.tokens).toEqual([
          { type: 'literal', value: 'static_name' },
        ]);
        expect(result.data.placeholders).toEqual([]);
      }
    });
  });

  describe('escaped braces', () => {
    it('handles escaped opening brace', () => {
      const result = parseTemplate('{{literal}} {year}');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.tokens).toEqual([
          { type: 'literal', value: '{literal} ' },
          { type: 'placeholder', name: 'year' },
        ]);
      }
    });

    it('handles escaped closing brace', () => {
      const result = parseTemplate('{year} literal}}');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.tokens).toEqual([
          { type: 'placeholder', name: 'year' },
          { type: 'literal', value: ' literal}' },
        ]);
      }
    });

    it('handles both escaped braces together', () => {
      const result = parseTemplate('{{escaped}}');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.tokens).toEqual([
          { type: 'literal', value: '{escaped}' },
        ]);
        expect(result.data.placeholders).toEqual([]);
      }
    });

    it('handles mixed escaped and regular braces', () => {
      const result = parseTemplate('{{literal}} {placeholder} {{another}}');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.tokens).toEqual([
          { type: 'literal', value: '{literal} ' },
          { type: 'placeholder', name: 'placeholder' },
          { type: 'literal', value: ' {another}' },
        ]);
        expect(result.data.placeholders).toEqual(['placeholder']);
      }
    });
  });

  describe('error cases', () => {
    it('returns error for unclosed brace', () => {
      const result = parseTemplate('{year');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('unclosed_brace');
        expect(result.error.position).toBe(0);
      }
    });

    it('returns error for unclosed brace in middle', () => {
      const result = parseTemplate('prefix {year');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('unclosed_brace');
        expect(result.error.position).toBe(7);
      }
    });

    it('returns error for unexpected closing brace', () => {
      const result = parseTemplate('year}');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('unexpected_close_brace');
        expect(result.error.position).toBe(4);
      }
    });

    it('returns error for empty placeholder', () => {
      const result = parseTemplate('{}');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('empty_placeholder');
      }
    });

    it('returns error for whitespace-only placeholder', () => {
      const result = parseTemplate('{   }');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('empty_placeholder');
      }
    });
  });

  describe('complex patterns', () => {
    it('handles real-world photo naming pattern', () => {
      const result = parseTemplate('{year}-{month}-{day}_{title}.{ext}');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.placeholders).toEqual([
          'year',
          'month',
          'day',
          'title',
          'ext',
        ]);
        expect(result.data.tokens).toHaveLength(9);
      }
    });

    it('handles pattern with special characters', () => {
      const result = parseTemplate('[{year}] - {title} (v{version})');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.placeholders).toEqual(['year', 'title', 'version']);
      }
    });
  });
});

describe('extractPlaceholders', () => {
  it('extracts all placeholder names', () => {
    const placeholders = extractPlaceholders('{year}-{month}_{title}.{ext}');
    expect(placeholders).toEqual(['year', 'month', 'title', 'ext']);
  });

  it('returns empty array for invalid template', () => {
    const placeholders = extractPlaceholders('{unclosed');
    expect(placeholders).toEqual([]);
  });

  it('returns empty array for template with no placeholders', () => {
    const placeholders = extractPlaceholders('static_filename');
    expect(placeholders).toEqual([]);
  });
});

describe('isKnownPlaceholder', () => {
  it('returns true for known date placeholders', () => {
    expect(isKnownPlaceholder('year')).toBe(true);
    expect(isKnownPlaceholder('month')).toBe(true);
    expect(isKnownPlaceholder('day')).toBe(true);
    expect(isKnownPlaceholder('date')).toBe(true);
  });

  it('returns true for known metadata placeholders', () => {
    expect(isKnownPlaceholder('title')).toBe(true);
    expect(isKnownPlaceholder('author')).toBe(true);
    expect(isKnownPlaceholder('camera')).toBe(true);
    expect(isKnownPlaceholder('location')).toBe(true);
  });

  it('returns true for known file placeholders', () => {
    expect(isKnownPlaceholder('ext')).toBe(true);
    expect(isKnownPlaceholder('original')).toBe(true);
    expect(isKnownPlaceholder('size')).toBe(true);
  });

  it('returns false for unknown placeholders', () => {
    expect(isKnownPlaceholder('custom')).toBe(false);
    expect(isKnownPlaceholder('unknown')).toBe(false);
    expect(isKnownPlaceholder('foo')).toBe(false);
  });
});

describe('getKnownPlaceholders', () => {
  it('returns only known placeholders', () => {
    const known = getKnownPlaceholders('{year}-{custom}-{title}');
    expect(known).toEqual(['year', 'title']);
  });

  it('returns empty array if no known placeholders', () => {
    const known = getKnownPlaceholders('{foo}-{bar}');
    expect(known).toEqual([]);
  });
});

describe('getUnknownPlaceholders', () => {
  it('returns only unknown placeholders', () => {
    const unknown = getUnknownPlaceholders('{year}-{custom}-{title}');
    expect(unknown).toEqual(['custom']);
  });

  it('returns empty array if all placeholders are known', () => {
    const unknown = getUnknownPlaceholders('{year}-{month}');
    expect(unknown).toEqual([]);
  });

  it('returns all placeholders if none are known', () => {
    const unknown = getUnknownPlaceholders('{foo}-{bar}');
    expect(unknown).toEqual(['foo', 'bar']);
  });
});
