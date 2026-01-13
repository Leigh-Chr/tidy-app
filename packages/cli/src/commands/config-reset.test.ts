/**
 * @fileoverview Tests for config reset command - Story 5.4
 *
 * AC covered:
 * - AC1: Reset command restores defaults
 * - AC3: Force flag skips confirmation
 * - AC4: Reset reports what was changed
 * - AC5: Reset handles missing config gracefully
 *
 * Note: These tests use XDG_CONFIG_HOME which is only respected on Linux.
 * On macOS, env-paths uses ~/Library/Preferences and ignores XDG vars.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync, spawn, type ChildProcess } from 'node:child_process';
import { mkdir, rm, readFile, writeFile } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI_PATH = resolve(__dirname, '../../dist/index.js');

// Skip on macOS - env-paths ignores XDG_CONFIG_HOME and uses ~/Library/Preferences
const isMacOS = process.platform === 'darwin';

describe.skipIf(isMacOS)('tidy config reset', () => {
  let testDir: string;
  let xdgConfigHome: string;
  let configDir: string;
  let configPath: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `tidy-reset-test-${Date.now()}`);
    xdgConfigHome = join(testDir, '.config');
    configDir = join(xdgConfigHome, 'tidy-app');
    configPath = join(configDir, 'config.json');
    await mkdir(configDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  // AC1: Reset command restores defaults
  // AC3: Force flag skips confirmation
  describe('with --force flag', () => {
    it('resets config without prompting', async () => {
      // Create custom config with non-default values
      const customConfig = {
        version: 1,
        templates: [
          {
            id: 'custom-id',
            name: 'Custom Template',
            pattern: '{custom}',
            isDefault: false,
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
        ],
        preferences: {
          colorOutput: false,
          confirmBeforeApply: false,
          defaultOutputFormat: 'json',
          recursiveScan: true,
        },
        recentFolders: ['/some/folder'],
      };
      await writeFile(configPath, JSON.stringify(customConfig));

      // Run reset with force
      execSync(`node ${CLI_PATH} config reset --force`, {
        encoding: 'utf-8',
        env: { ...process.env, HOME: testDir, XDG_CONFIG_HOME: xdgConfigHome },
      });

      // Verify reset to defaults
      const content = await readFile(configPath, 'utf-8');
      const config = JSON.parse(content);

      expect(config.preferences.colorOutput).toBe(true);
      expect(config.preferences.confirmBeforeApply).toBe(true);
      expect(config.preferences.defaultOutputFormat).toBe('table');
      expect(config.preferences.recursiveScan).toBe(false);
      expect(config.recentFolders).toHaveLength(0);
    });

    it('removes custom templates and restores defaults', async () => {
      const customConfig = {
        version: 1,
        templates: [
          {
            id: 'custom-id',
            name: 'My Custom Template',
            pattern: '{my}-{custom}',
            isDefault: true,
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
        ],
        preferences: {
          colorOutput: true,
          confirmBeforeApply: true,
          defaultOutputFormat: 'table',
          recursiveScan: false,
        },
        recentFolders: [],
      };
      await writeFile(configPath, JSON.stringify(customConfig));

      execSync(`node ${CLI_PATH} config reset --force`, {
        encoding: 'utf-8',
        env: { ...process.env, HOME: testDir, XDG_CONFIG_HOME: xdgConfigHome },
      });

      const content = await readFile(configPath, 'utf-8');
      const config = JSON.parse(content);

      // Should have default templates, not custom
      expect(config.templates.length).toBeGreaterThan(0);
      expect(config.templates.find((t: { name: string }) => t.name === 'Date Prefix')).toBeDefined();
      expect(config.templates.find((t: { name: string }) => t.name === 'My Custom Template')).toBeUndefined();
    });

    // AC5: Reset handles missing config gracefully
    it('creates config file with defaults if not exists', async () => {
      // Ensure no config exists
      await rm(configPath, { force: true });

      const output = execSync(`node ${CLI_PATH} config reset --force`, {
        encoding: 'utf-8',
        env: { ...process.env, HOME: testDir, XDG_CONFIG_HOME: xdgConfigHome },
      });

      // File should be created with defaults
      const content = await readFile(configPath, 'utf-8');
      const config = JSON.parse(content);

      expect(config.version).toBe(1);
      expect(config.templates.length).toBeGreaterThan(0);
      expect(output).toContain('initialized');
    });
  });

  // AC4: Reset reports what was changed
  describe('summary output', () => {
    it('reports removed custom templates', async () => {
      const customConfig = {
        version: 1,
        templates: [
          {
            id: '11111111-1111-1111-8111-111111111111',
            name: 'My Template',
            pattern: '{x}',
            isDefault: false,
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
          {
            id: '22222222-2222-2222-8222-222222222222',
            name: 'Another Custom',
            pattern: '{y}',
            isDefault: false,
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
        ],
        preferences: {
          colorOutput: true,
          confirmBeforeApply: true,
          defaultOutputFormat: 'table',
          recursiveScan: false,
        },
        recentFolders: [],
      };
      await writeFile(configPath, JSON.stringify(customConfig));

      const output = execSync(`node ${CLI_PATH} config reset --force`, {
        encoding: 'utf-8',
        env: { ...process.env, HOME: testDir, XDG_CONFIG_HOME: xdgConfigHome },
      });

      expect(output).toContain('custom template');
    });

    it('reports preference changes', async () => {
      const customConfig = {
        version: 1,
        templates: [],
        preferences: {
          colorOutput: false,
          confirmBeforeApply: false,
          defaultOutputFormat: 'json',
          recursiveScan: true,
        },
        recentFolders: [],
      };
      await writeFile(configPath, JSON.stringify(customConfig));

      const output = execSync(`node ${CLI_PATH} config reset --force`, {
        encoding: 'utf-8',
        env: { ...process.env, HOME: testDir, XDG_CONFIG_HOME: xdgConfigHome },
      });

      expect(output).toContain('colorOutput');
      expect(output).toContain('recursiveScan');
    });

    it('reports cleared recent folders', async () => {
      const customConfig = {
        version: 1,
        templates: [],
        preferences: {
          colorOutput: true,
          confirmBeforeApply: true,
          defaultOutputFormat: 'table',
          recursiveScan: false,
        },
        recentFolders: ['/folder/one', '/folder/two', '/folder/three'],
      };
      await writeFile(configPath, JSON.stringify(customConfig));

      const output = execSync(`node ${CLI_PATH} config reset --force`, {
        encoding: 'utf-8',
        env: { ...process.env, HOME: testDir, XDG_CONFIG_HOME: xdgConfigHome },
      });

      expect(output).toContain('recent folder');
    });

    it('displays config file path', async () => {
      await writeFile(
        configPath,
        JSON.stringify({
          version: 1,
          templates: [],
          preferences: {
            colorOutput: true,
            confirmBeforeApply: true,
            defaultOutputFormat: 'table',
            recursiveScan: false,
          },
          recentFolders: [],
        })
      );

      const output = execSync(`node ${CLI_PATH} config reset --force`, {
        encoding: 'utf-8',
        env: { ...process.env, HOME: testDir, XDG_CONFIG_HOME: xdgConfigHome },
      });

      expect(output).toContain('config.json');
      expect(output).toContain('tidy-app');
    });
  });

  // AC2: Confirmation prompt by default
  describe('without --force flag', () => {
    it('prompts for confirmation and resets on yes', async () => {
      await writeFile(
        configPath,
        JSON.stringify({
          version: 1,
          templates: [],
          preferences: {
            colorOutput: false,
            confirmBeforeApply: true,
            defaultOutputFormat: 'table',
            recursiveScan: false,
          },
          recentFolders: [],
        })
      );

      const result = await runWithInput(
        ['config', 'reset'],
        'y\n',
        { HOME: testDir, XDG_CONFIG_HOME: xdgConfigHome }
      );

      expect(result.output).toContain('Reset configuration');
      expect(result.exitCode).toBe(0);

      // Config should be reset
      const content = await readFile(configPath, 'utf-8');
      const config = JSON.parse(content);
      expect(config.preferences.colorOutput).toBe(true);
    });

    it('cancels on no response', async () => {
      const originalConfig = {
        version: 1,
        templates: [],
        preferences: {
          colorOutput: false,
          confirmBeforeApply: true,
          defaultOutputFormat: 'table',
          recursiveScan: false,
        },
        recentFolders: [],
      };
      await writeFile(configPath, JSON.stringify(originalConfig));

      const result = await runWithInput(
        ['config', 'reset'],
        'n\n',
        { HOME: testDir, XDG_CONFIG_HOME: xdgConfigHome }
      );

      expect(result.output).toContain('cancelled');

      // Config should be unchanged
      const content = await readFile(configPath, 'utf-8');
      const config = JSON.parse(content);
      expect(config.preferences.colorOutput).toBe(false);
    });

    it('cancels on empty response (default is no)', async () => {
      const originalConfig = {
        version: 1,
        templates: [],
        preferences: {
          colorOutput: false,
          confirmBeforeApply: true,
          defaultOutputFormat: 'table',
          recursiveScan: false,
        },
        recentFolders: [],
      };
      await writeFile(configPath, JSON.stringify(originalConfig));

      const result = await runWithInput(
        ['config', 'reset'],
        '\n',
        { HOME: testDir, XDG_CONFIG_HOME: xdgConfigHome }
      );

      expect(result.output).toContain('cancelled');

      // Config should be unchanged
      const content = await readFile(configPath, 'utf-8');
      const config = JSON.parse(content);
      expect(config.preferences.colorOutput).toBe(false);
    });
  });

  // AC5: Edge cases
  describe('edge cases', () => {
    it('handles corrupt config file gracefully', async () => {
      await writeFile(configPath, 'not valid json {{{');

      const output = execSync(`node ${CLI_PATH} config reset --force`, {
        encoding: 'utf-8',
        env: { ...process.env, HOME: testDir, XDG_CONFIG_HOME: xdgConfigHome },
      });

      // Should succeed and create valid config
      const content = await readFile(configPath, 'utf-8');
      const config = JSON.parse(content);
      expect(config.version).toBe(1);
      expect(output).toContain('reset');
    });

    it('fails gracefully in non-interactive mode without --force', async () => {
      await writeFile(
        configPath,
        JSON.stringify({
          version: 1,
          templates: [],
          preferences: {
            colorOutput: true,
            confirmBeforeApply: true,
            defaultOutputFormat: 'table',
            recursiveScan: false,
          },
          recentFolders: [],
        })
      );

      // Run without stdin (simulates CI/non-interactive)
      const result = await runWithClosedStdin(
        ['config', 'reset'],
        { HOME: testDir, XDG_CONFIG_HOME: xdgConfigHome }
      );

      expect(result.exitCode).toBe(1);
      expect(result.output).toContain('non-interactive');
      expect(result.output).toContain('--force');
    });
  });
});

// Helper function to run CLI with stdin input (simulates interactive mode)
async function runWithInput(
  args: string[],
  input: string,
  env: Record<string, string>
): Promise<{ output: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    const proc: ChildProcess = spawn('node', [CLI_PATH, ...args], {
      // TIDY_FORCE_INTERACTIVE=1 bypasses TTY check for testing
      env: { ...process.env, ...env, TIDY_FORCE_INTERACTIVE: '1' },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let output = '';
    let stderr = '';

    proc.stdout?.on('data', (data: Buffer) => {
      output += data.toString();
    });

    proc.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      resolve({ output: output + stderr, exitCode: code ?? 0 });
    });

    proc.on('error', reject);

    // Send input
    if (proc.stdin) {
      proc.stdin.write(input);
      proc.stdin.end();
    }
  });
}

// Helper to run CLI with stdin immediately closed (non-TTY, no input)
async function runWithClosedStdin(
  args: string[],
  env: Record<string, string>
): Promise<{ output: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    const proc: ChildProcess = spawn('node', [CLI_PATH, ...args], {
      env: { ...process.env, ...env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let output = '';
    let stderr = '';

    proc.stdout?.on('data', (data: Buffer) => {
      output += data.toString();
    });

    proc.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      resolve({ output: output + stderr, exitCode: code ?? 0 });
    });

    proc.on('error', reject);

    // Close stdin immediately without writing
    proc.stdin?.end();
  });
}
