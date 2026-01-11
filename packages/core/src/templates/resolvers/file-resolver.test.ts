import { describe, it, expect } from 'vitest';
import {
  resolveFilePlaceholder,
  isFilePlaceholder,
  getFilePlaceholders,
  type FilePlaceholder,
} from './file-resolver.js';
import type { PlaceholderContext } from '../../types/template.js';
import { FileCategory } from '../../types/file-category.js';

/**
 * Create a mock PlaceholderContext for testing
 */
const createMockContext = (
  overrides: Partial<PlaceholderContext['file']> = {}
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
  it('returns true for ext placeholder', () => {
    expect(isFilePlaceholder('ext')).toBe(true);
  });

  it('returns true for original placeholder', () => {
    expect(isFilePlaceholder('original')).toBe(true);
  });

  it('returns true for size placeholder', () => {
    expect(isFilePlaceholder('size')).toBe(true);
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

    expect(placeholders).toContain('ext');
    expect(placeholders).toContain('original');
    expect(placeholders).toContain('size');
  });

  it('returns exactly 3 placeholders', () => {
    const placeholders = getFilePlaceholders();
    expect(placeholders).toHaveLength(3);
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
    const validPlaceholders: FilePlaceholder[] = ['ext', 'original', 'size'];

    for (const placeholder of validPlaceholders) {
      expect(isFilePlaceholder(placeholder)).toBe(true);
    }
  });
});
