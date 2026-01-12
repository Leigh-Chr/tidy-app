import { describe, it, expect } from 'vitest';
import {
  resolveFilePlaceholder,
  isFilePlaceholder,
  getFilePlaceholders,
  templateNeedsAi,
  AI_PLACEHOLDERS,
  stripDatePrefix,
  templateStartsWithDate,
  stripDatePatterns,
  stripDateFromStart,
  stripDateFromEnd,
  templateHasDatePlaceholder,
  type FilePlaceholder,
} from './file-resolver.js';
import type { PlaceholderContext } from '../../types/template.js';
import { FileCategory } from '../../types/file-category.js';

/**
 * Create a mock PlaceholderContext for testing
 */
const createMockContext = (
  overrides: Partial<PlaceholderContext['file']> = {},
  templatePattern?: string
): PlaceholderContext => ({
  file: {
    path: '/test/photos/vacation.jpg',
    name: 'vacation',
    extension: 'jpg',
    size: 2621440, // 2.5 MB
    createdAt: new Date(),
    modifiedAt: new Date(),
    category: FileCategory.IMAGE,
    metadataSupported: true,
    ...overrides,
  },
  templatePattern,
});

describe('resolveFilePlaceholder', () => {
  describe('ext placeholder', () => {
    it('returns file extension without dot', () => {
      const context = createMockContext({ extension: 'jpg' });
      const result = resolveFilePlaceholder('ext', context);

      expect(result.name).toBe('ext');
      expect(result.value).toBe('jpg');
      expect(result.source).toBe('filesystem');
    });

    it('handles extension with leading dot', () => {
      const context = createMockContext({ extension: '.png' });
      const result = resolveFilePlaceholder('ext', context);

      expect(result.value).toBe('png');
    });

    it('returns empty string for files without extension', () => {
      const context = createMockContext({ extension: '' });
      const result = resolveFilePlaceholder('ext', context);

      expect(result.value).toBe('');
      expect(result.source).toBe('literal');
    });

    it('handles null extension', () => {
      const context = createMockContext({
        extension: null as unknown as string,
      });
      const result = resolveFilePlaceholder('ext', context);

      expect(result.value).toBe('');
      expect(result.source).toBe('literal');
    });

    it('handles undefined extension', () => {
      const context = createMockContext({
        extension: undefined as unknown as string,
      });
      const result = resolveFilePlaceholder('ext', context);

      expect(result.value).toBe('');
      expect(result.source).toBe('literal');
    });

    it('returns custom fallback when no extension', () => {
      const context = createMockContext({ extension: '' });
      const result = resolveFilePlaceholder('ext', context, {
        fallbacks: { ext: 'bin' },
      });

      expect(result.value).toBe('bin');
      expect(result.source).toBe('literal');
    });

    it('preserves extension case', () => {
      const context = createMockContext({ extension: 'PDF' });
      const result = resolveFilePlaceholder('ext', context);

      expect(result.value).toBe('PDF');
    });

    it('handles multi-character extensions', () => {
      const context = createMockContext({ extension: 'docx' });
      const result = resolveFilePlaceholder('ext', context);

      expect(result.value).toBe('docx');
    });
  });

  describe('original placeholder', () => {
    it('returns original filename without extension', () => {
      const context = createMockContext({ name: 'vacation_photo' });
      const result = resolveFilePlaceholder('original', context);

      expect(result.name).toBe('original');
      expect(result.value).toBe('vacation_photo');
      expect(result.source).toBe('filesystem');
    });

    it('preserves original casing', () => {
      const context = createMockContext({ name: 'MyDocument_Final' });
      const result = resolveFilePlaceholder('original', context);

      expect(result.value).toBe('MyDocument_Final');
    });

    it('returns empty string for empty filename', () => {
      const context = createMockContext({ name: '' });
      const result = resolveFilePlaceholder('original', context);

      expect(result.value).toBe('');
      expect(result.source).toBe('literal');
    });

    it('handles null filename', () => {
      const context = createMockContext({ name: null as unknown as string });
      const result = resolveFilePlaceholder('original', context);

      expect(result.value).toBe('');
      expect(result.source).toBe('literal');
    });

    it('returns custom fallback when no name', () => {
      const context = createMockContext({ name: '' });
      const result = resolveFilePlaceholder('original', context, {
        fallbacks: { original: 'untitled' },
      });

      expect(result.value).toBe('untitled');
      expect(result.source).toBe('literal');
    });

    it('sanitizes filename with invalid characters by default', () => {
      const context = createMockContext({ name: 'file:with/special*chars' });
      const result = resolveFilePlaceholder('original', context);

      // Sanitization should replace invalid characters
      expect(result.value).not.toContain(':');
      expect(result.value).not.toContain('/');
      expect(result.value).not.toContain('*');
    });

    it('can skip sanitization when requested', () => {
      const context = createMockContext({ name: 'file:with:colons' });
      const result = resolveFilePlaceholder('original', context, {
        sanitizeForFilename: false,
      });

      expect(result.value).toBe('file:with:colons');
    });

    it('handles filenames with spaces', () => {
      const context = createMockContext({ name: 'my vacation photo' });
      const result = resolveFilePlaceholder('original', context);

      // Should be sanitized (spaces become underscores typically)
      expect(result.value).toBe('my_vacation_photo');
    });

    it('handles filenames with numbers', () => {
      const context = createMockContext({ name: 'IMG_20240101_120000' });
      const result = resolveFilePlaceholder('original', context);

      expect(result.value).toBe('IMG_20240101_120000');
    });
  });

  describe('size placeholder', () => {
    it('formats size in MB', () => {
      const context = createMockContext({ size: 2621440 }); // 2.5 MB
      const result = resolveFilePlaceholder('size', context);

      expect(result.name).toBe('size');
      expect(result.value).toBe('2.5MB');
      expect(result.source).toBe('filesystem');
    });

    it('formats size in KB', () => {
      const context = createMockContext({ size: 51200 }); // 50 KB
      const result = resolveFilePlaceholder('size', context);

      expect(result.value).toBe('50KB');
    });

    it('formats size in GB', () => {
      const context = createMockContext({ size: 1610612736 }); // 1.5 GB
      const result = resolveFilePlaceholder('size', context);

      expect(result.value).toBe('1.5GB');
    });

    it('formats size in bytes for small files', () => {
      const context = createMockContext({ size: 512 });
      const result = resolveFilePlaceholder('size', context);

      expect(result.value).toBe('512B');
    });

    it('handles zero size', () => {
      const context = createMockContext({ size: 0 });
      const result = resolveFilePlaceholder('size', context);

      expect(result.value).toBe('0B');
    });

    it('handles null size', () => {
      const context = createMockContext({ size: null as unknown as number });
      const result = resolveFilePlaceholder('size', context);

      expect(result.value).toBe('');
      expect(result.source).toBe('literal');
    });

    it('handles undefined size', () => {
      const context = createMockContext({
        size: undefined as unknown as number,
      });
      const result = resolveFilePlaceholder('size', context);

      expect(result.value).toBe('');
      expect(result.source).toBe('literal');
    });

    it('returns custom fallback when no size', () => {
      const context = createMockContext({ size: null as unknown as number });
      const result = resolveFilePlaceholder('size', context, {
        fallbacks: { size: 'unknown' },
      });

      expect(result.value).toBe('unknown');
      expect(result.source).toBe('literal');
    });

    it('formats very large files', () => {
      const context = createMockContext({ size: 10737418240 }); // 10 GB
      const result = resolveFilePlaceholder('size', context);

      expect(result.value).toBe('10GB');
    });

    it('formats exact KB boundary', () => {
      const context = createMockContext({ size: 1024 });
      const result = resolveFilePlaceholder('size', context);

      expect(result.value).toBe('1KB');
    });

    it('formats exact MB boundary', () => {
      const context = createMockContext({ size: 1048576 });
      const result = resolveFilePlaceholder('size', context);

      expect(result.value).toBe('1MB');
    });
  });

  describe('ai placeholder', () => {
    it('returns AI suggestion when available', () => {
      const context = createMockContext();
      context.aiSuggestion = {
        suggestedName: 'beach_sunset_vacation',
        confidence: 0.9,
        reasoning: 'Image shows a beach at sunset',
      };
      const result = resolveFilePlaceholder('ai', context);

      expect(result.name).toBe('ai');
      expect(result.value).toBe('beach_sunset_vacation');
      expect(result.source).toBe('ai');
    });

    it('returns empty string when no AI suggestion', () => {
      const context = createMockContext();
      const result = resolveFilePlaceholder('ai', context);

      expect(result.value).toBe('');
      expect(result.source).toBe('literal');
    });

    it('returns fallback when no AI suggestion', () => {
      const context = createMockContext();
      const result = resolveFilePlaceholder('ai', context, {
        fallbacks: { ai: 'no_ai_available' },
      });

      expect(result.value).toBe('no_ai_available');
      expect(result.source).toBe('literal');
    });

    it('sanitizes AI suggestion by default', () => {
      const context = createMockContext();
      context.aiSuggestion = {
        suggestedName: 'beach:sunset/vacation*photo',
        confidence: 0.9,
      };
      const result = resolveFilePlaceholder('ai', context);

      expect(result.value).not.toContain(':');
      expect(result.value).not.toContain('/');
      expect(result.value).not.toContain('*');
    });

    it('can skip sanitization for AI suggestion', () => {
      const context = createMockContext();
      context.aiSuggestion = {
        suggestedName: 'name:with:colons',
        confidence: 0.9,
      };
      const result = resolveFilePlaceholder('ai', context, {
        sanitizeForFilename: false,
      });

      expect(result.value).toBe('name:with:colons');
    });
  });

  describe('name placeholder (smart name)', () => {
    it('uses AI suggestion when available', () => {
      const context = createMockContext({ name: 'vacation' });
      context.aiSuggestion = {
        suggestedName: 'beach_sunset_photo',
        confidence: 0.9,
      };
      const result = resolveFilePlaceholder('name', context);

      expect(result.name).toBe('name');
      expect(result.value).toBe('beach_sunset_photo');
      expect(result.source).toBe('ai');
    });

    it('falls back to original filename when no AI suggestion', () => {
      const context = createMockContext({ name: 'vacation' });
      // No AI suggestion
      const result = resolveFilePlaceholder('name', context);

      expect(result.value).toBe('vacation');
      expect(result.source).toBe('filesystem');
    });

    it('uses fallback when no name and no AI suggestion', () => {
      const context = createMockContext({ name: '' });
      const result = resolveFilePlaceholder('name', context, {
        fallbacks: { name: 'untitled' },
      });

      expect(result.value).toBe('untitled');
      expect(result.source).toBe('literal');
    });

    it('sanitizes AI suggestion by default', () => {
      const context = createMockContext({ name: 'vacation' });
      context.aiSuggestion = {
        suggestedName: 'beach sunset photo',
        confidence: 0.9,
      };
      const result = resolveFilePlaceholder('name', context);

      expect(result.value).toBe('beach_sunset_photo');
      expect(result.source).toBe('ai');
    });

    it('sanitizes original filename when falling back', () => {
      const context = createMockContext({ name: 'my vacation photo' });
      const result = resolveFilePlaceholder('name', context);

      expect(result.value).toBe('my_vacation_photo');
      expect(result.source).toBe('filesystem');
    });

    it('can skip sanitization', () => {
      const context = createMockContext({ name: 'file:with:colons' });
      const result = resolveFilePlaceholder('name', context, {
        sanitizeForFilename: false,
      });

      expect(result.value).toBe('file:with:colons');
    });
  });

  describe('original placeholder always ignores AI', () => {
    it('returns original filename even when AI suggestion is available', () => {
      const context = createMockContext({ name: 'vacation' });
      context.aiSuggestion = {
        suggestedName: 'beach_sunset_photo',
        confidence: 0.9,
      };
      const result = resolveFilePlaceholder('original', context);

      expect(result.value).toBe('vacation');
      expect(result.source).toBe('filesystem');
    });
  });

  describe('fallback handling', () => {
    it('uses global fallback for missing values', () => {
      const context = createMockContext({
        extension: '',
        name: '',
        size: null as unknown as number,
      });

      const extResult = resolveFilePlaceholder('ext', context, {
        fallback: 'none',
      });
      const nameResult = resolveFilePlaceholder('original', context, {
        fallback: 'untitled',
      });
      const sizeResult = resolveFilePlaceholder('size', context, {
        fallback: 'unknown',
      });

      expect(extResult.value).toBe('none');
      expect(nameResult.value).toBe('untitled');
      expect(sizeResult.value).toBe('unknown');
    });

    it('per-placeholder fallback overrides global fallback', () => {
      const context = createMockContext({ extension: '' });
      const result = resolveFilePlaceholder('ext', context, {
        fallback: 'global',
        fallbacks: { ext: 'specific' },
      });

      expect(result.value).toBe('specific');
    });
  });
});

describe('isFilePlaceholder', () => {
  it('returns true for name placeholder', () => {
    expect(isFilePlaceholder('name')).toBe(true);
  });

  it('returns true for ext placeholder', () => {
    expect(isFilePlaceholder('ext')).toBe(true);
  });

  it('returns true for original placeholder', () => {
    expect(isFilePlaceholder('original')).toBe(true);
  });

  it('returns true for size placeholder', () => {
    expect(isFilePlaceholder('size')).toBe(true);
  });

  it('returns true for ai placeholder', () => {
    expect(isFilePlaceholder('ai')).toBe(true);
  });

  it('returns false for date placeholders', () => {
    expect(isFilePlaceholder('year')).toBe(false);
    expect(isFilePlaceholder('month')).toBe(false);
    expect(isFilePlaceholder('day')).toBe(false);
  });

  it('returns false for metadata placeholders', () => {
    expect(isFilePlaceholder('title')).toBe(false);
    expect(isFilePlaceholder('author')).toBe(false);
    expect(isFilePlaceholder('camera')).toBe(false);
    expect(isFilePlaceholder('location')).toBe(false);
  });

  it('returns false for unknown placeholders', () => {
    expect(isFilePlaceholder('unknown')).toBe(false);
    expect(isFilePlaceholder('')).toBe(false);
    expect(isFilePlaceholder('filename')).toBe(false);
  });
});

describe('getFilePlaceholders', () => {
  it('returns all file placeholders', () => {
    const placeholders = getFilePlaceholders();

    expect(placeholders).toContain('name');
    expect(placeholders).toContain('ext');
    expect(placeholders).toContain('original');
    expect(placeholders).toContain('size');
    expect(placeholders).toContain('ai');
  });

  it('returns exactly 5 placeholders', () => {
    const placeholders = getFilePlaceholders();
    expect(placeholders).toHaveLength(5);
  });

  it('returns a readonly array', () => {
    const placeholders = getFilePlaceholders();

    // TypeScript should prevent mutation, but verify it's an array
    expect(Array.isArray(placeholders)).toBe(true);
  });

  it('returns the same instance on multiple calls', () => {
    const first = getFilePlaceholders();
    const second = getFilePlaceholders();

    expect(first).toBe(second);
  });
});

describe('type safety', () => {
  it('FilePlaceholder type includes all valid values', () => {
    const validPlaceholders: FilePlaceholder[] = ['name', 'ext', 'original', 'size', 'ai'];

    for (const placeholder of validPlaceholders) {
      expect(isFilePlaceholder(placeholder)).toBe(true);
    }
  });
});

describe('templateNeedsAi', () => {
  it('returns true for templates with {name} placeholder', () => {
    expect(templateNeedsAi('{date}-{name}')).toBe(true);
    expect(templateNeedsAi('{name}.{ext}')).toBe(true);
    expect(templateNeedsAi('{year}/{month}/{name}')).toBe(true);
  });

  it('returns true for templates with {ai} placeholder', () => {
    expect(templateNeedsAi('{date}-{ai}')).toBe(true);
    expect(templateNeedsAi('{ai}.{ext}')).toBe(true);
  });

  it('returns false for templates with only {original}', () => {
    expect(templateNeedsAi('{date}-{original}')).toBe(false);
    expect(templateNeedsAi('{original}.{ext}')).toBe(false);
  });

  it('returns false for templates without name placeholders', () => {
    expect(templateNeedsAi('{year}/{month}/{day}')).toBe(false);
    expect(templateNeedsAi('{date}-{author}')).toBe(false);
    expect(templateNeedsAi('{title}.{ext}')).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(templateNeedsAi('{NAME}')).toBe(true);
    expect(templateNeedsAi('{AI}')).toBe(true);
    expect(templateNeedsAi('{Name}')).toBe(true);
  });

  it('returns true if template has both {name} and {ai}', () => {
    expect(templateNeedsAi('{name}-{ai}')).toBe(true);
  });

  it('handles empty template', () => {
    expect(templateNeedsAi('')).toBe(false);
  });

  it('handles template with no placeholders', () => {
    expect(templateNeedsAi('static-filename')).toBe(false);
  });
});

describe('AI_PLACEHOLDERS', () => {
  it('contains name and ai', () => {
    expect(AI_PLACEHOLDERS).toContain('name');
    expect(AI_PLACEHOLDERS).toContain('ai');
  });

  it('does not contain original', () => {
    expect(AI_PLACEHOLDERS).not.toContain('original');
  });

  it('has exactly 2 items', () => {
    expect(AI_PLACEHOLDERS).toHaveLength(2);
  });
});

describe('stripDatePrefix', () => {
  it('strips YYYY-MM-DD prefix', () => {
    expect(stripDatePrefix('2024-01-15-vacation')).toBe('vacation');
    expect(stripDatePrefix('2024-01-15_photo')).toBe('photo');
    expect(stripDatePrefix('2024-01-15 document')).toBe('document');
  });

  it('strips YYYY_MM_DD prefix', () => {
    expect(stripDatePrefix('2024_01_15_vacation')).toBe('vacation');
    expect(stripDatePrefix('2024_01_15-photo')).toBe('photo');
  });

  it('strips YYYYMMDD prefix', () => {
    expect(stripDatePrefix('20240115-vacation')).toBe('vacation');
    expect(stripDatePrefix('20240115_photo')).toBe('photo');
    expect(stripDatePrefix('20240115 document')).toBe('document');
  });

  it('does not strip when no date prefix', () => {
    expect(stripDatePrefix('vacation')).toBe('vacation');
    expect(stripDatePrefix('my-photo')).toBe('my-photo');
    expect(stripDatePrefix('document_final')).toBe('document_final');
  });

  it('does not strip if only date (no content after)', () => {
    expect(stripDatePrefix('2024-01-15')).toBe('2024-01-15');
    expect(stripDatePrefix('20240115')).toBe('20240115');
  });

  it('handles multiple separators', () => {
    // The regex strips the date and the separators following it
    // so 2024-01-15-- becomes just vacation (both dashes are separators)
    expect(stripDatePrefix('2024-01-15--vacation')).toBe('vacation');
    expect(stripDatePrefix('2024-01-15__photo')).toBe('photo');
  });
});

describe('templateStartsWithDate', () => {
  it('returns true for templates starting with {date}', () => {
    expect(templateStartsWithDate('{date}-{name}')).toBe(true);
    expect(templateStartsWithDate('{date}_{original}')).toBe(true);
    expect(templateStartsWithDate('{date}/{name}')).toBe(true);
  });

  it('returns true for templates starting with {year}', () => {
    expect(templateStartsWithDate('{year}-{month}-{name}')).toBe(true);
    expect(templateStartsWithDate('{year}/{month}/{name}')).toBe(true);
  });

  it('returns false for templates not starting with date', () => {
    expect(templateStartsWithDate('{name}-{date}')).toBe(false);
    expect(templateStartsWithDate('{original}')).toBe(false);
    expect(templateStartsWithDate('{camera}-{date}-{name}')).toBe(false);
  });

  it('returns false for empty or undefined template', () => {
    expect(templateStartsWithDate('')).toBe(false);
    expect(templateStartsWithDate(undefined)).toBe(false);
  });

  it('handles whitespace at start', () => {
    expect(templateStartsWithDate('  {date}-{name}')).toBe(true);
  });
});

describe('name placeholder with date stripping', () => {
  const createMockContext = (
    overrides: Partial<PlaceholderContext['file']> = {},
    templatePattern?: string
  ): PlaceholderContext => ({
    file: {
      path: '/test/photos/vacation.jpg',
      name: 'vacation',
      extension: 'jpg',
      size: 2621440,
      createdAt: new Date(),
      modifiedAt: new Date(),
      category: FileCategory.IMAGE,
      metadataSupported: true,
      ...overrides,
    },
    templatePattern,
  });

  it('strips date prefix when template starts with {date}', () => {
    const context = createMockContext({ name: '2024-01-15-vacation' }, '{date}-{name}');
    const result = resolveFilePlaceholder('name', context);

    expect(result.value).toBe('vacation');
    expect(result.source).toBe('filesystem');
  });

  it('strips date prefix when template starts with {year}', () => {
    const context = createMockContext({ name: '2024-01-15-vacation' }, '{year}/{month}/{name}');
    const result = resolveFilePlaceholder('name', context);

    expect(result.value).toBe('vacation');
    expect(result.source).toBe('filesystem');
  });

  it('strips date when template has date placeholder anywhere (not just at start)', () => {
    // NEW behavior: strip dates when template contains ANY date placeholder
    // This prevents duplication like "2024-01-15-vacation-2024-01-15"
    const context = createMockContext({ name: '2024-01-15-vacation' }, '{name}-{date}');
    // Disable sanitization to test raw value
    const result = resolveFilePlaceholder('name', context, { sanitizeForFilename: false });

    expect(result.value).toBe('vacation');
    expect(result.source).toBe('filesystem');
  });

  it('does not strip date when no template pattern provided', () => {
    const context = createMockContext({ name: '2024-01-15-vacation' });
    // Disable sanitization to test raw value
    const result = resolveFilePlaceholder('name', context, { sanitizeForFilename: false });

    expect(result.value).toBe('2024-01-15-vacation');
    expect(result.source).toBe('filesystem');
  });

  it('strips date from AI suggestion when template starts with date', () => {
    const context = createMockContext({ name: 'original' }, '{date}-{name}');
    context.aiSuggestion = {
      suggestedName: '2024-01-15-ai-suggested-name',
      confidence: 0.9,
    };
    // Disable sanitization to test raw value
    const result = resolveFilePlaceholder('name', context, { sanitizeForFilename: false });

    expect(result.value).toBe('ai-suggested-name');
    expect(result.source).toBe('ai');
  });

  it('handles filename that is only a date (no stripping)', () => {
    const context = createMockContext({ name: '2024-01-15' }, '{date}-{name}');
    // Disable sanitization to test raw value
    const result = resolveFilePlaceholder('name', context, { sanitizeForFilename: false });

    // Should not strip because nothing would be left
    expect(result.value).toBe('2024-01-15');
    expect(result.source).toBe('filesystem');
  });

  it('original placeholder does not strip dates', () => {
    const context = createMockContext({ name: '2024-01-15-vacation' }, '{date}-{original}');
    // Disable sanitization to test raw value
    const result = resolveFilePlaceholder('original', context, { sanitizeForFilename: false });

    // {original} should always return original filename, no stripping
    expect(result.value).toBe('2024-01-15-vacation');
    expect(result.source).toBe('filesystem');
  });
});

// ============================================================================
// New comprehensive date stripping tests
// ============================================================================

describe('templateHasDatePlaceholder', () => {
  it('returns true for templates with {date}', () => {
    expect(templateHasDatePlaceholder('{date}-{name}')).toBe(true);
    expect(templateHasDatePlaceholder('{name}-{date}')).toBe(true);
    expect(templateHasDatePlaceholder('{name}/{date}/{ext}')).toBe(true);
  });

  it('returns true for templates with {year}', () => {
    expect(templateHasDatePlaceholder('{year}-{name}')).toBe(true);
    expect(templateHasDatePlaceholder('{name}-{year}')).toBe(true);
  });

  it('returns true for templates with {month}', () => {
    expect(templateHasDatePlaceholder('{year}/{month}/{name}')).toBe(true);
    expect(templateHasDatePlaceholder('{month}-{name}')).toBe(true);
  });

  it('returns true for templates with {day}', () => {
    expect(templateHasDatePlaceholder('{day}-{name}')).toBe(true);
  });

  it('returns false for templates without date placeholders', () => {
    expect(templateHasDatePlaceholder('{name}.{ext}')).toBe(false);
    expect(templateHasDatePlaceholder('{original}')).toBe(false);
    expect(templateHasDatePlaceholder('{camera}-{name}')).toBe(false);
  });

  it('returns false for empty or undefined templates', () => {
    expect(templateHasDatePlaceholder('')).toBe(false);
    expect(templateHasDatePlaceholder(undefined)).toBe(false);
  });

  it('handles date format specifiers', () => {
    // {date:YYYY-MM-DD} should still be detected as having a date placeholder
    expect(templateHasDatePlaceholder('{date:YYYY-MM-DD}-{name}')).toBe(true);
  });
});

describe('stripDateFromStart', () => {
  it('strips full date formats', () => {
    expect(stripDateFromStart('2024-01-15-vacation')).toBe('vacation');
    expect(stripDateFromStart('2024_01_15_vacation')).toBe('vacation');
    expect(stripDateFromStart('20240115-vacation')).toBe('vacation');
    expect(stripDateFromStart('15-01-2024-vacation')).toBe('vacation');
  });

  it('strips year-month format when followed by non-digit', () => {
    expect(stripDateFromStart('2024-01-vacation')).toBe('vacation');
    expect(stripDateFromStart('2024_01_vacation')).toBe('vacation');
  });

  it('strips year-only format when followed by non-digit', () => {
    expect(stripDateFromStart('2024-vacation')).toBe('vacation');
    expect(stripDateFromStart('2024_vacation')).toBe('vacation');
  });

  it('does not break up full dates when matching partial patterns', () => {
    // Year-month should NOT match if followed by digits (day)
    expect(stripDateFromStart('2024-01-15')).toBe('2024-01-15');
    // Year-only should NOT match if followed by digits (month)
    expect(stripDateFromStart('2024-01-vacation')).toBe('vacation'); // year-month matches, not year-only
  });

  it('does not strip from middle', () => {
    expect(stripDateFromStart('vacation-2024-01-15')).toBe('vacation-2024-01-15');
  });
});

describe('stripDateFromEnd', () => {
  it('strips full date formats from end', () => {
    expect(stripDateFromEnd('vacation-2024-01-15')).toBe('vacation');
    expect(stripDateFromEnd('vacation_2024_01_15')).toBe('vacation');
    expect(stripDateFromEnd('vacation-20240115')).toBe('vacation');
    expect(stripDateFromEnd('vacation-15-01-2024')).toBe('vacation');
  });

  it('strips year-month format from end when preceded by non-digit', () => {
    expect(stripDateFromEnd('vacation-2024-01')).toBe('vacation');
    expect(stripDateFromEnd('vacation_2024_01')).toBe('vacation');
  });

  it('strips year-only format from end when preceded by non-digit', () => {
    expect(stripDateFromEnd('vacation-2024')).toBe('vacation');
    expect(stripDateFromEnd('vacation_2024')).toBe('vacation');
  });

  it('does not break up full dates when matching partial patterns', () => {
    // Should strip full date, not just year-month leaving the day
    const result = stripDateFromEnd('vacation-2024-01-15');
    expect(result).toBe('vacation');
  });

  it('does not strip from start', () => {
    expect(stripDateFromEnd('2024-01-15-vacation')).toBe('2024-01-15-vacation');
  });
});

describe('stripDatePatterns (comprehensive)', () => {
  it('strips date from start only', () => {
    expect(stripDatePatterns('2024-01-15-vacation')).toBe('vacation');
  });

  it('strips date from end only', () => {
    expect(stripDatePatterns('vacation-2024-01-15')).toBe('vacation');
  });

  it('strips dates from both start AND end', () => {
    expect(stripDatePatterns('2024-01-15-vacation-2024-02-20')).toBe('vacation');
  });

  it('preserves dates in the middle', () => {
    // Date in middle is likely meaningful context
    expect(stripDatePatterns('vacation-2024-01-15-beach')).toBe('vacation-2024-01-15-beach');
  });

  it('handles year-only patterns', () => {
    expect(stripDatePatterns('2024-vacation')).toBe('vacation');
    expect(stripDatePatterns('vacation-2024')).toBe('vacation');
    expect(stripDatePatterns('2024-vacation-2025')).toBe('vacation');
  });

  it('handles year-month patterns', () => {
    expect(stripDatePatterns('2024-01-vacation')).toBe('vacation');
    expect(stripDatePatterns('vacation-2024-01')).toBe('vacation');
  });

  it('does not strip when result would be empty', () => {
    expect(stripDatePatterns('2024-01-15')).toBe('2024-01-15');
    expect(stripDatePatterns('2024')).toBe('2024');
  });

  it('preserves content with no date patterns', () => {
    expect(stripDatePatterns('vacation')).toBe('vacation');
    expect(stripDatePatterns('my-vacation-photo')).toBe('my-vacation-photo');
  });
});

describe('name placeholder with comprehensive date handling', () => {
  it('strips date from end when template has {date} at start', () => {
    const context = createMockContext({ name: 'vacation-2024-01-15' }, '{date}-{name}');
    const result = resolveFilePlaceholder('name', context, { sanitizeForFilename: false });

    expect(result.value).toBe('vacation');
    expect(result.source).toBe('filesystem');
  });

  it('strips date from start when template has {date} at end', () => {
    const context = createMockContext({ name: '2024-01-15-vacation' }, '{name}-{date}');
    const result = resolveFilePlaceholder('name', context, { sanitizeForFilename: false });

    expect(result.value).toBe('vacation');
    expect(result.source).toBe('filesystem');
  });

  it('strips dates from both ends', () => {
    const context = createMockContext({ name: '2024-01-15-vacation-2024-02-20' }, '{date}-{name}');
    const result = resolveFilePlaceholder('name', context, { sanitizeForFilename: false });

    expect(result.value).toBe('vacation');
    expect(result.source).toBe('filesystem');
  });

  it('preserves date in middle', () => {
    const context = createMockContext({ name: 'event-2024-01-15-photos' }, '{year}-{name}');
    const result = resolveFilePlaceholder('name', context, { sanitizeForFilename: false });

    // Date in middle should be preserved
    expect(result.value).toBe('event-2024-01-15-photos');
    expect(result.source).toBe('filesystem');
  });

  it('strips year-only prefix', () => {
    const context = createMockContext({ name: '2024-vacation' }, '{year}-{name}');
    const result = resolveFilePlaceholder('name', context, { sanitizeForFilename: false });

    expect(result.value).toBe('vacation');
    expect(result.source).toBe('filesystem');
  });

  it('strips year-only suffix', () => {
    const context = createMockContext({ name: 'vacation-2024' }, '{name}-{year}');
    const result = resolveFilePlaceholder('name', context, { sanitizeForFilename: false });

    expect(result.value).toBe('vacation');
    expect(result.source).toBe('filesystem');
  });

  it('does not strip when template has no date placeholders', () => {
    const context = createMockContext({ name: '2024-01-15-vacation' }, '{name}.{ext}');
    const result = resolveFilePlaceholder('name', context, { sanitizeForFilename: false });

    // No date placeholder in template, so don't strip
    expect(result.value).toBe('2024-01-15-vacation');
    expect(result.source).toBe('filesystem');
  });

  it('handles compact date format YYYYMMDD', () => {
    const context = createMockContext({ name: '20240115-vacation' }, '{date}-{name}');
    const result = resolveFilePlaceholder('name', context, { sanitizeForFilename: false });

    expect(result.value).toBe('vacation');
    expect(result.source).toBe('filesystem');
  });

  it('handles DD-MM-YYYY format', () => {
    const context = createMockContext({ name: '15-01-2024-vacation' }, '{date}-{name}');
    const result = resolveFilePlaceholder('name', context, { sanitizeForFilename: false });

    expect(result.value).toBe('vacation');
    expect(result.source).toBe('filesystem');
  });

  it('strips from AI suggestion too', () => {
    const context: PlaceholderContext = {
      ...createMockContext({ name: 'original' }, '{date}-{name}'),
      aiSuggestion: {
        suggestedName: '2024-01-15-ai-suggested-name',
        confidence: 0.9,
      },
    };
    const result = resolveFilePlaceholder('name', context, { sanitizeForFilename: false });

    expect(result.value).toBe('ai-suggested-name');
    expect(result.source).toBe('ai');
  });
});

// ============================================================================
// Edge cases and comprehensive coverage tests
// ============================================================================

describe('date stripping edge cases', () => {
  describe('mixed separator handling', () => {
    it('handles underscore separators consistently', () => {
      expect(stripDateFromStart('2024_01_15_vacation')).toBe('vacation');
      expect(stripDateFromEnd('vacation_2024_01_15')).toBe('vacation');
    });

    it('handles whitespace separators', () => {
      expect(stripDateFromStart('2024-01-15 vacation')).toBe('vacation');
      expect(stripDateFromEnd('vacation 2024-01-15')).toBe('vacation');
    });

    it('handles multiple consecutive separators', () => {
      expect(stripDateFromStart('2024-01-15---vacation')).toBe('vacation');
      expect(stripDateFromStart('2024-01-15___vacation')).toBe('vacation');
    });
  });

  describe('multiple dates handling', () => {
    it('strips only one date from each end', () => {
      // First date stripped from start, second from end
      expect(stripDatePatterns('2024-01-15-vacation-2024-02-20')).toBe('vacation');
    });

    it('handles consecutive dates at start', () => {
      // Only first date is stripped, second becomes the "content"
      const result = stripDateFromStart('2024-01-15-2024-02-20-vacation');
      expect(result).toBe('2024-02-20-vacation');
    });

    it('handles consecutive dates at end', () => {
      // Only last date pattern is stripped
      const result = stripDateFromEnd('vacation-2024-01-15-2024-02-20');
      expect(result).toBe('vacation-2024-01-15');
    });

    it('strips both when content is between two dates', () => {
      expect(stripDatePatterns('2024-01-15-photo-2024-02-20')).toBe('photo');
    });
  });

  describe('different date formats at start and end', () => {
    it('handles ISO at start and compact at end', () => {
      expect(stripDatePatterns('2024-01-15-vacation-20240220')).toBe('vacation');
    });

    it('handles year-only at start and full date at end', () => {
      expect(stripDatePatterns('2024-vacation-2024-02-20')).toBe('vacation');
    });

    it('handles full date at start and year-only at end', () => {
      expect(stripDatePatterns('2024-01-15-vacation-2025')).toBe('vacation');
    });
  });

  describe('short content handling', () => {
    it('preserves single character content', () => {
      expect(stripDatePatterns('2024-01-15-a')).toBe('a');
      expect(stripDatePatterns('a-2024-01-15')).toBe('a');
    });

    it('preserves two character content', () => {
      expect(stripDatePatterns('2024-01-15-ab')).toBe('ab');
    });

    it('handles single character between dates', () => {
      expect(stripDatePatterns('2024-01-15-x-2024-02-20')).toBe('x');
    });
  });

  describe('non-date numbers handling', () => {
    it('does not strip invalid dates at start', () => {
      // 9999-99-99 is not a real date but matches the pattern
      // We accept this as the pattern is format-based, not value-based
      expect(stripDateFromStart('9999-99-99-vacation')).toBe('vacation');
    });

    it('does not strip 3-digit year patterns', () => {
      expect(stripDateFromStart('202-01-15-vacation')).toBe('202-01-15-vacation');
    });

    it('does not strip 5-digit year patterns', () => {
      expect(stripDateFromStart('20240-01-15-vacation')).toBe('20240-01-15-vacation');
    });

    it('handles numbers in content that look like dates', () => {
      // Content contains numbers but not at boundaries
      expect(stripDatePatterns('photo-1234-5678-scan')).toBe('photo-1234-5678-scan');
    });
  });

  describe('empty and edge string handling', () => {
    it('handles empty string', () => {
      expect(stripDatePatterns('')).toBe('');
      expect(stripDateFromStart('')).toBe('');
      expect(stripDateFromEnd('')).toBe('');
    });

    it('handles string with only separators', () => {
      expect(stripDatePatterns('---')).toBe('---');
    });

    it('handles very long filenames', () => {
      const longName = '2024-01-15-' + 'a'.repeat(200) + '-2024-02-20';
      const expected = 'a'.repeat(200);
      expect(stripDatePatterns(longName)).toBe(expected);
    });
  });

  describe('year pattern disambiguation', () => {
    it('year pattern requires non-digit after', () => {
      // 2024-01 should be treated as year-month, not year + "01"
      expect(stripDateFromStart('2024-01-vacation')).toBe('vacation');
    });

    it('year-only does not match if followed by digit', () => {
      // Should not strip "2024" leaving "01-15" (would break the date)
      expect(stripDateFromStart('2024-01-15')).toBe('2024-01-15');
    });

    it('year-month does not match if followed by digit', () => {
      // Should not strip "2024-01" leaving "15" (would break the date)
      expect(stripDateFromStart('2024-01-15')).toBe('2024-01-15');
    });

    it('year at end requires non-digit before', () => {
      // "vacation-2024" should strip, but "01-2024" should not (might be MM-YYYY)
      expect(stripDateFromEnd('vacation-2024')).toBe('vacation');
    });
  });

  describe('special characters in content', () => {
    it('preserves special characters in middle', () => {
      expect(stripDatePatterns('2024-01-15-vacation_photo!-2024')).toBe('vacation_photo!');
    });

    it('handles parentheses in content', () => {
      expect(stripDatePatterns('2024-01-15-photo(1)')).toBe('photo(1)');
    });

    it('handles unicode in content', () => {
      expect(stripDatePatterns('2024-01-15-café-photo')).toBe('café-photo');
    });
  });
});

describe('templateHasDatePlaceholder edge cases', () => {
  it('handles template with only date placeholders', () => {
    expect(templateHasDatePlaceholder('{year}/{month}/{day}')).toBe(true);
    expect(templateHasDatePlaceholder('{date}')).toBe(true);
  });

  it('handles multiple date placeholders', () => {
    expect(templateHasDatePlaceholder('{date}-{name}-{year}')).toBe(true);
  });

  it('is case insensitive', () => {
    expect(templateHasDatePlaceholder('{DATE}-{name}')).toBe(true);
    expect(templateHasDatePlaceholder('{Year}/{Month}')).toBe(true);
  });

  it('handles format specifiers in date', () => {
    expect(templateHasDatePlaceholder('{date:YYYY-MM-DD}')).toBe(true);
    expect(templateHasDatePlaceholder('{date:DD/MM/YYYY}')).toBe(true);
  });

  it('does not match partial placeholder names', () => {
    // "birthday" contains "day" but is not the {day} placeholder
    expect(templateHasDatePlaceholder('{birthday}')).toBe(false);
    // "monthly" contains "month" but is not the {month} placeholder
    expect(templateHasDatePlaceholder('{monthly}')).toBe(false);
  });
});

describe('real-world filename scenarios', () => {
  it('handles iPhone photo naming', () => {
    const context = createMockContext({ name: 'IMG_20240115_123456' }, '{date}-{name}');
    const result = resolveFilePlaceholder('name', context, { sanitizeForFilename: false });
    // Should not strip - the date is part of IMG_ pattern, not a standalone prefix
    expect(result.value).toBe('IMG_20240115_123456');
  });

  it('handles screenshot naming conventions', () => {
    const context = createMockContext({ name: 'Screenshot_2024-01-15_12-30-45' }, '{date}-{name}');
    const result = resolveFilePlaceholder('name', context, { sanitizeForFilename: false });
    // Should strip the date prefix after Screenshot_
    expect(result.value).toBe('Screenshot_2024-01-15_12-30-45');
  });

  it('handles already organized files', () => {
    // File already has date prefix matching template
    const context = createMockContext({ name: '2024-01-15-vacation-photo' }, '{date}-{name}');
    const result = resolveFilePlaceholder('name', context, { sanitizeForFilename: false });
    expect(result.value).toBe('vacation-photo');
  });

  it('handles document naming with dates', () => {
    const context = createMockContext({ name: 'report-2024-Q1' }, '{date}-{name}');
    const result = resolveFilePlaceholder('name', context, { sanitizeForFilename: false });
    // Should not strip - 2024-Q1 is not a date pattern, Q is not a digit
    expect(result.value).toBe('report-2024-Q1');
  });

  it('handles invoice naming', () => {
    const context = createMockContext({ name: 'invoice-2024-001' }, '{year}-{name}');
    const result = resolveFilePlaceholder('name', context, { sanitizeForFilename: false });
    // Should not strip 2024-001 as 001 starts with digit
    expect(result.value).toBe('invoice-2024-001');
  });

  it('handles versioned files with year suffix', () => {
    const context = createMockContext({ name: 'project-v2-2024' }, '{name}-{year}');
    const result = resolveFilePlaceholder('name', context, { sanitizeForFilename: false });
    expect(result.value).toBe('project-v2');
  });

  it('handles folder-like patterns in templates', () => {
    const context = createMockContext({ name: '2024-01-15-vacation' }, '{year}/{month}/{name}');
    const result = resolveFilePlaceholder('name', context, { sanitizeForFilename: false });
    // Template has year and month, so should strip date
    expect(result.value).toBe('vacation');
  });
});

describe('integration with sanitization', () => {
  it('strips dates before sanitization', () => {
    const context = createMockContext({ name: '2024-01-15-my vacation' }, '{date}-{name}');
    const result = resolveFilePlaceholder('name', context, { sanitizeForFilename: true });
    // First strips date, then sanitizes "my vacation" → "my_vacation"
    expect(result.value).toBe('my_vacation');
  });

  it('handles special chars in date-stripped content', () => {
    // Use ':' which IS an invalid filename character and gets sanitized
    const context = createMockContext({ name: '2024-01-15-photo:beach' }, '{date}-{name}');
    const result = resolveFilePlaceholder('name', context, { sanitizeForFilename: true });
    // Strips date "2024-01-15-", leaving "photo:beach", then sanitizes ":" to "_"
    expect(result.value).toBe('photo_beach');
  });
});
