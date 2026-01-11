/**
 * Tests for CLI preview table formatter (Story 4.2)
 *
 * Note: Chalk auto-detects color support and disables colors in non-TTY
 * environments (like CI or test runners). Tests validate structure and
 * content rather than relying on ANSI codes being present.
 *
 * @module utils/preview-table.test
 */

import { describe, it, expect } from 'vitest';
import { formatPreviewTable } from './preview-table.js';
import type { FormattedPreview } from '@tidy/core';

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Strip ANSI codes for easier testing.
 */
function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

function createMockPreview(overrides?: Partial<FormattedPreview>): FormattedPreview {
  return {
    entries: [
      {
        id: '1',
        original: {
          name: 'IMG_001.jpg',
          path: '/test/IMG_001.jpg',
          display: 'IMG_001.jpg',
        },
        proposed: {
          name: '2026-01-15_photo.jpg',
          path: '/test/2026-01-15_photo.jpg',
          display: '2026-01-15_photo.jpg',
        },
        status: 'ready',
        statusLabel: 'Ready',
        isUnchanged: false,
        diff: {
          original: [{ text: 'IMG_001.jpg', type: 'removed' }],
          proposed: [{ text: '2026-01-15_photo.jpg', type: 'added' }],
        },
      },
      {
        id: '2',
        original: {
          name: 'photo.jpg',
          path: '/test/photo.jpg',
          display: 'photo.jpg',
        },
        proposed: {
          name: 'photo.jpg',
          path: '/test/photo.jpg',
          display: 'photo.jpg',
        },
        status: 'no-change',
        statusLabel: 'No Change',
        isUnchanged: true,
        diff: null,
      },
    ],
    summary: {
      total: 2,
      ready: 1,
      conflicts: 0,
      issues: 0,
      unchanged: 1,
    },
    ...overrides,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('formatPreviewTable', () => {
  describe('basic formatting', () => {
    it('includes header text', () => {
      const preview = createMockPreview();
      const result = formatPreviewTable(preview);
      const plain = stripAnsi(result);

      expect(plain).toContain('Rename Preview');
    });

    it('includes column headers', () => {
      const preview = createMockPreview();
      const result = formatPreviewTable(preview);
      const plain = stripAnsi(result);

      expect(plain).toContain('Original');
      expect(plain).toContain('Proposed');
      expect(plain).toContain('Status');
    });

    it('includes arrow separator', () => {
      const preview = createMockPreview();
      const result = formatPreviewTable(preview);
      const plain = stripAnsi(result);

      expect(plain).toContain('->');
    });
  });

  describe('entry display', () => {
    it('shows original and proposed names', () => {
      const preview = createMockPreview();
      const result = formatPreviewTable(preview, { showDiff: false });
      const plain = stripAnsi(result);

      expect(plain).toContain('IMG_001.jpg');
      expect(plain).toContain('2026-01-15_photo.jpg');
    });

    it('shows status labels', () => {
      const preview = createMockPreview();
      const result = formatPreviewTable(preview);
      const plain = stripAnsi(result);

      expect(plain).toContain('Ready');
      expect(plain).toContain('No Change');
    });
  });

  describe('summary display', () => {
    it('shows total file count', () => {
      const preview = createMockPreview();
      const result = formatPreviewTable(preview);
      const plain = stripAnsi(result);

      expect(plain).toContain('2 files');
    });

    it('shows ready count', () => {
      const preview = createMockPreview();
      const result = formatPreviewTable(preview);
      const plain = stripAnsi(result);

      expect(plain).toContain('1 ready');
    });

    it('shows unchanged count', () => {
      const preview = createMockPreview();
      const result = formatPreviewTable(preview);
      const plain = stripAnsi(result);

      expect(plain).toContain('1 unchanged');
    });

    it('shows conflicts when present', () => {
      const preview = createMockPreview({
        summary: {
          total: 2,
          ready: 0,
          conflicts: 2,
          issues: 0,
          unchanged: 0,
        },
      });
      const result = formatPreviewTable(preview);
      const plain = stripAnsi(result);

      expect(plain).toContain('2 conflicts');
    });

    it('shows issues when present', () => {
      const preview = createMockPreview({
        summary: {
          total: 2,
          ready: 0,
          conflicts: 0,
          issues: 2,
          unchanged: 0,
        },
      });
      const result = formatPreviewTable(preview);
      const plain = stripAnsi(result);

      expect(plain).toContain('2 issues');
    });

    it('hides counts that are zero', () => {
      const preview = createMockPreview({
        summary: {
          total: 1,
          ready: 1,
          conflicts: 0,
          issues: 0,
          unchanged: 0,
        },
      });
      const result = formatPreviewTable(preview);
      const plain = stripAnsi(result);

      expect(plain).not.toContain('conflict');
      expect(plain).not.toContain('issue');
      expect(plain).not.toContain('unchanged');
    });
  });

  describe('diff highlighting', () => {
    it('produces valid output when diff is available and showDiff is true', () => {
      const preview = createMockPreview();
      const result = formatPreviewTable(preview, { showDiff: true });
      const plain = stripAnsi(result);

      // Should contain the original and proposed names
      expect(plain).toContain('IMG_001.jpg');
      expect(plain).toContain('2026-01-15_photo.jpg');
    });

    it('produces valid output when showDiff is false', () => {
      const preview = createMockPreview();
      const result = formatPreviewTable(preview, { showDiff: false });
      const plain = stripAnsi(result);

      // Should still contain names when diff is disabled
      expect(plain).toContain('IMG_001.jpg');
      expect(plain).toContain('2026-01-15_photo.jpg');
    });

    it('handles long filenames with diff highlighting correctly', () => {
      // Test interaction between truncation and diff highlighting
      const preview: FormattedPreview = {
        entries: [
          {
            id: '1',
            original: {
              name: 'very_long_original_filename_that_exceeds_display.jpg',
              path: '/test/very_long_original_filename_that_exceeds_display.jpg',
              display: 'very_long_original_f....jpg', // Truncated
            },
            proposed: {
              name: '2026-01-15_very_long_renamed_file_also_exceeds.jpg',
              path: '/test/2026-01-15_very_long_renamed_file_also_exceeds.jpg',
              display: '2026-01-15_very_long....jpg', // Truncated
            },
            status: 'ready',
            statusLabel: 'Ready',
            isUnchanged: false,
            diff: {
              original: [
                { text: 'very_long_original_f', type: 'unchanged' },
                { text: 'ilename_that_exceeds_display', type: 'removed' },
                { text: '.jpg', type: 'unchanged' },
              ],
              proposed: [
                { text: '2026-01-15_', type: 'added' },
                { text: 'very_long_re', type: 'unchanged' },
                { text: 'named_file_also_exceeds', type: 'added' },
                { text: '.jpg', type: 'unchanged' },
              ],
            },
          },
        ],
        summary: {
          total: 1,
          ready: 1,
          conflicts: 0,
          issues: 0,
          unchanged: 0,
        },
      };

      // Should not throw and should produce valid output
      const result = formatPreviewTable(preview, { showDiff: true });
      const plain = stripAnsi(result);

      // Output should be valid table format
      expect(plain).toContain('Rename Preview');
      expect(plain).toContain('Ready');
      expect(plain).toContain('1 files');
    });

    it('handles entries with null diff gracefully', () => {
      const preview: FormattedPreview = {
        entries: [
          {
            id: '1',
            original: { name: 'a.jpg', path: '/a.jpg', display: 'a.jpg' },
            proposed: { name: 'b.jpg', path: '/b.jpg', display: 'b.jpg' },
            status: 'ready',
            statusLabel: 'Ready',
            isUnchanged: false,
            diff: null, // No diff computed
          },
        ],
        summary: {
          total: 1,
          ready: 1,
          conflicts: 0,
          issues: 0,
          unchanged: 0,
        },
      };

      const result = formatPreviewTable(preview, { showDiff: true });
      const plain = stripAnsi(result);

      // Should display names without crashing
      expect(plain).toContain('a.jpg');
      expect(plain).toContain('b.jpg');
    });
  });

  describe('status display', () => {
    it('displays all status labels correctly', () => {
      const preview: FormattedPreview = {
        entries: [
          {
            id: '1',
            original: { name: 'a.jpg', path: '/a.jpg', display: 'a.jpg' },
            proposed: { name: 'b.jpg', path: '/b.jpg', display: 'b.jpg' },
            status: 'ready',
            statusLabel: 'Ready',
            isUnchanged: false,
            diff: null,
          },
          {
            id: '2',
            original: { name: 'c.jpg', path: '/c.jpg', display: 'c.jpg' },
            proposed: { name: 'd.jpg', path: '/d.jpg', display: 'd.jpg' },
            status: 'conflict',
            statusLabel: 'Conflict',
            isUnchanged: false,
            diff: null,
          },
          {
            id: '3',
            original: { name: 'e.jpg', path: '/e.jpg', display: 'e.jpg' },
            proposed: { name: 'f.jpg', path: '/f.jpg', display: 'f.jpg' },
            status: 'missing-data',
            statusLabel: 'Missing Data',
            isUnchanged: false,
            diff: null,
          },
        ],
        summary: {
          total: 3,
          ready: 1,
          conflicts: 1,
          issues: 1,
          unchanged: 0,
        },
      };

      const result = formatPreviewTable(preview);
      const plain = stripAnsi(result);

      // All status labels should be displayed
      expect(plain).toContain('Ready');
      expect(plain).toContain('Conflict');
      expect(plain).toContain('Missing Data');
    });

    it('handles all five status types', () => {
      const preview: FormattedPreview = {
        entries: [
          {
            id: '1',
            original: { name: 'a.jpg', path: '/a.jpg', display: 'a.jpg' },
            proposed: { name: 'b.jpg', path: '/b.jpg', display: 'b.jpg' },
            status: 'ready',
            statusLabel: 'Ready',
            isUnchanged: false,
            diff: null,
          },
          {
            id: '2',
            original: { name: 'c.jpg', path: '/c.jpg', display: 'c.jpg' },
            proposed: { name: 'd.jpg', path: '/d.jpg', display: 'd.jpg' },
            status: 'conflict',
            statusLabel: 'Conflict',
            isUnchanged: false,
            diff: null,
          },
          {
            id: '3',
            original: { name: 'e.jpg', path: '/e.jpg', display: 'e.jpg' },
            proposed: { name: 'f.jpg', path: '/f.jpg', display: 'f.jpg' },
            status: 'missing-data',
            statusLabel: 'Missing Data',
            isUnchanged: false,
            diff: null,
          },
          {
            id: '4',
            original: { name: 'g.jpg', path: '/g.jpg', display: 'g.jpg' },
            proposed: { name: 'g.jpg', path: '/g.jpg', display: 'g.jpg' },
            status: 'no-change',
            statusLabel: 'No Change',
            isUnchanged: true,
            diff: null,
          },
          {
            id: '5',
            original: { name: 'h.jpg', path: '/h.jpg', display: 'h.jpg' },
            proposed: { name: 'CON.jpg', path: '/CON.jpg', display: 'CON.jpg' },
            status: 'invalid-name',
            statusLabel: 'Invalid Name',
            isUnchanged: false,
            diff: null,
          },
        ],
        summary: {
          total: 5,
          ready: 1,
          conflicts: 1,
          issues: 2,
          unchanged: 1,
        },
      };

      const result = formatPreviewTable(preview);
      const plain = stripAnsi(result);

      expect(plain).toContain('Ready');
      expect(plain).toContain('Conflict');
      expect(plain).toContain('Missing Data');
      expect(plain).toContain('No Change');
      expect(plain).toContain('Invalid Name');
    });
  });

  describe('options', () => {
    it('uses maxWidth to limit table width', () => {
      const preview = createMockPreview();
      const result = formatPreviewTable(preview, { maxWidth: 80 });
      const lines = stripAnsi(result).split('\n');

      // Header separator line should respect maxWidth
      const separatorLine = lines.find((line) => /^─+$/.test(line));
      expect(separatorLine?.length).toBeLessThanOrEqual(80);
    });

    it('defaults to reasonable maxWidth', () => {
      const preview = createMockPreview();
      const result = formatPreviewTable(preview);
      const lines = stripAnsi(result).split('\n');

      // Lines should not exceed default maxWidth (100)
      const separatorLine = lines.find((line) => /^─+$/.test(line));
      expect(separatorLine?.length).toBeLessThanOrEqual(100);
    });
  });

  describe('empty preview', () => {
    it('handles empty entries', () => {
      const preview: FormattedPreview = {
        entries: [],
        summary: {
          total: 0,
          ready: 0,
          conflicts: 0,
          issues: 0,
          unchanged: 0,
        },
      };

      const result = formatPreviewTable(preview);
      const plain = stripAnsi(result);

      expect(plain).toContain('Rename Preview');
      expect(plain).toContain('0 files');
    });
  });
});
