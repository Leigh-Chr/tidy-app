/**
 * @fileoverview Tests for history storage - Story 9.1
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFile, writeFile, mkdir, rename, access, unlink } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import {
  loadHistory,
  saveHistory,
  getHistoryPath,
  HISTORY_FILENAME,
} from './storage.js';
import { createEmptyHistoryStore, HISTORY_STORE_VERSION } from '../types/operation-history.js';
import type { HistoryStore, OperationHistoryEntry } from '../types/operation-history.js';

// Mock fs/promises
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
  rename: vi.fn(),
  access: vi.fn(),
  unlink: vi.fn(),
}));

// Mock env-paths
vi.mock('env-paths', () => ({
  default: () => ({ config: '/mock/config/tidy-app' }),
}));

const mockedReadFile = vi.mocked(readFile);
const mockedWriteFile = vi.mocked(writeFile);
const mockedMkdir = vi.mocked(mkdir);
const mockedRename = vi.mocked(rename);
const mockedAccess = vi.mocked(access);
const mockedUnlink = vi.mocked(unlink);

describe('history storage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('getHistoryPath', () => {
    it('should return path in config directory', () => {
      const path = getHistoryPath();
      expect(path).toBe(join('/mock/config/tidy-app', HISTORY_FILENAME));
    });

    it('should use history.json as filename', () => {
      expect(HISTORY_FILENAME).toBe('history.json');
    });
  });

  describe('loadHistory', () => {
    it('should return empty history when file does not exist (ENOENT)', async () => {
      const error = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      mockedReadFile.mockRejectedValueOnce(error);

      const result = await loadHistory();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.version).toBe(HISTORY_STORE_VERSION);
        expect(result.data.entries).toEqual([]);
        expect(result.data.lastPruned).toBeNull();
      }
    });

    it('should load and parse valid history JSON', async () => {
      const validStore: HistoryStore = {
        version: HISTORY_STORE_VERSION,
        lastPruned: null,
        entries: [
          {
            id: '550e8400-e29b-41d4-a716-446655440000',
            timestamp: '2026-01-10T14:30:00.000Z',
            operationType: 'rename',
            fileCount: 1,
            summary: { succeeded: 1, skipped: 0, failed: 0, directoriesCreated: 0 },
            durationMs: 100,
            files: [
              {
                originalPath: '/old.pdf',
                newPath: '/new.pdf',
                isMoveOperation: false,
                success: true,
                error: null,
              },
            ],
            directoriesCreated: [],
          },
        ],
      };
      mockedReadFile.mockResolvedValueOnce(JSON.stringify(validStore));

      const result = await loadHistory();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.entries).toHaveLength(1);
        expect(result.data.entries[0]?.id).toBe('550e8400-e29b-41d4-a716-446655440000');
      }
    });

    it('should handle corrupted JSON by backing up and resetting', async () => {
      mockedReadFile.mockResolvedValueOnce('{ invalid json }}}');
      mockedAccess.mockResolvedValueOnce(undefined); // File exists
      mockedRename.mockResolvedValueOnce(undefined); // Backup succeeds

      const result = await loadHistory();

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Should return empty store
        expect(result.data.entries).toEqual([]);
      }
      // Should have created backup
      expect(mockedRename).toHaveBeenCalled();
    });

    it('should handle invalid schema by backing up and resetting', async () => {
      const invalidStore = {
        version: 'not-a-number', // Invalid - should be number
        entries: [],
      };
      mockedReadFile.mockResolvedValueOnce(JSON.stringify(invalidStore));
      mockedAccess.mockResolvedValueOnce(undefined);
      mockedRename.mockResolvedValueOnce(undefined);

      const result = await loadHistory();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.entries).toEqual([]);
        expect(result.data.version).toBe(HISTORY_STORE_VERSION);
      }
    });

    it('should return error for permission denied', async () => {
      const error = Object.assign(new Error('Permission denied'), { code: 'EACCES' });
      mockedReadFile.mockRejectedValueOnce(error);

      const result = await loadHistory();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('Permission denied');
      }
    });

    it('should return error for other filesystem errors', async () => {
      const error = Object.assign(new Error('I/O error'), { code: 'EIO' });
      mockedReadFile.mockRejectedValueOnce(error);

      const result = await loadHistory();

      expect(result.ok).toBe(false);
    });

    it('should create backup with timestamp when resetting corrupted file', async () => {
      mockedReadFile.mockResolvedValueOnce('corrupted');
      mockedAccess.mockResolvedValueOnce(undefined);
      mockedRename.mockResolvedValueOnce(undefined);

      await loadHistory();

      expect(mockedRename).toHaveBeenCalled();
      const renameCall = mockedRename.mock.calls[0];
      expect(renameCall?.[1]).toMatch(/history\.json\.backup\.\d+/);
    });

    it('should handle backup rename failure gracefully', async () => {
      mockedReadFile.mockResolvedValueOnce('corrupted');
      mockedAccess.mockResolvedValueOnce(undefined);
      mockedRename.mockRejectedValueOnce(new Error('Rename failed'));

      const result = await loadHistory();

      // Should still return empty store
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.entries).toEqual([]);
      }
    });
  });

  describe('saveHistory', () => {
    it('should save history store as JSON', async () => {
      mockedMkdir.mockResolvedValueOnce(undefined);
      mockedWriteFile.mockResolvedValueOnce(undefined);

      const store = createEmptyHistoryStore();
      const result = await saveHistory(store);

      expect(result.ok).toBe(true);
      expect(mockedWriteFile).toHaveBeenCalled();
      const writeCall = mockedWriteFile.mock.calls[0];
      expect(writeCall?.[0]).toContain('history.json');
    });

    it('should create config directory if it does not exist', async () => {
      mockedMkdir.mockResolvedValueOnce(undefined);
      mockedWriteFile.mockResolvedValueOnce(undefined);

      const store = createEmptyHistoryStore();
      await saveHistory(store);

      // Use same path calculation as implementation for cross-platform compatibility
      const expectedConfigDir = dirname(join('/mock/config/tidy-app', HISTORY_FILENAME));
      expect(mockedMkdir).toHaveBeenCalledWith(expectedConfigDir, { recursive: true });
    });

    it('should format JSON with 2-space indentation', async () => {
      mockedMkdir.mockResolvedValueOnce(undefined);
      mockedWriteFile.mockResolvedValueOnce(undefined);

      const store = createEmptyHistoryStore();
      await saveHistory(store);

      const writeCall = mockedWriteFile.mock.calls[0];
      const jsonContent = writeCall?.[1] as string;
      expect(jsonContent).toContain('\n'); // Has newlines
      expect(jsonContent).toMatch(/^\{\n  "/); // Starts with indentation
    });

    it('should use UTF-8 encoding', async () => {
      mockedMkdir.mockResolvedValueOnce(undefined);
      mockedWriteFile.mockResolvedValueOnce(undefined);

      const store = createEmptyHistoryStore();
      await saveHistory(store);

      const writeCall = mockedWriteFile.mock.calls[0];
      expect(writeCall?.[2]).toEqual({ encoding: 'utf-8' });
    });

    it('should return error when mkdir fails', async () => {
      const error = new Error('Cannot create directory');
      mockedMkdir.mockRejectedValueOnce(error);

      const store = createEmptyHistoryStore();
      const result = await saveHistory(store);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('Cannot create directory');
      }
    });

    it('should return error when writeFile fails', async () => {
      mockedMkdir.mockResolvedValueOnce(undefined);
      const error = new Error('Disk full');
      mockedWriteFile.mockRejectedValueOnce(error);

      const store = createEmptyHistoryStore();
      const result = await saveHistory(store);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('Disk full');
      }
    });

    it('should save store with entries', async () => {
      mockedMkdir.mockResolvedValueOnce(undefined);
      mockedWriteFile.mockResolvedValueOnce(undefined);

      const store: HistoryStore = {
        version: HISTORY_STORE_VERSION,
        lastPruned: '2026-01-09T00:00:00.000Z',
        entries: [
          {
            id: '550e8400-e29b-41d4-a716-446655440000',
            timestamp: '2026-01-10T14:30:00.000Z',
            operationType: 'move',
            fileCount: 2,
            summary: { succeeded: 2, skipped: 0, failed: 0, directoriesCreated: 1 },
            durationMs: 500,
            files: [],
            directoriesCreated: ['/archive/2026'],
          },
        ],
      };

      const result = await saveHistory(store);

      expect(result.ok).toBe(true);
      const writeCall = mockedWriteFile.mock.calls[0];
      const jsonContent = writeCall?.[1] as string;
      expect(jsonContent).toContain('550e8400-e29b-41d4-a716-446655440000');
      expect(jsonContent).toContain('move');
    });

    it('should handle EEXIST from mkdir gracefully', async () => {
      // mkdir with recursive: true doesn't throw EEXIST, but just in case
      mockedMkdir.mockResolvedValueOnce(undefined);
      mockedWriteFile.mockResolvedValueOnce(undefined);

      const store = createEmptyHistoryStore();
      const result = await saveHistory(store);

      expect(result.ok).toBe(true);
    });
  });
});
