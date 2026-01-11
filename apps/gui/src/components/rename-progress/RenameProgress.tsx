/**
 * Rename Progress Component
 *
 * Shows progress during execution and results after completion.
 *
 * Story 6.4 - AC5: Apply Rename Action (progress and results)
 */

import { CheckCircle2, XCircle, AlertCircle, Undo2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { BatchRenameResult } from "@/lib/tauri";
import { cn } from "@/lib/utils";

export interface RenameProgressProps {
  /** Whether the operation is in progress */
  isInProgress: boolean;
  /** Progress percentage (0-100) */
  progress?: number;
  /** Result of the rename operation (after completion) */
  result?: BatchRenameResult | null;
  /** Callback to dismiss the result */
  onDismiss?: () => void;
  /** Callback for undo action (placeholder) */
  onUndo?: () => void;
}

export function RenameProgress({
  isInProgress,
  progress = 0,
  result,
  onDismiss,
  onUndo,
}: RenameProgressProps) {
  // Show progress bar when in progress
  if (isInProgress) {
    return (
      <Card className="p-4" data-testid="rename-progress-card">
        <div className="flex items-center gap-4">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <div className="flex-1">
            <div className="flex justify-between text-sm mb-2">
              <span data-testid="rename-progress-label">Renaming files...</span>
              <span className="text-muted-foreground">{progress}%</span>
            </div>
            <Progress value={progress} data-testid="rename-progress-bar" />
          </div>
        </div>
      </Card>
    );
  }

  // Show nothing if no result
  if (!result) {
    return null;
  }

  // Determine overall status
  const isFullSuccess = result.summary.failed === 0 && result.summary.succeeded > 0;
  const isPartialSuccess = result.summary.succeeded > 0 && result.summary.failed > 0;
  const isFullFailure = result.summary.succeeded === 0 && result.summary.failed > 0;

  return (
    <Card
      className={cn(
        "p-4",
        isFullSuccess && "border-green-200 bg-green-50",
        isPartialSuccess && "border-yellow-200 bg-yellow-50",
        isFullFailure && "border-red-200 bg-red-50"
      )}
      data-testid="rename-result-card"
    >
      <div className="flex items-start gap-4">
        {/* Status Icon */}
        {isFullSuccess && (
          <CheckCircle2 className="h-6 w-6 text-green-600 flex-shrink-0" />
        )}
        {isPartialSuccess && (
          <AlertCircle className="h-6 w-6 text-yellow-600 flex-shrink-0" />
        )}
        {isFullFailure && (
          <XCircle className="h-6 w-6 text-red-600 flex-shrink-0" />
        )}

        {/* Content */}
        <div className="flex-1 space-y-2">
          {/* Title */}
          <h4
            className={cn(
              "font-medium",
              isFullSuccess && "text-green-800",
              isPartialSuccess && "text-yellow-800",
              isFullFailure && "text-red-800"
            )}
            data-testid="rename-result-title"
          >
            {isFullSuccess && "Rename Complete!"}
            {isPartialSuccess && "Rename Partially Complete"}
            {isFullFailure && "Rename Failed"}
          </h4>

          {/* Summary */}
          <p
            className="text-sm text-muted-foreground"
            data-testid="rename-result-summary"
          >
            {result.summary.succeeded} file{result.summary.succeeded !== 1 ? "s" : ""} renamed
            {result.summary.failed > 0 && (
              <span className="text-red-600">
                , {result.summary.failed} failed
              </span>
            )}
            {result.summary.skipped > 0 && (
              <span>, {result.summary.skipped} skipped</span>
            )}
            <span className="ml-2 text-xs">
              ({result.durationMs}ms)
            </span>
          </p>

          {/* Error Details */}
          {result.summary.failed > 0 && (
            <div className="mt-2" data-testid="rename-result-errors">
              <p className="text-sm font-medium text-red-700 mb-1">Failed files:</p>
              <ul className="text-xs space-y-1 max-h-32 overflow-auto">
                {result.results
                  .filter((r) => r.outcome === "failed")
                  .map((r) => (
                    <li key={r.proposalId} className="text-red-600">
                      <span className="font-mono">{r.originalName}</span>
                      {r.error && (
                        <span className="text-red-500 ml-1">- {r.error}</span>
                      )}
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          {isFullSuccess && onUndo && (
            <Button
              variant="outline"
              size="sm"
              onClick={onUndo}
              className="text-green-700 border-green-300 hover:bg-green-100"
              data-testid="rename-result-undo"
            >
              <Undo2 className="h-4 w-4 mr-1" />
              Undo
            </Button>
          )}
          {onDismiss && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDismiss}
              data-testid="rename-result-dismiss"
            >
              Dismiss
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
