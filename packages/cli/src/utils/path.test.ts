/**
 * @fileoverview Tests for path utilities - Story 5.6
 *
 * AC covered:
 * - AC1: Folder argument accepts absolute paths
 * - AC2: Folder argument accepts relative paths
 * - AC4: Paths with spaces handled correctly
 * - AC5: Invalid path shows clear error
 * - AC6: Home directory expansion works
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, writeFile, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir, homedir } from 'node:os';
import { resolvePath, validateFolder, getFolderToScan } from './path.js';

describe('path utilities', () => {
  let testDir: string;

  beforeEach(async () => {
    const tempPath = join(tmpdir(), `tidy-path-test-${Date.now()}`);
    await mkdir(tempPath, { recursive: true });
    // Resolve symlinks (e.g., /tmp -> /private/tmp on macOS)
    testDir = await realpath(tempPath);
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('resolvePath', () => {
    // AC6: Home directory expansion
    it('expands tilde to home directory', () => {
      const result = resolvePath('~/Downloads');
      expect(result).toBe(join(homedir(), 'Downloads'));
    });

    it('expands tilde with nested path', () => {
      const result = resolvePath('~/Documents/projects/test');
      expect(result).toBe(join(homedir(), 'Documents/projects/test'));
    });

    // AC2: Relative path resolution
    it('resolves relative paths from provided cwd', () => {
      const result = resolvePath('./subfolder', '/base/path');
      expect(result).toContain('subfolder');
    });

    it('resolves parent directory references', () => {
      const result = resolvePath('../other', '/base/path');
      expect(result).toContain('other');
      expect(result).not.toContain('path');
    });

    // AC1: Absolute paths
    it('keeps absolute paths unchanged', () => {
      const result = resolvePath('/absolute/path');
      expect(result).toBe('/absolute/path');
    });

    it('normalizes paths with .. and .', () => {
      const result = resolvePath('/path/to/../other/./file');
      expect(result).toBe('/path/other/file');
    });

    it('handles multiple consecutive slashes', () => {
      const result = resolvePath('/path//to///folder');
      expect(result).toBe('/path/to/folder');
    });

    // AC4: Paths with spaces
    it('handles paths with spaces', () => {
      const result = resolvePath('/path/to/my folder/file');
      expect(result).toBe('/path/to/my folder/file');
    });

    it('handles tilde with spaces in path', () => {
      const result = resolvePath('~/My Documents');
      expect(result).toBe(join(homedir(), 'My Documents'));
    });
  });

  describe('validateFolder', () => {
    // AC5: Invalid path handling
    it('returns ok for existing directory', async () => {
      const result = await validateFolder(testDir);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toBe(testDir);
      }
    });

    it('returns error for non-existent path', async () => {
      const result = await validateFolder('/non/existent/path/that/does/not/exist');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('does not exist');
        expect(result.error.message).toContain('/non/existent');
      }
    });

    it('returns error for file (not directory)', async () => {
      const filePath = join(testDir, 'file.txt');
      await writeFile(filePath, 'content');

      const result = await validateFolder(filePath);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('Not a directory');
        expect(result.error.message).toContain('file.txt');
      }
    });

    it('includes path in error message', async () => {
      const badPath = '/specific/invalid/path';
      const result = await validateFolder(badPath);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain(badPath);
      }
    });
  });

  describe('getFolderToScan', () => {
    // AC3: No folder argument uses current directory
    it('uses cwd when no folder specified', async () => {
      const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        const result = await getFolderToScan();
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.data.path).toBe(testDir);
          expect(result.data.isDefault).toBe(true);
        }
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('uses cwd when "." specified', async () => {
      const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        const result = await getFolderToScan('.');
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.data.isDefault).toBe(true);
        }
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('uses cwd when undefined specified', async () => {
      const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        const result = await getFolderToScan(undefined);
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.data.isDefault).toBe(true);
        }
      } finally {
        process.chdir(originalCwd);
      }
    });

    // AC1: Absolute paths
    it('resolves specified absolute folder', async () => {
      const result = await getFolderToScan(testDir);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.path).toBe(testDir);
        expect(result.data.isDefault).toBe(false);
      }
    });

    // AC4: Paths with spaces
    it('handles paths with spaces', async () => {
      const spacedDir = join(testDir, 'folder with spaces');
      await mkdir(spacedDir);

      const result = await getFolderToScan(spacedDir);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.path).toBe(spacedDir);
      }
    });

    // AC2: Relative paths
    it('resolves relative paths from cwd', async () => {
      const subDir = join(testDir, 'subdir');
      await mkdir(subDir);
      const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        const result = await getFolderToScan('./subdir');
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.data.path).toBe(subDir);
          expect(result.data.isDefault).toBe(false);
        }
      } finally {
        process.chdir(originalCwd);
      }
    });

    // AC5: Invalid path error
    it('returns error for non-existent path', async () => {
      const result = await getFolderToScan('/this/path/does/not/exist');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('does not exist');
      }
    });

    it('returns error for file path', async () => {
      const filePath = join(testDir, 'notafolder.txt');
      await writeFile(filePath, 'content');

      const result = await getFolderToScan(filePath);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('Not a directory');
      }
    });
  });
});
