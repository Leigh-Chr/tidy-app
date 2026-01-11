/**
 * FolderBreadcrumb component for displaying selected folder path
 * Story 6.2 Task 4.2: Add FolderBreadcrumb component
 */

import { useMemo } from "react";

export interface FolderBreadcrumbProps {
  /** Full path to the selected folder */
  path: string;
  /** Maximum display length before truncation (default: 50) */
  maxLength?: number;
  /** Callback when clear/close button is clicked */
  onClear?: () => void;
}

/**
 * Truncates a path intelligently, keeping the beginning and end visible
 */
function truncatePath(path: string, maxLength: number): string {
  if (path.length <= maxLength) {
    return path;
  }

  // Keep first and last parts visible
  const ellipsis = "...";
  const availableLength = maxLength - ellipsis.length;
  const frontLength = Math.ceil(availableLength / 2);
  const backLength = Math.floor(availableLength / 2);

  return path.slice(0, frontLength) + ellipsis + path.slice(-backLength);
}

/**
 * Displays the selected folder path with intelligent truncation
 * Full path shown on hover via title attribute
 */
export function FolderBreadcrumb({
  path,
  maxLength = 50,
  onClear,
}: FolderBreadcrumbProps) {
  const displayPath = useMemo(
    () => truncatePath(path, maxLength),
    [path, maxLength]
  );

  const isTruncated = displayPath !== path;

  return (
    <div
      className="flex items-center gap-2 text-sm"
      data-testid="folder-breadcrumb"
    >
      <svg
        className="h-4 w-4 text-muted-foreground shrink-0"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
        />
      </svg>

      <span
        className="font-mono text-foreground truncate"
        title={isTruncated ? path : undefined}
      >
        {displayPath}
      </span>

      {onClear && (
        <button
          onClick={onClear}
          className="ml-1 p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Clear folder selection"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}
    </div>
  );
}
