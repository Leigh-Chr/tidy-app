/**
 * Scan Options Component
 *
 * Provides UI controls for scan settings:
 * - Include subfolders toggle (recursive scanning)
 * - File type filter checkboxes
 *
 * Story 6.5 - Task 2: Add Scan Options UI
 */

import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useAppStore } from "@/stores/app-store";
import { cn } from "@/lib/utils";

/** File type filter option */
export interface FileTypeFilter {
  id: string;
  label: string;
  category: string;
}

/** Default file type filters (matches Tauri FileCategory) */
export const FILE_TYPE_FILTERS: FileTypeFilter[] = [
  { id: "image", label: "Images", category: "image" },
  { id: "document", label: "Documents", category: "document" },
  { id: "video", label: "Videos", category: "video" },
  { id: "audio", label: "Audio", category: "audio" },
  { id: "other", label: "Other", category: "other" },
];

/** Props for standalone usage (controlled) */
export interface ScanOptionsControlledProps {
  /** Whether to scan recursively */
  recursive: boolean;
  /** Callback when recursive option changes */
  onRecursiveChange: (recursive: boolean) => void;
  /** Selected file type categories */
  selectedFileTypes: string[];
  /** Callback when file type selection changes */
  onFileTypesChange: (fileTypes: string[]) => void;
  /** Whether the controls are disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/** Props for store-connected usage */
export interface ScanOptionsConnectedProps {
  /** Whether the controls are disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/** Combined props - either controlled or connected */
export type ScanOptionsProps = ScanOptionsControlledProps | ScanOptionsConnectedProps;

/**
 * Check if props are controlled
 */
function isControlled(props: ScanOptionsProps): props is ScanOptionsControlledProps {
  return "recursive" in props && "onRecursiveChange" in props;
}

/**
 * ScanOptions component for configuring folder scan settings
 *
 * Can be used in two modes:
 * 1. Controlled - pass all props explicitly
 * 2. Connected - automatically uses Zustand store
 *
 * Features:
 * - Toggle for recursive scanning (include subfolders)
 * - Checkbox group for file type filtering
 * - Accessible with proper ARIA labels
 */
export function ScanOptions(props: ScanOptionsProps) {
  // Get store values if not controlled
  const storeState = useAppStore((state) => state.scanOptions);
  const setScanOptions = useAppStore((state) => state.setScanOptions);

  // Determine values based on mode
  const controlled = isControlled(props);
  const recursive = controlled ? props.recursive : storeState.recursive;
  const onRecursiveChange = controlled
    ? props.onRecursiveChange
    : (value: boolean) => setScanOptions({ recursive: value });
  const selectedFileTypes = controlled ? props.selectedFileTypes : storeState.fileTypes;
  const onFileTypesChange = controlled
    ? props.onFileTypesChange
    : (value: string[]) => setScanOptions({ fileTypes: value });
  const disabled = props.disabled ?? false;
  const className = props.className;
  const handleFileTypeToggle = (category: string, checked: boolean) => {
    if (checked) {
      onFileTypesChange([...selectedFileTypes, category]);
    } else {
      onFileTypesChange(selectedFileTypes.filter((t) => t !== category));
    }
  };

  const hasFilters = selectedFileTypes.length > 0;

  return (
    <div
      className={cn("space-y-4", className)}
      data-testid="scan-options"
    >
      {/* Recursive scanning toggle */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label
            htmlFor="recursive-toggle"
            className={cn(
              "text-sm font-medium",
              disabled && "opacity-50"
            )}
          >
            Include subfolders
          </Label>
          <p className="text-xs text-muted-foreground">
            Scan all nested directories
          </p>
        </div>
        <Switch
          id="recursive-toggle"
          checked={recursive}
          onCheckedChange={onRecursiveChange}
          disabled={disabled}
          aria-label="Include subfolders in scan"
          data-testid="recursive-toggle"
        />
      </div>

      {/* File type filters */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label
            className={cn(
              "text-sm font-medium",
              disabled && "opacity-50"
            )}
          >
            Filter by type
          </Label>
          {hasFilters && (
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => onFileTypesChange([])}
              disabled={disabled}
              data-testid="clear-filters"
            >
              Clear filters
            </button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {hasFilters
            ? `Showing ${selectedFileTypes.length} type${selectedFileTypes.length !== 1 ? "s" : ""}`
            : "Showing all files"}
        </p>

        <div
          className="flex flex-wrap gap-3 pt-1"
          role="group"
          aria-label="File type filters"
        >
          {FILE_TYPE_FILTERS.map((filter) => (
            <div
              key={filter.id}
              className="flex items-center space-x-2"
            >
              <Checkbox
                id={`filter-${filter.id}`}
                checked={selectedFileTypes.includes(filter.category)}
                onCheckedChange={(checked) =>
                  handleFileTypeToggle(filter.category, checked === true)
                }
                disabled={disabled}
                data-testid={`filter-${filter.id}`}
              />
              <Label
                htmlFor={`filter-${filter.id}`}
                className={cn(
                  "text-sm cursor-pointer",
                  disabled && "opacity-50 cursor-not-allowed"
                )}
              >
                {filter.label}
              </Label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
