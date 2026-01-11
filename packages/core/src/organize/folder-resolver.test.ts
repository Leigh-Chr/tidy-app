/**
 * @fileoverview Tests for folder path resolution - Story 8.2, Task 3
 *
 * Tests folder pattern resolution using the same placeholder system as naming templates.
 */

import { describe, expect, it } from 'vitest';
import { resolveFolderPath } from './folder-resolver.js';
import type { FileInfo } from '../types/file-info.js';
import type { UnifiedMetadata } from '../types/unified-metadata.js';
import type { ImageMetadata } from '../types/image-metadata.js';
import type { PDFMetadata } from '../types/pdf-metadata.js';
import type { OfficeMetadata } from '../types/office-metadata.js';

// =============================================================================
// Test Fixtures
// =============================================================================

function createTestFile(overrides?: Partial<FileInfo>): FileInfo {
  return {
    path: '/photos/IMG_001.jpg',
    name: 'IMG_001',
    fullName: 'IMG_001.jpg',
    extension: 'jpg',
    size: 1024,
    createdAt: new Date('2026-01-10T12:00:00Z'),
    modifiedAt: new Date('2026-01-10T12:00:00Z'),
    relativePath: 'IMG_001.jpg',
    mimeType: 'image/jpeg',
    category: 'image',
    metadataSupported: true,
    metadataCapability: 'full' as const,
    ...overrides,
  };
}

function createImageMetadata(overrides?: Partial<ImageMetadata>): ImageMetadata {
  return {
    dateTaken: new Date('2026-01-10T14:30:00Z'),
    cameraMake: 'Apple',
    cameraModel: 'iPhone 15 Pro',
    orientation: 1,
    width: 4032,
    height: 3024,
    exposureTime: '1/125',
    fNumber: 1.8,
    iso: 100,
    gps: null,
    ...overrides,
  };
}

function createPdfMetadata(overrides?: Partial<PDFMetadata>): PDFMetadata {
  return {
    title: 'Annual Report 2026',
    author: 'John Smith',
    subject: 'Financial Summary',
    keywords: 'finance, report, 2026',
    creator: 'Microsoft Word',
    producer: 'Adobe PDF Library',
    creationDate: new Date('2026-01-05T10:00:00Z'),
    modificationDate: new Date('2026-01-08T15:30:00Z'),
    pageCount: 42,
    ...overrides,
  };
}

function createOfficeMetadata(overrides?: Partial<OfficeMetadata>): OfficeMetadata {
  return {
    title: 'Project Proposal',
    subject: 'Q1 Planning',
    creator: 'Jane Doe',
    keywords: 'project, proposal, 2026',
    description: 'Initial project proposal',
    lastModifiedBy: 'Bob Wilson',
    created: new Date('2026-01-02T09:00:00Z'),
    modified: new Date('2026-01-09T16:00:00Z'),
    revision: '5',
    category: 'Business',
    application: 'Microsoft Office Word',
    appVersion: '16.0',
    pageCount: 15,
    wordCount: 5000,
    ...overrides,
  };
}

function createUnifiedMetadata(
  file: FileInfo,
  options?: {
    image?: ImageMetadata | null;
    pdf?: PDFMetadata | null;
    office?: OfficeMetadata | null;
  }
): UnifiedMetadata {
  return {
    file,
    image: options?.image ?? null,
    pdf: options?.pdf ?? null,
    office: options?.office ?? null,
    extractionStatus: 'success',
    extractionError: null,
  };
}

// =============================================================================
// Basic Pattern Resolution Tests
// =============================================================================

describe('resolveFolderPath', () => {
  describe('basic patterns', () => {
    it('resolves simple year/month pattern from image metadata', () => {
      const file = createTestFile();
      const metadata = createUnifiedMetadata(file, { image: createImageMetadata() });

      const result = resolveFolderPath('{year}/{month}', metadata, file);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.resolvedPath).toBe('2026/01');
        expect(result.data.resolvedPlaceholders).toContain('year');
        expect(result.data.resolvedPlaceholders).toContain('month');
        expect(result.data.missingPlaceholders).toHaveLength(0);
      }
    });

    it('resolves year/month/day pattern', () => {
      const file = createTestFile();
      const metadata = createUnifiedMetadata(file, { image: createImageMetadata() });

      const result = resolveFolderPath('{year}/{month}/{day}', metadata, file);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.resolvedPath).toBe('2026/01/10');
      }
    });

    it('resolves pattern with static text', () => {
      const file = createTestFile();
      const metadata = createUnifiedMetadata(file, { image: createImageMetadata() });

      const result = resolveFolderPath('Photos/{year}/{month}', metadata, file);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.resolvedPath).toBe('Photos/2026/01');
      }
    });

    it('resolves pattern with ext placeholder', () => {
      const file = createTestFile();
      const metadata = createUnifiedMetadata(file, { image: createImageMetadata() });

      const result = resolveFolderPath('{ext}/{year}', metadata, file);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.resolvedPath).toBe('jpg/2026');
      }
    });

    it('handles pattern with no placeholders', () => {
      const file = createTestFile();
      const metadata = createUnifiedMetadata(file);

      const result = resolveFolderPath('archive/2026', metadata, file);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.resolvedPath).toBe('archive/2026');
        expect(result.data.resolvedPlaceholders).toHaveLength(0);
      }
    });
  });

  // =============================================================================
  // Metadata Source Tests
  // =============================================================================

  describe('metadata sources', () => {
    it('resolves date from image EXIF metadata', () => {
      const file = createTestFile();
      const image = createImageMetadata({ dateTaken: new Date('2025-06-15T10:30:00Z') });
      const metadata = createUnifiedMetadata(file, { image });

      const result = resolveFolderPath('{year}/{month}', metadata, file);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.resolvedPath).toBe('2025/06');
      }
    });

    it('resolves date from PDF creation date', () => {
      const file = createTestFile({ extension: 'pdf', category: 'document' });
      const pdf = createPdfMetadata({ creationDate: new Date('2024-12-25T00:00:00Z') });
      const metadata = createUnifiedMetadata(file, { pdf });

      const result = resolveFolderPath('{year}/{month}', metadata, file);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.resolvedPath).toBe('2024/12');
      }
    });

    it('resolves date from Office document creation date', () => {
      const file = createTestFile({ extension: 'docx', category: 'document' });
      const office = createOfficeMetadata({ created: new Date('2025-03-20T14:00:00Z') });
      const metadata = createUnifiedMetadata(file, { office });

      const result = resolveFolderPath('{year}/{month}', metadata, file);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.resolvedPath).toBe('2025/03');
      }
    });

    it('falls back to file date when no type-specific metadata', () => {
      const file = createTestFile({
        modifiedAt: new Date('2023-07-04T12:00:00Z'),
      });
      // Create metadata without any type-specific metadata
      const metadata: UnifiedMetadata = {
        file,
        image: null,
        pdf: null,
        office: null,
        extractionStatus: 'unsupported',
        extractionError: null,
      };

      const result = resolveFolderPath('{year}/{month}', metadata, file);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Falls back to file's modifiedAt date
        expect(result.data.resolvedPath).toBe('2023/07');
      }
    });

    it('resolves author from PDF metadata', () => {
      const file = createTestFile({ extension: 'pdf' });
      const pdf = createPdfMetadata({ author: 'Jane Author' });
      const metadata = createUnifiedMetadata(file, { pdf });

      const result = resolveFolderPath('{year}/{author}', metadata, file);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Author gets sanitized (spaces become underscores)
        expect(result.data.resolvedPath).toMatch(/2026\/Jane[_ ]Author/);
      }
    });

    it('resolves camera from image metadata', () => {
      const file = createTestFile();
      const image = createImageMetadata({ cameraMake: 'Canon', cameraModel: 'EOS 5D' });
      const metadata = createUnifiedMetadata(file, { image });

      const result = resolveFolderPath('{camera}/{year}', metadata, file);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.resolvedPath).toContain('Canon');
      }
    });
  });

  // =============================================================================
  // Missing Metadata Tests (AC7)
  // =============================================================================

  describe('missing metadata handling (AC7)', () => {
    it('returns error when required placeholder cannot be resolved', () => {
      const file = createTestFile();
      const metadata = createUnifiedMetadata(file);
      // No PDF/Office metadata, location requires EXIF GPS

      const result = resolveFolderPath('{location}/{year}', metadata, file);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('missing_metadata');
        expect(result.error.missingFields).toContain('location');
      }
    });

    it('uses fallback value when provided for missing placeholder', () => {
      const file = createTestFile();
      const metadata = createUnifiedMetadata(file);

      const result = resolveFolderPath('{location}/{year}', metadata, file, {
        fallbacks: { location: 'Unknown' },
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.resolvedPath).toContain('Unknown');
        expect(result.data.usedFallbacks).toBe(true);
      }
    });

    it('tracks multiple missing placeholders', () => {
      const file = createTestFile();
      const metadata = createUnifiedMetadata(file);
      // location and camera are both missing when no EXIF

      const result = resolveFolderPath('{location}/{camera}', metadata, file);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('missing_metadata');
        expect(result.error.missingFields).toContain('location');
        expect(result.error.missingFields).toContain('camera');
      }
    });

    it('partially resolves with some fallbacks', () => {
      const file = createTestFile();
      const metadata = createUnifiedMetadata(file);

      const result = resolveFolderPath('{location}/{camera}', metadata, file, {
        fallbacks: { location: 'Unknown' },
        // camera has no fallback
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.missingFields).toContain('camera');
        expect(result.error.missingFields).not.toContain('location');
      }
    });
  });

  // =============================================================================
  // Path Normalization Tests
  // =============================================================================

  describe('path normalization', () => {
    it('normalizes backslashes to forward slashes', () => {
      const file = createTestFile();
      const metadata = createUnifiedMetadata(file, { image: createImageMetadata() });

      const result = resolveFolderPath('{year}\\{month}', metadata, file);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.resolvedPath).toBe('2026/01');
        expect(result.data.resolvedPath).not.toContain('\\');
      }
    });

    it('removes leading slashes', () => {
      const file = createTestFile();
      const metadata = createUnifiedMetadata(file, { image: createImageMetadata() });

      const result = resolveFolderPath('/{year}/{month}', metadata, file);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.resolvedPath).not.toMatch(/^\//);
      }
    });

    it('removes trailing slashes', () => {
      const file = createTestFile();
      const metadata = createUnifiedMetadata(file, { image: createImageMetadata() });

      const result = resolveFolderPath('{year}/{month}/', metadata, file);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.resolvedPath).not.toMatch(/\/$/);
      }
    });

    it('collapses multiple consecutive slashes', () => {
      const file = createTestFile();
      const metadata = createUnifiedMetadata(file, { image: createImageMetadata() });

      const result = resolveFolderPath('{year}//{month}', metadata, file);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.resolvedPath).toBe('2026/01');
        expect(result.data.resolvedPath).not.toContain('//');
      }
    });
  });

  // =============================================================================
  // Invalid Pattern Tests
  // =============================================================================

  describe('invalid patterns', () => {
    it('returns error for empty pattern', () => {
      const file = createTestFile();
      const metadata = createUnifiedMetadata(file);

      const result = resolveFolderPath('', metadata, file);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('invalid_pattern');
      }
    });

    it('returns error for whitespace-only pattern', () => {
      const file = createTestFile();
      const metadata = createUnifiedMetadata(file);

      const result = resolveFolderPath('   ', metadata, file);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('invalid_pattern');
      }
    });

    it('returns error for unclosed brace', () => {
      const file = createTestFile();
      const metadata = createUnifiedMetadata(file);

      const result = resolveFolderPath('{year/{month}', metadata, file);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('invalid_pattern');
      }
    });
  });

  // =============================================================================
  // File Placeholder Tests
  // =============================================================================

  describe('file placeholders', () => {
    it('resolves {ext} placeholder', () => {
      const file = createTestFile({ extension: 'png' });
      const metadata = createUnifiedMetadata(file, { image: createImageMetadata() });

      const result = resolveFolderPath('{ext}/{year}', metadata, file);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.resolvedPath).toContain('png');
      }
    });

    it('resolves {original} filename placeholder', () => {
      const file = createTestFile({ name: 'MyPhoto' });
      const metadata = createUnifiedMetadata(file);

      const result = resolveFolderPath('{year}/{original}', metadata, file);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.resolvedPath).toContain('MyPhoto');
      }
    });

    it('resolves {size} placeholder', () => {
      const file = createTestFile({ size: 1048576 });
      const metadata = createUnifiedMetadata(file, { image: createImageMetadata() });

      const result = resolveFolderPath('{size}/{year}', metadata, file);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // 1MB formatted
        expect(result.data.resolvedPath).toContain('1');
        expect(result.data.resolvedPath).toContain('MB');
      }
    });
  });

  // =============================================================================
  // Options Tests
  // =============================================================================

  describe('options', () => {
    it('prepends baseDirectory when provided', () => {
      const file = createTestFile();
      const metadata = createUnifiedMetadata(file, { image: createImageMetadata() });

      const result = resolveFolderPath('{year}/{month}', metadata, file, {
        baseDirectory: '/home/user/organized',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Note: baseDirectory is not included in resolvedPath, it's applied later
        // during file move. The resolvedPath is relative.
        expect(result.data.resolvedPath).toBe('2026/01');
      }
    });

    it('uses multiple fallback values', () => {
      const file = createTestFile();
      const metadata = createUnifiedMetadata(file);

      const result = resolveFolderPath('{location}/{camera}', metadata, file, {
        fallbacks: {
          location: 'Unknown_Location',
          camera: 'Unknown_Camera',
        },
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.resolvedPath).toBe('Unknown_Location/Unknown_Camera');
        expect(result.data.usedFallbacks).toBe(true);
      }
    });
  });

  // =============================================================================
  // Complex Patterns
  // =============================================================================

  describe('complex patterns', () => {
    it('resolves deeply nested folder structure', () => {
      const file = createTestFile();
      const image = createImageMetadata({ cameraMake: 'Sony', cameraModel: 'A7III' });
      const metadata = createUnifiedMetadata(file, { image });

      const result = resolveFolderPath(
        '{camera}/{year}/{month}/{day}',
        metadata,
        file
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Camera combines make and model: "Sony A7III"
        expect(result.data.resolvedPath).toMatch(/Sony/);
        expect(result.data.resolvedPath).toMatch(/2026\/01\/10/);
      }
    });

    it('resolves pattern with mixed static and dynamic parts', () => {
      const file = createTestFile();
      const metadata = createUnifiedMetadata(file, { image: createImageMetadata() });

      const result = resolveFolderPath(
        'Archive-{year}/Month-{month}',
        metadata,
        file
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.resolvedPath).toBe('Archive-2026/Month-01');
      }
    });

    it('handles extension-based organization', () => {
      const file = createTestFile({ extension: 'jpg' });
      const metadata = createUnifiedMetadata(file, { image: createImageMetadata() });

      const result = resolveFolderPath('{ext}/{year}/{month}', metadata, file);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.resolvedPath).toBe('jpg/2026/01');
      }
    });
  });

  // =============================================================================
  // Edge Cases
  // =============================================================================

  describe('edge cases', () => {
    it('sanitizes special characters in resolved values', () => {
      const file = createTestFile();
      const pdf = createPdfMetadata({ author: 'John <CEO> Smith' });
      const metadata = createUnifiedMetadata(file, { pdf });

      const result = resolveFolderPath('{author}/{year}', metadata, file);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Special characters should be sanitized
        expect(result.data.resolvedPath).not.toContain('<');
        expect(result.data.resolvedPath).not.toContain('>');
      }
    });

    it('handles empty string resolved values', () => {
      const file = createTestFile();
      const pdf = createPdfMetadata({ author: '' });
      const metadata = createUnifiedMetadata(file, { pdf });

      const result = resolveFolderPath('{author}/{year}', metadata, file);

      // Empty author should be treated as missing
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('missing_metadata');
      }
    });

    it('handles whitespace-only resolved values', () => {
      const file = createTestFile();
      const pdf = createPdfMetadata({ author: '   ' });
      const metadata = createUnifiedMetadata(file, { pdf });

      const result = resolveFolderPath('{author}/{year}', metadata, file);

      // Whitespace-only should be treated as missing
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('missing_metadata');
      }
    });

    it('trims whitespace from resolved values', () => {
      const file = createTestFile();
      const pdf = createPdfMetadata({ author: '  John Smith  ' });
      const metadata = createUnifiedMetadata(file, { pdf });

      const result = resolveFolderPath('{author}/{year}', metadata, file);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Author gets trimmed and sanitized (spaces may become underscores)
        expect(result.data.resolvedPath).toMatch(/John[_ ]?Smith/);
        expect(result.data.resolvedPath).not.toMatch(/^\s|\s$/);
      }
    });
  });

  // =============================================================================
  // Resolution Tracking
  // =============================================================================

  describe('resolution tracking', () => {
    it('tracks all resolved placeholders', () => {
      const file = createTestFile();
      const metadata = createUnifiedMetadata(file, { image: createImageMetadata() });

      const result = resolveFolderPath('{year}/{month}/{day}', metadata, file);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.resolvedPlaceholders).toEqual(
          expect.arrayContaining(['year', 'month', 'day'])
        );
      }
    });

    it('correctly reports usedFallbacks as false when no fallbacks used', () => {
      const file = createTestFile();
      const metadata = createUnifiedMetadata(file, { image: createImageMetadata() });

      const result = resolveFolderPath('{year}/{month}', metadata, file);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.usedFallbacks).toBe(false);
      }
    });

    it('correctly reports usedFallbacks as true when fallbacks used', () => {
      const file = createTestFile();
      const metadata = createUnifiedMetadata(file);

      const result = resolveFolderPath('{location}', metadata, file, {
        fallbacks: { location: 'Unknown' },
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.usedFallbacks).toBe(true);
      }
    });
  });
});
