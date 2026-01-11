/**
 * @fileoverview Tests for undo engine - Story 9.3
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { mkdir, writeFile, rm, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { existsSync } from 'node:fs';
import {
  undoOperation,
  cleanupDirectories,
  markOperationAsUndone,
  isOperationUndone,
} from './undo.js';
import type { OperationHistoryEntry, HistoryStore } from '../types/operation-history.js';
import { HISTORY_STORE_VERSION } from '../types/operation-history.js';

// =============================================================================
// Test Fixtures
// =============================================================================

function createMockEntry(overrides: Partial<OperationHistoryEntry> = {}): OperationHistoryEntry {
  return {
    id: '550e8400-e29b-41d4-a716-446655440000',
    timestamp: '2026-01-10T12:00:00.000Z',
    operationType: 'rename',
    fileCount: 1,
    summary: {
      succeeded: 1,
      skipped: 0,
      failed: 0,
      directoriesCreated: 0,
    },
    durationMs: 100,
    files: [
      {
        originalPath: '/test/original.txt',
        newPath: '/test/renamed.txt',
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
    version: HISTORY_STORE_VERSION,
    lastPruned: null,
    entries,
  };
}

// =============================================================================
// Mock Setup
// =============================================================================

// Mock history functions
const mockGetHistory = vi.fn();
const mockGetHistoryEntry = vi.fn();
const mockLoadHistory = vi.fn();
const mockSaveHistory = vi.fn();

vi.mock('./query.js', () => ({
  getHistory: (...args: unknown[]) => mockGetHistory(...args),
  getHistoryEntry: (...args: unknown[]) => mockGetHistoryEntry(...args),
}));

vi.mock('./storage.js', () => ({
  loadHistory: (...args: unknown[]) => mockLoadHistory(...args),
  saveHistory: (...args: unknown[]) => mockSaveHistory(...args),
}));

// =============================================================================
// Test Suite: undoOperation
// =============================================================================

describe('undoOperation', () => {
  let testDir: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    testDir = join(tmpdir(), `tidy-undo-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });

    // Default mock implementations
    mockLoadHistory.mockResolvedValue({ ok: true, data: createMockStore() });
    mockSaveHistory.mockResolvedValue({ ok: true, data: undefined });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('operation lookup', () => {
    it('should find operation by ID', async () => {
      const entry = createMockEntry({
        files: [
          {
            originalPath: join(testDir, 'original.txt'),
            newPath: join(testDir, 'renamed.txt'),
            isMoveOperation: false,
            success: true,
            error: null,
          },
        ],
      });

      // Create the renamed file
      await writeFile(join(testDir, 'renamed.txt'), 'test content');

      mockGetHistoryEntry.mockResolvedValue({ ok: true, data: entry });
      mockLoadHistory.mockResolvedValue({
        ok: true,
        data: createMockStore([entry]),
      });

      const result = await undoOperation(entry.id);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.operationId).toBe(entry.id);
      }
    });

    it('should return error for non-existent ID (AC5)', async () => {
      mockGetHistoryEntry.mockResolvedValue({ ok: true, data: null });

      const result = await undoOperation('non-existent-id');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('Operation not found');
        expect(result.error.message).toContain('non-existent-id');
      }
    });

    it('should undo most recent operation when no ID provided (AC2)', async () => {
      const entry = createMockEntry({
        files: [
          {
            originalPath: join(testDir, 'original.txt'),
            newPath: join(testDir, 'renamed.txt'),
            isMoveOperation: false,
            success: true,
            error: null,
          },
        ],
      });

      await writeFile(join(testDir, 'renamed.txt'), 'test content');

      mockGetHistory.mockResolvedValue({ ok: true, data: [entry] });
      mockLoadHistory.mockResolvedValue({
        ok: true,
        data: createMockStore([entry]),
      });

      const result = await undoOperation();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.operationId).toBe(entry.id);
      }
    });

    it('should return error when no history exists', async () => {
      mockGetHistory.mockResolvedValue({ ok: true, data: [] });

      const result = await undoOperation();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('No operations in history');
      }
    });
  });

  describe('already undone check (AC6)', () => {
    it('should return error for already undone operation', async () => {
      const entry = createMockEntry({
        undoneAt: '2026-01-10T13:00:00.000Z',
      });

      mockGetHistoryEntry.mockResolvedValue({ ok: true, data: entry });

      const result = await undoOperation(entry.id);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('already undone');
      }
    });
  });

  describe('dry-run mode (AC3)', () => {
    it('should preview undo without executing', async () => {
      const entry = createMockEntry({
        files: [
          {
            originalPath: join(testDir, 'original.txt'),
            newPath: join(testDir, 'renamed.txt'),
            isMoveOperation: false,
            success: true,
            error: null,
          },
        ],
      });

      await writeFile(join(testDir, 'renamed.txt'), 'test content');

      mockGetHistoryEntry.mockResolvedValue({ ok: true, data: entry });

      const result = await undoOperation(entry.id, { dryRun: true });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.dryRun).toBe(true);
        expect(result.data.filesRestored).toBe(1);
        // File should still exist at renamed location
        expect(existsSync(join(testDir, 'renamed.txt'))).toBe(true);
        // Original should not exist yet
        expect(existsSync(join(testDir, 'original.txt'))).toBe(false);
      }
    });

    it('should report validation errors in dry-run', async () => {
      const entry = createMockEntry({
        files: [
          {
            originalPath: join(testDir, 'original.txt'),
            newPath: join(testDir, 'renamed.txt'),
            isMoveOperation: false,
            success: true,
            error: null,
          },
        ],
      });

      // Don't create the file - it should fail validation

      mockGetHistoryEntry.mockResolvedValue({ ok: true, data: entry });

      const result = await undoOperation(entry.id, { dryRun: true });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.dryRun).toBe(true);
        expect(result.data.filesFailed).toBe(1);
        expect(result.data.files[0]?.error).toContain('no longer exists');
      }
    });
  });

  describe('file reversal (AC1)', () => {
    it('should rename file back to original path', async () => {
      const originalPath = join(testDir, 'original.txt');
      const renamedPath = join(testDir, 'renamed.txt');

      const entry = createMockEntry({
        files: [
          {
            originalPath,
            newPath: renamedPath,
            isMoveOperation: false,
            success: true,
            error: null,
          },
        ],
      });

      await writeFile(renamedPath, 'test content');

      mockGetHistoryEntry.mockResolvedValue({ ok: true, data: entry });
      mockLoadHistory.mockResolvedValue({
        ok: true,
        data: createMockStore([entry]),
      });

      const result = await undoOperation(entry.id);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.filesRestored).toBe(1);
        expect(result.data.success).toBe(true);
        // Verify file was moved
        expect(existsSync(originalPath)).toBe(true);
        expect(existsSync(renamedPath)).toBe(false);
        // Verify content preserved
        const content = await readFile(originalPath, 'utf-8');
        expect(content).toBe('test content');
      }
    });

    it('should handle multiple files', async () => {
      const files = [
        { original: join(testDir, 'file1.txt'), renamed: join(testDir, 'file1-new.txt') },
        { original: join(testDir, 'file2.txt'), renamed: join(testDir, 'file2-new.txt') },
      ];

      const entry = createMockEntry({
        fileCount: 2,
        summary: { succeeded: 2, skipped: 0, failed: 0, directoriesCreated: 0 },
        files: files.map((f) => ({
          originalPath: f.original,
          newPath: f.renamed,
          isMoveOperation: false,
          success: true,
          error: null,
        })),
      });

      // Create renamed files
      for (const f of files) {
        await writeFile(f.renamed, `content of ${f.renamed}`);
      }

      mockGetHistoryEntry.mockResolvedValue({ ok: true, data: entry });
      mockLoadHistory.mockResolvedValue({
        ok: true,
        data: createMockStore([entry]),
      });

      const result = await undoOperation(entry.id);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.filesRestored).toBe(2);
        // Verify all files restored
        for (const f of files) {
          expect(existsSync(f.original)).toBe(true);
          expect(existsSync(f.renamed)).toBe(false);
        }
      }
    });
  });

  describe('partial undo (AC4)', () => {
    it('should handle some files missing', async () => {
      const files = [
        { original: join(testDir, 'file1.txt'), renamed: join(testDir, 'file1-new.txt') },
        { original: join(testDir, 'file2.txt'), renamed: join(testDir, 'file2-new.txt') },
      ];

      const entry = createMockEntry({
        fileCount: 2,
        summary: { succeeded: 2, skipped: 0, failed: 0, directoriesCreated: 0 },
        files: files.map((f) => ({
          originalPath: f.original,
          newPath: f.renamed,
          isMoveOperation: false,
          success: true,
          error: null,
        })),
      });

      // Only create one file (file2 is missing)
      await writeFile(files[0]!.renamed, 'content1');

      mockGetHistoryEntry.mockResolvedValue({ ok: true, data: entry });
      mockLoadHistory.mockResolvedValue({
        ok: true,
        data: createMockStore([entry]),
      });

      // Force undo even with failures
      const result = await undoOperation(entry.id, { force: true });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.filesRestored).toBe(1);
        expect(result.data.filesFailed).toBe(1);
        expect(result.data.success).toBe(false); // Partial success
      }
    });

    it('should handle original path occupied', async () => {
      const originalPath = join(testDir, 'original.txt');
      const renamedPath = join(testDir, 'renamed.txt');

      const entry = createMockEntry({
        files: [
          {
            originalPath,
            newPath: renamedPath,
            isMoveOperation: false,
            success: true,
            error: null,
          },
        ],
      });

      // Create both files - original path is occupied
      await writeFile(renamedPath, 'renamed content');
      await writeFile(originalPath, 'new file at original');

      mockGetHistoryEntry.mockResolvedValue({ ok: true, data: entry });

      const result = await undoOperation(entry.id, { force: true });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.filesFailed).toBe(1);
        expect(result.data.files[0]?.error).toContain('occupied');
      }
    });

    it('should skip files that failed in original operation', async () => {
      const entry = createMockEntry({
        fileCount: 2,
        summary: { succeeded: 1, skipped: 0, failed: 1, directoriesCreated: 0 },
        files: [
          {
            originalPath: join(testDir, 'file1.txt'),
            newPath: join(testDir, 'file1-new.txt'),
            isMoveOperation: false,
            success: true,
            error: null,
          },
          {
            originalPath: join(testDir, 'file2.txt'),
            newPath: null,
            isMoveOperation: false,
            success: false,
            error: 'Original operation failed',
          },
        ],
      });

      await writeFile(join(testDir, 'file1-new.txt'), 'content1');

      mockGetHistoryEntry.mockResolvedValue({ ok: true, data: entry });
      mockLoadHistory.mockResolvedValue({
        ok: true,
        data: createMockStore([entry]),
      });

      const result = await undoOperation(entry.id);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.filesRestored).toBe(1);
        expect(result.data.filesSkipped).toBe(1);
        expect(result.data.files[1]?.skipReason).toContain('Original operation failed');
      }
    });
  });

  describe('marks operation as undone', () => {
    it('should set undoneAt after successful undo', async () => {
      const entry = createMockEntry({
        files: [
          {
            originalPath: join(testDir, 'original.txt'),
            newPath: join(testDir, 'renamed.txt'),
            isMoveOperation: false,
            success: true,
            error: null,
          },
        ],
      });

      await writeFile(join(testDir, 'renamed.txt'), 'test content');

      mockGetHistoryEntry.mockResolvedValue({ ok: true, data: entry });
      mockLoadHistory.mockResolvedValue({
        ok: true,
        data: createMockStore([entry]),
      });

      await undoOperation(entry.id);

      // Verify saveHistory was called with undoneAt set
      expect(mockSaveHistory).toHaveBeenCalled();
      const savedStore = mockSaveHistory.mock.calls[0]?.[0] as HistoryStore | undefined;
      expect(savedStore?.entries[0]?.undoneAt).toBeDefined();
    });
  });

  describe('result structure (AC8)', () => {
    it('should include all required fields', async () => {
      const entry = createMockEntry({
        files: [
          {
            originalPath: join(testDir, 'original.txt'),
            newPath: join(testDir, 'renamed.txt'),
            isMoveOperation: false,
            success: true,
            error: null,
          },
        ],
      });

      await writeFile(join(testDir, 'renamed.txt'), 'test content');

      mockGetHistoryEntry.mockResolvedValue({ ok: true, data: entry });
      mockLoadHistory.mockResolvedValue({
        ok: true,
        data: createMockStore([entry]),
      });

      const result = await undoOperation(entry.id);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toHaveProperty('operationId');
        expect(result.data).toHaveProperty('success');
        expect(result.data).toHaveProperty('dryRun');
        expect(result.data).toHaveProperty('filesRestored');
        expect(result.data).toHaveProperty('filesSkipped');
        expect(result.data).toHaveProperty('filesFailed');
        expect(result.data).toHaveProperty('directoriesRemoved');
        expect(result.data).toHaveProperty('files');
        expect(result.data).toHaveProperty('durationMs');
      }
    });
  });
});

// =============================================================================
// Test Suite: cleanupDirectories (AC7)
// =============================================================================

describe('cleanupDirectories', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `tidy-cleanup-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('should remove empty directories', async () => {
    const emptyDir = join(testDir, 'empty-dir');
    await mkdir(emptyDir);

    const removed = await cleanupDirectories([emptyDir]);

    expect(removed).toContain(emptyDir);
    expect(existsSync(emptyDir)).toBe(false);
  });

  it('should preserve directories with files', async () => {
    const dirWithFile = join(testDir, 'dir-with-file');
    await mkdir(dirWithFile);
    await writeFile(join(dirWithFile, 'file.txt'), 'content');

    const removed = await cleanupDirectories([dirWithFile]);

    expect(removed).not.toContain(dirWithFile);
    expect(existsSync(dirWithFile)).toBe(true);
  });

  it('should handle nested directories (deepest first)', async () => {
    const parentDir = join(testDir, 'parent');
    const childDir = join(parentDir, 'child');
    const grandchildDir = join(childDir, 'grandchild');

    await mkdir(grandchildDir, { recursive: true });

    const removed = await cleanupDirectories([parentDir, childDir, grandchildDir]);

    // All should be removed since they're all empty
    expect(removed).toHaveLength(3);
    expect(existsSync(grandchildDir)).toBe(false);
    expect(existsSync(childDir)).toBe(false);
    expect(existsSync(parentDir)).toBe(false);
  });

  it('should stop at non-empty parent', async () => {
    const parentDir = join(testDir, 'parent');
    const childDir = join(parentDir, 'child');

    await mkdir(childDir, { recursive: true });
    await writeFile(join(parentDir, 'file.txt'), 'content');

    const removed = await cleanupDirectories([parentDir, childDir]);

    expect(removed).toContain(childDir);
    expect(removed).not.toContain(parentDir);
    expect(existsSync(parentDir)).toBe(true);
  });

  it('should handle non-existent directories gracefully', async () => {
    const nonExistent = join(testDir, 'does-not-exist');

    const removed = await cleanupDirectories([nonExistent]);

    expect(removed).not.toContain(nonExistent);
  });

  it('should return empty array for empty input', async () => {
    const removed = await cleanupDirectories([]);

    expect(removed).toEqual([]);
  });
});

// =============================================================================
// Test Suite: markOperationAsUndone
// =============================================================================

describe('markOperationAsUndone', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should set undoneAt timestamp on entry', async () => {
    const entry = createMockEntry();
    const store = createMockStore([entry]);

    mockLoadHistory.mockResolvedValue({ ok: true, data: store });
    mockSaveHistory.mockResolvedValue({ ok: true, data: undefined });

    const result = await markOperationAsUndone(entry.id);

    expect(result.ok).toBe(true);
    expect(mockSaveHistory).toHaveBeenCalled();
    const savedStore = mockSaveHistory.mock.calls[0]?.[0] as HistoryStore | undefined;
    expect(savedStore?.entries[0]?.undoneAt).toBeDefined();
  });

  it('should return error for non-existent entry', async () => {
    const store = createMockStore([]);

    mockLoadHistory.mockResolvedValue({ ok: true, data: store });

    const result = await markOperationAsUndone('non-existent-id');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('Operation not found');
    }
  });

  it('should propagate load errors', async () => {
    mockLoadHistory.mockResolvedValue({
      ok: false,
      error: new Error('Storage error'),
    });

    const result = await markOperationAsUndone('any-id');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('Storage error');
    }
  });

  it('should propagate save errors', async () => {
    const entry = createMockEntry();
    const store = createMockStore([entry]);

    mockLoadHistory.mockResolvedValue({ ok: true, data: store });
    mockSaveHistory.mockResolvedValue({
      ok: false,
      error: new Error('Save error'),
    });

    const result = await markOperationAsUndone(entry.id);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('Save error');
    }
  });
});

// =============================================================================
// Test Suite: isOperationUndone
// =============================================================================

describe('isOperationUndone', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return true for undone operation', async () => {
    const entry = createMockEntry({ undoneAt: '2026-01-10T15:00:00.000Z' });

    mockGetHistoryEntry.mockResolvedValue({ ok: true, data: entry });

    const result = await isOperationUndone(entry.id);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toBe(true);
    }
  });

  it('should return false for operation not undone', async () => {
    const entry = createMockEntry(); // No undoneAt

    mockGetHistoryEntry.mockResolvedValue({ ok: true, data: entry });

    const result = await isOperationUndone(entry.id);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toBe(false);
    }
  });

  it('should return false for null undoneAt', async () => {
    const entry = createMockEntry();
    // Explicitly set undoneAt to null
    (entry as Record<string, unknown>).undoneAt = null;

    mockGetHistoryEntry.mockResolvedValue({ ok: true, data: entry });

    const result = await isOperationUndone(entry.id);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toBe(false);
    }
  });

  it('should return error for non-existent operation', async () => {
    mockGetHistoryEntry.mockResolvedValue({ ok: true, data: null });

    const result = await isOperationUndone('non-existent');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('Operation not found');
    }
  });
});
