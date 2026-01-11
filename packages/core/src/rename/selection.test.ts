/**
 * Selection manager tests (Story 4.5)
 *
 * Tests for selective approval/rejection of rename proposals.
 *
 * @module rename/selection.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SelectionManager } from './selection.js';
import type { RenameProposal } from '../types/rename-proposal.js';

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Create a test proposal with minimal required fields.
 */
function createProposal(
  id: string,
  originalName: string,
  status: RenameProposal['status'] = 'ready'
): RenameProposal {
  return {
    id,
    originalPath: `/test/${originalName}`,
    originalName,
    proposedName: `new_${originalName}`,
    proposedPath: `/test/new_${originalName}`,
    status,
    issues: [],
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('SelectionManager', () => {
  let manager: SelectionManager;
  let proposals: RenameProposal[];

  beforeEach(() => {
    proposals = [
      createProposal('1', 'a.jpg', 'ready'),
      createProposal('2', 'b.jpg', 'ready'),
      createProposal('3', 'c.jpg', 'conflict'),
      createProposal('4', 'd.pdf', 'missing-data'),
      createProposal('5', 'e.doc', 'no-change'),
    ];
    manager = new SelectionManager(proposals);
  });

  // ===========================================================================
  // Constructor and Setup
  // ===========================================================================

  describe('constructor', () => {
    it('initializes with empty selection by default', () => {
      const state = manager.getState();
      expect(state.selectedCount).toBe(0);
      expect(state.totalCount).toBe(5);
    });

    it('creates empty manager without proposals', () => {
      const emptyManager = new SelectionManager();
      const state = emptyManager.getState();
      expect(state.selectedCount).toBe(0);
      expect(state.totalCount).toBe(0);
    });
  });

  describe('setProposals', () => {
    it('updates proposals and preserves valid selections', () => {
      manager.select('1');
      manager.select('2');

      // Simulate preview regeneration - same proposals
      manager.setProposals(proposals);

      expect(manager.isSelected('1')).toBe(true);
      expect(manager.isSelected('2')).toBe(true);
    });

    it('removes selections for deleted proposals', () => {
      manager.select('1');
      manager.select('5');

      // New proposals without ID 5
      const newProposals = proposals.filter((p) => p.id !== '5');
      manager.setProposals(newProposals);

      expect(manager.isSelected('1')).toBe(true);
      expect(manager.isSelected('5')).toBe(false);
      expect(manager.getState().totalCount).toBe(4);
    });
  });

  // ===========================================================================
  // Individual Operations (AC1, AC2)
  // ===========================================================================

  describe('individual operations', () => {
    it('selects individual files (AC2)', () => {
      manager.select('1');
      expect(manager.isSelected('1')).toBe(true);
      expect(manager.isSelected('2')).toBe(false);
    });

    it('deselects individual files (AC1)', () => {
      manager.select('1');
      manager.deselect('1');
      expect(manager.isSelected('1')).toBe(false);
    });

    it('toggles selection', () => {
      manager.toggle('1');
      expect(manager.isSelected('1')).toBe(true);

      manager.toggle('1');
      expect(manager.isSelected('1')).toBe(false);
    });

    it('ignores selection of non-existent proposals', () => {
      manager.select('nonexistent');
      expect(manager.getState().selectedCount).toBe(0);
    });

    it('ignores toggle of non-existent proposals', () => {
      manager.toggle('nonexistent');
      expect(manager.getState().selectedCount).toBe(0);
    });

    it('allows deselection of non-selected items (no-op)', () => {
      manager.deselect('1'); // Was never selected
      expect(manager.isSelected('1')).toBe(false);
    });
  });

  // ===========================================================================
  // Bulk Operations (AC3)
  // ===========================================================================

  describe('bulk operations', () => {
    it('selectAll selects all proposals', () => {
      manager.selectAll();

      expect(manager.getState().selectedCount).toBe(5);
      expect(manager.isSelected('1')).toBe(true);
      expect(manager.isSelected('5')).toBe(true);
    });

    it('selectNone clears all selections', () => {
      manager.selectAll();
      manager.selectNone();

      expect(manager.getState().selectedCount).toBe(0);
    });

    it('invertSelection toggles all items', () => {
      manager.select('1');
      manager.select('2');

      manager.invertSelection();

      expect(manager.isSelected('1')).toBe(false);
      expect(manager.isSelected('2')).toBe(false);
      expect(manager.isSelected('3')).toBe(true);
      expect(manager.isSelected('4')).toBe(true);
      expect(manager.isSelected('5')).toBe(true);
    });

    it('selectByStatus selects only matching status', () => {
      manager.selectByStatus('ready');

      expect(manager.isSelected('1')).toBe(true);
      expect(manager.isSelected('2')).toBe(true);
      expect(manager.isSelected('3')).toBe(false); // conflict
      expect(manager.isSelected('4')).toBe(false); // missing-data
    });

    it('deselectByStatus removes only matching status', () => {
      manager.selectAll();
      manager.deselectByStatus('conflict');

      expect(manager.isSelected('1')).toBe(true);
      expect(manager.isSelected('2')).toBe(true);
      expect(manager.isSelected('3')).toBe(false); // conflict - deselected
    });

    it('selectWhere applies custom predicate', () => {
      manager.selectWhere((p) => p.originalName.endsWith('.jpg'));

      expect(manager.isSelected('1')).toBe(true); // a.jpg
      expect(manager.isSelected('2')).toBe(true); // b.jpg
      expect(manager.isSelected('3')).toBe(true); // c.jpg
      expect(manager.isSelected('4')).toBe(false); // d.pdf
    });

    it('selectByStatus adds to existing selection', () => {
      manager.select('4'); // missing-data
      manager.selectByStatus('ready');

      expect(manager.isSelected('1')).toBe(true);
      expect(manager.isSelected('4')).toBe(true); // Still selected
    });

    it('deselectWhere removes matching proposals', () => {
      manager.selectAll();
      manager.deselectWhere((p) => p.originalName.endsWith('.jpg'));

      expect(manager.isSelected('1')).toBe(false); // a.jpg - deselected
      expect(manager.isSelected('2')).toBe(false); // b.jpg - deselected
      expect(manager.isSelected('3')).toBe(false); // c.jpg - deselected
      expect(manager.isSelected('4')).toBe(true); // d.pdf - still selected
      expect(manager.isSelected('5')).toBe(true); // e.doc - still selected
    });
  });

  // ===========================================================================
  // Query Operations
  // ===========================================================================

  describe('query operations', () => {
    it('getState returns correct counts', () => {
      manager.select('1');
      manager.select('3'); // conflict

      const state = manager.getState();

      expect(state.totalCount).toBe(5);
      expect(state.selectedCount).toBe(2);
      expect(state.readySelectedCount).toBe(1); // Only '1' is ready
    });

    it('getState returns copy of selectedIds', () => {
      manager.select('1');
      const state = manager.getState();

      // Mutating returned set shouldn't affect manager
      state.selectedIds.add('999');

      expect(manager.isSelected('999')).toBe(false);
    });

    it('getSummary returns detailed breakdown', () => {
      manager.selectAll();
      const summary = manager.getSummary();

      expect(summary.total).toBe(5);
      expect(summary.selected).toBe(5);
      expect(summary.selectedReady).toBe(2);
      expect(summary.selectedConflicts).toBe(1);
      expect(summary.selectedMissingData).toBe(1);
      expect(summary.selectedNoChange).toBe(1);
      expect(summary.selectedInvalidName).toBe(0);
    });

    it('getSummary counts invalid-name status', () => {
      const proposalsWithInvalid = [
        ...proposals,
        createProposal('6', 'f.txt', 'invalid-name'),
      ];
      manager.setProposals(proposalsWithInvalid);
      manager.selectAll();
      const summary = manager.getSummary();

      expect(summary.selectedInvalidName).toBe(1);
    });

    it('getSelectedProposals returns only selected', () => {
      manager.select('1');
      manager.select('3');

      const selected = manager.getSelectedProposals();

      expect(selected).toHaveLength(2);
      expect(selected.map((p) => p.id)).toEqual(['1', '3']);
    });

    it('getExecutableProposals returns only ready + selected', () => {
      manager.selectAll();

      const executable = manager.getExecutableProposals();

      expect(executable).toHaveLength(2);
      expect(executable.every((p) => p.status === 'ready')).toBe(true);
    });
  });

  // ===========================================================================
  // Persistence (AC4)
  // ===========================================================================

  describe('persistence', () => {
    it('getSelectionSnapshot returns paths', () => {
      manager.select('1');
      manager.select('2');

      const snapshot = manager.getSelectionSnapshot();

      expect(snapshot.paths).toContain('/test/a.jpg');
      expect(snapshot.paths).toContain('/test/b.jpg');
      expect(snapshot.paths).toHaveLength(2);
    });

    it('restoreFromSnapshot restores selections by path', () => {
      manager.select('1');
      manager.select('2');

      const snapshot = manager.getSelectionSnapshot();

      // Clear and restore
      manager.selectNone();
      manager.restoreFromSnapshot(snapshot);

      expect(manager.isSelected('1')).toBe(true);
      expect(manager.isSelected('2')).toBe(true);
      expect(manager.isSelected('3')).toBe(false);
    });

    it('restoreFromSnapshot handles missing paths gracefully', () => {
      const snapshot = { paths: ['/test/a.jpg', '/nonexistent/file.txt'] };

      manager.restoreFromSnapshot(snapshot);

      expect(manager.isSelected('1')).toBe(true);
      expect(manager.getState().selectedCount).toBe(1);
    });

    it('preserves selections when proposals change IDs but paths stay same', () => {
      manager.select('1');

      // Simulate regeneration with new IDs but same paths
      const newProposals = proposals.map((p, i) => ({
        ...p,
        id: `new-${i + 1}`,
      }));

      const snapshot = manager.getSelectionSnapshot();
      manager.setProposals(newProposals);
      manager.restoreFromSnapshot(snapshot);

      // Should find by path, not ID
      expect(manager.isSelected('new-1')).toBe(true);
    });
  });

  // ===========================================================================
  // Edge Cases
  // ===========================================================================

  describe('edge cases', () => {
    it('handles empty proposals array', () => {
      manager.setProposals([]);

      expect(manager.getState().totalCount).toBe(0);
      manager.selectAll();
      expect(manager.getState().selectedCount).toBe(0);
    });

    it('handles rapid selection/deselection', () => {
      for (let i = 0; i < 100; i++) {
        manager.toggle('1');
      }
      // Even number of toggles = back to original (unselected)
      expect(manager.isSelected('1')).toBe(false);
    });

    it('invertSelection on empty selection selects all', () => {
      manager.invertSelection();

      expect(manager.getState().selectedCount).toBe(5);
    });

    it('invertSelection on full selection selects none', () => {
      manager.selectAll();
      manager.invertSelection();

      expect(manager.getState().selectedCount).toBe(0);
    });

    it('handles duplicate paths - last proposal wins for path mapping', () => {
      // Two proposals with same path but different IDs
      const duplicatePathProposals: RenameProposal[] = [
        {
          id: 'first',
          originalPath: '/same/path.jpg',
          originalName: 'path.jpg',
          proposedName: 'new_path.jpg',
          proposedPath: '/same/new_path.jpg',
          status: 'ready',
          issues: [],
        },
        {
          id: 'second',
          originalPath: '/same/path.jpg', // Same path
          originalName: 'path.jpg',
          proposedName: 'other_path.jpg',
          proposedPath: '/same/other_path.jpg',
          status: 'ready',
          issues: [],
        },
      ];

      manager.setProposals(duplicatePathProposals);

      // Both proposals exist by ID
      expect(manager.getState().totalCount).toBe(2);

      // Path maps to second (last) proposal
      manager.restoreFromSnapshot({ paths: ['/same/path.jpg'] });
      expect(manager.isSelected('second')).toBe(true);
      expect(manager.isSelected('first')).toBe(false);
    });

    it('handles duplicate IDs - last proposal wins', () => {
      const duplicateIdProposals: RenameProposal[] = [
        {
          id: 'same-id',
          originalPath: '/first.jpg',
          originalName: 'first.jpg',
          proposedName: 'new_first.jpg',
          proposedPath: '/new_first.jpg',
          status: 'ready',
          issues: [],
        },
        {
          id: 'same-id', // Same ID
          originalPath: '/second.jpg',
          originalName: 'second.jpg',
          proposedName: 'new_second.jpg',
          proposedPath: '/new_second.jpg',
          status: 'conflict',
          issues: [],
        },
      ];

      manager.setProposals(duplicateIdProposals);

      // Only one proposal exists (second overwrites first)
      expect(manager.getState().totalCount).toBe(1);

      // The proposal has the second's data
      manager.select('same-id');
      const selected = manager.getSelectedProposals();
      expect(selected[0].originalPath).toBe('/second.jpg');
      expect(selected[0].status).toBe('conflict');
    });
  });

  // ===========================================================================
  // Integration with executeBatchRename
  // ===========================================================================

  describe('integration', () => {
    it('getExecutableProposals excludes no-change status', () => {
      manager.selectAll();

      const executable = manager.getExecutableProposals();

      expect(executable.find((p) => p.status === 'no-change')).toBeUndefined();
    });

    it('getExecutableProposals returns empty when none selected', () => {
      const executable = manager.getExecutableProposals();

      expect(executable).toHaveLength(0);
    });

    it('provides correct input for executeBatchRename', () => {
      manager.selectByStatus('ready');

      const toRename = manager.getExecutableProposals();

      expect(toRename).toHaveLength(2);
      expect(toRename.every((p) => p.status === 'ready')).toBe(true);
    });
  });
});
