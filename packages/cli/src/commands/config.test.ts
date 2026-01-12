/**
 * @fileoverview Tests for config commands - Story 5.3
 *
 * AC covered:
 * - AC4: Defaults documented in help (config show)
 * - AC5: Defaults can be exported (config init)
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'node:child_process';
import { mkdir, rm, readFile, access } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI_PATH = resolve(__dirname, '../../dist/index.js');

describe('tidy config commands', () => {
  let testDir: string;
  let xdgConfigHome: string;
  let configDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `tidy-config-cmd-test-${Date.now()}`);
    // env-paths adds the app name as a subdirectory under XDG_CONFIG_HOME
    // So XDG_CONFIG_HOME=$testDir/.config results in $testDir/.config/tidy-app/config.json
    xdgConfigHome = join(testDir, '.config');
    configDir = join(xdgConfigHome, 'tidy-app');
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  // AC4: Defaults documented in help
  describe('config show', () => {
    it('displays configuration heading', () => {
      const output = execSync(`node ${CLI_PATH} config show`, {
        encoding: 'utf-8',
        env: { ...process.env, HOME: testDir, XDG_CONFIG_HOME: xdgConfigHome },
      });

      expect(output).toContain('Configuration');
    });

    it('displays colorOutput preference', () => {
      const output = execSync(`node ${CLI_PATH} config show`, {
        encoding: 'utf-8',
        env: { ...process.env, HOME: testDir, XDG_CONFIG_HOME: xdgConfigHome },
      });

      expect(output).toContain('colorOutput');
    });

    it('displays confirmBeforeApply preference', () => {
      const output = execSync(`node ${CLI_PATH} config show`, {
        encoding: 'utf-8',
        env: { ...process.env, HOME: testDir, XDG_CONFIG_HOME: xdgConfigHome },
      });

      expect(output).toContain('confirmBeforeApply');
    });

    it('displays defaultOutputFormat preference', () => {
      const output = execSync(`node ${CLI_PATH} config show`, {
        encoding: 'utf-8',
        env: { ...process.env, HOME: testDir, XDG_CONFIG_HOME: xdgConfigHome },
      });

      expect(output).toContain('defaultOutputFormat');
    });

    it('displays recursiveScan preference', () => {
      const output = execSync(`node ${CLI_PATH} config show`, {
        encoding: 'utf-8',
        env: { ...process.env, HOME: testDir, XDG_CONFIG_HOME: xdgConfigHome },
      });

      expect(output).toContain('recursiveScan');
    });

    it('displays templates section', () => {
      const output = execSync(`node ${CLI_PATH} config show`, {
        encoding: 'utf-8',
        env: { ...process.env, HOME: testDir, XDG_CONFIG_HOME: xdgConfigHome },
      });

      expect(output).toContain('Templates');
    });

    it('displays default templates', () => {
      const output = execSync(`node ${CLI_PATH} config show`, {
        encoding: 'utf-8',
        env: { ...process.env, HOME: testDir, XDG_CONFIG_HOME: xdgConfigHome },
      });

      expect(output).toContain('Date Prefix');
      expect(output).toContain('{date}-{name}');
    });
  });

  // AC5: Defaults can be exported
  describe('config init', () => {
    it('creates config file with defaults', async () => {
      execSync(`node ${CLI_PATH} config init`, {
        encoding: 'utf-8',
        env: { ...process.env, HOME: testDir, XDG_CONFIG_HOME: xdgConfigHome },
      });

      const configPath = join(configDir, 'config.json');
      await access(configPath);
      const content = await readFile(configPath, 'utf-8');
      const config = JSON.parse(content);

      expect(config.version).toBe(1);
      expect(config.templates).toBeDefined();
      expect(config.templates.length).toBeGreaterThan(0);
      expect(config.preferences).toBeDefined();
    });

    it('output indicates success', () => {
      const output = execSync(`node ${CLI_PATH} config init`, {
        encoding: 'utf-8',
        env: { ...process.env, HOME: testDir, XDG_CONFIG_HOME: xdgConfigHome },
      });

      expect(output).toContain('initialized');
    });

    it('refuses to overwrite without --force', async () => {
      // First init
      execSync(`node ${CLI_PATH} config init`, {
        encoding: 'utf-8',
        env: { ...process.env, HOME: testDir, XDG_CONFIG_HOME: xdgConfigHome },
      });

      // Second init should fail
      expect(() => {
        execSync(`node ${CLI_PATH} config init`, {
          encoding: 'utf-8',
          stdio: 'pipe',
          env: { ...process.env, HOME: testDir, XDG_CONFIG_HOME: xdgConfigHome },
        });
      }).toThrow();
    });

    it('overwrites with --force', async () => {
      // First init
      execSync(`node ${CLI_PATH} config init`, {
        encoding: 'utf-8',
        env: { ...process.env, HOME: testDir, XDG_CONFIG_HOME: xdgConfigHome },
      });

      // Second init with force should succeed
      const output = execSync(`node ${CLI_PATH} config init --force`, {
        encoding: 'utf-8',
        env: { ...process.env, HOME: testDir, XDG_CONFIG_HOME: xdgConfigHome },
      });

      expect(output).toContain('initialized');
    });
  });

  describe('config path', () => {
    it('outputs config file path', () => {
      const output = execSync(`node ${CLI_PATH} config path`, {
        encoding: 'utf-8',
        env: { ...process.env, HOME: testDir, XDG_CONFIG_HOME: xdgConfigHome },
      });

      expect(output.trim()).toContain('tidy-app');
      expect(output.trim()).toContain('config.json');
    });
  });

  // Story 10.4: File type configuration display
  describe('config show - file types (Story 10.4)', () => {
    it('displays File Types section heading', () => {
      const output = execSync(`node ${CLI_PATH} config show`, {
        encoding: 'utf-8',
        env: { ...process.env, HOME: testDir, XDG_CONFIG_HOME: xdgConfigHome },
      });

      expect(output).toContain('File Types');
    });

    it('displays preset category', () => {
      const output = execSync(`node ${CLI_PATH} config show`, {
        encoding: 'utf-8',
        env: { ...process.env, HOME: testDir, XDG_CONFIG_HOME: xdgConfigHome },
      });

      expect(output).toContain('Preset');
      expect(output).toContain('documents');
    });

    it('displays included extensions label', () => {
      const output = execSync(`node ${CLI_PATH} config show`, {
        encoding: 'utf-8',
        env: { ...process.env, HOME: testDir, XDG_CONFIG_HOME: xdgConfigHome },
      });

      expect(output).toContain('Included');
    });

    it('displays excluded extensions label', () => {
      const output = execSync(`node ${CLI_PATH} config show`, {
        encoding: 'utf-8',
        env: { ...process.env, HOME: testDir, XDG_CONFIG_HOME: xdgConfigHome },
      });

      expect(output).toContain('Excluded');
    });

    it('displays skip with metadata setting', () => {
      const output = execSync(`node ${CLI_PATH} config show`, {
        encoding: 'utf-8',
        env: { ...process.env, HOME: testDir, XDG_CONFIG_HOME: xdgConfigHome },
      });

      expect(output).toMatch(/skip.*metadata/i);
    });

    it('displays preset extensions for documents preset', () => {
      const output = execSync(`node ${CLI_PATH} config show`, {
        encoding: 'utf-8',
        env: { ...process.env, HOME: testDir, XDG_CONFIG_HOME: xdgConfigHome },
      });

      // Should show some of the document extensions
      expect(output).toContain('pdf');
    });
  });
});
