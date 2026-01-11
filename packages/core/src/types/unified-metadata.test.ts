import { describe, it, expect } from 'vitest';
import {
  unifiedMetadataSchema,
  extractionStatusSchema,
  createEmptyUnifiedMetadata,
  type UnifiedMetadata,
} from './unified-metadata.js';
import { FileCategory } from './file-category.js';
import { MetadataCapability } from './metadata-capability.js';
import type { FileInfo } from './file-info.js';

const createTestFileInfo = (overrides: Partial<FileInfo> = {}): FileInfo => ({
  path: '/test/photo.jpg',
  name: 'photo',
  extension: 'jpg',
  fullName: 'photo.jpg',
  size: 1024,
  createdAt: new Date('2024-01-01'),
  modifiedAt: new Date('2024-01-02'),
  category: FileCategory.IMAGE,
  metadataSupported: true,
  metadataCapability: MetadataCapability.FULL,
  ...overrides,
});

describe('extractionStatusSchema', () => {
  it('accepts valid status values', () => {
    expect(extractionStatusSchema.parse('success')).toBe('success');
    expect(extractionStatusSchema.parse('partial')).toBe('partial');
    expect(extractionStatusSchema.parse('failed')).toBe('failed');
    expect(extractionStatusSchema.parse('unsupported')).toBe('unsupported');
  });

  it('rejects invalid status values', () => {
    expect(() => extractionStatusSchema.parse('invalid')).toThrow();
    expect(() => extractionStatusSchema.parse('')).toThrow();
    expect(() => extractionStatusSchema.parse(123)).toThrow();
  });
});

describe('unifiedMetadataSchema', () => {
  it('validates complete metadata with image data', () => {
    const metadata: UnifiedMetadata = {
      file: createTestFileInfo(),
      image: {
        dateTaken: new Date('2024-01-01'),
        cameraMake: 'Canon',
        cameraModel: 'EOS R5',
        gps: { latitude: 40.7128, longitude: -74.006 },
        width: 4000,
        height: 3000,
        orientation: 1,
        exposureTime: '1/125',
        fNumber: 2.8,
        iso: 400,
      },
      pdf: null,
      office: null,
      extractionStatus: 'success',
      extractionError: null,
    };

    const result = unifiedMetadataSchema.safeParse(metadata);
    expect(result.success).toBe(true);
  });

  it('validates complete metadata with PDF data', () => {
    const metadata: UnifiedMetadata = {
      file: createTestFileInfo({
        path: '/test/document.pdf',
        name: 'document',
        extension: 'pdf',
        fullName: 'document.pdf',
        category: FileCategory.PDF,
      }),
      image: null,
      pdf: {
        title: 'Test Document',
        author: 'John Doe',
        subject: 'Testing',
        keywords: 'test, document',
        creator: 'Word',
        producer: 'PDF Converter',
        creationDate: new Date('2024-01-01'),
        modificationDate: new Date('2024-01-02'),
        pageCount: 10,
      },
      office: null,
      extractionStatus: 'success',
      extractionError: null,
    };

    const result = unifiedMetadataSchema.safeParse(metadata);
    expect(result.success).toBe(true);
  });

  it('validates complete metadata with Office data', () => {
    const metadata: UnifiedMetadata = {
      file: createTestFileInfo({
        path: '/test/report.docx',
        name: 'report',
        extension: 'docx',
        fullName: 'report.docx',
        category: FileCategory.DOCUMENT,
      }),
      image: null,
      pdf: null,
      office: {
        title: 'Annual Report',
        subject: 'Financial Summary',
        creator: 'Jane Smith',
        keywords: 'finance, annual',
        description: 'Annual financial report',
        lastModifiedBy: 'Bob Wilson',
        created: new Date('2024-01-01'),
        modified: new Date('2024-01-02'),
        revision: '5',
        category: 'Reports',
        application: 'Microsoft Office Word',
        appVersion: '16.0',
        pageCount: 25,
        wordCount: 5000,
      },
      extractionStatus: 'success',
      extractionError: null,
    };

    const result = unifiedMetadataSchema.safeParse(metadata);
    expect(result.success).toBe(true);
  });

  it('validates metadata with all type-specific fields null', () => {
    const metadata: UnifiedMetadata = {
      file: createTestFileInfo({
        category: FileCategory.OTHER,
        metadataSupported: false,
        metadataCapability: MetadataCapability.BASIC,
      }),
      image: null,
      pdf: null,
      office: null,
      extractionStatus: 'unsupported',
      extractionError: null,
    };

    const result = unifiedMetadataSchema.safeParse(metadata);
    expect(result.success).toBe(true);
  });

  it('validates failed extraction with error message', () => {
    const metadata: UnifiedMetadata = {
      file: createTestFileInfo(),
      image: null,
      pdf: null,
      office: null,
      extractionStatus: 'failed',
      extractionError: 'File is corrupted',
    };

    const result = unifiedMetadataSchema.safeParse(metadata);
    expect(result.success).toBe(true);
  });

  it('rejects metadata without file info', () => {
    const invalid = {
      file: null,
      image: null,
      pdf: null,
      office: null,
      extractionStatus: 'unsupported',
      extractionError: null,
    };

    const result = unifiedMetadataSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects metadata with invalid extraction status', () => {
    const invalid = {
      file: createTestFileInfo(),
      image: null,
      pdf: null,
      office: null,
      extractionStatus: 'invalid',
      extractionError: null,
    };

    const result = unifiedMetadataSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

describe('createEmptyUnifiedMetadata', () => {
  it('creates metadata with all type-specific fields null', () => {
    const file = createTestFileInfo();
    const metadata = createEmptyUnifiedMetadata(file);

    expect(metadata.file).toEqual(file);
    expect(metadata.image).toBeNull();
    expect(metadata.pdf).toBeNull();
    expect(metadata.office).toBeNull();
    expect(metadata.extractionStatus).toBe('unsupported');
    expect(metadata.extractionError).toBeNull();
  });

  it('creates valid metadata per schema', () => {
    const file = createTestFileInfo();
    const metadata = createEmptyUnifiedMetadata(file);

    const result = unifiedMetadataSchema.safeParse(metadata);
    expect(result.success).toBe(true);
  });
});
