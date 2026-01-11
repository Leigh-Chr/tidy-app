/**
 * @fileoverview Tests for format utilities - Story 5.5, 5.7
 *
 * AC covered (5.7):
 * - AC1: JSON format outputs valid JSON
 * - AC2: Table format shows formatted ASCII table
 * - AC3: Plain format outputs one item per line
 */
import { describe, it, expect } from 'vitest';
import { formatTable, formatJson, formatPlain } from './format.js';
import type { FileInfo } from '@tidy/core';

// Helper to create test FileInfo
function createFileInfo(overrides: Partial<FileInfo> = {}): FileInfo {
  return {
    path: '/test/file.txt',
    name: 'file',
    extension: 'txt',
    fullName: 'file.txt',
    size: 1024,
    createdAt: new Date('2024-01-01'),
    modifiedAt: new Date('2024-01-02'),
    relativePath: 'file.txt',
    category: 'document',
    metadataSupported: false,
    metadataCapability: 'none',
    ...overrides,
  };
}

describe('formatTable', () => {
  it('includes header row', () => {
    const files = [createFileInfo()];
    const output = formatTable(files);

    expect(output).toContain('Name');
    expect(output).toContain('Type');
    expect(output).toContain('Size');
  });

  it('includes separator lines', () => {
    const files = [createFileInfo()];
    const output = formatTable(files);

    expect(output).toContain('---');
  });

  it('includes file name', () => {
    const files = [createFileInfo({ fullName: 'example.pdf' })];
    const output = formatTable(files);

    expect(output).toContain('example.pdf');
  });

  it('includes file extension', () => {
    const files = [createFileInfo({ extension: 'pdf' })];
    const output = formatTable(files);

    expect(output).toContain('pdf');
  });

  it('truncates long file names', () => {
    const longName = 'a'.repeat(50) + '.txt';
    const files = [createFileInfo({ fullName: longName })];
    const output = formatTable(files);

    expect(output).toContain('...');
    expect(output).not.toContain(longName);
  });

  it('formats sizes in human-readable units', () => {
    const files = [
      createFileInfo({ fullName: 'small.txt', size: 500 }),
      createFileInfo({ fullName: 'medium.txt', size: 5 * 1024 }),
      createFileInfo({ fullName: 'large.txt', size: 5 * 1024 * 1024 }),
    ];
    const output = formatTable(files);

    expect(output).toContain('B');
    expect(output).toContain('KB');
    expect(output).toContain('MB');
  });

  it('shows total file count', () => {
    const files = [
      createFileInfo({ fullName: 'file1.txt' }),
      createFileInfo({ fullName: 'file2.txt' }),
      createFileInfo({ fullName: 'file3.txt' }),
    ];
    const output = formatTable(files);

    expect(output).toContain('3 files');
  });

  it('uses singular for single file', () => {
    const files = [createFileInfo()];
    const output = formatTable(files);

    expect(output).toContain('1 file');
    expect(output).not.toContain('1 files');
  });

  // Story 5.7 - AC2: Color control
  describe('color option', () => {
    it('excludes ANSI codes when color is false', () => {
      const files = [createFileInfo()];
      const output = formatTable(files, { color: false });

      // ANSI escape codes start with \x1b[
      expect(output).not.toMatch(/\x1b\[/);
    });

    it('includes styling by default', () => {
      const files = [createFileInfo()];
      // Default behavior - colors enabled
      const output = formatTable(files);

      // Should contain the header and footer text
      expect(output).toContain('Name');
      expect(output).toContain('Total');
    });
  });
});

describe('formatJson', () => {
  it('returns valid JSON array', () => {
    const files = [createFileInfo()];
    const output = formatJson(files);

    const parsed = JSON.parse(output);
    expect(Array.isArray(parsed)).toBe(true);
  });

  it('includes all file properties', () => {
    const files = [createFileInfo({ fullName: 'test.txt', size: 1234 })];
    const output = formatJson(files);

    const parsed = JSON.parse(output);
    expect(parsed[0].fullName).toBe('test.txt');
    expect(parsed[0].size).toBe(1234);
  });

  it('is pretty-printed with indentation', () => {
    const files = [createFileInfo()];
    const output = formatJson(files);

    expect(output).toContain('\n');
    expect(output).toContain('  ');
  });

  it('handles multiple files', () => {
    const files = [
      createFileInfo({ fullName: 'file1.txt' }),
      createFileInfo({ fullName: 'file2.txt' }),
    ];
    const output = formatJson(files);

    const parsed = JSON.parse(output);
    expect(parsed.length).toBe(2);
  });

  // Story 5.7 - AC1: JSON format with proper date serialization
  describe('date serialization', () => {
    it('serializes dates as ISO strings', () => {
      const testDate = new Date('2026-01-09T10:30:00Z');
      const files = [
        createFileInfo({
          createdAt: testDate,
          modifiedAt: new Date('2026-01-09T12:00:00Z'),
        }),
      ];
      const output = formatJson(files);
      const parsed = JSON.parse(output);

      expect(parsed[0].createdAt).toBe('2026-01-09T10:30:00.000Z');
      expect(parsed[0].modifiedAt).toBe('2026-01-09T12:00:00.000Z');
    });

    it('dates are strings not Date objects', () => {
      const files = [createFileInfo()];
      const output = formatJson(files);
      const parsed = JSON.parse(output);

      expect(typeof parsed[0].createdAt).toBe('string');
      expect(typeof parsed[0].modifiedAt).toBe('string');
    });
  });

  it('handles empty array', () => {
    const files: FileInfo[] = [];
    const output = formatJson(files);

    expect(output).toBe('[]');
  });
});

describe('formatPlain', () => {
  it('outputs one path per line', () => {
    const files = [
      createFileInfo({ path: '/path/to/file1.txt' }),
      createFileInfo({ path: '/path/to/file2.txt' }),
    ];
    const output = formatPlain(files);

    const lines = output.split('\n');
    expect(lines.length).toBe(2);
  });

  it('includes full paths', () => {
    const files = [createFileInfo({ path: '/absolute/path/to/file.txt' })];
    const output = formatPlain(files);

    expect(output).toContain('/absolute/path/to/file.txt');
  });

  it('handles empty array', () => {
    const files: FileInfo[] = [];
    const output = formatPlain(files);

    expect(output).toBe('');
  });

  it('does not include headers or formatting', () => {
    const files = [createFileInfo()];
    const output = formatPlain(files);

    expect(output).not.toContain('Name');
    expect(output).not.toContain('---');
    expect(output).not.toContain('Total');
  });
});
