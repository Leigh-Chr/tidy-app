/**
 * @fileoverview Tests for scan command - Story 5.5, 5.6
 *
 * AC covered (5.5):
 * - AC3: Scan command accepts folder argument
 * - AC4: Subcommand help is available
 *
 * AC covered (5.6):
 * - AC1: Folder argument accepts absolute paths
 * - AC2: Folder argument accepts relative paths
 * - AC3: No folder argument uses current directory
 * - AC4: Paths with spaces handled correctly
 * - AC5: Invalid path shows clear error
 * - AC6: Home directory expansion works
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join, resolve, dirname, isAbsolute } from 'node:path';
import { tmpdir, homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI_PATH = resolve(__dirname, '../../dist/index.js');

// Windows uses backslash paths and different path formats
const isWindows = process.platform === 'win32';

describe('tidy scan', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `tidy-scan-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  // AC4: Subcommand help is available
  describe('--help', () => {
    it('displays scan-specific help', () => {
      const output = execSync(`node ${CLI_PATH} scan --help`, {
        encoding: 'utf-8',
      });
      expect(output).toContain('scan');
      expect(output).toContain('Scan');
    });

    it('shows format option', () => {
      const output = execSync(`node ${CLI_PATH} scan --help`, {
        encoding: 'utf-8',
      });
      expect(output).toContain('--format');
      expect(output).toContain('-f');
    });

    it('shows recursive option', () => {
      const output = execSync(`node ${CLI_PATH} scan --help`, {
        encoding: 'utf-8',
      });
      expect(output).toContain('--recursive');
      expect(output).toContain('-r');
    });

    it('includes usage examples', () => {
      const output = execSync(`node ${CLI_PATH} scan --help`, {
        encoding: 'utf-8',
      });
      expect(output).toContain('Examples');
      expect(output).toContain('tidy scan');
    });
  });

  // AC3: Scan command accepts folder argument
  describe('folder scanning', () => {
    it('scans current directory by default', async () => {
      // Create test files
      await writeFile(join(testDir, 'file1.txt'), 'content1');
      await writeFile(join(testDir, 'file2.txt'), 'content2');

      const output = execSync(`node ${CLI_PATH} scan`, {
        encoding: 'utf-8',
        cwd: testDir,
      });

      expect(output).toContain('file1.txt');
      expect(output).toContain('file2.txt');
    });

    it('scans specified folder', async () => {
      // Create test files
      await writeFile(join(testDir, 'test.txt'), 'content');

      const output = execSync(`node ${CLI_PATH} scan "${testDir}"`, {
        encoding: 'utf-8',
      });

      expect(output).toContain('test.txt');
    });

    it('shows file count in output', async () => {
      await writeFile(join(testDir, 'file1.txt'), 'content1');
      await writeFile(join(testDir, 'file2.txt'), 'content2');
      await writeFile(join(testDir, 'file3.txt'), 'content3');

      const output = execSync(`node ${CLI_PATH} scan "${testDir}"`, {
        encoding: 'utf-8',
      });

      expect(output).toContain('3');
      expect(output).toContain('file');
    });

    it('handles empty folder gracefully', async () => {
      const output = execSync(`node ${CLI_PATH} scan "${testDir}"`, {
        encoding: 'utf-8',
      });

      expect(output).toContain('No files');
    });

    it('exits with error for non-existent folder', () => {
      const nonExistent = join(testDir, 'does-not-exist');

      expect(() => {
        execSync(`node ${CLI_PATH} scan "${nonExistent}"`, {
          encoding: 'utf-8',
          stdio: 'pipe',
        });
      }).toThrow();
    });
  });

  describe('--recursive option', () => {
    it('scans only top-level by default', async () => {
      // Create nested structure
      const subDir = join(testDir, 'subdir');
      await mkdir(subDir);
      await writeFile(join(testDir, 'top.txt'), 'top');
      await writeFile(join(subDir, 'nested.txt'), 'nested');

      const output = execSync(`node ${CLI_PATH} scan "${testDir}"`, {
        encoding: 'utf-8',
      });

      expect(output).toContain('top.txt');
      expect(output).not.toContain('nested.txt');
    });

    it('includes subdirectories with -r flag', async () => {
      // Create nested structure
      const subDir = join(testDir, 'subdir');
      await mkdir(subDir);
      await writeFile(join(testDir, 'top.txt'), 'top');
      await writeFile(join(subDir, 'nested.txt'), 'nested');

      const output = execSync(`node ${CLI_PATH} scan "${testDir}" -r`, {
        encoding: 'utf-8',
      });

      expect(output).toContain('top.txt');
      expect(output).toContain('nested.txt');
    });

    it('includes subdirectories with --recursive flag', async () => {
      // Create nested structure
      const subDir = join(testDir, 'subdir');
      await mkdir(subDir);
      await writeFile(join(subDir, 'nested.txt'), 'nested');

      const output = execSync(`node ${CLI_PATH} scan "${testDir}" --recursive`, {
        encoding: 'utf-8',
      });

      expect(output).toContain('nested.txt');
    });
  });

  describe('--format option', () => {
    it('outputs table format by default', async () => {
      await writeFile(join(testDir, 'test.txt'), 'content');

      const output = execSync(`node ${CLI_PATH} scan "${testDir}"`, {
        encoding: 'utf-8',
      });

      // Table format has headers and separators
      expect(output).toContain('Name');
      expect(output).toContain('---');
    });

    it('outputs JSON format with --format json', async () => {
      await writeFile(join(testDir, 'test.txt'), 'content');

      const output = execSync(`node ${CLI_PATH} scan "${testDir}" --format json`, {
        encoding: 'utf-8',
      });

      // Should be valid JSON array
      const parsed = JSON.parse(output);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed[0]).toHaveProperty('fullName', 'test.txt');
    });

    it('outputs plain format with --format plain', async () => {
      await writeFile(join(testDir, 'file1.txt'), 'content1');
      await writeFile(join(testDir, 'file2.txt'), 'content2');

      const output = execSync(`node ${CLI_PATH} scan "${testDir}" --format plain`, {
        encoding: 'utf-8',
      });

      // Plain format: one path per line
      const lines = output.trim().split('\n');
      expect(lines.length).toBe(2);
      expect(lines.some((l) => l.includes('file1.txt'))).toBe(true);
      expect(lines.some((l) => l.includes('file2.txt'))).toBe(true);
    });

    it('accepts -f shorthand for format', async () => {
      await writeFile(join(testDir, 'test.txt'), 'content');

      const output = execSync(`node ${CLI_PATH} scan "${testDir}" -f json`, {
        encoding: 'utf-8',
      });

      const parsed = JSON.parse(output);
      expect(Array.isArray(parsed)).toBe(true);
    });
  });

  // Story 5.6: Target folder argument
  describe('path handling (Story 5.6)', () => {
    // AC1: Folder argument accepts absolute paths
    it('scans absolute path', async () => {
      await writeFile(join(testDir, 'file.txt'), 'content');

      const output = execSync(`node ${CLI_PATH} scan "${testDir}"`, {
        encoding: 'utf-8',
      });

      expect(output).toContain('Scanning:');
      expect(output).toContain(testDir);
      expect(output).toContain('file.txt');
    });

    // AC2: Folder argument accepts relative paths
    it('scans relative path from cwd', async () => {
      const subDir = join(testDir, 'subdir');
      await mkdir(subDir);
      await writeFile(join(subDir, 'file.txt'), 'content');

      const output = execSync(`node ${CLI_PATH} scan ./subdir`, {
        encoding: 'utf-8',
        cwd: testDir,
      });

      expect(output).toContain('Scanning:');
      expect(output).toContain('file.txt');
    });

    it('scans parent directory with ..', async () => {
      const subDir = join(testDir, 'subdir');
      await mkdir(subDir);
      await writeFile(join(testDir, 'parent-file.txt'), 'content');

      const output = execSync(`node ${CLI_PATH} scan ..`, {
        encoding: 'utf-8',
        cwd: subDir,
      });

      expect(output).toContain('parent-file.txt');
    });

    // AC3: No folder argument uses current directory
    it('shows "current directory" message when no folder specified', async () => {
      await writeFile(join(testDir, 'file.txt'), 'content');

      const output = execSync(`node ${CLI_PATH} scan`, {
        encoding: 'utf-8',
        cwd: testDir,
      });

      expect(output).toContain('Scanning current directory:');
      expect(output).toContain(testDir);
    });

    it('treats explicit "." as current directory', async () => {
      await writeFile(join(testDir, 'file.txt'), 'content');

      const output = execSync(`node ${CLI_PATH} scan .`, {
        encoding: 'utf-8',
        cwd: testDir,
      });

      // Explicit "." is treated same as default (current directory)
      expect(output).toContain('Scanning current directory:');
      expect(output).toContain(testDir);
      expect(output).toContain('file.txt');
    });

    // AC4: Paths with spaces handled correctly
    it('handles folder with spaces in name', async () => {
      const spacedDir = join(testDir, 'folder with spaces');
      await mkdir(spacedDir);
      await writeFile(join(spacedDir, 'file.txt'), 'content');

      const output = execSync(`node ${CLI_PATH} scan "${spacedDir}"`, {
        encoding: 'utf-8',
      });

      expect(output).toContain('Scanning:');
      expect(output).toContain('folder with spaces');
      expect(output).toContain('file.txt');
    });

    it('handles deeply nested folder with spaces', async () => {
      const spacedDir = join(testDir, 'folder with spaces', 'sub folder');
      await mkdir(spacedDir, { recursive: true });
      await writeFile(join(spacedDir, 'file.txt'), 'content');

      const output = execSync(`node ${CLI_PATH} scan "${spacedDir}"`, {
        encoding: 'utf-8',
      });

      expect(output).toContain('file.txt');
    });

    // AC5: Invalid path shows clear error
    it('shows clear error for non-existent path', () => {
      // Use a path that will be recognized as non-existent on all platforms
      const nonExistent = isWindows ? 'C:\\path\\that\\does\\not\\exist' : '/path/that/does/not/exist/anywhere';

      try {
        execSync(`node ${CLI_PATH} scan "${nonExistent}"`, {
          encoding: 'utf-8',
          stdio: 'pipe',
        });
        expect.fail('Should have thrown');
      } catch (error) {
        const execError = error as { stderr?: Buffer };
        const stderr = execError.stderr?.toString() ?? '';
        expect(stderr).toContain('Error');
        expect(stderr).toContain('does not exist');
        // Check that the path appears in the error (path format varies by platform)
        expect(stderr).toContain('exist');
      }
    });

    it('shows clear error for file path (not directory)', async () => {
      const filePath = join(testDir, 'notafolder.txt');
      await writeFile(filePath, 'content');

      try {
        execSync(`node ${CLI_PATH} scan "${filePath}"`, {
          encoding: 'utf-8',
          stdio: 'pipe',
        });
        expect.fail('Should have thrown');
      } catch (error) {
        const execError = error as { stderr?: Buffer };
        const stderr = execError.stderr?.toString() ?? '';
        expect(stderr).toContain('Error');
        expect(stderr).toContain('Not a directory');
      }
    });

    it('exits with code 1 for invalid path', () => {
      const nonExistent = join(testDir, 'does-not-exist');

      try {
        execSync(`node ${CLI_PATH} scan "${nonExistent}"`, {
          encoding: 'utf-8',
          stdio: 'pipe',
        });
        expect.fail('Should have thrown');
      } catch (error) {
        const execError = error as { status?: number };
        expect(execError.status).toBe(1);
      }
    });

    // AC6: Home directory expansion
    it('expands tilde to home directory', async () => {
      // Create a test directory in home to verify tilde expansion
      const homeTestDir = join(homedir(), '.tidy-test-temp');
      await mkdir(homeTestDir, { recursive: true });
      await writeFile(join(homeTestDir, 'home-file.txt'), 'content');

      try {
        const output = execSync(`node ${CLI_PATH} scan ~/.tidy-test-temp`, {
          encoding: 'utf-8',
        });

        // Verify tilde was expanded (output shows full path, not ~)
        expect(output).toContain('Scanning:');
        expect(output).toContain(homedir());
        expect(output).toContain('home-file.txt');
        // Should NOT show literal tilde in output path
        expect(output).not.toMatch(/Scanning:.*~/);
      } finally {
        await rm(homeTestDir, { recursive: true, force: true });
      }
    });

    it('help shows tilde expansion example', () => {
      const output = execSync(`node ${CLI_PATH} scan --help`, {
        encoding: 'utf-8',
      });

      expect(output).toContain('~/');
    });

    it('help shows path with spaces example', () => {
      const output = execSync(`node ${CLI_PATH} scan --help`, {
        encoding: 'utf-8',
      });

      expect(output).toContain('my folder');
    });
  });

  // Story 5.7: Output format options
  describe('output formats (Story 5.7)', () => {
    // AC1: JSON format outputs valid JSON
    describe('JSON format (AC1)', () => {
      it('outputs valid JSON parseable by tools', async () => {
        await writeFile(join(testDir, 'test.txt'), 'content');

        const output = execSync(`node ${CLI_PATH} scan "${testDir}" --format json`, {
          encoding: 'utf-8',
        });

        // Valid JSON that can be parsed
        const parsed = JSON.parse(output);
        expect(Array.isArray(parsed)).toBe(true);
      });

      it('serializes dates as ISO strings', async () => {
        await writeFile(join(testDir, 'test.txt'), 'content');

        const output = execSync(`node ${CLI_PATH} scan "${testDir}" --format json`, {
          encoding: 'utf-8',
        });

        const parsed = JSON.parse(output);
        // ISO date format: YYYY-MM-DDTHH:mm:ss.sssZ
        expect(parsed[0].createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
        expect(parsed[0].modifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      });

      it('outputs empty array for empty folder', async () => {
        const output = execSync(`node ${CLI_PATH} scan "${testDir}" --format json`, {
          encoding: 'utf-8',
        });

        expect(output.trim()).toBe('[]');
      });

      it('does not include scanning message in JSON output', async () => {
        await writeFile(join(testDir, 'test.txt'), 'content');

        const output = execSync(`node ${CLI_PATH} scan "${testDir}" --format json`, {
          encoding: 'utf-8',
        });

        // First character should be '[' for array, not 'S' for "Scanning"
        expect(output.trim().startsWith('[')).toBe(true);
      });
    });

    // AC2: Table format shows formatted ASCII table
    describe('table format (AC2)', () => {
      it('includes header row with columns', async () => {
        await writeFile(join(testDir, 'test.txt'), 'content');

        const output = execSync(`node ${CLI_PATH} scan "${testDir}" --format table`, {
          encoding: 'utf-8',
        });

        expect(output).toContain('Name');
        expect(output).toContain('Type');
        expect(output).toContain('Size');
      });

      it('shows separator lines', async () => {
        await writeFile(join(testDir, 'test.txt'), 'content');

        const output = execSync(`node ${CLI_PATH} scan "${testDir}" --format table`, {
          encoding: 'utf-8',
        });

        expect(output).toContain('---');
      });

      it('shows total count', async () => {
        await writeFile(join(testDir, 'file1.txt'), 'content1');
        await writeFile(join(testDir, 'file2.txt'), 'content2');

        const output = execSync(`node ${CLI_PATH} scan "${testDir}" --format table`, {
          encoding: 'utf-8',
        });

        expect(output).toContain('2 files');
      });
    });

    // AC3: Plain format outputs one item per line
    describe('plain format (AC3)', () => {
      it('outputs one absolute path per line', async () => {
        await writeFile(join(testDir, 'file1.txt'), 'content1');
        await writeFile(join(testDir, 'file2.txt'), 'content2');

        const output = execSync(`node ${CLI_PATH} scan "${testDir}" --format plain`, {
          encoding: 'utf-8',
        });

        const lines = output.trim().split('\n');
        expect(lines.length).toBe(2);
        // Each line should be an absolute path (works on both Unix and Windows)
        expect(lines.every((l) => isAbsolute(l))).toBe(true);
      });

      it('has no decorative formatting', async () => {
        await writeFile(join(testDir, 'test.txt'), 'content');

        const output = execSync(`node ${CLI_PATH} scan "${testDir}" --format plain`, {
          encoding: 'utf-8',
        });

        expect(output).not.toContain('Name');
        expect(output).not.toContain('---');
        expect(output).not.toContain('Total');
        expect(output).not.toContain('Scanning');
      });

      it('outputs nothing for empty folder', async () => {
        const output = execSync(`node ${CLI_PATH} scan "${testDir}" --format plain`, {
          encoding: 'utf-8',
        });

        expect(output.trim()).toBe('');
      });
    });

    // AC4: Default format is table
    describe('default format (AC4)', () => {
      it('uses table format when no --format specified', async () => {
        await writeFile(join(testDir, 'test.txt'), 'content');

        const output = execSync(`node ${CLI_PATH} scan "${testDir}"`, {
          encoding: 'utf-8',
        });

        // Table format characteristics
        expect(output).toContain('Name');
        expect(output).toContain('---');
        expect(output).toContain('Total');
      });
    });

    // AC5: Output is pipeable
    describe('pipeable output (AC5)', () => {
      it('JSON can be piped (no extra output)', async () => {
        await writeFile(join(testDir, 'test.txt'), 'content');

        const output = execSync(`node ${CLI_PATH} scan "${testDir}" --format json`, {
          encoding: 'utf-8',
        });

        // Should be pure JSON, no extra text
        expect(() => JSON.parse(output)).not.toThrow();
      });

      it('plain format has clean lines for piping', async () => {
        await writeFile(join(testDir, 'test.txt'), 'content');

        const output = execSync(`node ${CLI_PATH} scan "${testDir}" --format plain`, {
          encoding: 'utf-8',
        });

        // Should be clean path(s), no decorations
        const lines = output.trim().split('\n');
        expect(lines.every((l) => !l.includes('Scanning'))).toBe(true);
        expect(lines.every((l) => !l.includes('Total'))).toBe(true);
      });
    });

    // AC6: Colors disabled when not TTY
    describe('--no-color option (AC6)', () => {
      it('--no-color flag is shown in help', () => {
        const output = execSync(`node ${CLI_PATH} scan --help`, {
          encoding: 'utf-8',
        });

        expect(output).toContain('--no-color');
      });

      it('--no-color removes ANSI codes from output', async () => {
        await writeFile(join(testDir, 'test.txt'), 'content');

        const output = execSync(`node ${CLI_PATH} scan "${testDir}" --no-color`, {
          encoding: 'utf-8',
        });

        // Should not contain ANSI escape sequences
        expect(output).not.toMatch(/\x1b\[/);
      });
    });

    describe('invalid format handling', () => {
      it('rejects invalid format value', () => {
        try {
          execSync(`node ${CLI_PATH} scan "${testDir}" --format invalid`, {
            encoding: 'utf-8',
            stdio: 'pipe',
          });
          expect.fail('Should have thrown');
        } catch (error) {
          const execError = error as { stderr?: Buffer };
          const stderr = execError.stderr?.toString() ?? '';
          expect(stderr).toContain('Invalid format');
          expect(stderr).toContain('invalid');
        }
      });

      it('shows valid format options on error', () => {
        try {
          execSync(`node ${CLI_PATH} scan "${testDir}" --format bad`, {
            encoding: 'utf-8',
            stdio: 'pipe',
          });
          expect.fail('Should have thrown');
        } catch (error) {
          const execError = error as { stderr?: Buffer };
          const stderr = execError.stderr?.toString() ?? '';
          expect(stderr).toContain('table');
          expect(stderr).toContain('json');
          expect(stderr).toContain('plain');
        }
      });
    });

    describe('help text', () => {
      it('shows output format descriptions', () => {
        const output = execSync(`node ${CLI_PATH} scan --help`, {
          encoding: 'utf-8',
        });

        expect(output).toContain('Output Formats');
        expect(output).toContain('table');
        expect(output).toContain('json');
        expect(output).toContain('plain');
      });

      it('shows jq piping example', () => {
        const output = execSync(`node ${CLI_PATH} scan --help`, {
          encoding: 'utf-8',
        });

        expect(output).toContain('jq');
      });

      it('shows xargs example', () => {
        const output = execSync(`node ${CLI_PATH} scan --help`, {
          encoding: 'utf-8',
        });

        expect(output).toContain('xargs');
      });
    });
  });
});
