/**
 * @fileoverview Tests for undo formatters - Story 9.3
 */

import { describe, it, expect } from 'vitest';
import {
  formatUndoPreview,
  formatUndoResult,
  formatUndoJson,
  formatUndoPlain,
} from './undo-format.js';
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

// =============================================================================
// Test Suite: formatUndoPreview (AC3: Dry-Run Preview)
// =============================================================================

describe('formatUndoPreview', () => {
  it('should include preview header', () => {
    const result = createMockUndoResult({ dryRun: true });
    const output = formatUndoPreview(result, { color: false });

    expect(output).toContain('Undo Preview');
  });

  it('should include operation ID', () => {
    const result = createMockUndoResult({
      operationId: 'test-operation-id-123',
      dryRun: true,
    });
    const output = formatUndoPreview(result, { color: false });

    expect(output).toContain('Operation: test-operation-id-123');
  });

  it('should show proposed changes section', () => {
    const result = createMockUndoResult({ dryRun: true });
    const output = formatUndoPreview(result, { color: false });

    expect(output).toContain('Proposed Changes:');
  });

  it('should show file paths with arrows (current → original)', () => {
    const result = createMockUndoResult({
      dryRun: true,
      files: [
        createMockFileResult({
          originalPath: '/home/user/original.txt',
          currentPath: '/home/user/renamed.txt',
          success: true,
        }),
      ],
    });
    const output = formatUndoPreview(result, { color: false });

    expect(output).toContain('/home/user/renamed.txt → /home/user/original.txt');
  });

  it('should show checkmark for files that would succeed', () => {
    const result = createMockUndoResult({ dryRun: true });
    const output = formatUndoPreview(result, { color: false });

    expect(output).toContain('✓');
  });

  it('should show circle for files that would be skipped', () => {
    const result = createMockUndoResult({
      dryRun: true,
      filesSkipped: 1,
      filesRestored: 1,
      files: [
        createMockFileResult({ success: true }),
        createMockFileResult({
          success: false,
          skipReason: 'Original operation failed',
        }),
      ],
    });
    const output = formatUndoPreview(result, { color: false });

    expect(output).toContain('○');
    expect(output).toContain('Original operation failed');
  });

  it('should show cross for files that would fail', () => {
    const result = createMockUndoResult({
      dryRun: true,
      filesFailed: 1,
      filesRestored: 1,
      files: [
        createMockFileResult({ success: true }),
        createMockFileResult({
          success: false,
          error: 'File no longer exists',
        }),
      ],
    });
    const output = formatUndoPreview(result, { color: false });

    expect(output).toContain('✗');
    expect(output).toContain('File no longer exists');
  });

  it('should show summary with would-restore count', () => {
    const result = createMockUndoResult({
      dryRun: true,
      filesRestored: 5,
    });
    const output = formatUndoPreview(result, { color: false });

    expect(output).toContain('Would restore: 5 files');
  });

  it('should show summary with singular file when count is 1', () => {
    const result = createMockUndoResult({
      dryRun: true,
      filesRestored: 1,
      files: [createMockFileResult()],
    });
    const output = formatUndoPreview(result, { color: false });

    expect(output).toContain('Would restore: 1 file');
    expect(output).not.toContain('1 files');
  });

  it('should show directories that would be removed', () => {
    const result = createMockUndoResult({
      dryRun: true,
      directoriesRemoved: ['/test/dir1', '/test/dir2'],
    });
    const output = formatUndoPreview(result, { color: false });

    expect(output).toContain('Directories to remove:');
    expect(output).toContain('/test/dir1');
    expect(output).toContain('/test/dir2');
  });

  it('should not show directories section when none would be removed', () => {
    const result = createMockUndoResult({
      dryRun: true,
      directoriesRemoved: [],
    });
    const output = formatUndoPreview(result, { color: false });

    expect(output).not.toContain('Directories to remove:');
  });
});

// =============================================================================
// Test Suite: formatUndoResult (Post-Execution)
// =============================================================================

describe('formatUndoResult', () => {
  it('should show success header when all succeeded', () => {
    const result = createMockUndoResult({ success: true });
    const output = formatUndoResult(result, { color: false });

    expect(output).toContain('Undo Completed');
  });

  it('should show partial header when some failed', () => {
    const result = createMockUndoResult({
      success: false,
      filesFailed: 1,
    });
    const output = formatUndoResult(result, { color: false });

    expect(output).toContain('Undo Partially Completed');
  });

  it('should include operation ID', () => {
    const result = createMockUndoResult({
      operationId: 'result-op-id-456',
    });
    const output = formatUndoResult(result, { color: false });

    expect(output).toContain('Operation: result-op-id-456');
  });

  it('should include duration', () => {
    const result = createMockUndoResult({ durationMs: 250 });
    const output = formatUndoResult(result, { color: false });

    expect(output).toContain('Duration:  250ms');
  });

  it('should show files section with restoration paths', () => {
    const result = createMockUndoResult({
      files: [
        createMockFileResult({
          originalPath: '/restored/path.txt',
          currentPath: '/renamed/path.txt',
          success: true,
        }),
      ],
    });
    const output = formatUndoResult(result, { color: false });

    expect(output).toContain('Files:');
    expect(output).toContain('/renamed/path.txt → /restored/path.txt');
  });

  it('should show checkmark for restored files', () => {
    const result = createMockUndoResult();
    const output = formatUndoResult(result, { color: false });

    expect(output).toContain('✓');
  });

  it('should show circle for skipped files with reason', () => {
    const result = createMockUndoResult({
      filesSkipped: 1,
      files: [
        createMockFileResult({
          success: false,
          skipReason: 'Original operation failed',
        }),
      ],
    });
    const output = formatUndoResult(result, { color: false });

    expect(output).toContain('○');
    expect(output).toContain('Original operation failed');
  });

  it('should show cross for failed files with error', () => {
    const result = createMockUndoResult({
      filesFailed: 1,
      files: [
        createMockFileResult({
          success: false,
          error: 'Permission denied',
        }),
      ],
    });
    const output = formatUndoResult(result, { color: false });

    expect(output).toContain('✗');
    expect(output).toContain('Error: Permission denied');
  });

  it('should show directories removed section', () => {
    const result = createMockUndoResult({
      directoriesRemoved: ['/test/removed-dir'],
    });
    const output = formatUndoResult(result, { color: false });

    expect(output).toContain('Directories Removed:');
    expect(output).toContain('/test/removed-dir');
  });

  it('should show summary with restored count', () => {
    const result = createMockUndoResult({ filesRestored: 3 });
    const output = formatUndoResult(result, { color: false });

    expect(output).toContain('Restored: 3 files');
  });

  it('should show summary with skipped count when non-zero', () => {
    const result = createMockUndoResult({ filesSkipped: 2 });
    const output = formatUndoResult(result, { color: false });

    expect(output).toContain('Skipped:  2 files');
  });

  it('should show summary with failed count when non-zero', () => {
    const result = createMockUndoResult({ filesFailed: 1 });
    const output = formatUndoResult(result, { color: false });

    expect(output).toContain('Failed:   1 file');
  });

  it('should show directory count in summary', () => {
    const result = createMockUndoResult({
      directoriesRemoved: ['/a', '/b', '/c'],
    });
    const output = formatUndoResult(result, { color: false });

    expect(output).toContain('Dirs:     3 removed');
  });
});

// =============================================================================
// Test Suite: formatUndoJson (AC8: JSON Output)
// =============================================================================

describe('formatUndoJson', () => {
  it('should return valid JSON', () => {
    const result = createMockUndoResult();
    const output = formatUndoJson(result);

    expect(() => JSON.parse(output)).not.toThrow();
  });

  it('should include operationId', () => {
    const result = createMockUndoResult({
      operationId: 'json-op-id-789',
    });
    const output = formatUndoJson(result);
    const parsed = JSON.parse(output);

    expect(parsed.operationId).toBe('json-op-id-789');
  });

  it('should include filesRestored count', () => {
    const result = createMockUndoResult({ filesRestored: 10 });
    const output = formatUndoJson(result);
    const parsed = JSON.parse(output);

    expect(parsed.filesRestored).toBe(10);
  });

  it('should include filesSkipped count', () => {
    const result = createMockUndoResult({ filesSkipped: 3 });
    const output = formatUndoJson(result);
    const parsed = JSON.parse(output);

    expect(parsed.filesSkipped).toBe(3);
  });

  it('should include filesFailed count', () => {
    const result = createMockUndoResult({ filesFailed: 2 });
    const output = formatUndoJson(result);
    const parsed = JSON.parse(output);

    expect(parsed.filesFailed).toBe(2);
  });

  it('should include directoriesRemoved array', () => {
    const result = createMockUndoResult({
      directoriesRemoved: ['/dir1', '/dir2'],
    });
    const output = formatUndoJson(result);
    const parsed = JSON.parse(output);

    expect(parsed.directoriesRemoved).toEqual(['/dir1', '/dir2']);
  });

  it('should include success status', () => {
    const result = createMockUndoResult({ success: false });
    const output = formatUndoJson(result);
    const parsed = JSON.parse(output);

    expect(parsed.success).toBe(false);
  });

  it('should include dryRun status', () => {
    const result = createMockUndoResult({ dryRun: true });
    const output = formatUndoJson(result);
    const parsed = JSON.parse(output);

    expect(parsed.dryRun).toBe(true);
  });

  it('should include durationMs', () => {
    const result = createMockUndoResult({ durationMs: 500 });
    const output = formatUndoJson(result);
    const parsed = JSON.parse(output);

    expect(parsed.durationMs).toBe(500);
  });

  it('should include files array with details', () => {
    const result = createMockUndoResult({
      files: [
        createMockFileResult({
          originalPath: '/orig.txt',
          currentPath: '/curr.txt',
          success: true,
        }),
      ],
    });
    const output = formatUndoJson(result);
    const parsed = JSON.parse(output);

    expect(parsed.files).toHaveLength(1);
    expect(parsed.files[0].originalPath).toBe('/orig.txt');
    expect(parsed.files[0].currentPath).toBe('/curr.txt');
    expect(parsed.files[0].success).toBe(true);
  });

  it('should be pretty-printed with indentation', () => {
    const result = createMockUndoResult();
    const output = formatUndoJson(result);

    // Pretty-printed JSON has newlines
    expect(output.split('\n').length).toBeGreaterThan(1);
  });
});

// =============================================================================
// Test Suite: formatUndoPlain
// =============================================================================

describe('formatUndoPlain', () => {
  it('should include operation ID on first line', () => {
    const result = createMockUndoResult({
      operationId: 'plain-op-id-000',
    });
    const output = formatUndoPlain(result);
    const lines = output.split('\n');

    expect(lines[0]).toBe('plain-op-id-000');
  });

  it('should show success status on second line', () => {
    const result = createMockUndoResult({ success: true, dryRun: false });
    const output = formatUndoPlain(result);
    const lines = output.split('\n');

    expect(lines[1]).toBe('success');
  });

  it('should show partial status when not successful', () => {
    const result = createMockUndoResult({ success: false, dryRun: false });
    const output = formatUndoPlain(result);
    const lines = output.split('\n');

    expect(lines[1]).toBe('partial');
  });

  it('should show preview status for dry-run', () => {
    const result = createMockUndoResult({ dryRun: true });
    const output = formatUndoPlain(result);
    const lines = output.split('\n');

    expect(lines[1]).toBe('preview');
  });

  it('should show counts on third line', () => {
    const result = createMockUndoResult({
      filesRestored: 5,
      filesSkipped: 2,
      filesFailed: 1,
    });
    const output = formatUndoPlain(result);
    const lines = output.split('\n');

    expect(lines[2]).toBe('restored=5 skipped=2 failed=1');
  });

  it('should have exactly 3 lines', () => {
    const result = createMockUndoResult();
    const output = formatUndoPlain(result);
    const lines = output.split('\n');

    expect(lines).toHaveLength(3);
  });
});
