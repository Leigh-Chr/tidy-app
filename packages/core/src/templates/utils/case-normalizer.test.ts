/**
 * @fileoverview Tests for case normalization utilities
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeCase,
  normalizeFilename,
  normalizeFolderName,
  normalizePath,
  DEFAULT_CASE_STYLE,
} from './case-normalizer.js';

describe('normalizeCase', () => {
  describe('none style', () => {
    it('should return input unchanged', () => {
      const result = normalizeCase('My Document Title', 'none');
      expect(result.normalized).toBe('My Document Title');
      expect(result.changed).toBe(false);
    });
  });

  describe('lowercase style', () => {
    it('should convert to lowercase with spaces', () => {
      const result = normalizeCase('My Document Title', 'lowercase');
      expect(result.normalized).toBe('my document title');
    });

    it('should handle already lowercase', () => {
      const result = normalizeCase('already lowercase', 'lowercase');
      expect(result.normalized).toBe('already lowercase');
    });
  });

  describe('uppercase style', () => {
    it('should convert to uppercase with spaces', () => {
      const result = normalizeCase('My Document Title', 'uppercase');
      expect(result.normalized).toBe('MY DOCUMENT TITLE');
    });
  });

  describe('capitalize style', () => {
    it('should capitalize first word only', () => {
      const result = normalizeCase('my document title', 'capitalize');
      expect(result.normalized).toBe('My document title');
    });
  });

  describe('title-case style', () => {
    it('should capitalize each word', () => {
      const result = normalizeCase('my document title', 'title-case');
      expect(result.normalized).toBe('My Document Title');
    });

    it('should handle already title cased', () => {
      const result = normalizeCase('Already Title Cased', 'title-case');
      expect(result.normalized).toBe('Already Title Cased');
    });
  });

  describe('kebab-case style', () => {
    it('should convert spaces to hyphens and lowercase', () => {
      const result = normalizeCase('My Document Title', 'kebab-case');
      expect(result.normalized).toBe('my-document-title');
    });

    it('should convert underscores to hyphens', () => {
      const result = normalizeCase('my_document_title', 'kebab-case');
      expect(result.normalized).toBe('my-document-title');
    });

    it('should handle camelCase input', () => {
      const result = normalizeCase('myDocumentTitle', 'kebab-case');
      expect(result.normalized).toBe('my-document-title');
    });

    it('should handle PascalCase input', () => {
      const result = normalizeCase('MyDocumentTitle', 'kebab-case');
      expect(result.normalized).toBe('my-document-title');
    });

    it('should handle mixed formats', () => {
      const result = normalizeCase('My_Document Title-Name', 'kebab-case');
      expect(result.normalized).toBe('my-document-title-name');
    });

    it('should handle already kebab-cased', () => {
      const result = normalizeCase('already-kebab-cased', 'kebab-case');
      expect(result.normalized).toBe('already-kebab-cased');
    });
  });

  describe('snake_case style', () => {
    it('should convert spaces to underscores and lowercase', () => {
      const result = normalizeCase('My Document Title', 'snake_case');
      expect(result.normalized).toBe('my_document_title');
    });

    it('should convert hyphens to underscores', () => {
      const result = normalizeCase('my-document-title', 'snake_case');
      expect(result.normalized).toBe('my_document_title');
    });

    it('should handle camelCase input', () => {
      const result = normalizeCase('myDocumentTitle', 'snake_case');
      expect(result.normalized).toBe('my_document_title');
    });
  });

  describe('camelCase style', () => {
    it('should convert to camelCase', () => {
      const result = normalizeCase('My Document Title', 'camelCase');
      expect(result.normalized).toBe('myDocumentTitle');
    });

    it('should handle kebab-case input', () => {
      const result = normalizeCase('my-document-title', 'camelCase');
      expect(result.normalized).toBe('myDocumentTitle');
    });

    it('should handle snake_case input', () => {
      const result = normalizeCase('my_document_title', 'camelCase');
      expect(result.normalized).toBe('myDocumentTitle');
    });
  });

  describe('PascalCase style', () => {
    it('should convert to PascalCase', () => {
      const result = normalizeCase('My Document Title', 'PascalCase');
      expect(result.normalized).toBe('MyDocumentTitle');
    });

    it('should handle kebab-case input', () => {
      const result = normalizeCase('my-document-title', 'PascalCase');
      expect(result.normalized).toBe('MyDocumentTitle');
    });

    it('should handle snake_case input', () => {
      const result = normalizeCase('my_document_title', 'PascalCase');
      expect(result.normalized).toBe('MyDocumentTitle');
    });
  });

  describe('edge cases', () => {
    it('should handle empty string', () => {
      const result = normalizeCase('', 'kebab-case');
      expect(result.normalized).toBe('');
      expect(result.changed).toBe(false);
    });

    it('should handle single word', () => {
      const result = normalizeCase('Document', 'kebab-case');
      expect(result.normalized).toBe('document');
    });

    it('should handle numbers', () => {
      const result = normalizeCase('Document 2024', 'kebab-case');
      expect(result.normalized).toBe('document-2024');
    });

    it('should handle consecutive separators', () => {
      const result = normalizeCase('my  document--title', 'kebab-case');
      expect(result.normalized).toBe('my-document-title');
    });
  });
});

describe('normalizeFilename', () => {
  it('should normalize filename and lowercase extension', () => {
    const result = normalizeFilename('My Document.PDF', 'kebab-case');
    expect(result).toBe('my-document.pdf');
  });

  it('should handle mixed case extension', () => {
    const result = normalizeFilename('Photo.JPEG', 'kebab-case');
    expect(result).toBe('photo.jpeg');
  });

  it('should preserve extension when style is none', () => {
    const result = normalizeFilename('My Document.PDF', 'none');
    expect(result).toBe('My Document.PDF');
  });

  it('should handle files without extension', () => {
    const result = normalizeFilename('README', 'kebab-case');
    expect(result).toBe('readme');
  });

  it('should handle hidden files (starting with dot)', () => {
    const result = normalizeFilename('.gitignore', 'kebab-case');
    // Hidden files - the dot is at position 0, no extension
    expect(result).toBe('.gitignore');
  });

  it('should handle multiple dots in filename', () => {
    const result = normalizeFilename('My.Document.Name.pdf', 'kebab-case');
    expect(result).toBe('my-document-name.pdf');
  });

  it('should handle camelCase filename', () => {
    const result = normalizeFilename('myDocumentName.txt', 'kebab-case');
    expect(result).toBe('my-document-name.txt');
  });

  it('should handle underscore filename', () => {
    const result = normalizeFilename('my_document_name.txt', 'kebab-case');
    expect(result).toBe('my-document-name.txt');
  });
});

describe('normalizeFolderName', () => {
  it('should normalize folder name', () => {
    const result = normalizeFolderName('My Documents', 'kebab-case');
    expect(result).toBe('my-documents');
  });

  it('should handle underscore folder name', () => {
    const result = normalizeFolderName('my_documents', 'kebab-case');
    expect(result).toBe('my-documents');
  });

  it('should handle camelCase folder name', () => {
    const result = normalizeFolderName('myDocuments', 'kebab-case');
    expect(result).toBe('my-documents');
  });

  it('should preserve folder name when style is none', () => {
    const result = normalizeFolderName('My Documents', 'none');
    expect(result).toBe('My Documents');
  });
});

describe('normalizePath', () => {
  it('should normalize each path segment', () => {
    const result = normalizePath('My Documents/Photos/Vacation', 'kebab-case');
    expect(result).toBe('my-documents/photos/vacation');
  });

  it('should handle mixed case segments', () => {
    const result = normalizePath('myDocuments/My_Photos/VacationTrip', 'kebab-case');
    expect(result).toBe('my-documents/my-photos/vacation-trip');
  });

  it('should preserve leading slash', () => {
    const result = normalizePath('/My Documents/Photos', 'kebab-case');
    expect(result).toBe('/my-documents/photos');
  });

  it('should preserve trailing slash', () => {
    const result = normalizePath('My Documents/Photos/', 'kebab-case');
    expect(result).toBe('my-documents/photos/');
  });

  it('should return unchanged when style is none', () => {
    const result = normalizePath('My Documents/Photos', 'none');
    expect(result).toBe('My Documents/Photos');
  });
});

describe('DEFAULT_CASE_STYLE', () => {
  it('should be kebab-case', () => {
    expect(DEFAULT_CASE_STYLE).toBe('kebab-case');
  });
});
