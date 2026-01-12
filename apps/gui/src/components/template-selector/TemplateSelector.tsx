/**
 * Template Selector Component
 *
 * Dropdown for selecting templates to generate previews.
 * Includes live preview of template transformation.
 *
 * Story 6.4 - AC7: Template Switching
 */

import { useMemo } from "react";
import { FileText, Star, ArrowRight } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Template } from "@/lib/tauri";
import { cn } from "@/lib/utils";

export interface TemplateSelectorProps {
  /** List of available templates */
  templates: Template[];
  /** Currently selected template ID */
  selectedId: string | null;
  /** Callback when template selection changes */
  onSelect: (templateId: string) => void;
  /** Whether the selector is disabled */
  disabled?: boolean;
  /** Optional className */
  className?: string;
  /** Show template preview example */
  showPreview?: boolean;
}

/**
 * Generate a preview example from a template pattern
 */
function generatePreviewExample(pattern: string): { original: string; result: string } {
  const now = new Date();
  const year = now.getFullYear().toString();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  const original = "vacation_photo.jpg";
  const originalName = "vacation_photo";
  const ext = "jpg";

  // Simple placeholder replacement for preview
  let result = pattern
    .replace(/\{year\}/gi, year)
    .replace(/\{month\}/gi, month)
    .replace(/\{day\}/gi, day)
    .replace(/\{date:([^}]+)\}/gi, (_match, format: string) => {
      return format
        .replace(/YYYY/g, year)
        .replace(/MM/g, month)
        .replace(/DD/g, day);
    })
    .replace(/\{original\}/gi, originalName)
    .replace(/\{name\}/gi, originalName)
    .replace(/\{ext\}/gi, ext)
    .replace(/\{extension\}/gi, ext);

  // Ensure extension is present
  if (!result.includes(".")) {
    result += "." + ext;
  }

  return { original, result };
}

export function TemplateSelector({
  templates,
  selectedId,
  onSelect,
  disabled = false,
  className,
  showPreview = true,
}: TemplateSelectorProps) {
  const selectedTemplate = templates.find((t) => t.id === selectedId);

  // Generate preview example for selected template
  const previewExample = useMemo(() => {
    if (!selectedTemplate) return null;
    return generatePreviewExample(selectedTemplate.pattern);
  }, [selectedTemplate]);

  return (
    <div className={cn("flex flex-col gap-2", className)} data-testid="template-selector">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground" aria-hidden="true">
          Template:
        </span>
        <Select
          value={selectedId ?? undefined}
          onValueChange={onSelect}
          disabled={disabled || templates.length === 0}
        >
          <SelectTrigger
            className="w-[200px]"
            aria-label="Template"
            data-testid="template-selector-trigger"
          >
            <SelectValue placeholder="Select template">
              {selectedTemplate && (
                <div className="flex items-center gap-2">
                  {selectedTemplate.isDefault ? (
                    <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                  ) : (
                    <FileText className="h-3 w-3 text-muted-foreground" />
                  )}
                  <span className="truncate">{selectedTemplate.name}</span>
                </div>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent data-testid="template-selector-content">
            {templates.map((template) => (
              <SelectItem
                key={template.id}
                value={template.id}
                data-testid={`template-option-${template.id}`}
              >
                <div className="flex items-center gap-2">
                  {template.isDefault ? (
                    <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                  ) : (
                    <FileText className="h-3 w-3 text-muted-foreground" />
                  )}
                  <span>{template.name}</span>
                  {template.isDefault && (
                    <span className="text-xs text-muted-foreground">(default)</span>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Live preview example */}
      {showPreview && previewExample && (
        <div
          className="flex items-center gap-2 text-xs text-muted-foreground pl-[72px]"
          data-testid="template-preview"
        >
          <span className="font-mono bg-muted/50 px-1.5 py-0.5 rounded">
            {previewExample.original}
          </span>
          <ArrowRight className="h-3 w-3 flex-shrink-0" />
          <span className="font-mono bg-primary/10 text-primary px-1.5 py-0.5 rounded">
            {previewExample.result}
          </span>
        </div>
      )}
    </div>
  );
}
