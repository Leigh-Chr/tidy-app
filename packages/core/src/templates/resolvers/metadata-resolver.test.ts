import { describe, it, expect } from 'vitest';
import {
  resolveMetadataPlaceholder,
  isMetadataPlaceholder,
  getMetadataPlaceholders,
} from './metadata-resolver.js';
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

describe('resolveMetadataPlaceholder', () => {
  describe('title placeholder', () => {
    it('uses PDF title when available (priority 1)', () => {
      const context: PlaceholderContext = {
        file: createMockFile({ name: 'document' }),
        pdfMetadata: createMockPdfMetadata({ title: 'My PDF Document' }),
        officeMetadata: createMockOfficeMetadata({ title: 'Office Title' }),
      };

      const result = resolveMetadataPlaceholder('title', context);

      expect(result.value).toBe('My_PDF_Document');
      expect(result.source).toBe('document');
    });

    it('uses Office title when PDF title not available (priority 2)', () => {
      const context: PlaceholderContext = {
        file: createMockFile({ name: 'spreadsheet' }),
        pdfMetadata: null,
        officeMetadata: createMockOfficeMetadata({ title: 'Budget 2024' }),
      };

      const result = resolveMetadataPlaceholder('title', context);

      expect(result.value).toBe('Budget_2024');
      expect(result.source).toBe('document');
    });

    it('falls back to filename when no document titles (priority 3)', () => {
      const context: PlaceholderContext = {
        file: createMockFile({ name: 'my_report' }),
        pdfMetadata: null,
        officeMetadata: null,
      };

      const result = resolveMetadataPlaceholder('title', context);

      expect(result.value).toBe('my_report');
      expect(result.source).toBe('filesystem');
    });

    it('uses fallback when no title sources available', () => {
      const context: PlaceholderContext = {
        file: createMockFile({ name: '' }),
        pdfMetadata: null,
        officeMetadata: null,
      };

      const result = resolveMetadataPlaceholder('title', context, {
        fallback: 'Untitled',
      });

      expect(result.value).toBe('Untitled');
      expect(result.source).toBe('literal');
    });

    it('trims whitespace from PDF title', () => {
      const context: PlaceholderContext = {
        file: createMockFile(),
        pdfMetadata: createMockPdfMetadata({ title: '  Padded Title  ' }),
      };

      const result = resolveMetadataPlaceholder('title', context);

      expect(result.value).toBe('Padded_Title');
    });

    it('trims whitespace from Office title', () => {
      const context: PlaceholderContext = {
        file: createMockFile(),
        pdfMetadata: null,
        officeMetadata: createMockOfficeMetadata({ title: '  Office Doc  ' }),
      };

      const result = resolveMetadataPlaceholder('title', context);

      expect(result.value).toBe('Office_Doc');
    });
  });

  describe('author placeholder', () => {
    it('uses PDF author when available (priority 1)', () => {
      const context: PlaceholderContext = {
        file: createMockFile(),
        pdfMetadata: createMockPdfMetadata({ author: 'John Doe' }),
        officeMetadata: createMockOfficeMetadata({ creator: 'Jane Smith' }),
      };

      const result = resolveMetadataPlaceholder('author', context);

      expect(result.value).toBe('John_Doe');
      expect(result.source).toBe('document');
    });

    it('uses Office creator when PDF author not available (priority 2)', () => {
      const context: PlaceholderContext = {
        file: createMockFile(),
        pdfMetadata: null,
        officeMetadata: createMockOfficeMetadata({ creator: 'Jane Smith' }),
      };

      const result = resolveMetadataPlaceholder('author', context);

      expect(result.value).toBe('Jane_Smith');
      expect(result.source).toBe('document');
    });

    it('uses fallback when no author available', () => {
      const context: PlaceholderContext = {
        file: createMockFile(),
        pdfMetadata: null,
        officeMetadata: null,
      };

      const result = resolveMetadataPlaceholder('author', context, {
        fallback: 'Unknown',
      });

      expect(result.value).toBe('Unknown');
      expect(result.source).toBe('literal');
    });

    it('returns empty string when no author and no fallback', () => {
      const context: PlaceholderContext = {
        file: createMockFile(),
        pdfMetadata: null,
        officeMetadata: null,
      };

      const result = resolveMetadataPlaceholder('author', context);

      expect(result.value).toBe('');
      expect(result.source).toBe('literal');
    });

    it('trims whitespace from author', () => {
      const context: PlaceholderContext = {
        file: createMockFile(),
        pdfMetadata: createMockPdfMetadata({ author: '  John Doe  ' }),
      };

      const result = resolveMetadataPlaceholder('author', context);

      expect(result.value).toBe('John_Doe');
    });
  });

  describe('camera placeholder', () => {
    it('combines make and model when both available', () => {
      const context: PlaceholderContext = {
        file: createMockFile(),
        imageMetadata: createMockImageMetadata({
          cameraMake: 'Canon',
          cameraModel: 'EOS R5',
        }),
      };

      const result = resolveMetadataPlaceholder('camera', context);

      expect(result.value).toBe('Canon_EOS_R5');
      expect(result.source).toBe('exif');
    });

    it('uses only model when model contains make', () => {
      const context: PlaceholderContext = {
        file: createMockFile(),
        imageMetadata: createMockImageMetadata({
          cameraMake: 'Apple',
          cameraModel: 'Apple iPhone 15 Pro',
        }),
      };

      const result = resolveMetadataPlaceholder('camera', context);

      expect(result.value).toBe('Apple_iPhone_15_Pro');
    });

    it('handles case-insensitive make detection in model', () => {
      const context: PlaceholderContext = {
        file: createMockFile(),
        imageMetadata: createMockImageMetadata({
          cameraMake: 'NIKON',
          cameraModel: 'Nikon D850',
        }),
      };

      const result = resolveMetadataPlaceholder('camera', context);

      expect(result.value).toBe('Nikon_D850');
    });

    it('uses only make when model not available', () => {
      const context: PlaceholderContext = {
        file: createMockFile(),
        imageMetadata: createMockImageMetadata({
          cameraMake: 'Sony',
          cameraModel: null,
        }),
      };

      const result = resolveMetadataPlaceholder('camera', context);

      expect(result.value).toBe('Sony');
      expect(result.source).toBe('exif');
    });

    it('uses only model when make not available', () => {
      const context: PlaceholderContext = {
        file: createMockFile(),
        imageMetadata: createMockImageMetadata({
          cameraMake: null,
          cameraModel: 'DMC-GH5',
        }),
      };

      const result = resolveMetadataPlaceholder('camera', context);

      expect(result.value).toBe('DMC_GH5');
      expect(result.source).toBe('exif');
    });

    it('uses fallback when no camera info available', () => {
      const context: PlaceholderContext = {
        file: createMockFile(),
        imageMetadata: null,
      };

      const result = resolveMetadataPlaceholder('camera', context, {
        fallback: 'Unknown Camera',
      });

      expect(result.value).toBe('Unknown_Camera');
      expect(result.source).toBe('literal');
    });

    it('removes corporate suffixes from camera name', () => {
      const context: PlaceholderContext = {
        file: createMockFile(),
        imageMetadata: createMockImageMetadata({
          cameraMake: 'EASTMAN KODAK CORPORATION',
          cameraModel: 'DC4800',
        }),
      };

      const result = resolveMetadataPlaceholder('camera', context);

      expect(result.value).toBe('EASTMAN_KODAK_DC4800');
      expect(result.value).not.toContain('CORPORATION');
    });

    it('removes Corp. suffix', () => {
      const context: PlaceholderContext = {
        file: createMockFile(),
        imageMetadata: createMockImageMetadata({
          cameraMake: 'Some Corp.',
          cameraModel: 'Model X',
        }),
      };

      const result = resolveMetadataPlaceholder('camera', context);

      expect(result.value).toBe('Some_Model_X');
      expect(result.value).not.toContain('Corp');
    });

    it('handles extra whitespace in camera make/model', () => {
      const context: PlaceholderContext = {
        file: createMockFile(),
        imageMetadata: createMockImageMetadata({
          cameraMake: '  Canon  ',
          cameraModel: '  EOS   5D   ',
        }),
      };

      const result = resolveMetadataPlaceholder('camera', context);

      expect(result.value).toBe('Canon_EOS_5D');
    });
  });

  describe('location placeholder', () => {
    it('formats GPS coordinates correctly', () => {
      const context: PlaceholderContext = {
        file: createMockFile(),
        imageMetadata: createMockImageMetadata({
          gps: {
            latitude: 48.8566,
            longitude: 2.3522,
          },
        }),
      };

      const result = resolveMetadataPlaceholder('location', context);

      expect(result.value).toBe('48.8566N_2.3522E');
      expect(result.source).toBe('exif');
    });

    it('formats southern latitude with S direction', () => {
      const context: PlaceholderContext = {
        file: createMockFile(),
        imageMetadata: createMockImageMetadata({
          gps: {
            latitude: -33.8688,
            longitude: 151.2093,
          },
        }),
      };

      const result = resolveMetadataPlaceholder('location', context);

      expect(result.value).toBe('33.8688S_151.2093E');
    });

    it('formats western longitude with W direction', () => {
      const context: PlaceholderContext = {
        file: createMockFile(),
        imageMetadata: createMockImageMetadata({
          gps: {
            latitude: 40.7128,
            longitude: -74.006,
          },
        }),
      };

      const result = resolveMetadataPlaceholder('location', context);

      expect(result.value).toBe('40.7128N_74.0060W');
    });

    it('handles both negative coordinates (southwest)', () => {
      const context: PlaceholderContext = {
        file: createMockFile(),
        imageMetadata: createMockImageMetadata({
          gps: {
            latitude: -22.9068,
            longitude: -43.1729,
          },
        }),
      };

      const result = resolveMetadataPlaceholder('location', context);

      expect(result.value).toBe('22.9068S_43.1729W');
    });

    it('handles zero latitude (equator)', () => {
      const context: PlaceholderContext = {
        file: createMockFile(),
        imageMetadata: createMockImageMetadata({
          gps: {
            latitude: 0,
            longitude: 10.5,
          },
        }),
      };

      const result = resolveMetadataPlaceholder('location', context);

      expect(result.value).toBe('0.0000N_10.5000E');
    });

    it('handles zero longitude (prime meridian)', () => {
      const context: PlaceholderContext = {
        file: createMockFile(),
        imageMetadata: createMockImageMetadata({
          gps: {
            latitude: 51.5074,
            longitude: 0,
          },
        }),
      };

      const result = resolveMetadataPlaceholder('location', context);

      expect(result.value).toBe('51.5074N_0.0000E');
    });

    it('uses fallback when no GPS data', () => {
      const context: PlaceholderContext = {
        file: createMockFile(),
        imageMetadata: null,
      };

      const result = resolveMetadataPlaceholder('location', context, {
        fallback: 'NoLocation',
      });

      expect(result.value).toBe('NoLocation');
      expect(result.source).toBe('literal');
    });

    it('uses fallback when GPS is null', () => {
      const context: PlaceholderContext = {
        file: createMockFile(),
        imageMetadata: createMockImageMetadata({
          gps: null,
        }),
      };

      const result = resolveMetadataPlaceholder('location', context, {
        fallback: 'Unknown',
      });

      expect(result.value).toBe('Unknown');
      expect(result.source).toBe('literal');
    });

    it('handles edge case with NaN coordinates gracefully', () => {
      const context: PlaceholderContext = {
        file: createMockFile(),
        imageMetadata: createMockImageMetadata({
          gps: {
            latitude: NaN,
            longitude: 2.3522,
          },
        }),
      };

      const result = resolveMetadataPlaceholder('location', context);

      // NaN is a valid number type, so it will be formatted
      // NaN >= 0 is false, so direction is S; Math.abs(NaN) is NaN
      expect(result.value).toBe('NaNS_2.3522E');
      expect(result.source).toBe('exif');
    });
  });

  describe('sanitization', () => {
    it('sanitizes title with special characters', () => {
      const context: PlaceholderContext = {
        file: createMockFile(),
        pdfMetadata: createMockPdfMetadata({ title: 'Report: Q4/2024 <draft>' }),
      };

      const result = resolveMetadataPlaceholder('title', context);

      expect(result.value).toBe('Report_Q4_2024_draft');
      expect(result.value).not.toMatch(/[<>:"/\\|?*]/);
    });

    it('can disable sanitization', () => {
      const context: PlaceholderContext = {
        file: createMockFile(),
        pdfMetadata: createMockPdfMetadata({ title: 'Report: Q4' }),
      };

      const result = resolveMetadataPlaceholder('title', context, {
        sanitizeForFilename: false,
      });

      expect(result.value).toBe('Report: Q4');
    });

    it('sanitizes author with special characters', () => {
      const context: PlaceholderContext = {
        file: createMockFile(),
        pdfMetadata: createMockPdfMetadata({ author: 'John "Jack" O\'Brien' }),
      };

      const result = resolveMetadataPlaceholder('author', context);

      expect(result.value).not.toContain('"');
    });

    it('does not sanitize empty strings', () => {
      const context: PlaceholderContext = {
        file: createMockFile(),
        pdfMetadata: null,
        officeMetadata: null,
      };

      const result = resolveMetadataPlaceholder('author', context);

      expect(result.value).toBe('');
    });
  });

  describe('custom fallbacks', () => {
    it('uses placeholder-specific fallback from options', () => {
      const context: PlaceholderContext = {
        file: createMockFile({ name: '' }),
        pdfMetadata: null,
        officeMetadata: null,
      };

      const result = resolveMetadataPlaceholder('title', context, {
        fallback: 'Default',
        fallbacks: { title: 'No Title' },
      });

      expect(result.value).toBe('No_Title');
    });

    it('falls back to default fallback when specific not provided', () => {
      const context: PlaceholderContext = {
        file: createMockFile(),
        pdfMetadata: null,
        officeMetadata: null,
      };

      const result = resolveMetadataPlaceholder('author', context, {
        fallback: 'Unknown',
        fallbacks: { title: 'No Title' },
      });

      expect(result.value).toBe('Unknown');
    });
  });

  describe('resolved placeholder structure', () => {
    it('returns correct structure for title', () => {
      const context: PlaceholderContext = {
        file: createMockFile(),
        pdfMetadata: createMockPdfMetadata({ title: 'Test' }),
      };

      const result = resolveMetadataPlaceholder('title', context);

      expect(result).toEqual({
        name: 'title',
        value: 'Test',
        source: 'document',
      });
    });

    it('returns correct structure for camera', () => {
      const context: PlaceholderContext = {
        file: createMockFile(),
        imageMetadata: createMockImageMetadata({
          cameraMake: 'Canon',
          cameraModel: 'EOS R5',
        }),
      };

      const result = resolveMetadataPlaceholder('camera', context);

      expect(result).toEqual({
        name: 'camera',
        value: 'Canon_EOS_R5',
        source: 'exif',
      });
    });

    it('returns correct structure for location', () => {
      const context: PlaceholderContext = {
        file: createMockFile(),
        imageMetadata: createMockImageMetadata({
          gps: { latitude: 0, longitude: 0 },
        }),
      };

      const result = resolveMetadataPlaceholder('location', context);

      expect(result).toEqual({
        name: 'location',
        value: '0.0000N_0.0000E',
        source: 'exif',
      });
    });
  });
});

describe('isMetadataPlaceholder', () => {
  it('returns true for title', () => {
    expect(isMetadataPlaceholder('title')).toBe(true);
  });

  it('returns true for author', () => {
    expect(isMetadataPlaceholder('author')).toBe(true);
  });

  it('returns true for camera', () => {
    expect(isMetadataPlaceholder('camera')).toBe(true);
  });

  it('returns true for location', () => {
    expect(isMetadataPlaceholder('location')).toBe(true);
  });

  it('returns false for date placeholders', () => {
    expect(isMetadataPlaceholder('year')).toBe(false);
    expect(isMetadataPlaceholder('month')).toBe(false);
    expect(isMetadataPlaceholder('day')).toBe(false);
    expect(isMetadataPlaceholder('date')).toBe(false);
  });

  it('returns false for file placeholders', () => {
    expect(isMetadataPlaceholder('ext')).toBe(false);
    expect(isMetadataPlaceholder('original')).toBe(false);
    expect(isMetadataPlaceholder('size')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isMetadataPlaceholder('')).toBe(false);
  });

  it('returns false for similar but incorrect names', () => {
    expect(isMetadataPlaceholder('Title')).toBe(false);
    expect(isMetadataPlaceholder('TITLE')).toBe(false);
    expect(isMetadataPlaceholder('authors')).toBe(false);
    expect(isMetadataPlaceholder('cameras')).toBe(false);
  });
});

describe('getMetadataPlaceholders', () => {
  it('returns all metadata placeholders', () => {
    const placeholders = getMetadataPlaceholders();

    expect(placeholders).toContain('title');
    expect(placeholders).toContain('author');
    expect(placeholders).toContain('camera');
    expect(placeholders).toContain('location');
  });

  it('returns exactly 4 placeholders', () => {
    const placeholders = getMetadataPlaceholders();

    expect(placeholders).toHaveLength(4);
  });

  it('returns the same array instance on multiple calls', () => {
    const placeholders1 = getMetadataPlaceholders();
    const placeholders2 = getMetadataPlaceholders();

    expect(placeholders1).toBe(placeholders2);
  });
});
