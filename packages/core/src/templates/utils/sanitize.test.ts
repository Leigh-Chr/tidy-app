import { describe, it, expect } from 'vitest';
import { sanitizeFilename, isValidFilename } from './sanitize.js';

describe('sanitizeFilename', () => {
  describe('basic functionality', () => {
    it('returns empty string for empty input', () => {
      expect(sanitizeFilename('')).toBe('');
    });

    it('keeps simple valid filenames unchanged', () => {
      expect(sanitizeFilename('document')).toBe('document');
      expect(sanitizeFilename('photo_2024')).toBe('photo_2024');
    });

    it('preserves alphanumeric characters', () => {
      expect(sanitizeFilename('Test123')).toBe('Test123');
    });
  });

  describe('invalid character handling', () => {
    it('replaces forward slash with underscore', () => {
      expect(sanitizeFilename('Q4/2024')).toBe('Q4_2024');
    });

    it('replaces backslash with underscore', () => {
      expect(sanitizeFilename('path\\file')).toBe('path_file');
    });

    it('replaces colon with underscore', () => {
      expect(sanitizeFilename('Report: Final')).toBe('Report_Final');
    });

    it('replaces double quotes with underscore', () => {
      expect(sanitizeFilename('The "Best" File')).toBe('The_Best_File');
    });

    it('replaces angle brackets with underscore', () => {
      expect(sanitizeFilename('<draft>')).toBe('draft');
    });

    it('replaces pipe with underscore', () => {
      expect(sanitizeFilename('this|that')).toBe('this_that');
    });

    it('replaces question mark with underscore', () => {
      expect(sanitizeFilename('what?')).toBe('what');
    });

    it('replaces asterisk with underscore', () => {
      expect(sanitizeFilename('star*')).toBe('star');
    });

    it('handles multiple invalid characters', () => {
      expect(sanitizeFilename('Report: Q4/2024 <draft>')).toBe(
        'Report_Q4_2024_draft'
      );
    });
  });

  describe('whitespace handling', () => {
    it('replaces spaces with underscores', () => {
      expect(sanitizeFilename('hello world')).toBe('hello_world');
    });

    it('collapses multiple spaces into single underscore', () => {
      expect(sanitizeFilename('hello   world')).toBe('hello_world');
    });

    it('trims leading and trailing spaces', () => {
      expect(sanitizeFilename('  hello  ')).toBe('hello');
    });

    it('collapses multiple underscores into single underscore', () => {
      expect(sanitizeFilename('hello___world')).toBe('hello_world');
    });

    it('collapses multiple dashes into single underscore', () => {
      expect(sanitizeFilename('hello---world')).toBe('hello_world');
    });

    it('removes leading underscores', () => {
      expect(sanitizeFilename('___hello')).toBe('hello');
    });

    it('removes trailing underscores', () => {
      expect(sanitizeFilename('hello___')).toBe('hello');
    });
  });

  describe('control character handling', () => {
    it('removes null character', () => {
      expect(sanitizeFilename('hello\u0000world')).toBe('hello_world');
    });

    it('removes other control characters', () => {
      expect(sanitizeFilename('hello\u001Fworld')).toBe('hello_world');
    });
  });

  describe('length handling', () => {
    it('truncates very long filenames', () => {
      const longName = 'a'.repeat(250);
      const result = sanitizeFilename(longName);
      expect(result.length).toBeLessThanOrEqual(200);
    });

    it('tries to truncate at word boundary', () => {
      const longName =
        'this_is_a_very_long_filename_' + 'word_'.repeat(40) + 'end';
      const result = sanitizeFilename(longName);
      // Should truncate at underscore rather than mid-word
      expect(result.length).toBeLessThanOrEqual(200);
      expect(result).not.toMatch(/_$/);
    });
  });

  describe('real-world examples', () => {
    it('handles PDF document titles', () => {
      // Parentheses are valid in filenames, so they are preserved
      expect(sanitizeFilename('Annual Report (2024) - Final.pdf')).toBe(
        'Annual_Report_(2024)_Final.pdf'
      );
    });

    it('handles camera make/model', () => {
      expect(sanitizeFilename('Canon EOS R5')).toBe('Canon_EOS_R5');
    });

    it('handles author names with special characters', () => {
      expect(sanitizeFilename("John O'Brien")).toBe("John_O'Brien");
    });

    it('handles GPS coordinates', () => {
      expect(sanitizeFilename('48.8566N_2.3522E')).toBe('48.8566N_2.3522E');
    });

    it('handles mixed language text', () => {
      expect(sanitizeFilename('文档_Document')).toBe('文档_Document');
    });
  });
});

describe('isValidFilename', () => {
  describe('valid filenames', () => {
    it('accepts simple filenames', () => {
      expect(isValidFilename('document.pdf')).toBe(true);
      expect(isValidFilename('photo_2024.jpg')).toBe(true);
    });

    it('accepts filenames with underscores', () => {
      expect(isValidFilename('my_file_name.txt')).toBe(true);
    });

    it('accepts filenames with dashes', () => {
      expect(isValidFilename('my-file-name.txt')).toBe(true);
    });

    it('accepts filenames without extension', () => {
      expect(isValidFilename('README')).toBe(true);
    });
  });

  describe('invalid filenames', () => {
    it('rejects empty string', () => {
      expect(isValidFilename('')).toBe(false);
    });

    it('rejects filenames with colon', () => {
      expect(isValidFilename('file:name.txt')).toBe(false);
    });

    it('rejects filenames with forward slash', () => {
      expect(isValidFilename('path/file.txt')).toBe(false);
    });

    it('rejects filenames with backslash', () => {
      expect(isValidFilename('path\\file.txt')).toBe(false);
    });

    it('rejects filenames with angle brackets', () => {
      expect(isValidFilename('<file>.txt')).toBe(false);
    });

    it('rejects filenames with double quotes', () => {
      expect(isValidFilename('"file".txt')).toBe(false);
    });

    it('rejects filenames with pipe', () => {
      expect(isValidFilename('file|name.txt')).toBe(false);
    });

    it('rejects filenames with question mark', () => {
      expect(isValidFilename('file?.txt')).toBe(false);
    });

    it('rejects filenames with asterisk', () => {
      expect(isValidFilename('file*.txt')).toBe(false);
    });
  });

  describe('Windows reserved names', () => {
    it('rejects CON', () => {
      expect(isValidFilename('CON')).toBe(false);
      expect(isValidFilename('con')).toBe(false);
      expect(isValidFilename('Con')).toBe(false);
    });

    it('rejects PRN', () => {
      expect(isValidFilename('PRN')).toBe(false);
    });

    it('rejects AUX', () => {
      expect(isValidFilename('AUX')).toBe(false);
    });

    it('rejects NUL', () => {
      expect(isValidFilename('NUL')).toBe(false);
    });

    it('rejects COM1-COM9', () => {
      expect(isValidFilename('COM1')).toBe(false);
      expect(isValidFilename('com9')).toBe(false);
    });

    it('rejects LPT1-LPT9', () => {
      expect(isValidFilename('LPT1')).toBe(false);
      expect(isValidFilename('lpt9')).toBe(false);
    });

    it('rejects reserved names with extension', () => {
      expect(isValidFilename('CON.txt')).toBe(false);
      expect(isValidFilename('NUL.pdf')).toBe(false);
    });

    it('accepts filenames containing reserved names as substring', () => {
      expect(isValidFilename('CONTACT.txt')).toBe(true);
      expect(isValidFilename('AUXILIARY.txt')).toBe(true);
    });
  });

  describe('leading/trailing characters', () => {
    it('rejects filenames starting with dot', () => {
      expect(isValidFilename('.hidden')).toBe(false);
    });

    it('rejects filenames starting with space', () => {
      expect(isValidFilename(' file.txt')).toBe(false);
    });

    it('rejects filenames ending with dot', () => {
      expect(isValidFilename('file.')).toBe(false);
    });

    it('rejects filenames ending with space', () => {
      expect(isValidFilename('file.txt ')).toBe(false);
    });
  });

  describe('length limits', () => {
    it('accepts filename at max length', () => {
      const name = 'a'.repeat(200);
      expect(isValidFilename(name)).toBe(true);
    });

    it('rejects filename exceeding max length', () => {
      const name = 'a'.repeat(201);
      expect(isValidFilename(name)).toBe(false);
    });
  });
});
