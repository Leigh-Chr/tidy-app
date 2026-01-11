/**
 * @fileoverview Tests for restore result types - Story 9.4
 */

import { describe, it, expect } from 'vitest';
import {
  fileOperationEntrySchema,
  fileHistoryLookupSchema,
  restoreResultSchema,
  restoreOptionsSchema,
  createSuccessRestoreResult,
  createFailedRestoreResult,
  createMessageRestoreResult,
  createEmptyFileHistoryLookup,
  type FileOperationEntry,
  type FileHistoryLookup,
  type RestoreResult,
  type RestoreOptions,
} from './restore-result.js';

// =============================================================================
// Test Suite: FileOperationEntry Schema
// =============================================================================

describe('fileOperationEntrySchema', () => {
  const validUUID = '550e8400-e29b-41d4-a716-446655440000';

  it('should validate a complete operation entry', () => {
    const entry: FileOperationEntry = {
      operationId: validUUID,
      timestamp: '2026-01-11T10:00:00.000Z',
      operationType: 'rename',
      originalPath: '/test/original.txt',
      newPath: '/test/renamed.txt',
    };

    expect(() => fileOperationEntrySchema.parse(entry)).not.toThrow();
    expect(fileOperationEntrySchema.parse(entry)).toEqual(entry);
  });

  it('should allow null newPath', () => {
    const entry: FileOperationEntry = {
      operationId: validUUID,
      timestamp: '2026-01-11T10:00:00.000Z',
      operationType: 'move',
      originalPath: '/test/original.txt',
      newPath: null,
    };

    const parsed = fileOperationEntrySchema.parse(entry);
    expect(parsed.newPath).toBeNull();
  });

  it('should reject invalid UUID', () => {
    const entry = {
      operationId: 'not-a-uuid',
      timestamp: '2026-01-11T10:00:00.000Z',
      operationType: 'rename',
      originalPath: '/test/original.txt',
      newPath: '/test/renamed.txt',
    };

    expect(() => fileOperationEntrySchema.parse(entry)).toThrow();
  });
});

// =============================================================================
// Test Suite: FileHistoryLookup Schema
// =============================================================================

describe('fileHistoryLookupSchema', () => {
  const validUUID = '550e8400-e29b-41d4-a716-446655440000';

  it('should validate a found file history', () => {
    const lookup: FileHistoryLookup = {
      searchedPath: '/test/renamed.txt',
      found: true,
      originalPath: '/test/original.txt',
      currentPath: '/test/renamed.txt',
      lastOperationId: validUUID,
      lastModified: '2026-01-11T10:00:00.000Z',
      isAtOriginal: false,
      operations: [
        {
          operationId: validUUID,
          timestamp: '2026-01-11T10:00:00.000Z',
          operationType: 'rename',
          originalPath: '/test/original.txt',
          newPath: '/test/renamed.txt',
        },
      ],
    };

    expect(() => fileHistoryLookupSchema.parse(lookup)).not.toThrow();
    expect(fileHistoryLookupSchema.parse(lookup)).toEqual(lookup);
  });

  it('should validate not found file history', () => {
    const lookup: FileHistoryLookup = {
      searchedPath: '/test/unknown.txt',
      found: false,
      originalPath: null,
      currentPath: null,
      lastOperationId: null,
      lastModified: null,
      isAtOriginal: false,
      operations: [],
    };

    expect(() => fileHistoryLookupSchema.parse(lookup)).not.toThrow();
  });

  it('should validate file at original location', () => {
    const lookup: FileHistoryLookup = {
      searchedPath: '/test/original.txt',
      found: true,
      originalPath: '/test/original.txt',
      currentPath: '/test/original.txt',
      lastOperationId: validUUID,
      lastModified: '2026-01-11T10:00:00.000Z',
      isAtOriginal: true,
      operations: [],
    };

    expect(() => fileHistoryLookupSchema.parse(lookup)).not.toThrow();
    expect(fileHistoryLookupSchema.parse(lookup).isAtOriginal).toBe(true);
  });

  it('should validate with multiple operations', () => {
    const lookup: FileHistoryLookup = {
      searchedPath: '/test/final.txt',
      found: true,
      originalPath: '/test/original.txt',
      currentPath: '/test/final.txt',
      lastOperationId: validUUID,
      lastModified: '2026-01-11T12:00:00.000Z',
      isAtOriginal: false,
      operations: [
        {
          operationId: validUUID,
          timestamp: '2026-01-11T12:00:00.000Z',
          operationType: 'rename',
          originalPath: '/test/original.txt',
          newPath: '/test/final.txt',
        },
        {
          operationId: '660e8400-e29b-41d4-a716-446655440001',
          timestamp: '2026-01-11T10:00:00.000Z',
          operationType: 'move',
          originalPath: '/old/original.txt',
          newPath: '/test/original.txt',
        },
      ],
    };

    expect(() => fileHistoryLookupSchema.parse(lookup)).not.toThrow();
    expect(fileHistoryLookupSchema.parse(lookup).operations).toHaveLength(2);
  });
});

// =============================================================================
// Test Suite: RestoreResult Schema
// =============================================================================

describe('restoreResultSchema', () => {
  const validUUID = '550e8400-e29b-41d4-a716-446655440000';

  it('should validate a successful restore result', () => {
    const result: RestoreResult = {
      success: true,
      dryRun: false,
      searchedPath: '/test/renamed.txt',
      originalPath: '/test/original.txt',
      previousPath: '/test/renamed.txt',
      operationId: validUUID,
      error: null,
      message: null,
      durationMs: 150,
    };

    expect(() => restoreResultSchema.parse(result)).not.toThrow();
  });

  it('should validate a dry-run result', () => {
    const result: RestoreResult = {
      success: true,
      dryRun: true,
      searchedPath: '/test/renamed.txt',
      originalPath: '/test/original.txt',
      previousPath: '/test/renamed.txt',
      operationId: validUUID,
      error: null,
      message: null,
      durationMs: 50,
    };

    const parsed = restoreResultSchema.parse(result);
    expect(parsed.dryRun).toBe(true);
  });

  it('should validate a failed result', () => {
    const result: RestoreResult = {
      success: false,
      dryRun: false,
      searchedPath: '/test/unknown.txt',
      originalPath: null,
      previousPath: null,
      operationId: null,
      error: 'No history found for file: /test/unknown.txt',
      message: null,
      durationMs: 25,
    };

    expect(() => restoreResultSchema.parse(result)).not.toThrow();
  });

  it('should validate result with message', () => {
    const result: RestoreResult = {
      success: true,
      dryRun: false,
      searchedPath: '/test/original.txt',
      originalPath: '/test/original.txt',
      previousPath: '/test/original.txt',
      operationId: validUUID,
      error: null,
      message: 'File is already at original location',
      durationMs: 10,
    };

    expect(() => restoreResultSchema.parse(result)).not.toThrow();
    expect(restoreResultSchema.parse(result).message).toBe('File is already at original location');
  });

  it('should reject negative duration', () => {
    const result = {
      success: true,
      dryRun: false,
      searchedPath: '/test/file.txt',
      originalPath: '/test/file.txt',
      previousPath: '/test/file.txt',
      operationId: validUUID,
      error: null,
      message: null,
      durationMs: -100,
    };

    expect(() => restoreResultSchema.parse(result)).toThrow();
  });

  it('should reject non-integer duration', () => {
    const result = {
      success: true,
      dryRun: false,
      searchedPath: '/test/file.txt',
      originalPath: '/test/file.txt',
      previousPath: '/test/file.txt',
      operationId: validUUID,
      error: null,
      message: null,
      durationMs: 1.5,
    };

    expect(() => restoreResultSchema.parse(result)).toThrow();
  });
});

// =============================================================================
// Test Suite: RestoreOptions Schema
// =============================================================================

describe('restoreOptionsSchema', () => {
  const validUUID = '550e8400-e29b-41d4-a716-446655440000';

  it('should validate options with dryRun true', () => {
    const options: RestoreOptions = {
      dryRun: true,
      lookup: false,
    };

    expect(() => restoreOptionsSchema.parse(options)).not.toThrow();
  });

  it('should validate options with operationId', () => {
    const options: RestoreOptions = {
      operationId: validUUID,
    };

    expect(() => restoreOptionsSchema.parse(options)).not.toThrow();
  });

  it('should validate options with lookup true', () => {
    const options: RestoreOptions = {
      lookup: true,
    };

    expect(() => restoreOptionsSchema.parse(options)).not.toThrow();
  });

  it('should accept empty object (all fields optional)', () => {
    const parsed = restoreOptionsSchema.parse({});

    expect(parsed.dryRun).toBeUndefined();
    expect(parsed.operationId).toBeUndefined();
    expect(parsed.lookup).toBeUndefined();
  });

  it('should reject invalid operationId format', () => {
    expect(() => restoreOptionsSchema.parse({ operationId: 'not-a-uuid' })).toThrow();
  });
});

// =============================================================================
// Test Suite: Factory Functions
// =============================================================================

describe('createSuccessRestoreResult', () => {
  const validUUID = '550e8400-e29b-41d4-a716-446655440000';

  it('should create successful restore result', () => {
    const result = createSuccessRestoreResult(
      '/test/renamed.txt',
      '/test/original.txt',
      '/test/renamed.txt',
      validUUID,
      150
    );

    expect(result.success).toBe(true);
    expect(result.dryRun).toBe(false);
    expect(result.searchedPath).toBe('/test/renamed.txt');
    expect(result.originalPath).toBe('/test/original.txt');
    expect(result.previousPath).toBe('/test/renamed.txt');
    expect(result.operationId).toBe(validUUID);
    expect(result.error).toBeNull();
    expect(result.message).toBeNull();
    expect(result.durationMs).toBe(150);
  });

  it('should pass schema validation', () => {
    const result = createSuccessRestoreResult(
      '/test/renamed.txt',
      '/test/original.txt',
      '/test/renamed.txt',
      validUUID,
      150
    );

    expect(() => restoreResultSchema.parse(result)).not.toThrow();
  });

  it('should allow null operationId', () => {
    const result = createSuccessRestoreResult(
      '/test/renamed.txt',
      '/test/original.txt',
      '/test/renamed.txt',
      null,
      150
    );

    expect(result.operationId).toBeNull();
    expect(() => restoreResultSchema.parse(result)).not.toThrow();
  });
});

describe('createFailedRestoreResult', () => {
  it('should create failed restore result', () => {
    const result = createFailedRestoreResult(
      '/test/unknown.txt',
      'No history found for file: /test/unknown.txt',
      25
    );

    expect(result.success).toBe(false);
    expect(result.dryRun).toBe(false);
    expect(result.searchedPath).toBe('/test/unknown.txt');
    expect(result.error).toBe('No history found for file: /test/unknown.txt');
    expect(result.originalPath).toBeNull();
    expect(result.previousPath).toBeNull();
    expect(result.operationId).toBeNull();
  });

  it('should include optional paths when provided', () => {
    const validUUID = '550e8400-e29b-41d4-a716-446655440000';
    const result = createFailedRestoreResult(
      '/test/renamed.txt',
      'File no longer exists at expected location',
      50,
      '/test/original.txt',
      '/test/renamed.txt',
      validUUID
    );

    expect(result.originalPath).toBe('/test/original.txt');
    expect(result.previousPath).toBe('/test/renamed.txt');
    expect(result.operationId).toBe(validUUID);
  });

  it('should pass schema validation', () => {
    const result = createFailedRestoreResult('/test/file.txt', 'Error', 10);

    expect(() => restoreResultSchema.parse(result)).not.toThrow();
  });
});

describe('createMessageRestoreResult', () => {
  const validUUID = '550e8400-e29b-41d4-a716-446655440000';

  it('should create result with message', () => {
    const result = createMessageRestoreResult(
      '/test/original.txt',
      'File is already at original location',
      10,
      '/test/original.txt',
      validUUID
    );

    expect(result.success).toBe(true);
    expect(result.message).toBe('File is already at original location');
    expect(result.error).toBeNull();
    expect(result.originalPath).toBe('/test/original.txt');
    expect(result.previousPath).toBe('/test/original.txt');
  });

  it('should pass schema validation', () => {
    const result = createMessageRestoreResult(
      '/test/file.txt',
      'Info message',
      5
    );

    expect(() => restoreResultSchema.parse(result)).not.toThrow();
  });
});

describe('createEmptyFileHistoryLookup', () => {
  it('should create empty lookup for not found file', () => {
    const lookup = createEmptyFileHistoryLookup('/test/unknown.txt');

    expect(lookup.searchedPath).toBe('/test/unknown.txt');
    expect(lookup.found).toBe(false);
    expect(lookup.originalPath).toBeNull();
    expect(lookup.currentPath).toBeNull();
    expect(lookup.lastOperationId).toBeNull();
    expect(lookup.lastModified).toBeNull();
    expect(lookup.isAtOriginal).toBe(false);
    expect(lookup.operations).toEqual([]);
  });

  it('should pass schema validation', () => {
    const lookup = createEmptyFileHistoryLookup('/test/file.txt');

    expect(() => fileHistoryLookupSchema.parse(lookup)).not.toThrow();
  });
});
