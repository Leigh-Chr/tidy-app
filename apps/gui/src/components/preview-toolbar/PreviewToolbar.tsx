/**
 * Preview Toolbar Component
 *
 * Provides search, sort, and filter controls for the preview table.
 */

import { Search, ArrowUpDown, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type SortField = "name" | "status" | "folder";
export type SortDirection = "asc" | "desc";
export type StatusFilter = "all" | "ready" | "conflict" | "missing" | "no-change";

export interface PreviewToolbarProps {
  /** Search query */
  searchQuery: string;
  /** Callback when search query changes */
  onSearchChange: (query: string) => void;
  /** Current sort field */
  sortField: SortField;
  /** Current sort direction */
  sortDirection: SortDirection;
  /** Callback when sort changes */
  onSortChange: (field: SortField, direction: SortDirection) => void;
  /** Current status filter */
  statusFilter: StatusFilter;
  /** Callback when status filter changes */
  onStatusFilterChange: (status: StatusFilter) => void;
  /** Total count of items */
  totalCount: number;
  /** Filtered count of items */
  filteredCount: number;
  /** Whether controls are disabled */
  disabled?: boolean;
  /** Additional className */
  className?: string;
}

const SORT_OPTIONS: Array<{ value: SortField; label: string }> = [
  { value: "name", label: "Name" },
  { value: "status", label: "Status" },
  { value: "folder", label: "Folder" },
];

const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "All statuses" },
  { value: "ready", label: "Ready" },
  { value: "conflict", label: "Conflicts" },
  { value: "missing", label: "Missing data" },
  { value: "no-change", label: "No change" },
];

export function PreviewToolbar({
  searchQuery,
  onSearchChange,
  sortField,
  sortDirection,
  onSortChange,
  statusFilter,
  onStatusFilterChange,
  totalCount,
  filteredCount,
  disabled = false,
  className,
}: PreviewToolbarProps) {
  const handleSortFieldChange = (value: string) => {
    onSortChange(value as SortField, sortDirection);
  };

  const toggleSortDirection = () => {
    onSortChange(sortField, sortDirection === "asc" ? "desc" : "asc");
  };

  const showFilteredCount = filteredCount !== totalCount;

  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-3 bg-muted/30 border-b",
        className
      )}
      data-testid="preview-toolbar"
    >
      {/* Search - Full width on mobile */}
      <div className="relative flex-1 min-w-0">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search files..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          disabled={disabled}
          className="pl-9 h-9 w-full sm:max-w-xs"
          data-testid="preview-search"
        />
      </div>

      {/* Controls row - wraps on mobile */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Sort */}
        <div className="flex items-center gap-1">
          <Select
            value={sortField}
            onValueChange={handleSortFieldChange}
            disabled={disabled}
          >
            <SelectTrigger className="w-[90px] sm:w-[100px] h-9" data-testid="sort-field">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <button
            onClick={toggleSortDirection}
            disabled={disabled}
            className="h-9 w-9 flex items-center justify-center rounded-md border border-input bg-background hover:bg-accent disabled:opacity-50"
            aria-label={`Sort ${sortDirection === "asc" ? "ascending" : "descending"}`}
            data-testid="sort-direction"
          >
            <ArrowUpDown
              className={cn(
                "h-4 w-4",
                sortDirection === "desc" && "rotate-180 transition-transform"
              )}
            />
          </button>
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-1">
          <Filter className="h-4 w-4 text-muted-foreground hidden sm:block" />
          <Select
            value={statusFilter}
            onValueChange={(v) => onStatusFilterChange(v as StatusFilter)}
            disabled={disabled}
          >
            <SelectTrigger className="w-[110px] sm:w-[130px] h-9" data-testid="status-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Count indicator */}
        <div className="text-sm text-muted-foreground ml-auto whitespace-nowrap">
          {showFilteredCount ? (
            <span data-testid="filtered-count">
              {filteredCount}/{totalCount}
            </span>
          ) : (
            <span data-testid="total-count">{totalCount} files</span>
          )}
        </div>
      </div>
    </div>
  );
}
