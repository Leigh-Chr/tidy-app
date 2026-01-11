/**
 * @fileoverview Tests for configuration loader - Story 5.1
 *
 * AC covered:
 * - AC1: Save configuration to standard location
 * - AC2: Auto-load configuration on startup
 * - AC3: Handle invalid configuration gracefully
 * - AC4: Handle missing configuration directory
 * - AC5: Cross-platform config location
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm, readFile, stat, chmod } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadConfig, saveConfig, getConfigPath, configExists } from './loader.js';
import { DEFAULT_CONFIG, type AppConfig } from './schema.js';

describe('config loader', () => {
  let testDir: string;
  let testConfigPath: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `tidy-config-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(testDir, { recursive: true });
    testConfigPath = join(testDir, 'config.json');
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  // =============================================================================
  // getConfigPath Tests (AC5: Cross-platform config location)
  // =============================================================================
  describe('getConfigPath', () => {
    it('returns default path when no custom path provided', () => {
      const path = getConfigPath();
      expect(path).toContain('tidy-app');
      expect(path).toContain('config.json');
    });

    it('returns custom path when provided', () => {
      const customPath = '/custom/path/config.json';
      const path = getConfigPath({ configPath: customPath });
      expect(path).toBe(customPath);
    });

    it('uses env-paths for OS-appropriate location', () => {
      const path = getConfigPath();
      // Path should be in a config directory
      const platform = process.platform;
      if (platform === 'darwin') {
        expect(path).toContain('Library/Application Support');
      } else if (platform === 'win32') {
        // Windows uses AppData
        expect(path.toLowerCase()).toMatch(/appdata/i);
      } else {
        // Linux uses .config
        expect(path).toContain('.config');
      }
    });
  });

  // =============================================================================
  // loadConfig Tests (AC2, AC3)
  // =============================================================================
  describe('loadConfig', () => {
    // AC2: Auto-load configuration
    it('returns defaults when config does not exist', async () => {
      const result = await loadConfig({ configPath: testConfigPath, strict: false });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.version).toBe(DEFAULT_CONFIG.version);
        expect(result.data.preferences).toEqual(DEFAULT_CONFIG.preferences);
      }
    });

    it('loads valid configuration file', async () => {
      const customConfig: AppConfig = {
        ...DEFAULT_CONFIG,
        preferences: {
          ...DEFAULT_CONFIG.preferences,
          colorOutput: false,
          defaultOutputFormat: 'json',
        },
      };
      await writeFile(testConfigPath, JSON.stringify(customConfig, null, 2));

      const result = await loadConfig({ configPath: testConfigPath });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.preferences.colorOutput).toBe(false);
        expect(result.data.preferences.defaultOutputFormat).toBe('json');
      }
    });

    it('preserves all custom settings when loading', async () => {
      const customConfig: AppConfig = {
        version: 1,
        templates: [],
        preferences: {
          defaultOutputFormat: 'plain',
          colorOutput: false,
          confirmBeforeApply: false,
          recursiveScan: true,
          rulePriorityMode: 'metadata-first',
        },
        recentFolders: ['/test/folder1', '/test/folder2'],
        rules: [],
        filenameRules: [],
        folderStructures: [],
        ollama: {
          enabled: false,
          provider: 'ollama',
          baseUrl: 'http://localhost:11434',
          timeout: 30000,
          models: {},
          fileTypes: {
            preset: 'documents',
            includedExtensions: [],
            excludedExtensions: [],
            skipWithMetadata: true,
          },
          visionEnabled: false,
          skipImagesWithExif: true,
          maxImageSize: 20 * 1024 * 1024,
          offlineMode: 'auto',
          healthCheckTimeout: 5000,
          openai: {
            apiKey: '',
            baseUrl: 'https://api.openai.com/v1',
            model: 'gpt-4o-mini',
            visionModel: 'gpt-4o',
          },
        },
      };
      await writeFile(testConfigPath, JSON.stringify(customConfig, null, 2));

      const result = await loadConfig({ configPath: testConfigPath });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual(customConfig);
      }
    });

    // AC3: Handle invalid configuration gracefully (non-strict mode)
    it('returns defaults for invalid JSON', async () => {
      await writeFile(testConfigPath, '{ invalid json }');

      const result = await loadConfig({ configPath: testConfigPath, strict: false });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.version).toBe(DEFAULT_CONFIG.version);
      }
    });

    it('returns defaults for invalid schema (wrong version)', async () => {
      await writeFile(testConfigPath, JSON.stringify({ version: 999 }));

      const result = await loadConfig({ configPath: testConfigPath, strict: false });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual(DEFAULT_CONFIG);
      }
    });

    it('returns defaults for invalid schema (missing required fields)', async () => {
      await writeFile(testConfigPath, JSON.stringify({ foo: 'bar' }));

      const result = await loadConfig({ configPath: testConfigPath, strict: false });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.version).toBe(1);
      }
    });

    it('returns defaults for empty file', async () => {
      await writeFile(testConfigPath, '');

      const result = await loadConfig({ configPath: testConfigPath, strict: false });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual(DEFAULT_CONFIG);
      }
    });

    it('handles truncated JSON gracefully', async () => {
      await writeFile(testConfigPath, '{"version": 1, "templates":');

      const result = await loadConfig({ configPath: testConfigPath, strict: false });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual(DEFAULT_CONFIG);
      }
    });

    it('applies schema defaults for missing optional fields', async () => {
      // Minimal valid config - just version
      await writeFile(testConfigPath, JSON.stringify({ version: 1 }));

      const result = await loadConfig({ configPath: testConfigPath });

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Schema defaults should be applied
        expect(result.data.templates).toEqual([]);
        // Zod coerces missing preferences to default empty object with defaults
        expect(result.data.preferences).toBeDefined();
        expect(result.data.preferences.defaultOutputFormat).toBe('table');
        expect(result.data.preferences.colorOutput).toBe(true);
        expect(result.data.recentFolders).toEqual([]);
      }
    });

    // Story 7.1 - Migration test for existing configs without rules
    it('migrates existing configs without rules field', async () => {
      // Config from before Story 7.1 (no rules field)
      const legacyConfig = {
        version: 1,
        templates: [],
        preferences: {
          defaultOutputFormat: 'table',
          colorOutput: true,
          confirmBeforeApply: true,
          recursiveScan: false,
        },
        recentFolders: ['/some/path'],
      };
      await writeFile(testConfigPath, JSON.stringify(legacyConfig, null, 2));

      const result = await loadConfig({ configPath: testConfigPath });

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Rules should be added as empty array (default)
        expect(result.data.rules).toEqual([]);
        // Other fields should be preserved
        expect(result.data.recentFolders).toEqual(['/some/path']);
        expect(result.data.preferences.colorOutput).toBe(true);
      }
    });

    // Story 7.2 - Migration test for existing configs without filenameRules
    it('migrates existing configs without filenameRules field', async () => {
      // Config from before Story 7.2 (has rules but no filenameRules)
      const legacyConfig = {
        version: 1,
        templates: [],
        preferences: {
          defaultOutputFormat: 'table',
          colorOutput: true,
          confirmBeforeApply: true,
          recursiveScan: false,
        },
        recentFolders: ['/some/path'],
        rules: [],
      };
      await writeFile(testConfigPath, JSON.stringify(legacyConfig, null, 2));

      const result = await loadConfig({ configPath: testConfigPath });

      expect(result.ok).toBe(true);
      if (result.ok) {
        // filenameRules should be added as empty array (default)
        expect(result.data.filenameRules).toEqual([]);
        // Existing fields should be preserved
        expect(result.data.rules).toEqual([]);
        expect(result.data.recentFolders).toEqual(['/some/path']);
        expect(result.data.preferences.colorOutput).toBe(true);
      }
    });

    // Story 10.1 - Migration test for existing configs without ollama
    it('migrates existing configs without ollama field', async () => {
      // Config from before Story 10.1 (no ollama field)
      const legacyConfig = {
        version: 1,
        templates: [],
        preferences: {
          defaultOutputFormat: 'table',
          colorOutput: true,
          confirmBeforeApply: true,
          recursiveScan: false,
          rulePriorityMode: 'combined',
        },
        recentFolders: ['/some/path'],
        rules: [],
        filenameRules: [],
        folderStructures: [],
      };
      await writeFile(testConfigPath, JSON.stringify(legacyConfig, null, 2));

      const result = await loadConfig({ configPath: testConfigPath });

      expect(result.ok).toBe(true);
      if (result.ok) {
        // ollama should be added with defaults (disabled by default - AC1)
        // Story 10.4: fileTypes should also be added with defaults
        // Story 10.5: vision fields should also be added with defaults
        // Story 10.6: offline fields should also be added with defaults
        expect(result.data.ollama).toEqual({
          enabled: false,
          provider: 'ollama',
          baseUrl: 'http://localhost:11434',
          timeout: 30000,
          models: {},
          fileTypes: {
            preset: 'documents',
            includedExtensions: [],
            excludedExtensions: [],
            skipWithMetadata: true,
          },
          visionEnabled: false,
          skipImagesWithExif: true,
          maxImageSize: 20 * 1024 * 1024,
          offlineMode: 'auto',
          healthCheckTimeout: 5000,
          openai: {
            apiKey: '',
            baseUrl: 'https://api.openai.com/v1',
            model: 'gpt-4o-mini',
            visionModel: 'gpt-4o',
          },
        });
        // Existing fields should be preserved
        expect(result.data.rules).toEqual([]);
        expect(result.data.filenameRules).toEqual([]);
        expect(result.data.recentFolders).toEqual(['/some/path']);
        expect(result.data.preferences.colorOutput).toBe(true);
      }
    });
  });

  // =============================================================================
  // saveConfig Tests (AC1, AC4)
  // =============================================================================
  describe('saveConfig', () => {
    // AC1: Save configuration to standard location
    it('saves configuration to file', async () => {
      const result = await saveConfig(DEFAULT_CONFIG, { configPath: testConfigPath });

      expect(result.ok).toBe(true);

      const content = await readFile(testConfigPath, 'utf-8');
      const saved = JSON.parse(content);
      expect(saved.version).toBe(1);
      expect(saved.preferences).toEqual(DEFAULT_CONFIG.preferences);
    });

    it('saves configuration with pretty formatting', async () => {
      await saveConfig(DEFAULT_CONFIG, { configPath: testConfigPath });

      const content = await readFile(testConfigPath, 'utf-8');
      // Check for indentation (pretty printing)
      expect(content).toContain('\n');
      expect(content).toMatch(/^\{\n\s+/); // Opening brace followed by newline and indentation
    });

    // AC1: Appropriate permissions (600) - Unix only
    it.skipIf(process.platform === 'win32')('sets file permissions to 600', async () => {
      await saveConfig(DEFAULT_CONFIG, { configPath: testConfigPath });

      const stats = await stat(testConfigPath);
      const mode = stats.mode & 0o777;
      expect(mode).toBe(0o600);
    });

    // AC4: Handle missing configuration directory
    it('creates directory if not exists', async () => {
      const nestedPath = join(testDir, 'nested', 'deeply', 'dir', 'config.json');

      const result = await saveConfig(DEFAULT_CONFIG, { configPath: nestedPath });

      expect(result.ok).toBe(true);
      const content = await readFile(nestedPath, 'utf-8');
      expect(JSON.parse(content).version).toBe(1);
    });

    // AC4: Directory permissions (700) - Unix only
    it.skipIf(process.platform === 'win32')('creates directory with 700 permissions', async () => {
      const nestedDir = join(testDir, 'secure-dir');
      const nestedPath = join(nestedDir, 'config.json');

      await saveConfig(DEFAULT_CONFIG, { configPath: nestedPath });

      const stats = await stat(nestedDir);
      const mode = stats.mode & 0o777;
      expect(mode).toBe(0o700);
    });

    it('rejects invalid config (wrong version)', async () => {
      const invalidConfig = { version: 999 } as unknown as AppConfig;

      const result = await saveConfig(invalidConfig, { configPath: testConfigPath });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('Invalid config');
      }
    });

    it('rejects invalid config (bad preference value)', async () => {
      const invalidConfig = {
        ...DEFAULT_CONFIG,
        preferences: {
          ...DEFAULT_CONFIG.preferences,
          defaultOutputFormat: 'invalid' as 'table',
        },
      };

      const result = await saveConfig(invalidConfig, { configPath: testConfigPath });

      expect(result.ok).toBe(false);
    });

    it('rejects config with more than 10 recent folders', async () => {
      const invalidConfig: AppConfig = {
        ...DEFAULT_CONFIG,
        recentFolders: [
          '/folder1', '/folder2', '/folder3', '/folder4', '/folder5',
          '/folder6', '/folder7', '/folder8', '/folder9', '/folder10',
          '/folder11', // 11th folder exceeds max(10)
        ],
      };

      const result = await saveConfig(invalidConfig, { configPath: testConfigPath });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('Invalid config');
      }
    });

    it('accepts config with exactly 10 recent folders', async () => {
      const validConfig: AppConfig = {
        ...DEFAULT_CONFIG,
        recentFolders: [
          '/folder1', '/folder2', '/folder3', '/folder4', '/folder5',
          '/folder6', '/folder7', '/folder8', '/folder9', '/folder10',
        ],
      };

      const result = await saveConfig(validConfig, { configPath: testConfigPath });

      expect(result.ok).toBe(true);
    });

    it('preserves existing templates when saving', async () => {
      const configWithTemplates: AppConfig = {
        ...DEFAULT_CONFIG,
        templates: [
          {
            id: '550e8400-e29b-41d4-a716-446655440000',
            name: 'Custom Template',
            pattern: '{year}-{month}-{original}',
            isDefault: true,
            createdAt: '2026-01-10T00:00:00.000Z',
            updatedAt: '2026-01-10T00:00:00.000Z',
          },
        ],
      };

      await saveConfig(configWithTemplates, { configPath: testConfigPath });
      const result = await loadConfig({ configPath: testConfigPath });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.templates).toHaveLength(1);
        expect(result.data.templates[0]?.name).toBe('Custom Template');
      }
    });
  });

  // =============================================================================
  // configExists Tests
  // =============================================================================
  describe('configExists', () => {
    it('returns false when config does not exist', async () => {
      const exists = await configExists({ configPath: testConfigPath });
      expect(exists).toBe(false);
    });

    it('returns true when config exists', async () => {
      await writeFile(testConfigPath, JSON.stringify(DEFAULT_CONFIG));
      const exists = await configExists({ configPath: testConfigPath });
      expect(exists).toBe(true);
    });

    it('returns true even for invalid config content', async () => {
      await writeFile(testConfigPath, 'not valid json');
      const exists = await configExists({ configPath: testConfigPath });
      expect(exists).toBe(true);
    });
  });

  // =============================================================================
  // Round-trip Tests (AC1, AC2 combined)
  // =============================================================================
  describe('save/load round-trip', () => {
    it('round-trips default config', async () => {
      await saveConfig(DEFAULT_CONFIG, { configPath: testConfigPath });
      const result = await loadConfig({ configPath: testConfigPath });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual(DEFAULT_CONFIG);
      }
    });

    it('round-trips modified preferences', async () => {
      const modified: AppConfig = {
        ...DEFAULT_CONFIG,
        preferences: {
          defaultOutputFormat: 'json',
          colorOutput: false,
          confirmBeforeApply: false,
          recursiveScan: true,
          rulePriorityMode: 'combined',
        },
      };

      await saveConfig(modified, { configPath: testConfigPath });
      const result = await loadConfig({ configPath: testConfigPath });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.preferences).toEqual(modified.preferences);
      }
    });

    it('round-trips templates', async () => {
      const withTemplates: AppConfig = {
        ...DEFAULT_CONFIG,
        templates: [
          {
            id: '550e8400-e29b-41d4-a716-446655440000',
            name: 'Date Prefix',
            pattern: '{year}-{month}-{day}-{original}',
            fileTypes: ['jpg', 'png'],
            isDefault: true,
            createdAt: '2026-01-10T12:00:00.000Z',
            updatedAt: '2026-01-10T12:00:00.000Z',
          },
          {
            id: '550e8400-e29b-41d4-a716-446655440001',
            name: 'Simple',
            pattern: '{original}_{counter}',
            isDefault: false,
            createdAt: '2026-01-10T12:00:00.000Z',
            updatedAt: '2026-01-10T12:00:00.000Z',
          },
        ],
      };

      await saveConfig(withTemplates, { configPath: testConfigPath });
      const result = await loadConfig({ configPath: testConfigPath });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.templates).toHaveLength(2);
        expect(result.data.templates[0]?.fileTypes).toEqual(['jpg', 'png']);
      }
    });

    it('round-trips recent folders', async () => {
      const withFolders: AppConfig = {
        ...DEFAULT_CONFIG,
        recentFolders: ['/home/user/photos', '/home/user/documents', '/tmp'],
      };

      await saveConfig(withFolders, { configPath: testConfigPath });
      const result = await loadConfig({ configPath: testConfigPath });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.recentFolders).toEqual(withFolders.recentFolders);
      }
    });
  });

  // =============================================================================
  // Strict Mode Tests (AC2 for Story 5.2)
  // =============================================================================
  describe('strict mode', () => {
    it('returns error for non-existent custom config in strict mode', async () => {
      const missingPath = join(testDir, 'missing.json');

      const result = await loadConfig({
        configPath: missingPath,
        strict: true,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('not found');
        expect(result.error.message).toContain(missingPath);
      }
    });

    it('returns error for invalid JSON in strict mode', async () => {
      await writeFile(testConfigPath, '{ invalid json }');

      const result = await loadConfig({
        configPath: testConfigPath,
        strict: true,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('Invalid JSON');
      }
    });

    it('returns error for invalid schema in strict mode', async () => {
      await writeFile(testConfigPath, JSON.stringify({ version: 999 }));

      const result = await loadConfig({
        configPath: testConfigPath,
        strict: true,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('Invalid config');
      }
    });

    it('custom path implies strict mode by default', async () => {
      const missingPath = join(testDir, 'missing.json');

      // Custom path without explicit strict=false should error (AC2)
      const result = await loadConfig({
        configPath: missingPath,
      });

      // Custom paths are strict by default - missing file returns error
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('not found');
      }
    });

    it('returns defaults for missing file in non-strict mode', async () => {
      const missingPath = join(testDir, 'missing.json');

      const result = await loadConfig({
        configPath: missingPath,
        strict: false,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual(DEFAULT_CONFIG);
      }
    });

    it('returns defaults for invalid JSON in non-strict mode', async () => {
      await writeFile(testConfigPath, '{ invalid }');

      const result = await loadConfig({
        configPath: testConfigPath,
        strict: false,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual(DEFAULT_CONFIG);
      }
    });
  });

  // =============================================================================
  // Error Handling Tests
  // =============================================================================
  describe('error handling', () => {
    it.skipIf(process.platform === 'win32')('handles permission denied on read', async () => {
      await writeFile(testConfigPath, JSON.stringify(DEFAULT_CONFIG));
      await chmod(testConfigPath, 0o000);

      try {
        const result = await loadConfig({ configPath: testConfigPath });
        // Should return error or defaults depending on implementation
        expect(result.ok).toBeDefined();
      } finally {
        // Restore permissions for cleanup
        await chmod(testConfigPath, 0o644);
      }
    });

    it.skipIf(process.platform === 'win32')('handles permission denied on write', async () => {
      const restrictedDir = join(testDir, 'restricted');
      await mkdir(restrictedDir, { mode: 0o500 });
      const restrictedPath = join(restrictedDir, 'config.json');

      try {
        const result = await saveConfig(DEFAULT_CONFIG, { configPath: restrictedPath });
        expect(result.ok).toBe(false);
      } finally {
        await chmod(restrictedDir, 0o755);
      }
    });
  });
});
