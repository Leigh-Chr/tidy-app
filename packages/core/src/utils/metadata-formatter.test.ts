import { describe, it, expect } from 'vitest';
import { formatMetadataForDisplay } from './metadata-formatter.js';
import type { UnifiedMetadata } from '../types/unified-metadata.js';
import type { FileInfo } from '../types/file-info.js';
import { FileCategory } from '../types/file-category.js';
import { MetadataCapability } from '../types/metadata-capability.js';

const createTestFileInfo = (overrides: Partial<FileInfo> = {}): FileInfo => ({
  path: '/test/photo.jpg',
  name: 'photo',
  extension: 'jpg',
  fullName: 'photo.jpg',
  size: 1024,
  createdAt: new Date('2024-01-01T10:00:00'),
  modifiedAt: new Date('2024-01-02T15:30:00'),
  category: FileCategory.IMAGE,
  metadataSupported: true,
  metadataCapability: MetadataCapability.FULL,
  ...overrides,
});

describe('formatMetadataForDisplay', () => {
  describe('file information section', () => {
    it('always includes file information section', () => {
      const metadata: UnifiedMetadata = {
        file: createTestFileInfo(),
        image: null,
        pdf: null,
        office: null,
        extractionStatus: 'unsupported',
        extractionError: null,
      };

      const sections = formatMetadataForDisplay(metadata);

      expect(sections.length).toBeGreaterThanOrEqual(1);
      expect(sections[0]?.title).toBe('File Information');
    });

    it('formats file name correctly', () => {
      const metadata: UnifiedMetadata = {
        file: createTestFileInfo({ fullName: 'my-photo.jpg' }),
        image: null,
        pdf: null,
        office: null,
        extractionStatus: 'unsupported',
        extractionError: null,
      };

      const sections = formatMetadataForDisplay(metadata);
      const nameField = sections[0]?.fields.find((f) => f.label === 'Name');

      expect(nameField?.value).toBe('my-photo.jpg');
    });

    it('formats file size with appropriate units', () => {
      const metadata: UnifiedMetadata = {
        file: createTestFileInfo({ size: 1536 }), // 1.5 KB
        image: null,
        pdf: null,
        office: null,
        extractionStatus: 'unsupported',
        extractionError: null,
      };

      const sections = formatMetadataForDisplay(metadata);
      const sizeField = sections[0]?.fields.find((f) => f.label === 'Size');

      expect(sizeField?.value).toBe('1.50 KB');
    });

    it('formats dates with month, day, year and time', () => {
      const metadata: UnifiedMetadata = {
        file: createTestFileInfo(),
        image: null,
        pdf: null,
        office: null,
        extractionStatus: 'unsupported',
        extractionError: null,
      };

      const sections = formatMetadataForDisplay(metadata);
      const createdField = sections[0]?.fields.find(
        (f) => f.label === 'Created'
      );

      // Format varies by locale, but should contain the date components
      expect(createdField?.value).toContain('2024');
      expect(createdField?.value).toContain('January');
    });

    it('capitalizes category', () => {
      const metadata: UnifiedMetadata = {
        file: createTestFileInfo({ category: FileCategory.IMAGE }),
        image: null,
        pdf: null,
        office: null,
        extractionStatus: 'unsupported',
        extractionError: null,
      };

      const sections = formatMetadataForDisplay(metadata);
      const categoryField = sections[0]?.fields.find(
        (f) => f.label === 'Category'
      );

      expect(categoryField?.value).toBe('Image');
    });
  });

  describe('image metadata section', () => {
    it('includes image section when image metadata present', () => {
      const metadata: UnifiedMetadata = {
        file: createTestFileInfo(),
        image: {
          dateTaken: new Date('2024-06-15T14:30:00'),
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

      const sections = formatMetadataForDisplay(metadata);
      const imageSection = sections.find((s) => s.title === 'Image Information');

      expect(imageSection).toBeDefined();
    });

    it('formats camera make and model together', () => {
      const metadata: UnifiedMetadata = {
        file: createTestFileInfo(),
        image: {
          dateTaken: null,
          cameraMake: 'Canon',
          cameraModel: 'EOS R5',
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

      const sections = formatMetadataForDisplay(metadata);
      const imageSection = sections.find((s) => s.title === 'Image Information');
      const cameraField = imageSection?.fields.find((f) => f.label === 'Camera');

      expect(cameraField?.value).toBe('Canon EOS R5');
    });

    it('formats dimensions with multiplication sign', () => {
      const metadata: UnifiedMetadata = {
        file: createTestFileInfo(),
        image: {
          dateTaken: null,
          cameraMake: null,
          cameraModel: null,
          gps: null,
          width: 4000,
          height: 3000,
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

      const sections = formatMetadataForDisplay(metadata);
      const imageSection = sections.find((s) => s.title === 'Image Information');
      const dimensionsField = imageSection?.fields.find(
        (f) => f.label === 'Dimensions'
      );

      expect(dimensionsField?.value).toBe('4000 × 3000');
    });

    it('formats GPS coordinates with 6 decimal places', () => {
      const metadata: UnifiedMetadata = {
        file: createTestFileInfo(),
        image: {
          dateTaken: null,
          cameraMake: null,
          cameraModel: null,
          gps: { latitude: 40.7128, longitude: -74.006 },
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

      const sections = formatMetadataForDisplay(metadata);
      const imageSection = sections.find((s) => s.title === 'Image Information');
      const locationField = imageSection?.fields.find(
        (f) => f.label === 'Location'
      );

      expect(locationField?.value).toBe('40.712800, -74.006000');
    });

    it('formats exposure settings with time and aperture', () => {
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
          exposureTime: '1/125',
          fNumber: 2.8,
          iso: null,
        },
        pdf: null,
        office: null,
        extractionStatus: 'success',
        extractionError: null,
      };

      const sections = formatMetadataForDisplay(metadata);
      const imageSection = sections.find((s) => s.title === 'Image Information');
      const exposureField = imageSection?.fields.find(
        (f) => f.label === 'Exposure'
      );

      expect(exposureField?.value).toBe('1/125 at f/2.8');
    });

    it('formats ISO with prefix', () => {
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
          iso: 400,
        },
        pdf: null,
        office: null,
        extractionStatus: 'success',
        extractionError: null,
      };

      const sections = formatMetadataForDisplay(metadata);
      const imageSection = sections.find((s) => s.title === 'Image Information');
      const isoField = imageSection?.fields.find((f) => f.label === 'ISO');

      expect(isoField?.value).toBe('ISO 400');
    });

    it('excludes image section when all fields are null', () => {
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

      const sections = formatMetadataForDisplay(metadata);
      const imageSection = sections.find((s) => s.title === 'Image Information');

      expect(imageSection).toBeUndefined();
    });
  });

  describe('PDF metadata section', () => {
    it('includes PDF section when pdf metadata present', () => {
      const metadata: UnifiedMetadata = {
        file: createTestFileInfo({
          category: FileCategory.PDF,
          extension: 'pdf',
        }),
        image: null,
        pdf: {
          title: 'Annual Report',
          author: 'John Doe',
          subject: 'Financial Summary',
          keywords: 'finance, report',
          creator: 'Word',
          producer: 'PDF Lib',
          creationDate: new Date('2024-01-01'),
          modificationDate: new Date('2024-01-15'),
          pageCount: 25,
        },
        office: null,
        extractionStatus: 'success',
        extractionError: null,
      };

      const sections = formatMetadataForDisplay(metadata);
      const pdfSection = sections.find((s) => s.title === 'Document Properties');

      expect(pdfSection).toBeDefined();
      expect(pdfSection?.fields.some((f) => f.label === 'Title')).toBe(true);
      expect(pdfSection?.fields.some((f) => f.label === 'Author')).toBe(true);
    });

    it('formats page count with plural', () => {
      const metadata: UnifiedMetadata = {
        file: createTestFileInfo({ category: FileCategory.PDF }),
        image: null,
        pdf: {
          title: null,
          author: null,
          subject: null,
          keywords: null,
          creator: null,
          producer: null,
          creationDate: null,
          modificationDate: null,
          pageCount: 25,
        },
        office: null,
        extractionStatus: 'success',
        extractionError: null,
      };

      const sections = formatMetadataForDisplay(metadata);
      const pdfSection = sections.find((s) => s.title === 'Document Properties');
      const pagesField = pdfSection?.fields.find((f) => f.label === 'Pages');

      expect(pagesField?.value).toBe('25 pages');
    });

    it('formats single page correctly', () => {
      const metadata: UnifiedMetadata = {
        file: createTestFileInfo({ category: FileCategory.PDF }),
        image: null,
        pdf: {
          title: null,
          author: null,
          subject: null,
          keywords: null,
          creator: null,
          producer: null,
          creationDate: null,
          modificationDate: null,
          pageCount: 1,
        },
        office: null,
        extractionStatus: 'success',
        extractionError: null,
      };

      const sections = formatMetadataForDisplay(metadata);
      const pdfSection = sections.find((s) => s.title === 'Document Properties');
      const pagesField = pdfSection?.fields.find((f) => f.label === 'Pages');

      expect(pagesField?.value).toBe('1 page');
    });

    it('filters out fields with null values', () => {
      const metadata: UnifiedMetadata = {
        file: createTestFileInfo({ category: FileCategory.PDF }),
        image: null,
        pdf: {
          title: 'Test PDF',
          author: null,
          subject: null,
          keywords: null,
          creator: null,
          producer: null,
          creationDate: null,
          modificationDate: null,
          pageCount: null,
        },
        office: null,
        extractionStatus: 'success',
        extractionError: null,
      };

      const sections = formatMetadataForDisplay(metadata);
      const pdfSection = sections.find((s) => s.title === 'Document Properties');

      expect(pdfSection?.fields.length).toBe(1);
      expect(pdfSection?.fields[0]?.label).toBe('Title');
    });
  });

  describe('Office metadata section', () => {
    it('includes Office section when office metadata present', () => {
      const metadata: UnifiedMetadata = {
        file: createTestFileInfo({
          category: FileCategory.DOCUMENT,
          extension: 'docx',
        }),
        image: null,
        pdf: null,
        office: {
          title: 'Project Plan',
          subject: 'Q1 Planning',
          creator: 'Jane Smith',
          keywords: 'planning, project',
          description: 'Quarterly project plan',
          lastModifiedBy: 'Bob Wilson',
          created: new Date('2024-01-01'),
          modified: new Date('2024-01-15'),
          revision: '5',
          category: 'Business',
          application: 'Microsoft Office Word',
          appVersion: '16.0',
          pageCount: 10,
          wordCount: 2500,
        },
        extractionStatus: 'success',
        extractionError: null,
      };

      const sections = formatMetadataForDisplay(metadata);
      const officeSection = sections.find(
        (s) => s.title === 'Document Properties'
      );

      expect(officeSection).toBeDefined();
    });

    it('formats word count with locale separators', () => {
      const metadata: UnifiedMetadata = {
        file: createTestFileInfo({ category: FileCategory.DOCUMENT }),
        image: null,
        pdf: null,
        office: {
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
          wordCount: 12500,
        },
        extractionStatus: 'success',
        extractionError: null,
      };

      const sections = formatMetadataForDisplay(metadata);
      const officeSection = sections.find(
        (s) => s.title === 'Document Properties'
      );
      const wordCountField = officeSection?.fields.find(
        (f) => f.label === 'Word Count'
      );

      // The exact format depends on locale, but should contain the number
      expect(wordCountField?.value).toContain('words');
    });
  });

  describe('extraction status section', () => {
    it('includes extraction status when failed', () => {
      const metadata: UnifiedMetadata = {
        file: createTestFileInfo(),
        image: null,
        pdf: null,
        office: null,
        extractionStatus: 'failed',
        extractionError: 'File is corrupted',
      };

      const sections = formatMetadataForDisplay(metadata);
      const statusSection = sections.find(
        (s) => s.title === 'Extraction Status'
      );

      expect(statusSection).toBeDefined();
      expect(statusSection?.fields.some((f) => f.label === 'Status')).toBe(true);
      expect(statusSection?.fields.some((f) => f.label === 'Error')).toBe(true);
    });

    it('does not include status section when extraction succeeded', () => {
      const metadata: UnifiedMetadata = {
        file: createTestFileInfo(),
        image: null,
        pdf: null,
        office: null,
        extractionStatus: 'success',
        extractionError: null,
      };

      const sections = formatMetadataForDisplay(metadata);
      const statusSection = sections.find(
        (s) => s.title === 'Extraction Status'
      );

      expect(statusSection).toBeUndefined();
    });
  });

  describe('partial metadata handling', () => {
    it('handles partial image metadata gracefully', () => {
      const metadata: UnifiedMetadata = {
        file: createTestFileInfo(),
        image: {
          dateTaken: new Date('2024-06-15'),
          cameraMake: 'Canon',
          cameraModel: null, // Partial - only make
          gps: null,
          width: 4000,
          height: null, // Partial - only width
          orientation: null,
          exposureTime: '1/125',
          fNumber: null, // Partial - only exposure
          iso: 400,
        },
        pdf: null,
        office: null,
        extractionStatus: 'success',
        extractionError: null,
      };

      const sections = formatMetadataForDisplay(metadata);
      const imageSection = sections.find((s) => s.title === 'Image Information');

      // Should include fields that have values
      expect(imageSection?.fields.some((f) => f.label === 'Date Taken')).toBe(
        true
      );
      expect(imageSection?.fields.some((f) => f.label === 'Camera')).toBe(true);
      expect(imageSection?.fields.some((f) => f.label === 'ISO')).toBe(true);
      // Dimensions should be excluded since height is null
      expect(
        imageSection?.fields.some((f) => f.label === 'Dimensions')
      ).toBe(false);
    });
  });
});
