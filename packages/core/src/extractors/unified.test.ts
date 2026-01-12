import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { getFileMetadata } from './unified.js';
import type { FileInfo } from '../types/file-info.js';
import { FileCategory } from '../types/file-category.js';
import { MetadataCapability } from '../types/metadata-capability.js';

const FIXTURES_DIR = join(__dirname, '__fixtures__');

const createTestFileInfo = (overrides: Partial<FileInfo>): FileInfo => ({
  path: '/test/file.txt',
  name: 'file',
  extension: 'txt',
  fullName: 'file.txt',
  size: 1024,
  createdAt: new Date('2024-01-01'),
  modifiedAt: new Date('2024-01-02'),
  category: FileCategory.OTHER,
  metadataSupported: false,
  metadataCapability: MetadataCapability.BASIC,
  ...overrides,
});

describe('getFileMetadata', () => {
  describe('unsupported file types', () => {
    it('returns unsupported status for files without metadata support', async () => {
      const file = createTestFileInfo({
        metadataSupported: false,
        category: FileCategory.OTHER,
      });

      const result = await getFileMetadata(file);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.extractionStatus).toBe('unsupported');
        expect(result.data.image).toBeNull();
        expect(result.data.pdf).toBeNull();
        expect(result.data.office).toBeNull();
        expect(result.data.extractionError).toBeNull();
      }
    });
  });

  describe('image files', () => {
    it('extracts EXIF metadata from image with metadata', async () => {
      const file = createTestFileInfo({
        path: join(FIXTURES_DIR, 'with-exif.jpg'),
        name: 'with-exif',
        extension: 'jpg',
        fullName: 'with-exif.jpg',
        category: FileCategory.IMAGE,
        metadataSupported: true,
        metadataCapability: MetadataCapability.FULL,
      });

      const result = await getFileMetadata(file);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.extractionStatus).toBe('success');
        expect(result.data.image).not.toBeNull();
        expect(result.data.pdf).toBeNull();
        expect(result.data.office).toBeNull();
      }
    });

    it('extracts empty metadata from image without EXIF', async () => {
      const file = createTestFileInfo({
        path: join(FIXTURES_DIR, 'no-exif.jpg'),
        name: 'no-exif',
        extension: 'jpg',
        fullName: 'no-exif.jpg',
        category: FileCategory.IMAGE,
        metadataSupported: true,
        metadataCapability: MetadataCapability.FULL,
      });

      const result = await getFileMetadata(file);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.extractionStatus).toBe('success');
        expect(result.data.image).not.toBeNull();
        // All image fields should be null for no-exif image
        expect(result.data.image?.dateTaken).toBeNull();
        expect(result.data.image?.cameraMake).toBeNull();
      }
    });
  });

  describe('PDF files', () => {
    it('extracts metadata from PDF with properties', async () => {
      const file = createTestFileInfo({
        path: join(FIXTURES_DIR, 'with-metadata.pdf'),
        name: 'with-metadata',
        extension: 'pdf',
        fullName: 'with-metadata.pdf',
        category: FileCategory.DOCUMENT,
        metadataSupported: true,
        metadataCapability: MetadataCapability.FULL,
      });

      const result = await getFileMetadata(file);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.extractionStatus).toBe('success');
        expect(result.data.pdf).not.toBeNull();
        expect(result.data.pdf?.title).toBeTruthy();
        expect(result.data.image).toBeNull();
        expect(result.data.office).toBeNull();
      }
    });

    it('returns failed status for corrupted PDF', async () => {
      const file = createTestFileInfo({
        path: join(FIXTURES_DIR, 'corrupted.pdf'),
        name: 'corrupted',
        extension: 'pdf',
        fullName: 'corrupted.pdf',
        category: FileCategory.DOCUMENT,
        metadataSupported: true,
        metadataCapability: MetadataCapability.FULL,
      });

      const result = await getFileMetadata(file);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.extractionStatus).toBe('failed');
        expect(result.data.extractionError).toBeTruthy();
        expect(result.data.pdf).toBeNull();
      }
    });
  });

  describe('Office files', () => {
    it('extracts metadata from Word document', async () => {
      const file = createTestFileInfo({
        path: join(FIXTURES_DIR, 'with-metadata.docx'),
        name: 'with-metadata',
        extension: 'docx',
        fullName: 'with-metadata.docx',
        category: FileCategory.DOCUMENT,
        metadataSupported: true,
        metadataCapability: MetadataCapability.FULL,
      });

      const result = await getFileMetadata(file);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.extractionStatus).toBe('success');
        expect(result.data.office).not.toBeNull();
        expect(result.data.office?.title).toBeTruthy();
        expect(result.data.image).toBeNull();
        expect(result.data.pdf).toBeNull();
      }
    });

    it('extracts metadata from Excel spreadsheet', async () => {
      const file = createTestFileInfo({
        path: join(FIXTURES_DIR, 'spreadsheet.xlsx'),
        name: 'spreadsheet',
        extension: 'xlsx',
        fullName: 'spreadsheet.xlsx',
        category: FileCategory.DOCUMENT,
        metadataSupported: true,
        metadataCapability: MetadataCapability.FULL,
      });

      const result = await getFileMetadata(file);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.extractionStatus).toBe('success');
        expect(result.data.office).not.toBeNull();
      }
    });

    it('extracts metadata from PowerPoint presentation', async () => {
      const file = createTestFileInfo({
        path: join(FIXTURES_DIR, 'presentation.pptx'),
        name: 'presentation',
        extension: 'pptx',
        fullName: 'presentation.pptx',
        category: FileCategory.DOCUMENT,
        metadataSupported: true,
        metadataCapability: MetadataCapability.FULL,
      });

      const result = await getFileMetadata(file);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.extractionStatus).toBe('success');
        expect(result.data.office).not.toBeNull();
      }
    });

    it('returns failed status for corrupted Office document', async () => {
      const file = createTestFileInfo({
        path: join(FIXTURES_DIR, 'corrupted.docx'),
        name: 'corrupted',
        extension: 'docx',
        fullName: 'corrupted.docx',
        category: FileCategory.DOCUMENT,
        metadataSupported: true,
        metadataCapability: MetadataCapability.FULL,
      });

      const result = await getFileMetadata(file);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.extractionStatus).toBe('failed');
        expect(result.data.extractionError).toBeTruthy();
      }
    });
  });

  describe('file info preservation', () => {
    it('always includes the original file info', async () => {
      const file = createTestFileInfo({
        path: '/test/photo.jpg',
        name: 'photo',
        extension: 'jpg',
        fullName: 'photo.jpg',
        size: 5000,
        category: FileCategory.OTHER,
        metadataSupported: false,
      });

      const result = await getFileMetadata(file);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.file).toEqual(file);
      }
    });
  });

  describe('error handling', () => {
    it('handles non-existent files gracefully', async () => {
      const file = createTestFileInfo({
        path: '/non/existent/file.jpg',
        name: 'file',
        extension: 'jpg',
        fullName: 'file.jpg',
        category: FileCategory.IMAGE,
        metadataSupported: true,
        metadataCapability: MetadataCapability.FULL,
      });

      const result = await getFileMetadata(file);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.extractionStatus).toBe('failed');
        expect(result.data.extractionError).toBeTruthy();
      }
    });
  });
});
