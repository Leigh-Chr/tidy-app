/**
 * @fileoverview Tests for history formatters - Story 9.2
 */

import { describe, it, expect } from 'vitest';
import {
  formatHistoryTable,
  formatHistoryJson,
  formatHistoryPlain,
  formatHistoryEntryDetail,
} from './history-format.js';
import type { OperationHistoryEntry } from '@tidy/core';

// =============================================================================
// Test Fixtures
// =============================================================================

function createMockEntry(overrides: Partial<OperationHistoryEntry> = {}): OperationHistoryEntry {
  return {
    id: '550e8400-e29b-41d4-a716-446655440000',
    timestamp: '2026-01-10T12:30:00.000Z',
    operationType: 'rename',
    fileCount: 5,
    summary: {
      succeeded: 4,
      skipped: 0,
      failed: 1,
      directoriesCreated: 0,
    },
    durationMs: 150,
    files: [
      {
        originalPath: '/test/file1.txt',
        newPath: '/test/file1-renamed.txt',
        isMoveOperation: false,
        success: true,
        error: null,
      },
      {
        originalPath: '/test/file2.txt',
        newPath: null,
        isMoveOperation: false,
        success: false,
        error: 'Permission denied',
      },
    ],
    directoriesCreated: [],
    ...overrides,
  };
}

// =============================================================================
// Test Suite: formatHistoryTable
// =============================================================================

describe('formatHistoryTable', () => {
  it('should format empty array', () => {
    const result = formatHistoryTable([], { color: false });

    expect(result).toContain('Date');
    expect(result).toContain('Type');
    expect(result).toContain('Files');
    expect(result).toContain('Result');
    expect(result).toContain('Total: 0 operations');
  });

  it('should format single entry', () => {
    const entries = [createMockEntry()];
    const result = formatHistoryTable(entries, { color: false });

    expect(result).toContain('rename');
    expect(result).toContain('5');
    expect(result).toContain('4/5 succeeded');
    expect(result).toContain('Total: 1 operation');
  });

  it('should format multiple entries', () => {
    const entries = [
      createMockEntry({ id: 'entry-1', operationType: 'rename' }),
      createMockEntry({ id: 'entry-2', operationType: 'move', fileCount: 10 }),
    ];
    const result = formatHistoryTable(entries, { color: false });

    expect(result).toContain('rename');
    expect(result).toContain('move');
    expect(result).toContain('Total: 2 operations');
  });

  it('should show all succeeded results correctly', () => {
    const entry = createMockEntry({
      summary: { succeeded: 5, skipped: 0, failed: 0, directoriesCreated: 0 },
    });
    const result = formatHistoryTable([entry], { color: false });

    expect(result).toContain('5/5 succeeded');
  });

  it('should show all failed results correctly', () => {
    const entry = createMockEntry({
      summary: { succeeded: 0, skipped: 0, failed: 5, directoriesCreated: 0 },
    });
    const result = formatHistoryTable([entry], { color: false });

    expect(result).toContain('5/5 failed');
  });

  it('should include header row', () => {
    const result = formatHistoryTable([], { color: false });

    expect(result.split('\n')[0]).toContain('Date');
    expect(result.split('\n')[0]).toContain('Type');
    expect(result.split('\n')[0]).toContain('Files');
    expect(result.split('\n')[0]).toContain('Result');
  });

  it('should include separator line', () => {
    const result = formatHistoryTable([], { color: false });

    expect(result).toContain('-'.repeat(65));
  });

  it('should handle organize type', () => {
    const entry = createMockEntry({ operationType: 'organize' });
    const result = formatHistoryTable([entry], { color: false });

    expect(result).toContain('organize');
  });
});

// =============================================================================
// Test Suite: formatHistoryJson
// =============================================================================

describe('formatHistoryJson', () => {
  it('should return valid JSON', () => {
    const entries = [createMockEntry()];
    const result = formatHistoryJson(entries);

    expect(() => JSON.parse(result)).not.toThrow();
  });

  it('should format empty array as JSON', () => {
    const result = formatHistoryJson([]);

    expect(JSON.parse(result)).toEqual([]);
  });

  it('should preserve all entry fields', () => {
    const entry = createMockEntry();
    const result = formatHistoryJson([entry]);
    const parsed = JSON.parse(result);

    expect(parsed[0].id).toBe(entry.id);
    expect(parsed[0].timestamp).toBe(entry.timestamp);
    expect(parsed[0].operationType).toBe(entry.operationType);
    expect(parsed[0].fileCount).toBe(entry.fileCount);
    expect(parsed[0].summary).toEqual(entry.summary);
    expect(parsed[0].durationMs).toBe(entry.durationMs);
    expect(parsed[0].files).toHaveLength(entry.files.length);
  });

  it('should preserve file records', () => {
    const entry = createMockEntry();
    const result = formatHistoryJson([entry]);
    const parsed = JSON.parse(result);

    expect(parsed[0].files[0].originalPath).toBe('/test/file1.txt');
    expect(parsed[0].files[0].newPath).toBe('/test/file1-renamed.txt');
    expect(parsed[0].files[1].error).toBe('Permission denied');
  });

  it('should be pretty-printed with indentation', () => {
    const entry = createMockEntry();
    const result = formatHistoryJson([entry]);

    // Pretty-printed JSON has newlines
    expect(result.split('\n').length).toBeGreaterThan(1);
  });
});

// =============================================================================
// Test Suite: formatHistoryPlain
// =============================================================================

describe('formatHistoryPlain', () => {
  it('should return empty string for empty array', () => {
    const result = formatHistoryPlain([]);

    expect(result).toBe('');
  });

  it('should return one ID per line', () => {
    const entries = [
      createMockEntry({ id: 'id-1' }),
      createMockEntry({ id: 'id-2' }),
      createMockEntry({ id: 'id-3' }),
    ];
    const result = formatHistoryPlain(entries);
    const lines = result.split('\n');

    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe('id-1');
    expect(lines[1]).toBe('id-2');
    expect(lines[2]).toBe('id-3');
  });

  it('should handle single entry', () => {
    const entry = createMockEntry({ id: 'single-id' });
    const result = formatHistoryPlain([entry]);

    expect(result).toBe('single-id');
  });
});

// =============================================================================
// Test Suite: formatHistoryEntryDetail
// =============================================================================

describe('formatHistoryEntryDetail', () => {
  it('should include entry ID', () => {
    const entry = createMockEntry({ id: 'detail-id-123' });
    const result = formatHistoryEntryDetail(entry, { color: false });

    expect(result).toContain('ID:        detail-id-123');
  });

  it('should include operation type', () => {
    const entry = createMockEntry({ operationType: 'move' });
    const result = formatHistoryEntryDetail(entry, { color: false });

    expect(result).toContain('Type:      move');
  });

  it('should include duration', () => {
    const entry = createMockEntry({ durationMs: 500 });
    const result = formatHistoryEntryDetail(entry, { color: false });

    expect(result).toContain('Duration:  500ms');
  });

  it('should include results summary', () => {
    const entry = createMockEntry({
      summary: { succeeded: 10, skipped: 2, failed: 3, directoriesCreated: 1 },
    });
    const result = formatHistoryEntryDetail(entry, { color: false });

    expect(result).toContain('Succeeded: 10');
    expect(result).toContain('Skipped:   2');
    expect(result).toContain('Failed:    3');
    expect(result).toContain('Directories created: 1');
  });

  it('should list created directories', () => {
    const entry = createMockEntry({
      summary: { succeeded: 5, skipped: 0, failed: 0, directoriesCreated: 2 },
      directoriesCreated: ['/test/dir1', '/test/dir2'],
    });
    const result = formatHistoryEntryDetail(entry, { color: false });

    expect(result).toContain('Directories Created');
    expect(result).toContain('/test/dir1');
    expect(result).toContain('/test/dir2');
  });

  it('should not show directories section when none created', () => {
    const entry = createMockEntry({ directoriesCreated: [] });
    const result = formatHistoryEntryDetail(entry, { color: false });

    expect(result).not.toContain('Directories Created');
  });

  it('should show file list with success indicator', () => {
    const entry = createMockEntry();
    const result = formatHistoryEntryDetail(entry, { color: false });

    expect(result).toContain('✓ /test/file1.txt → /test/file1-renamed.txt');
  });

  it('should show file list with failure indicator', () => {
    const entry = createMockEntry();
    const result = formatHistoryEntryDetail(entry, { color: false });

    expect(result).toContain('✗ /test/file2.txt');
    expect(result).toContain('Error: Permission denied');
  });

  it('should include section headers', () => {
    const entry = createMockEntry();
    const result = formatHistoryEntryDetail(entry, { color: false });

    expect(result).toContain('Operation Details');
    expect(result).toContain('Results');
    expect(result).toContain('Files');
  });

  it('should handle entry with all files succeeded', () => {
    const entry = createMockEntry({
      files: [
        {
          originalPath: '/test/a.txt',
          newPath: '/test/a-new.txt',
          isMoveOperation: false,
          success: true,
          error: null,
        },
      ],
      summary: { succeeded: 1, skipped: 0, failed: 0, directoriesCreated: 0 },
    });
    const result = formatHistoryEntryDetail(entry, { color: false });

    expect(result).toContain('✓ /test/a.txt → /test/a-new.txt');
    expect(result).not.toContain('✗');
  });

  it('should handle file with no new path (failed)', () => {
    const entry = createMockEntry({
      files: [
        {
          originalPath: '/test/fail.txt',
          newPath: null,
          isMoveOperation: false,
          success: false,
          error: 'File not found',
        },
      ],
    });
    const result = formatHistoryEntryDetail(entry, { color: false });

    expect(result).toContain('✗ /test/fail.txt');
    expect(result).not.toContain(' → ');
    expect(result).toContain('Error: File not found');
  });
});
