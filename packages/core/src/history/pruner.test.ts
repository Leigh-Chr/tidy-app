/**
 * @fileoverview Tests for history pruner - Story 9.1
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { pruneHistory, shouldPrune, DEFAULT_PRUNE_CONFIG } from './pruner.js';
import { createEmptyHistoryStore, HISTORY_STORE_VERSION } from '../types/operation-history.js';
import type { HistoryStore, OperationHistoryEntry, PruneConfig } from '../types/operation-history.js';

describe('history pruner', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-10T14:30:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const createEntry = (
    id: string,
    timestamp: string,
    overrides?: Partial<OperationHistoryEntry>
  ): OperationHistoryEntry => ({
    id,
    timestamp,
    operationType: 'rename',
    fileCount: 1,
    summary: { succeeded: 1, skipped: 0, failed: 0, directoriesCreated: 0 },
    durationMs: 100,
    files: [],
    directoriesCreated: [],
    ...overrides,
  });

  describe('DEFAULT_PRUNE_CONFIG', () => {
    it('should have maxEntries of 100', () => {
      expect(DEFAULT_PRUNE_CONFIG.maxEntries).toBe(100);
    });

    it('should have maxAgeDays of 30', () => {
      expect(DEFAULT_PRUNE_CONFIG.maxAgeDays).toBe(30);
    });
  });

  describe('shouldPrune', () => {
    it('should return false for empty history', () => {
      const store = createEmptyHistoryStore();
      expect(shouldPrune(store)).toBe(false);
    });

    it('should return false when under entry limit', () => {
      const store: HistoryStore = {
        version: HISTORY_STORE_VERSION,
        lastPruned: null,
        entries: [createEntry('id-1', '2026-01-10T10:00:00.000Z')],
      };
      expect(shouldPrune(store)).toBe(false);
    });

    it('should return true when exceeding entry limit', () => {
      const entries = Array.from({ length: 101 }, (_, i) =>
        createEntry(`id-${i}`, '2026-01-10T10:00:00.000Z')
      );
      const store: HistoryStore = {
        version: HISTORY_STORE_VERSION,
        lastPruned: null,
        entries,
      };
      expect(shouldPrune(store)).toBe(true);
    });

    it('should return true when entries exceed maxAgeDays', () => {
      const oldTimestamp = '2025-12-01T10:00:00.000Z'; // 40 days old
      const store: HistoryStore = {
        version: HISTORY_STORE_VERSION,
        lastPruned: null,
        entries: [createEntry('id-1', oldTimestamp)],
      };
      expect(shouldPrune(store)).toBe(true);
    });

    it('should use custom config when provided', () => {
      const entries = Array.from({ length: 11 }, (_, i) =>
        createEntry(`id-${i}`, '2026-01-10T10:00:00.000Z')
      );
      const store: HistoryStore = {
        version: HISTORY_STORE_VERSION,
        lastPruned: null,
        entries,
      };
      const config: PruneConfig = { maxEntries: 10, maxAgeDays: 30 };
      expect(shouldPrune(store, config)).toBe(true);
    });
  });

  describe('pruneHistory', () => {
    it('should return unchanged store when no pruning needed', () => {
      const store: HistoryStore = {
        version: HISTORY_STORE_VERSION,
        lastPruned: null,
        entries: [createEntry('id-1', '2026-01-10T10:00:00.000Z')],
      };
      const result = pruneHistory(store);
      expect(result.entries).toHaveLength(1);
      expect(result.lastPruned).toBeNull();
    });

    it('should prune by count when exceeding maxEntries', () => {
      const entries = Array.from({ length: 105 }, (_, i) =>
        createEntry(`id-${i}`, `2026-01-${String(10 - Math.floor(i / 20)).padStart(2, '0')}T10:00:00.000Z`)
      );
      const store: HistoryStore = {
        version: HISTORY_STORE_VERSION,
        lastPruned: null,
        entries,
      };
      const result = pruneHistory(store);
      expect(result.entries.length).toBeLessThanOrEqual(100);
    });

    it('should keep newest entries when pruning by count', () => {
      const entries = [
        createEntry('newest', '2026-01-10T14:00:00.000Z'),
        ...Array.from({ length: 100 }, (_, i) =>
          createEntry(`old-${i}`, '2026-01-09T10:00:00.000Z')
        ),
      ];
      const store: HistoryStore = {
        version: HISTORY_STORE_VERSION,
        lastPruned: null,
        entries,
      };
      const result = pruneHistory(store);
      expect(result.entries[0]?.id).toBe('newest');
    });

    it('should prune entries older than maxAgeDays', () => {
      const entries = [
        createEntry('recent', '2026-01-10T10:00:00.000Z'), // Today
        createEntry('borderline', '2025-12-11T10:00:00.000Z'), // 30 days ago - exactly at limit
        createEntry('old', '2025-12-01T10:00:00.000Z'), // 40 days ago - should be pruned
      ];
      const store: HistoryStore = {
        version: HISTORY_STORE_VERSION,
        lastPruned: null,
        entries,
      };
      const result = pruneHistory(store);
      expect(result.entries.some((e) => e.id === 'recent')).toBe(true);
      expect(result.entries.some((e) => e.id === 'old')).toBe(false);
    });

    it('should set lastPruned timestamp after pruning', () => {
      const entries = Array.from({ length: 105 }, (_, i) =>
        createEntry(`id-${i}`, '2026-01-10T10:00:00.000Z')
      );
      const store: HistoryStore = {
        version: HISTORY_STORE_VERSION,
        lastPruned: null,
        entries,
      };
      const result = pruneHistory(store);
      expect(result.lastPruned).toBe('2026-01-10T14:30:00.000Z');
    });

    it('should not update lastPruned when no pruning occurs', () => {
      const store: HistoryStore = {
        version: HISTORY_STORE_VERSION,
        lastPruned: '2026-01-05T00:00:00.000Z',
        entries: [createEntry('id-1', '2026-01-10T10:00:00.000Z')],
      };
      const result = pruneHistory(store);
      expect(result.lastPruned).toBe('2026-01-05T00:00:00.000Z');
    });

    it('should use custom maxEntries config', () => {
      const entries = Array.from({ length: 20 }, (_, i) =>
        createEntry(`id-${i}`, '2026-01-10T10:00:00.000Z')
      );
      const store: HistoryStore = {
        version: HISTORY_STORE_VERSION,
        lastPruned: null,
        entries,
      };
      const config: PruneConfig = { maxEntries: 10, maxAgeDays: 30 };
      const result = pruneHistory(store, config);
      expect(result.entries).toHaveLength(10);
    });

    it('should use custom maxAgeDays config', () => {
      const entries = [
        createEntry('recent', '2026-01-10T10:00:00.000Z'),
        createEntry('week-old', '2026-01-03T10:00:00.000Z'), // 7 days old
        createEntry('two-weeks-old', '2025-12-27T10:00:00.000Z'), // 14 days old
      ];
      const store: HistoryStore = {
        version: HISTORY_STORE_VERSION,
        lastPruned: null,
        entries,
      };
      const config: PruneConfig = { maxEntries: 100, maxAgeDays: 10 };
      const result = pruneHistory(store, config);
      expect(result.entries.some((e) => e.id === 'recent')).toBe(true);
      expect(result.entries.some((e) => e.id === 'week-old')).toBe(true);
      expect(result.entries.some((e) => e.id === 'two-weeks-old')).toBe(false);
    });

    it('should apply both count and age limits', () => {
      // Create entries: 50 recent + 60 old = 110 total
      const recentEntries = Array.from({ length: 50 }, (_, i) =>
        createEntry(`recent-${i}`, '2026-01-10T10:00:00.000Z')
      );
      const oldEntries = Array.from({ length: 60 }, (_, i) =>
        createEntry(`old-${i}`, '2025-11-01T10:00:00.000Z') // 70 days old
      );
      const store: HistoryStore = {
        version: HISTORY_STORE_VERSION,
        lastPruned: null,
        entries: [...recentEntries, ...oldEntries],
      };
      const result = pruneHistory(store);
      // Should remove all old entries (age limit) and not exceed count limit
      expect(result.entries.every((e) => e.id.startsWith('recent'))).toBe(true);
      expect(result.entries.length).toBeLessThanOrEqual(100);
    });

    it('should handle empty store gracefully', () => {
      const store = createEmptyHistoryStore();
      const result = pruneHistory(store);
      expect(result.entries).toEqual([]);
      expect(result.lastPruned).toBeNull();
    });

    it('should preserve version field', () => {
      const store: HistoryStore = {
        version: HISTORY_STORE_VERSION,
        lastPruned: null,
        entries: Array.from({ length: 105 }, (_, i) =>
          createEntry(`id-${i}`, '2026-01-10T10:00:00.000Z')
        ),
      };
      const result = pruneHistory(store);
      expect(result.version).toBe(HISTORY_STORE_VERSION);
    });

    it('should prune by count first, then by age', () => {
      // 150 entries, all within age limit
      const entries = Array.from({ length: 150 }, (_, i) =>
        createEntry(`id-${i}`, '2026-01-10T10:00:00.000Z')
      );
      const store: HistoryStore = {
        version: HISTORY_STORE_VERSION,
        lastPruned: null,
        entries,
      };
      const result = pruneHistory(store);
      // Should be limited to 100 by count limit
      expect(result.entries).toHaveLength(100);
    });
  });
});
