import { describe, it, expect } from 'vitest';
import { fileInfoSchema, type FileInfo } from './file-info.js';
import { FileCategory } from './file-category.js';
import { MetadataCapability } from './metadata-capability.js';

describe('fileInfoSchema', () => {
  const validFileInfo: FileInfo = {
    path: '/home/user/documents/file.txt',
    name: 'file',
    extension: 'txt',
    fullName: 'file.txt',
    size: 1024,
    createdAt: new Date('2024-01-01'),
    modifiedAt: new Date('2024-01-02'),
    category: FileCategory.DOCUMENT,
    metadataSupported: false,
    metadataCapability: MetadataCapability.BASIC,
  };

  describe('valid inputs', () => {
    it('parses a valid file info object', () => {
      const result = fileInfoSchema.parse(validFileInfo);

      expect(result.path).toBe('/home/user/documents/file.txt');
      expect(result.name).toBe('file');
      expect(result.extension).toBe('txt');
      expect(result.fullName).toBe('file.txt');
      expect(result.size).toBe(1024);
      expect(result.createdAt).toEqual(new Date('2024-01-01'));
      expect(result.modifiedAt).toEqual(new Date('2024-01-02'));
    });

    it('accepts empty extension for files without extension', () => {
      const fileWithoutExt = { ...validFileInfo, extension: '' };
      const result = fileInfoSchema.parse(fileWithoutExt);

      expect(result.extension).toBe('');
    });

    it('accepts zero size for empty files', () => {
      const emptyFile = { ...validFileInfo, size: 0 };
      const result = fileInfoSchema.parse(emptyFile);

      expect(result.size).toBe(0);
    });

    it('accepts optional mimeType', () => {
      const fileWithMime = { ...validFileInfo, mimeType: 'text/plain' };
      const result = fileInfoSchema.parse(fileWithMime);

      expect(result.mimeType).toBe('text/plain');
    });

    it('allows missing mimeType', () => {
      const result = fileInfoSchema.parse(validFileInfo);

      expect(result.mimeType).toBeUndefined();
    });

    it('accepts all valid file categories', () => {
      const categories = [
        FileCategory.IMAGE,
        FileCategory.DOCUMENT,
        FileCategory.DOCUMENT,
        FileCategory.DOCUMENT,
        FileCategory.DOCUMENT,
        FileCategory.OTHER,
      ];

      for (const category of categories) {
        const file = { ...validFileInfo, category };
        const result = fileInfoSchema.parse(file);
        expect(result.category).toBe(category);
      }
    });

    it('accepts metadataSupported true or false', () => {
      const fileWithMetadata = { ...validFileInfo, metadataSupported: true };
      const result = fileInfoSchema.parse(fileWithMetadata);
      expect(result.metadataSupported).toBe(true);

      const fileWithoutMetadata = { ...validFileInfo, metadataSupported: false };
      const result2 = fileInfoSchema.parse(fileWithoutMetadata);
      expect(result2.metadataSupported).toBe(false);
    });

    it('accepts metadataCapability FULL or BASIC', () => {
      const fileWithFull = {
        ...validFileInfo,
        metadataCapability: MetadataCapability.FULL,
      };
      const result = fileInfoSchema.parse(fileWithFull);
      expect(result.metadataCapability).toBe(MetadataCapability.FULL);

      const fileWithBasic = {
        ...validFileInfo,
        metadataCapability: MetadataCapability.BASIC,
      };
      const result2 = fileInfoSchema.parse(fileWithBasic);
      expect(result2.metadataCapability).toBe(MetadataCapability.BASIC);
    });
  });

  describe('invalid inputs', () => {
    it('rejects empty path', () => {
      const invalidFile = { ...validFileInfo, path: '' };

      expect(() => fileInfoSchema.parse(invalidFile)).toThrow('Path cannot be empty');
    });

    it('rejects empty name', () => {
      const invalidFile = { ...validFileInfo, name: '' };

      expect(() => fileInfoSchema.parse(invalidFile)).toThrow('Name cannot be empty');
    });

    it('rejects negative size', () => {
      const invalidFile = { ...validFileInfo, size: -1 };

      expect(() => fileInfoSchema.parse(invalidFile)).toThrow();
    });

    it('rejects non-date createdAt', () => {
      const invalidFile = { ...validFileInfo, createdAt: 'not a date' };

      expect(() => fileInfoSchema.parse(invalidFile)).toThrow();
    });

    it('rejects non-date modifiedAt', () => {
      const invalidFile = { ...validFileInfo, modifiedAt: 'not a date' };

      expect(() => fileInfoSchema.parse(invalidFile)).toThrow();
    });

    it('rejects missing required fields', () => {
      expect(() => fileInfoSchema.parse({})).toThrow();
      expect(() => fileInfoSchema.parse({ path: '/test' })).toThrow();
    });

    it('rejects invalid category', () => {
      const invalidFile = { ...validFileInfo, category: 'invalid' };

      expect(() => fileInfoSchema.parse(invalidFile)).toThrow();
    });

    it('rejects non-boolean metadataSupported', () => {
      const invalidFile = { ...validFileInfo, metadataSupported: 'yes' };

      expect(() => fileInfoSchema.parse(invalidFile)).toThrow();
    });

    it('rejects invalid metadataCapability', () => {
      const invalidFile = { ...validFileInfo, metadataCapability: 'invalid' };

      expect(() => fileInfoSchema.parse(invalidFile)).toThrow();
    });
  });

  describe('safeParse', () => {
    it('returns success for valid input', () => {
      const result = fileInfoSchema.safeParse(validFileInfo);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.path).toBe(validFileInfo.path);
      }
    });

    it('returns error for invalid input', () => {
      const result = fileInfoSchema.safeParse({ path: '' });

      expect(result.success).toBe(false);
    });
  });
});
