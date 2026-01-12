/**
 * DropZone component for folder selection via drag-and-drop
 * Story 6.2 Task 1: Implement DropZone Component
 *
 * Uses Tauri's native drag-drop events for actual file path handling,
 * with HTML5 drag-drop for visual states and browser preview fallback.
 */

import { useState, useCallback, useEffect, DragEvent } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { Loader2, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface DropZoneProps {
  /** Callback when a folder is selected via drag-drop */
  onFolderSelect: (path: string) => void;
  /** Callback when browse button is clicked */
  onBrowseClick?: () => void;
  /** Whether the drop zone is disabled */
  disabled?: boolean;
  /** Whether scanning is in progress */
  isLoading?: boolean;
}

type DropZoneState = "default" | "hover" | "loading";

/**
 * Check if we're running inside Tauri
 * Uses the official isTauri function from @tauri-apps/api/core (Tauri 2.0+)
 */
function isTauriEnvironment(): boolean {
  return isTauri();
}

/**
 * DropZone component for folder selection
 *
 * Features:
 * - Tauri native drag-drop support (provides full file paths)
 * - HTML5 drag-drop fallback for browser preview
 * - Visual states: default, hover, loading, disabled
 * - Browse button integration
 * - Privacy messaging
 */
export function DropZone({
  onFolderSelect,
  onBrowseClick,
  disabled = false,
  isLoading = false,
}: DropZoneProps) {
  const [dragState, setDragState] = useState<DropZoneState>("default");

  // Set up Tauri native drag-drop event listener
  useEffect(() => {
    if (!isTauriEnvironment() || disabled || isLoading) {
      return;
    }

    let unlisten: (() => void) | undefined;

    async function setupTauriDragDrop() {
      try {
        const { getCurrentWebview } = await import("@tauri-apps/api/webview");
        const webview = getCurrentWebview();

        unlisten = await webview.onDragDropEvent((event) => {
          const { type } = event.payload;

          if (type === "enter" || type === "over") {
            setDragState("hover");
          } else if (type === "leave") {
            setDragState("default");
          } else if (type === "drop") {
            setDragState("default");
            // Tauri provides full file system paths
            const paths = event.payload.paths;
            if (paths && paths.length > 0) {
              // Use the first dropped path (folder or file's parent)
              onFolderSelect(paths[0]);
            }
          }
        });
      } catch {
        // Tauri API not available (running in browser)
      }
    }

    setupTauriDragDrop();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, [disabled, isLoading, onFolderSelect]);

  // HTML5 drag handlers for visual states and browser fallback
  const handleDragEnter = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (disabled || isLoading) return;
      // Only update visual state if not in Tauri (Tauri handles its own events)
      if (!isTauriEnvironment()) {
        setDragState("hover");
      }
    },
    [disabled, isLoading]
  );

  const handleDragOver = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (disabled || isLoading) return;
      if (!isTauriEnvironment()) {
        setDragState("hover");
      }
    },
    [disabled, isLoading]
  );

  const handleDragLeave = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (disabled || isLoading) return;
      if (!isTauriEnvironment()) {
        setDragState("default");
      }
    },
    [disabled, isLoading]
  );

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setDragState("default");

      if (disabled || isLoading) return;

      // In Tauri, the native event handler above processes the drop
      // This fallback only runs in browser preview mode
      if (isTauriEnvironment()) {
        return;
      }

      const items = e.dataTransfer.items;
      if (!items || items.length === 0) return;

      // Process the first item (browser fallback)
      const item = items[0];

      if (item.webkitGetAsEntry) {
        const entry = item.webkitGetAsEntry();
        if (entry && entry.isDirectory) {
          const path = (entry as FileSystemDirectoryEntry).fullPath || entry.name;
          onFolderSelect(path);
        }
      } else {
        const files = e.dataTransfer.files;
        if (files.length > 0) {
          onFolderSelect(files[0].name);
        }
      }
    },
    [disabled, isLoading, onFolderSelect]
  );

  const handleBrowseClick = useCallback(() => {
    if (disabled || isLoading) return;
    onBrowseClick?.();
  }, [disabled, isLoading, onBrowseClick]);

  // Determine visual state
  const isHover = dragState === "hover";
  const showLoading = isLoading;

  // Build class names based on state
  const containerClasses = cn(
    "flex min-h-[200px] items-center justify-center rounded-lg border-2 border-dashed",
    "transition-all duration-200 ease-out",
    // Default state
    !isHover && !showLoading && !disabled && "border-muted-foreground/25 bg-muted/50 hover:border-muted-foreground/40",
    // Hover state (drag over) - enhanced feedback
    isHover && "border-primary bg-primary/10 scale-[1.02] shadow-lg shadow-primary/20 ring-4 ring-primary/10",
    // Disabled state
    disabled && "opacity-50 cursor-not-allowed border-muted-foreground/25 bg-muted/30",
    // Loading state
    showLoading && "border-muted-foreground/25 bg-muted/50"
  );

  return (
    <div
      data-testid="drop-zone"
      className={containerClasses}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="text-center px-4">
        {showLoading ? (
          // Loading state
          <div className="space-y-2" role="status" aria-live="polite" aria-label="Scanning files">
            <div className="flex items-center justify-center gap-2">
              <Loader2
                className="h-5 w-5 text-primary animate-spin"
                aria-hidden="true"
              />
              <span className="text-muted-foreground">Scanning files...</span>
            </div>
          </div>
        ) : isHover ? (
          // Hover/drag over state - enhanced visual feedback
          <div className="space-y-3">
            <FolderOpen
              className="h-12 w-12 mx-auto text-primary animate-bounce"
              aria-hidden="true"
            />
            <p className="text-primary font-semibold text-lg">Drop to scan</p>
            <p className="text-sm text-muted-foreground">
              Release to start scanning
            </p>
          </div>
        ) : (
          // Default state
          <div className="space-y-3">
            <p className="text-muted-foreground">Drop a folder here</p>
            <div className="flex items-center justify-center gap-2">
              <span className="text-sm text-muted-foreground">or</span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleBrowseClick}
                disabled={disabled}
              >
                Browse
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              Your files never leave your computer
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
