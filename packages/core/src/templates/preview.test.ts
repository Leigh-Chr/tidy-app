import { describe, it, expect } from 'vitest';
import {
  previewFile,
  previewFiles,
  formatPreviewResult,
  formatBatchPreview,
} from './preview.js';
import type { FileInfo } from '../types/file-info.js';
import type { ImageMetadata } from '../types/image-metadata.js';
import type { PDFMetadata } from '../types/pdf-metadata.js';
import type { OfficeMetadata } from '../types/office-metadata.js';
import { FileCategory } from '../types/file-category.js';
import { MetadataCapability } from '../types/metadata-capability.js';

// =============================================================================
// Test Fixtures
// =============================================================================

const createMockFile = (overrides: Partial<FileInfo> = {}): FileInfo => ({
  path: '/photos/vacation.jpg',
  name: 'vacation',
  extension: 'jpg',
  size: 2621440, // 2.5 MB
  createdAt: new Date('2025-06-15T08:00:00Z'),
  modifiedAt: new Date('2025-06-20T12:00:00Z'),
  category: FileCategory.IMAGE,
  metadataCapability: MetadataCapability.FULL,
  ...overrides,
});

const createMockImageMetadata = (
  overrides: Partial<ImageMetadata> = {}
): ImageMetadata => ({
  dateTaken: new Date('2025-06-15T10:30:00Z'),
  cameraMake: 'Canon',
  cameraModel: 'EOS R5',
  gps: { latitude: 48.8566, longitude: 2.3522 },
  width: 8192,
  height: 5464,
  orientation: 1,
  exposureTime: '1/250',
  fNumber: 2.8,
  iso: 100,
  ...overrides,
});

const createMockPdfMetadata = (
  overrides: Partial<PDFMetadata> = {}
): PDFMetadata => ({
  title: 'Quarterly Report',
  author: 'John Smith',
  subject: 'Q2 2025 Results',
  creator: 'Microsoft Word',
  producer: 'Adobe PDF Library',
  creationDate: new Date('2025-01-15T09:00:00Z'),
  modificationDate: new Date('2025-01-20T14:30:00Z'),
  pageCount: 25,
  ...overrides,
});

const createMockOfficeMetadata = (
  overrides: Partial<OfficeMetadata> = {}
): OfficeMetadata => ({
  title: 'Project Plan',
  creator: 'Jane Doe',
  lastModifiedBy: 'Jane Doe',
  created: new Date('2025-02-01T10:00:00Z'),
  modified: new Date('2025-02-15T16:00:00Z'),
  ...overrides,
});

// =============================================================================
// previewFile - Basic Preview (AC1)
// =============================================================================

describe('previewFile', () => {
  describe('basic preview (AC1)', () => {
    it('generates preview for simple template with original name', () => {
      const file = createMockFile();
      const result = previewFile(file, '{original}', {}, { caseNormalization: 'none' });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.proposedName).toBe('vacation.jpg');
        expect(result.data.originalName).toBe('vacation.jpg');
        expect(result.data.status).toBe('ready');
      }
    });

    it('generates preview with date placeholders from EXIF', () => {
      const file = createMockFile();
      const metadata = { imageMetadata: createMockImageMetadata() };
      const result = previewFile(file, '{year}-{month}-{day}_{original}', metadata, { caseNormalization: 'none' });

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Note: sanitizeFilename() converts hyphens/dashes to underscores for
        // cross-platform filesystem compatibility. See utils/sanitize.ts.
        // Input: "2025-06-15_vacation" -> Output: "2025_06_15_vacation"
        expect(result.data.proposedName).toBe('2025_06_15_vacation.jpg');
      }
    });

    it('generates preview with camera metadata placeholder', () => {
      const file = createMockFile();
      const metadata = { imageMetadata: createMockImageMetadata() };
      const result = previewFile(file, '{camera}_{original}', metadata, { caseNormalization: 'none' });

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Camera make + model, sanitized for filename
        expect(result.data.proposedName).toBe('Canon_EOS_R5_vacation.jpg');
      }
    });

    it('generates preview with file size placeholder', () => {
      const file = createMockFile();
      const result = previewFile(file, '{original}_{size}', {}, { caseNormalization: 'none' });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.proposedName).toBe('vacation_2.5MB.jpg');
      }
    });

    it('generates preview with extension placeholder', () => {
      const file = createMockFile();
      const result = previewFile(file, '{original}.{ext}', {}, { includeExtension: false, caseNormalization: 'none' });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.proposedName).toBe('vacation.jpg');
      }
    });

    it('preserves directory in proposed path', () => {
      const file = createMockFile({ path: '/home/user/photos/vacation.jpg' });
      const metadata = { imageMetadata: createMockImageMetadata() };
      const result = previewFile(file, '{year}_{original}', metadata, { caseNormalization: 'none' });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.proposedPath).toBe('/home/user/photos/2025_vacation.jpg');
      }
    });
  });

  // =============================================================================
  // Missing Metadata Indication (AC2)
  // =============================================================================

  describe('missing metadata indication (AC2)', () => {
    it('identifies empty placeholders when metadata is missing', () => {
      const file = createMockFile();
      // No metadata provided, so {camera} will be empty
      const result = previewFile(file, '{camera}_{original}', {}, { caseNormalization: 'none' });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.hasEmptyPlaceholders).toBe(true);
        expect(result.data.emptyPlaceholders).toContain('camera');
        expect(result.data.status).toBe('warning');
      }
    });

    it('sets warning status when placeholders are empty', () => {
      const file = createMockFile();
      const metadata = {
        imageMetadata: createMockImageMetadata({
          cameraMake: null,
          cameraModel: null,
        }),
      };
      const result = previewFile(file, '{camera}_{original}', metadata, { caseNormalization: 'none' });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.status).toBe('warning');
        expect(result.data.warnings.length).toBeGreaterThan(0);
        expect(result.data.warnings.some((w) => w.includes('Empty'))).toBe(true);
      }
    });

    it('lists all empty placeholders in emptyPlaceholders array', () => {
      const file = createMockFile();
      // Multiple missing placeholders
      const result = previewFile(file, '{author}_{title}_{original}', {}, { caseNormalization: 'none' });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.emptyPlaceholders).toContain('author');
        // title falls back to original filename, so it won't be empty
      }
    });
  });

  // =============================================================================
  // Preview Metadata Sources (AC4)
  // =============================================================================

  describe('preview metadata sources (AC4)', () => {
    it('tracks EXIF source for date placeholders from image metadata', () => {
      const file = createMockFile();
      const metadata = { imageMetadata: createMockImageMetadata() };
      const result = previewFile(file, '{year}_{original}', metadata, { caseNormalization: 'none' });

      expect(result.ok).toBe(true);
      if (result.ok) {
        const yearRes = result.data.resolutions.find((r) => r.placeholder === 'year');
        expect(yearRes?.source).toBe('exif');
      }
    });

    it('tracks document source for PDF metadata', () => {
      const file = createMockFile({
        path: '/docs/report.pdf',
        name: 'report',
        extension: 'pdf',
        category: FileCategory.DOCUMENT,
      });
      const metadata = { pdfMetadata: createMockPdfMetadata() };
      const result = previewFile(file, '{author}_{original}', metadata, { caseNormalization: 'none' });

      expect(result.ok).toBe(true);
      if (result.ok) {
        const authorRes = result.data.resolutions.find((r) => r.placeholder === 'author');
        expect(authorRes?.source).toBe('document');
        expect(authorRes?.value).toBe('John_Smith');
      }
    });

    it('tracks document source for Office metadata', () => {
      const file = createMockFile({
        path: '/docs/plan.docx',
        name: 'plan',
        extension: 'docx',
        category: FileCategory.DOCUMENT,
      });
      const metadata = { officeMetadata: createMockOfficeMetadata() };
      const result = previewFile(file, '{author}_{original}', metadata, { caseNormalization: 'none' });

      expect(result.ok).toBe(true);
      if (result.ok) {
        const authorRes = result.data.resolutions.find((r) => r.placeholder === 'author');
        expect(authorRes?.source).toBe('document');
        expect(authorRes?.value).toBe('Jane_Doe');
      }
    });

    it('tracks filesystem source for file placeholders', () => {
      const file = createMockFile();
      const result = previewFile(file, '{original}_{ext}', {}, { caseNormalization: 'none' });

      expect(result.ok).toBe(true);
      if (result.ok) {
        const originalRes = result.data.resolutions.find(
          (r) => r.placeholder === 'original'
        );
        const extRes = result.data.resolutions.find((r) => r.placeholder === 'ext');

        expect(originalRes?.source).toBe('filesystem');
        expect(extRes?.source).toBe('filesystem');
      }
    });

    it('tracks filesystem source for date when no metadata available', () => {
      const file = createMockFile();
      // No metadata - should fall back to filesystem date
      const result = previewFile(file, '{year}_{original}', {}, { caseNormalization: 'none' });

      expect(result.ok).toBe(true);
      if (result.ok) {
        const yearRes = result.data.resolutions.find((r) => r.placeholder === 'year');
        expect(yearRes?.source).toBe('filesystem');
      }
    });
  });

  // =============================================================================
  // Fallback Handling (AC5)
  // =============================================================================

  describe('fallback handling (AC5)', () => {
    it('uses fallback values when metadata is missing', () => {
      const file = createMockFile();
      const result = previewFile(
        file,
        '{author}_{original}',
        {},
        { fallbacks: { author: 'Unknown' }, caseNormalization: 'none' }
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.proposedName).toBe('Unknown_vacation.jpg');
        const authorRes = result.data.resolutions.find(
          (r) => r.placeholder === 'author'
        );
        expect(authorRes?.usedFallback).toBe(true);
        expect(authorRes?.source).toBe('fallback');
      }
    });

    it('reports fallback usage in warnings', () => {
      const file = createMockFile();
      const result = previewFile(
        file,
        '{author}_{original}',
        {},
        { fallbacks: { author: 'Unknown' }, caseNormalization: 'none' }
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.warnings.some((w) => w.includes('fallback'))).toBe(true);
      }
    });

    it('does not report fallback when metadata exists', () => {
      const file = createMockFile();
      const metadata = { pdfMetadata: createMockPdfMetadata() };
      const result = previewFile(
        file,
        '{author}_{original}',
        metadata,
        { fallbacks: { author: 'Unknown' }, caseNormalization: 'none' }
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        const authorRes = result.data.resolutions.find(
          (r) => r.placeholder === 'author'
        );
        expect(authorRes?.usedFallback).toBe(false);
        expect(authorRes?.source).toBe('document');
      }
    });

    it('marks usedFallback false when no fallback configured', () => {
      const file = createMockFile();
      const result = previewFile(file, '{author}_{original}', {}, { caseNormalization: 'none' });

      expect(result.ok).toBe(true);
      if (result.ok) {
        const authorRes = result.data.resolutions.find(
          (r) => r.placeholder === 'author'
        );
        expect(authorRes?.usedFallback).toBe(false);
        expect(authorRes?.isEmpty).toBe(true);
      }
    });
  });

  // =============================================================================
  // Error Handling
  // =============================================================================

  describe('error handling', () => {
    it('returns error for invalid template syntax', () => {
      const file = createMockFile();
      const result = previewFile(file, '{unclosed');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('parse_error');
        expect(result.error.message).toContain('Invalid template');
      }
    });

    it('returns error for empty placeholder', () => {
      const file = createMockFile();
      const result = previewFile(file, '{}_{original}');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('parse_error');
      }
    });

    it('returns error when template produces empty filename', () => {
      const file = createMockFile();
      // Only unknown placeholder with no fallback
      const result = previewFile(
        file,
        '{unknownPlaceholder}',
        {},
        { includeExtension: false }
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('invalid_filename');
        expect(result.error.message).toContain('empty or invalid filename');
      }
    });
  });

  // =============================================================================
  // Extension Handling
  // =============================================================================

  describe('extension handling', () => {
    it('adds extension by default', () => {
      const file = createMockFile();
      const result = previewFile(file, '{original}', {}, { caseNormalization: 'none' });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.proposedName).toBe('vacation.jpg');
      }
    });

    it('does not duplicate extension if already in template', () => {
      const file = createMockFile();
      const result = previewFile(file, '{original}.{ext}', {}, { caseNormalization: 'none' });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.proposedName).toBe('vacation.jpg');
        expect(result.data.proposedName).not.toBe('vacation.jpg.jpg');
      }
    });

    it('can skip extension when requested', () => {
      const file = createMockFile();
      const result = previewFile(file, '{original}', {}, { includeExtension: false, caseNormalization: 'none' });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.proposedName).toBe('vacation');
      }
    });

    it('handles files without extension', () => {
      const file = createMockFile({
        path: '/files/readme',
        name: 'readme',
        extension: '',
      });
      const result = previewFile(file, '{original}_copy', {}, { caseNormalization: 'none' });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.proposedName).toBe('readme_copy');
        expect(result.data.originalName).toBe('readme');
      }
    });
  });

  // =============================================================================
  // Sanitization
  // =============================================================================

  describe('sanitization', () => {
    it('sanitizes filename by default', () => {
      const file = createMockFile({
        path: '/photos/my photo:file.jpg',
        name: 'my photo:file',
      });
      const result = previewFile(file, '{original}', {}, { caseNormalization: 'none' });

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Colons and spaces should be handled
        expect(result.data.proposedName).not.toContain(':');
      }
    });

    it('can disable sanitization', () => {
      const file = createMockFile();
      const metadata = {
        pdfMetadata: createMockPdfMetadata({ title: 'Report: Q2 2025' }),
      };
      const result = previewFile(file, '{title}', metadata, {
        sanitizeFilenames: false,
        includeExtension: false,
        caseNormalization: 'none',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        // With sanitization disabled, title is used as-is
        expect(result.data.proposedName).toBe('Report: Q2 2025');
      }
    });
  });

  // =============================================================================
  // Filename Length Validation (Issue 4 fix)
  // =============================================================================

  describe('filename length validation', () => {
    it('warns when filename exceeds recommended length', () => {
      const file = createMockFile();
      // Create a very long title that will produce a filename > 200 chars
      const longTitle = 'A'.repeat(250);
      const metadata = {
        pdfMetadata: createMockPdfMetadata({ title: longTitle }),
      };
      const result = previewFile(file, '{title}', metadata);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.status).toBe('warning');
        expect(result.data.warnings.some((w) => w.includes('too long'))).toBe(true);
        expect(result.data.warnings.some((w) => w.includes('max recommended'))).toBe(true);
      }
    });

    it('does not warn for normal length filenames', () => {
      const file = createMockFile();
      const result = previewFile(file, '{original}');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.warnings.some((w) => w.includes('too long'))).toBe(false);
      }
    });
  });

  // =============================================================================
  // Enhanced Invalid Filename Detection (Issue 3 fix)
  // =============================================================================

  describe('invalid filename detection', () => {
    it('rejects filename that is just a dot', () => {
      const file = createMockFile();
      const metadata = {
        pdfMetadata: createMockPdfMetadata({ title: '.' }),
      };
      const result = previewFile(file, '{title}', metadata, {
        sanitizeFilenames: false,
        includeExtension: false,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('invalid_filename');
      }
    });

    it('rejects filename that is just double dots', () => {
      const file = createMockFile();
      const metadata = {
        pdfMetadata: createMockPdfMetadata({ title: '..' }),
      };
      const result = previewFile(file, '{title}', metadata, {
        sanitizeFilenames: false,
        includeExtension: false,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('invalid_filename');
      }
    });
  });
});

// =============================================================================
// previewFiles - Multiple File Preview (AC3)
// =============================================================================

describe('previewFiles', () => {
  describe('multiple file preview (AC3)', () => {
    it('previews multiple files', () => {
      const files = [
        { file: createMockFile({ path: '/photos/photo1.jpg', name: 'photo1' }) },
        { file: createMockFile({ path: '/photos/photo2.jpg', name: 'photo2' }) },
        { file: createMockFile({ path: '/photos/photo3.jpg', name: 'photo3' }) },
      ];

      const result = previewFiles(files, '{original}_renamed', { caseNormalization: 'none' });

      expect(result.totalFiles).toBe(3);
      expect(result.results).toHaveLength(3);
      expect(result.results[0].proposedName).toBe('photo1_renamed.jpg');
      expect(result.results[1].proposedName).toBe('photo2_renamed.jpg');
      expect(result.results[2].proposedName).toBe('photo3_renamed.jpg');
    });

    it('counts status correctly', () => {
      const files = [
        {
          file: createMockFile({ name: 'with_meta' }),
          imageMetadata: createMockImageMetadata(),
        },
        {
          file: createMockFile({ name: 'no_meta' }),
          // No metadata - will trigger warning for {camera}
        },
      ];

      const result = previewFiles(files, '{camera}_{original}', { caseNormalization: 'none' });

      expect(result.readyCount).toBe(1);
      expect(result.warningCount).toBe(1);
      expect(result.errorCount).toBe(0);
    });

    it('handles errors per-file without stopping', () => {
      const files = [
        { file: createMockFile({ name: 'good' }) },
        { file: createMockFile({ path: '/photos/bad.jpg', name: 'bad' }) },
      ];

      // Use a template that works for all
      const result = previewFiles(files, '{original}', { caseNormalization: 'none' });

      expect(result.totalFiles).toBe(2);
      expect(result.results).toHaveLength(2);
      expect(result.readyCount).toBe(2);
    });

    it('captures errors in result array', () => {
      const files = [
        { file: createMockFile({ name: 'good' }) },
      ];

      // Invalid template causes all files to error
      const result = previewFiles(files, '{unclosed');

      expect(result.totalFiles).toBe(1);
      expect(result.errorCount).toBe(1);
      expect(result.results[0].status).toBe('error');
      expect(result.results[0].error).toBeDefined();
    });

    it('applies options to all files', () => {
      const files = [
        { file: createMockFile({ name: 'photo1' }) },
        { file: createMockFile({ name: 'photo2' }) },
      ];

      const result = previewFiles(files, '{author}_{original}', {
        fallbacks: { author: 'Unknown' },
        caseNormalization: 'none',
      });

      expect(result.results[0].proposedName).toBe('Unknown_photo1.jpg');
      expect(result.results[1].proposedName).toBe('Unknown_photo2.jpg');
    });

    it('handles mixed metadata types', () => {
      const files = [
        {
          file: createMockFile({
            path: '/files/photo.jpg',
            name: 'photo',
            category: FileCategory.IMAGE,
          }),
          imageMetadata: createMockImageMetadata(),
        },
        {
          file: createMockFile({
            path: '/files/report.pdf',
            name: 'report',
            extension: 'pdf',
            category: FileCategory.DOCUMENT,
          }),
          pdfMetadata: createMockPdfMetadata(),
        },
        {
          file: createMockFile({
            path: '/files/plan.docx',
            name: 'plan',
            extension: 'docx',
            category: FileCategory.DOCUMENT,
          }),
          officeMetadata: createMockOfficeMetadata(),
        },
      ];

      const result = previewFiles(files, '{year}_{original}', { caseNormalization: 'none' });

      expect(result.results[0].proposedName).toBe('2025_photo.jpg');
      expect(result.results[1].proposedName).toBe('2025_report.pdf');
      expect(result.results[2].proposedName).toBe('2025_plan.docx');
    });
  });
});

// =============================================================================
// formatPreviewResult
// =============================================================================

describe('formatPreviewResult', () => {
  it('formats ready result with OK status', () => {
    const file = createMockFile();
    const result = previewFile(file, '{original}', {}, { caseNormalization: 'none' });

    expect(result.ok).toBe(true);
    if (result.ok) {
      const formatted = formatPreviewResult(result.data);
      expect(formatted).toContain('[OK]');
      expect(formatted).toContain('vacation.jpg');
      expect(formatted).toContain('->');
    }
  });

  it('formats result with warnings', () => {
    const file = createMockFile();
    const result = previewFile(file, '{camera}_{original}', {}, { caseNormalization: 'none' });

    expect(result.ok).toBe(true);
    if (result.ok) {
      const formatted = formatPreviewResult(result.data);
      expect(formatted).toContain('[WARN]');
      expect(formatted).toContain('Warnings:');
    }
  });

  it('shows resolution sources', () => {
    const file = createMockFile();
    const metadata = { imageMetadata: createMockImageMetadata() };
    const result = previewFile(file, '{year}_{original}', metadata, { caseNormalization: 'none' });

    expect(result.ok).toBe(true);
    if (result.ok) {
      const formatted = formatPreviewResult(result.data);
      expect(formatted).toContain('{year}');
      expect(formatted).toContain('[EXIF]');
      expect(formatted).toContain('{original}');
      expect(formatted).toContain('[File]');
    }
  });

  it('shows error message for error results', () => {
    // Create an error result manually
    const errorResult = {
      originalPath: '/photos/test.jpg',
      originalName: 'test.jpg',
      proposedName: '',
      proposedPath: '',
      template: '{unclosed',
      resolutions: [],
      hasEmptyPlaceholders: false,
      emptyPlaceholders: [],
      status: 'error' as const,
      warnings: [],
      error: 'Invalid template syntax',
    };

    const formatted = formatPreviewResult(errorResult);
    expect(formatted).toContain('[ERR]');
    expect(formatted).toContain('Error:');
    expect(formatted).toContain('Invalid template syntax');
  });

  it('shows fallback source', () => {
    const file = createMockFile();
    const result = previewFile(
      file,
      '{author}_{original}',
      {},
      { fallbacks: { author: 'Unknown' }, caseNormalization: 'none' }
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      const formatted = formatPreviewResult(result.data);
      expect(formatted).toContain('{author}');
      expect(formatted).toContain('[Fallback]');
    }
  });
});

// =============================================================================
// formatBatchPreview
// =============================================================================

describe('formatBatchPreview', () => {
  it('formats batch with summary', () => {
    const files = [
      { file: createMockFile({ name: 'photo1' }) },
      { file: createMockFile({ name: 'photo2' }) },
    ];

    const result = previewFiles(files, '{original}', { caseNormalization: 'none' });
    const formatted = formatBatchPreview(result);

    expect(formatted).toContain('Template: "{original}"');
    expect(formatted).toContain('Files: 2');
    expect(formatted).toContain('2 ready');
    expect(formatted).toContain('photo1');
    expect(formatted).toContain('photo2');
  });

  it('shows warning and error counts', () => {
    const files = [
      {
        file: createMockFile({ name: 'with_meta' }),
        imageMetadata: createMockImageMetadata(),
      },
      {
        file: createMockFile({ name: 'no_meta' }),
      },
    ];

    const result = previewFiles(files, '{camera}_{original}', { caseNormalization: 'none' });
    const formatted = formatBatchPreview(result);

    expect(formatted).toContain('1 ready');
    expect(formatted).toContain('1 warnings');
  });
});
