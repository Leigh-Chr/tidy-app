/**
 * @fileoverview Unit tests for config command - Story 5.3, 5.4, 10.1
 *
 * These tests import the command directly for coverage instrumentation,
 * as opposed to the integration tests that use execSync.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createConfigCommand } from './config.js';
import { DEFAULT_CONFIG } from '@tidy/core';

// Mock console and process.exit
let mockConsoleLog: ReturnType<typeof vi.spyOn>;
let mockConsoleError: ReturnType<typeof vi.spyOn>;
let mockProcessExit: ReturnType<typeof vi.spyOn>;
let capturedOutput: string[] = [];
let capturedErrors: string[] = [];

// Mock core functions
const mockLoadConfig = vi.fn();
const mockSaveConfig = vi.fn();
const mockGetConfigPath = vi.fn();
const mockConfigExists = vi.fn();
const mockGetOllamaStatus = vi.fn();

vi.mock('@tidy/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tidy/core')>();
  return {
    ...actual,
    loadConfig: (...args: unknown[]) => mockLoadConfig(...args),
    saveConfig: (...args: unknown[]) => mockSaveConfig(...args),
    getConfigPath: (...args: unknown[]) => mockGetConfigPath(...args),
    configExists: (...args: unknown[]) => mockConfigExists(...args),
    getOllamaStatus: (...args: unknown[]) => mockGetOllamaStatus(...args),
  };
});

// Mock prompts to avoid interactive input
vi.mock('../utils/prompts.js', () => ({
  confirm: vi.fn().mockResolvedValue({
    confirmed: true,
    cancelled: false,
  }),
}));

// =============================================================================
// Test Suite: Command Creation
// =============================================================================

describe('createConfigCommand', () => {
  it('should create a command named "config"', () => {
    const command = createConfigCommand();
    expect(command.name()).toBe('config');
  });

  it('should have description', () => {
    const command = createConfigCommand();
    expect(command.description()).toContain('configuration');
  });

  it('should have show subcommand', () => {
    const command = createConfigCommand();
    const showCmd = command.commands.find((c) => c.name() === 'show');
    expect(showCmd).toBeDefined();
  });

  it('should have init subcommand', () => {
    const command = createConfigCommand();
    const initCmd = command.commands.find((c) => c.name() === 'init');
    expect(initCmd).toBeDefined();
  });

  it('should have path subcommand', () => {
    const command = createConfigCommand();
    const pathCmd = command.commands.find((c) => c.name() === 'path');
    expect(pathCmd).toBeDefined();
  });

  it('should have reset subcommand', () => {
    const command = createConfigCommand();
    const resetCmd = command.commands.find((c) => c.name() === 'reset');
    expect(resetCmd).toBeDefined();
  });
});

// =============================================================================
// Test Suite: show subcommand
// =============================================================================

describe('config show', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedOutput = [];
    capturedErrors = [];

    mockConsoleLog = vi.spyOn(console, 'log').mockImplementation((msg) => {
      capturedOutput.push(String(msg ?? ''));
    });

    mockConsoleError = vi.spyOn(console, 'error').mockImplementation((msg) => {
      capturedErrors.push(String(msg ?? ''));
    });

    mockProcessExit = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit(${code})`);
    });

    // Default mocks
    mockGetOllamaStatus.mockResolvedValue('Disabled');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should display Configuration heading', async () => {
    const command = createConfigCommand();
    await command.parseAsync(['show'], { from: 'user' });

    expect(capturedOutput.join(' ')).toContain('Configuration');
  });

  it('should display Preferences section', async () => {
    const command = createConfigCommand();
    await command.parseAsync(['show'], { from: 'user' });

    expect(capturedOutput.join(' ')).toContain('Preferences');
  });

  it('should display Templates section', async () => {
    const command = createConfigCommand();
    await command.parseAsync(['show'], { from: 'user' });

    expect(capturedOutput.join(' ')).toContain('Templates');
  });

  it('should display LLM Integration section', async () => {
    const command = createConfigCommand();
    await command.parseAsync(['show'], { from: 'user' });

    expect(capturedOutput.join(' ')).toContain('LLM Integration');
  });

  it('should display colorOutput preference', async () => {
    const command = createConfigCommand();
    await command.parseAsync(['show'], { from: 'user' });

    expect(capturedOutput.join(' ')).toContain('colorOutput');
  });

  it('should display confirmBeforeApply preference', async () => {
    const command = createConfigCommand();
    await command.parseAsync(['show'], { from: 'user' });

    expect(capturedOutput.join(' ')).toContain('confirmBeforeApply');
  });

  it('should display File Types section', async () => {
    const command = createConfigCommand();
    await command.parseAsync(['show'], { from: 'user' });

    expect(capturedOutput.join(' ')).toContain('File Types');
  });
});

// =============================================================================
// Test Suite: init subcommand
// =============================================================================

describe('config init', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedOutput = [];
    capturedErrors = [];

    mockConsoleLog = vi.spyOn(console, 'log').mockImplementation((msg) => {
      capturedOutput.push(String(msg ?? ''));
    });

    mockConsoleError = vi.spyOn(console, 'error').mockImplementation((msg) => {
      capturedErrors.push(String(msg ?? ''));
    });

    mockProcessExit = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit(${code})`);
    });

    // Default mocks
    mockGetConfigPath.mockReturnValue('/test/.config/tidy-app/config.json');
    mockConfigExists.mockResolvedValue(false);
    mockSaveConfig.mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should create config file when it does not exist', async () => {
    mockConfigExists.mockResolvedValue(false);

    const command = createConfigCommand();
    await command.parseAsync(['init'], { from: 'user' });

    expect(mockSaveConfig).toHaveBeenCalledWith(
      DEFAULT_CONFIG,
      expect.any(Object)
    );
  });

  it('should display success message', async () => {
    const command = createConfigCommand();
    await command.parseAsync(['init'], { from: 'user' });

    expect(capturedOutput.join(' ')).toContain('initialized');
  });

  it('should exit with error when config exists without --force', async () => {
    mockConfigExists.mockResolvedValue(true);

    const command = createConfigCommand();

    await expect(
      command.parseAsync(['init'], { from: 'user' })
    ).rejects.toThrow('process.exit(1)');

    expect(capturedErrors.join(' ')).toContain('already exists');
  });

  it('should overwrite config with --force', async () => {
    mockConfigExists.mockResolvedValue(true);

    const command = createConfigCommand();
    await command.parseAsync(['init', '--force'], { from: 'user' });

    expect(mockSaveConfig).toHaveBeenCalled();
    expect(capturedOutput.join(' ')).toContain('initialized');
  });

  it('should exit with error when save fails', async () => {
    mockSaveConfig.mockResolvedValue({
      ok: false,
      error: new Error('Write failed'),
    });

    const command = createConfigCommand();

    await expect(
      command.parseAsync(['init'], { from: 'user' })
    ).rejects.toThrow('process.exit(1)');

    expect(capturedErrors.join(' ')).toContain('Write failed');
  });
});

// =============================================================================
// Test Suite: path subcommand
// =============================================================================

describe('config path', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedOutput = [];

    mockConsoleLog = vi.spyOn(console, 'log').mockImplementation((msg) => {
      capturedOutput.push(String(msg ?? ''));
    });

    mockGetConfigPath.mockReturnValue('/test/.config/tidy-app/config.json');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should output config path', async () => {
    const command = createConfigCommand();
    await command.parseAsync(['path'], { from: 'user' });

    expect(capturedOutput.join('')).toContain('/test/.config/tidy-app/config.json');
  });
});

// =============================================================================
// Test Suite: reset subcommand
// =============================================================================

describe('config reset', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedOutput = [];
    capturedErrors = [];

    mockConsoleLog = vi.spyOn(console, 'log').mockImplementation((msg) => {
      capturedOutput.push(String(msg ?? ''));
    });

    mockConsoleError = vi.spyOn(console, 'error').mockImplementation((msg) => {
      capturedErrors.push(String(msg ?? ''));
    });

    mockProcessExit = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit(${code})`);
    });

    // Default mocks
    mockGetConfigPath.mockReturnValue('/test/.config/tidy-app/config.json');
    mockConfigExists.mockResolvedValue(true);
    mockLoadConfig.mockResolvedValue({ ok: true, data: DEFAULT_CONFIG });
    mockSaveConfig.mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should reset config with --force flag', async () => {
    const command = createConfigCommand();
    await command.parseAsync(['reset', '--force'], { from: 'user' });

    expect(mockSaveConfig).toHaveBeenCalledWith(
      DEFAULT_CONFIG,
      expect.any(Object)
    );
  });

  it('should display success message after reset', async () => {
    const command = createConfigCommand();
    await command.parseAsync(['reset', '--force'], { from: 'user' });

    expect(capturedOutput.join(' ')).toMatch(/reset|defaults|initialized/i);
  });

  it('should exit with error when save fails', async () => {
    mockSaveConfig.mockResolvedValue({
      ok: false,
      error: new Error('Write failed'),
    });

    const command = createConfigCommand();

    await expect(
      command.parseAsync(['reset', '--force'], { from: 'user' })
    ).rejects.toThrow('process.exit(1)');

    expect(capturedErrors.join(' ')).toContain('Write failed');
  });

  it('should handle non-existent config on reset', async () => {
    mockConfigExists.mockResolvedValue(false);

    const command = createConfigCommand();
    await command.parseAsync(['reset', '--force'], { from: 'user' });

    expect(mockSaveConfig).toHaveBeenCalled();
  });

  it('should show "initialized with defaults" when config did not exist', async () => {
    mockConfigExists.mockResolvedValue(false);

    const command = createConfigCommand();
    await command.parseAsync(['reset', '--force'], { from: 'user' });

    expect(capturedOutput.join(' ')).toMatch(/initialized|defaults/i);
  });

  it('should load previous config when it exists', async () => {
    mockConfigExists.mockResolvedValue(true);
    mockLoadConfig.mockResolvedValue({
      ok: true,
      data: {
        ...DEFAULT_CONFIG,
        preferences: {
          ...DEFAULT_CONFIG.preferences,
          colorOutput: false,
        },
      },
    });

    const command = createConfigCommand();
    await command.parseAsync(['reset', '--force'], { from: 'user' });

    expect(mockLoadConfig).toHaveBeenCalled();
    expect(capturedOutput.join(' ')).toMatch(/reset|Changes/i);
  });
});

// =============================================================================
// Test Suite: Helper functions coverage
// =============================================================================

describe('config show - ollama section', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedOutput = [];

    mockConsoleLog = vi.spyOn(console, 'log').mockImplementation((msg) => {
      capturedOutput.push(String(msg ?? ''));
    });

    mockGetOllamaStatus.mockResolvedValue('Connected');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should display ollama enabled status', async () => {
    const command = createConfigCommand();
    await command.parseAsync(['show'], { from: 'user' });

    expect(capturedOutput.join(' ')).toContain('enabled');
  });

  it('should display ollama baseUrl', async () => {
    const command = createConfigCommand();
    await command.parseAsync(['show'], { from: 'user' });

    expect(capturedOutput.join(' ')).toContain('baseUrl');
  });

  it('should display ollama timeout', async () => {
    const command = createConfigCommand();
    await command.parseAsync(['show'], { from: 'user' });

    expect(capturedOutput.join(' ')).toContain('timeout');
  });
});
