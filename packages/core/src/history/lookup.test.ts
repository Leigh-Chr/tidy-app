/**
 * @fileoverview Tests for file history lookup - Story 9.4
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  lookupFileHistory,
  lookupMultipleFiles,
  hasFileBeenRenamed,
  getOriginalPath,
} from './lookup.js';
import * as storage from './storage.js';
import type { HistoryStore } from '../types/operation-history.js';
import { existsSync } from 'node:fs';

// Mock the storage module
vi.mock('./storage.js', () => ({
  loadHistory: vi.fn(),
}));

// Mock fs
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
}));

const mockLoadHistory = vi.mocked(storage.loadHistory);
const mockExistsSync = vi.mocked(existsSync);

// =============================================================================
// Test Data
// =============================================================================

const validUUID1 = '550e8400-e29b-41d4-a716-446655440000';
const validUUID2 = '660e8400-e29b-41d4-a716-446655440001';

function createMockHistoryStore(entries: HistoryStore['entries'] = []): HistoryStore {
  return {
    version: 1,
    entries,
    lastUpdated: '2026-01-11T10:00:00.000Z',
  };
}

function createMockEntry(
  id: string,
  timestamp: string,
  files: Array<{ originalPath: string; newPath: string | null; success: boolean }>
): HistoryStore['entries'][0] {
  return {
    id,
    timestamp,
    operationType: 'rename' as const,
    fileCount: files.length,
    summary: {
      succeeded: files.filter(f => f.success).length,
      skipped: 0,
      failed: files.filter(f => !f.success).length,
      directoriesCreated: 0,
    },
    durationMs: 100,
    files: files.map(f => ({
      originalPath: f.originalPath,
      newPath: f.newPath,
      isMoveOperation: false,
      success: f.success,
      error: f.success ? null : 'Error',
    })),
    directoriesCreated: [],
  };
}

// =============================================================================
// Test Suite: lookupFileHistory
// =============================================================================

describe('lookupFileHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return null for file not in history', async () => {
    mockLoadHistory.mockResolvedValue({
      ok: true,
      data: createMockHistoryStore([]),
    });

    const result = await lookupFileHistory('/test/unknown.txt');

    expect(result.ok).toBe(true);
    expect(result.ok && result.data).toBeNull();
  });

  it('should find file by original path', async () => {
    const store = createMockHistoryStore([
      createMockEntry(validUUID1, '2026-01-11T10:00:00.000Z', [
        { originalPath: '/test/original.txt', newPath: '/test/renamed.txt', success: true },
      ]),
    ]);
    mockLoadHistory.mockResolvedValue({ ok: true, data: store });

    const result = await lookupFileHistory('/test/original.txt');

    expect(result.ok).toBe(true);
    if (result.ok && result.data) {
      expect(result.data.found).toBe(true);
      expect(result.data.originalPath).toBe('/test/original.txt');
      expect(result.data.currentPath).toBe('/test/renamed.txt');
    }
  });

  it('should find file by new path (current location)', async () => {
    const store = createMockHistoryStore([
      createMockEntry(validUUID1, '2026-01-11T10:00:00.000Z', [
        { originalPath: '/test/original.txt', newPath: '/test/renamed.txt', success: true },
      ]),
    ]);
    mockLoadHistory.mockResolvedValue({ ok: true, data: store });

    const result = await lookupFileHistory('/test/renamed.txt');

    expect(result.ok).toBe(true);
    if (result.ok && result.data) {
      expect(result.data.found).toBe(true);
      expect(result.data.originalPath).toBe('/test/original.txt');
      expect(result.data.currentPath).toBe('/test/renamed.txt');
    }
  });

  it('should return operations sorted by timestamp (newest first)', async () => {
    const store = createMockHistoryStore([
      createMockEntry(validUUID1, '2026-01-11T10:00:00.000Z', [
        { originalPath: '/test/file.txt', newPath: '/test/first.txt', success: true },
      ]),
      createMockEntry(validUUID2, '2026-01-11T12:00:00.000Z', [
        { originalPath: '/test/first.txt', newPath: '/test/second.txt', success: true },
      ]),
    ]);
    mockLoadHistory.mockResolvedValue({ ok: true, data: store });

    const result = await lookupFileHistory('/test/file.txt');

    expect(result.ok).toBe(true);
    if (result.ok && result.data) {
      expect(result.data.operations).toHaveLength(1);
      expect(result.data.lastOperationId).toBe(validUUID1);
    }
  });

  it('should track multiple operations affecting same file', async () => {
    const store = createMockHistoryStore([
      createMockEntry(validUUID1, '2026-01-11T10:00:00.000Z', [
        { originalPath: '/test/file.txt', newPath: '/test/renamed.txt', success: true },
      ]),
      createMockEntry(validUUID2, '2026-01-11T12:00:00.000Z', [
        { originalPath: '/test/file.txt', newPath: '/test/another.txt', success: true },
      ]),
    ]);
    mockLoadHistory.mockResolvedValue({ ok: true, data: store });

    const result = await lookupFileHistory('/test/file.txt');

    expect(result.ok).toBe(true);
    if (result.ok && result.data) {
      expect(result.data.operations).toHaveLength(2);
      // Newest first
      expect(result.data.operations[0]!.operationId).toBe(validUUID2);
      expect(result.data.operations[1]!.operationId).toBe(validUUID1);
    }
  });

  it('should detect file at original location', async () => {
    const store = createMockHistoryStore([
      createMockEntry(validUUID1, '2026-01-11T10:00:00.000Z', [
        { originalPath: '/test/original.txt', newPath: '/test/renamed.txt', success: true },
      ]),
    ]);
    mockLoadHistory.mockResolvedValue({ ok: true, data: store });
    mockExistsSync.mockReturnValue(true);

    const result = await lookupFileHistory('/test/original.txt');

    expect(result.ok).toBe(true);
    if (result.ok && result.data) {
      expect(result.data.isAtOriginal).toBe(true);
    }
  });

  it('should detect file not at original location', async () => {
    const store = createMockHistoryStore([
      createMockEntry(validUUID1, '2026-01-11T10:00:00.000Z', [
        { originalPath: '/test/original.txt', newPath: '/test/renamed.txt', success: true },
      ]),
    ]);
    mockLoadHistory.mockResolvedValue({ ok: true, data: store });
    mockExistsSync.mockReturnValue(false);

    const result = await lookupFileHistory('/test/renamed.txt');

    expect(result.ok).toBe(true);
    if (result.ok && result.data) {
      expect(result.data.isAtOriginal).toBe(false);
    }
  });

  it('should return error when history load fails', async () => {
    mockLoadHistory.mockResolvedValue({
      ok: false,
      error: new Error('Permission denied'),
    });

    const result = await lookupFileHistory('/test/file.txt');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toBe('Permission denied');
    }
  });

  it('should include lastModified timestamp', async () => {
    const timestamp = '2026-01-11T15:30:00.000Z';
    const store = createMockHistoryStore([
      createMockEntry(validUUID1, timestamp, [
        { originalPath: '/test/original.txt', newPath: '/test/renamed.txt', success: true },
      ]),
    ]);
    mockLoadHistory.mockResolvedValue({ ok: true, data: store });

    const result = await lookupFileHistory('/test/original.txt');

    expect(result.ok).toBe(true);
    if (result.ok && result.data) {
      expect(result.data.lastModified).toBe(timestamp);
    }
  });

  it('should not match files with null newPath', async () => {
    const store = createMockHistoryStore([
      createMockEntry(validUUID1, '2026-01-11T10:00:00.000Z', [
        { originalPath: '/test/original.txt', newPath: null, success: false },
      ]),
    ]);
    mockLoadHistory.mockResolvedValue({ ok: true, data: store });

    const result = await lookupFileHistory('/test/null-path');

    expect(result.ok).toBe(true);
    expect(result.ok && result.data).toBeNull();
  });
});

// =============================================================================
// Test Suite: lookupMultipleFiles
// =============================================================================

describe('lookupMultipleFiles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(false);
  });

  it('should look up multiple files efficiently', async () => {
    const store = createMockHistoryStore([
      createMockEntry(validUUID1, '2026-01-11T10:00:00.000Z', [
        { originalPath: '/test/a.txt', newPath: '/test/a-renamed.txt', success: true },
        { originalPath: '/test/b.txt', newPath: '/test/b-renamed.txt', success: true },
      ]),
    ]);
    mockLoadHistory.mockResolvedValue({ ok: true, data: store });

    const result = await lookupMultipleFiles(['/test/a.txt', '/test/b.txt', '/test/unknown.txt']);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.size).toBe(3);
      expect(result.data.get('/test/a.txt')?.found).toBe(true);
      expect(result.data.get('/test/b.txt')?.found).toBe(true);
      expect(result.data.get('/test/unknown.txt')).toBeNull();
    }
  });

  it('should only call loadHistory once', async () => {
    const store = createMockHistoryStore([]);
    mockLoadHistory.mockResolvedValue({ ok: true, data: store });

    await lookupMultipleFiles(['/a.txt', '/b.txt', '/c.txt']);

    expect(mockLoadHistory).toHaveBeenCalledTimes(1);
  });

  it('should return error when history load fails', async () => {
    mockLoadHistory.mockResolvedValue({
      ok: false,
      error: new Error('Load failed'),
    });

    const result = await lookupMultipleFiles(['/test/file.txt']);

    expect(result.ok).toBe(false);
  });
});

// =============================================================================
// Test Suite: hasFileBeenRenamed
// =============================================================================

describe('hasFileBeenRenamed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return false for file not in history', async () => {
    mockLoadHistory.mockResolvedValue({
      ok: true,
      data: createMockHistoryStore([]),
    });

    const result = await hasFileBeenRenamed('/test/unknown.txt');

    expect(result.ok).toBe(true);
    expect(result.ok && result.data).toBe(false);
  });

  it('should return true for renamed file not at original', async () => {
    const store = createMockHistoryStore([
      createMockEntry(validUUID1, '2026-01-11T10:00:00.000Z', [
        { originalPath: '/test/original.txt', newPath: '/test/renamed.txt', success: true },
      ]),
    ]);
    mockLoadHistory.mockResolvedValue({ ok: true, data: store });
    mockExistsSync.mockReturnValue(false);

    const result = await hasFileBeenRenamed('/test/renamed.txt');

    expect(result.ok).toBe(true);
    expect(result.ok && result.data).toBe(true);
  });

  it('should return false for file at original location', async () => {
    const store = createMockHistoryStore([
      createMockEntry(validUUID1, '2026-01-11T10:00:00.000Z', [
        { originalPath: '/test/original.txt', newPath: '/test/renamed.txt', success: true },
      ]),
    ]);
    mockLoadHistory.mockResolvedValue({ ok: true, data: store });
    mockExistsSync.mockReturnValue(true);

    const result = await hasFileBeenRenamed('/test/original.txt');

    expect(result.ok).toBe(true);
    expect(result.ok && result.data).toBe(false);
  });
});

// =============================================================================
// Test Suite: getOriginalPath
// =============================================================================

describe('getOriginalPath', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return null for file not in history', async () => {
    mockLoadHistory.mockResolvedValue({
      ok: true,
      data: createMockHistoryStore([]),
    });

    const result = await getOriginalPath('/test/unknown.txt');

    expect(result.ok).toBe(true);
    expect(result.ok && result.data).toBeNull();
  });

  it('should return original path for renamed file', async () => {
    const store = createMockHistoryStore([
      createMockEntry(validUUID1, '2026-01-11T10:00:00.000Z', [
        { originalPath: '/test/original.txt', newPath: '/test/renamed.txt', success: true },
      ]),
    ]);
    mockLoadHistory.mockResolvedValue({ ok: true, data: store });
    mockExistsSync.mockReturnValue(false);

    const result = await getOriginalPath('/test/renamed.txt');

    expect(result.ok).toBe(true);
    expect(result.ok && result.data).toBe('/test/original.txt');
  });

  it('should return null for file already at original', async () => {
    const store = createMockHistoryStore([
      createMockEntry(validUUID1, '2026-01-11T10:00:00.000Z', [
        { originalPath: '/test/original.txt', newPath: '/test/renamed.txt', success: true },
      ]),
    ]);
    mockLoadHistory.mockResolvedValue({ ok: true, data: store });
    mockExistsSync.mockReturnValue(true);

    const result = await getOriginalPath('/test/original.txt');

    expect(result.ok).toBe(true);
    expect(result.ok && result.data).toBeNull();
  });
});
