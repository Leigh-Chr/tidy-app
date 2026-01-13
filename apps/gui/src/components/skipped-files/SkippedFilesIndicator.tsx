/**
 * Skipped Files Indicator Component (UX-002)
 *
 * Displays information about files that were skipped during scan.
 * Shows a collapsible panel with skip reasons and affected files.
 */

import { useState } from "react";
import { AlertTriangle, ChevronDown, ChevronRight, FileX2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { SkippedFile, SkipReason } from "@/lib/tauri";

/** Configuration for skip reason display */
interface SkipReasonConfig {
  label: string;
  description: string;
  color: string;
}

/** Skip reason display configuration */
const SKIP_REASON_CONFIG: Record<SkipReason, SkipReasonConfig> = {
  metadataError: {
    label: "Metadata Error",
    description: "Could not read file metadata",
    color: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  filteredByExtension: {
    label: "Filtered",
    description: "Excluded by file type filter",
    color: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
  },
  permissionDenied: {
    label: "Permission Denied",
    description: "Insufficient permissions to read file",
    color: "bg-red-500/10 text-red-600 dark:text-red-400",
  },
  other: {
    label: "Other",
    description: "Skipped for other reasons",
    color: "bg-gray-500/10 text-gray-600 dark:text-gray-400",
  },
};

export interface SkippedFilesIndicatorProps {
  /** List of skipped files */
  skippedFiles: SkippedFile[];
  /** Total count of skipped files */
  skippedCount?: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Group skipped files by reason
 */
function groupByReason(files: SkippedFile[]): Map<SkipReason, SkippedFile[]> {
  const grouped = new Map<SkipReason, SkippedFile[]>();

  for (const file of files) {
    const existing = grouped.get(file.reason) || [];
    existing.push(file);
    grouped.set(file.reason, existing);
  }

  return grouped;
}

/**
 * Get filename from path
 */
function getFileName(path: string): string {
  return path.split("/").pop() || path;
}

/**
 * SkippedFilesIndicator component
 *
 * Shows a compact indicator when files were skipped during scan,
 * with an expandable panel showing details.
 */
export function SkippedFilesIndicator({
  skippedFiles,
  skippedCount,
  className,
}: SkippedFilesIndicatorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const count = skippedCount ?? skippedFiles.length;

  // Don't render if no skipped files
  if (count === 0) {
    return null;
  }

  const groupedFiles = groupByReason(skippedFiles);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className={className}>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "w-full justify-start gap-2 text-muted-foreground hover:text-foreground",
            "border border-dashed border-amber-500/30 bg-amber-500/5",
            "hover:bg-amber-500/10 hover:border-amber-500/50"
          )}
          data-testid="skipped-files-trigger"
        >
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <span>
            {count} file{count !== 1 ? "s" : ""} skipped during scan
          </span>
          {isOpen ? (
            <ChevronDown className="ml-auto h-4 w-4" />
          ) : (
            <ChevronRight className="ml-auto h-4 w-4" />
          )}
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent className="mt-2">
        <div
          className="rounded-md border border-amber-500/20 bg-amber-500/5 p-3 space-y-3"
          data-testid="skipped-files-content"
        >
          {/* Summary by reason */}
          <div className="flex flex-wrap gap-2">
            {Array.from(groupedFiles.entries()).map(([reason, files]) => {
              const config = SKIP_REASON_CONFIG[reason];
              return (
                <Badge
                  key={reason}
                  variant="secondary"
                  className={cn("font-normal", config.color)}
                  title={config.description}
                >
                  {config.label}: {files.length}
                </Badge>
              );
            })}
          </div>

          {/* File list (limited to first 10) */}
          {skippedFiles.length > 0 && (
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {skippedFiles.slice(0, 10).map((file, index) => {
                const config = SKIP_REASON_CONFIG[file.reason];
                return (
                  <div
                    key={`${file.path}-${index}`}
                    className="flex items-center gap-2 text-xs text-muted-foreground"
                  >
                    <FileX2 className="h-3 w-3 flex-shrink-0" />
                    <span className="truncate flex-1" title={file.path}>
                      {getFileName(file.path)}
                    </span>
                    <span className={cn("text-xs", config.color)}>
                      {config.label}
                    </span>
                  </div>
                );
              })}
              {skippedFiles.length > 10 && (
                <p className="text-xs text-muted-foreground/60 pt-1">
                  ...and {skippedFiles.length - 10} more
                </p>
              )}
            </div>
          )}

          {/* Help text */}
          <p className="text-xs text-muted-foreground/70">
            Skipped files are excluded from rename operations. Check file
            permissions or adjust filters to include them.
          </p>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
