/**
 * @fileoverview Integration tests for exit codes - Story 5.8
 *
 * AC covered (5.8):
 * - AC1: Exit code 0 on success
 * - AC2: Exit code 1 on error
 * - AC5: Exit codes are documented
 * - AC6: Exit codes work in shell scripts
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync, spawnSync } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const CLI_PATH = join(process.cwd(), 'dist', 'index.js');

// Windows doesn't have /bin/bash, so shell script tests need to be skipped
const isWindows = process.platform === 'win32';

describe('scan command exit codes (Story 5.8)', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `tidy-exit-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  // AC1: Exit code 0 on success
  describe('AC1: Exit code 0 on success', () => {
    it('exits with 0 when scan succeeds', async () => {
      await writeFile(join(testDir, 'test.txt'), 'content');

      const result = spawnSync('node', [CLI_PATH, 'scan', testDir, '--format', 'plain'], {
        encoding: 'utf-8',
      });

      expect(result.status).toBe(0);
    });

    it('exits with 0 for empty folder', async () => {
      const result = spawnSync('node', [CLI_PATH, 'scan', testDir, '--format', 'json'], {
        encoding: 'utf-8',
      });

      expect(result.status).toBe(0);
      expect(result.stdout).toContain('[]');
    });
  });

  // AC2: Exit code 1 on error
  describe('AC2: Exit code 1 on error', () => {
    it('exits with 1 when folder does not exist', () => {
      const result = spawnSync('node', [CLI_PATH, 'scan', '/non/existent/path'], {
        encoding: 'utf-8',
      });

      expect(result.status).toBe(1);
      expect(result.stderr).toContain('Error');
    });

    it('exits with 1 for invalid format', async () => {
      const result = spawnSync('node', [CLI_PATH, 'scan', testDir, '--format', 'invalid'], {
        encoding: 'utf-8',
      });

      expect(result.status).toBe(1);
      expect(result.stderr).toContain('Invalid format');
    });

    it('writes errors to stderr', () => {
      const result = spawnSync('node', [CLI_PATH, 'scan', '/non/existent/path'], {
        encoding: 'utf-8',
      });

      expect(result.stderr).not.toBe('');
      // stdout should NOT contain the error
      expect(result.stdout).not.toContain('Error');
    });
  });

  // AC5: Exit codes are documented
  describe('AC5: Exit codes are documented', () => {
    it('help shows exit code 0 documentation', () => {
      const result = spawnSync('node', [CLI_PATH, '--help'], {
        encoding: 'utf-8',
      });

      expect(result.stdout).toContain('Exit Codes');
      expect(result.stdout).toContain('0');
      expect(result.stdout).toContain('Success');
    });

    it('help shows exit code 1 documentation', () => {
      const result = spawnSync('node', [CLI_PATH, '--help'], {
        encoding: 'utf-8',
      });

      expect(result.stdout).toContain('1');
      expect(result.stdout).toContain('Error');
    });

    it('help shows exit code 2 documentation', () => {
      const result = spawnSync('node', [CLI_PATH, '--help'], {
        encoding: 'utf-8',
      });

      expect(result.stdout).toContain('2');
      expect(result.stdout).toContain('Warning');
    });

    it('help shows exit code 130 documentation', () => {
      const result = spawnSync('node', [CLI_PATH, '--help'], {
        encoding: 'utf-8',
      });

      expect(result.stdout).toContain('130');
      expect(result.stdout).toContain('Interrupted');
    });

    it('help shows shell scripting examples', () => {
      const result = spawnSync('node', [CLI_PATH, '--help'], {
        encoding: 'utf-8',
      });

      expect(result.stdout).toContain('&&');
      expect(result.stdout).toContain('$?');
    });
  });

  // AC6: Exit codes work in shell scripts
  // Skip on Windows - these tests use /bin/bash which doesn't exist on Windows
  describe.skipIf(isWindows)('AC6: Exit codes work in shell scripts', () => {
    it('works with && operator on success', async () => {
      await writeFile(join(testDir, 'file.txt'), 'content');

      const result = execSync(
        `node ${CLI_PATH} scan "${testDir}" --format plain && echo "SUCCESS"`,
        { encoding: 'utf-8', shell: '/bin/bash' }
      );

      expect(result).toContain('SUCCESS');
    });

    it('works with || operator on error', () => {
      const result = execSync(
        `node ${CLI_PATH} scan /invalid/path 2>/dev/null || echo "FAILED"`,
        { encoding: 'utf-8', shell: '/bin/bash' }
      );

      expect(result.trim()).toBe('FAILED');
    });

    it('$? contains correct exit code for success', async () => {
      await writeFile(join(testDir, 'file.txt'), 'content');

      const result = execSync(
        `node ${CLI_PATH} scan "${testDir}" --format plain > /dev/null; echo $?`,
        { encoding: 'utf-8', shell: '/bin/bash' }
      );

      expect(result.trim()).toBe('0');
    });

    it('$? contains correct exit code for error', () => {
      const result = execSync(
        `node ${CLI_PATH} scan /invalid/path 2>/dev/null; echo $?`,
        { encoding: 'utf-8', shell: '/bin/bash' }
      );

      expect(result.trim()).toBe('1');
    });

    it('can be used in conditional logic', async () => {
      await writeFile(join(testDir, 'file.txt'), 'content');

      const result = execSync(
        `if node ${CLI_PATH} scan "${testDir}" --format plain > /dev/null; then echo "YES"; else echo "NO"; fi`,
        { encoding: 'utf-8', shell: '/bin/bash' }
      );

      expect(result.trim()).toBe('YES');
    });

    it('handles error in conditional logic', () => {
      const result = execSync(
        `if node ${CLI_PATH} scan /invalid/path 2>/dev/null; then echo "YES"; else echo "NO"; fi`,
        { encoding: 'utf-8', shell: '/bin/bash' }
      );

      expect(result.trim()).toBe('NO');
    });
  });
});

describe('config command exit codes (Story 5.8)', () => {
  it('config show exits with 0', () => {
    const result = spawnSync('node', [CLI_PATH, 'config', 'show'], {
      encoding: 'utf-8',
    });

    expect(result.status).toBe(0);
  });

  it('config path exits with 0', () => {
    const result = spawnSync('node', [CLI_PATH, 'config', 'path'], {
      encoding: 'utf-8',
    });

    expect(result.status).toBe(0);
  });
});
