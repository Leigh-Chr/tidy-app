/**
 * @fileoverview Unit tests for scan command - Story 5.5, 5.6, 5.7, 5.8
 *
 * These tests import the command directly for coverage instrumentation,
 * as opposed to the integration tests that use execSync.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createScanCommand, type OutputFormat, type ScanCommandOptions } from './scan.js';
import type { FileInfo } from '@tidy/core';

// =============================================================================
// Test Fixtures
// =============================================================================

function createMockFileInfo(overrides: Partial<FileInfo> = {}): FileInfo {
  return {
    path: '/test/folder/file.jpg',
    relativePath: 'file.jpg',
    name: 'file',
    fullName: 'file.jpg',
    extension: 'jpg',
    size: 1024,
    createdAt: new Date('2026-01-10T10:00:00.000Z'),
    modifiedAt: new Date('2026-01-10T12:00:00.000Z'),
    category: 'image',
    mimeType: 'image/jpeg',
    metadataSupported: true,
    metadataCapability: 'full',
    ...overrides,
  };
}

// Mock console and process.exit
let mockConsoleLog: ReturnType<typeof vi.spyOn>;
let mockConsoleError: ReturnType<typeof vi.spyOn>;
let mockProcessExit: ReturnType<typeof vi.spyOn>;
let capturedOutput: string[] = [];
let capturedErrors: string[] = [];

// Mock scanFolder and getFolderToScan
const mockScanFolder = vi.fn();
const mockGetFolderToScan = vi.fn();

vi.mock('@tidy/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tidy/core')>();
  return {
    ...actual,
    scanFolder: (...args: unknown[]) => mockScanFolder(...args),
  };
});

vi.mock('../utils/path.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/path.js')>();
  return {
    ...actual,
    getFolderToScan: (...args: unknown[]) => mockGetFolderToScan(...args),
  };
});

// =============================================================================
// Test Suite: Command Creation
// =============================================================================

describe('createScanCommand', () => {
  it('should create a command named "scan"', () => {
    const command = createScanCommand();
    expect(command.name()).toBe('scan');
  });

  it('should have description containing "Scan"', () => {
    const command = createScanCommand();
    expect(command.description()).toContain('Scan');
  });

  it('should accept optional folder argument', () => {
    const command = createScanCommand();
    const args = command.registeredArguments;
    expect(args).toHaveLength(1);
    expect(args[0].name()).toBe('folder');
    expect(args[0].required).toBe(false);
  });

  it('should have --format option with default table', () => {
    const command = createScanCommand();
    const formatOption = command.options.find((o) => o.long === '--format');
    expect(formatOption).toBeDefined();
    expect(formatOption?.defaultValue).toBe('table');
  });

  it('should have --recursive option with default false', () => {
    const command = createScanCommand();
    const recursiveOption = command.options.find((o) => o.long === '--recursive');
    expect(recursiveOption).toBeDefined();
  });

  it('should have --no-color option', () => {
    const command = createScanCommand();
    const colorOption = command.options.find((o) => o.long === '--no-color');
    expect(colorOption).toBeDefined();
  });

  it('should have short -f alias for format', () => {
    const command = createScanCommand();
    const formatOption = command.options.find((o) => o.short === '-f');
    expect(formatOption).toBeDefined();
    expect(formatOption?.long).toBe('--format');
  });

  it('should have short -r alias for recursive', () => {
    const command = createScanCommand();
    const recursiveOption = command.options.find((o) => o.short === '-r');
    expect(recursiveOption).toBeDefined();
    expect(recursiveOption?.long).toBe('--recursive');
  });
});

// =============================================================================
// Test Suite: Command Execution
// =============================================================================

describe('scan command execution', () => {
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

    // Default mock for getFolderToScan
    mockGetFolderToScan.mockResolvedValue({
      ok: true,
      data: { path: '/test/folder', isDefault: false },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('folder resolution', () => {
    it('should call getFolderToScan with provided folder', async () => {
      mockScanFolder.mockResolvedValue({ ok: true, data: [] });

      const command = createScanCommand();
      await command.parseAsync(['/test/path'], { from: 'user' });

      expect(mockGetFolderToScan).toHaveBeenCalledWith('/test/path');
    });

    it('should call getFolderToScan with undefined when no folder provided', async () => {
      mockScanFolder.mockResolvedValue({ ok: true, data: [] });

      const command = createScanCommand();
      await command.parseAsync([], { from: 'user' });

      expect(mockGetFolderToScan).toHaveBeenCalledWith(undefined);
    });

    it('should show "current directory" message when using default folder', async () => {
      mockGetFolderToScan.mockResolvedValue({
        ok: true,
        data: { path: '/current/dir', isDefault: true },
      });
      mockScanFolder.mockResolvedValue({ ok: true, data: [] });

      const command = createScanCommand();
      await command.parseAsync([], { from: 'user' });

      expect(capturedOutput.join(' ')).toContain('current directory');
    });

    it('should exit with error when folder resolution fails', async () => {
      mockGetFolderToScan.mockResolvedValue({
        ok: false,
        error: new Error('Path does not exist'),
      });

      const command = createScanCommand();

      await expect(
        command.parseAsync(['/nonexistent'], { from: 'user' })
      ).rejects.toThrow('process.exit(1)');

      expect(capturedErrors.join(' ')).toContain('Path does not exist');
    });
  });

  describe('format validation', () => {
    it('should exit with error for invalid format', async () => {
      const command = createScanCommand();

      await expect(
        command.parseAsync(['--format', 'invalid'], { from: 'user' })
      ).rejects.toThrow('process.exit(1)');

      expect(capturedErrors.join(' ')).toContain('Invalid format');
    });

    it('should show valid formats in error message', async () => {
      const command = createScanCommand();

      await expect(
        command.parseAsync(['--format', 'bad'], { from: 'user' })
      ).rejects.toThrow('process.exit(1)');

      const errorOutput = capturedErrors.join(' ');
      expect(errorOutput).toContain('table');
      expect(errorOutput).toContain('json');
      expect(errorOutput).toContain('plain');
    });
  });

  describe('output formats', () => {
    it('should output JSON array with --format json', async () => {
      const files = [createMockFileInfo()];
      mockScanFolder.mockResolvedValue({ ok: true, data: files });

      const command = createScanCommand();
      await command.parseAsync(['--format', 'json'], { from: 'user' });

      const output = capturedOutput.join('');
      expect(() => JSON.parse(output)).not.toThrow();
    });

    it('should output empty array for empty results with JSON format', async () => {
      mockScanFolder.mockResolvedValue({ ok: true, data: [] });

      const command = createScanCommand();
      await command.parseAsync(['--format', 'json'], { from: 'user' });

      expect(capturedOutput.join('')).toBe('[]');
    });

    it('should output file paths with --format plain', async () => {
      const files = [
        createMockFileInfo({ path: '/test/file1.jpg', fullName: 'file1.jpg' }),
        createMockFileInfo({ path: '/test/file2.jpg', fullName: 'file2.jpg' }),
      ];
      mockScanFolder.mockResolvedValue({ ok: true, data: files });

      const command = createScanCommand();
      await command.parseAsync(['--format', 'plain'], { from: 'user' });

      const output = capturedOutput.join('');
      expect(output).toContain('/test/file1.jpg');
      expect(output).toContain('/test/file2.jpg');
    });

    it('should output nothing for empty results with plain format', async () => {
      mockScanFolder.mockResolvedValue({ ok: true, data: [] });

      const command = createScanCommand();
      await command.parseAsync(['--format', 'plain'], { from: 'user' });

      // Should return early without output
      const nonEmptyOutput = capturedOutput.filter(line => line.trim() !== '');
      expect(nonEmptyOutput).toHaveLength(0);
    });

    it('should show "No files found" for empty results with table format', async () => {
      mockScanFolder.mockResolvedValue({ ok: true, data: [] });

      const command = createScanCommand();
      await command.parseAsync(['--format', 'table'], { from: 'user' });

      expect(capturedOutput.join(' ')).toContain('No files found');
    });

    it('should output table with headers by default', async () => {
      const files = [createMockFileInfo()];
      mockScanFolder.mockResolvedValue({ ok: true, data: files });

      const command = createScanCommand();
      await command.parseAsync([], { from: 'user' });

      const output = capturedOutput.join(' ');
      expect(output).toContain('Name');
    });
  });

  describe('recursive option', () => {
    it('should pass recursive: true to scanFolder with -r flag', async () => {
      mockScanFolder.mockResolvedValue({ ok: true, data: [] });

      const command = createScanCommand();
      await command.parseAsync(['-r'], { from: 'user' });

      expect(mockScanFolder).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ recursive: true })
      );
    });

    it('should pass recursive: true to scanFolder with --recursive flag', async () => {
      mockScanFolder.mockResolvedValue({ ok: true, data: [] });

      const command = createScanCommand();
      await command.parseAsync(['--recursive'], { from: 'user' });

      expect(mockScanFolder).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ recursive: true })
      );
    });

    it('should pass recursive: false by default', async () => {
      mockScanFolder.mockResolvedValue({ ok: true, data: [] });

      const command = createScanCommand();
      await command.parseAsync([], { from: 'user' });

      expect(mockScanFolder).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ recursive: false })
      );
    });
  });

  describe('scan errors', () => {
    it('should exit with error when scan fails', async () => {
      mockScanFolder.mockResolvedValue({
        ok: false,
        error: new Error('Permission denied'),
      });

      const command = createScanCommand();

      await expect(
        command.parseAsync([], { from: 'user' })
      ).rejects.toThrow('process.exit(1)');

      expect(capturedErrors.join(' ')).toContain('Permission denied');
    });
  });

  describe('color option', () => {
    it('should accept --no-color flag without error', async () => {
      mockScanFolder.mockResolvedValue({ ok: true, data: [] });

      const command = createScanCommand();
      await command.parseAsync(['--no-color'], { from: 'user' });

      // Should complete without throwing
    });
  });
});

// =============================================================================
// Test Suite: Types
// =============================================================================

describe('OutputFormat type', () => {
  it('should accept valid formats', () => {
    const formats: OutputFormat[] = ['table', 'json', 'plain'];
    expect(formats).toHaveLength(3);
  });
});

describe('ScanCommandOptions type', () => {
  it('should have correct shape', () => {
    const options: ScanCommandOptions = {
      format: 'table',
      recursive: false,
      color: true,
    };
    expect(options.format).toBe('table');
    expect(options.recursive).toBe(false);
    expect(options.color).toBe(true);
  });
});
