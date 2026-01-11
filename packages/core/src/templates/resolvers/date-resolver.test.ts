import { describe, it, expect } from 'vitest';
import {
  resolveDatePlaceholder,
  isDatePlaceholder,
  getDatePlaceholders,
} from './date-resolver.js';
import type { PlaceholderContext } from '../../types/template.js';
import type { FileInfo } from '../../types/file-info.js';
import type { ImageMetadata } from '../../types/image-metadata.js';
import type { PDFMetadata } from '../../types/pdf-metadata.js';
import type { OfficeMetadata } from '../../types/office-metadata.js';
import { FileCategory } from '../../types/file-category.js';
import { MetadataCapability } from '../../types/metadata-capability.js';

const createMockFile = (overrides: Partial<FileInfo> = {}): FileInfo => ({
  path: '/test/photo.jpg',
  name: 'photo',
  extension: 'jpg',
  fullName: 'photo.jpg',
  size: 1024,
  createdAt: new Date('2025-06-15T10:30:00'),
  modifiedAt: new Date('2025-06-20T14:45:00'),
  category: FileCategory.IMAGE,
  metadataSupported: true,
  metadataCapability: MetadataCapability.FULL,
  ...overrides,
});

const createMockImageMetadata = (
  overrides: Partial<ImageMetadata> = {}
): ImageMetadata => ({
  dateTaken: null,
  cameraMake: null,
  cameraModel: null,
  gps: null,
  width: null,
  height: null,
  orientation: null,
  exposureTime: null,
  fNumber: null,
  iso: null,
  ...overrides,
});

const createMockPdfMetadata = (
  overrides: Partial<PDFMetadata> = {}
): PDFMetadata => ({
  title: null,
  author: null,
  subject: null,
  keywords: null,
  creator: null,
  producer: null,
  creationDate: null,
  modificationDate: null,
  pageCount: null,
  ...overrides,
});

const createMockOfficeMetadata = (
  overrides: Partial<OfficeMetadata> = {}
): OfficeMetadata => ({
  title: null,
  subject: null,
  creator: null,
  keywords: null,
  description: null,
  lastModifiedBy: null,
  created: null,
  modified: null,
  revision: null,
  category: null,
  application: null,
  appVersion: null,
  pageCount: null,
  wordCount: null,
  ...overrides,
});

describe('resolveDatePlaceholder', () => {
  describe('date formatting', () => {
    it('formats year as YYYY', () => {
      const context: PlaceholderContext = {
        file: createMockFile(),
        imageMetadata: createMockImageMetadata({
          dateTaken: new Date('2024-12-25T10:30:00'),
        }),
      };

      const result = resolveDatePlaceholder('year', context);

      expect(result.value).toBe('2024');
      expect(result.source).toBe('exif');
    });

    it('formats month as MM (zero-padded)', () => {
      const context: PlaceholderContext = {
        file: createMockFile(),
        imageMetadata: createMockImageMetadata({
          dateTaken: new Date('2024-03-05T10:30:00'),
        }),
      };

      const result = resolveDatePlaceholder('month', context);

      expect(result.value).toBe('03');
    });

    it('formats month without padding when double digit', () => {
      const context: PlaceholderContext = {
        file: createMockFile(),
        imageMetadata: createMockImageMetadata({
          dateTaken: new Date('2024-12-05T10:30:00'),
        }),
      };

      const result = resolveDatePlaceholder('month', context);

      expect(result.value).toBe('12');
    });

    it('formats day as DD (zero-padded)', () => {
      const context: PlaceholderContext = {
        file: createMockFile(),
        imageMetadata: createMockImageMetadata({
          dateTaken: new Date('2024-12-07T10:30:00'),
        }),
      };

      const result = resolveDatePlaceholder('day', context);

      expect(result.value).toBe('07');
    });

    it('formats day without padding when double digit', () => {
      const context: PlaceholderContext = {
        file: createMockFile(),
        imageMetadata: createMockImageMetadata({
          dateTaken: new Date('2024-12-25T10:30:00'),
        }),
      };

      const result = resolveDatePlaceholder('day', context);

      expect(result.value).toBe('25');
    });

    it('formats full date as YYYY-MM-DD', () => {
      const context: PlaceholderContext = {
        file: createMockFile(),
        imageMetadata: createMockImageMetadata({
          dateTaken: new Date('2024-12-25T10:30:00'),
        }),
      };

      const result = resolveDatePlaceholder('date', context);

      expect(result.value).toBe('2024-12-25');
      expect(result.source).toBe('exif');
    });
  });

  describe('date source priority', () => {
    it('uses EXIF date when available (priority 1)', () => {
      const context: PlaceholderContext = {
        file: createMockFile({
          modifiedAt: new Date('2025-06-20T14:45:00'),
        }),
        imageMetadata: createMockImageMetadata({
          dateTaken: new Date('2024-12-25T10:30:00'),
        }),
        pdfMetadata: createMockPdfMetadata({
          creationDate: new Date('2023-01-01T00:00:00'),
        }),
      };

      const result = resolveDatePlaceholder('year', context);

      expect(result.value).toBe('2024');
      expect(result.source).toBe('exif');
    });

    it('falls back to PDF creation date when no EXIF (priority 2)', () => {
      const context: PlaceholderContext = {
        file: createMockFile({
          extension: 'pdf',
          category: FileCategory.PDF,
          modifiedAt: new Date('2025-06-20T14:45:00'),
        }),
        imageMetadata: null,
        pdfMetadata: createMockPdfMetadata({
          creationDate: new Date('2024-08-15T10:00:00'),
        }),
      };

      const result = resolveDatePlaceholder('date', context);

      expect(result.value).toBe('2024-08-15');
      expect(result.source).toBe('document');
    });

    it('falls back to Office created date when no EXIF (priority 2)', () => {
      const context: PlaceholderContext = {
        file: createMockFile({
          extension: 'docx',
          category: FileCategory.DOCUMENT,
          modifiedAt: new Date('2025-06-20T14:45:00'),
        }),
        imageMetadata: null,
        officeMetadata: createMockOfficeMetadata({
          created: new Date('2024-07-10T09:00:00'),
        }),
      };

      const result = resolveDatePlaceholder('date', context);

      expect(result.value).toBe('2024-07-10');
      expect(result.source).toBe('document');
    });

    it('uses Office date when no EXIF and no PDF metadata', () => {
      const context: PlaceholderContext = {
        file: createMockFile({
          extension: 'xlsx',
          category: FileCategory.DOCUMENT,
          modifiedAt: new Date('2025-06-20T14:45:00'),
        }),
        imageMetadata: null,
        pdfMetadata: null,
        officeMetadata: createMockOfficeMetadata({
          created: new Date('2024-05-22T11:00:00'),
        }),
      };

      const result = resolveDatePlaceholder('year', context);

      expect(result.value).toBe('2024');
      expect(result.source).toBe('document');
    });

    it('prefers PDF over Office when both have dates', () => {
      const context: PlaceholderContext = {
        file: createMockFile({
          modifiedAt: new Date('2025-06-20T14:45:00'),
        }),
        imageMetadata: null,
        pdfMetadata: createMockPdfMetadata({
          creationDate: new Date('2024-03-15T10:00:00'),
        }),
        officeMetadata: createMockOfficeMetadata({
          created: new Date('2023-01-01T09:00:00'),
        }),
      };

      const result = resolveDatePlaceholder('date', context);

      expect(result.value).toBe('2024-03-15');
      expect(result.source).toBe('document');
    });

    it('falls back to file system modification date (priority 3)', () => {
      const context: PlaceholderContext = {
        file: createMockFile({
          modifiedAt: new Date('2025-06-20T14:45:00'),
          createdAt: new Date('2025-06-15T10:30:00'),
        }),
        imageMetadata: null,
      };

      const result = resolveDatePlaceholder('year', context);

      expect(result.value).toBe('2025');
      expect(result.source).toBe('filesystem');
    });

    it('uses file system modifiedAt when no metadata dates available', () => {
      const context: PlaceholderContext = {
        file: createMockFile({
          modifiedAt: new Date('2025-06-20T14:45:00'),
          createdAt: new Date('2025-06-15T10:30:00'),
        }),
        imageMetadata: null,
        pdfMetadata: null,
        officeMetadata: null,
      };

      const result = resolveDatePlaceholder('year', context);

      // Should use modifiedAt as the filesystem date source
      expect(result.value).toBe('2025');
      expect(result.source).toBe('filesystem');
    });
  });

  describe('edge cases', () => {
    it('handles midnight correctly', () => {
      const context: PlaceholderContext = {
        file: createMockFile(),
        imageMetadata: createMockImageMetadata({
          dateTaken: new Date('2024-01-01T00:00:00'),
        }),
      };

      const result = resolveDatePlaceholder('date', context);

      expect(result.value).toBe('2024-01-01');
    });

    it('handles end of year correctly', () => {
      const context: PlaceholderContext = {
        file: createMockFile(),
        imageMetadata: createMockImageMetadata({
          dateTaken: new Date('2024-12-31T23:59:59'),
        }),
      };

      const result = resolveDatePlaceholder('date', context);

      expect(result.value).toBe('2024-12-31');
    });

    it('handles leap year date correctly', () => {
      const context: PlaceholderContext = {
        file: createMockFile(),
        imageMetadata: createMockImageMetadata({
          dateTaken: new Date('2024-02-29T12:00:00'),
        }),
      };

      const result = resolveDatePlaceholder('date', context);

      expect(result.value).toBe('2024-02-29');
    });

    it('handles null imageMetadata gracefully', () => {
      const context: PlaceholderContext = {
        file: createMockFile({
          modifiedAt: new Date('2025-03-15T10:00:00'),
        }),
        imageMetadata: null,
      };

      const result = resolveDatePlaceholder('month', context);

      expect(result.value).toBe('03');
      expect(result.source).toBe('filesystem');
    });

    it('handles undefined imageMetadata gracefully', () => {
      const context: PlaceholderContext = {
        file: createMockFile({
          modifiedAt: new Date('2025-03-15T10:00:00'),
        }),
      };

      const result = resolveDatePlaceholder('month', context);

      expect(result.value).toBe('03');
      expect(result.source).toBe('filesystem');
    });

    it('handles null dateTaken in imageMetadata', () => {
      const context: PlaceholderContext = {
        file: createMockFile({
          modifiedAt: new Date('2025-03-15T10:00:00'),
        }),
        imageMetadata: createMockImageMetadata({
          dateTaken: null,
        }),
      };

      const result = resolveDatePlaceholder('month', context);

      expect(result.value).toBe('03');
      expect(result.source).toBe('filesystem');
    });
  });
});

describe('isDatePlaceholder', () => {
  it('returns true for year', () => {
    expect(isDatePlaceholder('year')).toBe(true);
  });

  it('returns true for month', () => {
    expect(isDatePlaceholder('month')).toBe(true);
  });

  it('returns true for day', () => {
    expect(isDatePlaceholder('day')).toBe(true);
  });

  it('returns true for date', () => {
    expect(isDatePlaceholder('date')).toBe(true);
  });

  it('returns false for non-date placeholders', () => {
    expect(isDatePlaceholder('title')).toBe(false);
    expect(isDatePlaceholder('author')).toBe(false);
    expect(isDatePlaceholder('ext')).toBe(false);
    expect(isDatePlaceholder('original')).toBe(false);
    expect(isDatePlaceholder('camera')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isDatePlaceholder('')).toBe(false);
  });

  it('returns false for similar but incorrect names', () => {
    expect(isDatePlaceholder('Year')).toBe(false);
    expect(isDatePlaceholder('YEAR')).toBe(false);
    expect(isDatePlaceholder('years')).toBe(false);
    expect(isDatePlaceholder('datetime')).toBe(false);
  });
});

describe('getDatePlaceholders', () => {
  it('returns all date placeholders', () => {
    const placeholders = getDatePlaceholders();

    expect(placeholders).toContain('year');
    expect(placeholders).toContain('month');
    expect(placeholders).toContain('day');
    expect(placeholders).toContain('date');
  });

  it('returns exactly 4 placeholders', () => {
    const placeholders = getDatePlaceholders();

    expect(placeholders).toHaveLength(4);
  });

  it('returns the same array instance on multiple calls', () => {
    const placeholders1 = getDatePlaceholders();
    const placeholders2 = getDatePlaceholders();

    // Verify it returns the same reference (not a copy)
    expect(placeholders1).toBe(placeholders2);
  });
});
