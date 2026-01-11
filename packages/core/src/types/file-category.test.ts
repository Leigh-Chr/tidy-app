import { describe, it, expect } from 'vitest';
import {
  FileCategory,
  EXTENSION_CATEGORIES,
  getCategoryForExtension,
} from './file-category.js';

describe('FileCategory', () => {
  it('defines all expected categories', () => {
    expect(FileCategory.IMAGE).toBe('image');
    expect(FileCategory.DOCUMENT).toBe('document');
    expect(FileCategory.PDF).toBe('pdf');
    expect(FileCategory.SPREADSHEET).toBe('spreadsheet');
    expect(FileCategory.PRESENTATION).toBe('presentation');
    expect(FileCategory.OTHER).toBe('other');
  });
});

describe('EXTENSION_CATEGORIES', () => {
  describe('image extensions', () => {
    it.each([
      'jpg',
      'jpeg',
      'png',
      'gif',
      'webp',
      'heic',
      'heif',
      'bmp',
      'tiff',
      'tif',
      'svg',
    ])('maps %s to IMAGE category', (ext) => {
      expect(EXTENSION_CATEGORIES[ext]).toBe(FileCategory.IMAGE);
    });
  });

  describe('document extensions', () => {
    it.each(['doc', 'docx', 'txt', 'md', 'rtf', 'odt'])(
      'maps %s to DOCUMENT category',
      (ext) => {
        expect(EXTENSION_CATEGORIES[ext]).toBe(FileCategory.DOCUMENT);
      }
    );
  });

  describe('pdf extension', () => {
    it('maps pdf to PDF category', () => {
      expect(EXTENSION_CATEGORIES['pdf']).toBe(FileCategory.PDF);
    });
  });

  describe('spreadsheet extensions', () => {
    it.each(['xls', 'xlsx', 'csv', 'ods'])(
      'maps %s to SPREADSHEET category',
      (ext) => {
        expect(EXTENSION_CATEGORIES[ext]).toBe(FileCategory.SPREADSHEET);
      }
    );
  });

  describe('presentation extensions', () => {
    it.each(['ppt', 'pptx', 'odp'])(
      'maps %s to PRESENTATION category',
      (ext) => {
        expect(EXTENSION_CATEGORIES[ext]).toBe(FileCategory.PRESENTATION);
      }
    );
  });
});

describe('getCategoryForExtension', () => {
  it('returns correct category for known extensions', () => {
    expect(getCategoryForExtension('jpg')).toBe(FileCategory.IMAGE);
    expect(getCategoryForExtension('docx')).toBe(FileCategory.DOCUMENT);
    expect(getCategoryForExtension('pdf')).toBe(FileCategory.PDF);
    expect(getCategoryForExtension('xlsx')).toBe(FileCategory.SPREADSHEET);
    expect(getCategoryForExtension('pptx')).toBe(FileCategory.PRESENTATION);
  });

  it('returns OTHER for unknown extensions', () => {
    expect(getCategoryForExtension('xyz')).toBe(FileCategory.OTHER);
    expect(getCategoryForExtension('exe')).toBe(FileCategory.OTHER);
    expect(getCategoryForExtension('zip')).toBe(FileCategory.OTHER);
  });

  it('handles extensions with leading dot', () => {
    expect(getCategoryForExtension('.jpg')).toBe(FileCategory.IMAGE);
    expect(getCategoryForExtension('.pdf')).toBe(FileCategory.PDF);
    expect(getCategoryForExtension('.xyz')).toBe(FileCategory.OTHER);
  });

  it('handles case insensitively', () => {
    expect(getCategoryForExtension('JPG')).toBe(FileCategory.IMAGE);
    expect(getCategoryForExtension('PDF')).toBe(FileCategory.PDF);
    expect(getCategoryForExtension('.DOCX')).toBe(FileCategory.DOCUMENT);
  });

  it('handles empty string', () => {
    expect(getCategoryForExtension('')).toBe(FileCategory.OTHER);
  });
});
