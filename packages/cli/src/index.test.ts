import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'node:child_process';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';

// Minimal valid config for tests
const VALID_CONFIG = {
  version: 1,
  templates: [],
  preferences: {
    defaultOutputFormat: 'table' as const,
    colorOutput: true,
    confirmBeforeRename: true,
    recursiveScan: false,
  },
  recentFolders: [],
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI_PATH = resolve(__dirname, '../dist/index.js');

describe('tidy CLI', () => {
  describe('--version', () => {
    it('outputs version in tidy-app vX.X.X format', () => {
      const output = execSync(`node ${CLI_PATH} --version`, {
        encoding: 'utf-8',
      }).trim();
      expect(output).toMatch(/^tidy-app v\d+\.\d+\.\d+$/);
    });

    it('outputs same version as @tidy/core', async () => {
      const { VERSION } = await import('@tidy/core');
      const output = execSync(`node ${CLI_PATH} --version`, {
        encoding: 'utf-8',
      }).trim();
      expect(output).toBe(`tidy-app v${VERSION}`);
    });

    it('supports -V shorthand flag', () => {
      const output = execSync(`node ${CLI_PATH} -V`, {
        encoding: 'utf-8',
      }).trim();
      expect(output).toMatch(/^tidy-app v\d+\.\d+\.\d+$/);
    });
  });

  describe('--help', () => {
    it('shows usage information', () => {
      const output = execSync(`node ${CLI_PATH} --help`, {
        encoding: 'utf-8',
      });
      expect(output).toContain('tidy');
      expect(output).toContain('Intelligent file organization tool');
    });

    it('lists available commands', () => {
      const output = execSync(`node ${CLI_PATH} --help`, {
        encoding: 'utf-8',
      });
      expect(output).toContain('scan');
      expect(output).toContain('config');
      expect(output).toContain('info');
    });
  });

  describe('info command', () => {
    it('displays application info', () => {
      const output = execSync(`node ${CLI_PATH} info`, {
        encoding: 'utf-8',
      });
      expect(output).toContain('tidy-app');
      expect(output).toContain('Intelligent file organization tool');
    });

    it('shows quick commands', () => {
      const output = execSync(`node ${CLI_PATH} info`, {
        encoding: 'utf-8',
      });
      // These are the commands shown in Quick Commands section
      expect(output).toContain('scan');
      expect(output).toContain('config');
      expect(output).toContain('history');
    });
  });

  describe('unknown command', () => {
    it('exits with error for unknown command', () => {
      expect(() => {
        execSync(`node ${CLI_PATH} unknown-command`, {
          encoding: 'utf-8',
          stdio: 'pipe',
        });
      }).toThrow();
    });

    it('shows helpful suggestion message', () => {
      try {
        execSync(`node ${CLI_PATH} fakecommand`, {
          encoding: 'utf-8',
          stdio: 'pipe',
        });
        expect.fail('Should have thrown');
      } catch (error) {
        const execError = error as { stderr?: Buffer };
        const stderr = execError.stderr?.toString() ?? '';
        expect(stderr).toContain('Unknown command');
        expect(stderr).toContain('fakecommand');
        expect(stderr).toContain('tidy --help');
      }
    });
  });

  // Story 5.2: --config option
  describe('--config option', () => {
    let testDir: string;
    let validConfigPath: string;

    beforeEach(async () => {
      testDir = join(tmpdir(), `tidy-cli-config-test-${Date.now()}`);
      await mkdir(testDir, { recursive: true });
      validConfigPath = join(testDir, 'config.json');
      await writeFile(validConfigPath, JSON.stringify(VALID_CONFIG, null, 2));
    });

    afterEach(async () => {
      await rm(testDir, { recursive: true, force: true });
    });

    // AC1: Custom config via --config argument
    it('shows --config option in help', () => {
      const output = execSync(`node ${CLI_PATH} --help`, {
        encoding: 'utf-8',
      });
      expect(output).toContain('--config');
      expect(output).toContain('-c');
    });

    // AC2: Error for non-existent custom config
    it('exits with error for non-existent config file', () => {
      const nonExistentPath = join(testDir, 'does-not-exist.json');
      expect(() => {
        execSync(`node ${CLI_PATH} --config "${nonExistentPath}" info`, {
          encoding: 'utf-8',
          stdio: 'pipe',
        });
      }).toThrow();
    });

    it('error message indicates file not found', () => {
      const nonExistentPath = join(testDir, 'does-not-exist.json');
      try {
        execSync(`node ${CLI_PATH} --config "${nonExistentPath}" info`, {
          encoding: 'utf-8',
          stdio: 'pipe',
        });
        expect.fail('Should have thrown');
      } catch (error) {
        const execError = error as { stderr?: Buffer };
        const stderr = execError.stderr?.toString() ?? '';
        expect(stderr).toContain('not found');
      }
    });

    // Story 5.2 AC3: Relative paths supported
    it('accepts relative config path', async () => {
      // Create config in test directory
      const relativeConfig = './test-config.json';
      const absolutePath = join(testDir, 'test-config.json');
      await writeFile(absolutePath, JSON.stringify(VALID_CONFIG, null, 2));

      // Run from test directory
      const output = execSync(`node ${CLI_PATH} --config "${relativeConfig}" info`, {
        encoding: 'utf-8',
        cwd: testDir,
      });
      expect(output).toContain('tidy-app');
    });

    // AC3: Absolute paths supported
    it('accepts absolute config path', () => {
      const output = execSync(`node ${CLI_PATH} --config "${validConfigPath}" info`, {
        encoding: 'utf-8',
      });
      expect(output).toContain('tidy-app');
    });

    // AC4: Config persists across subcommands
    it('uses config for subcommands', () => {
      const output = execSync(`node ${CLI_PATH} --config "${validConfigPath}" info`, {
        encoding: 'utf-8',
      });
      expect(output).toContain('tidy-app');
    });

    // AC5: Environment variable support
    it('uses TIDY_CONFIG environment variable', () => {
      const output = execSync(`node ${CLI_PATH} info`, {
        encoding: 'utf-8',
        env: { ...process.env, TIDY_CONFIG: validConfigPath },
      });
      expect(output).toContain('tidy-app');
    });

    it('--config takes precedence over env var', async () => {
      // Create two different configs
      const envConfigPath = join(testDir, 'env-config.json');
      const cliConfigPath = join(testDir, 'cli-config.json');
      await writeFile(envConfigPath, JSON.stringify(VALID_CONFIG, null, 2));
      await writeFile(cliConfigPath, JSON.stringify(VALID_CONFIG, null, 2));

      // This should use CLI config, not env config
      const output = execSync(`node ${CLI_PATH} --config "${cliConfigPath}" info`, {
        encoding: 'utf-8',
        env: { ...process.env, TIDY_CONFIG: envConfigPath },
      });
      expect(output).toContain('tidy-app');
    });
  });

  // Story 9.2: History Command Integration Tests
  describe('history command', () => {
    let testDir: string;
    let historyDir: string;
    let historyPath: string;

    beforeEach(async () => {
      testDir = join(tmpdir(), `tidy-history-test-${Date.now()}`);
      historyDir = join(testDir, '.config', 'tidy-app');
      historyPath = join(historyDir, 'history.json');
      await mkdir(historyDir, { recursive: true });
    });

    afterEach(async () => {
      await rm(testDir, { recursive: true, force: true });
    });

    it('shows history in help output', () => {
      const output = execSync(`node ${CLI_PATH} --help`, {
        encoding: 'utf-8',
      });
      expect(output).toContain('history');
      expect(output).toContain('View operation history');
    });

    it('shows history command help', () => {
      const output = execSync(`node ${CLI_PATH} history --help`, {
        encoding: 'utf-8',
      });
      expect(output).toContain('View operation history');
      expect(output).toContain('--limit');
      expect(output).toContain('--format');
      expect(output).toContain('--type');
    });

    it('displays empty history message when no history exists (AC2)', () => {
      const output = execSync(`node ${CLI_PATH} history`, {
        encoding: 'utf-8',
        env: { ...process.env, HOME: testDir },
      });
      expect(output).toContain('No operation history found');
    });

    it('outputs empty JSON array with --format json when empty (AC6)', () => {
      const output = execSync(`node ${CLI_PATH} history --format json`, {
        encoding: 'utf-8',
        env: { ...process.env, HOME: testDir },
      });
      expect(output.trim()).toBe('[]');
    });

    it('outputs nothing with --format plain when empty', () => {
      const output = execSync(`node ${CLI_PATH} history --format plain`, {
        encoding: 'utf-8',
        env: { ...process.env, HOME: testDir },
      });
      expect(output.trim()).toBe('');
    });

    it('exits with error for invalid entry ID (AC5)', () => {
      expect(() => {
        execSync(`node ${CLI_PATH} history non-existent-id`, {
          encoding: 'utf-8',
          stdio: 'pipe',
          env: { ...process.env, HOME: testDir },
        });
      }).toThrow();
    });

    it('error message contains invalid ID (AC5)', () => {
      try {
        execSync(`node ${CLI_PATH} history fake-id-12345`, {
          encoding: 'utf-8',
          stdio: 'pipe',
          env: { ...process.env, HOME: testDir },
        });
        expect.fail('Should have thrown');
      } catch (error) {
        const execError = error as { stderr?: Buffer };
        const stderr = execError.stderr?.toString() ?? '';
        expect(stderr).toContain('History entry not found');
        expect(stderr).toContain('fake-id-12345');
      }
    });
  });

  // Story 9.3: Undo Command Integration Tests
  describe('undo command', () => {
    let testDir: string;
    let historyDir: string;

    beforeEach(async () => {
      testDir = join(tmpdir(), `tidy-undo-test-${Date.now()}`);
      historyDir = join(testDir, '.config', 'tidy-app');
      await mkdir(historyDir, { recursive: true });
    });

    afterEach(async () => {
      await rm(testDir, { recursive: true, force: true });
    });

    it('shows undo in help output', () => {
      const output = execSync(`node ${CLI_PATH} --help`, {
        encoding: 'utf-8',
      });
      expect(output).toContain('undo');
    });

    it('shows undo command help', () => {
      const output = execSync(`node ${CLI_PATH} undo --help`, {
        encoding: 'utf-8',
      });
      expect(output).toContain('Undo');
      expect(output).toContain('--dry-run');
      expect(output).toContain('--format');
      expect(output).toContain('--force');
    });

    it('shows error when no operations to undo (AC2)', () => {
      expect(() => {
        execSync(`node ${CLI_PATH} undo`, {
          encoding: 'utf-8',
          stdio: 'pipe',
          env: { ...process.env, HOME: testDir },
        });
      }).toThrow();
    });

    it('error message indicates no operations', () => {
      try {
        execSync(`node ${CLI_PATH} undo`, {
          encoding: 'utf-8',
          stdio: 'pipe',
          env: { ...process.env, HOME: testDir },
        });
        expect.fail('Should have thrown');
      } catch (error) {
        const execError = error as { stderr?: Buffer };
        const stderr = execError.stderr?.toString() ?? '';
        expect(stderr).toContain('No operations');
      }
    });

    it('exits with error for invalid operation ID (AC5)', () => {
      expect(() => {
        execSync(`node ${CLI_PATH} undo non-existent-id`, {
          encoding: 'utf-8',
          stdio: 'pipe',
          env: { ...process.env, HOME: testDir },
        });
      }).toThrow();
    });

    it('error message contains invalid ID (AC5)', () => {
      try {
        execSync(`node ${CLI_PATH} undo fake-op-id-999`, {
          encoding: 'utf-8',
          stdio: 'pipe',
          env: { ...process.env, HOME: testDir },
        });
        expect.fail('Should have thrown');
      } catch (error) {
        const execError = error as { stderr?: Buffer };
        const stderr = execError.stderr?.toString() ?? '';
        expect(stderr).toContain('Operation not found');
      }
    });
  });

  // Story 9.4: Restore command integration tests
  describe('restore command', () => {
    let testDir: string;
    let historyDir: string;

    beforeEach(async () => {
      testDir = join(tmpdir(), `tidy-restore-test-${Date.now()}`);
      historyDir = join(testDir, '.config', 'tidy-app');
      await mkdir(historyDir, { recursive: true });
    });

    afterEach(async () => {
      await rm(testDir, { recursive: true, force: true });
    });

    it('shows restore in help output', () => {
      const output = execSync(`node ${CLI_PATH} --help`, {
        encoding: 'utf-8',
      });
      expect(output).toContain('restore');
    });

    it('shows restore command help', () => {
      const output = execSync(`node ${CLI_PATH} restore --help`, {
        encoding: 'utf-8',
      });
      expect(output).toContain('Restore');
      expect(output).toContain('--operation');
      expect(output).toContain('--lookup');
      expect(output).toContain('--dry-run');
      expect(output).toContain('--format');
    });

    it('shows error for file not in history (AC5)', () => {
      expect(() => {
        execSync(`node ${CLI_PATH} restore /nonexistent/file.txt`, {
          encoding: 'utf-8',
          stdio: 'pipe',
          env: { ...process.env, HOME: testDir },
        });
      }).toThrow();
    });

    it('error contains "No history found" message (AC5)', () => {
      try {
        execSync(`node ${CLI_PATH} restore /path/to/unknown/file.txt`, {
          encoding: 'utf-8',
          stdio: 'pipe',
          env: { ...process.env, HOME: testDir },
        });
        expect.fail('Should have thrown');
      } catch (error) {
        const execError = error as { stdout?: Buffer };
        const stdout = execError.stdout?.toString() ?? '';
        expect(stdout).toContain('No history found');
      }
    });

    it('lookup mode shows not found for unknown file (AC3)', () => {
      try {
        execSync(`node ${CLI_PATH} restore /unknown/file.txt --lookup`, {
          encoding: 'utf-8',
          stdio: 'pipe',
          env: { ...process.env, HOME: testDir },
        });
        expect.fail('Should have thrown');
      } catch (error) {
        // "Not found" goes to stdout (console.log), not stderr
        const execError = error as { stdout?: Buffer };
        const stdout = execError.stdout?.toString() ?? '';
        expect(stdout).toContain('No history found');
      }
    });

    it('JSON output for lookup mode when file not found (AC8)', () => {
      try {
        execSync(`node ${CLI_PATH} restore /unknown.txt --lookup --format json`, {
          encoding: 'utf-8',
          stdio: 'pipe',
          env: { ...process.env, HOME: testDir },
        });
        expect.fail('Should have thrown');
      } catch (error) {
        const execError = error as { stdout?: Buffer };
        const stdout = execError.stdout?.toString() ?? '';
        const parsed = JSON.parse(stdout);
        expect(parsed.found).toBe(false);
      }
    });
  });
});
