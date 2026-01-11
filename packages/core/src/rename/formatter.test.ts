/**
 * Tests for rename formatter (Story 4.2)
 *
 * @module rename/formatter.test
 */

import { describe, it, expect } from 'vitest';
import { formatPreview, computeDiff, truncateFilename } from './formatter.js';
import type { RenamePreview } from '../types/rename-proposal.js';
import { RenameStatus } from '../types/rename-proposal.js';

// =============================================================================
// Test Data
// =============================================================================

function createMockPreview(overrides?: Partial<RenamePreview>): RenamePreview {
  return {
    proposals: [
      {
        id: '1',
        originalPath: '/test/IMG_001.jpg',
        originalName: 'IMG_001.jpg',
        proposedName: '2026-01-15_photo.jpg',
        proposedPath: '/test/2026-01-15_photo.jpg',
        status: RenameStatus.READY,
        issues: [],
      },
      {
        id: '2',
        originalPath: '/test/photo.jpg',
        originalName: 'photo.jpg',
        proposedName: 'photo.jpg',
        proposedPath: '/test/photo.jpg',
        status: RenameStatus.NO_CHANGE,
        issues: [],
      },
    ],
    summary: {
      total: 2,
      ready: 1,
      conflicts: 0,
      missingData: 0,
      noChange: 1,
      invalidName: 0,
    },
    generatedAt: new Date(),
    templateUsed: '{year}-{month}-{day}_{original}',
    ...overrides,
  };
}

// =============================================================================
// formatPreview Tests
// =============================================================================

describe('formatPreview', () => {
  describe('basic formatting', () => {
    it('formats entries with original and proposed names', () => {
      const preview = createMockPreview();
      const result = formatPreview(preview);

      expect(result.entries[0].original.name).toBe('IMG_001.jpg');
      expect(result.entries[0].proposed.name).toBe('2026-01-15_photo.jpg');
    });

    it('includes status and statusLabel for each entry', () => {
      const preview = createMockPreview();
      const result = formatPreview(preview);

      expect(result.entries[0].status).toBe('ready');
      expect(result.entries[0].statusLabel).toBe('Ready');
      expect(result.entries[1].status).toBe('no-change');
      expect(result.entries[1].statusLabel).toBe('No Change');
    });

    it('includes id from proposal', () => {
      const preview = createMockPreview();
      const result = formatPreview(preview);

      expect(result.entries[0].id).toBe('1');
      expect(result.entries[1].id).toBe('2');
    });

    it('includes original and proposed paths', () => {
      const preview = createMockPreview();
      const result = formatPreview(preview);

      expect(result.entries[0].original.path).toBe('/test/IMG_001.jpg');
      expect(result.entries[0].proposed.path).toBe('/test/2026-01-15_photo.jpg');
    });
  });

  describe('unchanged file marking (AC2)', () => {
    it('marks unchanged files correctly', () => {
      const preview = createMockPreview();
      const result = formatPreview(preview);

      expect(result.entries[0].isUnchanged).toBe(false);
      expect(result.entries[1].isUnchanged).toBe(true);
    });

    it('detects unchanged when original equals proposed', () => {
      const preview = createMockPreview({
        proposals: [
          {
            id: '1',
            originalPath: '/test/same.jpg',
            originalName: 'same.jpg',
            proposedName: 'same.jpg',
            proposedPath: '/test/same.jpg',
            status: RenameStatus.NO_CHANGE,
            issues: [],
          },
        ],
        summary: {
          total: 1,
          ready: 0,
          conflicts: 0,
          missingData: 0,
          noChange: 1,
          invalidName: 0,
        },
      });
      const result = formatPreview(preview);

      expect(result.entries[0].isUnchanged).toBe(true);
    });
  });

  describe('summary calculation', () => {
    it('calculates summary correctly', () => {
      const preview = createMockPreview();
      const result = formatPreview(preview);

      expect(result.summary.total).toBe(2);
      expect(result.summary.ready).toBe(1);
      expect(result.summary.unchanged).toBe(1);
      expect(result.summary.conflicts).toBe(0);
      expect(result.summary.issues).toBe(0);
    });

    it('combines missingData and invalidName into issues count', () => {
      const preview = createMockPreview({
        proposals: [
          {
            id: '1',
            originalPath: '/test/a.jpg',
            originalName: 'a.jpg',
            proposedName: 'missing.jpg',
            proposedPath: '/test/missing.jpg',
            status: RenameStatus.MISSING_DATA,
            issues: [{ code: 'MISSING', message: 'Missing data' }],
          },
          {
            id: '2',
            originalPath: '/test/b.jpg',
            originalName: 'b.jpg',
            proposedName: 'CON.jpg',
            proposedPath: '/test/CON.jpg',
            status: RenameStatus.INVALID_NAME,
            issues: [{ code: 'INVALID', message: 'Invalid name' }],
          },
        ],
        summary: {
          total: 2,
          ready: 0,
          conflicts: 0,
          missingData: 1,
          noChange: 0,
          invalidName: 1,
        },
      });
      const result = formatPreview(preview);

      expect(result.summary.issues).toBe(2);
    });
  });

  describe('diff generation', () => {
    it('generates diff for changed entries when showDiff is true', () => {
      const preview = createMockPreview();
      const result = formatPreview(preview, { showDiff: true });

      // First entry should have diff (names differ)
      expect(result.entries[0].diff).not.toBeNull();

      // Second entry should not have diff (unchanged)
      expect(result.entries[1].diff).toBeNull();
    });

    it('does not generate diff when showDiff is false', () => {
      const preview = createMockPreview();
      const result = formatPreview(preview, { showDiff: false });

      expect(result.entries[0].diff).toBeNull();
      expect(result.entries[1].diff).toBeNull();
    });

    it('defaults showDiff to true', () => {
      const preview = createMockPreview();
      const result = formatPreview(preview);

      expect(result.entries[0].diff).not.toBeNull();
    });
  });

  describe('status labels', () => {
    it('provides correct labels for all status types', () => {
      const preview = createMockPreview({
        proposals: [
          {
            id: '1',
            originalPath: '/test/a.jpg',
            originalName: 'a.jpg',
            proposedName: 'b.jpg',
            proposedPath: '/test/b.jpg',
            status: RenameStatus.READY,
            issues: [],
          },
          {
            id: '2',
            originalPath: '/test/c.jpg',
            originalName: 'c.jpg',
            proposedName: 'd.jpg',
            proposedPath: '/test/d.jpg',
            status: RenameStatus.CONFLICT,
            issues: [],
          },
          {
            id: '3',
            originalPath: '/test/e.jpg',
            originalName: 'e.jpg',
            proposedName: 'f.jpg',
            proposedPath: '/test/f.jpg',
            status: RenameStatus.MISSING_DATA,
            issues: [],
          },
          {
            id: '4',
            originalPath: '/test/g.jpg',
            originalName: 'g.jpg',
            proposedName: 'g.jpg',
            proposedPath: '/test/g.jpg',
            status: RenameStatus.NO_CHANGE,
            issues: [],
          },
          {
            id: '5',
            originalPath: '/test/h.jpg',
            originalName: 'h.jpg',
            proposedName: 'CON.jpg',
            proposedPath: '/test/CON.jpg',
            status: RenameStatus.INVALID_NAME,
            issues: [],
          },
        ],
        summary: {
          total: 5,
          ready: 1,
          conflicts: 1,
          missingData: 1,
          noChange: 1,
          invalidName: 1,
        },
      });

      const result = formatPreview(preview);

      expect(result.entries[0].statusLabel).toBe('Ready');
      expect(result.entries[1].statusLabel).toBe('Conflict');
      expect(result.entries[2].statusLabel).toBe('Missing Data');
      expect(result.entries[3].statusLabel).toBe('No Change');
      expect(result.entries[4].statusLabel).toBe('Invalid Name');
    });
  });
});

// =============================================================================
// truncateFilename Tests
// =============================================================================

describe('truncateFilename', () => {
  it('returns original string if within maxLength', () => {
    const result = truncateFilename('short.jpg', 50);
    expect(result).toBe('short.jpg');
  });

  it('truncates long filenames', () => {
    const longName = 'very_long_filename_that_exceeds_the_maximum_display_length.jpg';
    const result = truncateFilename(longName, 30);

    expect(result.length).toBeLessThanOrEqual(30);
    expect(result).toContain('...');
  });

  it('preserves file extension when truncating', () => {
    const longName = 'very_long_filename_that_exceeds_the_maximum_display_length.jpg';
    const result = truncateFilename(longName, 30);

    expect(result).toContain('.jpg');
  });

  it('handles filenames without extension', () => {
    const longName = 'very_long_filename_that_exceeds_the_maximum_display_length';
    const result = truncateFilename(longName, 30);

    expect(result.length).toBeLessThanOrEqual(30);
    expect(result).toContain('...');
  });

  it('handles very short maxLength by simple truncation', () => {
    const name = 'very_long_filename.jpg';
    const result = truncateFilename(name, 10);

    expect(result.length).toBeLessThanOrEqual(10);
    expect(result).toContain('...');
  });

  it('handles edge case of maxLength equal to string length', () => {
    const name = 'exact.jpg';
    const result = truncateFilename(name, 9);

    expect(result).toBe('exact.jpg');
  });
});

// =============================================================================
// computeDiff Tests (AC3)
// =============================================================================

describe('computeDiff', () => {
  describe('added portions', () => {
    it('identifies added prefix', () => {
      const diff = computeDiff('photo.jpg', '2026-01-15_photo.jpg');

      expect(diff.proposed.some((s) => s.type === 'added')).toBe(true);
      const addedSegment = diff.proposed.find((s) => s.type === 'added');
      expect(addedSegment?.text).toBe('2026-01-15_');
    });

    it('identifies added suffix', () => {
      const diff = computeDiff('photo.jpg', 'photo_edited.jpg');

      expect(diff.proposed.some((s) => s.type === 'added')).toBe(true);
    });
  });

  describe('removed portions', () => {
    it('identifies removed portions', () => {
      const diff = computeDiff('IMG_001.jpg', 'photo.jpg');

      expect(diff.original.some((s) => s.type === 'removed')).toBe(true);
    });

    it('marks removed text in original', () => {
      const diff = computeDiff('old_prefix_file.txt', 'file.txt');

      const removedSegments = diff.original.filter((s) => s.type === 'removed');
      expect(removedSegments.length).toBeGreaterThan(0);
    });
  });

  describe('unchanged portions', () => {
    it('preserves common prefix', () => {
      const diff = computeDiff('photo.jpg', 'photo_edited.jpg');

      expect(diff.original.some((s) => s.type === 'unchanged' && s.text.includes('photo'))).toBe(
        true
      );
      expect(diff.proposed.some((s) => s.type === 'unchanged' && s.text.includes('photo'))).toBe(
        true
      );
    });

    it('preserves common suffix', () => {
      const diff = computeDiff('old_file.txt', 'new_file.txt');

      expect(diff.original.some((s) => s.type === 'unchanged' && s.text.includes('.txt'))).toBe(
        true
      );
      expect(diff.proposed.some((s) => s.type === 'unchanged' && s.text.includes('.txt'))).toBe(
        true
      );
    });
  });

  describe('edge cases', () => {
    it('handles completely different strings', () => {
      const diff = computeDiff('abc.txt', 'xyz.pdf');

      expect(diff.original.length).toBeGreaterThan(0);
      expect(diff.proposed.length).toBeGreaterThan(0);
    });

    it('handles identical strings', () => {
      const diff = computeDiff('same.txt', 'same.txt');

      // All segments should be unchanged
      expect(diff.original.every((s) => s.type === 'unchanged')).toBe(true);
      expect(diff.proposed.every((s) => s.type === 'unchanged')).toBe(true);
    });

    it('handles empty strings', () => {
      const diff = computeDiff('', 'new.txt');

      expect(diff.proposed.length).toBeGreaterThan(0);
      expect(diff.proposed.some((s) => s.type === 'added')).toBe(true);
    });

    it('handles strings becoming empty', () => {
      const diff = computeDiff('old.txt', '');

      expect(diff.original.length).toBeGreaterThan(0);
      expect(diff.original.some((s) => s.type === 'removed')).toBe(true);
    });

    it('handles single character changes', () => {
      const diff = computeDiff('file1.txt', 'file2.txt');

      // Should have unchanged, removed, added, unchanged segments
      expect(diff.original.some((s) => s.type === 'unchanged')).toBe(true);
      expect(diff.original.some((s) => s.type === 'removed')).toBe(true);
      expect(diff.proposed.some((s) => s.type === 'added')).toBe(true);
    });
  });
});
