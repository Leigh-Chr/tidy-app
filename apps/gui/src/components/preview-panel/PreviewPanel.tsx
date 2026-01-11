/**
 * Preview Panel Component
 *
 * Orchestrates all preview components: template selector, preview table,
 * action bar, confirmation dialog, progress display, and AI analysis.
 *
 * Story 6.4 - Task 10: Main integration component
 */

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { useAppStore } from "@/stores/app-store";
import type { RenameStatus } from "@/lib/tauri";
import { PreviewTable } from "@/components/preview-table/PreviewTable";
import { ActionBar } from "@/components/action-bar/ActionBar";
import { ConfirmRename } from "@/components/confirm-rename/ConfirmRename";
import { RenameProgress } from "@/components/rename-progress/RenameProgress";
import { TemplateSelector } from "@/components/template-selector/TemplateSelector";
import { FolderStructureSelector } from "@/components/folder-structure-selector";
import { AiAnalysisBar } from "@/components/ai-analysis";

export function PreviewPanel() {
  const {
    config,
    loadConfig,
    scanResult,
    preview,
    previewStatus,
    previewError,
    selectedProposalIds,
    lastRenameResult,
    generatePreview,
    toggleProposalSelection,
    selectAllReady,
    deselectAll,
    applyRenames,
    clearPreview,
    aiSuggestions,
    getFilteredFiles,
    scanOptions,
    selectedFolderStructureId,
    setSelectedFolderStructure,
  } = useAppStore();

  // Local state
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<RenameStatus>>(new Set());
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [hasApplied, setHasApplied] = useState(false);

  // Load config on mount
  useEffect(() => {
    if (!config) {
      loadConfig();
    }
  }, [config, loadConfig]);

  // Set default template when config loads
  useEffect(() => {
    if (config && !selectedTemplateId) {
      const defaultTemplate = config.templates.find((t) => t.isDefault);
      if (defaultTemplate) {
        setSelectedTemplateId(defaultTemplate.id);
      } else if (config.templates.length > 0) {
        setSelectedTemplateId(config.templates[0].id);
      }
    }
  }, [config, selectedTemplateId]);

  // Auto-generate preview when files are scanned and template is selected
  useEffect(() => {
    const filteredFiles = getFilteredFiles();
    if (filteredFiles.length > 0 && selectedTemplateId && config) {
      const template = config.templates.find((t) => t.id === selectedTemplateId);
      if (template && previewStatus === "idle") {
        generatePreview(filteredFiles, template.pattern);
      }
    }
  }, [scanResult, selectedTemplateId, config, previewStatus, generatePreview, getFilteredFiles]);

  // Regenerate preview when filters change (and preview already exists)
  useEffect(() => {
    const filteredFiles = getFilteredFiles();
    if (preview && selectedTemplateId && config && previewStatus === "ready") {
      const template = config.templates.find((t) => t.id === selectedTemplateId);
      if (template) {
        generatePreview(filteredFiles, template.pattern);
      }
    }
    // Only trigger on filter changes, not on other dependencies
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanOptions?.fileTypes]);

  // Handle template change
  const handleTemplateChange = useCallback(
    (templateId: string) => {
      setSelectedTemplateId(templateId);

      const filteredFiles = getFilteredFiles();
      if (filteredFiles.length > 0 && config) {
        const template = config.templates.find((t) => t.id === templateId);
        if (template) {
          generatePreview(filteredFiles, template.pattern);
        }
      }
    },
    [config, generatePreview, getFilteredFiles]
  );

  // Handle folder structure change
  const handleFolderStructureChange = useCallback(
    (structureId: string | null) => {
      setSelectedFolderStructure(structureId);

      // Regenerate preview with new folder structure
      const filteredFiles = getFilteredFiles();
      if (filteredFiles.length > 0 && config && selectedTemplateId) {
        const template = config.templates.find((t) => t.id === selectedTemplateId);
        if (template) {
          generatePreview(filteredFiles, template.pattern);
        }
      }
    },
    [config, selectedTemplateId, generatePreview, getFilteredFiles, setSelectedFolderStructure]
  );

  // Toggle collapsed state for a status group
  const handleToggleGroup = useCallback((status: RenameStatus) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(status)) {
        next.delete(status);
      } else {
        next.add(status);
      }
      return next;
    });
  }, []);

  // Handle apply button click (show confirmation)
  const handleApplyClick = useCallback(() => {
    setShowConfirmation(true);
  }, []);

  // Handle confirm rename
  const handleConfirmRename = useCallback(async () => {
    setShowConfirmation(false);
    const result = await applyRenames();

    if (result.ok) {
      setHasApplied(true);
      const { succeeded, failed } = result.data.summary;

      if (failed === 0) {
        toast.success(`Successfully renamed ${succeeded} file${succeeded !== 1 ? "s" : ""}`);
      } else {
        toast.warning(`Renamed ${succeeded} file${succeeded !== 1 ? "s" : ""}, ${failed} failed`);
      }
    } else {
      toast.error(`Rename failed: ${result.error.message}`);
    }
  }, [applyRenames]);

  // Handle cancel confirmation
  const handleCancelConfirm = useCallback(() => {
    setShowConfirmation(false);
  }, []);

  // Handle dismiss result
  const handleDismissResult = useCallback(() => {
    clearPreview();
    setHasApplied(false);
  }, [clearPreview]);

  // Loading state
  if (previewStatus === "generating") {
    return (
      <div
        className="flex items-center justify-center py-12 text-muted-foreground"
        data-testid="preview-panel-loading"
      >
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span>Generating preview...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (previewStatus === "error" && previewError) {
    return (
      <div
        className="rounded-md bg-destructive/10 p-4 text-sm text-destructive"
        data-testid="preview-panel-error"
      >
        <p className="font-medium">Failed to generate preview</p>
        <p className="mt-1">{previewError}</p>
      </div>
    );
  }

  // No preview yet
  if (!preview) {
    return null;
  }

  const selectedCount = selectedProposalIds.size;
  const isApplying = previewStatus === "applying";

  return (
    <div className="flex flex-col gap-4" data-testid="preview-panel">
      {/* Template and Folder Structure Selectors */}
      {config && (
        <div className="flex flex-wrap items-center gap-4">
          {config.templates.length > 0 && (
            <TemplateSelector
              templates={config.templates}
              selectedId={selectedTemplateId}
              onSelect={handleTemplateChange}
              disabled={isApplying}
            />
          )}
          {config.folderStructures && config.folderStructures.length > 0 && (
            <FolderStructureSelector
              structures={config.folderStructures}
              selectedId={selectedFolderStructureId}
              onSelect={handleFolderStructureChange}
              disabled={isApplying}
            />
          )}
        </div>
      )}

      {/* AI Analysis Bar */}
      {scanResult && getFilteredFiles().length > 0 && (
        <AiAnalysisBar
          files={getFilteredFiles()}
          disabled={isApplying}
        />
      )}

      {/* Progress/Result Display */}
      <RenameProgress
        isInProgress={isApplying}
        progress={isApplying ? 50 : 0} // TODO: Real progress from events
        result={lastRenameResult}
        onDismiss={handleDismissResult}
      />

      {/* Preview Table */}
      {!lastRenameResult && (
        <div
          className="border rounded-lg overflow-hidden"
          style={{ height: "400px" }}
        >
          <PreviewTable
            preview={preview}
            selectedIds={selectedProposalIds}
            onToggleSelection={toggleProposalSelection}
            collapsedGroups={collapsedGroups}
            onToggleGroup={handleToggleGroup}
            aiSuggestions={aiSuggestions}
          />
        </div>
      )}

      {/* Action Bar */}
      {!lastRenameResult && (
        <ActionBar
          summary={preview.summary}
          selectedCount={selectedCount}
          hasApplied={hasApplied}
          isApplying={isApplying}
          onSelectAllReady={selectAllReady}
          onDeselectAll={deselectAll}
          onApply={handleApplyClick}
        />
      )}

      {/* Confirmation Dialog */}
      <ConfirmRename
        open={showConfirmation}
        fileCount={selectedCount}
        summary={preview.summary}
        onConfirm={handleConfirmRename}
        onCancel={handleCancelConfirm}
      />
    </div>
  );
}
