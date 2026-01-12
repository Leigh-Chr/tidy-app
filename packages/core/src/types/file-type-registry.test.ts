import { describe, it, expect } from 'vitest';
import {
  FILE_TYPE_REGISTRY,
  getFileTypeInfo,
  getMetadataCapability,
  isMetadataSupportedByRegistry,
  getSupportDescription,
  getMimeType,
  getFullMetadataExtensions,
} from './file-type-registry.js';
import { MetadataCapability } from './metadata-capability.js';
import { FileCategory } from './file-category.js';

describe('FILE_TYPE_REGISTRY', () => {
  it('contains entries for common image formats', () => {
    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif'];
    for (const ext of imageExts) {
      const info = getFileTypeInfo(ext);
      expect(info).toBeDefined();
      expect(info?.category).toBe(FileCategory.IMAGE);
    }
  });

  it('contains entries for PDF (categorized as DOCUMENT)', () => {
    const info = getFileTypeInfo('pdf');
    expect(info).toBeDefined();
    expect(info?.category).toBe(FileCategory.DOCUMENT);
  });

  it('contains entries for Office documents (all categorized as DOCUMENT)', () => {
    expect(getFileTypeInfo('docx')?.category).toBe(FileCategory.DOCUMENT);
    expect(getFileTypeInfo('xlsx')?.category).toBe(FileCategory.DOCUMENT);
    expect(getFileTypeInfo('pptx')?.category).toBe(FileCategory.DOCUMENT);
  });

  it('contains entries for video formats', () => {
    const videoExts = ['mp4', 'avi', 'mkv', 'mov', 'webm'];
    for (const ext of videoExts) {
      const info = getFileTypeInfo(ext);
      expect(info).toBeDefined();
      expect(info?.category).toBe(FileCategory.VIDEO);
    }
  });

  it('contains entries for audio formats', () => {
    const audioExts = ['mp3', 'wav', 'flac', 'ogg', 'm4a'];
    for (const ext of audioExts) {
      const info = getFileTypeInfo(ext);
      expect(info).toBeDefined();
      expect(info?.category).toBe(FileCategory.AUDIO);
    }
  });

  it('contains entries for archive formats', () => {
    const archiveExts = ['zip', 'tar', 'gz', '7z', 'rar'];
    for (const ext of archiveExts) {
      const info = getFileTypeInfo(ext);
      expect(info).toBeDefined();
      expect(info?.category).toBe(FileCategory.ARCHIVE);
    }
  });

  it('contains entries for code formats', () => {
    const codeExts = ['js', 'ts', 'py', 'rs', 'json', 'yaml', 'html', 'css'];
    for (const ext of codeExts) {
      const info = getFileTypeInfo(ext);
      expect(info).toBeDefined();
      expect(info?.category).toBe(FileCategory.CODE);
    }
  });

  it('contains entries for data formats', () => {
    const dataExts = ['db', 'sqlite'];
    for (const ext of dataExts) {
      const info = getFileTypeInfo(ext);
      expect(info).toBeDefined();
      expect(info?.category).toBe(FileCategory.DATA);
    }
  });

  it('has no duplicate extensions across entries', () => {
    const allExtensions: string[] = [];
    for (const info of FILE_TYPE_REGISTRY) {
      for (const ext of info.extensions) {
        expect(allExtensions).not.toContain(ext);
        allExtensions.push(ext);
      }
    }
  });

  it('all entries have valid metadata capability', () => {
    for (const info of FILE_TYPE_REGISTRY) {
      expect([MetadataCapability.FULL, MetadataCapability.BASIC]).toContain(
        info.metadataCapability
      );
    }
  });

  it('all entries have at least one extension and mime type', () => {
    for (const info of FILE_TYPE_REGISTRY) {
      expect(info.extensions.length).toBeGreaterThan(0);
      expect(info.mimeTypes.length).toBeGreaterThan(0);
    }
  });
});

describe('getFileTypeInfo', () => {
  it('returns info for known extensions', () => {
    const info = getFileTypeInfo('jpg');
    expect(info).toBeDefined();
    expect(info?.description).toBe('JPEG Image');
    expect(info?.extensions).toContain('jpg');
    expect(info?.extensions).toContain('jpeg');
  });

  it('handles case insensitivity', () => {
    expect(getFileTypeInfo('JPG')).toEqual(getFileTypeInfo('jpg'));
    expect(getFileTypeInfo('Pdf')).toEqual(getFileTypeInfo('pdf'));
    expect(getFileTypeInfo('DOCX')).toEqual(getFileTypeInfo('docx'));
  });

  it('handles leading dot', () => {
    expect(getFileTypeInfo('.jpg')).toEqual(getFileTypeInfo('jpg'));
    expect(getFileTypeInfo('.PDF')).toEqual(getFileTypeInfo('pdf'));
  });

  it('returns undefined for unknown extensions', () => {
    expect(getFileTypeInfo('xyz')).toBeUndefined();
    expect(getFileTypeInfo('zzz')).toBeUndefined();
    expect(getFileTypeInfo('')).toBeUndefined();
  });

  it('returns correct info for shared extensions', () => {
    // jpeg and jpg should return same info object
    const jpgInfo = getFileTypeInfo('jpg');
    const jpegInfo = getFileTypeInfo('jpeg');
    expect(jpgInfo).toEqual(jpegInfo);
    expect(jpgInfo?.extensions).toContain('jpg');
    expect(jpgInfo?.extensions).toContain('jpeg');
  });
});

describe('getMetadataCapability', () => {
  it('returns FULL for supported image types', () => {
    expect(getMetadataCapability('jpg')).toBe(MetadataCapability.FULL);
    expect(getMetadataCapability('jpeg')).toBe(MetadataCapability.FULL);
    expect(getMetadataCapability('png')).toBe(MetadataCapability.FULL);
    expect(getMetadataCapability('heic')).toBe(MetadataCapability.FULL);
    expect(getMetadataCapability('webp')).toBe(MetadataCapability.FULL);
    expect(getMetadataCapability('gif')).toBe(MetadataCapability.FULL);
    expect(getMetadataCapability('tiff')).toBe(MetadataCapability.FULL);
  });

  it('returns FULL for PDF', () => {
    expect(getMetadataCapability('pdf')).toBe(MetadataCapability.FULL);
  });

  it('returns FULL for modern Office formats', () => {
    expect(getMetadataCapability('docx')).toBe(MetadataCapability.FULL);
    expect(getMetadataCapability('xlsx')).toBe(MetadataCapability.FULL);
    expect(getMetadataCapability('pptx')).toBe(MetadataCapability.FULL);
  });

  it('returns BASIC for legacy Office formats', () => {
    expect(getMetadataCapability('doc')).toBe(MetadataCapability.BASIC);
    expect(getMetadataCapability('xls')).toBe(MetadataCapability.BASIC);
    expect(getMetadataCapability('ppt')).toBe(MetadataCapability.BASIC);
  });

  it('returns BASIC for text-based formats', () => {
    expect(getMetadataCapability('txt')).toBe(MetadataCapability.BASIC);
    expect(getMetadataCapability('md')).toBe(MetadataCapability.BASIC);
    expect(getMetadataCapability('json')).toBe(MetadataCapability.BASIC);
    expect(getMetadataCapability('xml')).toBe(MetadataCapability.BASIC);
    expect(getMetadataCapability('csv')).toBe(MetadataCapability.BASIC);
  });

  it('returns BASIC for video/audio/archive formats', () => {
    expect(getMetadataCapability('mp4')).toBe(MetadataCapability.BASIC);
    expect(getMetadataCapability('mp3')).toBe(MetadataCapability.BASIC);
    expect(getMetadataCapability('zip')).toBe(MetadataCapability.BASIC);
  });

  it('returns BASIC for unknown extensions', () => {
    expect(getMetadataCapability('xyz')).toBe(MetadataCapability.BASIC);
    expect(getMetadataCapability('unknown')).toBe(MetadataCapability.BASIC);
    expect(getMetadataCapability('')).toBe(MetadataCapability.BASIC);
  });

  it('handles case insensitivity', () => {
    expect(getMetadataCapability('JPG')).toBe(MetadataCapability.FULL);
    expect(getMetadataCapability('Pdf')).toBe(MetadataCapability.FULL);
  });

  it('handles leading dot', () => {
    expect(getMetadataCapability('.jpg')).toBe(MetadataCapability.FULL);
    expect(getMetadataCapability('.txt')).toBe(MetadataCapability.BASIC);
  });
});

describe('isMetadataSupportedByRegistry', () => {
  it('returns true for supported types', () => {
    expect(isMetadataSupportedByRegistry('jpg')).toBe(true);
    expect(isMetadataSupportedByRegistry('pdf')).toBe(true);
    expect(isMetadataSupportedByRegistry('docx')).toBe(true);
    expect(isMetadataSupportedByRegistry('xlsx')).toBe(true);
    expect(isMetadataSupportedByRegistry('pptx')).toBe(true);
  });

  it('returns false for unsupported types', () => {
    expect(isMetadataSupportedByRegistry('txt')).toBe(false);
    expect(isMetadataSupportedByRegistry('doc')).toBe(false);
    expect(isMetadataSupportedByRegistry('xls')).toBe(false);
    expect(isMetadataSupportedByRegistry('exe')).toBe(false);
    expect(isMetadataSupportedByRegistry('mp4')).toBe(false);
    expect(isMetadataSupportedByRegistry('zip')).toBe(false);
  });

  it('returns false for unknown extensions', () => {
    expect(isMetadataSupportedByRegistry('xyz')).toBe(false);
    expect(isMetadataSupportedByRegistry('')).toBe(false);
  });
});

describe('getSupportDescription', () => {
  it('returns "Full metadata supported" for supported types', () => {
    expect(getSupportDescription('jpg')).toBe('Full metadata supported');
    expect(getSupportDescription('pdf')).toBe('Full metadata supported');
    expect(getSupportDescription('docx')).toBe('Full metadata supported');
  });

  it('returns "Basic info only" for unsupported types', () => {
    expect(getSupportDescription('txt')).toBe('Basic info only');
    expect(getSupportDescription('doc')).toBe('Basic info only');
    expect(getSupportDescription('xyz')).toBe('Basic info only');
    expect(getSupportDescription('mp4')).toBe('Basic info only');
  });

  it('handles case insensitivity', () => {
    expect(getSupportDescription('JPG')).toBe('Full metadata supported');
    expect(getSupportDescription('TXT')).toBe('Basic info only');
  });
});

describe('getMimeType', () => {
  it('returns correct MIME types for images', () => {
    expect(getMimeType('jpg')).toBe('image/jpeg');
    expect(getMimeType('png')).toBe('image/png');
    expect(getMimeType('gif')).toBe('image/gif');
    expect(getMimeType('webp')).toBe('image/webp');
  });

  it('returns correct MIME type for PDF', () => {
    expect(getMimeType('pdf')).toBe('application/pdf');
  });

  it('returns correct MIME types for Office documents', () => {
    expect(getMimeType('docx')).toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    expect(getMimeType('xlsx')).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    expect(getMimeType('pptx')).toBe(
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    );
  });

  it('returns correct MIME types for video/audio', () => {
    expect(getMimeType('mp4')).toBe('video/mp4');
    expect(getMimeType('mp3')).toBe('audio/mpeg');
    expect(getMimeType('zip')).toBe('application/zip');
  });

  it('returns correct MIME types for text files', () => {
    expect(getMimeType('txt')).toBe('text/plain');
    expect(getMimeType('json')).toBe('application/json');
    expect(getMimeType('csv')).toBe('text/csv');
  });

  it('returns undefined for unknown extensions', () => {
    expect(getMimeType('xyz')).toBeUndefined();
    expect(getMimeType('')).toBeUndefined();
  });

  it('handles case insensitivity', () => {
    expect(getMimeType('JPG')).toBe('image/jpeg');
    expect(getMimeType('PDF')).toBe('application/pdf');
  });
});

describe('getFullMetadataExtensions', () => {
  it('returns array of extensions', () => {
    const extensions = getFullMetadataExtensions();
    expect(Array.isArray(extensions)).toBe(true);
    expect(extensions.length).toBeGreaterThan(0);
  });

  it('includes all image formats with EXIF support', () => {
    const extensions = getFullMetadataExtensions();
    expect(extensions).toContain('jpg');
    expect(extensions).toContain('jpeg');
    expect(extensions).toContain('png');
    expect(extensions).toContain('heic');
    expect(extensions).toContain('webp');
    expect(extensions).toContain('gif');
    expect(extensions).toContain('tiff');
  });

  it('includes PDF', () => {
    const extensions = getFullMetadataExtensions();
    expect(extensions).toContain('pdf');
  });

  it('includes modern Office formats', () => {
    const extensions = getFullMetadataExtensions();
    expect(extensions).toContain('docx');
    expect(extensions).toContain('xlsx');
    expect(extensions).toContain('pptx');
  });

  it('does not include basic-only formats', () => {
    const extensions = getFullMetadataExtensions();
    expect(extensions).not.toContain('txt');
    expect(extensions).not.toContain('doc');
    expect(extensions).not.toContain('xls');
    expect(extensions).not.toContain('bmp');
    expect(extensions).not.toContain('svg');
    expect(extensions).not.toContain('mp4');
    expect(extensions).not.toContain('mp3');
    expect(extensions).not.toContain('zip');
  });
});

describe('Edge Cases', () => {
  it('handles empty string extension', () => {
    expect(getFileTypeInfo('')).toBeUndefined();
    expect(getMetadataCapability('')).toBe(MetadataCapability.BASIC);
    expect(isMetadataSupportedByRegistry('')).toBe(false);
    expect(getSupportDescription('')).toBe('Basic info only');
    expect(getMimeType('')).toBeUndefined();
  });

  it('handles extension with only dot', () => {
    expect(getFileTypeInfo('.')).toBeUndefined();
    expect(getMetadataCapability('.')).toBe(MetadataCapability.BASIC);
  });

  it('handles special characters in extension', () => {
    expect(getFileTypeInfo('jpg!')).toBeUndefined();
    expect(getMetadataCapability('pdf?')).toBe(MetadataCapability.BASIC);
  });

  it('handles very long extension', () => {
    const longExt = 'a'.repeat(100);
    expect(getFileTypeInfo(longExt)).toBeUndefined();
    expect(getMetadataCapability(longExt)).toBe(MetadataCapability.BASIC);
  });
});
