/**
 * @fileoverview Tests for history query functions - Story 9.2
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getHistory, getHistoryEntry, getHistoryCount } from './query.js';
import * as storage from './storage.js';
import type { HistoryStore, OperationHistoryEntry } from '../types/operation-history.js';
import { ok, err } from '../types/result.js';

// =============================================================================
// Test Fixtures
// =============================================================================

function createMockEntry(overrides: Partial<OperationHistoryEntry> = {}): OperationHistoryEntry {
  return {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
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
    ],
    directoriesCreated: [],
    ...overrides,
  };
}

function createMockStore(entries: OperationHistoryEntry[] = []): HistoryStore {
  return {
    version: 1,
    lastPruned: null,
    entries,
  };
}

// =============================================================================
// Test Suite: getHistory
// =============================================================================

describe('getHistory', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return empty array when no history exists', async () => {
    vi.spyOn(storage, 'loadHistory').mockResolvedValue(ok(createMockStore([])));

    const result = await getHistory();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual([]);
    }
  });

  it('should return all entries when no options provided', async () => {
    const entries = [
      createMockEntry({ id: 'entry-1' }),
      createMockEntry({ id: 'entry-2' }),
      createMockEntry({ id: 'entry-3' }),
    ];
    vi.spyOn(storage, 'loadHistory').mockResolvedValue(ok(createMockStore(entries)));

    const result = await getHistory();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(3);
    }
  });

  it('should limit results when limit option is provided', async () => {
    const entries = [
      createMockEntry({ id: 'entry-1' }),
      createMockEntry({ id: 'entry-2' }),
      createMockEntry({ id: 'entry-3' }),
      createMockEntry({ id: 'entry-4' }),
      createMockEntry({ id: 'entry-5' }),
    ];
    vi.spyOn(storage, 'loadHistory').mockResolvedValue(ok(createMockStore(entries)));

    const result = await getHistory({ limit: 3 });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(3);
      expect(result.data[0].id).toBe('entry-1');
      expect(result.data[2].id).toBe('entry-3');
    }
  });

  it('should return all entries when limit exceeds count', async () => {
    const entries = [
      createMockEntry({ id: 'entry-1' }),
      createMockEntry({ id: 'entry-2' }),
    ];
    vi.spyOn(storage, 'loadHistory').mockResolvedValue(ok(createMockStore(entries)));

    const result = await getHistory({ limit: 10 });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(2);
    }
  });

  it('should ignore limit when it is 0', async () => {
    const entries = [
      createMockEntry({ id: 'entry-1' }),
      createMockEntry({ id: 'entry-2' }),
      createMockEntry({ id: 'entry-3' }),
    ];
    vi.spyOn(storage, 'loadHistory').mockResolvedValue(ok(createMockStore(entries)));

    const result = await getHistory({ limit: 0 });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(3);
    }
  });

  it('should ignore negative limit', async () => {
    const entries = [
      createMockEntry({ id: 'entry-1' }),
      createMockEntry({ id: 'entry-2' }),
    ];
    vi.spyOn(storage, 'loadHistory').mockResolvedValue(ok(createMockStore(entries)));

    const result = await getHistory({ limit: -5 });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(2);
    }
  });

  it('should filter by operation type - rename', async () => {
    const entries = [
      createMockEntry({ id: 'entry-1', operationType: 'rename' }),
      createMockEntry({ id: 'entry-2', operationType: 'move' }),
      createMockEntry({ id: 'entry-3', operationType: 'rename' }),
      createMockEntry({ id: 'entry-4', operationType: 'organize' }),
    ];
    vi.spyOn(storage, 'loadHistory').mockResolvedValue(ok(createMockStore(entries)));

    const result = await getHistory({ type: 'rename' });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(2);
      expect(result.data.every((e) => e.operationType === 'rename')).toBe(true);
    }
  });

  it('should filter by operation type - move', async () => {
    const entries = [
      createMockEntry({ id: 'entry-1', operationType: 'rename' }),
      createMockEntry({ id: 'entry-2', operationType: 'move' }),
      createMockEntry({ id: 'entry-3', operationType: 'move' }),
    ];
    vi.spyOn(storage, 'loadHistory').mockResolvedValue(ok(createMockStore(entries)));

    const result = await getHistory({ type: 'move' });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(2);
      expect(result.data.every((e) => e.operationType === 'move')).toBe(true);
    }
  });

  it('should filter by operation type - organize', async () => {
    const entries = [
      createMockEntry({ id: 'entry-1', operationType: 'rename' }),
      createMockEntry({ id: 'entry-2', operationType: 'organize' }),
    ];
    vi.spyOn(storage, 'loadHistory').mockResolvedValue(ok(createMockStore(entries)));

    const result = await getHistory({ type: 'organize' });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0].operationType).toBe('organize');
    }
  });

  it('should return empty array when type filter matches nothing', async () => {
    const entries = [
      createMockEntry({ id: 'entry-1', operationType: 'rename' }),
      createMockEntry({ id: 'entry-2', operationType: 'rename' }),
    ];
    vi.spyOn(storage, 'loadHistory').mockResolvedValue(ok(createMockStore(entries)));

    const result = await getHistory({ type: 'move' });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(0);
    }
  });

  it('should combine limit and type filter', async () => {
    const entries = [
      createMockEntry({ id: 'entry-1', operationType: 'rename' }),
      createMockEntry({ id: 'entry-2', operationType: 'move' }),
      createMockEntry({ id: 'entry-3', operationType: 'rename' }),
      createMockEntry({ id: 'entry-4', operationType: 'rename' }),
      createMockEntry({ id: 'entry-5', operationType: 'move' }),
    ];
    vi.spyOn(storage, 'loadHistory').mockResolvedValue(ok(createMockStore(entries)));

    const result = await getHistory({ limit: 2, type: 'rename' });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(2);
      expect(result.data[0].id).toBe('entry-1');
      expect(result.data[1].id).toBe('entry-3');
    }
  });

  it('should propagate storage errors', async () => {
    const error = new Error('Storage error');
    vi.spyOn(storage, 'loadHistory').mockResolvedValue(err(error));

    const result = await getHistory();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toBe('Storage error');
    }
  });
});

// =============================================================================
// Test Suite: getHistoryEntry
// =============================================================================

describe('getHistoryEntry', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return entry when ID exists', async () => {
    const targetId = '550e8400-e29b-41d4-a716-446655440000';
    const entries = [
      createMockEntry({ id: 'other-id-1' }),
      createMockEntry({ id: targetId }),
      createMockEntry({ id: 'other-id-2' }),
    ];
    vi.spyOn(storage, 'loadHistory').mockResolvedValue(ok(createMockStore(entries)));

    const result = await getHistoryEntry(targetId);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).not.toBeNull();
      expect(result.data?.id).toBe(targetId);
    }
  });

  it('should return null when ID does not exist', async () => {
    const entries = [
      createMockEntry({ id: 'entry-1' }),
      createMockEntry({ id: 'entry-2' }),
    ];
    vi.spyOn(storage, 'loadHistory').mockResolvedValue(ok(createMockStore(entries)));

    const result = await getHistoryEntry('non-existent-id');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toBeNull();
    }
  });

  it('should return null when history is empty', async () => {
    vi.spyOn(storage, 'loadHistory').mockResolvedValue(ok(createMockStore([])));

    const result = await getHistoryEntry('any-id');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toBeNull();
    }
  });

  it('should propagate storage errors', async () => {
    const error = new Error('Read error');
    vi.spyOn(storage, 'loadHistory').mockResolvedValue(err(error));

    const result = await getHistoryEntry('any-id');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toBe('Read error');
    }
  });

  it('should return complete entry data', async () => {
    const fullEntry = createMockEntry({
      id: 'full-entry',
      operationType: 'move',
      fileCount: 10,
      summary: {
        succeeded: 8,
        skipped: 1,
        failed: 1,
        directoriesCreated: 3,
      },
      durationMs: 500,
      directoriesCreated: ['/test/dir1', '/test/dir2', '/test/dir3'],
    });
    vi.spyOn(storage, 'loadHistory').mockResolvedValue(ok(createMockStore([fullEntry])));

    const result = await getHistoryEntry('full-entry');

    expect(result.ok).toBe(true);
    if (result.ok && result.data) {
      expect(result.data.operationType).toBe('move');
      expect(result.data.fileCount).toBe(10);
      expect(result.data.summary.succeeded).toBe(8);
      expect(result.data.summary.directoriesCreated).toBe(3);
      expect(result.data.directoriesCreated).toHaveLength(3);
    }
  });
});

// =============================================================================
// Test Suite: getHistoryCount
// =============================================================================

describe('getHistoryCount', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return 0 when no history exists', async () => {
    vi.spyOn(storage, 'loadHistory').mockResolvedValue(ok(createMockStore([])));

    const result = await getHistoryCount();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toBe(0);
    }
  });

  it('should return total count when no type filter', async () => {
    const entries = [
      createMockEntry({ id: 'entry-1' }),
      createMockEntry({ id: 'entry-2' }),
      createMockEntry({ id: 'entry-3' }),
    ];
    vi.spyOn(storage, 'loadHistory').mockResolvedValue(ok(createMockStore(entries)));

    const result = await getHistoryCount();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toBe(3);
    }
  });

  it('should return filtered count by type', async () => {
    const entries = [
      createMockEntry({ id: 'entry-1', operationType: 'rename' }),
      createMockEntry({ id: 'entry-2', operationType: 'move' }),
      createMockEntry({ id: 'entry-3', operationType: 'rename' }),
      createMockEntry({ id: 'entry-4', operationType: 'organize' }),
    ];
    vi.spyOn(storage, 'loadHistory').mockResolvedValue(ok(createMockStore(entries)));

    const renameResult = await getHistoryCount('rename');
    const moveResult = await getHistoryCount('move');
    const organizeResult = await getHistoryCount('organize');

    expect(renameResult.ok).toBe(true);
    expect(moveResult.ok).toBe(true);
    expect(organizeResult.ok).toBe(true);

    if (renameResult.ok && moveResult.ok && organizeResult.ok) {
      expect(renameResult.data).toBe(2);
      expect(moveResult.data).toBe(1);
      expect(organizeResult.data).toBe(1);
    }
  });

  it('should return 0 when type filter matches nothing', async () => {
    const entries = [
      createMockEntry({ id: 'entry-1', operationType: 'rename' }),
    ];
    vi.spyOn(storage, 'loadHistory').mockResolvedValue(ok(createMockStore(entries)));

    const result = await getHistoryCount('move');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toBe(0);
    }
  });

  it('should propagate storage errors', async () => {
    const error = new Error('Count error');
    vi.spyOn(storage, 'loadHistory').mockResolvedValue(err(error));

    const result = await getHistoryCount();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toBe('Count error');
    }
  });
});
