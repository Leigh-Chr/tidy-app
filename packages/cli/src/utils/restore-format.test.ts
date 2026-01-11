/**
 * @fileoverview Tests for restore output formatters - Story 9.4
 */

import { describe, it, expect } from 'vitest';
import {
  formatRestorePreview,
  formatRestoreResult,
  formatRestoreJson,
  formatRestorePlain,
  formatFileLookup,
  formatFileLookupJson,
} from './restore-format.js';
import type { RestoreResult, FileHistoryLookup } from '@tidy/core';

// =============================================================================
// Test Data
// =============================================================================

const validUUID = '550e8400-e29b-41d4-a716-446655440000';

function createMockRestoreResult(overrides: Partial<RestoreResult> = {}): RestoreResult {
  return {
    success: true,
    dryRun: false,
    searchedPath: '/test/renamed.txt',
    originalPath: '/test/original.txt',
    previousPath: '/test/renamed.txt',
    operationId: validUUID,
    error: null,
    message: null,
    durationMs: 42,
    ...overrides,
  };
}

function createMockLookup(overrides: Partial<FileHistoryLookup> = {}): FileHistoryLookup {
  return {
    searchedPath: '/test/renamed.txt',
    found: true,
    originalPath: '/test/original.txt',
    currentPath: '/test/renamed.txt',
    lastOperationId: validUUID,
    lastModified: '2026-01-11T10:00:00.000Z',
    isAtOriginal: false,
    operations: [{
      operationId: validUUID,
      timestamp: '2026-01-11T10:00:00.000Z',
      operationType: 'rename',
      originalPath: '/test/original.txt',
      newPath: '/test/renamed.txt',
    }],
    ...overrides,
  };
}

// =============================================================================
// Test Suite: formatRestorePreview
// =============================================================================

describe('formatRestorePreview', () => {
  it('should format successful preview with path change', () => {
    const result = createMockRestoreResult({ dryRun: true });
    const output = formatRestorePreview(result, { color: false });

    expect(output).toContain('Restore Preview');
    expect(output).toContain('✓');
    expect(output).toContain('/test/renamed.txt');
    expect(output).toContain('→');
    expect(output).toContain('/test/original.txt');
  });

  it('should format preview with message (already at original)', () => {
    const result = createMockRestoreResult({
      dryRun: true,
      message: 'File is already at original location',
    });
    const output = formatRestorePreview(result, { color: false });

    expect(output).toContain('ℹ');
    expect(output).toContain('already at original');
  });

  it('should format failed preview', () => {
    const result = createMockRestoreResult({
      success: false,
      dryRun: true,
      error: 'Original path is occupied',
    });
    const output = formatRestorePreview(result, { color: false });

    expect(output).toContain('✗');
    expect(output).toContain('occupied');
  });

  it('should include operation ID', () => {
    const result = createMockRestoreResult({ dryRun: true });
    const output = formatRestorePreview(result, { color: false });

    expect(output).toContain(`Operation: ${validUUID}`);
  });

  it('should show paths on failure', () => {
    const result = createMockRestoreResult({
      success: false,
      dryRun: true,
      error: 'File missing',
    });
    const output = formatRestorePreview(result, { color: false });

    expect(output).toContain('Current:');
    expect(output).toContain('Original:');
  });
});

// =============================================================================
// Test Suite: formatRestoreResult
// =============================================================================

describe('formatRestoreResult', () => {
  it('should format successful restore', () => {
    const result = createMockRestoreResult();
    const output = formatRestoreResult(result, { color: false });

    expect(output).toContain('File Restored');
    expect(output).toContain('/test/renamed.txt');
    expect(output).toContain('→');
    expect(output).toContain('/test/original.txt');
  });

  it('should format failed restore with error', () => {
    const result = createMockRestoreResult({
      success: false,
      error: 'EPERM: operation not permitted',
    });
    const output = formatRestoreResult(result, { color: false });

    expect(output).toContain('Restore Failed');
    expect(output).toContain('Error:');
    expect(output).toContain('EPERM');
  });

  it('should show message result (already at original)', () => {
    const result = createMockRestoreResult({
      message: 'File is already at original location',
    });
    const output = formatRestoreResult(result, { color: false });

    expect(output).toContain('already at original');
  });

  it('should include operation ID', () => {
    const result = createMockRestoreResult();
    const output = formatRestoreResult(result, { color: false });

    expect(output).toContain(`Operation: ${validUUID}`);
  });

  it('should include duration', () => {
    const result = createMockRestoreResult({ durationMs: 123 });
    const output = formatRestoreResult(result, { color: false });

    expect(output).toContain('Duration:  123ms');
  });
});

// =============================================================================
// Test Suite: formatRestoreJson
// =============================================================================

describe('formatRestoreJson', () => {
  it('should return valid JSON', () => {
    const result = createMockRestoreResult();
    const output = formatRestoreJson(result);

    expect(() => JSON.parse(output)).not.toThrow();
  });

  it('should include all required fields', () => {
    const result = createMockRestoreResult();
    const output = formatRestoreJson(result);
    const parsed = JSON.parse(output);

    expect(parsed.success).toBe(true);
    expect(parsed.dryRun).toBe(false);
    expect(parsed.originalPath).toBe('/test/original.txt');
    expect(parsed.previousPath).toBe('/test/renamed.txt');
    expect(parsed.operationId).toBe(validUUID);
    expect(parsed.durationMs).toBe(42);
  });

  it('should include error for failed restore', () => {
    const result = createMockRestoreResult({
      success: false,
      error: 'Something went wrong',
    });
    const output = formatRestoreJson(result);
    const parsed = JSON.parse(output);

    expect(parsed.success).toBe(false);
    expect(parsed.error).toBe('Something went wrong');
  });

  it('should include message for informational result', () => {
    const result = createMockRestoreResult({
      message: 'File is already at original location',
    });
    const output = formatRestoreJson(result);
    const parsed = JSON.parse(output);

    expect(parsed.message).toBe('File is already at original location');
  });
});

// =============================================================================
// Test Suite: formatRestorePlain
// =============================================================================

describe('formatRestorePlain', () => {
  it('should output success status', () => {
    const result = createMockRestoreResult();
    const output = formatRestorePlain(result);

    expect(output).toContain('success');
    expect(output).toContain('original=/test/original.txt');
    expect(output).toContain('previous=/test/renamed.txt');
  });

  it('should output failed status with error', () => {
    const result = createMockRestoreResult({
      success: false,
      error: 'Permission denied',
    });
    const output = formatRestorePlain(result);

    expect(output).toContain('failed');
    expect(output).toContain('error=Permission denied');
  });

  it('should output already-at-original status', () => {
    const result = createMockRestoreResult({
      message: 'File is already at original location',
    });
    const output = formatRestorePlain(result);

    expect(output).toContain('already-at-original');
  });

  it('should output preview status for dry-run', () => {
    const result = createMockRestoreResult({ dryRun: true });
    const output = formatRestorePlain(result);

    expect(output).toContain('preview');
  });

  it('should not include previous if same as original', () => {
    const result = createMockRestoreResult({
      originalPath: '/test/same.txt',
      previousPath: '/test/same.txt',
    });
    const output = formatRestorePlain(result);

    expect(output).not.toContain('previous=');
  });
});

// =============================================================================
// Test Suite: formatFileLookup
// =============================================================================

describe('formatFileLookup', () => {
  it('should format found file history', () => {
    const lookup = createMockLookup();
    const output = formatFileLookup(lookup, { color: false });

    expect(output).toContain('File History');
    expect(output).toContain('Searched: /test/renamed.txt');
    expect(output).toContain('Original: /test/original.txt');
    expect(output).toContain('Current:  /test/renamed.txt');
  });

  it('should show not found message', () => {
    const lookup = createMockLookup({
      found: false,
      originalPath: null,
      currentPath: null,
      operations: [],
    });
    const output = formatFileLookup(lookup, { color: false });

    expect(output).toContain('No history found for');
  });

  it('should show at-original status', () => {
    const lookup = createMockLookup({ isAtOriginal: true });
    const output = formatFileLookup(lookup, { color: false });

    expect(output).toContain('✓ File is at original location');
  });

  it('should show renamed status', () => {
    const lookup = createMockLookup({ isAtOriginal: false });
    const output = formatFileLookup(lookup, { color: false });

    expect(output).toContain('○ File has been renamed');
  });

  it('should list operations', () => {
    const lookup = createMockLookup();
    const output = formatFileLookup(lookup, { color: false });

    expect(output).toContain('Operations:');
    expect(output).toContain('[rename]');
    expect(output).toContain(`ID: ${validUUID}`);
    expect(output).toContain('/test/original.txt');
    expect(output).toContain('→');
    expect(output).toContain('/test/renamed.txt');
  });

  it('should show last modified date', () => {
    const lookup = createMockLookup();
    const output = formatFileLookup(lookup, { color: false });

    expect(output).toContain('Last modified:');
  });

  it('should handle multiple operations', () => {
    const lookup = createMockLookup({
      operations: [
        {
          operationId: validUUID,
          timestamp: '2026-01-11T12:00:00.000Z',
          operationType: 'rename',
          originalPath: '/test/first.txt',
          newPath: '/test/second.txt',
        },
        {
          operationId: '660e8400-e29b-41d4-a716-446655440001',
          timestamp: '2026-01-11T10:00:00.000Z',
          operationType: 'rename',
          originalPath: '/test/original.txt',
          newPath: '/test/first.txt',
        },
      ],
    });
    const output = formatFileLookup(lookup, { color: false });

    expect(output).toContain('/test/first.txt');
    expect(output).toContain('/test/second.txt');
    expect(output).toContain('/test/original.txt');
  });
});

// =============================================================================
// Test Suite: formatFileLookupJson
// =============================================================================

describe('formatFileLookupJson', () => {
  it('should return valid JSON', () => {
    const lookup = createMockLookup();
    const output = formatFileLookupJson(lookup);

    expect(() => JSON.parse(output)).not.toThrow();
  });

  it('should include all lookup fields', () => {
    const lookup = createMockLookup();
    const output = formatFileLookupJson(lookup);
    const parsed = JSON.parse(output);

    expect(parsed.searchedPath).toBe('/test/renamed.txt');
    expect(parsed.found).toBe(true);
    expect(parsed.originalPath).toBe('/test/original.txt');
    expect(parsed.currentPath).toBe('/test/renamed.txt');
    expect(parsed.lastOperationId).toBe(validUUID);
    expect(parsed.isAtOriginal).toBe(false);
    expect(parsed.operations).toHaveLength(1);
  });

  it('should include operation details', () => {
    const lookup = createMockLookup();
    const output = formatFileLookupJson(lookup);
    const parsed = JSON.parse(output);

    expect(parsed.operations[0].operationId).toBe(validUUID);
    expect(parsed.operations[0].operationType).toBe('rename');
    expect(parsed.operations[0].originalPath).toBe('/test/original.txt');
    expect(parsed.operations[0].newPath).toBe('/test/renamed.txt');
  });
});
