/**
 * Conflict detection tests (Story 4.6)
 *
 * Tests for detecting and preventing filename conflicts before renaming.
 *
 * @module rename/conflicts.test
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  detectBatchDuplicates,
  detectFilesystemCollisions,
  detectAllConflicts,
  blockOnConflicts,
  ConflictCode,
} from './conflicts.js';
import type { RenameProposal } from '../types/rename-proposal.js';

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Create a test proposal with minimal required fields.
 */
function createProposal(overrides: Partial<RenameProposal> = {}): RenameProposal {
  return {
    id: crypto.randomUUID(),
    originalPath: '/test/original.jpg',
    originalName: 'original.jpg',
    proposedName: 'renamed.jpg',
    proposedPath: '/test/renamed.jpg',
    status: 'ready',
    issues: [],
    ...overrides,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('detectBatchDuplicates', () => {
  // ===========================================================================
  // AC1: Detect duplicate proposed names within batch
  // ===========================================================================

  it('detects duplicate proposed names', () => {
    const proposals = [
      createProposal({
        id: '1',
        originalPath: '/test/a.jpg',
        proposedName: 'same.jpg',
        proposedPath: '/test/same.jpg',
      }),
      createProposal({
        id: '2',
        originalPath: '/test/b.jpg',
        proposedName: 'same.jpg',
        proposedPath: '/test/same.jpg',
      }),
    ];

    const conflicts = detectBatchDuplicates(proposals);

    expect(conflicts.size).toBe(2);
    expect(conflicts.get('1')?.[0].code).toBe(ConflictCode.DUPLICATE_PROPOSED);
    expect(conflicts.get('2')?.[0].code).toBe(ConflictCode.DUPLICATE_PROPOSED);
  });

  it('detects case-insensitive duplicates', () => {
    const proposals = [
      createProposal({
        id: '1',
        originalPath: '/test/a.jpg',
        proposedName: 'Photo.jpg',
        proposedPath: '/test/Photo.jpg',
      }),
      createProposal({
        id: '2',
        originalPath: '/test/b.jpg',
        proposedName: 'photo.jpg',
        proposedPath: '/test/photo.jpg',
      }),
    ];

    const conflicts = detectBatchDuplicates(proposals);

    expect(conflicts.size).toBe(2);
  });

  it('ignores duplicates in different directories', () => {
    const proposals = [
      createProposal({
        id: '1',
        originalPath: '/test1/a.jpg',
        proposedName: 'photo.jpg',
        proposedPath: '/test1/photo.jpg',
      }),
      createProposal({
        id: '2',
        originalPath: '/test2/b.jpg',
        proposedName: 'photo.jpg',
        proposedPath: '/test2/photo.jpg',
      }),
    ];

    const conflicts = detectBatchDuplicates(proposals);

    expect(conflicts.size).toBe(0);
  });

  it('provides counter suggestions for duplicates', () => {
    const proposals = [
      createProposal({
        id: '1',
        originalPath: '/test/a.jpg',
        proposedName: 'photo.jpg',
        proposedPath: '/test/photo.jpg',
      }),
      createProposal({
        id: '2',
        originalPath: '/test/b.jpg',
        proposedName: 'photo.jpg',
        proposedPath: '/test/photo.jpg',
      }),
      createProposal({
        id: '3',
        originalPath: '/test/c.jpg',
        proposedName: 'photo.jpg',
        proposedPath: '/test/photo.jpg',
      }),
    ];

    const conflicts = detectBatchDuplicates(proposals);

    expect(conflicts.get('1')?.[0].suggestion).toBe('photo_1.jpg');
    expect(conflicts.get('2')?.[0].suggestion).toBe('photo_2.jpg');
    expect(conflicts.get('3')?.[0].suggestion).toBe('photo_3.jpg');
  });

  it('handles files without extensions', () => {
    const proposals = [
      createProposal({
        id: '1',
        originalPath: '/test/a',
        proposedName: 'readme',
        proposedPath: '/test/readme',
      }),
      createProposal({
        id: '2',
        originalPath: '/test/b',
        proposedName: 'readme',
        proposedPath: '/test/readme',
      }),
    ];

    const conflicts = detectBatchDuplicates(proposals);

    expect(conflicts.size).toBe(2);
    expect(conflicts.get('1')?.[0].suggestion).toBe('readme_1');
    expect(conflicts.get('2')?.[0].suggestion).toBe('readme_2');
  });

  it('returns empty map when no duplicates', () => {
    const proposals = [
      createProposal({
        id: '1',
        originalPath: '/test/a.jpg',
        proposedName: 'a_renamed.jpg',
        proposedPath: '/test/a_renamed.jpg',
      }),
      createProposal({
        id: '2',
        originalPath: '/test/b.jpg',
        proposedName: 'b_renamed.jpg',
        proposedPath: '/test/b_renamed.jpg',
      }),
    ];

    const conflicts = detectBatchDuplicates(proposals);

    expect(conflicts.size).toBe(0);
  });

  it('handles empty proposals array', () => {
    const conflicts = detectBatchDuplicates([]);

    expect(conflicts.size).toBe(0);
  });

  it('handles single proposal', () => {
    const proposals = [
      createProposal({
        id: '1',
        originalPath: '/test/a.jpg',
        proposedName: 'renamed.jpg',
        proposedPath: '/test/renamed.jpg',
      }),
    ];

    const conflicts = detectBatchDuplicates(proposals);

    expect(conflicts.size).toBe(0);
  });

  it('includes message with conflict count', () => {
    const proposals = [
      createProposal({
        id: '1',
        originalPath: '/test/a.jpg',
        proposedName: 'same.jpg',
        proposedPath: '/test/same.jpg',
      }),
      createProposal({
        id: '2',
        originalPath: '/test/b.jpg',
        proposedName: 'same.jpg',
        proposedPath: '/test/same.jpg',
      }),
      createProposal({
        id: '3',
        originalPath: '/test/c.jpg',
        proposedName: 'same.jpg',
        proposedPath: '/test/same.jpg',
      }),
    ];

    const conflicts = detectBatchDuplicates(proposals);

    expect(conflicts.get('1')?.[0].message).toContain('2 other file(s)');
    expect(conflicts.get('1')?.[0].message).toContain('same.jpg');
  });

  it('lists conflicting paths', () => {
    const proposals = [
      createProposal({
        id: '1',
        originalPath: '/test/a.jpg',
        proposedName: 'same.jpg',
        proposedPath: '/test/same.jpg',
      }),
      createProposal({
        id: '2',
        originalPath: '/test/b.jpg',
        proposedName: 'same.jpg',
        proposedPath: '/test/same.jpg',
      }),
    ];

    const conflicts = detectBatchDuplicates(proposals);

    expect(conflicts.get('1')?.[0].conflictingWith).toContain('/test/b.jpg');
    expect(conflicts.get('2')?.[0].conflictingWith).toContain('/test/a.jpg');
  });
});

describe('detectFilesystemCollisions', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `tidy-conflict-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  // ===========================================================================
  // AC2: Detect collision with existing files
  // ===========================================================================

  it('detects collision with existing file', async () => {
    const existingFile = join(testDir, 'existing.jpg');
    await writeFile(existingFile, 'content');

    const proposals = [
      createProposal({
        id: '1',
        originalPath: join(testDir, 'other.jpg'),
        proposedName: 'existing.jpg',
        proposedPath: existingFile,
      }),
    ];

    const conflicts = detectFilesystemCollisions(proposals);

    expect(conflicts.size).toBe(1);
    expect(conflicts.get('1')?.[0].code).toBe(ConflictCode.FILE_EXISTS);
    expect(conflicts.get('1')?.[0].message).toContain('already exists');
  });

  it('ignores self-rename (same path)', async () => {
    const filePath = join(testDir, 'file.jpg');
    await writeFile(filePath, 'content');

    const proposals = [
      createProposal({
        id: '1',
        originalPath: filePath,
        proposedPath: filePath,
        originalName: 'file.jpg',
        proposedName: 'file.jpg',
      }),
    ];

    const conflicts = detectFilesystemCollisions(proposals);

    expect(conflicts.size).toBe(0);
  });

  it('allows case-only renames on case-insensitive systems', async () => {
    const filePath = join(testDir, 'photo.jpg');
    await writeFile(filePath, 'content');

    const proposals = [
      createProposal({
        id: '1',
        originalPath: filePath,
        proposedName: 'Photo.jpg',
        proposedPath: join(testDir, 'Photo.jpg'),
      }),
    ];

    const conflicts = detectFilesystemCollisions(proposals, { caseSensitive: false });

    expect(conflicts.size).toBe(0);
  });

  it('returns empty map when no collisions', async () => {
    const proposals = [
      createProposal({
        id: '1',
        originalPath: join(testDir, 'a.jpg'),
        proposedName: 'nonexistent.jpg',
        proposedPath: join(testDir, 'nonexistent.jpg'),
      }),
    ];

    const conflicts = detectFilesystemCollisions(proposals);

    expect(conflicts.size).toBe(0);
  });

  it('skips filesystem check when disabled', async () => {
    const existingFile = join(testDir, 'existing.jpg');
    await writeFile(existingFile, 'content');

    const proposals = [
      createProposal({
        id: '1',
        originalPath: join(testDir, 'other.jpg'),
        proposedName: 'existing.jpg',
        proposedPath: existingFile,
      }),
    ];

    const conflicts = detectFilesystemCollisions(proposals, { checkFileSystem: false });

    expect(conflicts.size).toBe(0);
  });

  it('provides unique suffix suggestion for existing file', async () => {
    const existingFile = join(testDir, 'existing.jpg');
    await writeFile(existingFile, 'content');

    const proposals = [
      createProposal({
        id: '1',
        originalPath: join(testDir, 'other.jpg'),
        proposedName: 'existing.jpg',
        proposedPath: existingFile,
      }),
    ];

    const conflicts = detectFilesystemCollisions(proposals);

    expect(conflicts.get('1')?.[0].suggestion).toMatch(/^existing_[a-z0-9]+\.jpg$/);
  });

  it('handles multiple collisions', async () => {
    const existing1 = join(testDir, 'existing1.jpg');
    const existing2 = join(testDir, 'existing2.jpg');
    await writeFile(existing1, 'content');
    await writeFile(existing2, 'content');

    const proposals = [
      createProposal({
        id: '1',
        originalPath: join(testDir, 'a.jpg'),
        proposedName: 'existing1.jpg',
        proposedPath: existing1,
      }),
      createProposal({
        id: '2',
        originalPath: join(testDir, 'b.jpg'),
        proposedName: 'existing2.jpg',
        proposedPath: existing2,
      }),
    ];

    const conflicts = detectFilesystemCollisions(proposals);

    expect(conflicts.size).toBe(2);
    expect(conflicts.has('1')).toBe(true);
    expect(conflicts.has('2')).toBe(true);
  });
});

describe('detectAllConflicts', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `tidy-conflict-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('merges batch and filesystem conflicts', async () => {
    const existingFile = join(testDir, 'existing.jpg');
    await writeFile(existingFile, 'content');

    const proposals = [
      createProposal({
        id: '1',
        originalPath: join(testDir, 'a.jpg'),
        proposedName: 'same.jpg',
        proposedPath: join(testDir, 'same.jpg'),
      }),
      createProposal({
        id: '2',
        originalPath: join(testDir, 'b.jpg'),
        proposedName: 'same.jpg',
        proposedPath: join(testDir, 'same.jpg'),
      }),
      createProposal({
        id: '3',
        originalPath: join(testDir, 'c.jpg'),
        proposedName: 'existing.jpg',
        proposedPath: existingFile,
      }),
    ];

    const report = detectAllConflicts(proposals);

    expect(report.hasConflicts).toBe(true);
    expect(report.conflicts.has('1')).toBe(true);
    expect(report.conflicts.has('2')).toBe(true);
    expect(report.conflicts.has('3')).toBe(true);
  });

  it('aggregates multiple conflicts for same proposal', async () => {
    const existingFile = join(testDir, 'same.jpg');
    await writeFile(existingFile, 'content');

    const proposals = [
      createProposal({
        id: '1',
        originalPath: join(testDir, 'a.jpg'),
        proposedName: 'same.jpg',
        proposedPath: join(testDir, 'same.jpg'),
      }),
      createProposal({
        id: '2',
        originalPath: join(testDir, 'b.jpg'),
        proposedName: 'same.jpg',
        proposedPath: join(testDir, 'same.jpg'),
      }),
    ];

    const report = detectAllConflicts(proposals);

    // Both have duplicate conflict, and both target existing file
    expect(report.conflicts.get('1')?.length).toBeGreaterThanOrEqual(1);
    expect(report.conflicts.get('2')?.length).toBeGreaterThanOrEqual(1);
  });

  it('provides summary with counts', async () => {
    const existingFile = join(testDir, 'existing.jpg');
    await writeFile(existingFile, 'content');

    const proposals = [
      createProposal({
        id: '1',
        originalPath: join(testDir, 'a.jpg'),
        proposedName: 'same.jpg',
        proposedPath: join(testDir, 'same.jpg'),
      }),
      createProposal({
        id: '2',
        originalPath: join(testDir, 'b.jpg'),
        proposedName: 'same.jpg',
        proposedPath: join(testDir, 'same.jpg'),
      }),
      createProposal({
        id: '3',
        originalPath: join(testDir, 'c.jpg'),
        proposedName: 'existing.jpg',
        proposedPath: existingFile,
      }),
    ];

    const report = detectAllConflicts(proposals);

    expect(report.summary.totalConflicts).toBe(3);
    expect(report.summary.duplicateCount).toBe(2);
    expect(report.summary.existingFileCount).toBe(1);
  });

  it('returns no conflicts when all clear', () => {
    const proposals = [
      createProposal({
        id: '1',
        originalPath: '/test/a.jpg',
        proposedName: 'a_new.jpg',
        proposedPath: '/test/a_new.jpg',
      }),
      createProposal({
        id: '2',
        originalPath: '/test/b.jpg',
        proposedName: 'b_new.jpg',
        proposedPath: '/test/b_new.jpg',
      }),
    ];

    const report = detectAllConflicts(proposals, { checkFileSystem: false });

    expect(report.hasConflicts).toBe(false);
    expect(report.conflicts.size).toBe(0);
    expect(report.summary.totalConflicts).toBe(0);
  });
});

describe('blockOnConflicts', () => {
  // ===========================================================================
  // AC3: Block execution when conflicts detected
  // ===========================================================================

  it('returns ok when no conflicts', () => {
    const proposals = [
      createProposal({
        id: '1',
        originalPath: '/test/a.jpg',
        proposedName: 'new_a.jpg',
        proposedPath: '/test/new_a.jpg',
      }),
    ];

    const result = blockOnConflicts(proposals);

    expect(result.ok).toBe(true);
  });

  it('returns error when duplicate conflicts exist', () => {
    const proposals = [
      createProposal({
        id: '1',
        originalPath: '/test/a.jpg',
        proposedName: 'same.jpg',
        proposedPath: '/test/same.jpg',
      }),
      createProposal({
        id: '2',
        originalPath: '/test/b.jpg',
        proposedName: 'same.jpg',
        proposedPath: '/test/same.jpg',
      }),
    ];

    const result = blockOnConflicts(proposals);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('filename conflicts detected');
      expect(result.error.message).toContain('duplicate proposed names');
    }
  });

  it('includes total conflict count in error', () => {
    const proposals = [
      createProposal({
        id: '1',
        originalPath: '/test/a.jpg',
        proposedName: 'same.jpg',
        proposedPath: '/test/same.jpg',
      }),
      createProposal({
        id: '2',
        originalPath: '/test/b.jpg',
        proposedName: 'same.jpg',
        proposedPath: '/test/same.jpg',
      }),
    ];

    const result = blockOnConflicts(proposals);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('Total conflicts: 2');
    }
  });

  it('suggests resolution in error message', () => {
    const proposals = [
      createProposal({
        id: '1',
        originalPath: '/test/a.jpg',
        proposedName: 'same.jpg',
        proposedPath: '/test/same.jpg',
      }),
      createProposal({
        id: '2',
        originalPath: '/test/b.jpg',
        proposedName: 'same.jpg',
        proposedPath: '/test/same.jpg',
      }),
    ];

    const result = blockOnConflicts(proposals);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('Resolve conflicts before executing');
    }
  });

  it('works with empty proposals', () => {
    const result = blockOnConflicts([]);

    expect(result.ok).toBe(true);
  });
});

describe('edge cases', () => {
  it('handles proposals with special characters in names', () => {
    const proposals = [
      createProposal({
        id: '1',
        originalPath: '/test/a.jpg',
        proposedName: 'photo (1).jpg',
        proposedPath: '/test/photo (1).jpg',
      }),
      createProposal({
        id: '2',
        originalPath: '/test/b.jpg',
        proposedName: 'photo (1).jpg',
        proposedPath: '/test/photo (1).jpg',
      }),
    ];

    const conflicts = detectBatchDuplicates(proposals);

    expect(conflicts.size).toBe(2);
  });

  it('handles proposals with unicode characters', () => {
    const proposals = [
      createProposal({
        id: '1',
        originalPath: '/test/a.jpg',
        proposedName: '照片.jpg',
        proposedPath: '/test/照片.jpg',
      }),
      createProposal({
        id: '2',
        originalPath: '/test/b.jpg',
        proposedName: '照片.jpg',
        proposedPath: '/test/照片.jpg',
      }),
    ];

    const conflicts = detectBatchDuplicates(proposals);

    expect(conflicts.size).toBe(2);
  });

  it('handles deeply nested paths', () => {
    const proposals = [
      createProposal({
        id: '1',
        originalPath: '/a/b/c/d/e/f.jpg',
        proposedName: 'photo.jpg',
        proposedPath: '/a/b/c/d/e/photo.jpg',
      }),
      createProposal({
        id: '2',
        originalPath: '/a/b/c/d/e/g.jpg',
        proposedName: 'photo.jpg',
        proposedPath: '/a/b/c/d/e/photo.jpg',
      }),
    ];

    const conflicts = detectBatchDuplicates(proposals);

    expect(conflicts.size).toBe(2);
  });

  it('handles many duplicates efficiently', () => {
    const proposals = Array.from({ length: 100 }, (_, i) =>
      createProposal({
        id: String(i),
        originalPath: `/test/${i}.jpg`,
        proposedName: 'same.jpg',
        proposedPath: '/test/same.jpg',
      })
    );

    const start = Date.now();
    const conflicts = detectBatchDuplicates(proposals);
    const elapsed = Date.now() - start;

    expect(conflicts.size).toBe(100);
    expect(elapsed).toBeLessThan(100); // Should be fast
  });
});
