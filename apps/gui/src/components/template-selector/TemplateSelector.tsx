/**
 * Template Selector Component
 *
 * Dropdown for selecting templates to generate previews.
 *
 * Story 6.4 - AC7: Template Switching
 */

import { FileText, Star } from "lucide-react";
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
}

export function TemplateSelector({
  templates,
  selectedId,
  onSelect,
  disabled = false,
  className,
}: TemplateSelectorProps) {
  const selectedTemplate = templates.find((t) => t.id === selectedId);

  return (
    <div className={cn("flex items-center gap-2", className)} data-testid="template-selector">
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
  );
}
