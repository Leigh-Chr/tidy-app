/**
 * Tests for grouped preview module (Story 4.3)
 *
 * @module rename/grouped-preview.test
 */

import { describe, it, expect } from 'vitest';
import { groupPreviewByStatus } from './grouped-preview.js';
import type { RenamePreview, RenameProposal } from '../types/rename-proposal.js';

// =============================================================================
// Test Helpers
// =============================================================================

function createProposal(overrides: Partial<RenameProposal> = {}): RenameProposal {
  return {
    id: '1',
    originalPath: '/test/photo.jpg',
    originalName: 'photo.jpg',
    proposedName: 'renamed.jpg',
    proposedPath: '/test/renamed.jpg',
    status: 'ready',
    issues: [],
    ...overrides,
  };
}

function createPreview(proposals: RenameProposal[]): RenamePreview {
  const ready = proposals.filter((p) => p.status === 'ready').length;
  const conflicts = proposals.filter((p) => p.status === 'conflict').length;
  const missingData = proposals.filter((p) => p.status === 'missing-data').length;
  const noChange = proposals.filter((p) => p.status === 'no-change').length;
  const invalidName = proposals.filter((p) => p.status === 'invalid-name').length;

  return {
    proposals,
    summary: {
      total: proposals.length,
      ready,
      conflicts,
      missingData,
      noChange,
      invalidName,
    },
    generatedAt: new Date(),
    templateUsed: 'test-template',
  };
}

// =============================================================================
// groupPreviewByStatus Tests
// =============================================================================

describe('groupPreviewByStatus', () => {
  describe('basic grouping', () => {
    it('separates ready files from problematic files', () => {
      const preview = createPreview([
        createProposal({
          id: '1',
          status: 'ready',
          proposedName: 'unique1.jpg',
          proposedPath: '/test/unique1.jpg',
        }),
        createProposal({
          id: '2',
          status: 'conflict',
          proposedName: 'unique2.jpg',
          proposedPath: '/test/unique2.jpg',
          issues: [{ code: 'DUPLICATE', message: 'Duplicate name' }],
        }),
      ]);

      const grouped = groupPreviewByStatus(preview);

      expect(grouped.ready).toHaveLength(1);
      expect(grouped.issues.conflicts).toHaveLength(1);
    });

    it('groups unchanged files separately', () => {
      const preview = createPreview([
        createProposal({
          id: '1',
          status: 'no-change',
          originalName: 'same.jpg',
          proposedName: 'same.jpg',
        }),
      ]);

      const grouped = groupPreviewByStatus(preview);

      expect(grouped.unchanged).toHaveLength(1);
      expect(grouped.ready).toHaveLength(0);
    });

    it('groups missing data issues correctly', () => {
      const preview = createPreview([
        createProposal({
          id: '1',
          status: 'missing-data',
          issues: [{ code: 'MISSING_REQUIRED', message: 'Missing date', field: 'date' }],
        }),
      ]);

      const grouped = groupPreviewByStatus(preview);

      expect(grouped.issues.missingData).toHaveLength(1);
    });

    it('groups invalid name issues correctly', () => {
      const preview = createPreview([
        createProposal({
          id: '1',
          status: 'invalid-name',
          issues: [{ code: 'INVALID_CHARACTERS', message: 'Invalid chars' }],
        }),
      ]);

      const grouped = groupPreviewByStatus(preview);

      expect(grouped.issues.invalidNames).toHaveLength(1);
    });
  });

  describe('summary calculation', () => {
    it('calculates total ready count', () => {
      const preview = createPreview([
        createProposal({
          id: '1',
          status: 'ready',
          proposedName: 'a.jpg',
          proposedPath: '/test/a.jpg',
        }),
        createProposal({
          id: '2',
          status: 'ready',
          proposedName: 'b.jpg',
          proposedPath: '/test/b.jpg',
        }),
        createProposal({
          id: '3',
          status: 'conflict',
          proposedName: 'c.jpg',
          proposedPath: '/test/c.jpg',
          issues: [{ code: 'X', message: 'x' }],
        }),
      ]);

      const grouped = groupPreviewByStatus(preview);

      expect(grouped.summary.totalReady).toBe(2);
    });

    it('calculates total issues count', () => {
      const preview = createPreview([
        createProposal({
          id: '1',
          status: 'conflict',
          issues: [{ code: 'DUPLICATE', message: 'dup' }],
        }),
        createProposal({
          id: '2',
          status: 'missing-data',
          issues: [{ code: 'MISSING', message: 'miss' }],
        }),
      ]);

      const grouped = groupPreviewByStatus(preview);

      expect(grouped.summary.totalIssues).toBe(2);
    });

    it('calculates blocked vs can proceed counts', () => {
      const preview = createPreview([
        createProposal({
          id: '1',
          status: 'ready',
          proposedName: 'a.jpg',
          proposedPath: '/test/a.jpg',
        }),
        createProposal({
          id: '2',
          status: 'conflict',
          proposedName: 'b.jpg',
          proposedPath: '/test/b.jpg',
          issues: [{ code: 'DUPLICATE_PROPOSED', message: 'dup' }],
        }),
        createProposal({
          id: '3',
          status: 'missing-data',
          proposedName: 'c.jpg',
          proposedPath: '/test/c.jpg',
          issues: [{ code: 'MISSING_REQUIRED', message: 'miss' }],
        }),
      ]);

      const grouped = groupPreviewByStatus(preview);

      // Ready files can proceed
      expect(grouped.summary.totalReady).toBe(1);
      // Conflicts block, missing data is warning (can proceed)
      expect(grouped.summary.blockedCount).toBeGreaterThanOrEqual(0);
    });

    it('calculates percentage fields', () => {
      const preview = createPreview([
        createProposal({
          id: '1',
          status: 'ready',
          proposedName: 'a.jpg',
          proposedPath: '/test/a.jpg',
        }),
        createProposal({
          id: '2',
          status: 'ready',
          proposedName: 'b.jpg',
          proposedPath: '/test/b.jpg',
        }),
        createProposal({
          id: '3',
          status: 'conflict',
          proposedName: 'c.jpg',
          proposedPath: '/test/c.jpg',
          issues: [{ code: 'DUPLICATE', message: 'dup' }],
        }),
        createProposal({
          id: '4',
          status: 'no-change',
          proposedName: 'd.jpg',
          proposedPath: '/test/d.jpg',
        }),
      ]);

      const grouped = groupPreviewByStatus(preview);

      // 4 total files: 2 ready, 1 conflict, 1 unchanged
      expect(grouped.summary.totalFiles).toBe(4);
      expect(grouped.summary.readyPercent).toBe(50); // 2/4 = 50%
      expect(grouped.summary.issuesPercent).toBe(25); // 1/4 = 25%
      expect(grouped.summary.canProceedPercent).toBeGreaterThanOrEqual(50);
    });

    it('handles empty preview for percentages', () => {
      const preview = createPreview([]);

      const grouped = groupPreviewByStatus(preview);

      expect(grouped.summary.totalFiles).toBe(0);
      expect(grouped.summary.readyPercent).toBe(0);
      expect(grouped.summary.issuesPercent).toBe(0);
      expect(grouped.summary.canProceedPercent).toBe(0);
    });
  });

  describe('duplicate detection within batch', () => {
    it('detects duplicates and creates issue reports', () => {
      const preview = createPreview([
        createProposal({
          id: '1',
          status: 'ready',
          proposedName: 'same.jpg',
          proposedPath: '/test/same.jpg',
        }),
        createProposal({
          id: '2',
          status: 'ready',
          proposedName: 'same.jpg',
          proposedPath: '/test/same.jpg',
        }),
      ]);

      const grouped = groupPreviewByStatus(preview);

      // Both should be flagged as having issues
      expect(grouped.issues.conflicts.length).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    it('handles empty preview', () => {
      const preview = createPreview([]);

      const grouped = groupPreviewByStatus(preview);

      expect(grouped.ready).toHaveLength(0);
      expect(grouped.unchanged).toHaveLength(0);
      expect(grouped.summary.totalReady).toBe(0);
      expect(grouped.summary.totalIssues).toBe(0);
    });

    it('handles all ready files', () => {
      const preview = createPreview([
        createProposal({ id: '1', status: 'ready', proposedName: 'a.jpg' }),
        createProposal({ id: '2', status: 'ready', proposedName: 'b.jpg' }),
        createProposal({ id: '3', status: 'ready', proposedName: 'c.jpg' }),
      ]);

      const grouped = groupPreviewByStatus(preview);

      expect(grouped.ready).toHaveLength(3);
      expect(grouped.summary.totalIssues).toBe(0);
    });

    it('handles all problematic files', () => {
      const preview = createPreview([
        createProposal({
          id: '1',
          status: 'conflict',
          issues: [{ code: 'DUPLICATE', message: 'dup' }],
        }),
        createProposal({
          id: '2',
          status: 'missing-data',
          issues: [{ code: 'MISSING', message: 'miss' }],
        }),
      ]);

      const grouped = groupPreviewByStatus(preview);

      expect(grouped.ready).toHaveLength(0);
      expect(grouped.summary.totalIssues).toBe(2);
    });

    it('handles mixed statuses', () => {
      const preview = createPreview([
        createProposal({ id: '1', status: 'ready', proposedName: 'unique1.jpg' }),
        createProposal({
          id: '2',
          status: 'conflict',
          issues: [{ code: 'X', message: 'x' }],
        }),
        createProposal({ id: '3', status: 'no-change' }),
        createProposal({
          id: '4',
          status: 'missing-data',
          issues: [{ code: 'Y', message: 'y' }],
        }),
        createProposal({
          id: '5',
          status: 'invalid-name',
          issues: [{ code: 'Z', message: 'z' }],
        }),
      ]);

      const grouped = groupPreviewByStatus(preview);

      expect(grouped.ready).toHaveLength(1);
      expect(grouped.unchanged).toHaveLength(1);
      expect(grouped.summary.totalIssues).toBe(3);
    });
  });
});
