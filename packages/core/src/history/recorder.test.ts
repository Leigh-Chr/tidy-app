/**
 * @fileoverview Tests for history recorder - Story 9.1
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  recordOperation,
  createEntryFromResult,
  determineOperationType,
} from './recorder.js';
import { loadHistory, saveHistory } from './storage.js';
import { createEmptyHistoryStore, HISTORY_STORE_VERSION } from '../types/operation-history.js';
import type { BatchRenameResult, FileRenameResult } from '../types/rename-result.js';
import { RenameOutcome } from '../types/rename-result.js';
import type { HistoryStore, OperationHistoryEntry } from '../types/operation-history.js';

// Mock storage module
vi.mock('./storage.js', () => ({
  loadHistory: vi.fn(),
  saveHistory: vi.fn(),
}));

// Mock crypto.randomUUID
vi.mock('node:crypto', () => ({
  randomUUID: vi.fn(() => '550e8400-e29b-41d4-a716-446655440000'),
}));

const mockedLoadHistory = vi.mocked(loadHistory);
const mockedSaveHistory = vi.mocked(saveHistory);

describe('history recorder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-10T14:30:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetAllMocks();
  });

  const createSuccessfulRenameResult = (): BatchRenameResult => ({
    success: true,
    results: [
      {
        proposalId: 'prop-1',
        originalPath: '/home/user/old-file.pdf',
        originalName: 'old-file.pdf',
        newPath: '/home/user/new-file.pdf',
        newName: 'new-file.pdf',
        outcome: RenameOutcome.SUCCESS,
        error: null,
      },
    ],
    summary: {
      total: 1,
      succeeded: 1,
      skipped: 0,
      failed: 0,
      directoriesCreated: 0,
    },
    startedAt: new Date('2026-01-10T14:29:59.000Z'),
    completedAt: new Date('2026-01-10T14:30:00.000Z'),
    durationMs: 1000,
    aborted: false,
    directoriesCreated: [],
  });

  const createMoveResult = (): BatchRenameResult => ({
    success: true,
    results: [
      {
        proposalId: 'prop-1',
        originalPath: '/home/user/file.pdf',
        originalName: 'file.pdf',
        newPath: '/home/user/archive/2026/file.pdf',
        newName: 'file.pdf',
        outcome: RenameOutcome.SUCCESS,
        error: null,
        isMoveOperation: true,
      } as FileRenameResult & { isMoveOperation?: boolean },
    ],
    summary: {
      total: 1,
      succeeded: 1,
      skipped: 0,
      failed: 0,
      directoriesCreated: 1,
    },
    startedAt: new Date('2026-01-10T14:29:59.000Z'),
    completedAt: new Date('2026-01-10T14:30:00.000Z'),
    durationMs: 1500,
    aborted: false,
    directoriesCreated: ['/home/user/archive/2026'],
  });

  const createPartialSuccessResult = (): BatchRenameResult => ({
    success: false,
    results: [
      {
        proposalId: 'prop-1',
        originalPath: '/home/user/file1.pdf',
        originalName: 'file1.pdf',
        newPath: '/home/user/new-file1.pdf',
        newName: 'new-file1.pdf',
        outcome: RenameOutcome.SUCCESS,
        error: null,
      },
      {
        proposalId: 'prop-2',
        originalPath: '/home/user/file2.pdf',
        originalName: 'file2.pdf',
        newPath: null,
        newName: null,
        outcome: RenameOutcome.FAILED,
        error: 'Permission denied',
      },
      {
        proposalId: 'prop-3',
        originalPath: '/home/user/file3.pdf',
        originalName: 'file3.pdf',
        newPath: null,
        newName: null,
        outcome: RenameOutcome.SKIPPED,
        error: 'No change needed',
      },
    ],
    summary: {
      total: 3,
      succeeded: 1,
      skipped: 1,
      failed: 1,
      directoriesCreated: 0,
    },
    startedAt: new Date('2026-01-10T14:29:58.000Z'),
    completedAt: new Date('2026-01-10T14:30:00.000Z'),
    durationMs: 2000,
    aborted: false,
    directoriesCreated: [],
  });

  describe('determineOperationType', () => {
    it('should return "rename" for simple rename operations', () => {
      const results = createSuccessfulRenameResult().results;
      const type = determineOperationType(results);
      expect(type).toBe('rename');
    });

    it('should return "move" when isMoveOperation flag is present', () => {
      const results = createMoveResult().results;
      const type = determineOperationType(results);
      expect(type).toBe('move');
    });

    it('should return "move" when any file has isMoveOperation=true', () => {
      const results = [
        {
          proposalId: 'prop-1',
          originalPath: '/a.pdf',
          originalName: 'a.pdf',
          newPath: '/b.pdf',
          newName: 'b.pdf',
          outcome: RenameOutcome.SUCCESS,
          error: null,
        },
        {
          proposalId: 'prop-2',
          originalPath: '/c.pdf',
          originalName: 'c.pdf',
          newPath: '/folder/c.pdf',
          newName: 'c.pdf',
          outcome: RenameOutcome.SUCCESS,
          error: null,
          isMoveOperation: true,
        } as FileRenameResult & { isMoveOperation?: boolean },
      ];
      const type = determineOperationType(results);
      expect(type).toBe('move');
    });

    it('should return "rename" for empty results array', () => {
      const type = determineOperationType([]);
      expect(type).toBe('rename');
    });
  });

  describe('createEntryFromResult', () => {
    it('should create entry with UUID id', () => {
      const result = createSuccessfulRenameResult();
      const entry = createEntryFromResult(result);
      expect(entry.id).toBe('550e8400-e29b-41d4-a716-446655440000');
    });

    it('should create entry with ISO 8601 timestamp', () => {
      const result = createSuccessfulRenameResult();
      const entry = createEntryFromResult(result);
      expect(entry.timestamp).toBe('2026-01-10T14:30:00.000Z');
    });

    it('should extract file count from results', () => {
      const result = createPartialSuccessResult();
      const entry = createEntryFromResult(result);
      expect(entry.fileCount).toBe(3);
    });

    it('should extract summary statistics', () => {
      const result = createPartialSuccessResult();
      const entry = createEntryFromResult(result);
      expect(entry.summary).toEqual({
        succeeded: 1,
        skipped: 1,
        failed: 1,
        directoriesCreated: 0,
      });
    });

    it('should extract duration', () => {
      const result = createSuccessfulRenameResult();
      const entry = createEntryFromResult(result);
      expect(entry.durationMs).toBe(1000);
    });

    it('should create file records from results', () => {
      const result = createSuccessfulRenameResult();
      const entry = createEntryFromResult(result);
      expect(entry.files).toHaveLength(1);
      expect(entry.files[0]).toEqual({
        originalPath: '/home/user/old-file.pdf',
        newPath: '/home/user/new-file.pdf',
        isMoveOperation: false,
        success: true,
        error: null,
      });
    });

    it('should mark failed files with success=false', () => {
      const result = createPartialSuccessResult();
      const entry = createEntryFromResult(result);
      const failedFile = entry.files.find((f) => f.originalPath === '/home/user/file2.pdf');
      expect(failedFile?.success).toBe(false);
      expect(failedFile?.error).toBe('Permission denied');
    });

    it('should preserve directoriesCreated', () => {
      const result = createMoveResult();
      const entry = createEntryFromResult(result);
      expect(entry.directoriesCreated).toEqual(['/home/user/archive/2026']);
    });

    it('should set operationType to "move" for move operations', () => {
      const result = createMoveResult();
      const entry = createEntryFromResult(result);
      expect(entry.operationType).toBe('move');
    });

    it('should set operationType to "rename" for rename operations', () => {
      const result = createSuccessfulRenameResult();
      const entry = createEntryFromResult(result);
      expect(entry.operationType).toBe('rename');
    });

    it('should handle null newPath for failed operations', () => {
      const result = createPartialSuccessResult();
      const entry = createEntryFromResult(result);
      const failedFile = entry.files.find((f) => f.originalPath === '/home/user/file2.pdf');
      expect(failedFile?.newPath).toBeNull();
    });
  });

  describe('recordOperation', () => {
    it('should load existing history and append entry', async () => {
      const existingStore = createEmptyHistoryStore();
      mockedLoadHistory.mockResolvedValueOnce({ ok: true, data: existingStore });
      mockedSaveHistory.mockResolvedValueOnce({ ok: true, data: undefined });

      const result = createSuccessfulRenameResult();
      const recordResult = await recordOperation(result);

      expect(recordResult.ok).toBe(true);
      if (recordResult.ok) {
        expect(recordResult.data.id).toBe('550e8400-e29b-41d4-a716-446655440000');
      }
    });

    it('should prepend new entry to entries array (newest first)', async () => {
      const existingEntry: OperationHistoryEntry = {
        id: 'old-entry-id-00000000-0000-0000-0000',
        timestamp: '2026-01-09T10:00:00.000Z',
        operationType: 'rename',
        fileCount: 1,
        summary: { succeeded: 1, skipped: 0, failed: 0, directoriesCreated: 0 },
        durationMs: 100,
        files: [],
        directoriesCreated: [],
      };
      const existingStore: HistoryStore = {
        version: HISTORY_STORE_VERSION,
        lastPruned: null,
        entries: [existingEntry],
      };

      mockedLoadHistory.mockResolvedValueOnce({ ok: true, data: existingStore });
      mockedSaveHistory.mockResolvedValueOnce({ ok: true, data: undefined });

      const result = createSuccessfulRenameResult();
      await recordOperation(result);

      // Check that saveHistory was called with new entry first
      const saveCall = mockedSaveHistory.mock.calls[0];
      const savedStore = saveCall?.[0] as HistoryStore;
      expect(savedStore.entries).toHaveLength(2);
      expect(savedStore.entries[0]?.id).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(savedStore.entries[1]?.id).toBe('old-entry-id-00000000-0000-0000-0000');
    });

    it('should return error when loadHistory fails', async () => {
      mockedLoadHistory.mockResolvedValueOnce({
        ok: false,
        error: new Error('Load failed'),
      });

      const result = createSuccessfulRenameResult();
      const recordResult = await recordOperation(result);

      expect(recordResult.ok).toBe(false);
      if (!recordResult.ok) {
        expect(recordResult.error.message).toContain('Load failed');
      }
    });

    it('should return error when saveHistory fails', async () => {
      mockedLoadHistory.mockResolvedValueOnce({ ok: true, data: createEmptyHistoryStore() });
      mockedSaveHistory.mockResolvedValueOnce({
        ok: false,
        error: new Error('Save failed'),
      });

      const result = createSuccessfulRenameResult();
      const recordResult = await recordOperation(result);

      expect(recordResult.ok).toBe(false);
      if (!recordResult.ok) {
        expect(recordResult.error.message).toContain('Save failed');
      }
    });

    it('should use provided store instead of loading from disk', async () => {
      const providedStore = createEmptyHistoryStore();
      mockedSaveHistory.mockResolvedValueOnce({ ok: true, data: undefined });

      const result = createSuccessfulRenameResult();
      await recordOperation(result, { store: providedStore });

      // loadHistory should NOT have been called
      expect(mockedLoadHistory).not.toHaveBeenCalled();
    });

    it('should record move operations correctly', async () => {
      mockedLoadHistory.mockResolvedValueOnce({ ok: true, data: createEmptyHistoryStore() });
      mockedSaveHistory.mockResolvedValueOnce({ ok: true, data: undefined });

      const result = createMoveResult();
      const recordResult = await recordOperation(result);

      expect(recordResult.ok).toBe(true);
      if (recordResult.ok) {
        expect(recordResult.data.operationType).toBe('move');
        expect(recordResult.data.directoriesCreated).toEqual(['/home/user/archive/2026']);
      }
    });

    it('should record partial success operations correctly', async () => {
      mockedLoadHistory.mockResolvedValueOnce({ ok: true, data: createEmptyHistoryStore() });
      mockedSaveHistory.mockResolvedValueOnce({ ok: true, data: undefined });

      const result = createPartialSuccessResult();
      const recordResult = await recordOperation(result);

      expect(recordResult.ok).toBe(true);
      if (recordResult.ok) {
        expect(recordResult.data.summary.succeeded).toBe(1);
        expect(recordResult.data.summary.failed).toBe(1);
        expect(recordResult.data.summary.skipped).toBe(1);
        expect(recordResult.data.files.filter((f) => f.success)).toHaveLength(1);
        expect(recordResult.data.files.filter((f) => !f.success)).toHaveLength(2);
      }
    });
  });
});
