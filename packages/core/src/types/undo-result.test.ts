/**
 * @fileoverview Tests for undo result types - Story 9.3
 */

import { describe, it, expect } from 'vitest';
import {
  undoFileResultSchema,
  undoResultSchema,
  undoOptionsSchema,
  createEmptyUndoResult,
  createSuccessFileResult,
  createFailedFileResult,
  createSkippedFileResult,
  type UndoFileResult,
  type UndoResult,
  type UndoOptions,
} from './undo-result.js';

// =============================================================================
// Test Suite: UndoFileResult Schema
// =============================================================================

describe('undoFileResultSchema', () => {
  it('should validate a successful file result', () => {
    const result: UndoFileResult = {
      originalPath: '/test/original.txt',
      currentPath: '/test/renamed.txt',
      success: true,
      error: null,
      skipReason: null,
    };

    expect(() => undoFileResultSchema.parse(result)).not.toThrow();
    expect(undoFileResultSchema.parse(result)).toEqual(result);
  });

  it('should validate a failed file result', () => {
    const result: UndoFileResult = {
      originalPath: '/test/original.txt',
      currentPath: '/test/renamed.txt',
      success: false,
      error: 'File no longer exists',
      skipReason: null,
    };

    expect(() => undoFileResultSchema.parse(result)).not.toThrow();
  });

  it('should validate a skipped file result', () => {
    const result: UndoFileResult = {
      originalPath: '/test/original.txt',
      currentPath: null,
      success: false,
      error: null,
      skipReason: 'Original operation failed',
    };

    expect(() => undoFileResultSchema.parse(result)).not.toThrow();
  });

  it('should allow null currentPath', () => {
    const result: UndoFileResult = {
      originalPath: '/test/original.txt',
      currentPath: null,
      success: false,
      error: 'File not found',
      skipReason: null,
    };

    const parsed = undoFileResultSchema.parse(result);
    expect(parsed.currentPath).toBeNull();
  });

  it('should reject missing required fields', () => {
    const invalidResult = {
      originalPath: '/test/original.txt',
      // Missing other fields
    };

    expect(() => undoFileResultSchema.parse(invalidResult)).toThrow();
  });

  it('should reject non-string originalPath', () => {
    const invalidResult = {
      originalPath: 123,
      currentPath: '/test/renamed.txt',
      success: true,
      error: null,
      skipReason: null,
    };

    expect(() => undoFileResultSchema.parse(invalidResult)).toThrow();
  });

  it('should reject non-boolean success', () => {
    const invalidResult = {
      originalPath: '/test/original.txt',
      currentPath: '/test/renamed.txt',
      success: 'yes',
      error: null,
      skipReason: null,
    };

    expect(() => undoFileResultSchema.parse(invalidResult)).toThrow();
  });
});

// =============================================================================
// Test Suite: UndoResult Schema
// =============================================================================

describe('undoResultSchema', () => {
  const validUUID = '550e8400-e29b-41d4-a716-446655440000';

  it('should validate a successful undo result', () => {
    const result: UndoResult = {
      operationId: validUUID,
      success: true,
      dryRun: false,
      filesRestored: 5,
      filesSkipped: 0,
      filesFailed: 0,
      directoriesRemoved: [],
      files: [],
      durationMs: 150,
    };

    expect(() => undoResultSchema.parse(result)).not.toThrow();
  });

  it('should validate a dry-run result', () => {
    const result: UndoResult = {
      operationId: validUUID,
      success: true,
      dryRun: true,
      filesRestored: 0,
      filesSkipped: 0,
      filesFailed: 0,
      directoriesRemoved: [],
      files: [],
      durationMs: 50,
    };

    const parsed = undoResultSchema.parse(result);
    expect(parsed.dryRun).toBe(true);
  });

  it('should validate a partial success result', () => {
    const result: UndoResult = {
      operationId: validUUID,
      success: false,
      dryRun: false,
      filesRestored: 3,
      filesSkipped: 1,
      filesFailed: 2,
      directoriesRemoved: ['/test/new-dir'],
      files: [
        {
          originalPath: '/test/file1.txt',
          currentPath: '/test/renamed1.txt',
          success: true,
          error: null,
          skipReason: null,
        },
      ],
      durationMs: 200,
    };

    expect(() => undoResultSchema.parse(result)).not.toThrow();
  });

  it('should validate result with directories removed', () => {
    const result: UndoResult = {
      operationId: validUUID,
      success: true,
      dryRun: false,
      filesRestored: 2,
      filesSkipped: 0,
      filesFailed: 0,
      directoriesRemoved: ['/test/dir1', '/test/dir2'],
      files: [],
      durationMs: 100,
    };

    const parsed = undoResultSchema.parse(result);
    expect(parsed.directoriesRemoved).toHaveLength(2);
  });

  it('should reject invalid UUID', () => {
    const result = {
      operationId: 'not-a-uuid',
      success: true,
      dryRun: false,
      filesRestored: 0,
      filesSkipped: 0,
      filesFailed: 0,
      directoriesRemoved: [],
      files: [],
      durationMs: 0,
    };

    expect(() => undoResultSchema.parse(result)).toThrow();
  });

  it('should reject negative file counts', () => {
    const result = {
      operationId: validUUID,
      success: true,
      dryRun: false,
      filesRestored: -1,
      filesSkipped: 0,
      filesFailed: 0,
      directoriesRemoved: [],
      files: [],
      durationMs: 0,
    };

    expect(() => undoResultSchema.parse(result)).toThrow();
  });

  it('should reject non-integer file counts', () => {
    const result = {
      operationId: validUUID,
      success: true,
      dryRun: false,
      filesRestored: 1.5,
      filesSkipped: 0,
      filesFailed: 0,
      directoriesRemoved: [],
      files: [],
      durationMs: 0,
    };

    expect(() => undoResultSchema.parse(result)).toThrow();
  });

  it('should reject negative duration', () => {
    const result = {
      operationId: validUUID,
      success: true,
      dryRun: false,
      filesRestored: 0,
      filesSkipped: 0,
      filesFailed: 0,
      directoriesRemoved: [],
      files: [],
      durationMs: -100,
    };

    expect(() => undoResultSchema.parse(result)).toThrow();
  });
});

// =============================================================================
// Test Suite: UndoOptions Schema
// =============================================================================

describe('undoOptionsSchema', () => {
  it('should validate options with dryRun true', () => {
    const options: UndoOptions = {
      dryRun: true,
      force: false,
    };

    expect(() => undoOptionsSchema.parse(options)).not.toThrow();
  });

  it('should validate options with force true', () => {
    const options: UndoOptions = {
      dryRun: false,
      force: true,
    };

    expect(() => undoOptionsSchema.parse(options)).not.toThrow();
  });

  it('should accept empty object (all fields optional)', () => {
    const parsed = undoOptionsSchema.parse({});

    expect(parsed.dryRun).toBeUndefined();
    expect(parsed.force).toBeUndefined();
  });

  it('should accept partial options', () => {
    const parsed = undoOptionsSchema.parse({ dryRun: true });

    expect(parsed.dryRun).toBe(true);
    expect(parsed.force).toBeUndefined();
  });

  it('should reject non-boolean dryRun', () => {
    expect(() => undoOptionsSchema.parse({ dryRun: 'yes' })).toThrow();
  });
});

// =============================================================================
// Test Suite: Factory Functions
// =============================================================================

describe('createEmptyUndoResult', () => {
  const validUUID = '550e8400-e29b-41d4-a716-446655440000';

  it('should create empty result with operationId', () => {
    const result = createEmptyUndoResult(validUUID);

    expect(result.operationId).toBe(validUUID);
    expect(result.success).toBe(true);
    expect(result.dryRun).toBe(false);
    expect(result.filesRestored).toBe(0);
    expect(result.filesSkipped).toBe(0);
    expect(result.filesFailed).toBe(0);
    expect(result.directoriesRemoved).toEqual([]);
    expect(result.files).toEqual([]);
    expect(result.durationMs).toBe(0);
  });

  it('should create dry-run result when specified', () => {
    const result = createEmptyUndoResult(validUUID, true);

    expect(result.dryRun).toBe(true);
  });

  it('should pass schema validation', () => {
    const result = createEmptyUndoResult(validUUID);

    expect(() => undoResultSchema.parse(result)).not.toThrow();
  });
});

describe('createSuccessFileResult', () => {
  it('should create successful file result', () => {
    const result = createSuccessFileResult('/test/original.txt', '/test/renamed.txt');

    expect(result.originalPath).toBe('/test/original.txt');
    expect(result.currentPath).toBe('/test/renamed.txt');
    expect(result.success).toBe(true);
    expect(result.error).toBeNull();
    expect(result.skipReason).toBeNull();
  });

  it('should pass schema validation', () => {
    const result = createSuccessFileResult('/test/original.txt', '/test/renamed.txt');

    expect(() => undoFileResultSchema.parse(result)).not.toThrow();
  });
});

describe('createFailedFileResult', () => {
  it('should create failed file result with error', () => {
    const result = createFailedFileResult('/test/original.txt', '/test/renamed.txt', 'File not found');

    expect(result.originalPath).toBe('/test/original.txt');
    expect(result.currentPath).toBe('/test/renamed.txt');
    expect(result.success).toBe(false);
    expect(result.error).toBe('File not found');
    expect(result.skipReason).toBeNull();
  });

  it('should allow null currentPath', () => {
    const result = createFailedFileResult('/test/original.txt', null, 'Unknown location');

    expect(result.currentPath).toBeNull();
  });

  it('should pass schema validation', () => {
    const result = createFailedFileResult('/test/original.txt', null, 'Error');

    expect(() => undoFileResultSchema.parse(result)).not.toThrow();
  });
});

describe('createSkippedFileResult', () => {
  it('should create skipped file result', () => {
    const result = createSkippedFileResult('/test/original.txt', null, 'Original operation failed');

    expect(result.originalPath).toBe('/test/original.txt');
    expect(result.currentPath).toBeNull();
    expect(result.success).toBe(false);
    expect(result.error).toBeNull();
    expect(result.skipReason).toBe('Original operation failed');
  });

  it('should allow non-null currentPath', () => {
    const result = createSkippedFileResult('/test/original.txt', '/test/renamed.txt', 'Already at original');

    expect(result.currentPath).toBe('/test/renamed.txt');
  });

  it('should pass schema validation', () => {
    const result = createSkippedFileResult('/test/original.txt', null, 'Skipped');

    expect(() => undoFileResultSchema.parse(result)).not.toThrow();
  });
});
