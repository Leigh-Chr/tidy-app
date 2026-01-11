/**
 * @fileoverview Tests for info command - Story 10.1
 *
 * AC5: LLM status shown when running `tidy info`
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createInfoCommand } from './info.js';
import { Command } from 'commander';

// Mock chalk to simplify output testing
vi.mock('chalk', () => ({
  default: {
    blue: { bold: (s: string) => s },
    gray: (s: string) => s,
    green: (s: string) => s,
    yellow: (s: string) => s,
    red: (s: string) => s,
    cyan: (s: string) => s,
    dim: (s: string) => s,
    bold: (s: string) => s,
  },
}));

// Mock @tidy/core
vi.mock('@tidy/core', () => ({
  VERSION: '0.0.1',
  DEFAULT_CONFIG: {
    version: 1,
    templates: [],
    preferences: {
      defaultOutputFormat: 'table',
      colorOutput: true,
      confirmBeforeApply: true,
      recursiveScan: false,
      rulePriorityMode: 'combined',
    },
    recentFolders: [],
    rules: [],
    filenameRules: [],
    folderStructures: [],
    ollama: {
      enabled: false,
      baseUrl: 'http://localhost:11434',
      timeout: 30000,
      models: {},
    },
  },
  getOllamaStatus: vi.fn().mockResolvedValue('Disabled'),
  getOllamaHealthReport: vi.fn().mockResolvedValue({
    available: false,
    baseUrl: 'http://localhost:11434',
    responseTimeMs: 0,
  }),
  // Story 10.6: New offline support functions
  checkLlmAvailabilityForOperation: vi.fn().mockResolvedValue({
    available: false,
    reason: 'LLM disabled',
    suggestion: 'Enable LLM in config',
    responseTimeMs: 50,
  }),
  formatOfflineStatus: vi.fn().mockReturnValue([
    'Mode:            Offline (LLM not available)',
    'Reason:          LLM disabled',
    'Suggestion:      Enable LLM in config',
  ]),
}));

describe('Info Command - Story 10.1', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let stdoutSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createInfoCommand', () => {
    it('should create a command named "info"', () => {
      const cmd = createInfoCommand();
      expect(cmd.name()).toBe('info');
    });

    it('should have a description', () => {
      const cmd = createInfoCommand();
      expect(cmd.description()).toContain('information');
    });

    it('should have --verbose option', () => {
      const cmd = createInfoCommand();
      const verboseOption = cmd.options.find(opt => opt.long === '--verbose');
      expect(verboseOption).toBeDefined();
    });
  });

  describe('info command execution', () => {
    it('should display version information', async () => {
      const program = new Command();
      program.addCommand(createInfoCommand());

      // Set up mock context
      program.setOptionValue('_context', {
        config: {
          version: 1,
          templates: [],
          preferences: {},
          recentFolders: [],
          rules: [],
          filenameRules: [],
          folderStructures: [],
          ollama: {
            enabled: false,
            baseUrl: 'http://localhost:11434',
            timeout: 30000,
            models: {},
          },
        },
      });

      await program.parseAsync(['node', 'test', 'info']);

      // Check that version was displayed
      const output = consoleSpy.mock.calls.flat().join('\n');
      expect(output).toContain('tidy-app');
      expect(output).toContain('0.0.1');
    });

    it('should display LLM status section (AC5)', async () => {
      const program = new Command();
      program.addCommand(createInfoCommand());

      program.setOptionValue('_context', {
        config: {
          version: 1,
          templates: [],
          preferences: {},
          recentFolders: [],
          rules: [],
          filenameRules: [],
          folderStructures: [],
          ollama: {
            enabled: false,
            baseUrl: 'http://localhost:11434',
            timeout: 30000,
            models: {},
          },
        },
      });

      await program.parseAsync(['node', 'test', 'info']);

      const output = consoleSpy.mock.calls.flat().join('\n');
      expect(output).toContain('LLM Integration');
      expect(output).toContain('Ollama');
    });

    it('should show disabled status when LLM is disabled', async () => {
      const program = new Command();
      program.addCommand(createInfoCommand());

      program.setOptionValue('_context', {
        config: {
          version: 1,
          templates: [],
          preferences: {},
          recentFolders: [],
          rules: [],
          filenameRules: [],
          folderStructures: [],
          ollama: {
            enabled: false,
            baseUrl: 'http://localhost:11434',
            timeout: 30000,
            models: {},
          },
        },
      });

      await program.parseAsync(['node', 'test', 'info']);

      const output = consoleSpy.mock.calls.flat().join('\n');
      expect(output).toContain('disabled');
    });

    it('should show base URL and timeout', async () => {
      const program = new Command();
      program.addCommand(createInfoCommand());

      program.setOptionValue('_context', {
        config: {
          version: 1,
          templates: [],
          preferences: {},
          recentFolders: [],
          rules: [],
          filenameRules: [],
          folderStructures: [],
          ollama: {
            enabled: false,
            baseUrl: 'http://192.168.1.100:11434',
            timeout: 60000,
            models: {},
          },
        },
      });

      await program.parseAsync(['node', 'test', 'info']);

      const output = consoleSpy.mock.calls.flat().join('\n');
      expect(output).toContain('http://192.168.1.100:11434');
      expect(output).toContain('60000ms');
    });

    it('should check connection when LLM is enabled', async () => {
      // Story 10.6: Updated to use checkLlmAvailabilityForOperation
      const { checkLlmAvailabilityForOperation } = await import('@tidy/core');

      const program = new Command();
      program.addCommand(createInfoCommand());

      program.setOptionValue('_context', {
        config: {
          version: 1,
          templates: [],
          preferences: {},
          recentFolders: [],
          rules: [],
          filenameRules: [],
          folderStructures: [],
          ollama: {
            enabled: true,
            baseUrl: 'http://localhost:11434',
            timeout: 30000,
            models: { inference: 'mistral' },
          },
        },
      });

      await program.parseAsync(['node', 'test', 'info']);

      expect(checkLlmAvailabilityForOperation).toHaveBeenCalled();
    });

    // Story 10.6: Test for offline mode display
    it('should display offline mode status', async () => {
      const program = new Command();
      program.addCommand(createInfoCommand());

      program.setOptionValue('_context', {
        config: {
          version: 1,
          templates: [],
          preferences: {},
          recentFolders: [],
          rules: [],
          filenameRules: [],
          folderStructures: [],
          ollama: {
            enabled: true,
            baseUrl: 'http://localhost:11434',
            timeout: 30000,
            models: { inference: 'mistral' },
            offlineMode: 'auto',
          },
        },
      });

      await program.parseAsync(['node', 'test', 'info']);

      const output = consoleSpy.mock.calls.flat().join('\n');
      expect(output).toContain('Offline');
    });
  });
});
