/**
 * @fileoverview Tests for field path resolver - Story 7.1
 */

import { describe, it, expect } from 'vitest';
import {
  resolveFieldPath,
  fieldExists,
  resolveMultipleFields,
} from './field-resolver.js';
import type { UnifiedMetadata } from '../types/unified-metadata.js';
import { FileCategory } from '../types/file-category.js';
import { MetadataCapability } from '../types/metadata-capability.js';

// =============================================================================
// Test Fixtures
// =============================================================================

/**
 * Create a minimal file info for testing.
 */
function createTestFileInfo() {
  return {
    path: '/photos/IMG_1234.jpg',
    name: 'IMG_1234',
    extension: 'jpg',
    fullName: 'IMG_1234.jpg',
    size: 2500000,
    createdAt: new Date('2026-01-10T10:00:00Z'),
    modifiedAt: new Date('2026-01-10T11:00:00Z'),
    relativePath: 'photos/IMG_1234.jpg',
    mimeType: 'image/jpeg',
    category: FileCategory.IMAGE,
    metadataSupported: true,
    metadataCapability: MetadataCapability.FULL,
  };
}

/**
 * Create test image metadata.
 */
function createTestImageMetadata() {
  return {
    dateTaken: new Date('2026-01-05T14:30:00Z'),
    cameraMake: 'Apple',
    cameraModel: 'iPhone 15 Pro',
    gps: {
      latitude: 48.8584,
      longitude: 2.2945,
    },
    width: 4032,
    height: 3024,
    orientation: 1,
    exposureTime: '1/125',
    fNumber: 1.78,
    iso: 100,
  };
}

/**
 * Create test PDF metadata.
 */
function createTestPdfMetadata() {
  return {
    title: 'Annual Report 2026',
    author: 'John Smith',
    subject: 'Financial Summary',
    keywords: 'finance, report, 2026',
    creator: 'Microsoft Word',
    producer: 'Adobe PDF',
    creationDate: new Date('2026-01-01T09:00:00Z'),
    modificationDate: new Date('2026-01-05T15:00:00Z'),
    pageCount: 42,
  };
}

/**
 * Create test Office metadata.
 */
function createTestOfficeMetadata() {
  return {
    title: 'Project Proposal',
    subject: 'New Initiative',
    creator: 'Jane Doe',
    keywords: 'project, proposal',
    description: 'Proposal for new project',
    lastModifiedBy: 'Bob Wilson',
    created: new Date('2026-01-02T08:00:00Z'),
    modified: new Date('2026-01-08T16:00:00Z'),
    revision: '5',
    category: 'Business',
    application: 'Microsoft Office Word',
    appVersion: '16.0',
    pageCount: 15,
    wordCount: 5000,
  };
}

/**
 * Create complete unified metadata for testing.
 */
function createFullUnifiedMetadata(): UnifiedMetadata {
  return {
    file: createTestFileInfo(),
    image: createTestImageMetadata(),
    pdf: null,
    office: null,
    extractionStatus: 'success',
    extractionError: null,
  };
}

/**
 * Create PDF unified metadata for testing.
 */
function createPdfUnifiedMetadata(): UnifiedMetadata {
  return {
    file: { ...createTestFileInfo(), extension: 'pdf', category: FileCategory.PDF },
    image: null,
    pdf: createTestPdfMetadata(),
    office: null,
    extractionStatus: 'success',
    extractionError: null,
  };
}

/**
 * Create Office unified metadata for testing.
 */
function createOfficeUnifiedMetadata(): UnifiedMetadata {
  return {
    file: { ...createTestFileInfo(), extension: 'docx', category: FileCategory.DOCUMENT },
    image: null,
    pdf: null,
    office: createTestOfficeMetadata(),
    extractionStatus: 'success',
    extractionError: null,
  };
}

/**
 * Create metadata with null type-specific metadata.
 */
function createEmptyMetadata(): UnifiedMetadata {
  return {
    file: createTestFileInfo(),
    image: null,
    pdf: null,
    office: null,
    extractionStatus: 'unsupported',
    extractionError: null,
  };
}

// =============================================================================
// resolveFieldPath Tests
// =============================================================================

describe('resolveFieldPath', () => {
  describe('image namespace', () => {
    const metadata = createFullUnifiedMetadata();

    it('resolves image.cameraMake', () => {
      const result = resolveFieldPath('image.cameraMake', metadata);
      expect(result.found).toBe(true);
      expect(result.value).toBe('Apple');
      expect(result.originalType).toBe('string');
    });

    it('resolves image.cameraModel', () => {
      const result = resolveFieldPath('image.cameraModel', metadata);
      expect(result.found).toBe(true);
      expect(result.value).toBe('iPhone 15 Pro');
    });

    it('resolves image.camera (combined make + model)', () => {
      const result = resolveFieldPath('image.camera', metadata);
      expect(result.found).toBe(true);
      expect(result.value).toBe('Apple iPhone 15 Pro');
    });

    it('resolves image.dateTaken', () => {
      const result = resolveFieldPath('image.dateTaken', metadata);
      expect(result.found).toBe(true);
      expect(result.value).toBe('2026-01-05T14:30:00.000Z');
      expect(result.originalType).toBe('date');
    });

    it('resolves image.width', () => {
      const result = resolveFieldPath('image.width', metadata);
      expect(result.found).toBe(true);
      expect(result.value).toBe('4032');
      expect(result.originalType).toBe('number');
    });

    it('resolves image.iso', () => {
      const result = resolveFieldPath('image.iso', metadata);
      expect(result.found).toBe(true);
      expect(result.value).toBe('100');
    });

    it('resolves image.gps (as object)', () => {
      const result = resolveFieldPath('image.gps', metadata);
      expect(result.found).toBe(true);
      expect(result.originalType).toBe('object');
      expect(result.value).toContain('48.8584');
    });

    it('resolves image.gps.latitude (nested)', () => {
      const result = resolveFieldPath('image.gps.latitude', metadata);
      expect(result.found).toBe(true);
      expect(result.value).toBe('48.8584');
    });

    it('resolves image.gps.longitude (nested)', () => {
      const result = resolveFieldPath('image.gps.longitude', metadata);
      expect(result.found).toBe(true);
      expect(result.value).toBe('2.2945');
    });

    it('resolves alias image.make', () => {
      const result = resolveFieldPath('image.make', metadata);
      expect(result.found).toBe(true);
      expect(result.value).toBe('Apple');
    });

    it('returns not found for invalid image field', () => {
      const result = resolveFieldPath('image.nonexistent', metadata);
      expect(result.found).toBe(false);
      expect(result.value).toBeNull();
    });

    it('returns not found when image metadata is null', () => {
      const emptyMetadata = createEmptyMetadata();
      const result = resolveFieldPath('image.cameraMake', emptyMetadata);
      expect(result.found).toBe(false);
      expect(result.value).toBeNull();
    });
  });

  describe('pdf namespace', () => {
    const metadata = createPdfUnifiedMetadata();

    it('resolves pdf.title', () => {
      const result = resolveFieldPath('pdf.title', metadata);
      expect(result.found).toBe(true);
      expect(result.value).toBe('Annual Report 2026');
    });

    it('resolves pdf.author', () => {
      const result = resolveFieldPath('pdf.author', metadata);
      expect(result.found).toBe(true);
      expect(result.value).toBe('John Smith');
    });

    it('resolves pdf.pageCount', () => {
      const result = resolveFieldPath('pdf.pageCount', metadata);
      expect(result.found).toBe(true);
      expect(result.value).toBe('42');
    });

    it('resolves pdf.creationDate', () => {
      const result = resolveFieldPath('pdf.creationDate', metadata);
      expect(result.found).toBe(true);
      expect(result.originalType).toBe('date');
    });

    it('returns not found when pdf metadata is null', () => {
      const imageMetadata = createFullUnifiedMetadata();
      const result = resolveFieldPath('pdf.author', imageMetadata);
      expect(result.found).toBe(false);
    });
  });

  describe('office namespace', () => {
    const metadata = createOfficeUnifiedMetadata();

    it('resolves office.title', () => {
      const result = resolveFieldPath('office.title', metadata);
      expect(result.found).toBe(true);
      expect(result.value).toBe('Project Proposal');
    });

    it('resolves office.creator', () => {
      const result = resolveFieldPath('office.creator', metadata);
      expect(result.found).toBe(true);
      expect(result.value).toBe('Jane Doe');
    });

    it('resolves office.author (alias for creator)', () => {
      const result = resolveFieldPath('office.author', metadata);
      expect(result.found).toBe(true);
      expect(result.value).toBe('Jane Doe');
    });

    it('resolves office.wordCount', () => {
      const result = resolveFieldPath('office.wordCount', metadata);
      expect(result.found).toBe(true);
      expect(result.value).toBe('5000');
    });

    it('resolves office.lastModifiedBy', () => {
      const result = resolveFieldPath('office.lastModifiedBy', metadata);
      expect(result.found).toBe(true);
      expect(result.value).toBe('Bob Wilson');
    });
  });

  describe('file namespace', () => {
    const metadata = createFullUnifiedMetadata();

    it('resolves file.name', () => {
      const result = resolveFieldPath('file.name', metadata);
      expect(result.found).toBe(true);
      expect(result.value).toBe('IMG_1234');
    });

    it('resolves file.extension', () => {
      const result = resolveFieldPath('file.extension', metadata);
      expect(result.found).toBe(true);
      expect(result.value).toBe('jpg');
    });

    it('resolves file.fullName', () => {
      const result = resolveFieldPath('file.fullName', metadata);
      expect(result.found).toBe(true);
      expect(result.value).toBe('IMG_1234.jpg');
    });

    it('resolves file.size', () => {
      const result = resolveFieldPath('file.size', metadata);
      expect(result.found).toBe(true);
      expect(result.value).toBe('2500000');
    });

    it('resolves file.category', () => {
      const result = resolveFieldPath('file.category', metadata);
      expect(result.found).toBe(true);
      expect(result.value).toBe('image');
    });

    it('resolves file.path', () => {
      const result = resolveFieldPath('file.path', metadata);
      expect(result.found).toBe(true);
      expect(result.value).toBe('/photos/IMG_1234.jpg');
    });

    it('resolves file.createdAt', () => {
      const result = resolveFieldPath('file.createdAt', metadata);
      expect(result.found).toBe(true);
      expect(result.originalType).toBe('date');
    });

    it('resolves file.metadataSupported', () => {
      const result = resolveFieldPath('file.metadataSupported', metadata);
      expect(result.found).toBe(true);
      expect(result.value).toBe('true');
      expect(result.originalType).toBe('boolean');
    });
  });

  describe('invalid paths', () => {
    const metadata = createFullUnifiedMetadata();

    it('returns not found for invalid namespace', () => {
      const result = resolveFieldPath('invalid.field', metadata);
      expect(result.found).toBe(false);
      expect(result.value).toBeNull();
    });

    it('returns not found for path without dot', () => {
      const result = resolveFieldPath('image', metadata);
      expect(result.found).toBe(false);
    });

    it('returns not found for empty string', () => {
      const result = resolveFieldPath('', metadata);
      expect(result.found).toBe(false);
    });

    it('returns not found for path with only namespace', () => {
      const result = resolveFieldPath('file.', metadata);
      expect(result.found).toBe(false);
    });
  });

  describe('null field values', () => {
    it('handles null field in image metadata', () => {
      const metadata: UnifiedMetadata = {
        file: createTestFileInfo(),
        image: {
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
        },
        pdf: null,
        office: null,
        extractionStatus: 'success',
        extractionError: null,
      };

      const result = resolveFieldPath('image.cameraMake', metadata);
      expect(result.found).toBe(false);
      expect(result.value).toBeNull();
      expect(result.originalType).toBe('null');
    });

    it('handles null GPS when accessing nested path', () => {
      const metadata: UnifiedMetadata = {
        file: createTestFileInfo(),
        image: {
          ...createTestImageMetadata(),
          gps: null,
        },
        pdf: null,
        office: null,
        extractionStatus: 'success',
        extractionError: null,
      };

      const result = resolveFieldPath('image.gps.latitude', metadata);
      expect(result.found).toBe(false);
    });
  });
});

// =============================================================================
// fieldExists Tests
// =============================================================================

describe('fieldExists', () => {
  const metadata = createFullUnifiedMetadata();

  it('returns true for existing field with value', () => {
    expect(fieldExists('image.cameraMake', metadata)).toBe(true);
  });

  it('returns true for file.extension', () => {
    expect(fieldExists('file.extension', metadata)).toBe(true);
  });

  it('returns false for null field', () => {
    const metadataWithNull: UnifiedMetadata = {
      ...metadata,
      image: { ...createTestImageMetadata(), cameraMake: null },
    };
    expect(fieldExists('image.cameraMake', metadataWithNull)).toBe(false);
  });

  it('returns false for invalid path', () => {
    expect(fieldExists('invalid.path', metadata)).toBe(false);
  });

  it('returns false when namespace metadata is null', () => {
    expect(fieldExists('pdf.author', metadata)).toBe(false);
  });
});

// =============================================================================
// resolveMultipleFields Tests
// =============================================================================

describe('resolveMultipleFields', () => {
  const metadata = createFullUnifiedMetadata();

  it('resolves multiple fields', () => {
    const paths = ['image.cameraMake', 'file.extension', 'image.dateTaken'];
    const results = resolveMultipleFields(paths, metadata);

    expect(results.size).toBe(3);
    expect(results.get('image.cameraMake')?.found).toBe(true);
    expect(results.get('file.extension')?.found).toBe(true);
    expect(results.get('image.dateTaken')?.found).toBe(true);
  });

  it('handles mix of found and not found', () => {
    const paths = ['image.cameraMake', 'pdf.author', 'invalid.path'];
    const results = resolveMultipleFields(paths, metadata);

    expect(results.get('image.cameraMake')?.found).toBe(true);
    expect(results.get('pdf.author')?.found).toBe(false);
    expect(results.get('invalid.path')?.found).toBe(false);
  });

  it('returns empty map for empty input', () => {
    const results = resolveMultipleFields([], metadata);
    expect(results.size).toBe(0);
  });
});
