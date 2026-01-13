/**
 * Preview Table Component
 *
 * Displays rename proposals in a virtualized, grouped table.
 * Shows original -> proposed name with status indicators and selection checkboxes.
 *
 * Story 6.4 - AC1: Preview Table Display, AC2: Status Indicators, AC4: Visual Comparison
 */

import { useMemo, useState, useCallback } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { AiSuggestion, RenamePreview, RenameProposal, RenameStatus } from "@/lib/tauri";
import { cn } from "@/lib/utils";
import { PreviewRow } from "./PreviewRow";

export interface PreviewTableProps {
  /** The rename preview data */
  preview: RenamePreview;
  /** Set of selected proposal IDs */
  selectedIds: Set<string>;
  /** Callback when a proposal is toggled */
  onToggleSelection: (proposalId: string) => void;
  /** Callback for range selection (shift+click) */
  onSelectRange?: (proposalIds: string[], addToSelection: boolean) => void;
  /** Collapsed status groups */
  collapsedGroups?: Set<RenameStatus>;
  /** Callback when a group is toggled */
  onToggleGroup?: (status: RenameStatus) => void;
  /** AI suggestions by file path */
  aiSuggestions?: Map<string, AiSuggestion>;
}

/** Status group configuration for display order and styling */
const STATUS_CONFIG: Record<RenameStatus, { label: string; className: string; order: number }> = {
  ready: { label: "Ready to Rename", className: "bg-green-50 dark:bg-green-950/50 border-green-200 dark:border-green-800", order: 0 },
  conflict: { label: "Conflicts", className: "bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-800", order: 1 },
  "missing-data": { label: "Missing Data", className: "bg-yellow-50 dark:bg-yellow-950/50 border-yellow-200 dark:border-yellow-800", order: 2 },
  "invalid-name": { label: "Invalid Name", className: "bg-orange-50 dark:bg-orange-950/50 border-orange-200 dark:border-orange-800", order: 3 },
  "no-change": { label: "No Change", className: "bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700", order: 4 },
};

type GroupedItem =
  | { type: "header"; status: RenameStatus; count: number }
  | { type: "row"; proposal: RenameProposal };

export function PreviewTable({
  preview,
  selectedIds,
  onToggleSelection,
  onSelectRange,
  collapsedGroups = new Set(),
  onToggleGroup,
  aiSuggestions,
}: PreviewTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null);

  const toggleRowExpansion = useCallback((proposalId: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(proposalId)) {
        next.delete(proposalId);
      } else {
        next.add(proposalId);
      }
      return next;
    });
  }, []);

  // Group proposals by status
  const groupedProposals = useMemo(() => {
    const groups = new Map<RenameStatus, RenameProposal[]>();

    // Initialize all groups
    for (const status of Object.keys(STATUS_CONFIG) as RenameStatus[]) {
      groups.set(status, []);
    }

    // Sort proposals into groups
    for (const proposal of preview.proposals) {
      const group = groups.get(proposal.status);
      if (group) {
        group.push(proposal);
      }
    }

    return groups;
  }, [preview.proposals]);

  // Create flattened list with headers for virtualization
  const flattenedItems = useMemo((): GroupedItem[] => {
    const items: GroupedItem[] = [];
    const sortedStatuses = (Object.keys(STATUS_CONFIG) as RenameStatus[]).sort(
      (a, b) => STATUS_CONFIG[a].order - STATUS_CONFIG[b].order
    );

    for (const status of sortedStatuses) {
      const proposals = groupedProposals.get(status) || [];
      if (proposals.length === 0) continue;

      // Add header
      items.push({ type: "header", status, count: proposals.length });

      // Add rows if not collapsed
      if (!collapsedGroups.has(status)) {
        for (const proposal of proposals) {
          items.push({ type: "row", proposal });
        }
      }
    }

    return items;
  }, [groupedProposals, collapsedGroups]);

  // Handle selection with shift+click for range selection
  const handleSelection = useCallback(
    (proposalId: string, index: number, event: React.MouseEvent) => {
      if (event.shiftKey && lastClickedIndex !== null && onSelectRange) {
        // Shift+click: select range
        const start = Math.min(lastClickedIndex, index);
        const end = Math.max(lastClickedIndex, index);

        // Get all row items in the range
        const idsInRange: string[] = [];
        for (let i = start; i <= end; i++) {
          const item = flattenedItems[i];
          if (item.type === "row") {
            idsInRange.push(item.proposal.id);
          }
        }

        // Add to selection (keep ctrl for toggle behavior)
        onSelectRange(idsInRange, event.ctrlKey || event.metaKey);
      } else {
        // Normal click: toggle single selection
        onToggleSelection(proposalId);
        setLastClickedIndex(index);
      }
    },
    [flattenedItems, lastClickedIndex, onSelectRange, onToggleSelection]
  );

  if (preview.proposals.length === 0) {
    return (
      <div
        className="flex items-center justify-center h-64 text-muted-foreground"
        data-testid="preview-table-empty"
      >
        No files to preview
      </div>
    );
  }

  return (
    <div className="flex flex-col" data-testid="preview-table">
      {/* Table Header */}
      <div className="flex items-center border-b bg-muted/50 px-4 py-2 text-sm font-medium text-muted-foreground">
        <div className="w-10" /> {/* Checkbox column */}
        <div className="flex-1">Original Name</div>
        <div className="w-8 text-center">&rarr;</div>
        <div className="flex-1">Proposed Name</div>
        <div className="w-24 text-center">Status</div>
      </div>

      {/* File List */}
      <div data-testid="preview-table-list">
        {flattenedItems.map((item, index) => {
          if (item.type === "header") {
            const config = STATUS_CONFIG[item.status];
            const isCollapsed = collapsedGroups.has(item.status);

            return (
              <div
                key={`header-${item.status}`}
                role="button"
                tabIndex={0}
                aria-expanded={!isCollapsed}
                aria-live="polite"
                aria-label={`${config.label} group, ${item.count} items. ${isCollapsed ? "Click to expand" : "Click to collapse"}`}
                className={cn(
                  "flex items-center px-4 py-2 border-y cursor-pointer hover:bg-muted/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  config.className
                )}
                onClick={() => onToggleGroup?.(item.status)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onToggleGroup?.(item.status);
                  }
                }}
                data-testid={`preview-group-${item.status}`}
              >
                {isCollapsed ? (
                  <ChevronRight className="h-4 w-4 mr-2 text-muted-foreground" aria-hidden="true" />
                ) : (
                  <ChevronDown className="h-4 w-4 mr-2 text-muted-foreground" aria-hidden="true" />
                )}
                <span className="font-medium">{config.label}</span>
                <span className="ml-2 text-muted-foreground">({item.count})</span>
              </div>
            );
          }

          // Get AI suggestion for this file (from map or from proposal itself)
          const aiSuggestion = item.proposal.aiSuggestion ?? aiSuggestions?.get(item.proposal.originalPath);
          const isRowExpanded = expandedRows.has(item.proposal.id);

          return (
            <PreviewRow
              key={item.proposal.id}
              proposal={item.proposal}
              isSelected={selectedIds.has(item.proposal.id)}
              onToggleSelection={() => onToggleSelection(item.proposal.id)}
              onSelectionClick={(event) => handleSelection(item.proposal.id, index, event)}
              aiSuggestion={aiSuggestion}
              isExpanded={isRowExpanded}
              onToggleExpand={() => toggleRowExpansion(item.proposal.id)}
            />
          );
        })}
      </div>
    </div>
  );
}
