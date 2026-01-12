/**
 * Recent Folders Component
 *
 * Displays a list of recently accessed folders for quick navigation.
 * Stores history in localStorage.
 */

import { useEffect, useState, useCallback } from "react";
import { Folder, Clock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "tidy-app-recent-folders";
const MAX_RECENT_FOLDERS = 5;

export interface RecentFolder {
  path: string;
  lastUsed: number;
  fileCount?: number;
}

export interface RecentFoldersProps {
  /** Callback when a folder is selected */
  onSelect: (path: string) => void;
  /** Current selected folder (to exclude from list) */
  currentFolder?: string | null;
  /** Additional className */
  className?: string;
}

/**
 * Load recent folders from localStorage
 */
function loadRecentFolders(): RecentFolder[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored) as RecentFolder[];
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
 * Get folder name from path
 */
function getFolderName(path: string): string {
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] || path;
}

/**
 * Truncate path for display
 */
function truncatePath(path: string, maxLength = 40): string {
  if (path.length <= maxLength) return path;

  const parts = path.split(/[/\\]/);
  if (parts.length <= 3) return path;

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

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
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

  if (displayFolders.length === 0) {
    return null;
  }

  return (
    <div className={cn("space-y-2", className)} data-testid="recent-folders">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Clock className="h-4 w-4" />
        <span>Recent folders</span>
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
