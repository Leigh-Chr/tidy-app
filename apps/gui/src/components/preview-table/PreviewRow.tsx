/**
 * Preview Row Component
 *
 * Displays a single rename proposal with checkbox, diff highlighting, and status.
 *
 * Story 6.4 - AC2: Status Indicators, AC3: File Selection, AC4: Before/After Comparison
 */

import { useState } from "react";
import {
  Check,
  AlertTriangle,
  AlertCircle,
  Minus,
  Ban,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import type { RenameProposal, RenameStatus } from "@/lib/tauri";
import { cn } from "@/lib/utils";

export interface PreviewRowProps {
  /** The rename proposal to display */
  proposal: RenameProposal;
  /** Whether this proposal is selected */
  isSelected: boolean;
  /** Callback when selection is toggled */
  onToggleSelection: () => void;
}

/** Status icon and styling configuration */
const STATUS_DISPLAY: Record<
  RenameStatus,
  { icon: React.ElementType; className: string; bgClass: string }
> = {
  ready: { icon: Check, className: "text-green-600", bgClass: "hover:bg-green-50/50" },
  conflict: { icon: AlertCircle, className: "text-red-600", bgClass: "hover:bg-red-50/50" },
  "missing-data": { icon: AlertTriangle, className: "text-yellow-600", bgClass: "hover:bg-yellow-50/50" },
  "invalid-name": { icon: Ban, className: "text-orange-600", bgClass: "hover:bg-orange-50/50" },
  "no-change": { icon: Minus, className: "text-gray-400", bgClass: "hover:bg-gray-50/50" },
};

/**
 * Compute diff between original and proposed names
 * Returns segments with 'added', 'removed', or 'same' status
 */
function computeDiff(
  original: string,
  proposed: string
): Array<{ text: string; type: "same" | "added" | "removed" }> {
  // Simple diff: find common prefix and suffix
  if (original === proposed) {
    return [{ text: original, type: "same" }];
  }

  // Find common prefix
  let prefixLen = 0;
  const minLen = Math.min(original.length, proposed.length);
  while (prefixLen < minLen && original[prefixLen] === proposed[prefixLen]) {
    prefixLen++;
  }

  // Find common suffix (from what's left after prefix)
  let suffixLen = 0;
  const maxSuffix = minLen - prefixLen;
  while (
    suffixLen < maxSuffix &&
    original[original.length - 1 - suffixLen] === proposed[proposed.length - 1 - suffixLen]
  ) {
    suffixLen++;
  }

  const result: Array<{ text: string; type: "same" | "added" | "removed" }> = [];

  // Common prefix
  if (prefixLen > 0) {
    result.push({ text: proposed.slice(0, prefixLen), type: "same" });
  }

  // Changed middle portion - for proposed, we show added
  const proposedMiddle = proposed.slice(prefixLen, proposed.length - suffixLen || undefined);

  if (proposedMiddle) {
    result.push({ text: proposedMiddle, type: "added" });
  }

  // Common suffix
  if (suffixLen > 0) {
    result.push({ text: proposed.slice(-suffixLen), type: "same" });
  }

  return result;
}

export function PreviewRow({ proposal, isSelected, onToggleSelection }: PreviewRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const statusConfig = STATUS_DISPLAY[proposal.status];
  const StatusIcon = statusConfig.icon;
  const diffSegments = computeDiff(proposal.originalName, proposal.proposedName);
  const hasIssues = proposal.issues.length > 0;
  const canSelect = proposal.status === "ready";

  return (
    <div
      className={cn(
        "flex flex-col border-b transition-colors",
        statusConfig.bgClass,
        isSelected && "bg-primary/5"
      )}
      data-testid={`preview-row-${proposal.id}`}
    >
      {/* Main Row */}
      <div className="flex items-center px-4 py-3 min-h-[56px]">
        {/* Checkbox */}
        <div className="w-10">
          {canSelect && (
            <Checkbox
              checked={isSelected}
              onCheckedChange={onToggleSelection}
              aria-label={`Select ${proposal.originalName}`}
              data-testid={`preview-checkbox-${proposal.id}`}
            />
          )}
        </div>

        {/* Original Name */}
        <div
          className="flex-1 font-mono text-sm truncate"
          title={proposal.originalName}
        >
          {proposal.originalName}
        </div>

        {/* Arrow */}
        <div className="w-8 text-center text-muted-foreground">&rarr;</div>

        {/* Proposed Name with diff highlighting */}
        <div
          className="flex-1 font-mono text-sm truncate"
          title={proposal.proposedName}
        >
          {diffSegments.map((segment, idx) => (
            <span
              key={idx}
              className={cn(
                segment.type === "added" && "bg-green-200 text-green-900 px-0.5 rounded",
                segment.type === "removed" && "bg-red-200 text-red-900 line-through"
              )}
            >
              {segment.text}
            </span>
          ))}
        </div>

        {/* Status + Expand */}
        <div className="w-24 flex items-center justify-center gap-1">
          <StatusIcon className={cn("h-4 w-4", statusConfig.className)} />
          {(hasIssues || proposal.metadataSources?.length) && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 hover:bg-muted rounded"
              aria-label={isExpanded ? "Collapse details" : "Expand details"}
              data-testid={`preview-expand-${proposal.id}`}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div
          className="px-4 pb-3 pt-0 pl-14 text-sm space-y-2"
          data-testid={`preview-details-${proposal.id}`}
        >
          {/* Metadata Sources */}
          {proposal.metadataSources && proposal.metadataSources.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Source:</span>
              <div className="flex gap-1">
                {proposal.metadataSources.map((source) => (
                  <span
                    key={source}
                    className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded"
                  >
                    {source}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Issues */}
          {hasIssues && (
            <div className="space-y-1">
              <span className="text-muted-foreground">Issues:</span>
              <ul className="list-disc list-inside space-y-1 text-sm">
                {proposal.issues.map((issue, idx) => (
                  <li key={idx} className="text-red-600">
                    {issue.message}
                    {issue.field && (
                      <span className="text-muted-foreground ml-1">
                        (field: {issue.field})
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Full paths */}
          <div className="text-xs text-muted-foreground space-y-1">
            <div>Original: {proposal.originalPath}</div>
            <div>Proposed: {proposal.proposedPath}</div>
          </div>
        </div>
      )}
    </div>
  );
}
