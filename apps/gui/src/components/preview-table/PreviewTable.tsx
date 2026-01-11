/**
 * Preview Table Component
 *
 * Displays rename proposals in a virtualized, grouped table.
 * Shows original -> proposed name with status indicators and selection checkboxes.
 *
 * Story 6.4 - AC1: Preview Table Display, AC2: Status Indicators, AC4: Visual Comparison
 */

import { useRef, useMemo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { RenamePreview, RenameProposal, RenameStatus } from "@/lib/tauri";
import { cn } from "@/lib/utils";
import { PreviewRow } from "./PreviewRow";

export interface PreviewTableProps {
  /** The rename preview data */
  preview: RenamePreview;
  /** Set of selected proposal IDs */
  selectedIds: Set<string>;
  /** Callback when a proposal is toggled */
  onToggleSelection: (proposalId: string) => void;
  /** Collapsed status groups */
  collapsedGroups?: Set<RenameStatus>;
  /** Callback when a group is toggled */
  onToggleGroup?: (status: RenameStatus) => void;
}

/** Status group configuration for display order and styling */
const STATUS_CONFIG: Record<RenameStatus, { label: string; className: string; order: number }> = {
  ready: { label: "Ready to Rename", className: "bg-green-50 border-green-200", order: 0 },
  conflict: { label: "Conflicts", className: "bg-red-50 border-red-200", order: 1 },
  "missing-data": { label: "Missing Data", className: "bg-yellow-50 border-yellow-200", order: 2 },
  "invalid-name": { label: "Invalid Name", className: "bg-orange-50 border-orange-200", order: 3 },
  "no-change": { label: "No Change", className: "bg-gray-50 border-gray-200", order: 4 },
};

type GroupedItem =
  | { type: "header"; status: RenameStatus; count: number }
  | { type: "row"; proposal: RenameProposal };

export function PreviewTable({
  preview,
  selectedIds,
  onToggleSelection,
  collapsedGroups = new Set(),
  onToggleGroup,
}: PreviewTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);

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

  // Set up virtualizer
  const virtualizer = useVirtualizer({
    count: flattenedItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => {
      const item = flattenedItems[index];
      return item.type === "header" ? 40 : 56;
    },
    overscan: 5,
  });

  const virtualItems = virtualizer.getVirtualItems();

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
    <div className="flex flex-col h-full" data-testid="preview-table">
      {/* Table Header */}
      <div className="flex items-center border-b bg-muted/50 px-4 py-2 text-sm font-medium text-muted-foreground sticky top-0 z-10">
        <div className="w-10" /> {/* Checkbox column */}
        <div className="flex-1">Original Name</div>
        <div className="w-8 text-center">&rarr;</div>
        <div className="flex-1">Proposed Name</div>
        <div className="w-24 text-center">Status</div>
      </div>

      {/* Virtualized List */}
      <div
        ref={parentRef}
        className="flex-1 overflow-auto"
        data-testid="preview-table-scroll"
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: "100%",
            position: "relative",
          }}
        >
          {virtualItems.map((virtualItem) => {
            const item = flattenedItems[virtualItem.index];

            if (item.type === "header") {
              const config = STATUS_CONFIG[item.status];
              const isCollapsed = collapsedGroups.has(item.status);

              return (
                <div
                  key={`header-${item.status}`}
                  role="button"
                  tabIndex={0}
                  aria-expanded={!isCollapsed}
                  aria-label={`${config.label} group, ${item.count} items. ${isCollapsed ? "Click to expand" : "Click to collapse"}`}
                  className={cn(
                    "absolute top-0 left-0 w-full flex items-center px-4 py-2 border-y cursor-pointer hover:bg-muted/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    config.className
                  )}
                  style={{
                    height: `${virtualItem.size}px`,
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
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

            return (
              <div
                key={item.proposal.id}
                className="absolute top-0 left-0 w-full"
                style={{
                  height: `${virtualItem.size}px`,
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                <PreviewRow
                  proposal={item.proposal}
                  isSelected={selectedIds.has(item.proposal.id)}
                  onToggleSelection={() => onToggleSelection(item.proposal.id)}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
