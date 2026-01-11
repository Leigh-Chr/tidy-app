/**
 * @fileoverview Tests for config path resolution - Story 5.2
 *
 * AC covered:
 * - AC3: Relative and absolute paths supported
 * - AC5: Environment variable support
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { resolveConfigPath, getDefaultConfigDir } from './paths.js';

describe('resolveConfigPath', () => {
  const originalEnv = process.env.TIDY_CONFIG;
  const testDir = join(tmpdir(), 'tidy-path-test');

  beforeEach(() => {
    // Clear env var before each test
    delete process.env.TIDY_CONFIG;
  });

  afterEach(() => {
    // Restore original env var
    if (originalEnv !== undefined) {
      process.env.TIDY_CONFIG = originalEnv;
    } else {
      delete process.env.TIDY_CONFIG;
    }
  });

  // AC3: Relative paths
  describe('relative path handling', () => {
    it('resolves relative custom path against cwd', () => {
      const result = resolveConfigPath({
        customPath: './project/config.json',
        cwd: testDir,
      });

      expect(result).toBe(join(testDir, 'project', 'config.json'));
    });

    it('resolves parent-relative paths', () => {
      const result = resolveConfigPath({
        customPath: '../sibling/config.json',
        cwd: testDir,
      });

      expect(result).toBe(resolve(testDir, '../sibling/config.json'));
    });

    it('handles path without ./ prefix', () => {
      const result = resolveConfigPath({
        customPath: 'config.json',
        cwd: testDir,
      });

      expect(result).toBe(join(testDir, 'config.json'));
    });
  });

  // AC3: Absolute paths
  describe('absolute path handling', () => {
    it('preserves absolute custom path', () => {
      const absolutePath = '/absolute/path/config.json';
      const result = resolveConfigPath({
        customPath: absolutePath,
        cwd: testDir,
      });

      expect(result).toBe(absolutePath);
    });

    it('preserves Windows-style absolute paths', () => {
      // Skip on non-Windows but test the logic
      const windowsPath = 'C:\\Users\\test\\config.json';
      if (process.platform === 'win32') {
        const result = resolveConfigPath({
          customPath: windowsPath,
          cwd: testDir,
        });
        expect(result).toBe(windowsPath);
      }
    });
  });

  // AC5: Environment variable
  describe('environment variable support', () => {
    it('uses environment variable when no custom path', () => {
      process.env.TIDY_CONFIG = './env-config.json';

      const result = resolveConfigPath({ cwd: testDir });

      expect(result).toBe(join(testDir, 'env-config.json'));
    });

    it('resolves absolute env var path', () => {
      const absolutePath = '/env/path/config.json';
      process.env.TIDY_CONFIG = absolutePath;

      const result = resolveConfigPath({ cwd: testDir });

      expect(result).toBe(absolutePath);
    });

    it('custom path takes precedence over env var', () => {
      process.env.TIDY_CONFIG = './env-config.json';

      const result = resolveConfigPath({
        customPath: './custom-config.json',
        cwd: testDir,
      });

      expect(result).toBe(join(testDir, 'custom-config.json'));
    });
  });

  // Default path
  describe('default path', () => {
    it('returns default path when no overrides', () => {
      const result = resolveConfigPath({ cwd: testDir });

      expect(result).toContain('tidy-app');
      expect(result).toContain('config.json');
    });

    it('uses process.cwd when cwd not provided', () => {
      const result = resolveConfigPath();

      expect(result).toContain('tidy-app');
      expect(result).toContain('config.json');
    });
  });
});

describe('getDefaultConfigDir', () => {
  it('returns OS-appropriate config directory', () => {
    const dir = getDefaultConfigDir();

    expect(dir).toContain('tidy-app');
    // Should be a config directory
    const platform = process.platform;
    if (platform === 'darwin') {
      expect(dir).toContain('Library/Application Support');
    } else if (platform === 'win32') {
      expect(dir.toLowerCase()).toMatch(/appdata/i);
    } else {
      expect(dir).toContain('.config');
    }
  });
});
