/**
 * Preview Options Component
 *
 * Collapsible section containing template selector, reorganization mode,
 * AI analysis, and folder structure options.
 *
 * Shows a summary when collapsed, full options when expanded.
 */

import { useState } from "react";
import { ChevronDown, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { TemplateSelector } from "@/components/template-selector/TemplateSelector";
import { ReorganizationModeSelector } from "@/components/reorganization-mode/ReorganizationModeSelector";
import { AiAnalysisBar } from "@/components/ai-analysis";
import { FolderTreePreview } from "@/components/folder-tree-preview";
import type { Template, FolderStructure, OrganizeOptions, RenameProposal, FileInfo, ReorganizationMode } from "@/lib/tauri";
import { cn } from "@/lib/utils";

export interface PreviewOptionsProps {
  /** Available templates */
  templates: Template[];
  /** Currently selected template ID */
  selectedTemplateId: string | null;
  /** Callback when template changes */
  onTemplateChange: (templateId: string) => void;
  /** Current reorganization mode */
  reorganizationMode: ReorganizationMode;
  /** Callback when mode changes */
  onModeChange: (mode: "rename-only" | "organize") => void;
  /** Current organize options */
  organizeOptions?: OrganizeOptions;
  /** Callback when organize options change */
  onOrganizeOptionsChange: (options: OrganizeOptions) => void;
  /** Available folder structures */
  folderStructures: FolderStructure[];
  /** Selected folder structure ID */
  selectedStructureId: string | null;
  /** Callback when folder structure changes */
  onStructureSelect: (structureId: string | null) => void;
  /** Base directory for folder organization */
  baseDirectory?: string;
  /** Proposals for folder tree preview */
  proposals?: RenameProposal[];
  /** Files for AI analysis */
  files: FileInfo[];
  /** Whether options are disabled */
  disabled?: boolean;
}

export function PreviewOptions({
  templates,
  selectedTemplateId,
  onTemplateChange,
  reorganizationMode,
  onModeChange,
  organizeOptions,
  onOrganizeOptionsChange,
  folderStructures,
  selectedStructureId,
  onStructureSelect,
  baseDirectory,
  proposals,
  files,
  disabled,
}: PreviewOptionsProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Get selected template name for summary
  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);
  const templateName = selectedTemplate?.name || "No template";

  // Build summary text
  const summaryParts: string[] = [templateName];
  if (reorganizationMode === "organize") {
    summaryParts.push("+ folders");
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="rounded-lg border bg-card">
        {/* Header - always visible */}
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full flex items-center justify-between px-4 py-3 h-auto hover:bg-muted/50"
            disabled={disabled}
          >
            <div className="flex items-center gap-2 text-sm">
              <Settings2 className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Options</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">{summaryParts.join(" ")}</span>
            </div>
            <ChevronDown
              className={cn(
                "h-4 w-4 text-muted-foreground transition-transform duration-200",
                isOpen && "rotate-180"
              )}
            />
          </Button>
        </CollapsibleTrigger>

        {/* Expanded content */}
        <CollapsibleContent>
          <div className="px-4 pb-4 space-y-4 border-t">
            {/* Template Selector */}
            {templates.length > 0 && (
              <div className="pt-4">
                <TemplateSelector
                  templates={templates}
                  selectedId={selectedTemplateId}
                  onSelect={onTemplateChange}
                  disabled={disabled}
                />
              </div>
            )}

            {/* Reorganization Mode Selector */}
            <ReorganizationModeSelector
              mode={reorganizationMode}
              onModeChange={onModeChange}
              organizeOptions={organizeOptions}
              onOrganizeOptionsChange={onOrganizeOptionsChange}
              folderStructures={folderStructures}
              selectedStructureId={selectedStructureId}
              onStructureSelect={onStructureSelect}
              baseDirectory={baseDirectory}
              disabled={disabled}
            />

            {/* Folder Tree Preview (only in organize mode) */}
            {reorganizationMode === "organize" && proposals && proposals.length > 0 && (
              <FolderTreePreview
                proposals={proposals}
                baseDirectory={baseDirectory}
                maxFolders={8}
                maxFilesPerFolder={3}
              />
            )}

            {/* AI Analysis Bar */}
            {files.length > 0 && (
              <AiAnalysisBar
                files={files}
                disabled={disabled}
              />
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
