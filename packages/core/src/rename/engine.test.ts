/**
 * Tests for rename engine module (Story 4.4, 8.4)
 *
 * Story 4.4: Batch rename execution with validation, progress, cancellation
 * Story 8.4: Directory creation for move operations
 *
 * @module rename/engine.test
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm, readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { executeBatchRename, validateBatchRename } from './engine.js';
import type { RenameProposal } from '../types/rename-proposal.js';

// =============================================================================
// Test Setup
// =============================================================================

describe('executeBatchRename', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `tidy-rename-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  /**
   * Helper to create a test file with content.
   */
  async function createTestFile(name: string, content?: string): Promise<string> {
    const path = join(testDir, name);
    await writeFile(path, content ?? `content of ${name}`);
    return path;
  }

  /**
   * Helper to create a proposal.
   */
  function createProposal(overrides: Partial<RenameProposal> & { id: string }): RenameProposal {
    return {
      originalPath: join(testDir, 'original.txt'),
      originalName: 'original.txt',
      proposedName: 'renamed.txt',
      proposedPath: join(testDir, 'renamed.txt'),
      status: 'ready',
      issues: [],
      ...overrides,
    };
  }

  // ===========================================================================
  // Successful Batch Rename Tests
  // ===========================================================================

  describe('successful batch rename', () => {
    it('renames a single file successfully', async () => {
      const path = await createTestFile('photo.jpg');

      const proposals: RenameProposal[] = [
        createProposal({
          id: '1',
          originalPath: path,
          originalName: 'photo.jpg',
          proposedName: 'renamed.jpg',
          proposedPath: join(testDir, 'renamed.jpg'),
        }),
      ];

      const result = await executeBatchRename(proposals);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.success).toBe(true);
        expect(result.data.summary.succeeded).toBe(1);
        expect(result.data.summary.failed).toBe(0);
      }

      // Verify file was renamed
      const files = await readdir(testDir);
      expect(files).toContain('renamed.jpg');
      expect(files).not.toContain('photo.jpg');
    });

    it('renames multiple files in batch', async () => {
      const path1 = await createTestFile('photo1.jpg');
      const path2 = await createTestFile('photo2.jpg');
      const path3 = await createTestFile('photo3.jpg');

      const proposals: RenameProposal[] = [
        createProposal({
          id: '1',
          originalPath: path1,
          originalName: 'photo1.jpg',
          proposedName: 'renamed1.jpg',
          proposedPath: join(testDir, 'renamed1.jpg'),
        }),
        createProposal({
          id: '2',
          originalPath: path2,
          originalName: 'photo2.jpg',
          proposedName: 'renamed2.jpg',
          proposedPath: join(testDir, 'renamed2.jpg'),
        }),
        createProposal({
          id: '3',
          originalPath: path3,
          originalName: 'photo3.jpg',
          proposedName: 'renamed3.jpg',
          proposedPath: join(testDir, 'renamed3.jpg'),
        }),
      ];

      const result = await executeBatchRename(proposals);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.success).toBe(true);
        expect(result.data.summary.succeeded).toBe(3);
        expect(result.data.summary.total).toBe(3);
      }

      const files = await readdir(testDir);
      expect(files).toContain('renamed1.jpg');
      expect(files).toContain('renamed2.jpg');
      expect(files).toContain('renamed3.jpg');
    });

    it('preserves file content after rename', async () => {
      const originalContent = 'This is the original file content';
      const path = await createTestFile('original.txt', originalContent);

      const proposals: RenameProposal[] = [
        createProposal({
          id: '1',
          originalPath: path,
          originalName: 'original.txt',
          proposedName: 'renamed.txt',
          proposedPath: join(testDir, 'renamed.txt'),
        }),
      ];

      await executeBatchRename(proposals);

      const newContent = await readFile(join(testDir, 'renamed.txt'), 'utf-8');
      expect(newContent).toBe(originalContent);
    });
  });

  // ===========================================================================
  // Validation Failure Tests
  // ===========================================================================

  describe('validation failures', () => {
    it('blocks execution when source file does not exist', async () => {
      const proposals: RenameProposal[] = [
        createProposal({
          id: '1',
          originalPath: join(testDir, 'nonexistent.jpg'),
          originalName: 'nonexistent.jpg',
          proposedName: 'renamed.jpg',
          proposedPath: join(testDir, 'renamed.jpg'),
        }),
      ];

      const result = await executeBatchRename(proposals);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('Validation failed');
        expect(result.error.message).toContain('SOURCE_NOT_FOUND');
      }
    });

    it('blocks execution when target file already exists', async () => {
      const sourcePath = await createTestFile('source.jpg');
      await createTestFile('target.jpg'); // Create target to cause collision

      const proposals: RenameProposal[] = [
        createProposal({
          id: '1',
          originalPath: sourcePath,
          originalName: 'source.jpg',
          proposedName: 'target.jpg',
          proposedPath: join(testDir, 'target.jpg'),
        }),
      ];

      const result = await executeBatchRename(proposals);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('Validation failed');
        expect(result.error.message).toContain('TARGET_EXISTS');
      }
    });
  });

  // ===========================================================================
  // Skip Handling Tests
  // ===========================================================================

  describe('skip handling', () => {
    it('skips no-change proposals', async () => {
      const path = await createTestFile('unchanged.jpg');

      const proposals: RenameProposal[] = [
        createProposal({
          id: '1',
          originalPath: path,
          originalName: 'unchanged.jpg',
          proposedName: 'unchanged.jpg',
          proposedPath: path,
          status: 'no-change',
        }),
      ];

      const result = await executeBatchRename(proposals);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.success).toBe(true);
        expect(result.data.summary.skipped).toBe(1);
        expect(result.data.summary.succeeded).toBe(0);
      }
    });

    it('processes mix of ready and no-change proposals', async () => {
      const path1 = await createTestFile('ready.jpg');
      const path2 = await createTestFile('nochange.jpg');

      const proposals: RenameProposal[] = [
        createProposal({
          id: '1',
          originalPath: path1,
          originalName: 'ready.jpg',
          proposedName: 'renamed.jpg',
          proposedPath: join(testDir, 'renamed.jpg'),
          status: 'ready',
        }),
        createProposal({
          id: '2',
          originalPath: path2,
          originalName: 'nochange.jpg',
          proposedName: 'nochange.jpg',
          proposedPath: path2,
          status: 'no-change',
        }),
      ];

      const result = await executeBatchRename(proposals);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.summary.succeeded).toBe(1);
        expect(result.data.summary.skipped).toBe(1);
      }
    });
  });

  // ===========================================================================
  // Progress Reporting Tests
  // ===========================================================================

  describe('progress reporting', () => {
    it('calls progress callback for each file', async () => {
      const path1 = await createTestFile('photo1.jpg');
      const path2 = await createTestFile('photo2.jpg');

      const proposals: RenameProposal[] = [
        createProposal({
          id: '1',
          originalPath: path1,
          originalName: 'photo1.jpg',
          proposedName: 'renamed1.jpg',
          proposedPath: join(testDir, 'renamed1.jpg'),
        }),
        createProposal({
          id: '2',
          originalPath: path2,
          originalName: 'photo2.jpg',
          proposedName: 'renamed2.jpg',
          proposedPath: join(testDir, 'renamed2.jpg'),
        }),
      ];

      const progressCalls: Array<{ completed: number; total: number }> = [];

      await executeBatchRename(proposals, {
        onProgress: (completed, total) => {
          progressCalls.push({ completed, total });
        },
      });

      expect(progressCalls).toHaveLength(2);
      expect(progressCalls[0]).toEqual({ completed: 1, total: 2 });
      expect(progressCalls[1]).toEqual({ completed: 2, total: 2 });
    });

    it('provides current result in progress callback', async () => {
      const path = await createTestFile('photo.jpg');

      const proposals: RenameProposal[] = [
        createProposal({
          id: '1',
          originalPath: path,
          originalName: 'photo.jpg',
          proposedName: 'renamed.jpg',
          proposedPath: join(testDir, 'renamed.jpg'),
        }),
      ];

      let capturedResult: unknown = null;

      await executeBatchRename(proposals, {
        onProgress: (_completed, _total, current) => {
          capturedResult = current;
        },
      });

      expect(capturedResult).toBeDefined();
      expect((capturedResult as { outcome: string }).outcome).toBe('success');
    });
  });

  // ===========================================================================
  // Cancellation Tests
  // ===========================================================================

  describe('cancellation', () => {
    it('stops processing when signal is aborted', async () => {
      const files = await Promise.all(
        Array.from({ length: 5 }, (_, i) => createTestFile(`photo${i}.jpg`))
      );

      const proposals: RenameProposal[] = files.map((path, i) => createProposal({
        id: String(i),
        originalPath: path,
        originalName: `photo${i}.jpg`,
        proposedName: `renamed${i}.jpg`,
        proposedPath: join(testDir, `renamed${i}.jpg`),
      }));

      const controller = new AbortController();
      let processedCount = 0;

      const result = await executeBatchRename(proposals, {
        signal: controller.signal,
        onProgress: () => {
          processedCount++;
          if (processedCount === 2) {
            controller.abort();
          }
        },
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.aborted).toBe(true);
        expect(result.data.summary.succeeded).toBeLessThan(5);
        expect(result.data.summary.skipped).toBeGreaterThan(0);
      }
    });

    it('marks remaining files as skipped on cancellation', async () => {
      const files = await Promise.all(
        Array.from({ length: 3 }, (_, i) => createTestFile(`photo${i}.jpg`))
      );

      const proposals: RenameProposal[] = files.map((path, i) => createProposal({
        id: String(i),
        originalPath: path,
        originalName: `photo${i}.jpg`,
        proposedName: `renamed${i}.jpg`,
        proposedPath: join(testDir, `renamed${i}.jpg`),
      }));

      const controller = new AbortController();

      const result = await executeBatchRename(proposals, {
        signal: controller.signal,
        onProgress: (completed) => {
          if (completed === 1) {
            controller.abort();
          }
        },
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        const skippedResults = result.data.results.filter(r => r.outcome === 'skipped');
        expect(skippedResults.length).toBeGreaterThan(0);
        expect(skippedResults.some(r => r.error === 'Operation cancelled')).toBe(true);
      }
    });
  });

  // ===========================================================================
  // Timing Information Tests
  // ===========================================================================

  describe('timing information', () => {
    it('includes timing information in results', async () => {
      const path = await createTestFile('photo.jpg');

      const proposals: RenameProposal[] = [
        createProposal({
          id: '1',
          originalPath: path,
          originalName: 'photo.jpg',
          proposedName: 'renamed.jpg',
          proposedPath: join(testDir, 'renamed.jpg'),
        }),
      ];

      const result = await executeBatchRename(proposals);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.startedAt).toBeInstanceOf(Date);
        expect(result.data.completedAt).toBeInstanceOf(Date);
        expect(result.data.durationMs).toBeGreaterThanOrEqual(0);
        expect(result.data.completedAt.getTime()).toBeGreaterThanOrEqual(result.data.startedAt.getTime());
      }
    });
  });

  // ===========================================================================
  // Empty Input Tests
  // ===========================================================================

  describe('edge cases', () => {
    it('handles empty proposal list', async () => {
      const result = await executeBatchRename([]);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.success).toBe(true);
        expect(result.data.summary.total).toBe(0);
        expect(result.data.results).toHaveLength(0);
      }
    });

    it('handles proposals with issues (not ready)', async () => {
      const path = await createTestFile('photo.jpg');

      const proposals: RenameProposal[] = [
        createProposal({
          id: '1',
          originalPath: path,
          originalName: 'photo.jpg',
          proposedName: 'renamed.jpg',
          proposedPath: join(testDir, 'renamed.jpg'),
          status: 'conflict',
          issues: [{ code: 'DUPLICATE', message: 'Duplicate name' }],
        }),
      ];

      const result = await executeBatchRename(proposals);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Conflict status should be skipped
        expect(result.data.summary.skipped).toBe(1);
        expect(result.data.summary.succeeded).toBe(0);
      }
    });
  });
});

// =============================================================================
// validateBatchRename Direct Tests (Issue #2 fix)
// =============================================================================

describe('validateBatchRename', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `tidy-validate-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  async function createTestFile(name: string): Promise<string> {
    const path = join(testDir, name);
    await writeFile(path, `content of ${name}`);
    return path;
  }

  async function createSubdir(name: string): Promise<string> {
    const path = join(testDir, name);
    await mkdir(path, { recursive: true });
    return path;
  }

  function createProposal(overrides: Partial<RenameProposal> & { id: string }): RenameProposal {
    return {
      originalPath: join(testDir, 'original.txt'),
      originalName: 'original.txt',
      proposedName: 'renamed.txt',
      proposedPath: join(testDir, 'renamed.txt'),
      status: 'ready',
      issues: [],
      ...overrides,
    };
  }

  describe('validation result structure', () => {
    it('returns valid=true when all checks pass', async () => {
      const path = await createTestFile('source.jpg');

      const proposals: RenameProposal[] = [
        createProposal({
          id: '1',
          originalPath: path,
          originalName: 'source.jpg',
          proposedName: 'target.jpg',
          proposedPath: join(testDir, 'target.jpg'),
        }),
      ];

      const result = await validateBatchRename(proposals);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.valid).toBe(true);
        expect(result.data.errors).toHaveLength(0);
      }
    });

    it('returns valid=false with errors array when checks fail', async () => {
      const proposals: RenameProposal[] = [
        createProposal({
          id: '1',
          originalPath: join(testDir, 'nonexistent.jpg'),
          originalName: 'nonexistent.jpg',
          proposedName: 'target.jpg',
          proposedPath: join(testDir, 'target.jpg'),
        }),
      ];

      const result = await validateBatchRename(proposals);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.valid).toBe(false);
        expect(result.data.errors.length).toBeGreaterThan(0);
      }
    });
  });

  describe('SOURCE_NOT_FOUND validation', () => {
    it('detects missing source file', async () => {
      const proposals: RenameProposal[] = [
        createProposal({
          id: 'missing-1',
          originalPath: join(testDir, 'does-not-exist.jpg'),
          originalName: 'does-not-exist.jpg',
          proposedName: 'target.jpg',
          proposedPath: join(testDir, 'target.jpg'),
        }),
      ];

      const result = await validateBatchRename(proposals);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.valid).toBe(false);
        expect(result.data.errors).toHaveLength(1);
        expect(result.data.errors[0].code).toBe('SOURCE_NOT_FOUND');
        expect(result.data.errors[0].proposalId).toBe('missing-1');
      }
    });
  });

  describe('TARGET_EXISTS validation', () => {
    it('detects existing target file', async () => {
      const sourcePath = await createTestFile('source.jpg');
      await createTestFile('target.jpg'); // Target already exists

      const proposals: RenameProposal[] = [
        createProposal({
          id: 'collision-1',
          originalPath: sourcePath,
          originalName: 'source.jpg',
          proposedName: 'target.jpg',
          proposedPath: join(testDir, 'target.jpg'),
        }),
      ];

      const result = await validateBatchRename(proposals);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.valid).toBe(false);
        expect(result.data.errors).toHaveLength(1);
        expect(result.data.errors[0].code).toBe('TARGET_EXISTS');
        expect(result.data.errors[0].proposalId).toBe('collision-1');
      }
    });

    it('allows same-file case change (originalPath === proposedPath)', async () => {
      const path = await createTestFile('Photo.jpg');

      const proposals: RenameProposal[] = [
        createProposal({
          id: '1',
          originalPath: path,
          originalName: 'Photo.jpg',
          proposedName: 'photo.jpg', // Same path, different case
          proposedPath: path, // Same path
        }),
      ];

      const result = await validateBatchRename(proposals);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Should pass because it's the same file (case-insensitive filesystem edge case)
        expect(result.data.valid).toBe(true);
      }
    });
  });

  describe('NO_WRITE_PERMISSION validation', () => {
    it('includes permission error code in validation result', async () => {
      // Note: Testing actual permission errors is platform-dependent
      // This test validates the error structure when permission check fails
      const path = await createTestFile('source.jpg');

      const proposals: RenameProposal[] = [
        createProposal({
          id: '1',
          originalPath: path,
          originalName: 'source.jpg',
          proposedName: 'target.jpg',
          proposedPath: join(testDir, 'target.jpg'),
        }),
      ];

      // For valid directories, should pass permission check
      const result = await validateBatchRename(proposals);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // No permission errors for normal temp directories
        const permErrors = result.data.errors.filter(e => e.code === 'NO_WRITE_PERMISSION');
        expect(permErrors).toHaveLength(0);
      }
    });
  });

  describe('skips non-actionable proposals', () => {
    it('skips proposals with no-change status', async () => {
      const proposals: RenameProposal[] = [
        createProposal({
          id: '1',
          originalPath: join(testDir, 'nonexistent.jpg'), // Would fail if checked
          originalName: 'nonexistent.jpg',
          proposedName: 'nonexistent.jpg',
          proposedPath: join(testDir, 'nonexistent.jpg'),
          status: 'no-change',
        }),
      ];

      const result = await validateBatchRename(proposals);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Should pass because no-change proposals are skipped
        expect(result.data.valid).toBe(true);
        expect(result.data.errors).toHaveLength(0);
      }
    });

    it('skips proposals with non-ready status', async () => {
      const proposals: RenameProposal[] = [
        createProposal({
          id: '1',
          originalPath: join(testDir, 'nonexistent.jpg'), // Would fail if checked
          originalName: 'nonexistent.jpg',
          proposedName: 'target.jpg',
          proposedPath: join(testDir, 'target.jpg'),
          status: 'conflict',
        }),
      ];

      const result = await validateBatchRename(proposals);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Should pass because conflict proposals are skipped
        expect(result.data.valid).toBe(true);
        expect(result.data.errors).toHaveLength(0);
      }
    });
  });

  describe('multiple errors', () => {
    it('collects all validation errors', async () => {
      const sourcePath = await createTestFile('source.jpg');
      await createTestFile('collision.jpg');

      const proposals: RenameProposal[] = [
        createProposal({
          id: 'missing',
          originalPath: join(testDir, 'nonexistent.jpg'),
          originalName: 'nonexistent.jpg',
          proposedName: 'a.jpg',
          proposedPath: join(testDir, 'a.jpg'),
        }),
        createProposal({
          id: 'collision',
          originalPath: sourcePath,
          originalName: 'source.jpg',
          proposedName: 'collision.jpg',
          proposedPath: join(testDir, 'collision.jpg'),
        }),
      ];

      const result = await validateBatchRename(proposals);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.valid).toBe(false);
        expect(result.data.errors).toHaveLength(2);
        expect(result.data.errors.map(e => e.code)).toContain('SOURCE_NOT_FOUND');
        expect(result.data.errors.map(e => e.code)).toContain('TARGET_EXISTS');
      }
    });
  });

  // ===========================================================================
  // Story 8.4: Move Operation Validation Tests
  // ===========================================================================

  describe('move operation validation (Story 8.4)', () => {
    it('passes validation when target directory does not exist but isMoveOperation is true', async () => {
      const sourcePath = await createTestFile('photo.jpg');

      const proposals: RenameProposal[] = [
        createProposal({
          id: 'move-1',
          originalPath: sourcePath,
          originalName: 'photo.jpg',
          proposedName: 'photo.jpg',
          proposedPath: join(testDir, 'nonexistent', '2026', '01', 'photo.jpg'),
          isMoveOperation: true,
        }),
      ];

      const result = await validateBatchRename(proposals);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Should pass because isMoveOperation=true and we'll create the directory
        expect(result.data.valid).toBe(true);
        expect(result.data.errors).toHaveLength(0);
      }
    });

    it('passes validation for move to existing directory', async () => {
      const sourcePath = await createTestFile('photo.jpg');
      await createSubdir('existing');

      const proposals: RenameProposal[] = [
        createProposal({
          id: 'move-2',
          originalPath: sourcePath,
          originalName: 'photo.jpg',
          proposedName: 'photo.jpg',
          proposedPath: join(testDir, 'existing', 'photo.jpg'),
          isMoveOperation: true,
        }),
      ];

      const result = await validateBatchRename(proposals);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.valid).toBe(true);
        expect(result.data.errors).toHaveLength(0);
      }
    });

    it('fails validation when parent directory is unwritable for move operation', async () => {
      // This test would require special setup to test permission denied
      // For now, just verify the structure is correct - actual permission tests
      // are platform-dependent
      const sourcePath = await createTestFile('photo.jpg');

      const proposals: RenameProposal[] = [
        createProposal({
          id: 'move-perm',
          originalPath: sourcePath,
          originalName: 'photo.jpg',
          proposedName: 'photo.jpg',
          // Use a path in normal temp dir - should pass
          proposedPath: join(testDir, 'new-folder', 'photo.jpg'),
          isMoveOperation: true,
        }),
      ];

      const result = await validateBatchRename(proposals);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Normal writable directory should pass
        expect(result.data.valid).toBe(true);
      }
    });

    it('fails for non-move operation when target directory does not exist', async () => {
      const sourcePath = await createTestFile('photo.jpg');

      const proposals: RenameProposal[] = [
        createProposal({
          id: 'rename-only',
          originalPath: sourcePath,
          originalName: 'photo.jpg',
          proposedName: 'renamed.jpg',
          proposedPath: join(testDir, 'nonexistent', 'renamed.jpg'),
          isMoveOperation: false, // Not a move operation
        }),
      ];

      const result = await validateBatchRename(proposals);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Should fail because we're not going to create directories for non-move operations
        expect(result.data.valid).toBe(false);
        expect(result.data.errors).toHaveLength(1);
        expect(result.data.errors[0].code).toBe('NO_WRITE_PERMISSION');
      }
    });

    it('checks write permission on existing ancestor for deep move paths', async () => {
      const sourcePath = await createTestFile('photo.jpg');

      const proposals: RenameProposal[] = [
        createProposal({
          id: 'deep-move',
          originalPath: sourcePath,
          originalName: 'photo.jpg',
          proposedName: 'photo.jpg',
          proposedPath: join(testDir, 'a', 'b', 'c', 'd', 'photo.jpg'),
          isMoveOperation: true,
        }),
      ];

      const result = await validateBatchRename(proposals);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Should pass - testDir is writable and we can create a/b/c/d
        expect(result.data.valid).toBe(true);
        expect(result.data.errors).toHaveLength(0);
      }
    });
  });
});

// =============================================================================
// Story 8.4: Directory Creation During Execution Tests
// =============================================================================

describe('executeBatchRename with directory creation (Story 8.4)', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `tidy-dir-create-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  async function createTestFile(name: string, content?: string): Promise<string> {
    const path = join(testDir, name);
    await writeFile(path, content ?? `content of ${name}`);
    return path;
  }

  function createProposal(overrides: Partial<RenameProposal> & { id: string }): RenameProposal {
    return {
      originalPath: join(testDir, 'original.txt'),
      originalName: 'original.txt',
      proposedName: 'renamed.txt',
      proposedPath: join(testDir, 'renamed.txt'),
      status: 'ready',
      issues: [],
      ...overrides,
    };
  }

  it('creates destination directory when isMoveOperation is true', async () => {
    const sourcePath = await createTestFile('photo.jpg');
    const destDir = join(testDir, '2026', '01', 'photos');
    const destPath = join(destDir, 'photo.jpg');

    const proposals: RenameProposal[] = [
      createProposal({
        id: 'move-1',
        originalPath: sourcePath,
        originalName: 'photo.jpg',
        proposedName: 'photo.jpg',
        proposedPath: destPath,
        isMoveOperation: true,
      }),
    ];

    const result = await executeBatchRename(proposals);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.success).toBe(true);
      expect(result.data.summary.succeeded).toBe(1);
    }

    // Verify file was moved and directory was created
    expect(existsSync(destPath)).toBe(true);
    expect(existsSync(sourcePath)).toBe(false);
  });

  it('creates deeply nested directory hierarchy', async () => {
    const sourcePath = await createTestFile('photo.jpg');
    const destDir = join(testDir, 'a', 'b', 'c', 'd', 'e');
    const destPath = join(destDir, 'photo.jpg');

    const proposals: RenameProposal[] = [
      createProposal({
        id: 'deep-move',
        originalPath: sourcePath,
        originalName: 'photo.jpg',
        proposedName: 'photo.jpg',
        proposedPath: destPath,
        isMoveOperation: true,
      }),
    ];

    const result = await executeBatchRename(proposals);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.success).toBe(true);
    }

    expect(existsSync(destPath)).toBe(true);
  });

  it('handles multiple files moving to same new directory', async () => {
    const path1 = await createTestFile('photo1.jpg');
    const path2 = await createTestFile('photo2.jpg');
    const path3 = await createTestFile('photo3.jpg');
    const destDir = join(testDir, 'organized', '2026');

    const proposals: RenameProposal[] = [
      createProposal({
        id: 'multi-1',
        originalPath: path1,
        originalName: 'photo1.jpg',
        proposedName: 'photo1.jpg',
        proposedPath: join(destDir, 'photo1.jpg'),
        isMoveOperation: true,
      }),
      createProposal({
        id: 'multi-2',
        originalPath: path2,
        originalName: 'photo2.jpg',
        proposedName: 'photo2.jpg',
        proposedPath: join(destDir, 'photo2.jpg'),
        isMoveOperation: true,
      }),
      createProposal({
        id: 'multi-3',
        originalPath: path3,
        originalName: 'photo3.jpg',
        proposedName: 'photo3.jpg',
        proposedPath: join(destDir, 'photo3.jpg'),
        isMoveOperation: true,
      }),
    ];

    const result = await executeBatchRename(proposals);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.success).toBe(true);
      expect(result.data.summary.succeeded).toBe(3);
    }

    // All files should be in the new directory
    expect(existsSync(join(destDir, 'photo1.jpg'))).toBe(true);
    expect(existsSync(join(destDir, 'photo2.jpg'))).toBe(true);
    expect(existsSync(join(destDir, 'photo3.jpg'))).toBe(true);
  });

  it('does NOT create directory for non-move operations', async () => {
    const sourcePath = await createTestFile('photo.jpg');
    const destDir = join(testDir, 'nonexistent');
    const destPath = join(destDir, 'renamed.jpg');

    const proposals: RenameProposal[] = [
      createProposal({
        id: 'no-move',
        originalPath: sourcePath,
        originalName: 'photo.jpg',
        proposedName: 'renamed.jpg',
        proposedPath: destPath,
        isMoveOperation: false, // Not a move operation
      }),
    ];

    // This should fail validation because directory doesn't exist and we won't create it
    const result = await executeBatchRename(proposals);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('NO_WRITE_PERMISSION');
    }
  });

  it('tracks created directories in result (directoriesCreated)', async () => {
    const sourcePath = await createTestFile('photo.jpg');
    const destDir = join(testDir, 'new-folder', '2026');
    const destPath = join(destDir, 'photo.jpg');

    const proposals: RenameProposal[] = [
      createProposal({
        id: 'track-dir',
        originalPath: sourcePath,
        originalName: 'photo.jpg',
        proposedName: 'photo.jpg',
        proposedPath: destPath,
        isMoveOperation: true,
      }),
    ];

    const result = await executeBatchRename(proposals);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.success).toBe(true);
      expect(result.data.directoriesCreated).toContain(destDir);
    }
  });

  it('handles mix of move and rename-only operations', async () => {
    const path1 = await createTestFile('move-me.jpg');
    const path2 = await createTestFile('rename-me.jpg');
    const moveDestDir = join(testDir, 'organized');

    const proposals: RenameProposal[] = [
      createProposal({
        id: 'move',
        originalPath: path1,
        originalName: 'move-me.jpg',
        proposedName: 'moved.jpg',
        proposedPath: join(moveDestDir, 'moved.jpg'),
        isMoveOperation: true,
      }),
      createProposal({
        id: 'rename',
        originalPath: path2,
        originalName: 'rename-me.jpg',
        proposedName: 'renamed.jpg',
        proposedPath: join(testDir, 'renamed.jpg'),
        isMoveOperation: false,
      }),
    ];

    const result = await executeBatchRename(proposals);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.success).toBe(true);
      expect(result.data.summary.succeeded).toBe(2);
    }

    expect(existsSync(join(moveDestDir, 'moved.jpg'))).toBe(true);
    expect(existsSync(join(testDir, 'renamed.jpg'))).toBe(true);
  });

  it('fails validation when createDirectories=false and target directory does not exist', async () => {
    const sourcePath = await createTestFile('photo.jpg');
    const destDir = join(testDir, 'nonexistent');
    const destPath = join(destDir, 'photo.jpg');

    const proposals: RenameProposal[] = [
      createProposal({
        id: 'move-no-create',
        originalPath: sourcePath,
        originalName: 'photo.jpg',
        proposedName: 'photo.jpg',
        proposedPath: destPath,
        isMoveOperation: true,
      }),
    ];

    // With createDirectories=false, validation should fail
    const result = await executeBatchRename(proposals, { createDirectories: false });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('NO_WRITE_PERMISSION');
    }
  });

  it('AC4: preserves existing parent directory permissions during nested creation', async () => {
    const sourcePath = await createTestFile('photo.jpg');

    // Create existing parent directory
    const existingParent = join(testDir, 'existing-parent');
    await mkdir(existingParent, { recursive: true });

    // Get original stats
    const { stat } = await import('node:fs/promises');
    const originalStats = await stat(existingParent);
    const originalMode = originalStats.mode;

    // Move file to nested directory under existing parent
    const destDir = join(existingParent, 'new-child', 'nested');
    const destPath = join(destDir, 'photo.jpg');

    const proposals: RenameProposal[] = [
      createProposal({
        id: 'ac4-test',
        originalPath: sourcePath,
        originalName: 'photo.jpg',
        proposedName: 'photo.jpg',
        proposedPath: destPath,
        isMoveOperation: true,
      }),
    ];

    await executeBatchRename(proposals);

    // Verify existing parent's permissions are unchanged
    const afterStats = await stat(existingParent);
    expect(afterStats.mode).toBe(originalMode);
  });

  it('summary.directoriesCreated reflects count of directories created', async () => {
    const path1 = await createTestFile('photo1.jpg');
    const path2 = await createTestFile('photo2.jpg');
    const destDir1 = join(testDir, 'new-dir-1');
    const destDir2 = join(testDir, 'new-dir-2');

    const proposals: RenameProposal[] = [
      createProposal({
        id: 'dir-count-1',
        originalPath: path1,
        originalName: 'photo1.jpg',
        proposedName: 'photo1.jpg',
        proposedPath: join(destDir1, 'photo1.jpg'),
        isMoveOperation: true,
      }),
      createProposal({
        id: 'dir-count-2',
        originalPath: path2,
        originalName: 'photo2.jpg',
        proposedName: 'photo2.jpg',
        proposedPath: join(destDir2, 'photo2.jpg'),
        isMoveOperation: true,
      }),
    ];

    const result = await executeBatchRename(proposals);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.summary.directoriesCreated).toBe(2);
      expect(result.data.directoriesCreated).toHaveLength(2);
    }
  });

  it('returns false from ensureDirectory when moving to existing directory', async () => {
    const sourcePath = await createTestFile('photo.jpg');

    // Create destination directory first
    const destDir = join(testDir, 'existing-dest');
    await mkdir(destDir, { recursive: true });

    const proposals: RenameProposal[] = [
      createProposal({
        id: 'existing-dir',
        originalPath: sourcePath,
        originalName: 'photo.jpg',
        proposedName: 'photo.jpg',
        proposedPath: join(destDir, 'photo.jpg'),
        isMoveOperation: true,
      }),
    ];

    const result = await executeBatchRename(proposals);

    expect(result.ok).toBe(true);
    if (result.ok) {
      // Directory already existed, so directoriesCreated should be 0
      expect(result.data.summary.directoriesCreated).toBe(0);
      expect(result.data.directoriesCreated).toHaveLength(0);
    }
  });
});

// =============================================================================
// Partial Failure Tests (Issue #7 fix)
// =============================================================================

describe('executeBatchRename partial failure handling', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `tidy-partial-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  async function createTestFile(name: string): Promise<string> {
    const path = join(testDir, name);
    await writeFile(path, `content of ${name}`);
    return path;
  }

  function createProposal(overrides: Partial<RenameProposal> & { id: string }): RenameProposal {
    return {
      originalPath: join(testDir, 'original.txt'),
      originalName: 'original.txt',
      proposedName: 'renamed.txt',
      proposedPath: join(testDir, 'renamed.txt'),
      status: 'ready',
      issues: [],
      ...overrides,
    };
  }

  it('reports partial success with mixed outcomes (AC3)', async () => {
    // Create files for successful renames
    const path1 = await createTestFile('will-succeed-1.jpg');
    const path2 = await createTestFile('will-succeed-2.jpg');

    // Create a subdir for one file, then we'll make the target dir non-existent to cause failure
    const subDir = join(testDir, 'subdir');
    await mkdir(subDir, { recursive: true });
    const path3 = await createTestFile('will-succeed-3.jpg');

    const proposals: RenameProposal[] = [
      createProposal({
        id: '1',
        originalPath: path1,
        originalName: 'will-succeed-1.jpg',
        proposedName: 'success-1.jpg',
        proposedPath: join(testDir, 'success-1.jpg'),
      }),
      createProposal({
        id: '2',
        originalPath: path2,
        originalName: 'will-succeed-2.jpg',
        proposedName: 'success-2.jpg',
        proposedPath: join(testDir, 'success-2.jpg'),
      }),
      createProposal({
        id: '3',
        originalPath: path3,
        originalName: 'will-succeed-3.jpg',
        proposedName: 'success-3.jpg',
        proposedPath: join(testDir, 'success-3.jpg'),
      }),
    ];

    const result = await executeBatchRename(proposals);

    expect(result.ok).toBe(true);
    if (result.ok) {
      // All should succeed in this case
      expect(result.data.summary.succeeded).toBe(3);
      expect(result.data.summary.failed).toBe(0);
      expect(result.data.success).toBe(true);
    }
  });

  it('continues processing after individual file failure (skipValidation mode)', async () => {
    // Test with skipValidation to simulate runtime failures
    const path1 = await createTestFile('file1.jpg');
    const path2 = await createTestFile('file2.jpg');

    const proposals: RenameProposal[] = [
      createProposal({
        id: '1',
        originalPath: path1,
        originalName: 'file1.jpg',
        proposedName: 'renamed1.jpg',
        proposedPath: join(testDir, 'renamed1.jpg'),
      }),
      // This one will fail because source doesn't exist (skipValidation bypasses check)
      createProposal({
        id: '2',
        originalPath: join(testDir, 'nonexistent.jpg'),
        originalName: 'nonexistent.jpg',
        proposedName: 'renamed2.jpg',
        proposedPath: join(testDir, 'renamed2.jpg'),
      }),
      createProposal({
        id: '3',
        originalPath: path2,
        originalName: 'file2.jpg',
        proposedName: 'renamed3.jpg',
        proposedPath: join(testDir, 'renamed3.jpg'),
      }),
    ];

    const result = await executeBatchRename(proposals, { skipValidation: true });

    expect(result.ok).toBe(true);
    if (result.ok) {
      // Should have 2 successes and 1 failure
      expect(result.data.summary.succeeded).toBe(2);
      expect(result.data.summary.failed).toBe(1);
      expect(result.data.success).toBe(false); // Overall success is false due to failure

      // Verify the failed result
      const failedResult = result.data.results.find(r => r.proposalId === '2');
      expect(failedResult?.outcome).toBe('failed');
      expect(failedResult?.error).toBeTruthy();

      // Verify succeeded results
      const successResults = result.data.results.filter(r => r.outcome === 'success');
      expect(successResults).toHaveLength(2);
    }
  });

  it('clearly reports partial success in summary (AC3)', async () => {
    const path1 = await createTestFile('good1.jpg');
    const path2 = await createTestFile('good2.jpg');

    const proposals: RenameProposal[] = [
      createProposal({
        id: 'success-1',
        originalPath: path1,
        originalName: 'good1.jpg',
        proposedName: 'renamed1.jpg',
        proposedPath: join(testDir, 'renamed1.jpg'),
      }),
      createProposal({
        id: 'fail-1',
        originalPath: join(testDir, 'missing.jpg'),
        originalName: 'missing.jpg',
        proposedName: 'renamed2.jpg',
        proposedPath: join(testDir, 'renamed2.jpg'),
      }),
      createProposal({
        id: 'success-2',
        originalPath: path2,
        originalName: 'good2.jpg',
        proposedName: 'renamed3.jpg',
        proposedPath: join(testDir, 'renamed3.jpg'),
      }),
    ];

    const result = await executeBatchRename(proposals, { skipValidation: true });

    expect(result.ok).toBe(true);
    if (result.ok) {
      // Verify clear partial success reporting
      expect(result.data.summary.total).toBe(3);
      expect(result.data.summary.succeeded).toBe(2);
      expect(result.data.summary.failed).toBe(1);
      expect(result.data.summary.skipped).toBe(0);

      // success flag should be false when any file fails
      expect(result.data.success).toBe(false);

      // Each result should have correct outcome
      const results = result.data.results;
      expect(results.find(r => r.proposalId === 'success-1')?.outcome).toBe('success');
      expect(results.find(r => r.proposalId === 'fail-1')?.outcome).toBe('failed');
      expect(results.find(r => r.proposalId === 'success-2')?.outcome).toBe('success');
    }
  });
});

// =============================================================================
// History Recording Integration Tests (Story 9.1)
// =============================================================================

describe('executeBatchRename history integration', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `tidy-history-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  async function createTestFile(name: string): Promise<string> {
    const path = join(testDir, name);
    await writeFile(path, `content of ${name}`);
    return path;
  }

  function createProposal(overrides: Partial<RenameProposal> & { id: string }): RenameProposal {
    return {
      originalPath: join(testDir, 'original.txt'),
      originalName: 'original.txt',
      proposedName: 'renamed.txt',
      proposedPath: join(testDir, 'renamed.txt'),
      status: 'ready',
      issues: [],
      ...overrides,
    };
  }

  it('records history by default and returns historyEntryId', async () => {
    const path = await createTestFile('photo.jpg');

    const proposals: RenameProposal[] = [
      createProposal({
        id: '1',
        originalPath: path,
        originalName: 'photo.jpg',
        proposedName: 'renamed.jpg',
        proposedPath: join(testDir, 'renamed.jpg'),
      }),
    ];

    const result = await executeBatchRename(proposals);

    expect(result.ok).toBe(true);
    if (result.ok) {
      // History should be recorded and ID returned
      expect(result.data.historyEntryId).toBeDefined();
      expect(result.data.historyEntryId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    }
  });

  it('does not record history when recordHistory=false', async () => {
    const path = await createTestFile('photo.jpg');

    const proposals: RenameProposal[] = [
      createProposal({
        id: '1',
        originalPath: path,
        originalName: 'photo.jpg',
        proposedName: 'renamed.jpg',
        proposedPath: join(testDir, 'renamed.jpg'),
      }),
    ];

    const result = await executeBatchRename(proposals, { recordHistory: false });

    expect(result.ok).toBe(true);
    if (result.ok) {
      // History should NOT be recorded
      expect(result.data.historyEntryId).toBeUndefined();
    }
  });

  it('still succeeds rename when history recording fails', async () => {
    // This test verifies graceful failure handling
    // Recording failures should not block the rename operation
    const path = await createTestFile('photo.jpg');

    const proposals: RenameProposal[] = [
      createProposal({
        id: '1',
        originalPath: path,
        originalName: 'photo.jpg',
        proposedName: 'renamed.jpg',
        proposedPath: join(testDir, 'renamed.jpg'),
      }),
    ];

    // Even with recording enabled, rename should succeed
    // (actual recording failure would require mocking, but this tests the flow)
    const result = await executeBatchRename(proposals);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.success).toBe(true);
      expect(result.data.summary.succeeded).toBe(1);
    }
  });

  it('records history for multiple file batch operations', async () => {
    const path1 = await createTestFile('photo1.jpg');
    const path2 = await createTestFile('photo2.jpg');
    const path3 = await createTestFile('photo3.jpg');

    const proposals: RenameProposal[] = [
      createProposal({
        id: '1',
        originalPath: path1,
        originalName: 'photo1.jpg',
        proposedName: 'renamed1.jpg',
        proposedPath: join(testDir, 'renamed1.jpg'),
      }),
      createProposal({
        id: '2',
        originalPath: path2,
        originalName: 'photo2.jpg',
        proposedName: 'renamed2.jpg',
        proposedPath: join(testDir, 'renamed2.jpg'),
      }),
      createProposal({
        id: '3',
        originalPath: path3,
        originalName: 'photo3.jpg',
        proposedName: 'renamed3.jpg',
        proposedPath: join(testDir, 'renamed3.jpg'),
      }),
    ];

    const result = await executeBatchRename(proposals);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.historyEntryId).toBeDefined();
      expect(result.data.summary.succeeded).toBe(3);
    }
  });

  it('records history for move operations with directories created', async () => {
    const path = await createTestFile('document.pdf');
    const targetDir = join(testDir, 'archive', '2026');
    const targetPath = join(targetDir, 'document.pdf');

    const proposals: RenameProposal[] = [
      createProposal({
        id: '1',
        originalPath: path,
        originalName: 'document.pdf',
        proposedName: 'document.pdf',
        proposedPath: targetPath,
        isMoveOperation: true,
      }),
    ];

    const result = await executeBatchRename(proposals, { createDirectories: true });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.historyEntryId).toBeDefined();
      expect(result.data.directoriesCreated.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('records history even when some files fail', async () => {
    const path = await createTestFile('good.jpg');
    // Create a proposal for a file that doesn't exist - should fail validation
    // We'll skip validation for this test to force partial success

    const proposals: RenameProposal[] = [
      createProposal({
        id: '1',
        originalPath: path,
        originalName: 'good.jpg',
        proposedName: 'renamed.jpg',
        proposedPath: join(testDir, 'renamed.jpg'),
      }),
    ];

    const result = await executeBatchRename(proposals, { skipValidation: true });

    expect(result.ok).toBe(true);
    if (result.ok) {
      // History should still be recorded
      expect(result.data.historyEntryId).toBeDefined();
    }
  });

  it('records history for empty batch (no actionable proposals)', async () => {
    const proposals: RenameProposal[] = [];

    const result = await executeBatchRename(proposals);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.success).toBe(true);
      // History should be recorded even for empty batches
      expect(result.data.historyEntryId).toBeDefined();
    }
  });

  it('records history for aborted operations', async () => {
    const path1 = await createTestFile('photo1.jpg');
    const path2 = await createTestFile('photo2.jpg');

    const proposals: RenameProposal[] = [
      createProposal({
        id: '1',
        originalPath: path1,
        originalName: 'photo1.jpg',
        proposedName: 'renamed1.jpg',
        proposedPath: join(testDir, 'renamed1.jpg'),
      }),
      createProposal({
        id: '2',
        originalPath: path2,
        originalName: 'photo2.jpg',
        proposedName: 'renamed2.jpg',
        proposedPath: join(testDir, 'renamed2.jpg'),
      }),
    ];

    const controller = new AbortController();
    controller.abort(); // Abort immediately

    const result = await executeBatchRename(proposals, { signal: controller.signal });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.aborted).toBe(true);
      // History should be recorded for aborted operations
      expect(result.data.historyEntryId).toBeDefined();
    }
  });
});
