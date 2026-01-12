/**
 * Action Bar Component
 *
 * Displays selection status, safety messaging, and apply actions.
 * Enhanced with action summary showing rename vs move counts.
 *
 * Story 6.4 - AC3: File Selection, AC5: Apply Rename, AC6: Nothing Has Changed Messaging
 */

import { AlertCircle, CheckCheck, FileType, FolderTree } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
  reorganizationMode = "rename-only",
  selectedCount,
  hasApplied,
  isApplying,
  onSelectAllReady,
  onDeselectAll,
  onApply,
}: ActionBarProps) {
  const hasSelection = selectedCount > 0;
  const allReadySelected = selectedCount === summary.ready && summary.ready > 0;
  const isOrganizeMode = reorganizationMode === "organize";
  const hasMoves = actionSummary && actionSummary.moveCount > 0;

  return (
    <Card className="p-4" data-testid="action-bar">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Left Section: Status Message */}
        <div className="flex items-center gap-3">
          {!hasApplied && (
            <div
              className="flex items-center gap-2 text-sm text-muted-foreground"
              data-testid="action-bar-safety-message"
            >
              <AlertCircle className="h-4 w-4" />
              <span>Nothing has changed yet - this is a preview</span>
            </div>
          )}
          {hasApplied && (
            <div
              className="flex items-center gap-2 text-sm text-green-600"
              data-testid="action-bar-applied-message"
            >
              <CheckCheck className="h-4 w-4" />
              <span>Changes have been applied</span>
            </div>
          )}
        </div>

        {/* Center Section: Selection Count */}
        <div
          className="flex items-center gap-2 text-sm font-medium"
          data-testid="action-bar-selection"
        >
          <span
            className={cn(
              "tabular-nums",
              hasSelection ? "text-foreground" : "text-muted-foreground"
            )}
          >
            {selectedCount} of {summary.ready} ready files selected
          </span>

          {/* Quick Select Buttons with keyboard hints */}
          <div className="flex gap-1">
            {!allReadySelected && summary.ready > 0 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onSelectAllReady}
                      data-testid="action-bar-select-all"
                    >
                      Select All
                      <kbd className="ml-1.5 hidden sm:inline-flex h-5 items-center gap-0.5 rounded border bg-muted px-1 font-mono text-[10px] font-medium text-muted-foreground">
                        <span className="text-xs">⌘</span>A
                      </kbd>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Select all ready files (Ctrl+A / ⌘A)</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {hasSelection && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onDeselectAll}
                      data-testid="action-bar-deselect-all"
                    >
                      Clear
                      <kbd className="ml-1.5 hidden sm:inline-flex h-5 items-center gap-0.5 rounded border bg-muted px-1 font-mono text-[10px] font-medium text-muted-foreground">
                        <span className="text-xs">⌘</span>D
                      </kbd>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Deselect all (Ctrl+D / ⌘D)</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>

        {/* Right Section: Apply Button with keyboard hint */}
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={onApply}
                  disabled={!hasSelection || isApplying}
                  className="min-w-[140px]"
                  data-testid="action-bar-apply"
                >
                  {isApplying ? (
                    "Applying..."
                  ) : (
                    <>
                      Apply Rename
                      {hasSelection && (
                        <span className="ml-1 opacity-80">({selectedCount})</span>
                      )}
                      <kbd className="ml-2 hidden sm:inline-flex h-5 items-center gap-0.5 rounded border border-primary-foreground/30 bg-primary-foreground/10 px-1 font-mono text-[10px] font-medium">
                        <span className="text-xs">⌘</span>↵
                      </kbd>
                    </>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Apply selected renames (Ctrl+Enter / ⌘↵)</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Summary Stats */}
      <div
        className="mt-3 pt-3 border-t flex flex-wrap gap-4 text-xs text-muted-foreground"
        data-testid="action-bar-summary"
      >
        {/* Action Type Stats (when in organize mode or when there are moves) */}
        {actionSummary && (hasMoves || isOrganizeMode) && (
          <>
            {actionSummary.renameCount > 0 && (
              <span className="flex items-center gap-1" data-testid="action-bar-renames">
                <FileType className="h-3 w-3 text-blue-500" />
                {actionSummary.renameCount} rename{actionSummary.renameCount !== 1 ? "s" : ""}
              </span>
            )}
            {actionSummary.moveCount > 0 && (
              <span className="flex items-center gap-1 text-amber-600" data-testid="action-bar-moves">
                <FolderTree className="h-3 w-3" />
                {actionSummary.moveCount} move{actionSummary.moveCount !== 1 ? "s" : ""}
              </span>
            )}
            <span className="text-muted-foreground/50">|</span>
          </>
        )}

        <span className="flex items-center gap-1" title="Ready to rename">
          <span className="w-2 h-2 rounded-full bg-green-500" aria-hidden="true" />
          <span className="text-green-700 dark:text-green-400">✓</span>
          {summary.ready} ready
        </span>
        {summary.conflicts > 0 && (
          <span className="flex items-center gap-1" title="Has conflicts">
            <span className="w-2 h-2 rounded-full bg-red-500" aria-hidden="true" />
            <span className="text-red-700 dark:text-red-400">⚠</span>
            {summary.conflicts} conflicts
          </span>
        )}
        {summary.missingData > 0 && (
          <span className="flex items-center gap-1" title="Missing required data">
            <span className="w-2 h-2 rounded-full bg-yellow-500" aria-hidden="true" />
            <span className="text-yellow-700 dark:text-yellow-400">?</span>
            {summary.missingData} missing data
          </span>
        )}
        {summary.noChange > 0 && (
          <span className="flex items-center gap-1" title="No change needed">
            <span className="w-2 h-2 rounded-full bg-gray-400" aria-hidden="true" />
            <span className="text-gray-600 dark:text-gray-400">—</span>
            {summary.noChange} no change
          </span>
        )}
        {summary.invalidName > 0 && (
          <span className="flex items-center gap-1" title="Invalid filename">
            <span className="w-2 h-2 rounded-full bg-orange-500" aria-hidden="true" />
            <span className="text-orange-700 dark:text-orange-400">✕</span>
            {summary.invalidName} invalid
          </span>
        )}
        <span className="ml-auto">{summary.total} total files</span>
      </div>
    </Card>
  );
}
