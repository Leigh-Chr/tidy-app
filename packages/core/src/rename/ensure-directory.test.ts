/**
 * @fileoverview Tests for ensure-directory utility - Story 8.4
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdir, stat, access } from 'node:fs/promises';
import type { Stats } from 'node:fs';
import { ensureDirectory, findExistingAncestor } from './ensure-directory.js';

// Mock fs/promises
vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn(),
  stat: vi.fn(),
  access: vi.fn(),
}));

const mockedMkdir = vi.mocked(mkdir);
const mockedStat = vi.mocked(stat);
const mockedAccess = vi.mocked(access);

describe('ensure-directory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('ensureDirectory', () => {
    it('should create a directory successfully and return ok(true)', async () => {
      // Directory doesn't exist before
      mockedAccess.mockRejectedValueOnce(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
      mockedMkdir.mockResolvedValueOnce(undefined);

      const result = await ensureDirectory('/path/to/new/directory');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toBe(true);
      }
      expect(mockedMkdir).toHaveBeenCalledWith('/path/to/new/directory', { recursive: true });
    });

    it('should return ok(false) when directory already exists', async () => {
      // Directory exists before
      mockedAccess.mockResolvedValueOnce(undefined);
      mockedMkdir.mockResolvedValueOnce(undefined);

      const result = await ensureDirectory('/path/to/existing');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toBe(false);
      }
    });

    it('should handle race condition gracefully when directory created between check and create', async () => {
      // Simulate race condition: access says not exists, but mkdir fails with EEXIST
      mockedAccess.mockRejectedValueOnce(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
      const error = Object.assign(new Error('EEXIST: file already exists'), { code: 'EEXIST' });
      mockedMkdir.mockRejectedValueOnce(error);

      const result = await ensureDirectory('/concurrent/path');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toBe(false);
      }
    });

    it('should return error when permission denied (EACCES)', async () => {
      mockedAccess.mockRejectedValueOnce(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
      const error = Object.assign(new Error('Permission denied'), { code: 'EACCES' });
      mockedMkdir.mockRejectedValueOnce(error);

      const result = await ensureDirectory('/protected/path');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('Permission denied');
      }
    });

    it('should return error when permission denied (EPERM)', async () => {
      mockedAccess.mockRejectedValueOnce(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
      const error = Object.assign(new Error('Operation not permitted'), { code: 'EPERM' });
      mockedMkdir.mockRejectedValueOnce(error);

      const result = await ensureDirectory('/system/path');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('Operation not permitted');
      }
    });

    it('should return error for read-only filesystem (EROFS)', async () => {
      mockedAccess.mockRejectedValueOnce(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
      const error = Object.assign(new Error('Read-only file system'), { code: 'EROFS' });
      mockedMkdir.mockRejectedValueOnce(error);

      const result = await ensureDirectory('/readonly/path');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('Read-only file system');
      }
    });

    it('should return error for disk full (ENOSPC)', async () => {
      mockedAccess.mockRejectedValueOnce(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
      const error = Object.assign(new Error('No space left on device'), { code: 'ENOSPC' });
      mockedMkdir.mockRejectedValueOnce(error);

      const result = await ensureDirectory('/path/to/full/disk');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('No space left on device');
      }
    });

    it('should handle path too long error (ENAMETOOLONG)', async () => {
      const longPath = '/a'.repeat(5000);
      mockedAccess.mockRejectedValueOnce(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
      const error = Object.assign(new Error('File name too long'), { code: 'ENAMETOOLONG' });
      mockedMkdir.mockRejectedValueOnce(error);

      const result = await ensureDirectory(longPath);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('File name too long');
      }
    });

    it('should create deeply nested directory hierarchy', async () => {
      mockedAccess.mockRejectedValueOnce(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
      mockedMkdir.mockResolvedValueOnce(undefined);

      const result = await ensureDirectory('/base/2026/01/photos/vacation');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toBe(true);
      }
      expect(mockedMkdir).toHaveBeenCalledWith('/base/2026/01/photos/vacation', { recursive: true });
    });

    it('should work with relative paths', async () => {
      mockedAccess.mockRejectedValueOnce(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
      mockedMkdir.mockResolvedValueOnce(undefined);

      const result = await ensureDirectory('relative/path/to/folder');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toBe(true);
      }
      expect(mockedMkdir).toHaveBeenCalledWith('relative/path/to/folder', { recursive: true });
    });

    it('should handle empty path gracefully', async () => {
      mockedAccess.mockRejectedValueOnce(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
      const error = Object.assign(new Error('ENOENT: no such file or directory'), { code: 'ENOENT' });
      mockedMkdir.mockRejectedValueOnce(error);

      const result = await ensureDirectory('');

      expect(result.ok).toBe(false);
    });

    it('should handle Windows-style paths', async () => {
      mockedAccess.mockRejectedValueOnce(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
      mockedMkdir.mockResolvedValueOnce(undefined);

      const result = await ensureDirectory('C:\\Users\\test\\folder');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toBe(true);
      }
      expect(mockedMkdir).toHaveBeenCalledWith('C:\\Users\\test\\folder', { recursive: true });
    });

    it('should handle paths with special characters', async () => {
      mockedAccess.mockRejectedValueOnce(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
      mockedMkdir.mockResolvedValueOnce(undefined);

      const result = await ensureDirectory('/path/with spaces/and-dashes/under_scores');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toBe(true);
      }
      expect(mockedMkdir).toHaveBeenCalledWith('/path/with spaces/and-dashes/under_scores', { recursive: true });
    });

    it('should handle unknown errors', async () => {
      mockedAccess.mockRejectedValueOnce(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
      const error = new Error('Unknown error occurred');
      mockedMkdir.mockRejectedValueOnce(error);

      const result = await ensureDirectory('/some/path');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('Unknown error occurred');
      }
    });
  });

  describe('findExistingAncestor', () => {
    const mockDirectory = () => ({ isDirectory: () => true }) as Stats;
    const mockEnoent = () => Object.assign(new Error('ENOENT'), { code: 'ENOENT' });

    it('should return the path itself if it exists and is a directory', async () => {
      mockedStat.mockResolvedValueOnce(mockDirectory());

      const result = await findExistingAncestor('/existing/directory');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toBe('/existing/directory');
      }
    });

    it('should return parent if path does not exist', async () => {
      mockedStat
        .mockRejectedValueOnce(mockEnoent()) // /path/to/new doesn't exist
        .mockResolvedValueOnce(mockDirectory()); // /path/to exists

      const result = await findExistingAncestor('/path/to/new');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toBe('/path/to');
      }
    });

    it('should traverse multiple levels to find existing ancestor', async () => {
      mockedStat
        .mockRejectedValueOnce(mockEnoent()) // /base/a/b/c doesn't exist
        .mockRejectedValueOnce(mockEnoent()) // /base/a/b doesn't exist
        .mockRejectedValueOnce(mockEnoent()) // /base/a doesn't exist
        .mockResolvedValueOnce(mockDirectory()); // /base exists

      const result = await findExistingAncestor('/base/a/b/c');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toBe('/base');
      }
    });

    it('should return root if nothing else exists', async () => {
      mockedStat
        .mockRejectedValueOnce(mockEnoent()) // /a/b doesn't exist
        .mockRejectedValueOnce(mockEnoent()) // /a doesn't exist
        .mockResolvedValueOnce(mockDirectory()); // / exists

      const result = await findExistingAncestor('/a/b');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toBe('/');
      }
    });

    it('should handle permission errors during traversal', async () => {
      const permError = Object.assign(new Error('Permission denied'), { code: 'EACCES' });
      mockedStat.mockRejectedValueOnce(permError);

      const result = await findExistingAncestor('/protected/path');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('Permission denied');
      }
    });

    it('should skip files (non-directories) when finding ancestor', async () => {
      const mockFile = () => ({ isDirectory: () => false }) as Stats;

      mockedStat
        .mockResolvedValueOnce(mockFile()) // /path/file.txt is a file
        .mockResolvedValueOnce(mockDirectory()); // /path is a directory

      const result = await findExistingAncestor('/path/file.txt');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toBe('/path');
      }
    });
  });
});

// Note: Real filesystem integration tests for ensureDirectory are in engine.test.ts
// under "executeBatchRename with directory creation (Story 8.4)" which tests the
// actual directory creation with real filesystem operations.
