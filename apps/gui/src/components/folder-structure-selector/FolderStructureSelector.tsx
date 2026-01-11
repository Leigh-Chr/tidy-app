/**
 * Folder Structure Selector Component
 *
 * Dropdown for selecting folder structures to organize files into directories.
 * Allows selecting "No organization" to disable folder organization.
 */

import { FolderTree, FolderX } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FolderStructure } from "@/lib/tauri";
import { cn } from "@/lib/utils";

export interface FolderStructureSelectorProps {
  /** List of available folder structures */
  structures: FolderStructure[];
  /** Currently selected structure ID (null for no organization) */
  selectedId: string | null;
  /** Callback when structure selection changes */
  onSelect: (structureId: string | null) => void;
  /** Whether the selector is disabled */
  disabled?: boolean;
  /** Optional className */
  className?: string;
}

const NONE_VALUE = "__none__";

export function FolderStructureSelector({
  structures,
  selectedId,
  onSelect,
  disabled = false,
  className,
}: FolderStructureSelectorProps) {
  const enabledStructures = structures.filter((s) => s.enabled);
  const selectedStructure = enabledStructures.find((s) => s.id === selectedId);

  const handleChange = (value: string) => {
    if (value === NONE_VALUE) {
      onSelect(null);
    } else {
      onSelect(value);
    }
  };

  return (
    <div className={cn("flex items-center gap-2", className)} data-testid="folder-structure-selector">
      <span className="text-sm font-medium text-muted-foreground" aria-hidden="true">
        Organize:
      </span>
      <Select
        value={selectedId ?? NONE_VALUE}
        onValueChange={handleChange}
        disabled={disabled}
      >
        <SelectTrigger
          className="w-[200px]"
          aria-label="Folder organization"
          data-testid="folder-structure-selector-trigger"
        >
          <SelectValue placeholder="No organization">
            {selectedStructure ? (
              <div className="flex items-center gap-2">
                <FolderTree className="h-3 w-3 text-muted-foreground" />
                <span className="truncate">{selectedStructure.name}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <FolderX className="h-3 w-3 text-muted-foreground" />
                <span>No organization</span>
              </div>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent data-testid="folder-structure-selector-content">
          <SelectItem
            value={NONE_VALUE}
            data-testid="folder-structure-option-none"
          >
            <div className="flex items-center gap-2">
              <FolderX className="h-3 w-3 text-muted-foreground" />
              <span>No organization</span>
            </div>
          </SelectItem>
          {enabledStructures.map((structure) => (
            <SelectItem
              key={structure.id}
              value={structure.id}
              data-testid={`folder-structure-option-${structure.id}`}
            >
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <FolderTree className="h-3 w-3 text-muted-foreground" />
                  <span>{structure.name}</span>
                </div>
                <span className="text-xs text-muted-foreground ml-5">
                  {structure.pattern}
                </span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
