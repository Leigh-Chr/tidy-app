/**
 * @fileoverview Tests for undo command - Story 9.3
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createUndoCommand } from './undo.js';
import type { UndoResult, UndoFileResult } from '@tidy/core';

// =============================================================================
// Test Fixtures
// =============================================================================

function createMockUndoResult(overrides: Partial<UndoResult> = {}): UndoResult {
  return {
    operationId: '550e8400-e29b-41d4-a716-446655440000',
    success: true,
    dryRun: false,
    filesRestored: 2,
    filesSkipped: 0,
    filesFailed: 0,
    directoriesRemoved: [],
    files: [
      {
        originalPath: '/test/file1.txt',
        currentPath: '/test/file1-renamed.txt',
        success: true,
        error: null,
        skipReason: null,
      },
      {
        originalPath: '/test/file2.txt',
        currentPath: '/test/file2-renamed.txt',
        success: true,
        error: null,
        skipReason: null,
      },
    ],
    durationMs: 150,
    ...overrides,
  };
}

function createMockFileResult(overrides: Partial<UndoFileResult> = {}): UndoFileResult {
  return {
    originalPath: '/test/original.txt',
    currentPath: '/test/current.txt',
    success: true,
    error: null,
    skipReason: null,
    ...overrides,
  };
}

// Mock console and process.exit
let mockConsoleLog: ReturnType<typeof vi.spyOn>;
let mockConsoleError: ReturnType<typeof vi.spyOn>;
let mockProcessExit: ReturnType<typeof vi.spyOn>;
let capturedOutput: string[] = [];
let capturedErrors: string[] = [];

// Mock undoOperation
const mockUndoOperation = vi.fn();

vi.mock('@tidy/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tidy/core')>();
  return {
    ...actual,
    undoOperation: (...args: Parameters<typeof actual.undoOperation>) =>
      mockUndoOperation(...args),
  };
});

// =============================================================================
// Test Suite: Command Creation
// =============================================================================

describe('createUndoCommand', () => {
  it('should create a command named "undo"', () => {
    const command = createUndoCommand();
    expect(command.name()).toBe('undo');
  });

  it('should have description', () => {
    const command = createUndoCommand();
    expect(command.description()).toContain('Undo');
  });

  it('should accept optional id argument', () => {
    const command = createUndoCommand();
    const args = command.registeredArguments;
    expect(args).toHaveLength(1);
    expect(args[0].name()).toBe('id');
    expect(args[0].required).toBe(false);
  });

  it('should have --dry-run option', () => {
    const command = createUndoCommand();
    const dryRunOption = command.options.find((o) => o.long === '--dry-run');
    expect(dryRunOption).toBeDefined();
    expect(dryRunOption?.defaultValue).toBe(false);
  });

  it('should have --format option with default table', () => {
    const command = createUndoCommand();
    const formatOption = command.options.find((o) => o.long === '--format');
    expect(formatOption).toBeDefined();
    expect(formatOption?.defaultValue).toBe('table');
  });

  it('should have --force option', () => {
    const command = createUndoCommand();
    const forceOption = command.options.find((o) => o.long === '--force');
    expect(forceOption).toBeDefined();
    expect(forceOption?.defaultValue).toBe(false);
  });

  it('should have --no-color option', () => {
    const command = createUndoCommand();
    const colorOption = command.options.find((o) => o.long === '--no-color');
    expect(colorOption).toBeDefined();
  });
});

// =============================================================================
// Test Suite: Command Execution
// =============================================================================

describe('undo command execution', () => {
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

  describe('undo most recent (AC2)', () => {
    it('should undo most recent operation when no ID provided', async () => {
      mockUndoOperation.mockResolvedValue({
        ok: true,
        data: createMockUndoResult(),
      });

      const command = createUndoCommand();
      await expect(command.parseAsync([], { from: 'user' })).rejects.toThrow(
        'process.exit(0)'
      );

      // Should call with null for most recent
      expect(mockUndoOperation).toHaveBeenCalledWith(null, expect.any(Object));
    });

    it('should display success message for completed undo', async () => {
      mockUndoOperation.mockResolvedValue({
        ok: true,
        data: createMockUndoResult({ success: true }),
      });

      const command = createUndoCommand();
      await expect(command.parseAsync([], { from: 'user' })).rejects.toThrow(
        'process.exit(0)'
      );

      const output = capturedOutput.join('');
      expect(output).toContain('Undo Completed');
    });

    it('should show number of restored files (AC1)', async () => {
      mockUndoOperation.mockResolvedValue({
        ok: true,
        data: createMockUndoResult({ filesRestored: 5 }),
      });

      const command = createUndoCommand();
      await expect(command.parseAsync([], { from: 'user' })).rejects.toThrow(
        'process.exit(0)'
      );

      const output = capturedOutput.join('');
      expect(output).toContain('5');
      expect(output).toContain('Restored');
    });
  });

  describe('undo specific operation (AC1)', () => {
    it('should undo specific operation when ID provided', async () => {
      const operationId = 'test-operation-id-123';
      mockUndoOperation.mockResolvedValue({
        ok: true,
        data: createMockUndoResult({ operationId }),
      });

      const command = createUndoCommand();
      await expect(
        command.parseAsync([operationId], { from: 'user' })
      ).rejects.toThrow('process.exit(0)');

      expect(mockUndoOperation).toHaveBeenCalledWith(
        operationId,
        expect.any(Object)
      );
    });
  });

  describe('dry-run preview (AC3)', () => {
    it('should pass dryRun option to undoOperation', async () => {
      mockUndoOperation.mockResolvedValue({
        ok: true,
        data: createMockUndoResult({ dryRun: true }),
      });

      const command = createUndoCommand();
      await expect(
        command.parseAsync(['--dry-run'], { from: 'user' })
      ).rejects.toThrow('process.exit(0)');

      expect(mockUndoOperation).toHaveBeenCalledWith(
        null,
        expect.objectContaining({ dryRun: true })
      );
    });

    it('should display preview format for dry-run', async () => {
      mockUndoOperation.mockResolvedValue({
        ok: true,
        data: createMockUndoResult({ dryRun: true }),
      });

      const command = createUndoCommand();
      await expect(
        command.parseAsync(['--dry-run'], { from: 'user' })
      ).rejects.toThrow('process.exit(0)');

      const output = capturedOutput.join('');
      expect(output).toContain('Preview');
    });

    it('should show proposed changes in dry-run (current → original paths)', async () => {
      mockUndoOperation.mockResolvedValue({
        ok: true,
        data: createMockUndoResult({
          dryRun: true,
          files: [
            createMockFileResult({
              originalPath: '/original/path.txt',
              currentPath: '/renamed/path.txt',
              success: true,
            }),
          ],
        }),
      });

      const command = createUndoCommand();
      await expect(
        command.parseAsync(['--dry-run'], { from: 'user' })
      ).rejects.toThrow('process.exit(0)');

      const output = capturedOutput.join('');
      expect(output).toContain('/renamed/path.txt');
      expect(output).toContain('/original/path.txt');
      expect(output).toContain('→');
    });
  });

  describe('partial undo (AC4)', () => {
    it('should report partial success with exit code 2', async () => {
      mockUndoOperation.mockResolvedValue({
        ok: true,
        data: createMockUndoResult({
          success: false,
          filesRestored: 2,
          filesFailed: 1,
        }),
      });

      const command = createUndoCommand();
      await expect(command.parseAsync([], { from: 'user' })).rejects.toThrow(
        'process.exit(2)'
      );
    });

    it('should show files that could not be restored with reasons', async () => {
      mockUndoOperation.mockResolvedValue({
        ok: true,
        data: createMockUndoResult({
          success: false,
          filesRestored: 1,
          filesFailed: 1,
          files: [
            createMockFileResult({ success: true }),
            createMockFileResult({
              success: false,
              error: 'File no longer exists',
            }),
          ],
        }),
      });

      const command = createUndoCommand();
      await expect(command.parseAsync([], { from: 'user' })).rejects.toThrow(
        'process.exit(2)'
      );

      const output = capturedOutput.join('');
      expect(output).toContain('File no longer exists');
    });

    it('should show partial header when some files failed', async () => {
      mockUndoOperation.mockResolvedValue({
        ok: true,
        data: createMockUndoResult({
          success: false,
          filesRestored: 1,
          filesFailed: 1,
        }),
      });

      const command = createUndoCommand();
      await expect(command.parseAsync([], { from: 'user' })).rejects.toThrow(
        'process.exit(2)'
      );

      const output = capturedOutput.join('');
      expect(output).toContain('Partially Completed');
    });
  });

  describe('invalid operation ID (AC5)', () => {
    it('should show error for non-existent operation ID', async () => {
      mockUndoOperation.mockResolvedValue({
        ok: false,
        error: new Error('Operation not found: invalid-id'),
      });

      const command = createUndoCommand();
      await expect(
        command.parseAsync(['invalid-id'], { from: 'user' })
      ).rejects.toThrow('process.exit(1)');

      expect(capturedErrors.join('')).toContain('Operation not found');
    });

    it('should exit with code 1 for invalid ID', async () => {
      mockUndoOperation.mockResolvedValue({
        ok: false,
        error: new Error('Operation not found: bad-id'),
      });

      const command = createUndoCommand();
      await expect(
        command.parseAsync(['bad-id'], { from: 'user' })
      ).rejects.toThrow('process.exit(1)');
    });
  });

  describe('prevent double undo (AC6)', () => {
    it('should show error when operation was already undone', async () => {
      mockUndoOperation.mockResolvedValue({
        ok: false,
        error: new Error('Operation already undone'),
      });

      const command = createUndoCommand();
      await expect(
        command.parseAsync(['already-undone-id'], { from: 'user' })
      ).rejects.toThrow('process.exit(1)');

      expect(capturedErrors.join('')).toContain('Operation already undone');
    });

    it('should exit with code 1 for already undone', async () => {
      mockUndoOperation.mockResolvedValue({
        ok: false,
        error: new Error('Operation already undone'),
      });

      const command = createUndoCommand();
      await expect(
        command.parseAsync(['already-undone-id'], { from: 'user' })
      ).rejects.toThrow('process.exit(1)');
    });
  });

  describe('directory cleanup (AC7)', () => {
    it('should report directories removed', async () => {
      mockUndoOperation.mockResolvedValue({
        ok: true,
        data: createMockUndoResult({
          directoriesRemoved: ['/test/dir1', '/test/dir2'],
        }),
      });

      const command = createUndoCommand();
      await expect(command.parseAsync([], { from: 'user' })).rejects.toThrow(
        'process.exit(0)'
      );

      const output = capturedOutput.join('');
      expect(output).toContain('/test/dir1');
      expect(output).toContain('/test/dir2');
      expect(output).toContain('Removed');
    });
  });

  describe('JSON output (AC8)', () => {
    it('should output valid JSON with --format json', async () => {
      mockUndoOperation.mockResolvedValue({
        ok: true,
        data: createMockUndoResult(),
      });

      const command = createUndoCommand();
      await expect(
        command.parseAsync(['--format', 'json'], { from: 'user' })
      ).rejects.toThrow('process.exit(0)');

      const output = capturedOutput.join('');
      expect(() => JSON.parse(output)).not.toThrow();
    });

    it('should include operationId in JSON', async () => {
      const operationId = 'json-op-id-456';
      mockUndoOperation.mockResolvedValue({
        ok: true,
        data: createMockUndoResult({ operationId }),
      });

      const command = createUndoCommand();
      await expect(
        command.parseAsync(['--format', 'json'], { from: 'user' })
      ).rejects.toThrow('process.exit(0)');

      const output = capturedOutput.join('');
      const parsed = JSON.parse(output);
      expect(parsed.operationId).toBe(operationId);
    });

    it('should include filesRestored in JSON', async () => {
      mockUndoOperation.mockResolvedValue({
        ok: true,
        data: createMockUndoResult({ filesRestored: 10 }),
      });

      const command = createUndoCommand();
      await expect(
        command.parseAsync(['--format', 'json'], { from: 'user' })
      ).rejects.toThrow('process.exit(0)');

      const output = capturedOutput.join('');
      const parsed = JSON.parse(output);
      expect(parsed.filesRestored).toBe(10);
    });

    it('should include filesSkipped in JSON', async () => {
      mockUndoOperation.mockResolvedValue({
        ok: true,
        data: createMockUndoResult({ filesSkipped: 3 }),
      });

      const command = createUndoCommand();
      await expect(
        command.parseAsync(['--format', 'json'], { from: 'user' })
      ).rejects.toThrow('process.exit(0)');

      const output = capturedOutput.join('');
      const parsed = JSON.parse(output);
      expect(parsed.filesSkipped).toBe(3);
    });

    it('should include directoriesRemoved in JSON', async () => {
      mockUndoOperation.mockResolvedValue({
        ok: true,
        data: createMockUndoResult({
          directoriesRemoved: ['/dir1', '/dir2'],
        }),
      });

      const command = createUndoCommand();
      await expect(
        command.parseAsync(['--format', 'json'], { from: 'user' })
      ).rejects.toThrow('process.exit(0)');

      const output = capturedOutput.join('');
      const parsed = JSON.parse(output);
      expect(parsed.directoriesRemoved).toEqual(['/dir1', '/dir2']);
    });
  });

  describe('plain output format', () => {
    it('should output operation ID on first line', async () => {
      const operationId = 'plain-op-id-789';
      mockUndoOperation.mockResolvedValue({
        ok: true,
        data: createMockUndoResult({ operationId }),
      });

      const command = createUndoCommand();
      await expect(
        command.parseAsync(['--format', 'plain'], { from: 'user' })
      ).rejects.toThrow('process.exit(0)');

      const output = capturedOutput.join('');
      const lines = output.split('\n');
      expect(lines[0]).toBe(operationId);
    });

    it('should output status on second line', async () => {
      mockUndoOperation.mockResolvedValue({
        ok: true,
        data: createMockUndoResult({ success: true }),
      });

      const command = createUndoCommand();
      await expect(
        command.parseAsync(['--format', 'plain'], { from: 'user' })
      ).rejects.toThrow('process.exit(0)');

      const output = capturedOutput.join('');
      const lines = output.split('\n');
      expect(lines[1]).toBe('success');
    });
  });

  describe('force option', () => {
    it('should pass force option to undoOperation', async () => {
      mockUndoOperation.mockResolvedValue({
        ok: true,
        data: createMockUndoResult(),
      });

      const command = createUndoCommand();
      await expect(
        command.parseAsync(['--force'], { from: 'user' })
      ).rejects.toThrow('process.exit(0)');

      expect(mockUndoOperation).toHaveBeenCalledWith(
        null,
        expect.objectContaining({ force: true })
      );
    });
  });

  describe('exit codes', () => {
    it('should exit with 0 on complete success', async () => {
      mockUndoOperation.mockResolvedValue({
        ok: true,
        data: createMockUndoResult({ success: true }),
      });

      const command = createUndoCommand();
      await expect(command.parseAsync([], { from: 'user' })).rejects.toThrow(
        'process.exit(0)'
      );
    });

    it('should exit with 0 on dry-run', async () => {
      mockUndoOperation.mockResolvedValue({
        ok: true,
        data: createMockUndoResult({ dryRun: true }),
      });

      const command = createUndoCommand();
      await expect(
        command.parseAsync(['--dry-run'], { from: 'user' })
      ).rejects.toThrow('process.exit(0)');
    });

    it('should exit with 2 on partial success', async () => {
      mockUndoOperation.mockResolvedValue({
        ok: true,
        data: createMockUndoResult({
          success: false,
          filesRestored: 1,
          filesFailed: 1,
        }),
      });

      const command = createUndoCommand();
      await expect(command.parseAsync([], { from: 'user' })).rejects.toThrow(
        'process.exit(2)'
      );
    });

    it('should exit with 1 when all files failed', async () => {
      mockUndoOperation.mockResolvedValue({
        ok: true,
        data: createMockUndoResult({
          success: false,
          filesRestored: 0,
          filesFailed: 2,
        }),
      });

      const command = createUndoCommand();
      await expect(command.parseAsync([], { from: 'user' })).rejects.toThrow(
        'process.exit(1)'
      );
    });

    it('should exit with 1 on error', async () => {
      mockUndoOperation.mockResolvedValue({
        ok: false,
        error: new Error('Some error'),
      });

      const command = createUndoCommand();
      await expect(command.parseAsync([], { from: 'user' })).rejects.toThrow(
        'process.exit(1)'
      );
    });
  });

  describe('format validation', () => {
    it('should exit with error for invalid format', async () => {
      const command = createUndoCommand();
      await expect(
        command.parseAsync(['--format', 'invalid'], { from: 'user' })
      ).rejects.toThrow('process.exit(1)');

      expect(capturedErrors.join('')).toContain('Invalid format');
    });
  });

  describe('no history', () => {
    it('should show error when no operations in history', async () => {
      mockUndoOperation.mockResolvedValue({
        ok: false,
        error: new Error('No operations in history to undo'),
      });

      const command = createUndoCommand();
      await expect(command.parseAsync([], { from: 'user' })).rejects.toThrow(
        'process.exit(1)'
      );

      expect(capturedErrors.join('')).toContain('No operations in history');
    });
  });
});
