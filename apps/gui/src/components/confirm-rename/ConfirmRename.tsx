/**
 * Confirm Rename Dialog Component
 *
 * Shows a confirmation dialog before applying rename operations.
 *
 * Story 6.4 - AC5: Apply Rename Action (confirmation step)
 */

import { AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { PreviewSummary } from "@/lib/tauri";

export interface ConfirmRenameProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Number of files to be renamed */
  fileCount: number;
  /** Summary statistics for context */
  summary?: PreviewSummary;
  /** Callback when confirmed */
  onConfirm: () => void;
  /** Callback when cancelled */
  onCancel: () => void;
}

export function ConfirmRename({
  open,
  fileCount,
  summary,
  onConfirm,
  onCancel,
}: ConfirmRenameProps) {
  const hasIssues = summary && (summary.conflicts > 0 || summary.missingData > 0);

  return (
    <AlertDialog open={open} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent data-testid="confirm-rename-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle>Confirm Rename</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p data-testid="confirm-rename-count">
                <span className="font-semibold text-foreground">{fileCount}</span>{" "}
                file{fileCount !== 1 ? "s" : ""} will be renamed.
              </p>

              {hasIssues && (
                <div
                  className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md text-yellow-800"
                  data-testid="confirm-rename-warning"
                >
                  <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium">Some files have issues:</p>
                    <ul className="mt-1 list-disc list-inside">
                      {summary.conflicts > 0 && (
                        <li>{summary.conflicts} file{summary.conflicts !== 1 ? "s" : ""} with conflicts</li>
                      )}
                      {summary.missingData > 0 && (
                        <li>{summary.missingData} file{summary.missingData !== 1 ? "s" : ""} with missing data</li>
                      )}
                    </ul>
                    <p className="mt-1 text-xs">
                      Only files without issues will be renamed.
                    </p>
                  </div>
                </div>
              )}

              <p className="text-sm text-muted-foreground">
                This action cannot be undone automatically. Make sure you have backups
                of important files.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel data-testid="confirm-rename-cancel">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            data-testid="confirm-rename-confirm"
          >
            Rename {fileCount} File{fileCount !== 1 ? "s" : ""}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
