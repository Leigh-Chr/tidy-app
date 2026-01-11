/**
 * @fileoverview Tests for operation history types - Story 9.1
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  operationTypeSchema,
  fileHistoryRecordSchema,
  operationHistoryEntrySchema,
  historyStoreSchema,
  pruneConfigSchema,
  createEmptyHistoryStore,
  HISTORY_STORE_VERSION,
  type OperationType,
  type FileHistoryRecord,
  type OperationHistoryEntry,
  type HistoryStore,
  type PruneConfig,
} from './operation-history.js';

describe('operation-history types', () => {
  describe('operationTypeSchema', () => {
    it('should accept "rename" as valid operation type', () => {
      const result = operationTypeSchema.safeParse('rename');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('rename');
      }
    });

    it('should accept "move" as valid operation type', () => {
      const result = operationTypeSchema.safeParse('move');
      expect(result.success).toBe(true);
    });

    it('should accept "organize" as valid operation type', () => {
      const result = operationTypeSchema.safeParse('organize');
      expect(result.success).toBe(true);
    });

    it('should reject invalid operation type', () => {
      const result = operationTypeSchema.safeParse('delete');
      expect(result.success).toBe(false);
    });
  });

  describe('fileHistoryRecordSchema', () => {
    it('should validate a successful rename record', () => {
      const record: FileHistoryRecord = {
        originalPath: '/home/user/docs/old-name.pdf',
        newPath: '/home/user/docs/new-name.pdf',
        isMoveOperation: false,
        success: true,
        error: null,
      };
      const result = fileHistoryRecordSchema.safeParse(record);
      expect(result.success).toBe(true);
    });

    it('should validate a successful move record', () => {
      const record: FileHistoryRecord = {
        originalPath: '/home/user/docs/file.pdf',
        newPath: '/home/user/archive/2026/file.pdf',
        isMoveOperation: true,
        success: true,
        error: null,
      };
      const result = fileHistoryRecordSchema.safeParse(record);
      expect(result.success).toBe(true);
    });

    it('should validate a failed record with error message', () => {
      const record: FileHistoryRecord = {
        originalPath: '/home/user/docs/file.pdf',
        newPath: null,
        isMoveOperation: false,
        success: false,
        error: 'Permission denied',
      };
      const result = fileHistoryRecordSchema.safeParse(record);
      expect(result.success).toBe(true);
    });

    it('should reject record with missing originalPath', () => {
      const record = {
        newPath: '/new/path.pdf',
        isMoveOperation: false,
        success: true,
        error: null,
      };
      const result = fileHistoryRecordSchema.safeParse(record);
      expect(result.success).toBe(false);
    });

    it('should reject record with missing success field', () => {
      const record = {
        originalPath: '/old/path.pdf',
        newPath: '/new/path.pdf',
        isMoveOperation: false,
        error: null,
      };
      const result = fileHistoryRecordSchema.safeParse(record);
      expect(result.success).toBe(false);
    });
  });

  describe('operationHistoryEntrySchema', () => {
    const validEntry: OperationHistoryEntry = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      timestamp: '2026-01-10T14:30:00.000Z',
      operationType: 'rename',
      fileCount: 5,
      summary: {
        succeeded: 4,
        skipped: 0,
        failed: 1,
        directoriesCreated: 0,
      },
      durationMs: 1250,
      files: [
        {
          originalPath: '/home/user/file1.pdf',
          newPath: '/home/user/file1-renamed.pdf',
          isMoveOperation: false,
          success: true,
          error: null,
        },
      ],
      directoriesCreated: [],
    };

    it('should validate a complete history entry', () => {
      const result = operationHistoryEntrySchema.safeParse(validEntry);
      expect(result.success).toBe(true);
    });

    it('should validate entry with UUID format', () => {
      const result = operationHistoryEntrySchema.safeParse(validEntry);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        );
      }
    });

    it('should reject entry with invalid UUID', () => {
      const invalidEntry = { ...validEntry, id: 'not-a-uuid' };
      const result = operationHistoryEntrySchema.safeParse(invalidEntry);
      expect(result.success).toBe(false);
    });

    it('should validate entry with ISO 8601 timestamp', () => {
      const result = operationHistoryEntrySchema.safeParse(validEntry);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(new Date(result.data.timestamp).toISOString()).toBe(result.data.timestamp);
      }
    });

    it('should reject entry with invalid timestamp format', () => {
      const invalidEntry = { ...validEntry, timestamp: '2026/01/10 14:30' };
      const result = operationHistoryEntrySchema.safeParse(invalidEntry);
      expect(result.success).toBe(false);
    });

    it('should validate move operation entry with directories created', () => {
      const moveEntry: OperationHistoryEntry = {
        ...validEntry,
        operationType: 'move',
        summary: { ...validEntry.summary, directoriesCreated: 2 },
        directoriesCreated: ['/home/user/archive/2026', '/home/user/archive/2026/01'],
      };
      const result = operationHistoryEntrySchema.safeParse(moveEntry);
      expect(result.success).toBe(true);
    });

    it('should reject entry with negative fileCount', () => {
      const invalidEntry = { ...validEntry, fileCount: -1 };
      const result = operationHistoryEntrySchema.safeParse(invalidEntry);
      expect(result.success).toBe(false);
    });

    it('should reject entry with negative durationMs', () => {
      const invalidEntry = { ...validEntry, durationMs: -100 };
      const result = operationHistoryEntrySchema.safeParse(invalidEntry);
      expect(result.success).toBe(false);
    });

    it('should reject entry missing summary fields', () => {
      const invalidEntry = {
        ...validEntry,
        summary: { succeeded: 4 }, // missing skipped, failed, directoriesCreated
      };
      const result = operationHistoryEntrySchema.safeParse(invalidEntry);
      expect(result.success).toBe(false);
    });

    // Story 9.3: undoneAt field tests
    it('should validate entry without undoneAt field (backward compatibility)', () => {
      const result = operationHistoryEntrySchema.safeParse(validEntry);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.undoneAt).toBeUndefined();
      }
    });

    it('should validate entry with null undoneAt (not undone)', () => {
      const entryWithNullUndone = { ...validEntry, undoneAt: null };
      const result = operationHistoryEntrySchema.safeParse(entryWithNullUndone);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.undoneAt).toBeNull();
      }
    });

    it('should validate entry with undoneAt timestamp (was undone)', () => {
      const entryUndone = { ...validEntry, undoneAt: '2026-01-10T15:00:00.000Z' };
      const result = operationHistoryEntrySchema.safeParse(entryUndone);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.undoneAt).toBe('2026-01-10T15:00:00.000Z');
      }
    });

    it('should reject entry with invalid undoneAt format', () => {
      const invalidEntry = { ...validEntry, undoneAt: '2026/01/10 15:00' };
      const result = operationHistoryEntrySchema.safeParse(invalidEntry);
      expect(result.success).toBe(false);
    });
  });

  describe('historyStoreSchema', () => {
    const validStore: HistoryStore = {
      version: HISTORY_STORE_VERSION,
      lastPruned: null,
      entries: [],
    };

    it('should validate an empty history store', () => {
      const result = historyStoreSchema.safeParse(validStore);
      expect(result.success).toBe(true);
    });

    it('should validate store with entries', () => {
      const storeWithEntries: HistoryStore = {
        ...validStore,
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
      const result = historyStoreSchema.safeParse(storeWithEntries);
      expect(result.success).toBe(true);
    });

    it('should validate store with lastPruned timestamp', () => {
      const storeWithPrune: HistoryStore = {
        ...validStore,
        lastPruned: '2026-01-09T00:00:00.000Z',
      };
      const result = historyStoreSchema.safeParse(storeWithPrune);
      expect(result.success).toBe(true);
    });

    it('should reject store with invalid version', () => {
      const invalidStore = { ...validStore, version: 'v1' };
      const result = historyStoreSchema.safeParse(invalidStore);
      expect(result.success).toBe(false);
    });

    it('should reject store with negative version', () => {
      const invalidStore = { ...validStore, version: -1 };
      const result = historyStoreSchema.safeParse(invalidStore);
      expect(result.success).toBe(false);
    });
  });

  describe('pruneConfigSchema', () => {
    it('should use default values when not provided', () => {
      const result = pruneConfigSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.maxEntries).toBe(100);
        expect(result.data.maxAgeDays).toBe(30);
      }
    });

    it('should validate custom prune config', () => {
      const config: PruneConfig = {
        maxEntries: 50,
        maxAgeDays: 14,
      };
      const result = pruneConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.maxEntries).toBe(50);
        expect(result.data.maxAgeDays).toBe(14);
      }
    });

    it('should reject negative maxEntries', () => {
      const result = pruneConfigSchema.safeParse({ maxEntries: -10 });
      expect(result.success).toBe(false);
    });

    it('should reject negative maxAgeDays', () => {
      const result = pruneConfigSchema.safeParse({ maxAgeDays: -5 });
      expect(result.success).toBe(false);
    });

    it('should allow zero for maxEntries (disable count limit)', () => {
      const result = pruneConfigSchema.safeParse({ maxEntries: 0 });
      expect(result.success).toBe(true);
    });

    it('should allow zero for maxAgeDays (disable age limit)', () => {
      const result = pruneConfigSchema.safeParse({ maxAgeDays: 0 });
      expect(result.success).toBe(true);
    });
  });

  describe('createEmptyHistoryStore', () => {
    it('should create a valid empty history store', () => {
      const store = createEmptyHistoryStore();
      const result = historyStoreSchema.safeParse(store);
      expect(result.success).toBe(true);
    });

    it('should have current version', () => {
      const store = createEmptyHistoryStore();
      expect(store.version).toBe(HISTORY_STORE_VERSION);
    });

    it('should have null lastPruned', () => {
      const store = createEmptyHistoryStore();
      expect(store.lastPruned).toBeNull();
    });

    it('should have empty entries array', () => {
      const store = createEmptyHistoryStore();
      expect(store.entries).toEqual([]);
    });
  });

  describe('HISTORY_STORE_VERSION', () => {
    it('should be a positive integer', () => {
      expect(HISTORY_STORE_VERSION).toBeGreaterThan(0);
      expect(Number.isInteger(HISTORY_STORE_VERSION)).toBe(true);
    });
  });
});
