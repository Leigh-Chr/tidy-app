/**
 * Selection manager module (Story 4.5)
 *
 * Manages selective approval/rejection of rename proposals.
 *
 * @module rename/selection
 */

import type { RenameProposal, RenameStatusType } from '../types/rename-proposal.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Current selection state snapshot.
 */
export interface SelectionState {
  /** Set of selected proposal IDs (copy for immutability) */
  selectedIds: Set<string>;
  /** Total number of proposals */
  totalCount: number;
  /** Number of selected proposals */
  selectedCount: number;
  /** Number of selected proposals with 'ready' status */
  readySelectedCount: number;
}

/**
 * Detailed summary of selection by status.
 */
export interface SelectionSummary {
  /** Total number of proposals */
  total: number;
  /** Number of selected proposals */
  selected: number;
  /** Selected proposals with 'ready' status */
  selectedReady: number;
  /** Selected proposals with 'conflict' status */
  selectedConflicts: number;
  /** Selected proposals with 'missing-data' status */
  selectedMissingData: number;
  /** Selected proposals with 'no-change' status */
  selectedNoChange: number;
  /** Selected proposals with 'invalid-name' status */
  selectedInvalidName: number;
}

/**
 * Predicate function for custom selection filtering.
 */
export type SelectionPredicate = (proposal: RenameProposal) => boolean;

// =============================================================================
// SelectionManager
// =============================================================================

/**
 * Manages selection state for rename proposals.
 *
 * Features:
 * - Individual select/deselect/toggle (AC1, AC2)
 * - Bulk operations: selectAll, selectNone, invertSelection (AC3)
 * - Selection by status or custom predicate
 * - Persistence via snapshots (AC4)
 *
 * @example
 * ```typescript
 * const manager = new SelectionManager(proposals);
 *
 * // Select only ready files
 * manager.selectByStatus('ready');
 *
 * // Deselect specific file
 * manager.deselect('proposal-123');
 *
 * // Get files to rename
 * const toRename = manager.getExecutableProposals();
 * ```
 */
export class SelectionManager {
  /** Set of selected proposal IDs */
  private selected: Set<string> = new Set();

  /** Map of proposal ID to proposal */
  private proposals: Map<string, RenameProposal> = new Map();

  /** Map of original path to proposal ID for persistence */
  private pathToId: Map<string, string> = new Map();

  /**
   * Create a new SelectionManager.
   *
   * @param proposals - Initial proposals (optional)
   */
  constructor(proposals?: RenameProposal[]) {
    if (proposals) {
      this.setProposals(proposals);
    }
  }

  // ===========================================================================
  // Setup
  // ===========================================================================

  /**
   * Set or update proposals.
   *
   * Preserves selections for proposals that still exist (by ID).
   *
   * @param proposals - New proposal list
   */
  setProposals(proposals: RenameProposal[]): void {
    this.proposals.clear();
    this.pathToId.clear();

    for (const proposal of proposals) {
      this.proposals.set(proposal.id, proposal);
      this.pathToId.set(proposal.originalPath, proposal.id);
    }

    // Clean up selections for removed proposals
    for (const id of this.selected) {
      if (!this.proposals.has(id)) {
        this.selected.delete(id);
      }
    }
  }

  // ===========================================================================
  // Individual Operations (AC1, AC2)
  // ===========================================================================

  /**
   * Select a proposal by ID.
   *
   * @param id - Proposal ID to select
   */
  select(id: string): void {
    if (this.proposals.has(id)) {
      this.selected.add(id);
    }
  }

  /**
   * Deselect a proposal by ID.
   *
   * @param id - Proposal ID to deselect
   */
  deselect(id: string): void {
    this.selected.delete(id);
  }

  /**
   * Toggle selection state of a proposal.
   *
   * @param id - Proposal ID to toggle
   */
  toggle(id: string): void {
    if (this.selected.has(id)) {
      this.selected.delete(id);
    } else if (this.proposals.has(id)) {
      this.selected.add(id);
    }
  }

  /**
   * Check if a proposal is selected.
   *
   * @param id - Proposal ID to check
   * @returns True if selected
   */
  isSelected(id: string): boolean {
    return this.selected.has(id);
  }

  // ===========================================================================
  // Bulk Operations (AC3)
  // ===========================================================================

  /**
   * Select all proposals.
   */
  selectAll(): void {
    for (const id of this.proposals.keys()) {
      this.selected.add(id);
    }
  }

  /**
   * Clear all selections.
   */
  selectNone(): void {
    this.selected.clear();
  }

  /**
   * Invert selection - selected becomes unselected and vice versa.
   */
  invertSelection(): void {
    const newSelected = new Set<string>();
    for (const id of this.proposals.keys()) {
      if (!this.selected.has(id)) {
        newSelected.add(id);
      }
    }
    this.selected = newSelected;
  }

  /**
   * Select all proposals with a specific status.
   *
   * Note: Adds to existing selection, does not replace.
   *
   * @param status - Status to match
   */
  selectByStatus(status: RenameStatusType): void {
    for (const [id, proposal] of this.proposals) {
      if (proposal.status === status) {
        this.selected.add(id);
      }
    }
  }

  /**
   * Deselect all proposals with a specific status.
   *
   * @param status - Status to match
   */
  deselectByStatus(status: RenameStatusType): void {
    for (const [id, proposal] of this.proposals) {
      if (proposal.status === status) {
        this.selected.delete(id);
      }
    }
  }

  /**
   * Select proposals matching a custom predicate.
   *
   * Note: Adds to existing selection, does not replace.
   *
   * @param predicate - Function returning true for proposals to select
   */
  selectWhere(predicate: SelectionPredicate): void {
    for (const [id, proposal] of this.proposals) {
      if (predicate(proposal)) {
        this.selected.add(id);
      }
    }
  }

  /**
   * Deselect proposals matching a custom predicate.
   *
   * @param predicate - Function returning true for proposals to deselect
   */
  deselectWhere(predicate: SelectionPredicate): void {
    for (const [id, proposal] of this.proposals) {
      if (predicate(proposal)) {
        this.selected.delete(id);
      }
    }
  }

  // ===========================================================================
  // Query Operations
  // ===========================================================================

  /**
   * Get current selection state.
   *
   * Returns a snapshot copy - mutations won't affect manager.
   * Internally uses getSummary() to avoid duplicate iteration.
   *
   * @returns Selection state
   */
  getState(): SelectionState {
    const summary = this.getSummary();

    return {
      selectedIds: new Set(this.selected),
      totalCount: summary.total,
      selectedCount: summary.selected,
      readySelectedCount: summary.selectedReady,
    };
  }

  /**
   * Get detailed summary of selection by status.
   *
   * @returns Selection summary
   */
  getSummary(): SelectionSummary {
    const summary: SelectionSummary = {
      total: this.proposals.size,
      selected: this.selected.size,
      selectedReady: 0,
      selectedConflicts: 0,
      selectedMissingData: 0,
      selectedNoChange: 0,
      selectedInvalidName: 0,
    };

    for (const id of this.selected) {
      const proposal = this.proposals.get(id);
      if (!proposal) continue;

      switch (proposal.status) {
        case 'ready':
          summary.selectedReady++;
          break;
        case 'conflict':
          summary.selectedConflicts++;
          break;
        case 'missing-data':
          summary.selectedMissingData++;
          break;
        case 'no-change':
          summary.selectedNoChange++;
          break;
        case 'invalid-name':
          summary.selectedInvalidName++;
          break;
      }
    }

    return summary;
  }

  /**
   * Get all selected proposals.
   *
   * @returns Array of selected proposals (any status)
   */
  getSelectedProposals(): RenameProposal[] {
    return Array.from(this.selected)
      .map((id) => this.proposals.get(id))
      .filter((p): p is RenameProposal => p !== undefined);
  }

  /**
   * Get only selected proposals that are ready for execution.
   *
   * Use this to get the list for executeBatchRename.
   *
   * @returns Array of selected proposals with 'ready' status
   */
  getExecutableProposals(): RenameProposal[] {
    return this.getSelectedProposals().filter((p) => p.status === 'ready');
  }

  // ===========================================================================
  // Persistence (AC4)
  // ===========================================================================

  /**
   * Create a snapshot of current selections by file path.
   *
   * Use this before regenerating previews to preserve selections.
   *
   * @returns Snapshot object with paths array
   */
  getSelectionSnapshot(): { paths: string[] } {
    const paths = Array.from(this.selected)
      .map((id) => this.proposals.get(id)?.originalPath)
      .filter((p): p is string => p !== undefined);

    return { paths };
  }

  /**
   * Restore selections from a snapshot.
   *
   * Matches by file path, so works even if proposal IDs changed
   * (e.g., after preview regeneration).
   *
   * @param snapshot - Snapshot created by getSelectionSnapshot
   */
  restoreFromSnapshot(snapshot: { paths: string[] }): void {
    this.selected.clear();
    for (const path of snapshot.paths) {
      const id = this.pathToId.get(path);
      if (id) {
        this.selected.add(id);
      }
    }
  }
}
