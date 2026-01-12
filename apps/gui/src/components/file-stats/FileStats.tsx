/**
 * File Statistics Display Component
 *
 * Shows summary statistics for scanned files:
 * - Total file count
 * - Count per file category
 * - Total size (human-readable)
 *
 * Story 6.5 - Task 4: Create Statistics Display Component
 */

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { FileInfo, FileCategory } from "@/lib/tauri";

/** Category display configuration */
interface CategoryConfig {
  label: string;
  color: string;
}

/** Category configuration map */
const CATEGORY_CONFIG: Record<FileCategory, CategoryConfig> = {
  image: { label: "Images", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  document: { label: "Documents", color: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  video: { label: "Videos", color: "bg-purple-500/10 text-purple-600 dark:text-purple-400" },
  audio: { label: "Audio", color: "bg-green-500/10 text-green-600 dark:text-green-400" },
  archive: { label: "Archives", color: "bg-slate-500/10 text-slate-600 dark:text-slate-400" },
  code: { label: "Code", color: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400" },
  data: { label: "Data", color: "bg-orange-500/10 text-orange-600 dark:text-orange-400" },
  other: { label: "Other", color: "bg-gray-500/10 text-gray-600 dark:text-gray-400" },
};

export interface FileStatsProps {
  /** List of files to compute statistics from */
  files: FileInfo[];
  /** Label for the stats (e.g., "Files found", "Filtered results") */
  label?: string;
  /** Whether to show category breakdown */
  showCategories?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Compute statistics from a list of files
 */
export function computeFileStats(files: FileInfo[]) {
  const byCategory: Record<string, number> = {};
  let totalSize = 0;

  for (const file of files) {
    byCategory[file.category] = (byCategory[file.category] || 0) + 1;
    totalSize += file.size;
  }

  return {
    total: files.length,
    byCategory,
    totalSize,
  };
}

/**
 * FileStats component for displaying file statistics
 *
 * Features:
 * - Total file count with human-readable size
 * - Category breakdown with color-coded badges
 * - Empty state messaging
 * - Accessible with proper ARIA labels
 */
export function FileStats({
  files,
  label = "Files",
  showCategories = true,
  className,
}: FileStatsProps) {
  const stats = computeFileStats(files);

  // Empty state
  if (stats.total === 0) {
    return (
      <Card className={cn("", className)} data-testid="file-stats">
        <CardContent className="py-6">
          <div className="text-center text-muted-foreground" data-testid="file-stats-empty">
            <p className="text-lg font-medium">No files found</p>
            <p className="text-sm">Try adjusting your filters or scanning a different folder</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Sort categories by count (descending)
  const sortedCategories = Object.entries(stats.byCategory)
    .sort(([, a], [, b]) => b - a)
    .filter(([, count]) => count > 0);

  return (
    <Card className={cn("", className)} data-testid="file-stats">
      <CardContent className="py-4">
        <div className="flex items-center justify-between">
          {/* Main stats */}
          <div className="flex items-center gap-6">
            <div className="text-center" data-testid="file-stats-total">
              <p
                className="text-2xl font-bold text-foreground"
                aria-label={`${stats.total} ${label.toLowerCase()}`}
              >
                {stats.total.toLocaleString()}
              </p>
              <p className="text-sm text-muted-foreground">{label}</p>
            </div>

            <div className="h-8 w-px bg-border" aria-hidden="true" />

            <div className="text-center" data-testid="file-stats-size">
              <p
                className="text-2xl font-bold text-foreground"
                aria-label={`Total size: ${formatBytes(stats.totalSize)}`}
              >
                {formatBytes(stats.totalSize)}
              </p>
              <p className="text-sm text-muted-foreground">Total size</p>
            </div>
          </div>

          {/* Category badges */}
          {showCategories && sortedCategories.length > 0 && (
            <div
              className="flex flex-wrap gap-2 max-w-xs justify-end"
              role="group"
              aria-label="File categories"
              data-testid="file-stats-categories"
            >
              {sortedCategories.map(([category, count]) => {
                const config = CATEGORY_CONFIG[category as FileCategory] || {
                  label: category,
                  color: "bg-gray-500/10 text-gray-600 dark:text-gray-400",
                };
                return (
                  <Badge
                    key={category}
                    variant="secondary"
                    className={cn("font-normal", config.color)}
                    data-testid={`category-badge-${category}`}
                  >
                    {config.label}: {count}
                  </Badge>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
