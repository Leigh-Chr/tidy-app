/**
 * @fileoverview Tests for restore engine - Story 9.4
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { restoreFile, restoreFileWithDetails, canRestoreFile } from './restore.js';
import * as lookup from './lookup.js';
import * as undo from './undo.js';
import { rename } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import type { FileHistoryLookup } from '../types/restore-result.js';

// Mock modules
vi.mock('./lookup.js', () => ({
  lookupFileHistory: vi.fn(),
}));

vi.mock('./undo.js', () => ({
  undoOperation: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  rename: vi.fn(),
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
}));

const mockLookupFileHistory = vi.mocked(lookup.lookupFileHistory);
const mockUndoOperation = vi.mocked(undo.undoOperation);
const mockRename = vi.mocked(rename);
const mockExistsSync = vi.mocked(existsSync);

// =============================================================================
// Test Data
// =============================================================================

const validUUID = '550e8400-e29b-41d4-a716-446655440000';

function createMockLookup(overrides: Partial<FileHistoryLookup> = {}): FileHistoryLookup {
  return {
    searchedPath: '/test/renamed.txt',
    found: true,
    originalPath: '/test/original.txt',
    currentPath: '/test/renamed.txt',
    lastOperationId: validUUID,
    lastModified: '2026-01-11T10:00:00.000Z',
    isAtOriginal: false,
    operations: [{
      operationId: validUUID,
      timestamp: '2026-01-11T10:00:00.000Z',
      operationType: 'rename',
      originalPath: '/test/original.txt',
      newPath: '/test/renamed.txt',
    }],
    ...overrides,
  };
}

// =============================================================================
// Test Suite: restoreFile
// =============================================================================

describe('restoreFile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // AC5: File not in history
  describe('file not in history', () => {
    it('should return error for file not in history', async () => {
      mockLookupFileHistory.mockResolvedValue({ ok: true, data: null });

      const result = await restoreFile('/test/unknown.txt');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.success).toBe(false);
        expect(result.data.error).toContain('No history found for file');
      }
    });

    it('should include searched path in result', async () => {
      mockLookupFileHistory.mockResolvedValue({ ok: true, data: null });

      const result = await restoreFile('/test/specific-path.txt');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.searchedPath).toBe('/test/specific-path.txt');
      }
    });
  });

  // AC6: File already at original location
  describe('file already at original', () => {
    it('should return success with message when already at original', async () => {
      const lookup = createMockLookup({ isAtOriginal: true });
      mockLookupFileHistory.mockResolvedValue({ ok: true, data: lookup });

      const result = await restoreFile('/test/original.txt');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.success).toBe(true);
        expect(result.data.message).toBe('File is already at original location');
      }
    });
  });

  // AC7: Handle missing files
  describe('missing file handling', () => {
    it('should return error when file no longer exists at current path', async () => {
      const lookup = createMockLookup();
      mockLookupFileHistory.mockResolvedValue({ ok: true, data: lookup });
      mockExistsSync.mockReturnValue(false);

      const result = await restoreFile('/test/renamed.txt');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.success).toBe(false);
        expect(result.data.error).toContain('no longer exists');
      }
    });

    it('should suggest file may have been moved or deleted', async () => {
      const lookup = createMockLookup();
      mockLookupFileHistory.mockResolvedValue({ ok: true, data: lookup });
      mockExistsSync.mockReturnValue(false);

      const result = await restoreFile('/test/renamed.txt');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.error).toContain('moved or deleted');
      }
    });
  });

  // AC1: Successful restore
  describe('successful restore', () => {
    it('should restore file to original name', async () => {
      const lookup = createMockLookup();
      mockLookupFileHistory.mockResolvedValue({ ok: true, data: lookup });
      mockExistsSync.mockImplementation((path) => path === '/test/renamed.txt' || path === '/test');
      mockRename.mockResolvedValue(undefined);

      const result = await restoreFile('/test/renamed.txt');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.success).toBe(true);
        expect(result.data.originalPath).toBe('/test/original.txt');
        expect(result.data.previousPath).toBe('/test/renamed.txt');
      }
    });

    it('should call rename with correct arguments', async () => {
      const lookup = createMockLookup();
      mockLookupFileHistory.mockResolvedValue({ ok: true, data: lookup });
      mockExistsSync.mockImplementation((path) => path === '/test/renamed.txt' || path === '/test');
      mockRename.mockResolvedValue(undefined);

      await restoreFile('/test/renamed.txt');

      expect(mockRename).toHaveBeenCalledWith('/test/renamed.txt', '/test/original.txt');
    });

    it('should include operation ID in result', async () => {
      const lookup = createMockLookup();
      mockLookupFileHistory.mockResolvedValue({ ok: true, data: lookup });
      mockExistsSync.mockImplementation((path) => path === '/test/renamed.txt' || path === '/test');
      mockRename.mockResolvedValue(undefined);

      const result = await restoreFile('/test/renamed.txt');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.operationId).toBe(validUUID);
      }
    });
  });

  // AC4: Dry-run preview
  describe('dry-run mode', () => {
    it('should return preview without executing', async () => {
      const lookup = createMockLookup();
      mockLookupFileHistory.mockResolvedValue({ ok: true, data: lookup });
      mockExistsSync.mockImplementation((path) => path === '/test/renamed.txt' || path === '/test');

      const result = await restoreFile('/test/renamed.txt', { dryRun: true });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.success).toBe(true);
        expect(result.data.dryRun).toBe(true);
      }
      expect(mockRename).not.toHaveBeenCalled();
    });

    it('should show original and previous paths in dry-run', async () => {
      const lookup = createMockLookup();
      mockLookupFileHistory.mockResolvedValue({ ok: true, data: lookup });
      mockExistsSync.mockImplementation((path) => path === '/test/renamed.txt' || path === '/test');

      const result = await restoreFile('/test/renamed.txt', { dryRun: true });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.originalPath).toBe('/test/original.txt');
        expect(result.data.previousPath).toBe('/test/renamed.txt');
      }
    });
  });

  // AC3: Lookup mode
  describe('lookup mode', () => {
    it('should return lookup info without restoring', async () => {
      const lookup = createMockLookup();
      mockLookupFileHistory.mockResolvedValue({ ok: true, data: lookup });

      const result = await restoreFile('/test/renamed.txt', { lookup: true });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.success).toBe(true);
        expect(result.data.dryRun).toBe(true);
        expect(result.data.message).toBe('Lookup completed');
      }
      expect(mockRename).not.toHaveBeenCalled();
    });
  });

  // AC2: Restore by operation ID
  describe('restore by operation ID', () => {
    it('should delegate to undo when operationId provided', async () => {
      mockUndoOperation.mockResolvedValue({
        ok: true,
        data: {
          operationId: validUUID,
          success: true,
          dryRun: false,
          filesRestored: 3,
          filesSkipped: 0,
          filesFailed: 0,
          directoriesRemoved: [],
          files: [],
          durationMs: 100,
        },
      });

      const result = await restoreFile('', { operationId: validUUID });

      expect(mockUndoOperation).toHaveBeenCalledWith(validUUID, { dryRun: false });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.success).toBe(true);
        expect(result.data.operationId).toBe(validUUID);
        expect(result.data.message).toContain('3 file(s)');
      }
    });

    it('should pass dryRun to undo operation', async () => {
      mockUndoOperation.mockResolvedValue({
        ok: true,
        data: {
          operationId: validUUID,
          success: true,
          dryRun: true,
          filesRestored: 0,
          filesSkipped: 0,
          filesFailed: 0,
          directoriesRemoved: [],
          files: [],
          durationMs: 50,
        },
      });

      await restoreFile('', { operationId: validUUID, dryRun: true });

      expect(mockUndoOperation).toHaveBeenCalledWith(validUUID, { dryRun: true });
    });

    it('should handle undo failure', async () => {
      mockUndoOperation.mockResolvedValue({
        ok: true,
        data: {
          operationId: validUUID,
          success: false,
          dryRun: false,
          filesRestored: 1,
          filesSkipped: 0,
          filesFailed: 2,
          directoriesRemoved: [],
          files: [],
          durationMs: 100,
        },
      });

      const result = await restoreFile('', { operationId: validUUID });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.success).toBe(false);
        expect(result.data.error).toContain('2 file(s) could not be restored');
      }
    });
  });

  // Error handling
  describe('error handling', () => {
    it('should return error when lookup fails', async () => {
      mockLookupFileHistory.mockResolvedValue({
        ok: false,
        error: new Error('Permission denied'),
      });

      const result = await restoreFile('/test/file.txt');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('Permission denied');
      }
    });

    it('should return error when rename fails', async () => {
      const lookup = createMockLookup();
      mockLookupFileHistory.mockResolvedValue({ ok: true, data: lookup });
      mockExistsSync.mockImplementation((path) => path === '/test/renamed.txt' || path === '/test');
      mockRename.mockRejectedValue(new Error('EPERM: operation not permitted'));

      const result = await restoreFile('/test/renamed.txt');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.success).toBe(false);
        expect(result.data.error).toContain('EPERM');
      }
    });

    it('should return error when original path is occupied', async () => {
      const lookup = createMockLookup();
      mockLookupFileHistory.mockResolvedValue({ ok: true, data: lookup });
      // Both current and original paths exist
      mockExistsSync.mockReturnValue(true);

      const result = await restoreFile('/test/renamed.txt');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.success).toBe(false);
        expect(result.data.error).toContain('occupied');
      }
    });

    it('should require path for file-based restore', async () => {
      const result = await restoreFile('');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.success).toBe(false);
        expect(result.data.error).toBe('File path is required');
      }
    });

    it('should handle missing parent directory', async () => {
      const lookup = createMockLookup();
      mockLookupFileHistory.mockResolvedValue({ ok: true, data: lookup });
      mockExistsSync.mockImplementation((path) => path === '/test/renamed.txt');

      const result = await restoreFile('/test/renamed.txt');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.success).toBe(false);
        expect(result.data.error).toContain('Parent directory does not exist');
      }
    });
  });

  // Duration tracking
  describe('duration tracking', () => {
    it('should include duration in result', async () => {
      mockLookupFileHistory.mockResolvedValue({ ok: true, data: null });

      const result = await restoreFile('/test/file.txt');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.durationMs).toBeGreaterThanOrEqual(0);
      }
    });
  });
});

// =============================================================================
// Test Suite: restoreFileWithDetails
// =============================================================================

describe('restoreFileWithDetails', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call restoreFile with correct options', async () => {
    mockLookupFileHistory.mockResolvedValue({ ok: true, data: null });

    await restoreFileWithDetails('/test/file.txt', true);

    expect(mockLookupFileHistory).toHaveBeenCalled();
  });

  it('should pass dryRun parameter', async () => {
    const lookup = createMockLookup();
    mockLookupFileHistory.mockResolvedValue({ ok: true, data: lookup });
    mockExistsSync.mockImplementation((path) => path === '/test/renamed.txt' || path === '/test');

    const result = await restoreFileWithDetails('/test/renamed.txt', true);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.dryRun).toBe(true);
    }
    expect(mockRename).not.toHaveBeenCalled();
  });
});

// =============================================================================
// Test Suite: canRestoreFile
// =============================================================================

describe('canRestoreFile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return true for file that can be restored', async () => {
    const lookup = createMockLookup();
    mockLookupFileHistory.mockResolvedValue({ ok: true, data: lookup });
    mockExistsSync.mockImplementation((path) => path === '/test/renamed.txt' || path === '/test');

    const result = await canRestoreFile('/test/renamed.txt');

    expect(result.ok).toBe(true);
    expect(result.ok && result.data).toBe(true);
  });

  it('should return false for file not in history', async () => {
    mockLookupFileHistory.mockResolvedValue({ ok: true, data: null });

    const result = await canRestoreFile('/test/unknown.txt');

    expect(result.ok).toBe(true);
    expect(result.ok && result.data).toBe(false);
  });

  it('should return false for file already at original', async () => {
    const lookup = createMockLookup({ isAtOriginal: true });
    mockLookupFileHistory.mockResolvedValue({ ok: true, data: lookup });

    const result = await canRestoreFile('/test/original.txt');

    expect(result.ok).toBe(true);
    // Returns false because there's a message (already at original)
    expect(result.ok && result.data).toBe(false);
  });

  it('should return error on lookup failure', async () => {
    mockLookupFileHistory.mockResolvedValue({
      ok: false,
      error: new Error('Failed'),
    });

    const result = await canRestoreFile('/test/file.txt');

    expect(result.ok).toBe(false);
  });
});
