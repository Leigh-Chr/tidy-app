/**
 * @fileoverview Unit tests for glob pattern matcher - Story 7.2
 */

import { describe, expect, it } from 'vitest';
import {
  matchGlob,
  isGlobMatch,
  filterByGlob,
  expandBraces,
  compileGlobPattern,
} from './glob-matcher.js';

// =============================================================================
// Basic Wildcard Tests
// =============================================================================

describe('matchGlob - basic wildcards', () => {
  describe('asterisk (*) - match any characters', () => {
    it('should match any extension with *.ext', () => {
      expect(matchGlob('*.txt', 'file.txt').matches).toBe(true);
      expect(matchGlob('*.txt', 'document.txt').matches).toBe(true);
      expect(matchGlob('*.txt', 'a.txt').matches).toBe(true);
      expect(matchGlob('*.txt', '.txt').matches).toBe(true);
    });

    it('should not match wrong extension', () => {
      expect(matchGlob('*.txt', 'file.doc').matches).toBe(false);
      expect(matchGlob('*.txt', 'file.txt.bak').matches).toBe(false);
    });

    it('should match prefix with prefix*', () => {
      expect(matchGlob('IMG_*', 'IMG_1234').matches).toBe(true);
      expect(matchGlob('IMG_*', 'IMG_').matches).toBe(true);
      expect(matchGlob('IMG_*', 'IMG_1234.jpg').matches).toBe(true);
    });

    it('should not match wrong prefix', () => {
      expect(matchGlob('IMG_*', 'DSC_1234').matches).toBe(false);
      expect(matchGlob('IMG_*', 'img_1234').matches).toBe(true); // case-insensitive by default
    });

    it('should match with * in the middle', () => {
      expect(matchGlob('file*.txt', 'file123.txt').matches).toBe(true);
      expect(matchGlob('file*.txt', 'file.txt').matches).toBe(true);
      expect(matchGlob('IMG_*_photo.jpg', 'IMG_1234_photo.jpg').matches).toBe(true);
    });

    it('should match multiple asterisks', () => {
      expect(matchGlob('*_vacation_*', 'summer_vacation_2024').matches).toBe(true);
      expect(matchGlob('*.*.*', 'a.b.c').matches).toBe(true);
    });

    it('should match everything with just *', () => {
      expect(matchGlob('*', 'anything').matches).toBe(true);
      expect(matchGlob('*', '').matches).toBe(true);
      expect(matchGlob('*', 'file.txt').matches).toBe(true);
    });
  });

  describe('question mark (?) - match single character', () => {
    it('should match exactly one character', () => {
      expect(matchGlob('file?.txt', 'file1.txt').matches).toBe(true);
      expect(matchGlob('file?.txt', 'fileA.txt').matches).toBe(true);
      expect(matchGlob('file?.txt', 'file_.txt').matches).toBe(true);
    });

    it('should not match zero or multiple characters', () => {
      expect(matchGlob('file?.txt', 'file.txt').matches).toBe(false);
      expect(matchGlob('file?.txt', 'file12.txt').matches).toBe(false);
    });

    it('should match multiple question marks', () => {
      expect(matchGlob('???.txt', 'abc.txt').matches).toBe(true);
      expect(matchGlob('???.txt', '123.txt').matches).toBe(true);
    });

    it('should not match wrong number of characters', () => {
      expect(matchGlob('???.txt', 'ab.txt').matches).toBe(false);
      expect(matchGlob('???.txt', 'abcd.txt').matches).toBe(false);
    });

    it('should combine with asterisk', () => {
      expect(matchGlob('?*', 'a').matches).toBe(true);
      expect(matchGlob('?*', 'ab').matches).toBe(true);
      expect(matchGlob('?*', '').matches).toBe(false);
      expect(matchGlob('*?', 'a').matches).toBe(true);
    });
  });
});

// =============================================================================
// Character Class Tests
// =============================================================================

describe('matchGlob - character classes', () => {
  describe('[abc] - match any character in set', () => {
    it('should match any character in the set', () => {
      expect(matchGlob('[abc].txt', 'a.txt').matches).toBe(true);
      expect(matchGlob('[abc].txt', 'b.txt').matches).toBe(true);
      expect(matchGlob('[abc].txt', 'c.txt').matches).toBe(true);
    });

    it('should not match characters not in set', () => {
      expect(matchGlob('[abc].txt', 'd.txt').matches).toBe(false);
      expect(matchGlob('[abc].txt', '1.txt').matches).toBe(false);
    });
  });

  describe('[a-z] - match character range', () => {
    it('should match any character in range', () => {
      expect(matchGlob('[a-z].txt', 'a.txt').matches).toBe(true);
      expect(matchGlob('[a-z].txt', 'm.txt').matches).toBe(true);
      expect(matchGlob('[a-z].txt', 'z.txt').matches).toBe(true);
    });

    it('should not match characters outside range', () => {
      expect(matchGlob('[a-z].txt', '1.txt').matches).toBe(false);
      expect(matchGlob('[a-z].txt', 'A.txt').matches).toBe(true); // case-insensitive
    });

    it('should match digit ranges', () => {
      expect(matchGlob('[0-9].txt', '0.txt').matches).toBe(true);
      expect(matchGlob('[0-9].txt', '5.txt').matches).toBe(true);
      expect(matchGlob('[0-9].txt', '9.txt').matches).toBe(true);
      expect(matchGlob('[0-9].txt', 'a.txt').matches).toBe(false);
    });

    it('should match combined ranges and sets', () => {
      expect(matchGlob('[a-zA-Z0-9].txt', 'a.txt').matches).toBe(true);
      expect(matchGlob('[a-zA-Z0-9].txt', 'Z.txt').matches).toBe(true);
      expect(matchGlob('[a-zA-Z0-9].txt', '5.txt').matches).toBe(true);
    });
  });

  describe('[!abc] or [^abc] - negated character class', () => {
    it('should match any character NOT in set', () => {
      expect(matchGlob('[!abc].txt', 'd.txt').matches).toBe(true);
      expect(matchGlob('[!abc].txt', '1.txt').matches).toBe(true);
      expect(matchGlob('[^abc].txt', 'x.txt').matches).toBe(true);
    });

    it('should not match characters in set', () => {
      expect(matchGlob('[!abc].txt', 'a.txt').matches).toBe(false);
      expect(matchGlob('[!abc].txt', 'b.txt').matches).toBe(false);
      expect(matchGlob('[^abc].txt', 'c.txt').matches).toBe(false);
    });

    it('should match any character NOT in range', () => {
      expect(matchGlob('[!0-9].txt', 'a.txt').matches).toBe(true);
      expect(matchGlob('[!0-9].txt', '5.txt').matches).toBe(false);
    });
  });

  describe('multiple character classes', () => {
    it('should match sequences of character classes', () => {
      expect(matchGlob('[0-9][0-9][0-9][0-9].txt', '2024.txt').matches).toBe(true);
      expect(matchGlob('[0-9][0-9][0-9][0-9].txt', '123.txt').matches).toBe(false);
      expect(matchGlob('[a-z][0-9].txt', 'a1.txt').matches).toBe(true);
    });
  });
});

// =============================================================================
// Brace Expansion Tests
// =============================================================================

describe('expandBraces', () => {
  it('should expand simple alternatives', () => {
    const expanded = expandBraces('*.{jpg,png}');
    expect(expanded).toEqual(['*.jpg', '*.png']);
  });

  it('should expand multiple alternatives', () => {
    const expanded = expandBraces('{a,b,c}.txt');
    expect(expanded).toEqual(['a.txt', 'b.txt', 'c.txt']);
  });

  it('should handle multiple brace groups', () => {
    const expanded = expandBraces('{a,b}.{x,y}');
    expect(expanded).toHaveLength(4);
    expect(expanded).toContain('a.x');
    expect(expanded).toContain('a.y');
    expect(expanded).toContain('b.x');
    expect(expanded).toContain('b.y');
  });

  it('should return original pattern if no braces', () => {
    expect(expandBraces('*.txt')).toEqual(['*.txt']);
    expect(expandBraces('file.doc')).toEqual(['file.doc']);
  });

  it('should handle complex patterns', () => {
    const expanded = expandBraces('IMG_*.{jpg,jpeg,png,gif}');
    expect(expanded).toHaveLength(4);
    expect(expanded).toContain('IMG_*.jpg');
    expect(expanded).toContain('IMG_*.jpeg');
    expect(expanded).toContain('IMG_*.png');
    expect(expanded).toContain('IMG_*.gif');
  });
});

describe('matchGlob - brace expansion', () => {
  it('should match any alternative in braces', () => {
    expect(matchGlob('*.{jpg,png}', 'photo.jpg').matches).toBe(true);
    expect(matchGlob('*.{jpg,png}', 'photo.png').matches).toBe(true);
    expect(matchGlob('*.{jpg,png}', 'photo.gif').matches).toBe(false);
  });

  it('should match complex brace patterns', () => {
    expect(matchGlob('IMG_*.{jpg,jpeg,heic}', 'IMG_1234.jpg').matches).toBe(true);
    expect(matchGlob('IMG_*.{jpg,jpeg,heic}', 'IMG_1234.jpeg').matches).toBe(true);
    expect(matchGlob('IMG_*.{jpg,jpeg,heic}', 'IMG_1234.heic').matches).toBe(true);
    expect(matchGlob('IMG_*.{jpg,jpeg,heic}', 'IMG_1234.png').matches).toBe(false);
  });

  it('should match multiple brace groups', () => {
    expect(matchGlob('{photo,image}.{jpg,png}', 'photo.jpg').matches).toBe(true);
    expect(matchGlob('{photo,image}.{jpg,png}', 'image.png').matches).toBe(true);
    expect(matchGlob('{photo,image}.{jpg,png}', 'photo.png').matches).toBe(true);
    expect(matchGlob('{photo,image}.{jpg,png}', 'video.jpg').matches).toBe(false);
  });
});

// =============================================================================
// Case Sensitivity Tests
// =============================================================================

describe('matchGlob - case sensitivity', () => {
  it('should be case-insensitive by default', () => {
    expect(matchGlob('*.txt', 'FILE.TXT').matches).toBe(true);
    expect(matchGlob('*.txt', 'File.Txt').matches).toBe(true);
    expect(matchGlob('IMG_*', 'img_1234').matches).toBe(true);
  });

  it('should be case-sensitive when option is set', () => {
    expect(matchGlob('*.txt', 'FILE.TXT', { caseSensitive: true }).matches).toBe(false);
    expect(matchGlob('*.txt', 'file.txt', { caseSensitive: true }).matches).toBe(true);
    expect(matchGlob('IMG_*', 'img_1234', { caseSensitive: true }).matches).toBe(false);
    expect(matchGlob('IMG_*', 'IMG_1234', { caseSensitive: true }).matches).toBe(true);
  });

  it('should handle case in character classes', () => {
    expect(matchGlob('[a-z].txt', 'A.txt', { caseSensitive: false }).matches).toBe(true);
    expect(matchGlob('[a-z].txt', 'A.txt', { caseSensitive: true }).matches).toBe(false);
  });
});

// =============================================================================
// Edge Cases Tests
// =============================================================================

describe('matchGlob - edge cases', () => {
  it('should handle empty pattern', () => {
    expect(matchGlob('', '').matches).toBe(true);
    expect(matchGlob('', 'file.txt').matches).toBe(false);
  });

  it('should handle empty filename', () => {
    expect(matchGlob('*', '').matches).toBe(true);
    expect(matchGlob('?', '').matches).toBe(false);
    expect(matchGlob('*.txt', '').matches).toBe(false);
  });

  it('should handle literal dots', () => {
    expect(matchGlob('file.txt', 'file.txt').matches).toBe(true);
    expect(matchGlob('file.txt', 'fileatxt').matches).toBe(false);
  });

  it('should handle special regex characters', () => {
    expect(matchGlob('file+name.txt', 'file+name.txt').matches).toBe(true);
    expect(matchGlob('file(1).txt', 'file(1).txt').matches).toBe(true);
    expect(matchGlob('file$var.txt', 'file$var.txt').matches).toBe(true);
    expect(matchGlob('file^test.txt', 'file^test.txt').matches).toBe(true);
  });

  it('should handle escaped glob characters', () => {
    expect(matchGlob('file\\*.txt', 'file*.txt').matches).toBe(true);
    expect(matchGlob('file\\*.txt', 'fileX.txt').matches).toBe(false);
    expect(matchGlob('file\\?.txt', 'file?.txt').matches).toBe(true);
    expect(matchGlob('file\\?.txt', 'fileX.txt').matches).toBe(false);
  });

  it('should handle filenames with special characters', () => {
    expect(matchGlob('*', 'file-name_v1.2.3.txt').matches).toBe(true);
    expect(matchGlob('*_v?.?.?.txt', 'file_v1.2.3.txt').matches).toBe(true);
  });

  it('should handle very long patterns and filenames', () => {
    const longPattern = 'a'.repeat(100) + '*' + 'b'.repeat(100);
    const longFilename = 'a'.repeat(100) + 'xxx' + 'b'.repeat(100);
    expect(matchGlob(longPattern, longFilename).matches).toBe(true);
  });
});

// =============================================================================
// Complex Pattern Tests
// =============================================================================

describe('matchGlob - complex patterns', () => {
  it('should match iPhone photo naming convention', () => {
    expect(matchGlob('IMG_*.{jpg,jpeg,heic}', 'IMG_0001.jpg').matches).toBe(true);
    expect(matchGlob('IMG_*.{jpg,jpeg,heic}', 'IMG_1234.jpeg').matches).toBe(true);
    expect(matchGlob('IMG_*.{jpg,jpeg,heic}', 'IMG_9999.heic').matches).toBe(true);
  });

  it('should match year prefix pattern', () => {
    expect(matchGlob('[0-9][0-9][0-9][0-9]_*', '2024_vacation.jpg').matches).toBe(true);
    expect(matchGlob('[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]*', '2024-01-15.jpg').matches).toBe(
      true
    );
  });

  it('should match vacation photo pattern from AC4', () => {
    expect(matchGlob('*_vacation_*.{jpg,png}', '2024_vacation_beach.jpg').matches).toBe(true);
    expect(matchGlob('*_vacation_*.{jpg,png}', 'summer_vacation_photo.png').matches).toBe(true);
    expect(matchGlob('*_vacation_*.{jpg,png}', '2024_vacation_beach.gif').matches).toBe(false);
  });

  it('should match document naming conventions', () => {
    expect(matchGlob('*.{pdf,doc,docx}', 'report.pdf').matches).toBe(true);
    expect(matchGlob('invoice_*.pdf', 'invoice_2024-001.pdf').matches).toBe(true);
    expect(matchGlob('contract_[0-9]*.pdf', 'contract_12345.pdf').matches).toBe(true);
  });
});

// =============================================================================
// Utility Functions Tests
// =============================================================================

describe('isGlobMatch', () => {
  it('should return boolean result', () => {
    expect(isGlobMatch('*.txt', 'file.txt')).toBe(true);
    expect(isGlobMatch('*.txt', 'file.doc')).toBe(false);
  });

  it('should support options', () => {
    expect(isGlobMatch('*.txt', 'FILE.TXT')).toBe(true);
    expect(isGlobMatch('*.txt', 'FILE.TXT', { caseSensitive: true })).toBe(false);
  });
});

describe('filterByGlob', () => {
  const filenames = [
    'photo1.jpg',
    'photo2.jpg',
    'photo3.png',
    'document.pdf',
    'document.doc',
    'IMG_0001.jpg',
    'IMG_0002.heic',
  ];

  it('should filter matching files', () => {
    const result = filterByGlob('*.jpg', filenames);
    expect(result).toEqual(['photo1.jpg', 'photo2.jpg', 'IMG_0001.jpg']);
  });

  it('should filter with brace expansion', () => {
    const result = filterByGlob('*.{jpg,png}', filenames);
    expect(result).toEqual(['photo1.jpg', 'photo2.jpg', 'photo3.png', 'IMG_0001.jpg']);
  });

  it('should filter with prefix pattern', () => {
    const result = filterByGlob('IMG_*', filenames);
    expect(result).toEqual(['IMG_0001.jpg', 'IMG_0002.heic']);
  });

  it('should return empty array for no matches', () => {
    const result = filterByGlob('*.txt', filenames);
    expect(result).toEqual([]);
  });

  it('should support case sensitivity option', () => {
    const mixed = ['FILE.TXT', 'file.txt', 'File.Txt'];
    expect(filterByGlob('*.txt', mixed, { caseSensitive: false })).toHaveLength(3);
    expect(filterByGlob('*.txt', mixed, { caseSensitive: true })).toEqual(['file.txt']);
  });
});

describe('compileGlobPattern', () => {
  it('should compile pattern to regex', () => {
    const regex = compileGlobPattern('*.txt');
    expect(regex.test('file.txt')).toBe(true);
    expect(regex.test('file.doc')).toBe(false);
  });

  it('should reuse compiled regex for efficiency', () => {
    const regex1 = compileGlobPattern('*.jpg');
    const regex2 = compileGlobPattern('*.jpg');
    // Both should work the same way (though they're different instances)
    expect(regex1.test('photo.jpg')).toBe(true);
    expect(regex2.test('photo.jpg')).toBe(true);
  });
});

// =============================================================================
// AC2 Specific Tests
// =============================================================================

describe('AC2: Pattern Matching Function', () => {
  it('Given pattern IMG_*.jpg, When evaluated against IMG_1234.jpg, Then file matches successfully', () => {
    const result = matchGlob('IMG_*.jpg', 'IMG_1234.jpg');
    expect(result.matches).toBe(true);
  });

  it('should be case-insensitive by default', () => {
    expect(matchGlob('img_*.jpg', 'IMG_1234.JPG').matches).toBe(true);
    expect(matchGlob('IMG_*.jpg', 'img_1234.jpg').matches).toBe(true);
  });

  it('should support caseSensitive option per call', () => {
    expect(matchGlob('IMG_*.jpg', 'IMG_1234.jpg', { caseSensitive: true }).matches).toBe(true);
    expect(matchGlob('IMG_*.jpg', 'img_1234.jpg', { caseSensitive: true }).matches).toBe(false);
  });
});

// =============================================================================
// AC4 Specific Tests
// =============================================================================

describe('AC4: Complex Pattern Support', () => {
  it('patterns with multiple wildcards should match correctly', () => {
    expect(matchGlob('*_vacation_*.{jpg,png}', '2024_vacation_beach.jpg').matches).toBe(true);
  });

  it('should support brace expansion {a,b}', () => {
    expect(matchGlob('*.{jpg,png}', 'photo.jpg').matches).toBe(true);
    expect(matchGlob('*.{jpg,png}', 'photo.png').matches).toBe(true);
    expect(matchGlob('*.{jpg,png}', 'photo.gif').matches).toBe(false);
  });

  it('should support character ranges [0-9]', () => {
    expect(matchGlob('[0-9]*.txt', '1file.txt').matches).toBe(true);
    expect(matchGlob('[0-9]*.txt', 'afile.txt').matches).toBe(false);
  });

  it('should support negation [!pattern] in character classes', () => {
    expect(matchGlob('[!0-9]*.txt', 'afile.txt').matches).toBe(true);
    expect(matchGlob('[!0-9]*.txt', '1file.txt').matches).toBe(false);
  });
});
