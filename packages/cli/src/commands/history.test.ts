/**
 * @fileoverview Tests for history command - Story 9.2
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHistoryCommand } from './history.js';
import type { OperationHistoryEntry } from '@tidy/core';

// =============================================================================
// Test Fixtures
// =============================================================================

function createMockEntry(overrides: Partial<OperationHistoryEntry> = {}): OperationHistoryEntry {
  return {
    id: '550e8400-e29b-41d4-a716-446655440000',
    timestamp: '2026-01-10T12:30:00.000Z',
    operationType: 'rename',
    fileCount: 5,
    summary: {
      succeeded: 4,
      skipped: 0,
      failed: 1,
      directoriesCreated: 0,
    },
    durationMs: 150,
    files: [
      {
        originalPath: '/test/file1.txt',
        newPath: '/test/file1-renamed.txt',
        isMoveOperation: false,
        success: true,
        error: null,
      },
    ],
    directoriesCreated: [],
    ...overrides,
  };
}

// Mock console and process.exit
let mockConsoleLog: ReturnType<typeof vi.spyOn>;
let mockConsoleError: ReturnType<typeof vi.spyOn>;
let mockProcessExit: ReturnType<typeof vi.spyOn>;
let capturedOutput: string[] = [];
let capturedErrors: string[] = [];

// Mock getHistory and getHistoryEntry
const mockGetHistory = vi.fn();
const mockGetHistoryEntry = vi.fn();

vi.mock('@tidy/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tidy/core')>();
  return {
    ...actual,
    getHistory: (...args: Parameters<typeof actual.getHistory>) => mockGetHistory(...args),
    getHistoryEntry: (...args: Parameters<typeof actual.getHistoryEntry>) => mockGetHistoryEntry(...args),
  };
});

// =============================================================================
// Test Suite: Command Creation
// =============================================================================

describe('createHistoryCommand', () => {
  it('should create a command named "history"', () => {
    const command = createHistoryCommand();
    expect(command.name()).toBe('history');
  });

  it('should have description', () => {
    const command = createHistoryCommand();
    expect(command.description()).toContain('history');
  });

  it('should accept optional id argument', () => {
    const command = createHistoryCommand();
    const args = command.registeredArguments;
    expect(args).toHaveLength(1);
    expect(args[0].name()).toBe('id');
    expect(args[0].required).toBe(false);
  });

  it('should have --limit option', () => {
    const command = createHistoryCommand();
    const limitOption = command.options.find((o) => o.long === '--limit');
    expect(limitOption).toBeDefined();
    expect(limitOption?.defaultValue).toBe('10');
  });

  it('should have --format option with default table', () => {
    const command = createHistoryCommand();
    const formatOption = command.options.find((o) => o.long === '--format');
    expect(formatOption).toBeDefined();
    expect(formatOption?.defaultValue).toBe('table');
  });

  it('should have --type option', () => {
    const command = createHistoryCommand();
    const typeOption = command.options.find((o) => o.long === '--type');
    expect(typeOption).toBeDefined();
  });

  it('should have --no-color option', () => {
    const command = createHistoryCommand();
    const colorOption = command.options.find((o) => o.long === '--no-color');
    expect(colorOption).toBeDefined();
  });
});

// =============================================================================
// Test Suite: Command Execution
// =============================================================================

describe('history command execution', () => {
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

  describe('list mode (no id)', () => {
    it('should display empty history message (AC2)', async () => {
      mockGetHistory.mockResolvedValue({ ok: true, data: [] });

      const command = createHistoryCommand();
      await command.parseAsync([], { from: 'user' });

      expect(capturedOutput.join('')).toContain('No operation history found');
    });

    it('should display entries in table format (AC7)', async () => {
      const entries = [createMockEntry()];
      mockGetHistory.mockResolvedValue({ ok: true, data: entries });

      const command = createHistoryCommand();
      await command.parseAsync([], { from: 'user' });

      const output = capturedOutput.join('');
      expect(output).toContain('Date');
      expect(output).toContain('Type');
      expect(output).toContain('Files');
      expect(output).toContain('rename');
    });

    it('should display entries in newest-first order (AC1)', async () => {
      // Entries are stored newest-first by the recorder (unshift)
      // This test verifies the CLI preserves that order
      const entries = [
        createMockEntry({ id: 'newest-entry', timestamp: '2026-01-10T14:00:00.000Z' }),
        createMockEntry({ id: 'middle-entry', timestamp: '2026-01-10T12:00:00.000Z' }),
        createMockEntry({ id: 'oldest-entry', timestamp: '2026-01-10T10:00:00.000Z' }),
      ];
      mockGetHistory.mockResolvedValue({ ok: true, data: entries });

      const command = createHistoryCommand();
      await command.parseAsync(['--format', 'plain'], { from: 'user' });

      const output = capturedOutput.join('');
      const lines = output.trim().split('\n');

      // Verify order is preserved (newest first)
      expect(lines[0]).toBe('newest-entry');
      expect(lines[1]).toBe('middle-entry');
      expect(lines[2]).toBe('oldest-entry');
    });

    it('should output valid JSON with --format json (AC6)', async () => {
      const entries = [createMockEntry()];
      mockGetHistory.mockResolvedValue({ ok: true, data: entries });

      const command = createHistoryCommand();
      await command.parseAsync(['--format', 'json'], { from: 'user' });

      const output = capturedOutput.join('');
      expect(() => JSON.parse(output)).not.toThrow();
      const parsed = JSON.parse(output);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].id).toBe(entries[0].id);
    });

    it('should output IDs with --format plain', async () => {
      const entries = [
        createMockEntry({ id: 'id-1' }),
        createMockEntry({ id: 'id-2' }),
      ];
      mockGetHistory.mockResolvedValue({ ok: true, data: entries });

      const command = createHistoryCommand();
      await command.parseAsync(['--format', 'plain'], { from: 'user' });

      const output = capturedOutput.join('');
      expect(output).toContain('id-1');
      expect(output).toContain('id-2');
    });

    it('should respect --limit option (AC3)', async () => {
      mockGetHistory.mockResolvedValue({ ok: true, data: [] });

      const command = createHistoryCommand();
      await command.parseAsync(['--limit', '5'], { from: 'user' });

      expect(mockGetHistory).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 5 })
      );
    });

    it('should default limit to 10 (AC3)', async () => {
      mockGetHistory.mockResolvedValue({ ok: true, data: [] });

      const command = createHistoryCommand();
      await command.parseAsync([], { from: 'user' });

      expect(mockGetHistory).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 10 })
      );
    });

    it('should treat --limit 0 as no limit (return all entries)', async () => {
      const entries = [
        createMockEntry({ id: 'entry-1' }),
        createMockEntry({ id: 'entry-2' }),
        createMockEntry({ id: 'entry-3' }),
      ];
      mockGetHistory.mockResolvedValue({ ok: true, data: entries });

      const command = createHistoryCommand();
      await command.parseAsync(['--limit', '0'], { from: 'user' });

      // When limit is 0, it should NOT be passed to getHistory (meaning no limit)
      expect(mockGetHistory).toHaveBeenCalledWith(
        expect.not.objectContaining({ limit: expect.any(Number) })
      );
    });

    it('should filter by type with --type option (AC8)', async () => {
      mockGetHistory.mockResolvedValue({ ok: true, data: [] });

      const command = createHistoryCommand();
      await command.parseAsync(['--type', 'rename'], { from: 'user' });

      expect(mockGetHistory).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'rename' })
      );
    });

    it('should handle move type filter (AC8)', async () => {
      mockGetHistory.mockResolvedValue({ ok: true, data: [] });

      const command = createHistoryCommand();
      await command.parseAsync(['--type', 'move'], { from: 'user' });

      expect(mockGetHistory).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'move' })
      );
    });

    it('should handle organize type filter (AC8)', async () => {
      mockGetHistory.mockResolvedValue({ ok: true, data: [] });

      const command = createHistoryCommand();
      await command.parseAsync(['--type', 'organize'], { from: 'user' });

      expect(mockGetHistory).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'organize' })
      );
    });

    it('should exit with error for invalid format', async () => {
      const command = createHistoryCommand();

      await expect(
        command.parseAsync(['--format', 'invalid'], { from: 'user' })
      ).rejects.toThrow('process.exit(1)');

      expect(capturedErrors.join('')).toContain('Invalid format');
    });

    it('should exit with error for invalid type', async () => {
      const command = createHistoryCommand();

      await expect(
        command.parseAsync(['--type', 'invalid'], { from: 'user' })
      ).rejects.toThrow('process.exit(1)');

      expect(capturedErrors.join('')).toContain('Invalid type');
    });

    it('should exit with error for invalid limit', async () => {
      const command = createHistoryCommand();

      await expect(
        command.parseAsync(['--limit', 'abc'], { from: 'user' })
      ).rejects.toThrow('process.exit(1)');

      expect(capturedErrors.join('')).toContain('Invalid limit');
    });

    it('should output empty JSON array when no history with --format json', async () => {
      mockGetHistory.mockResolvedValue({ ok: true, data: [] });

      const command = createHistoryCommand();
      await command.parseAsync(['--format', 'json'], { from: 'user' });

      expect(capturedOutput.join('')).toBe('[]');
    });

    it('should handle storage error', async () => {
      mockGetHistory.mockResolvedValue({
        ok: false,
        error: new Error('Storage error'),
      });

      const command = createHistoryCommand();

      await expect(
        command.parseAsync([], { from: 'user' })
      ).rejects.toThrow('process.exit(1)');

      expect(capturedErrors.join('')).toContain('Storage error');
    });
  });

  describe('detail mode (with id)', () => {
    it('should display entry details (AC4)', async () => {
      const entry = createMockEntry({ id: 'test-entry-id' });
      mockGetHistoryEntry.mockResolvedValue({ ok: true, data: entry });

      const command = createHistoryCommand();
      await command.parseAsync(['test-entry-id'], { from: 'user' });

      const output = capturedOutput.join('');
      expect(output).toContain('test-entry-id');
      expect(output).toContain('rename');
      expect(output).toContain('Results');
    });

    it('should show error for non-existent entry (AC5)', async () => {
      mockGetHistoryEntry.mockResolvedValue({ ok: true, data: null });

      const command = createHistoryCommand();

      await expect(
        command.parseAsync(['non-existent-id'], { from: 'user' })
      ).rejects.toThrow('process.exit(1)');

      expect(capturedErrors.join('')).toContain('History entry not found');
      expect(capturedErrors.join('')).toContain('non-existent-id');
    });

    it('should handle storage error in detail mode', async () => {
      mockGetHistoryEntry.mockResolvedValue({
        ok: false,
        error: new Error('Read error'),
      });

      const command = createHistoryCommand();

      await expect(
        command.parseAsync(['some-id'], { from: 'user' })
      ).rejects.toThrow('process.exit(1)');

      expect(capturedErrors.join('')).toContain('Read error');
    });

    it('should show file details in entry detail', async () => {
      const entry = createMockEntry({
        files: [
          {
            originalPath: '/test/original.txt',
            newPath: '/test/renamed.txt',
            isMoveOperation: false,
            success: true,
            error: null,
          },
        ],
      });
      mockGetHistoryEntry.mockResolvedValue({ ok: true, data: entry });

      const command = createHistoryCommand();
      await command.parseAsync([entry.id], { from: 'user' });

      const output = capturedOutput.join('');
      expect(output).toContain('/test/original.txt');
      expect(output).toContain('/test/renamed.txt');
    });
  });
});
