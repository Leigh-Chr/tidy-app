/**
 * Reorganization Mode Selector Component
 *
 * Allows users to choose between:
 * - "Rename only" (safe default): Files stay in their current locations
 * - "Organize": Files are moved to new locations based on folder patterns
 *
 * This component provides a clear, explicit choice for users to understand
 * the impact of their operations before executing them.
 */

import { useState } from "react";
import {
  FolderTree,
  FileType,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type {
  ReorganizationMode,
  OrganizeOptions,
  FolderStructure,
} from "@/lib/tauri";
import { cn } from "@/lib/utils";

export interface ReorganizationModeSelectorProps {
  /** Current reorganization mode */
  mode: ReorganizationMode;
  /** Callback when mode changes */
  onModeChange: (mode: ReorganizationMode) => void;
  /** Organize options (for organize mode) */
  organizeOptions?: OrganizeOptions;
  /** Callback when organize options change */
  onOrganizeOptionsChange?: (options: OrganizeOptions) => void;
  /** Available folder structures for quick selection */
  folderStructures?: FolderStructure[];
  /** Currently selected folder structure ID */
  selectedStructureId?: string | null;
  /** Callback when folder structure selection changes */
  onStructureSelect?: (structureId: string | null) => void;
  /** Base directory for organize mode */
  baseDirectory?: string;
  /** Whether the selector is disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
}

const NONE_VALUE = "__none__";

export function ReorganizationModeSelector({
  mode,
  onModeChange,
  organizeOptions,
  onOrganizeOptionsChange,
  folderStructures = [],
  selectedStructureId,
  onStructureSelect,
  baseDirectory,
  disabled = false,
  className,
}: ReorganizationModeSelectorProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const enabledStructures = folderStructures.filter((s) => s.enabled);
  const selectedStructure = enabledStructures.find(
    (s) => s.id === selectedStructureId
  );

  const handleModeChange = (newMode: ReorganizationMode) => {
    onModeChange(newMode);

    // If switching to organize mode and no options set, initialize with defaults
    if (newMode === "organize" && !organizeOptions && onOrganizeOptionsChange) {
      const defaultPattern = selectedStructure?.pattern ?? "{year}/{month}";
      onOrganizeOptionsChange({
        folderPattern: defaultPattern,
        preserveContext: false,
        contextDepth: 1,
        destinationDirectory: baseDirectory,
      });
    }
  };

  const handleStructureChange = (value: string) => {
    if (value === NONE_VALUE) {
      onStructureSelect?.(null);
      // Switching to no organization means rename-only mode
      onModeChange("rename-only");
    } else {
      onStructureSelect?.(value);
      const structure = enabledStructures.find((s) => s.id === value);
      if (structure) {
        onModeChange("organize");
        onOrganizeOptionsChange?.({
          folderPattern: structure.pattern,
          preserveContext: organizeOptions?.preserveContext ?? false,
          contextDepth: organizeOptions?.contextDepth ?? 1,
          destinationDirectory: baseDirectory,
        });
      }
    }
  };

  const handleFolderPatternChange = (pattern: string) => {
    if (onOrganizeOptionsChange && organizeOptions) {
      onOrganizeOptionsChange({
        ...organizeOptions,
        folderPattern: pattern,
      });
    }
  };

  const handlePreserveContextChange = (checked: boolean) => {
    if (onOrganizeOptionsChange && organizeOptions) {
      onOrganizeOptionsChange({
        ...organizeOptions,
        preserveContext: checked,
      });
    }
  };

  return (
    <div
      className={cn("space-y-3", className)}
      data-testid="reorganization-mode-selector"
    >
      {/* Mode Selector */}
      <div className="flex items-center gap-3">
        <TooltipProvider>
          <div className="flex gap-1 rounded-lg border bg-muted/30 p-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={mode === "rename-only" ? "secondary" : "ghost"}
                  size="sm"
                  className={cn(
                    "gap-1.5 h-8",
                    mode === "rename-only" && "bg-background shadow-sm"
                  )}
                  onClick={() => handleModeChange("rename-only")}
                  disabled={disabled}
                  data-testid="mode-rename-only"
                >
                  <FileType className="h-3.5 w-3.5" />
                  <span>Rename only</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p className="font-medium">Safest option</p>
                <p className="text-xs text-muted-foreground">
                  Files stay in their current folders
                </p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={mode === "organize" ? "secondary" : "ghost"}
                  size="sm"
                  className={cn(
                    "gap-1.5 h-8",
                    mode === "organize" && "bg-background shadow-sm"
                  )}
                  onClick={() => handleModeChange("organize")}
                  disabled={disabled}
                  data-testid="mode-organize"
                >
                  <FolderTree className="h-3.5 w-3.5" />
                  <span>Organize</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p className="font-medium">Move files to new folders</p>
                <p className="text-xs text-muted-foreground">
                  Organize by date, type, or custom pattern
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>

        {/* Folder Structure Quick Select (only in organize mode) */}
        {mode === "organize" && enabledStructures.length > 0 && (
          <Select
            value={selectedStructureId ?? NONE_VALUE}
            onValueChange={handleStructureChange}
            disabled={disabled}
          >
            <SelectTrigger
              className="w-[180px] h-8"
              aria-label="Folder pattern preset"
              data-testid="structure-select"
            >
              <SelectValue placeholder="Custom pattern">
                {selectedStructure ? (
                  <span className="truncate">{selectedStructure.name}</span>
                ) : (
                  <span className="text-muted-foreground">Custom pattern</span>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE_VALUE}>
                <span className="text-muted-foreground">Custom pattern</span>
              </SelectItem>
              {enabledStructures.map((structure) => (
                <SelectItem key={structure.id} value={structure.id}>
                  <div className="flex flex-col gap-0.5">
                    <span>{structure.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {structure.pattern}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Organize Options (only in organize mode) */}
      {mode === "organize" && (
        <div className="space-y-2 pl-1 border-l-2 border-muted ml-2">
          {/* Warning banner */}
          <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-amber-950/30 px-2 py-1.5 rounded">
            <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
            <span>Files will be moved to new folders</span>
          </div>

          {/* Folder Pattern */}
          <div className="space-y-1">
            <Label
              htmlFor="folder-pattern"
              className="text-xs font-medium text-muted-foreground"
            >
              Folder pattern
            </Label>
            <Input
              id="folder-pattern"
              value={organizeOptions?.folderPattern ?? ""}
              onChange={(e) => handleFolderPatternChange(e.target.value)}
              placeholder="{year}/{month}"
              className="h-8 text-sm font-mono"
              disabled={disabled}
              data-testid="folder-pattern-input"
            />
            <p className="text-xs text-muted-foreground">
              Use {"{year}"}, {"{month}"}, {"{day}"}, {"{category}"} placeholders
            </p>
          </div>

          {/* Advanced Options Toggle */}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setShowAdvanced(!showAdvanced)}
            data-testid="toggle-advanced"
          >
            {showAdvanced ? (
              <>
                <ChevronUp className="h-3 w-3 mr-1" />
                Hide advanced options
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3 mr-1" />
                Show advanced options
              </>
            )}
          </Button>

          {/* Advanced Options */}
          {showAdvanced && (
            <div className="space-y-3 pt-1">
              {/* Preserve Context Toggle */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label
                    htmlFor="preserve-context"
                    className={cn(
                      "text-sm font-medium",
                      disabled && "opacity-50"
                    )}
                  >
                    Preserve folder context
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Keep parent folder names in the destination
                  </p>
                </div>
                <Switch
                  id="preserve-context"
                  checked={organizeOptions?.preserveContext ?? false}
                  onCheckedChange={handlePreserveContextChange}
                  disabled={disabled}
                  data-testid="preserve-context-toggle"
                />
              </div>

              {/* Example Preview */}
              {organizeOptions?.folderPattern && (
                <div className="text-xs bg-muted/50 rounded p-2 font-mono">
                  <p className="text-muted-foreground mb-1">Example:</p>
                  <p>
                    <span className="text-muted-foreground">Input:</span>{" "}
                    /Photos/Vacation/beach.jpg
                  </p>
                  <p>
                    <span className="text-muted-foreground">Output:</span>{" "}
                    {organizeOptions.preserveContext
                      ? `/organized/Vacation/${organizeOptions.folderPattern.replace(
                          "{year}",
                          "2024"
                        ).replace("{month}", "07")}/beach.jpg`
                      : `/organized/${organizeOptions.folderPattern.replace(
                          "{year}",
                          "2024"
                        ).replace("{month}", "07")}/beach.jpg`}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
