/**
 * Action Bar Component
 *
 * Simplified action bar focused on the main CTA.
 * Shows selection status and apply button.
 *
 * Story 6.4 - AC3: File Selection, AC5: Apply Rename
 */

import { CheckCheck } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import type { PreviewSummary, PreviewActionSummary, ReorganizationMode } from "@/lib/tauri";
import { cn } from "@/lib/utils";

export interface ActionBarProps {
  /** Summary statistics for the preview */
  summary: PreviewSummary;
  /** Action summary (rename vs move counts) */
  actionSummary?: PreviewActionSummary;
  /** Current reorganization mode */
  reorganizationMode?: ReorganizationMode;
  /** Number of files currently selected */
  selectedCount: number;
  /** Whether any changes have been applied */
  hasApplied: boolean;
  /** Whether the apply operation is in progress */
  isApplying: boolean;
  /** Callback to select all ready files */
  onSelectAllReady: () => void;
  /** Callback to deselect all files */
  onDeselectAll: () => void;
  /** Callback to apply the rename operation */
  onApply: () => void;
}

export function ActionBar({
  summary,
  actionSummary,
  selectedCount,
  hasApplied,
  isApplying,
  onSelectAllReady,
  onDeselectAll,
  onApply,
}: ActionBarProps) {
  const hasSelection = selectedCount > 0;
  const allReadySelected = selectedCount === summary.ready && summary.ready > 0;
  const someDeselected = selectedCount < summary.ready && selectedCount > 0;
  const hasMoves = actionSummary && actionSummary.moveCount > 0;
  const hasIssues = summary.conflicts > 0 || summary.missingData > 0;

  // Build tooltip content for detailed stats
  const statsTooltip = (
    <div className="space-y-1 text-xs">
      <div className="text-green-400">{summary.ready} ready to rename</div>
      {summary.conflicts > 0 && (
        <div className="text-red-400">{summary.conflicts} with conflicts</div>
      )}
      {summary.missingData > 0 && (
        <div className="text-yellow-400">{summary.missingData} missing data</div>
      )}
      {(summary.noChange > 0 || summary.invalidName > 0) && (
        <div className="text-muted-foreground">{summary.noChange + summary.invalidName} unchanged</div>
      )}
      {hasMoves && (
        <div className="text-amber-400 pt-1 border-t border-border/50">
          {actionSummary?.moveCount} will be moved to folders
        </div>
      )}
    </div>
  );

  // Done state - minimal
  if (hasApplied) {
    return (
      <div
        className="flex items-center justify-center py-4 text-green-600 dark:text-green-400"
        data-testid="action-bar"
      >
        <CheckCheck className="h-5 w-5 mr-2" />
        <span className="font-medium">Done</span>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div
        className="flex items-center justify-between gap-4 py-4 px-2"
        data-testid="action-bar"
      >
        {/* Left: Selection info with actions */}
        <div className="flex items-center gap-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className={cn(
                  "text-sm tabular-nums cursor-help",
                  hasSelection ? "text-foreground" : "text-muted-foreground"
                )}
                data-testid="action-bar-selection"
              >
                {selectedCount} selected
                {hasIssues && (
                  <span className="text-muted-foreground/60 ml-1">
                    of {summary.ready} ready
                  </span>
                )}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" align="start">
              {statsTooltip}
            </TooltipContent>
          </Tooltip>

          {/* Quick actions - subtle */}
          <div className="flex gap-1">
            {!allReadySelected && summary.ready > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onSelectAllReady}
                className="h-7 text-xs text-muted-foreground hover:text-foreground"
                data-testid="action-bar-select-all"
              >
                Select all
              </Button>
            )}
            {someDeselected && (
              <span className="text-muted-foreground/30 mx-1">·</span>
            )}
            {hasSelection && !allReadySelected && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onDeselectAll}
                className="h-7 text-xs text-muted-foreground hover:text-foreground"
                data-testid="action-bar-deselect-all"
              >
                Clear
              </Button>
            )}
          </div>
        </div>

        {/* Right: Main CTA */}
        <Button
          onClick={onApply}
          disabled={!hasSelection || isApplying}
          size="lg"
          className="min-w-[160px] font-medium"
          data-testid="action-bar-apply"
        >
          {isApplying ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Working...
            </span>
          ) : (
            `Rename ${selectedCount} file${selectedCount !== 1 ? "s" : ""}`
          )}
        </Button>
      </div>
    </TooltipProvider>
  );
}
