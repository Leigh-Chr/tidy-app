/**
 * Preview Row Component
 *
 * Displays a single rename proposal with checkbox, diff highlighting, and status.
 *
 * Story 6.4 - AC2: Status Indicators, AC3: File Selection, AC4: Before/After Comparison
 */

import {
  Check,
  AlertTriangle,
  AlertCircle,
  Minus,
  Ban,
  ChevronDown,
  ChevronRight,
  FolderOutput,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AiSuggestion, RenameProposal, RenameStatus } from "@/lib/tauri";
import { cn } from "@/lib/utils";

export interface PreviewRowProps {
  /** The rename proposal to display */
  proposal: RenameProposal;
  /** Whether this proposal is selected */
  isSelected: boolean;
  /** Callback when selection is toggled */
  onToggleSelection: () => void;
  /** Callback for selection with event (for shift+click) */
  onSelectionClick?: (event: React.MouseEvent) => void;
  /** AI suggestion for this file (if analyzed) */
  aiSuggestion?: AiSuggestion;
  /** Whether details are expanded (controlled) */
  isExpanded?: boolean;
  /** Callback when expand is toggled (controlled) */
  onToggleExpand?: () => void;
}

/** Status icon and styling configuration */
const STATUS_DISPLAY: Record<
  RenameStatus,
  { icon: React.ElementType; className: string; bgClass: string }
> = {
  ready: { icon: Check, className: "text-green-600 dark:text-green-400", bgClass: "hover:bg-green-50/50 dark:hover:bg-green-950/30" },
  conflict: { icon: AlertCircle, className: "text-red-600 dark:text-red-400", bgClass: "hover:bg-red-50/50 dark:hover:bg-red-950/30" },
  "missing-data": { icon: AlertTriangle, className: "text-yellow-600 dark:text-yellow-400", bgClass: "hover:bg-yellow-50/50 dark:hover:bg-yellow-950/30" },
  "invalid-name": { icon: Ban, className: "text-orange-600 dark:text-orange-400", bgClass: "hover:bg-orange-50/50 dark:hover:bg-orange-950/30" },
  "no-change": { icon: Minus, className: "text-gray-400 dark:text-gray-500", bgClass: "hover:bg-gray-50/50 dark:hover:bg-gray-950/30" },
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

export function PreviewRow({
  proposal,
  isSelected,
  onToggleSelection,
  onSelectionClick,
  aiSuggestion,
  isExpanded = false,
  onToggleExpand,
}: PreviewRowProps) {
  const statusConfig = STATUS_DISPLAY[proposal.status];
  const StatusIcon = statusConfig.icon;
  const diffSegments = computeDiff(proposal.originalName, proposal.proposedName);
  const hasIssues = proposal.issues.length > 0;
  const canSelect = proposal.status === "ready";
  const isFolderMove = proposal.isFolderMove === true;
  const hasExpandableContent = hasIssues || proposal.metadataSources?.length || aiSuggestion || isFolderMove;

  // Handle row click for selection (supports shift+click)
  const handleRowClick = (event: React.MouseEvent) => {
    if (!canSelect) return;
    // Don't trigger row click if clicking on expand button or other interactive elements
    const target = event.target as HTMLElement;
    if (target.closest("button") || target.closest('[role="checkbox"]')) return;

    if (onSelectionClick) {
      onSelectionClick(event);
    } else {
      onToggleSelection();
    }
  };

  // Handle checkbox change
  const handleCheckboxChange = () => {
    onToggleSelection();
  };

  // Handle keyboard interaction for accessibility
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (!canSelect) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onToggleSelection();
    }
  };

  return (
    <div
      role={canSelect ? "button" : undefined}
      tabIndex={canSelect ? 0 : undefined}
      className={cn(
        "flex flex-col border-b transition-colors",
        statusConfig.bgClass,
        isSelected && "bg-primary/5",
        canSelect && "cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
      )}
      onClick={handleRowClick}
      onKeyDown={handleKeyDown}
      aria-pressed={canSelect ? isSelected : undefined}
      data-testid={`preview-row-${proposal.id}`}
    >
      {/* Main Row */}
      <div className="flex items-center px-4 py-3 min-h-[56px]">
        {/* Checkbox */}
        <div className="w-10">
          {canSelect && (
            <Checkbox
              checked={isSelected}
              onCheckedChange={handleCheckboxChange}
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
          {isFolderMove && proposal.destinationFolder && (
            <Badge variant="outline" className="text-[10px] px-1 py-0 bg-blue-50 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700" title={`Moving to: ${proposal.destinationFolder}`}>
              <FolderOutput className="h-3 w-3" />
            </Badge>
          )}
          {aiSuggestion && (
            <Badge variant="outline" className="text-[10px] px-1 py-0 bg-purple-50 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-700">
              AI
            </Badge>
          )}
          {hasExpandableContent && onToggleExpand && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleExpand}
              className="h-6 w-6"
              aria-label={isExpanded ? "Collapse details" : "Expand details"}
              data-testid={`preview-expand-${proposal.id}`}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div
          className="px-4 pb-3 pt-0 pl-14 text-sm space-y-2"
          data-testid={`preview-details-${proposal.id}`}
        >
          {/* AI Suggestion */}
          {aiSuggestion && (
            <div className="bg-purple-50 dark:bg-purple-950 p-2 rounded border border-purple-200 dark:border-purple-800" data-testid={`ai-suggestion-${proposal.id}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium text-purple-700 dark:text-purple-300">AI Suggestion</span>
                <Badge variant="outline" className="text-[10px] px-1 py-0">
                  {Math.round(aiSuggestion.confidence * 100)}% confident
                </Badge>
              </div>
              <div className="font-mono text-sm text-purple-900 dark:text-purple-100">
                {aiSuggestion.suggestedName}
              </div>
              {aiSuggestion.suggestedFolder && (
                <div className="flex items-center gap-2 mt-1">
                  <FolderOutput className="h-3 w-3 text-purple-600 dark:text-purple-400" />
                  <span className="font-mono text-sm text-purple-900 dark:text-purple-100">
                    {aiSuggestion.suggestedFolder}
                  </span>
                  {aiSuggestion.folderConfidence !== undefined && (
                    <Badge variant="outline" className="text-[10px] px-1 py-0">
                      {Math.round(aiSuggestion.folderConfidence * 100)}% folder confidence
                    </Badge>
                  )}
                </div>
              )}
              {aiSuggestion.reasoning && (
                <div className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                  {aiSuggestion.reasoning}
                </div>
              )}
              {aiSuggestion.keywords.length > 0 && (
                <div className="flex gap-1 mt-1 flex-wrap">
                  {aiSuggestion.keywords.map((keyword) => (
                    <span
                      key={keyword}
                      className="px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 text-[10px] rounded"
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Destination Folder (for folder moves) */}
          {isFolderMove && proposal.destinationFolder && (
            <div className="bg-blue-50 dark:bg-blue-950 p-2 rounded border border-blue-200 dark:border-blue-800" data-testid={`folder-move-${proposal.id}`}>
              <div className="flex items-center gap-2">
                <FolderOutput className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span className="text-xs font-medium text-blue-700 dark:text-blue-300">Moving to folder:</span>
              </div>
              <div className="font-mono text-sm text-blue-900 dark:text-blue-100 mt-1">
                {proposal.destinationFolder}
              </div>
            </div>
          )}

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
