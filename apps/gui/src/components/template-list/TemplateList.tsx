/**
 * Template List Component
 *
 * Displays list of saved templates with actions to edit, delete, and set default.
 * Uses slide-over animation for editing to maintain navigation context.
 *
 * Story 6.3 - AC2: Template List Display, AC5: Delete Template
 */

import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Plus, Star, Trash2, Edit2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { TemplateEditor } from "@/components/template-editor/TemplateEditor";
import { cn } from "@/lib/utils";

export interface TemplateListProps {
  /** List of templates to display */
  templates: Template[];
}

export function TemplateList({ templates }: TemplateListProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { deleteTemplate, setDefaultTemplate } = useAppStore();

  // Trigger slide animation when editing state changes
  useEffect(() => {
    if (isCreating || editingTemplate) {
      // Small delay to allow DOM to update before animation
      requestAnimationFrame(() => setShowEditor(true));
    }
  }, [isCreating, editingTemplate]);

  const handleDelete = async () => {
    if (deleteId) {
      const result = await deleteTemplate(deleteId);
      setDeleteId(null);
      if (result.ok) {
        toast.success("Template deleted");
      } else {
        toast.error("Failed to delete template");
      }
    }
  };

  const handleSetDefault = async (templateId: string) => {
    const result = await setDefaultTemplate(templateId);
    if (result.ok) {
      toast.success("Default template updated");
    } else {
      toast.error("Failed to set default template");
    }
  };

  const handleCloseEditor = () => {
    setShowEditor(false);
    // Wait for animation to complete before clearing state
    setTimeout(() => {
      setIsCreating(false);
      setEditingTemplate(null);
    }, 200);
  };

  const isEditing = isCreating || editingTemplate;

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden"
      data-testid="template-list"
    >
      {/* Slide container for smooth transitions */}
      <div
        className={cn(
          "transition-transform duration-200 ease-out",
          showEditor && "-translate-x-full"
        )}
      >
        {/* Template List View */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-medium text-muted-foreground">
              {templates.length} template{templates.length !== 1 ? "s" : ""}
            </h3>
            <Button
              size="sm"
              onClick={() => setIsCreating(true)}
              data-testid="add-template-button"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Template
            </Button>
          </div>

          {templates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No templates yet.</p>
              <p className="text-sm mt-1">
                Create your first template to start organizing files.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {templates.map((template) => (
                <Card
                  key={template.id}
                  className="p-4"
                  data-testid={`template-card-${template.id}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{template.name}</span>
                        {template.isDefault && (
                          <span
                            className="inline-flex items-center text-xs text-primary"
                            data-testid="default-badge"
                          >
                            <Star className="h-3 w-3 mr-0.5 fill-current" />
                            Default
                          </span>
                        )}
                      </div>
                      <code className="text-sm text-muted-foreground mt-1 block truncate">
                        {template.pattern}
                      </code>
                      {template.fileTypes && template.fileTypes.length > 0 && (
                        <div className="flex gap-1 mt-2 flex-wrap">
                          {template.fileTypes.slice(0, 5).map((type) => (
                            <span
                              key={type}
                              className="text-xs bg-muted px-1.5 py-0.5 rounded"
                            >
                              .{type}
                            </span>
                          ))}
                          {template.fileTypes.length > 5 && (
                            <span className="text-xs text-muted-foreground">
                              +{template.fileTypes.length - 5} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex gap-1 ml-4">
                      {!template.isDefault && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleSetDefault(template.id)}
                          title="Set as default"
                          data-testid={`set-default-${template.id}`}
                        >
                          <Star className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditingTemplate(template)}
                        title="Edit template"
                        data-testid={`edit-template-${template.id}`}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteId(template.id)}
                        title="Delete template"
                        data-testid={`delete-template-${template.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Editor Panel - slides in from right */}
      {isEditing && (
        <div
          className={cn(
            "absolute inset-0 bg-background transition-transform duration-200 ease-out",
            showEditor ? "translate-x-0" : "translate-x-full"
          )}
        >
          {/* Back button header */}
          <div className="flex items-center gap-2 mb-4 pb-2 border-b">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCloseEditor}
              className="gap-1"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Templates
            </Button>
            <span className="text-sm text-muted-foreground">
              {editingTemplate ? `Editing: ${editingTemplate.name}` : "New Template"}
            </span>
          </div>

          {/* Template Editor */}
          <TemplateEditor
            template={editingTemplate ?? undefined}
            onClose={handleCloseEditor}
          />
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent data-testid="delete-confirmation">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this template? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
