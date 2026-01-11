/**
 * @fileoverview Tests for restore command - Story 9.4
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRestoreCommand } from './restore.js';
import type { RestoreResult, FileHistoryLookup } from '@tidy/core';

// =============================================================================
// Test Fixtures
// =============================================================================

function createMockRestoreResult(overrides: Partial<RestoreResult> = {}): RestoreResult {
  return {
    success: true,
    dryRun: false,
    searchedPath: '/test/renamed-file.txt',
    originalPath: '/test/original-file.txt',
    previousPath: '/test/renamed-file.txt',
    operationId: '550e8400-e29b-41d4-a716-446655440000',
    error: null,
    message: null,
    durationMs: 50,
    ...overrides,
  };
}

function createMockFileHistoryLookup(
  overrides: Partial<FileHistoryLookup> = {}
): FileHistoryLookup {
  return {
    searchedPath: '/test/file.txt',
    found: true,
    originalPath: '/test/original-name.txt',
    currentPath: '/test/renamed-name.txt',
    lastOperationId: '550e8400-e29b-41d4-a716-446655440000',
    lastModified: '2026-01-10T12:00:00.000Z',
    isAtOriginal: false,
    operations: [
      {
        operationId: '550e8400-e29b-41d4-a716-446655440000',
        timestamp: '2026-01-10T12:00:00.000Z',
        operationType: 'rename',
        originalPath: '/test/original-name.txt',
        newPath: '/test/renamed-name.txt',
      },
    ],
    ...overrides,
  };
}

// Mock console and process.exit
let mockConsoleLog: ReturnType<typeof vi.spyOn>;
let mockConsoleError: ReturnType<typeof vi.spyOn>;
let mockProcessExit: ReturnType<typeof vi.spyOn>;
let capturedOutput: string[] = [];
let capturedErrors: string[] = [];

// Mock functions
const mockRestoreFile = vi.fn();
const mockLookupFileHistory = vi.fn();

vi.mock('@tidy/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tidy/core')>();
  return {
    ...actual,
    restoreFile: (...args: Parameters<typeof actual.restoreFile>) =>
      mockRestoreFile(...args),
    lookupFileHistory: (...args: Parameters<typeof actual.lookupFileHistory>) =>
      mockLookupFileHistory(...args),
  };
});

// =============================================================================
// Test Suite: Command Creation
// =============================================================================

describe('createRestoreCommand', () => {
  it('should create a command named "restore"', () => {
    const command = createRestoreCommand();
    expect(command.name()).toBe('restore');
  });

  it('should have description', () => {
    const command = createRestoreCommand();
    expect(command.description()).toContain('Restore');
  });

  it('should require path argument', () => {
    const command = createRestoreCommand();
    const args = command.registeredArguments;
    expect(args).toHaveLength(1);
    expect(args[0].name()).toBe('path');
    expect(args[0].required).toBe(true);
  });

  it('should have --operation option', () => {
    const command = createRestoreCommand();
    const operationOption = command.options.find((o) => o.long === '--operation');
    expect(operationOption).toBeDefined();
  });

  it('should have --lookup option', () => {
    const command = createRestoreCommand();
    const lookupOption = command.options.find((o) => o.long === '--lookup');
    expect(lookupOption).toBeDefined();
    expect(lookupOption?.defaultValue).toBe(false);
  });

  it('should have --dry-run option', () => {
    const command = createRestoreCommand();
    const dryRunOption = command.options.find((o) => o.long === '--dry-run');
    expect(dryRunOption).toBeDefined();
    expect(dryRunOption?.defaultValue).toBe(false);
  });

  it('should have --format option with default table', () => {
    const command = createRestoreCommand();
    const formatOption = command.options.find((o) => o.long === '--format');
    expect(formatOption).toBeDefined();
    expect(formatOption?.defaultValue).toBe('table');
  });

  it('should have --no-color option', () => {
    const command = createRestoreCommand();
    const colorOption = command.options.find((o) => o.long === '--no-color');
    expect(colorOption).toBeDefined();
  });
});

// =============================================================================
// Test Suite: Command Execution
// =============================================================================

describe('restore command execution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedOutput = [];
    capturedErrors = [];

    mockConsoleLog = vi.spyOn(console, 'log').mockImplementation((msg) => {
      capturedOutput.push(String(msg));
    });

    mockConsoleError = vi.spyOn(console, 'error').mockImplementation((msg) => {
      capturedErrors.push(String(msg));
    });

    mockProcessExit = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit(${code})`);
    });

    // Mock TTY detection
    vi.stubGlobal('process', {
      ...process,
      stdout: { ...process.stdout, isTTY: true },
      exit: mockProcessExit,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe('restore file (AC1)', () => {
    it('should restore file to original name', async () => {
      mockRestoreFile.mockResolvedValue({
        ok: true,
        data: createMockRestoreResult(),
      });

      const command = createRestoreCommand();
      await expect(
        command.parseAsync(['/test/renamed.txt'], { from: 'user' })
      ).rejects.toThrow('process.exit(0)');

      expect(mockRestoreFile).toHaveBeenCalledWith(
        '/test/renamed.txt',
        expect.objectContaining({ dryRun: false })
      );
    });

    it('should display success message for completed restore', async () => {
      mockRestoreFile.mockResolvedValue({
        ok: true,
        data: createMockRestoreResult(),
      });

      const command = createRestoreCommand();
      await expect(
        command.parseAsync(['/test/renamed.txt'], { from: 'user' })
      ).rejects.toThrow('process.exit(0)');

      const output = capturedOutput.join('');
      expect(output).toContain('Restored');
    });

    it('should show original path in result', async () => {
      mockRestoreFile.mockResolvedValue({
        ok: true,
        data: createMockRestoreResult({
          originalPath: '/test/original.txt',
        }),
      });

      const command = createRestoreCommand();
      await expect(
        command.parseAsync(['/test/renamed.txt'], { from: 'user' })
      ).rejects.toThrow('process.exit(0)');

      const output = capturedOutput.join('');
      expect(output).toContain('/test/original.txt');
    });
  });

  describe('restore by operation ID (AC2)', () => {
    it('should pass operation ID to restoreFile', async () => {
      const operationId = 'test-operation-id-123';
      mockRestoreFile.mockResolvedValue({
        ok: true,
        data: createMockRestoreResult({ operationId }),
      });

      const command = createRestoreCommand();
      await expect(
        command.parseAsync(['dummy', '--operation', operationId], { from: 'user' })
      ).rejects.toThrow('process.exit(0)');

      expect(mockRestoreFile).toHaveBeenCalledWith(
        'dummy',
        expect.objectContaining({ operationId })
      );
    });
  });

  describe('lookup file history (AC3)', () => {
    it('should show file history with --lookup', async () => {
      mockLookupFileHistory.mockResolvedValue({
        ok: true,
        data: createMockFileHistoryLookup(),
      });

      const command = createRestoreCommand();
      await expect(
        command.parseAsync(['/test/file.txt', '--lookup'], { from: 'user' })
      ).rejects.toThrow('process.exit(0)');

      expect(mockLookupFileHistory).toHaveBeenCalledWith('/test/file.txt');
      const output = capturedOutput.join('');
      expect(output).toContain('History');
    });

    it('should display original and current paths in lookup', async () => {
      mockLookupFileHistory.mockResolvedValue({
        ok: true,
        data: createMockFileHistoryLookup({
          originalPath: '/test/original-name.txt',
          currentPath: '/test/current-name.txt',
        }),
      });

      const command = createRestoreCommand();
      await expect(
        command.parseAsync(['/test/file.txt', '--lookup'], { from: 'user' })
      ).rejects.toThrow('process.exit(0)');

      const output = capturedOutput.join('');
      expect(output).toContain('/test/original-name.txt');
      expect(output).toContain('/test/current-name.txt');
    });

    it('should show operations list in lookup', async () => {
      mockLookupFileHistory.mockResolvedValue({
        ok: true,
        data: createMockFileHistoryLookup({
          operations: [
            {
              operationId: 'op-1',
              timestamp: '2026-01-10T12:00:00.000Z',
              operationType: 'rename',
              originalPath: '/test/a.txt',
              newPath: '/test/b.txt',
            },
          ],
        }),
      });

      const command = createRestoreCommand();
      await expect(
        command.parseAsync(['/test/file.txt', '--lookup'], { from: 'user' })
      ).rejects.toThrow('process.exit(0)');

      const output = capturedOutput.join('');
      expect(output).toContain('rename');
    });
  });

  describe('restore preview / dry-run (AC4)', () => {
    it('should pass dryRun option to restoreFile', async () => {
      mockRestoreFile.mockResolvedValue({
        ok: true,
        data: createMockRestoreResult({ dryRun: true }),
      });

      const command = createRestoreCommand();
      await expect(
        command.parseAsync(['/test/file.txt', '--dry-run'], { from: 'user' })
      ).rejects.toThrow('process.exit(0)');

      expect(mockRestoreFile).toHaveBeenCalledWith(
        '/test/file.txt',
        expect.objectContaining({ dryRun: true })
      );
    });

    it('should display preview format for dry-run', async () => {
      mockRestoreFile.mockResolvedValue({
        ok: true,
        data: createMockRestoreResult({ dryRun: true }),
      });

      const command = createRestoreCommand();
      await expect(
        command.parseAsync(['/test/file.txt', '--dry-run'], { from: 'user' })
      ).rejects.toThrow('process.exit(0)');

      const output = capturedOutput.join('');
      expect(output).toContain('Preview');
    });

    it('should show proposed path change in dry-run', async () => {
      mockRestoreFile.mockResolvedValue({
        ok: true,
        data: createMockRestoreResult({
          dryRun: true,
          previousPath: '/test/current.txt',
          originalPath: '/test/original.txt',
        }),
      });

      const command = createRestoreCommand();
      await expect(
        command.parseAsync(['/test/current.txt', '--dry-run'], { from: 'user' })
      ).rejects.toThrow('process.exit(0)');

      const output = capturedOutput.join('');
      expect(output).toContain('/test/current.txt');
      expect(output).toContain('/test/original.txt');
      expect(output).toContain('→');
    });
  });

  describe('file not in history (AC5)', () => {
    it('should show error for file with no history', async () => {
      mockRestoreFile.mockResolvedValue({
        ok: true,
        data: createMockRestoreResult({
          success: false,
          error: 'No history found for file: /test/unknown.txt',
        }),
      });

      const command = createRestoreCommand();
      await expect(
        command.parseAsync(['/test/unknown.txt'], { from: 'user' })
      ).rejects.toThrow('process.exit(1)');

      const output = capturedOutput.join('');
      expect(output).toContain('No history found');
    });

    it('should exit with code 1 for file not in history', async () => {
      mockRestoreFile.mockResolvedValue({
        ok: true,
        data: createMockRestoreResult({
          success: false,
          error: 'No history found',
        }),
      });

      const command = createRestoreCommand();
      await expect(
        command.parseAsync(['/test/unknown.txt'], { from: 'user' })
      ).rejects.toThrow('process.exit(1)');
    });

    it('should show not-found in lookup mode', async () => {
      mockLookupFileHistory.mockResolvedValue({
        ok: true,
        data: null,
      });

      const command = createRestoreCommand();
      await expect(
        command.parseAsync(['/test/unknown.txt', '--lookup'], { from: 'user' })
      ).rejects.toThrow('process.exit(1)');

      // Note: "not found" goes to stdout (console.log), not stderr
      const output = capturedOutput.join('');
      expect(output).toContain('No history found');
    });
  });

  describe('file already at original name (AC6)', () => {
    it('should show message when file already at original location', async () => {
      mockRestoreFile.mockResolvedValue({
        ok: true,
        data: createMockRestoreResult({
          success: true,
          message: 'File is already at original location',
        }),
      });

      const command = createRestoreCommand();
      await expect(
        command.parseAsync(['/test/original.txt'], { from: 'user' })
      ).rejects.toThrow('process.exit(0)');

      const output = capturedOutput.join('');
      expect(output).toContain('already at original');
    });

    it('should exit with code 0 for already at original (not an error)', async () => {
      mockRestoreFile.mockResolvedValue({
        ok: true,
        data: createMockRestoreResult({
          success: true,
          message: 'File is already at original location',
        }),
      });

      const command = createRestoreCommand();
      await expect(
        command.parseAsync(['/test/original.txt'], { from: 'user' })
      ).rejects.toThrow('process.exit(0)');
    });
  });

  describe('handle missing files (AC7)', () => {
    it('should show error when file no longer exists', async () => {
      mockRestoreFile.mockResolvedValue({
        ok: true,
        data: createMockRestoreResult({
          success: false,
          error: 'File no longer exists at expected location',
        }),
      });

      const command = createRestoreCommand();
      await expect(
        command.parseAsync(['/test/missing.txt'], { from: 'user' })
      ).rejects.toThrow('process.exit(1)');

      const output = capturedOutput.join('');
      expect(output).toContain('no longer exists');
    });

    it('should exit with code 1 for missing file', async () => {
      mockRestoreFile.mockResolvedValue({
        ok: true,
        data: createMockRestoreResult({
          success: false,
          error: 'File no longer exists',
        }),
      });

      const command = createRestoreCommand();
      await expect(
        command.parseAsync(['/test/missing.txt'], { from: 'user' })
      ).rejects.toThrow('process.exit(1)');
    });
  });

  describe('JSON output (AC8)', () => {
    it('should output valid JSON with --format json', async () => {
      mockRestoreFile.mockResolvedValue({
        ok: true,
        data: createMockRestoreResult(),
      });

      const command = createRestoreCommand();
      await expect(
        command.parseAsync(['/test/file.txt', '--format', 'json'], { from: 'user' })
      ).rejects.toThrow('process.exit(0)');

      const output = capturedOutput.join('');
      expect(() => JSON.parse(output)).not.toThrow();
    });

    it('should include originalPath in JSON', async () => {
      mockRestoreFile.mockResolvedValue({
        ok: true,
        data: createMockRestoreResult({ originalPath: '/test/original.txt' }),
      });

      const command = createRestoreCommand();
      await expect(
        command.parseAsync(['/test/file.txt', '--format', 'json'], { from: 'user' })
      ).rejects.toThrow('process.exit(0)');

      const output = capturedOutput.join('');
      const parsed = JSON.parse(output);
      expect(parsed.originalPath).toBe('/test/original.txt');
    });

    it('should include previousPath in JSON', async () => {
      mockRestoreFile.mockResolvedValue({
        ok: true,
        data: createMockRestoreResult({ previousPath: '/test/renamed.txt' }),
      });

      const command = createRestoreCommand();
      await expect(
        command.parseAsync(['/test/file.txt', '--format', 'json'], { from: 'user' })
      ).rejects.toThrow('process.exit(0)');

      const output = capturedOutput.join('');
      const parsed = JSON.parse(output);
      expect(parsed.previousPath).toBe('/test/renamed.txt');
    });

    it('should include operationId in JSON', async () => {
      const operationId = 'json-op-id-456';
      mockRestoreFile.mockResolvedValue({
        ok: true,
        data: createMockRestoreResult({ operationId }),
      });

      const command = createRestoreCommand();
      await expect(
        command.parseAsync(['/test/file.txt', '--format', 'json'], { from: 'user' })
      ).rejects.toThrow('process.exit(0)');

      const output = capturedOutput.join('');
      const parsed = JSON.parse(output);
      expect(parsed.operationId).toBe(operationId);
    });

    it('should include success in JSON', async () => {
      mockRestoreFile.mockResolvedValue({
        ok: true,
        data: createMockRestoreResult({ success: true }),
      });

      const command = createRestoreCommand();
      await expect(
        command.parseAsync(['/test/file.txt', '--format', 'json'], { from: 'user' })
      ).rejects.toThrow('process.exit(0)');

      const output = capturedOutput.join('');
      const parsed = JSON.parse(output);
      expect(parsed.success).toBe(true);
    });

    it('should output valid JSON for lookup with --format json', async () => {
      mockLookupFileHistory.mockResolvedValue({
        ok: true,
        data: createMockFileHistoryLookup(),
      });

      const command = createRestoreCommand();
      await expect(
        command.parseAsync(['/test/file.txt', '--lookup', '--format', 'json'], {
          from: 'user',
        })
      ).rejects.toThrow('process.exit(0)');

      const output = capturedOutput.join('');
      expect(() => JSON.parse(output)).not.toThrow();
    });
  });

  describe('plain output format', () => {
    it('should output status on first line', async () => {
      mockRestoreFile.mockResolvedValue({
        ok: true,
        data: createMockRestoreResult({ success: true }),
      });

      const command = createRestoreCommand();
      await expect(
        command.parseAsync(['/test/file.txt', '--format', 'plain'], { from: 'user' })
      ).rejects.toThrow('process.exit(0)');

      const output = capturedOutput.join('');
      const lines = output.split('\n');
      expect(lines[0]).toBe('success');
    });

    it('should output original path', async () => {
      mockRestoreFile.mockResolvedValue({
        ok: true,
        data: createMockRestoreResult({ originalPath: '/test/original.txt' }),
      });

      const command = createRestoreCommand();
      await expect(
        command.parseAsync(['/test/file.txt', '--format', 'plain'], { from: 'user' })
      ).rejects.toThrow('process.exit(0)');

      const output = capturedOutput.join('');
      expect(output).toContain('original=/test/original.txt');
    });
  });

  describe('exit codes', () => {
    it('should exit with 0 on successful restore', async () => {
      mockRestoreFile.mockResolvedValue({
        ok: true,
        data: createMockRestoreResult({ success: true }),
      });

      const command = createRestoreCommand();
      await expect(
        command.parseAsync(['/test/file.txt'], { from: 'user' })
      ).rejects.toThrow('process.exit(0)');
    });

    it('should exit with 0 on successful dry-run', async () => {
      mockRestoreFile.mockResolvedValue({
        ok: true,
        data: createMockRestoreResult({ dryRun: true, success: true }),
      });

      const command = createRestoreCommand();
      await expect(
        command.parseAsync(['/test/file.txt', '--dry-run'], { from: 'user' })
      ).rejects.toThrow('process.exit(0)');
    });

    it('should exit with 1 on failed restore', async () => {
      mockRestoreFile.mockResolvedValue({
        ok: true,
        data: createMockRestoreResult({
          success: false,
          error: 'Restore failed',
        }),
      });

      const command = createRestoreCommand();
      await expect(
        command.parseAsync(['/test/file.txt'], { from: 'user' })
      ).rejects.toThrow('process.exit(1)');
    });

    it('should exit with 1 on error from restoreFile', async () => {
      mockRestoreFile.mockResolvedValue({
        ok: false,
        error: new Error('Some error'),
      });

      const command = createRestoreCommand();
      await expect(
        command.parseAsync(['/test/file.txt'], { from: 'user' })
      ).rejects.toThrow('process.exit(1)');
    });

    it('should exit with 1 when dry-run shows failure would occur', async () => {
      mockRestoreFile.mockResolvedValue({
        ok: true,
        data: createMockRestoreResult({
          dryRun: true,
          success: false,
          error: 'Would fail',
        }),
      });

      const command = createRestoreCommand();
      await expect(
        command.parseAsync(['/test/file.txt', '--dry-run'], { from: 'user' })
      ).rejects.toThrow('process.exit(1)');
    });
  });

  describe('format validation', () => {
    it('should exit with error for invalid format', async () => {
      const command = createRestoreCommand();
      await expect(
        command.parseAsync(['/test/file.txt', '--format', 'invalid'], { from: 'user' })
      ).rejects.toThrow('process.exit(1)');

      expect(capturedErrors.join('')).toContain('Invalid format');
    });
  });
});
