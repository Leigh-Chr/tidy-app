/**
 * Template Editor Component
 *
 * Form for creating and editing templates with live preview.
 *
 * Story 6.3 - AC3: Create New Template, AC4: Edit Existing Template
 */

import { useState, useMemo, useCallback } from "react";
import { toast } from "sonner";
import { X, Plus, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAppStore, type Template } from "@/stores/app-store";

export interface TemplateEditorProps {
  /** Template to edit (undefined for new template) */
  template?: Template;
  /** Callback when editor is closed */
  onClose: () => void;
}

interface FormData {
  name: string;
  pattern: string;
  fileTypes: string[];
}

interface FormErrors {
  name?: string;
  pattern?: string;
}

const EXAMPLE_FILE = {
  name: "vacation_photo_2024.jpg",
  ext: "jpg",
  date: new Date("2024-07-15"),
};

export function TemplateEditor({ template, onClose }: TemplateEditorProps) {
  const { addTemplate, updateTemplate, configStatus } = useAppStore();
  const isEditing = !!template;
  const isSaving = configStatus === "saving";

  // Initial form data to track changes
  const initialData: FormData = useMemo(
    () => ({
      name: template?.name ?? "",
      pattern: template?.pattern ?? "{name}_{date:YYYY-MM-DD}.{ext}",
      fileTypes: template?.fileTypes ?? [],
    }),
    [template]
  );

  const [formData, setFormData] = useState<FormData>(initialData);
  const [errors, setErrors] = useState<FormErrors>({});
  const [newFileType, setNewFileType] = useState("");
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);

  // Check if form has unsaved changes
  const isDirty = useMemo(() => {
    return (
      formData.name !== initialData.name ||
      formData.pattern !== initialData.pattern ||
      formData.fileTypes.length !== initialData.fileTypes.length ||
      formData.fileTypes.some((ft, i) => ft !== initialData.fileTypes[i])
    );
  }, [formData, initialData]);

  // Handle close with unsaved changes check
  const handleClose = useCallback(() => {
    if (isDirty) {
      setShowDiscardDialog(true);
    } else {
      onClose();
    }
  }, [isDirty, onClose]);

  // Discard changes and close
  const handleDiscardAndClose = useCallback(() => {
    setShowDiscardDialog(false);
    onClose();
  }, [onClose]);

  // Live preview of pattern
  const preview = useMemo(() => {
    if (!formData.pattern) return "";
    try {
      return formData.pattern
        .replace(/{name}/gi, EXAMPLE_FILE.name.replace(/\.[^.]+$/, ""))
        .replace(/{ext}/gi, EXAMPLE_FILE.ext)
        .replace(/{date:([^}]+)}/gi, (_, format: string) => {
          return formatDate(EXAMPLE_FILE.date, format);
        })
        .replace(/{date}/gi, formatDate(EXAMPLE_FILE.date, "YYYY-MM-DD"));
    } catch {
      return "Invalid pattern";
    }
  }, [formData.pattern]);

  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = "Name is required";
    }

    if (!formData.pattern.trim()) {
      newErrors.pattern = "Pattern is required";
    } else if (!formData.pattern.includes("{")) {
      newErrors.pattern = "Pattern must contain at least one placeholder (e.g., {name})";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;

    let result;
    if (isEditing && template) {
      result = await updateTemplate(template.id, {
        name: formData.name.trim(),
        pattern: formData.pattern.trim(),
        fileTypes: formData.fileTypes,
      });
    } else {
      result = await addTemplate({
        name: formData.name.trim(),
        pattern: formData.pattern.trim(),
        fileTypes: formData.fileTypes,
        isDefault: false,
      });
    }

    if (result.ok) {
      toast.success(isEditing ? "Template updated" : "Template created");
      onClose();
    } else {
      toast.error(isEditing ? "Failed to update template" : "Failed to create template");
    }
  };

  const handleAddFileType = () => {
    const type = newFileType.trim().toLowerCase().replace(/^\./, "");
    if (type && !formData.fileTypes.includes(type)) {
      setFormData((prev) => ({
        ...prev,
        fileTypes: [...prev.fileTypes, type],
      }));
    }
    setNewFileType("");
  };

  const handleRemoveFileType = (type: string) => {
    setFormData((prev) => ({
      ...prev,
      fileTypes: prev.fileTypes.filter((t) => t !== type),
    }));
  };

  return (
    <div className="space-y-6" data-testid="template-editor">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          {isEditing ? "Edit Template" : "New Template"}
        </h3>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleClose}
          data-testid="close-editor"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Name Field */}
      <div className="space-y-2">
        <Label htmlFor="template-name">Template Name</Label>
        <Input
          id="template-name"
          value={formData.name}
          onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
          placeholder="My Template"
          aria-invalid={!!errors.name}
          data-testid="template-name-input"
        />
        {errors.name && (
          <p className="text-sm text-destructive" data-testid="name-error">
            {errors.name}
          </p>
        )}
      </div>

      {/* Pattern Field */}
      <div className="space-y-2">
        <Label htmlFor="template-pattern">Pattern</Label>
        <Input
          id="template-pattern"
          value={formData.pattern}
          onChange={(e) => setFormData((prev) => ({ ...prev, pattern: e.target.value }))}
          placeholder="{name}_{date:YYYY-MM-DD}.{ext}"
          aria-invalid={!!errors.pattern}
          data-testid="template-pattern-input"
        />
        {errors.pattern && (
          <p className="text-sm text-destructive" data-testid="pattern-error">
            {errors.pattern}
          </p>
        )}
        <div className="text-xs text-muted-foreground space-y-1">
          <p>
            <strong>Name:</strong> {"{name}"} (smart: AI or original), {"{original}"} (always original), {"{ai}"} (AI only)
          </p>
          <p>
            <strong>Other:</strong> {"{ext}"}, {"{date}"}, {"{date:FORMAT}"}, {"{year}"}, {"{month}"}, {"{day}"}
          </p>
        </div>
      </div>

      {/* Live Preview */}
      <Card className="p-4 bg-muted/50" data-testid="pattern-preview">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <Eye className="h-4 w-4" />
          Preview
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">
            Input: {EXAMPLE_FILE.name}
          </p>
          <p className="font-mono text-sm" data-testid="preview-output">
            Output: {preview || "(enter a pattern)"}
          </p>
        </div>
      </Card>

      {/* File Types */}
      <div className="space-y-2">
        <Label>File Types (optional)</Label>
        <p className="text-xs text-muted-foreground">
          Restrict this template to specific file types
        </p>
        <div className="flex gap-2">
          <Input
            value={newFileType}
            onChange={(e) => setNewFileType(e.target.value)}
            placeholder="jpg"
            className="flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddFileType();
              }
            }}
            data-testid="file-type-input"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleAddFileType}
            data-testid="add-file-type"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {formData.fileTypes.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2" data-testid="file-types-list">
            {formData.fileTypes.map((type) => (
              <span
                key={type}
                className="inline-flex items-center gap-1 text-xs bg-muted px-2 py-1 rounded"
              >
                .{type}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveFileType(type)}
                  className="h-4 w-4 p-0 hover:text-destructive hover:bg-transparent"
                  data-testid={`remove-file-type-${type}`}
                >
                  <X className="h-3 w-3" />
                </Button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button
          variant="outline"
          onClick={handleClose}
          disabled={isSaving}
          data-testid="cancel-button"
        >
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={isSaving}
          data-testid="save-button"
        >
          {isSaving ? "Saving..." : isEditing ? "Save Changes" : "Create Template"}
        </Button>
      </div>

      {/* Unsaved Changes Confirmation Dialog */}
      <AlertDialog open={showDiscardDialog} onOpenChange={setShowDiscardDialog}>
        <AlertDialogContent data-testid="discard-changes-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Discard Changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Are you sure you want to close without saving?
              Your changes will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="cancel-discard">Keep Editing</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDiscardAndClose}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="confirm-discard"
            >
              Discard Changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Helper function to format dates
function formatDate(date: Date, format: string): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return format
    .replace(/YYYY/g, String(year))
    .replace(/MM/g, month)
    .replace(/DD/g, day);
}
