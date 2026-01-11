/**
 * Export Button Component
 *
 * Exports scan results and rename preview to JSON file.
 * Triggers native file save dialog via Tauri.
 *
 * Story 6.5 - Task 6: Create Export Functionality
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  exportResults,
  type FileInfo,
  type RenamePreview,
  type ExportResult,
} from "@/lib/tauri";
import { cn } from "@/lib/utils";

/** Props for the ExportButton component */
export interface ExportButtonProps {
  /** Source folder path */
  folder: string;
  /** List of files to export */
  files: FileInfo[];
  /** Optional rename preview to include */
  preview?: RenamePreview;
  /** Callback when export completes successfully */
  onExportComplete?: (result: ExportResult) => void;
  /** Whether the button is disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * ExportButton component for exporting scan results to JSON
 *
 * Features:
 * - Native file save dialog
 * - Includes scan results and optional preview
 * - Loading state during export
 * - Success/error toast notifications
 * - Disabled when no files to export
 */
export function ExportButton({
  folder,
  files,
  preview,
  onExportComplete,
  disabled = false,
  className,
}: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  const canExport = files.length > 0 && !disabled && !isExporting;

  const handleExport = async () => {
    if (!canExport) return;

    setIsExporting(true);
    const toastId = toast.loading("Exporting results...");

    try {
      const result = await exportResults({
        folder,
        files,
        preview,
      });

      toast.dismiss(toastId);
      toast.success(`Exported to ${result.path}`, {
        description: `File size: ${formatBytes(result.size)}`,
      });

      onExportComplete?.(result);
    } catch (error) {
      toast.dismiss(toastId);

      // Check if cancelled by user (not an error)
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      if (errorMessage.includes("cancelled")) {
        // User cancelled, no toast needed
        return;
      }

      toast.error("Export failed", {
        description: errorMessage,
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button
      variant="outline"
      onClick={handleExport}
      disabled={!canExport}
      aria-disabled={!canExport}
      className={cn(className)}
      data-testid="export-button"
    >
      {isExporting ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Download className="mr-2 h-4 w-4" />
      )}
      Export
    </Button>
  );
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = bytes / Math.pow(k, i);
  // Remove trailing .0
  const formatted = value.toFixed(1).replace(/\.0$/, "");
  return `${formatted} ${sizes[i]}`;
}
