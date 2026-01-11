import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { scanFolder } from './scanner.js';

describe('scanFolder', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `tidy-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('basic folder scanning (AC1)', () => {
    it('scans folder and returns file info', async () => {
      await writeFile(join(testDir, 'test.txt'), 'content');

      const result = await scanFolder(testDir);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0].name).toBe('test');
        expect(result.data[0].extension).toBe('txt');
        expect(result.data[0].fullName).toBe('test.txt');
        expect(result.data[0].path).toBe(join(testDir, 'test.txt'));
      }
    });

    it('returns empty array for empty folder', async () => {
      const result = await scanFolder(testDir);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toHaveLength(0);
      }
    });

    it('includes file size in FileInfo', async () => {
      const content = 'Hello, World!';
      await writeFile(join(testDir, 'sized.txt'), content);

      const result = await scanFolder(testDir);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data[0].size).toBe(content.length);
      }
    });

    it('includes timestamps in FileInfo', async () => {
      await writeFile(join(testDir, 'dated.txt'), 'content');

      const result = await scanFolder(testDir);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data[0].createdAt).toBeInstanceOf(Date);
        expect(result.data[0].modifiedAt).toBeInstanceOf(Date);
      }
    });

    it('scans multiple files', async () => {
      await writeFile(join(testDir, 'file1.txt'), 'content1');
      await writeFile(join(testDir, 'file2.jpg'), 'content2');
      await writeFile(join(testDir, 'file3.pdf'), 'content3');

      const result = await scanFolder(testDir);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toHaveLength(3);
        const names = result.data.map((f) => f.fullName).sort();
        expect(names).toEqual(['file1.txt', 'file2.jpg', 'file3.pdf']);
      }
    });

    it('handles files without extension', async () => {
      await writeFile(join(testDir, 'Makefile'), 'content');

      const result = await scanFolder(testDir);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data[0].name).toBe('Makefile');
        expect(result.data[0].extension).toBe('');
        expect(result.data[0].fullName).toBe('Makefile');
      }
    });

    it('does not include subdirectories in non-recursive mode', async () => {
      await mkdir(join(testDir, 'subdir'));
      await writeFile(join(testDir, 'root.txt'), 'content');
      await writeFile(join(testDir, 'subdir', 'nested.txt'), 'content');

      const result = await scanFolder(testDir);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0].fullName).toBe('root.txt');
      }
    });
  });

  describe('error handling (AC2)', () => {
    it('returns error for non-existent path', async () => {
      const result = await scanFolder('/non/existent/path/that/does/not/exist');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('does not exist');
      }
    });

    it('returns error when path is a file, not a directory', async () => {
      const filePath = join(testDir, 'file.txt');
      await writeFile(filePath, 'content');

      const result = await scanFolder(filePath);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toMatch(/Not a directory|ENOTDIR/);
      }
    });
  });

  describe('recursive scanning (AC3)', () => {
    it('scans nested directories when recursive is true', async () => {
      await mkdir(join(testDir, 'level1', 'level2'), { recursive: true });
      await writeFile(join(testDir, 'root.txt'), 'content');
      await writeFile(join(testDir, 'level1', 'nested1.txt'), 'content');
      await writeFile(join(testDir, 'level1', 'level2', 'nested2.txt'), 'content');

      const result = await scanFolder(testDir, { recursive: true });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toHaveLength(3);
        const names = result.data.map((f) => f.fullName).sort();
        expect(names).toEqual(['nested1.txt', 'nested2.txt', 'root.txt']);
      }
    });

    it('preserves relative paths in recursive scan', async () => {
      await mkdir(join(testDir, 'subdir'), { recursive: true });
      await writeFile(join(testDir, 'subdir', 'nested.txt'), 'content');

      const result = await scanFolder(testDir, { recursive: true });

      expect(result.ok).toBe(true);
      if (result.ok) {
        const file = result.data[0];
        expect(file.relativePath).toBe(join('subdir', 'nested.txt'));
      }
    });

    it('handles deeply nested directories', async () => {
      const deepPath = join(testDir, 'a', 'b', 'c', 'd', 'e');
      await mkdir(deepPath, { recursive: true });
      await writeFile(join(deepPath, 'deep.txt'), 'content');

      const result = await scanFolder(testDir, { recursive: true });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0].fullName).toBe('deep.txt');
      }
    });
  });

  describe('extension filtering', () => {
    it('filters files by extension', async () => {
      await writeFile(join(testDir, 'image.jpg'), 'content');
      await writeFile(join(testDir, 'document.pdf'), 'content');
      await writeFile(join(testDir, 'photo.png'), 'content');

      const result = await scanFolder(testDir, { extensions: ['jpg', 'png'] });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toHaveLength(2);
        const names = result.data.map((f) => f.fullName).sort();
        expect(names).toEqual(['image.jpg', 'photo.png']);
      }
    });

    it('extension filtering is case-insensitive', async () => {
      await writeFile(join(testDir, 'image.JPG'), 'content');
      await writeFile(join(testDir, 'photo.jpg'), 'content');

      const result = await scanFolder(testDir, { extensions: ['jpg'] });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toHaveLength(2);
      }
    });
  });

  describe('progress callback', () => {
    it('calls onProgress callback for each file found', async () => {
      await writeFile(join(testDir, 'file1.txt'), 'content');
      await writeFile(join(testDir, 'file2.txt'), 'content');
      await writeFile(join(testDir, 'file3.txt'), 'content');

      const progressCalls: Array<{ current: number; total: number }> = [];
      const result = await scanFolder(testDir, {
        onProgress: (current, total) => {
          progressCalls.push({ current, total });
        },
      });

      expect(result.ok).toBe(true);
      expect(progressCalls.length).toBe(3);
      expect(progressCalls[0].current).toBe(1);
      expect(progressCalls[1].current).toBe(2);
      expect(progressCalls[2].current).toBe(3);
      // Total is unknown during scan
      expect(progressCalls[0].total).toBe(-1);
    });
  });

  describe('cancellation support', () => {
    it('respects AbortSignal for cancellation', async () => {
      await writeFile(join(testDir, 'file1.txt'), 'content');

      const controller = new AbortController();
      controller.abort();

      const result = await scanFolder(testDir, { signal: controller.signal });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('cancelled');
      }
    });
  });

  describe('various file types', () => {
    it('handles hidden files', async () => {
      await writeFile(join(testDir, '.hidden'), 'content');
      await writeFile(join(testDir, '.gitignore'), 'content');

      const result = await scanFolder(testDir);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toHaveLength(2);
        // Verify hidden file parsing: .hidden -> name: '.hidden', extension: ''
        const hiddenFile = result.data.find((f) => f.fullName === '.hidden');
        expect(hiddenFile?.name).toBe('.hidden');
        expect(hiddenFile?.extension).toBe('');
      }
    });

    it('handles files with multiple dots', async () => {
      await writeFile(join(testDir, 'file.test.ts'), 'content');

      const result = await scanFolder(testDir);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data[0].name).toBe('file.test');
        expect(result.data[0].extension).toBe('ts');
      }
    });

    it('handles files with spaces in names', async () => {
      await writeFile(join(testDir, 'my file.txt'), 'content');

      const result = await scanFolder(testDir);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data[0].fullName).toBe('my file.txt');
      }
    });

    it('handles files with unicode characters', async () => {
      await writeFile(join(testDir, '文件.txt'), 'content');

      const result = await scanFolder(testDir);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data[0].name).toBe('文件');
      }
    });
  });
});
