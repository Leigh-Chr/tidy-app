/**
 * Action Bar Component
 *
 * Displays selection status, safety messaging, and apply actions.
 * Enhanced with action summary showing rename vs move counts.
 *
 * Story 6.4 - AC3: File Selection, AC5: Apply Rename, AC6: Nothing Has Changed Messaging
 */

import { AlertCircle, CheckCheck, FileType, FolderTree } from "lucide-react";
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

          {/* Quick Select Buttons */}
          <div className="flex gap-1">
            {!allReadySelected && summary.ready > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onSelectAllReady}
                data-testid="action-bar-select-all"
              >
                Select All
              </Button>
            )}
            {hasSelection && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onDeselectAll}
                data-testid="action-bar-deselect-all"
              >
                Clear
              </Button>
            )}
          </div>
        </div>

        {/* Right Section: Apply Button */}
        <div className="flex items-center gap-2">
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
              </>
            )}
          </Button>
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

        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          {summary.ready} ready
        </span>
        {summary.conflicts > 0 && (
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            {summary.conflicts} conflicts
          </span>
        )}
        {summary.missingData > 0 && (
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-yellow-500" />
            {summary.missingData} missing data
          </span>
        )}
        {summary.noChange > 0 && (
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-gray-400" />
            {summary.noChange} no change
          </span>
        )}
        {summary.invalidName > 0 && (
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-orange-500" />
            {summary.invalidName} invalid
          </span>
        )}
        <span className="ml-auto">{summary.total} total files</span>
      </div>
    </Card>
  );
}
