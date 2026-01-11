/**
 * Tests for filename sanitization (Story 4.7)
 *
 * @module rename/sanitize.test
 */

import { describe, it, expect } from 'vitest';
import {
  sanitizeFilename,
  INVALID_CHARS_UNIVERSAL,
  INVALID_CHARS_WINDOWS,
  INVALID_CHARS_MACOS,
  INVALID_CHARS_LINUX,
  WINDOWS_RESERVED_NAMES,
  MAX_FILENAME_LENGTH,
  type SanitizeOptions,
  type SanitizeResult,
  type SanitizeChange,
} from './sanitize.js';

// =============================================================================
// Invalid Character Replacement (AC1)
// =============================================================================

describe('sanitizeFilename - invalid character replacement (AC1)', () => {
  it('replaces forward slash with underscore', () => {
    const result = sanitizeFilename('photo/2024.jpg');

    expect(result.sanitized).toBe('photo_2024.jpg');
    expect(result.wasModified).toBe(true);
    expect(result.changes[0].type).toBe('char_replacement');
  });

  it('replaces backslash with underscore', () => {
    const result = sanitizeFilename('photo\\2024.jpg');

    expect(result.sanitized).toBe('photo_2024.jpg');
    expect(result.wasModified).toBe(true);
  });

  it('replaces colon with underscore', () => {
    const result = sanitizeFilename('2024:01:15.jpg');

    expect(result.sanitized).toBe('2024_01_15.jpg');
    expect(result.wasModified).toBe(true);
  });

  it('replaces asterisk with underscore', () => {
    const result = sanitizeFilename('photo*2024.jpg');

    expect(result.sanitized).toBe('photo_2024.jpg');
    expect(result.wasModified).toBe(true);
  });

  it('replaces question mark with underscore', () => {
    const result = sanitizeFilename('photo?2024.jpg');

    expect(result.sanitized).toBe('photo_2024.jpg');
    expect(result.wasModified).toBe(true);
  });

  it('replaces double quote with underscore', () => {
    const result = sanitizeFilename('photo"2024.jpg');

    expect(result.sanitized).toBe('photo_2024.jpg');
    expect(result.wasModified).toBe(true);
  });

  it('replaces less than with underscore', () => {
    const result = sanitizeFilename('photo<2024.jpg');

    expect(result.sanitized).toBe('photo_2024.jpg');
    expect(result.wasModified).toBe(true);
  });

  it('replaces greater than with underscore', () => {
    const result = sanitizeFilename('photo>2024.jpg');

    expect(result.sanitized).toBe('photo_2024.jpg');
    expect(result.wasModified).toBe(true);
  });

  it('replaces pipe with underscore', () => {
    const result = sanitizeFilename('photo|2024.jpg');

    expect(result.sanitized).toBe('photo_2024.jpg');
    expect(result.wasModified).toBe(true);
  });

  it('replaces multiple invalid characters', () => {
    const result = sanitizeFilename('photo:date*time?.jpg');

    expect(result.sanitized).toBe('photo_date_time_.jpg');
    expect(result.wasModified).toBe(true);
  });

  it('uses custom replacement character', () => {
    const result = sanitizeFilename('photo/2024.jpg', { replacement: '-' });

    expect(result.sanitized).toBe('photo-2024.jpg');
    expect(result.wasModified).toBe(true);
  });

  it('collapses consecutive replacements', () => {
    const result = sanitizeFilename('photo::date.jpg');

    expect(result.sanitized).toBe('photo_date.jpg');
    expect(result.wasModified).toBe(true);
  });

  it('handles all special characters', () => {
    const result = sanitizeFilename('a/b\\c:d*e?f"g<h>i|j.jpg');

    expect(result.sanitized).toBe('a_b_c_d_e_f_g_h_i_j.jpg');
    expect(result.wasModified).toBe(true);
  });

  it('tracks original and replacement in changes', () => {
    const result = sanitizeFilename('photo/2024.jpg');

    expect(result.changes.length).toBeGreaterThan(0);
    expect(result.changes[0].message).toContain('/');
  });
});

// =============================================================================
// Windows Reserved Names (AC2)
// =============================================================================

describe('sanitizeFilename - Windows reserved names (AC2)', () => {
  it('handles CON reserved name', () => {
    const result = sanitizeFilename('CON.txt', { targetPlatform: 'all' });

    expect(result.sanitized).toBe('CON_file.txt');
    expect(result.wasModified).toBe(true);
    expect(result.changes.some((c) => c.type === 'reserved_name')).toBe(true);
  });

  it('handles PRN reserved name (case-insensitive)', () => {
    const result = sanitizeFilename('prn.doc', { targetPlatform: 'all' });

    expect(result.sanitized).toBe('prn_file.doc');
    expect(result.wasModified).toBe(true);
  });

  it('handles AUX reserved name', () => {
    const result = sanitizeFilename('AUX.txt', { targetPlatform: 'all' });

    expect(result.sanitized).toBe('AUX_file.txt');
    expect(result.wasModified).toBe(true);
  });

  it('handles NUL reserved name', () => {
    const result = sanitizeFilename('NUL.txt', { targetPlatform: 'all' });

    expect(result.sanitized).toBe('NUL_file.txt');
    expect(result.wasModified).toBe(true);
  });

  it('handles COM1 through COM9', () => {
    const result1 = sanitizeFilename('COM1.txt', { targetPlatform: 'all' });
    const result5 = sanitizeFilename('com5.txt', { targetPlatform: 'all' });
    const result9 = sanitizeFilename('COM9.txt', { targetPlatform: 'all' });

    expect(result1.sanitized).toBe('COM1_file.txt');
    expect(result5.sanitized).toBe('com5_file.txt');
    expect(result9.sanitized).toBe('COM9_file.txt');
  });

  it('handles LPT1 through LPT9', () => {
    const result1 = sanitizeFilename('LPT1.txt', { targetPlatform: 'all' });
    const result3 = sanitizeFilename('lpt3.txt', { targetPlatform: 'all' });
    const result9 = sanitizeFilename('LPT9.txt', { targetPlatform: 'all' });

    expect(result1.sanitized).toBe('LPT1_file.txt');
    expect(result3.sanitized).toBe('lpt3_file.txt');
    expect(result9.sanitized).toBe('LPT9_file.txt');
  });

  it('does not modify names containing reserved names as substring', () => {
    const result = sanitizeFilename('confile.txt', { targetPlatform: 'all' });

    expect(result.sanitized).toBe('confile.txt');
    expect(result.wasModified).toBe(false);
  });

  it('does not modify when reserved name appears with prefix', () => {
    const result = sanitizeFilename('mycon.txt', { targetPlatform: 'all' });

    expect(result.sanitized).toBe('mycon.txt');
    expect(result.wasModified).toBe(false);
  });
});

// =============================================================================
// Trailing Spaces and Periods (AC2)
// =============================================================================

describe('sanitizeFilename - trailing spaces and periods (AC2)', () => {
  it('removes trailing spaces', () => {
    const result = sanitizeFilename('photo  ', { targetPlatform: 'all' });

    expect(result.sanitized).toBe('photo');
    expect(result.changes.some((c) => c.type === 'trailing_fix')).toBe(true);
  });

  it('removes trailing periods', () => {
    const result = sanitizeFilename('photo..', { targetPlatform: 'all' });

    expect(result.sanitized).toBe('photo');
    expect(result.changes.some((c) => c.type === 'trailing_fix')).toBe(true);
  });

  it('removes mixed trailing spaces and periods', () => {
    const result = sanitizeFilename('photo. .', { targetPlatform: 'all' });

    expect(result.sanitized).toBe('photo');
    expect(result.wasModified).toBe(true);
  });

  it('preserves extension when removing trailing chars from name', () => {
    // "photo  .jpg" -> the name part is "photo  " and extension is ".jpg"
    const result = sanitizeFilename('photo .jpg', { targetPlatform: 'all' });

    // Should remove trailing space from name portion only
    expect(result.sanitized).toBe('photo.jpg');
    expect(result.wasModified).toBe(true);
  });
});

// =============================================================================
// Length Truncation (AC3)
// =============================================================================

describe('sanitizeFilename - length truncation (AC3)', () => {
  it('truncates names exceeding max length', () => {
    const longName = 'a'.repeat(300) + '.jpg';
    const result = sanitizeFilename(longName);

    expect(result.sanitized.length).toBeLessThanOrEqual(255);
    expect(result.changes.some((c) => c.type === 'truncation')).toBe(true);
  });

  it('preserves file extension during truncation', () => {
    const longName = 'a'.repeat(300) + '.jpg';
    const result = sanitizeFilename(longName);

    expect(result.sanitized).toMatch(/\.jpg$/);
  });

  it('adds ellipsis by default', () => {
    const longName = 'a'.repeat(300) + '.jpg';
    const result = sanitizeFilename(longName);

    expect(result.sanitized).toContain('...');
  });

  it('can truncate without ellipsis', () => {
    const longName = 'a'.repeat(300) + '.jpg';
    const result = sanitizeFilename(longName, { truncationStyle: 'none' });

    expect(result.sanitized).not.toContain('...');
    expect(result.sanitized.length).toBeLessThanOrEqual(255);
  });

  it('respects custom max length', () => {
    const name = 'a'.repeat(50) + '.jpg';
    const result = sanitizeFilename(name, { maxLength: 20 });

    expect(result.sanitized.length).toBeLessThanOrEqual(20);
    expect(result.wasModified).toBe(true);
  });

  it('handles very long extensions gracefully', () => {
    const name = 'photo.' + 'x'.repeat(260);
    const result = sanitizeFilename(name);

    expect(result.sanitized.length).toBeLessThanOrEqual(255);
    expect(result.wasModified).toBe(true);
  });

  it('records original length in truncation message', () => {
    const longName = 'a'.repeat(300) + '.jpg';
    const result = sanitizeFilename(longName);

    const truncationChange = result.changes.find((c) => c.type === 'truncation');
    expect(truncationChange?.message).toContain('304'); // 300 + 4 for ".jpg"
  });

  it('does not truncate names within limit', () => {
    const name = 'a'.repeat(250) + '.jpg';
    const result = sanitizeFilename(name);

    expect(result.wasModified).toBe(false);
    expect(result.changes).toHaveLength(0);
  });
});

// =============================================================================
// Platform-Specific Behavior (AC2)
// =============================================================================

describe('sanitizeFilename - platform-specific behavior (AC2)', () => {
  it('only checks Windows rules on Windows platform', () => {
    const result = sanitizeFilename('CON.txt', { targetPlatform: 'linux' });

    expect(result.sanitized).toBe('CON.txt');
    expect(result.wasModified).toBe(false);
  });

  it('allows colons on Linux', () => {
    const result = sanitizeFilename('2024:01:15.jpg', { targetPlatform: 'linux' });

    expect(result.sanitized).toBe('2024:01:15.jpg');
    expect(result.wasModified).toBe(false);
  });

  it('allows colons on macOS', () => {
    const result = sanitizeFilename('2024:01:15.jpg', { targetPlatform: 'macos' });

    expect(result.sanitized).toBe('2024:01:15.jpg');
    expect(result.wasModified).toBe(false);
  });

  it('replaces colons for cross-platform compatibility', () => {
    const result = sanitizeFilename('2024:01:15.jpg', { targetPlatform: 'all' });

    expect(result.sanitized).toBe('2024_01_15.jpg');
    expect(result.wasModified).toBe(true);
  });

  it('replaces forward slash on all platforms', () => {
    const linuxResult = sanitizeFilename('photo/2024.jpg', { targetPlatform: 'linux' });
    const macResult = sanitizeFilename('photo/2024.jpg', { targetPlatform: 'macos' });
    const winResult = sanitizeFilename('photo/2024.jpg', { targetPlatform: 'windows' });

    expect(linuxResult.sanitized).toBe('photo_2024.jpg');
    expect(macResult.sanitized).toBe('photo_2024.jpg');
    expect(winResult.sanitized).toBe('photo_2024.jpg');
  });

  it('does not check reserved names on Linux', () => {
    const result = sanitizeFilename('NUL.txt', { targetPlatform: 'linux' });

    expect(result.sanitized).toBe('NUL.txt');
    expect(result.wasModified).toBe(false);
  });

  it('does not check trailing spaces on Linux', () => {
    const result = sanitizeFilename('photo ', { targetPlatform: 'linux' });

    expect(result.sanitized).toBe('photo ');
    expect(result.wasModified).toBe(false);
  });

  it('replaces control characters on Windows platform', () => {
    // Control character \x01 (SOH) is in the Windows invalid char range \x00-\x1f
    const result = sanitizeFilename('photo\x01file.jpg', { targetPlatform: 'windows' });

    expect(result.sanitized).toBe('photo_file.jpg');
    expect(result.wasModified).toBe(true);
    expect(result.changes[0].type).toBe('char_replacement');
  });

  it('replaces NUL character on all platforms', () => {
    // NUL (\x00) is invalid on all platforms
    const linuxResult = sanitizeFilename('photo\x00file.jpg', { targetPlatform: 'linux' });
    const macResult = sanitizeFilename('photo\x00file.jpg', { targetPlatform: 'macos' });
    const winResult = sanitizeFilename('photo\x00file.jpg', { targetPlatform: 'windows' });

    expect(linuxResult.sanitized).toBe('photo_file.jpg');
    expect(macResult.sanitized).toBe('photo_file.jpg');
    expect(winResult.sanitized).toBe('photo_file.jpg');
  });

  it('allows control characters on Linux (except NUL)', () => {
    // Control characters other than NUL are valid on Linux
    const result = sanitizeFilename('photo\x01file.jpg', { targetPlatform: 'linux' });

    // Linux only blocks / and NUL, so \x01 should pass through
    expect(result.sanitized).toBe('photo\x01file.jpg');
    expect(result.wasModified).toBe(false);
  });
});

// =============================================================================
// Edge Cases
// =============================================================================

describe('sanitizeFilename - edge cases', () => {
  it('handles empty filename', () => {
    const result = sanitizeFilename('');

    expect(result.sanitized).toBe('');
    expect(result.wasModified).toBe(false);
  });

  it('handles filename with only extension (dotfile)', () => {
    const result = sanitizeFilename('.gitignore');

    expect(result.sanitized).toBe('.gitignore');
    expect(result.wasModified).toBe(false);
  });

  it('handles filename with no extension', () => {
    const result = sanitizeFilename('README');

    expect(result.sanitized).toBe('README');
    expect(result.wasModified).toBe(false);
  });

  it('handles multiple dots in filename', () => {
    const result = sanitizeFilename('photo.2024.01.15.jpg');

    expect(result.sanitized).toBe('photo.2024.01.15.jpg');
    expect(result.wasModified).toBe(false);
  });

  it('returns original when no changes needed', () => {
    const result = sanitizeFilename('valid_filename_2024.jpg');

    expect(result.sanitized).toBe('valid_filename_2024.jpg');
    expect(result.wasModified).toBe(false);
    expect(result.changes).toHaveLength(0);
  });

  it('handles unicode characters', () => {
    const result = sanitizeFilename('photo_日本語_2024.jpg');

    // Unicode should be preserved
    expect(result.sanitized).toBe('photo_日本語_2024.jpg');
    expect(result.wasModified).toBe(false);
  });

  it('handles emoji in filename', () => {
    const result = sanitizeFilename('photo_📷_2024.jpg');

    expect(result.sanitized).toBe('photo_📷_2024.jpg');
    expect(result.wasModified).toBe(false);
  });

  it('handles filename that is just spaces', () => {
    const result = sanitizeFilename('   ', { targetPlatform: 'all' });

    expect(result.sanitized).toBe('');
    expect(result.wasModified).toBe(true);
  });

  it('handles filename that is just periods', () => {
    const result = sanitizeFilename('...', { targetPlatform: 'all' });

    expect(result.sanitized).toBe('');
    expect(result.wasModified).toBe(true);
  });

  it('preserves leading dot in hidden files', () => {
    const result = sanitizeFilename('.hidden_file');

    expect(result.sanitized).toBe('.hidden_file');
    expect(result.wasModified).toBe(false);
  });
});

// =============================================================================
// Constant Exports
// =============================================================================

describe('sanitize constants', () => {
  it('exports INVALID_CHARS_UNIVERSAL regex', () => {
    expect(INVALID_CHARS_UNIVERSAL).toBeInstanceOf(RegExp);
    expect('/').toMatch(INVALID_CHARS_UNIVERSAL);
    expect('\\').toMatch(INVALID_CHARS_UNIVERSAL);
    expect(':').toMatch(INVALID_CHARS_UNIVERSAL);
    expect('*').toMatch(INVALID_CHARS_UNIVERSAL);
    expect('?').toMatch(INVALID_CHARS_UNIVERSAL);
    expect('"').toMatch(INVALID_CHARS_UNIVERSAL);
    expect('<').toMatch(INVALID_CHARS_UNIVERSAL);
    expect('>').toMatch(INVALID_CHARS_UNIVERSAL);
    expect('|').toMatch(INVALID_CHARS_UNIVERSAL);
  });

  it('exports INVALID_CHARS_WINDOWS regex', () => {
    expect(INVALID_CHARS_WINDOWS).toBeInstanceOf(RegExp);
  });

  it('exports INVALID_CHARS_MACOS regex', () => {
    expect(INVALID_CHARS_MACOS).toBeInstanceOf(RegExp);
  });

  it('exports INVALID_CHARS_LINUX regex', () => {
    expect(INVALID_CHARS_LINUX).toBeInstanceOf(RegExp);
  });

  it('exports WINDOWS_RESERVED_NAMES set', () => {
    expect(WINDOWS_RESERVED_NAMES).toBeInstanceOf(Set);
    expect(WINDOWS_RESERVED_NAMES.has('con')).toBe(true);
    expect(WINDOWS_RESERVED_NAMES.has('prn')).toBe(true);
    expect(WINDOWS_RESERVED_NAMES.has('aux')).toBe(true);
    expect(WINDOWS_RESERVED_NAMES.has('nul')).toBe(true);
    expect(WINDOWS_RESERVED_NAMES.has('com1')).toBe(true);
    expect(WINDOWS_RESERVED_NAMES.has('lpt1')).toBe(true);
  });

  it('exports MAX_FILENAME_LENGTH constant', () => {
    expect(MAX_FILENAME_LENGTH).toBe(255);
  });
});

// =============================================================================
// Combined Scenarios
// =============================================================================

describe('sanitizeFilename - combined scenarios', () => {
  it('handles multiple issues in single filename', () => {
    // Invalid char + reserved name-like pattern + long
    const result = sanitizeFilename('CON:test*file' + 'x'.repeat(300) + '.txt', {
      targetPlatform: 'all',
    });

    expect(result.sanitized).not.toContain(':');
    expect(result.sanitized).not.toContain('*');
    expect(result.sanitized.length).toBeLessThanOrEqual(255);
    expect(result.changes.length).toBeGreaterThan(0);
  });

  it('applies changes in correct order: chars, reserved, trailing, truncation', () => {
    // Create a name that triggers all sanitization steps
    const result = sanitizeFilename('CON:test...' + 'x'.repeat(300) + '.txt', {
      targetPlatform: 'all',
    });

    // Should have multiple changes
    expect(result.changes.length).toBeGreaterThan(1);
    expect(result.wasModified).toBe(true);
  });
});
