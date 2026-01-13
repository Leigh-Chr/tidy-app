/**
 * Recent Folders Component
 *
 * Displays a list of recently accessed folders for quick navigation.
 * Stores history in localStorage.
 */

import { useEffect, useState, useCallback } from "react";
import { Folder, Clock, X } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Storage constants (P3-002)
const STORAGE_KEY = "tidy-app-recent-folders";
/** Maximum number of recent folders to keep in history */
const MAX_RECENT_FOLDERS = 5;

// Time constants in milliseconds (P3-002)
const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 86_400_000;

// Display constants (P3-002)
/** Maximum path length before truncation */
const MAX_PATH_DISPLAY_LENGTH = 40;
/** Minimum path parts to avoid truncation */
const MIN_PATH_PARTS_FOR_TRUNCATION = 3;
/** Number of days before showing absolute date */
const DAYS_THRESHOLD_FOR_DATE = 7;

export interface RecentFolder {
  path: string;
  lastUsed: number;
  fileCount?: number;
}

// Zod schema for localStorage validation (P3-003)
const RecentFolderSchema = z.object({
  path: z.string().min(1),
  lastUsed: z.number().int().positive(),
  fileCount: z.number().int().nonnegative().optional(),
});

const RecentFoldersArraySchema = z.array(RecentFolderSchema);

export interface RecentFoldersProps {
  /** Callback when a folder is selected */
  onSelect: (path: string) => void;
  /** Current selected folder (to exclude from list) */
  currentFolder?: string | null;
  /** Additional className */
  className?: string;
}

/**
 * Load recent folders from localStorage with Zod validation (P3-003)
 */
function loadRecentFolders(): RecentFolder[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed: unknown = JSON.parse(stored);
      const result = RecentFoldersArraySchema.safeParse(parsed);
      if (result.success) {
        return result.data;
      }
      // Invalid data - clear corrupted storage
      console.warn("Invalid recent folders data in localStorage, clearing");
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Ignore parse errors
  }
  return [];
}

/**
 * Save recent folders to localStorage
 */
function saveRecentFolders(folders: RecentFolder[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(folders));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Add a folder to recent history
 */
export function addRecentFolder(path: string, fileCount?: number): void {
  const folders = loadRecentFolders();

  // Remove existing entry if present
  const filtered = folders.filter((f) => f.path !== path);

  // Add new entry at the beginning
  const updated: RecentFolder[] = [
    { path, lastUsed: Date.now(), fileCount },
    ...filtered,
  ].slice(0, MAX_RECENT_FOLDERS);

  saveRecentFolders(updated);
}

/**
 * Remove a folder from recent history
 */
export function removeRecentFolder(path: string): void {
  const folders = loadRecentFolders();
  const updated = folders.filter((f) => f.path !== path);
  saveRecentFolders(updated);
}

/**
 * Clear all recent folders
 */
export function clearAllRecentFolders(): void {
  saveRecentFolders([]);
}

/**
 * Get folder name from path
 */
function getFolderName(path: string): string {
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] || path;
}

/**
 * Truncate path for display
 */
function truncatePath(path: string, maxLength = MAX_PATH_DISPLAY_LENGTH): string {
  if (path.length <= maxLength) return path;

  const parts = path.split(/[/\\]/);
  if (parts.length <= MIN_PATH_PARTS_FOR_TRUNCATION) return path;

  const start = parts.slice(0, 2).join("/");
  const end = parts.slice(-1)[0];
  return `${start}/.../${end}`;
}

/**
 * Format relative time
 */
function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const minutes = Math.floor(diff / MS_PER_MINUTE);
  const hours = Math.floor(diff / MS_PER_HOUR);
  const days = Math.floor(diff / MS_PER_DAY);

  if (minutes < 1) return "just now";
  if (hours < 1) return `${minutes}m ago`;
  if (days < 1) return `${hours}h ago`;
  if (days < DAYS_THRESHOLD_FOR_DATE) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

export function RecentFolders({
  onSelect,
  currentFolder,
  className,
}: RecentFoldersProps) {
  const [folders, setFolders] = useState<RecentFolder[]>([]);

  // Load folders on mount
  useEffect(() => {
    setFolders(loadRecentFolders());
  }, []);

  // Filter out current folder
  const displayFolders = folders.filter((f) => f.path !== currentFolder);

  const handleRemove = useCallback((e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    removeRecentFolder(path);
    setFolders(loadRecentFolders());
  }, []);

  const handleClearAll = useCallback(() => {
    clearAllRecentFolders();
    setFolders([]);
  }, []);

  if (displayFolders.length === 0) {
    return null;
  }

  return (
    <div className={cn("space-y-2", className)} data-testid="recent-folders">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>Recent folders</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-xs text-muted-foreground hover:text-foreground"
          onClick={handleClearAll}
          aria-label="Clear all recent folders"
          data-testid="clear-all-recent-folders"
        >
          Clear all
        </Button>
      </div>
      <div className="space-y-1">
        {displayFolders.map((folder) => (
          <button
            key={folder.path}
            onClick={() => onSelect(folder.path)}
            className="group flex items-center gap-3 w-full p-2 rounded-md text-left hover:bg-accent transition-colors"
            data-testid={`recent-folder-${folder.path}`}
          >
            <Folder className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm truncate">
                {getFolderName(folder.path)}
              </div>
              <div className="text-xs text-muted-foreground truncate" title={folder.path}>
                {truncatePath(folder.path)}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {formatRelativeTime(folder.lastUsed)}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => handleRemove(e, folder.path)}
                aria-label="Remove from recent"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
