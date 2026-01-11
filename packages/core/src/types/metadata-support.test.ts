import { describe, it, expect } from 'vitest';
import {
  METADATA_SUPPORTED_EXTENSIONS,
  isMetadataSupported,
} from './metadata-support.js';

describe('METADATA_SUPPORTED_EXTENSIONS', () => {
  describe('image extensions with EXIF support', () => {
    it.each(['jpg', 'jpeg', 'png', 'heic', 'heif', 'webp', 'gif', 'tiff', 'tif'])(
      'includes %s',
      (ext) => {
        expect(METADATA_SUPPORTED_EXTENSIONS.has(ext)).toBe(true);
      }
    );
  });

  describe('PDF extension', () => {
    it('includes pdf', () => {
      expect(METADATA_SUPPORTED_EXTENSIONS.has('pdf')).toBe(true);
    });
  });

  describe('Office document extensions', () => {
    it.each(['docx', 'xlsx', 'pptx'])('includes %s', (ext) => {
      expect(METADATA_SUPPORTED_EXTENSIONS.has(ext)).toBe(true);
    });
  });

  describe('non-supported extensions', () => {
    it.each(['txt', 'doc', 'xls', 'ppt', 'svg', 'bmp', 'mp3', 'mp4'])(
      'does not include %s',
      (ext) => {
        expect(METADATA_SUPPORTED_EXTENSIONS.has(ext)).toBe(false);
      }
    );
  });
});

describe('isMetadataSupported', () => {
  describe('supported extensions', () => {
    it('returns true for image files with EXIF support', () => {
      expect(isMetadataSupported('jpg')).toBe(true);
      expect(isMetadataSupported('jpeg')).toBe(true);
      expect(isMetadataSupported('png')).toBe(true);
      expect(isMetadataSupported('heic')).toBe(true);
    });

    it('returns true for PDF files', () => {
      expect(isMetadataSupported('pdf')).toBe(true);
    });

    it('returns true for modern Office documents', () => {
      expect(isMetadataSupported('docx')).toBe(true);
      expect(isMetadataSupported('xlsx')).toBe(true);
      expect(isMetadataSupported('pptx')).toBe(true);
    });
  });

  describe('unsupported extensions', () => {
    it('returns false for plain text files', () => {
      expect(isMetadataSupported('txt')).toBe(false);
      expect(isMetadataSupported('md')).toBe(false);
    });

    it('returns false for legacy Office formats', () => {
      expect(isMetadataSupported('doc')).toBe(false);
      expect(isMetadataSupported('xls')).toBe(false);
      expect(isMetadataSupported('ppt')).toBe(false);
    });

    it('returns false for unknown extensions', () => {
      expect(isMetadataSupported('xyz')).toBe(false);
      expect(isMetadataSupported('exe')).toBe(false);
    });
  });

  describe('extension normalization', () => {
    it('handles extensions with leading dot', () => {
      expect(isMetadataSupported('.jpg')).toBe(true);
      expect(isMetadataSupported('.PDF')).toBe(true);
      expect(isMetadataSupported('.txt')).toBe(false);
    });

    it('handles case insensitively', () => {
      expect(isMetadataSupported('JPG')).toBe(true);
      expect(isMetadataSupported('PDF')).toBe(true);
      expect(isMetadataSupported('DOCX')).toBe(true);
    });

    it('handles empty string', () => {
      expect(isMetadataSupported('')).toBe(false);
    });
  });
});
