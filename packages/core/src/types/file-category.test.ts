import { describe, it, expect } from 'vitest';
import {
  FileCategory,
  EXTENSION_CATEGORIES,
  getCategoryForExtension,
} from './file-category.js';

describe('FileCategory', () => {
  it('defines all expected categories (aligned with Rust)', () => {
    expect(FileCategory.IMAGE).toBe('image');
    expect(FileCategory.DOCUMENT).toBe('document');
    expect(FileCategory.VIDEO).toBe('video');
    expect(FileCategory.AUDIO).toBe('audio');
    expect(FileCategory.ARCHIVE).toBe('archive');
    expect(FileCategory.CODE).toBe('code');
    expect(FileCategory.DATA).toBe('data');
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
      'ico',
      'raw',
      'cr2',
      'nef',
      'arw',
      'dng',
    ])('maps %s to IMAGE category', (ext) => {
      expect(EXTENSION_CATEGORIES[ext]).toBe(FileCategory.IMAGE);
    });
  });

  describe('document extensions', () => {
    it.each(['doc', 'docx', 'txt', 'md', 'rtf', 'odt', 'pdf', 'xls', 'xlsx', 'csv', 'ods', 'ppt', 'pptx', 'odp'])(
      'maps %s to DOCUMENT category',
      (ext) => {
        expect(EXTENSION_CATEGORIES[ext]).toBe(FileCategory.DOCUMENT);
      }
    );
  });

  describe('video extensions', () => {
    it.each(['mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm', 'm4v', 'mpeg', 'mpg'])(
      'maps %s to VIDEO category',
      (ext) => {
        expect(EXTENSION_CATEGORIES[ext]).toBe(FileCategory.VIDEO);
      }
    );
  });

  describe('audio extensions', () => {
    it.each(['mp3', 'wav', 'flac', 'aac', 'ogg', 'wma', 'm4a', 'opus'])(
      'maps %s to AUDIO category',
      (ext) => {
        expect(EXTENSION_CATEGORIES[ext]).toBe(FileCategory.AUDIO);
      }
    );
  });

  describe('archive extensions', () => {
    it.each(['zip', 'tar', 'gz', 'bz2', 'xz', '7z', 'rar', 'iso'])(
      'maps %s to ARCHIVE category',
      (ext) => {
        expect(EXTENSION_CATEGORIES[ext]).toBe(FileCategory.ARCHIVE);
      }
    );
  });

  describe('code extensions', () => {
    it.each(['js', 'ts', 'py', 'rs', 'go', 'java', 'json', 'yaml', 'yml', 'xml', 'html', 'css'])(
      'maps %s to CODE category',
      (ext) => {
        expect(EXTENSION_CATEGORIES[ext]).toBe(FileCategory.CODE);
      }
    );
  });

  describe('data extensions', () => {
    it.each(['db', 'sqlite', 'mdb', 'accdb'])(
      'maps %s to DATA category',
      (ext) => {
        expect(EXTENSION_CATEGORIES[ext]).toBe(FileCategory.DATA);
      }
    );
  });
});

describe('getCategoryForExtension', () => {
  it('returns correct category for known extensions', () => {
    expect(getCategoryForExtension('jpg')).toBe(FileCategory.IMAGE);
    expect(getCategoryForExtension('docx')).toBe(FileCategory.DOCUMENT);
    expect(getCategoryForExtension('pdf')).toBe(FileCategory.DOCUMENT);
    expect(getCategoryForExtension('xlsx')).toBe(FileCategory.DOCUMENT);
    expect(getCategoryForExtension('pptx')).toBe(FileCategory.DOCUMENT);
    expect(getCategoryForExtension('mp4')).toBe(FileCategory.VIDEO);
    expect(getCategoryForExtension('mp3')).toBe(FileCategory.AUDIO);
    expect(getCategoryForExtension('zip')).toBe(FileCategory.ARCHIVE);
    expect(getCategoryForExtension('js')).toBe(FileCategory.CODE);
    expect(getCategoryForExtension('db')).toBe(FileCategory.DATA);
  });

  it('returns OTHER for unknown extensions', () => {
    expect(getCategoryForExtension('xyz')).toBe(FileCategory.OTHER);
    expect(getCategoryForExtension('exe')).toBe(FileCategory.OTHER);
    expect(getCategoryForExtension('dll')).toBe(FileCategory.OTHER);
  });

  it('handles extensions with leading dot', () => {
    expect(getCategoryForExtension('.jpg')).toBe(FileCategory.IMAGE);
    expect(getCategoryForExtension('.pdf')).toBe(FileCategory.DOCUMENT);
    expect(getCategoryForExtension('.mp4')).toBe(FileCategory.VIDEO);
    expect(getCategoryForExtension('.xyz')).toBe(FileCategory.OTHER);
  });

  it('handles case insensitively', () => {
    expect(getCategoryForExtension('JPG')).toBe(FileCategory.IMAGE);
    expect(getCategoryForExtension('PDF')).toBe(FileCategory.DOCUMENT);
    expect(getCategoryForExtension('.DOCX')).toBe(FileCategory.DOCUMENT);
    expect(getCategoryForExtension('MP4')).toBe(FileCategory.VIDEO);
  });

  it('handles empty string', () => {
    expect(getCategoryForExtension('')).toBe(FileCategory.OTHER);
  });
});
