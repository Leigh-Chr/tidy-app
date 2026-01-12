/**
 * Preview Panel Component
 *
 * Step 3 of the workflow wizard.
 * Focused on showing the preview table and applying renames.
 * Configuration options are now handled in ConfigureStep.
 *
 * Story 6.4 - Task 10: Main integration component
 */

import { useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { useAppStore } from "@/stores/app-store";
import type { RenameStatus } from "@/lib/tauri";
import { PreviewTable } from "@/components/preview-table/PreviewTable";
import { ActionBar } from "@/components/action-bar/ActionBar";
import { ConfirmRename } from "@/components/confirm-rename/ConfirmRename";
import { RenameProgress } from "@/components/rename-progress/RenameProgress";
import {
  PreviewToolbar,
  type SortField,
  type SortDirection,
  type StatusFilter,
} from "@/components/preview-toolbar";

export function PreviewPanel() {
  const {
    preview,
    previewStatus,
    previewError,
    selectedProposalIds,
    lastRenameResult,
    toggleProposalSelection,
    selectProposals,
    selectAllReady,
    deselectAll,
    applyRenames,
    clearPreview,
    aiSuggestions,
    reorganizationMode,
    setWorkflowStep,
  } = useAppStore();

  // Local state
  const [collapsedGroups, setCollapsedGroups] = useState<Set<RenameStatus>>(new Set());
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [hasApplied, setHasApplied] = useState(false);

  // Search/filter/sort state
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

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
        toast.success(`${succeeded} file${succeeded !== 1 ? "s" : ""} renamed`);
      } else {
        toast.warning(`${succeeded} renamed, ${failed} failed`);
      }
    } else {
      toast.error(`Something went wrong: ${result.error.message}`);
    }
  }, [applyRenames]);

  // Handle cancel confirmation
  const handleCancelConfirm = useCallback(() => {
    setShowConfirmation(false);
  }, []);

  // Handle dismiss result - go back to select a new folder
  const handleDismissResult = useCallback(() => {
    clearPreview();
    setHasApplied(false);
    setWorkflowStep("select");
  }, [clearPreview, setWorkflowStep]);

  // Handle sort change
  const handleSortChange = useCallback((field: SortField, direction: SortDirection) => {
    setSortField(field);
    setSortDirection(direction);
  }, []);

  // Filter and sort proposals
  const filteredPreview = useMemo(() => {
    if (!preview) return null;

    let proposals = [...preview.proposals];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      proposals = proposals.filter(
        (p) =>
          p.originalName.toLowerCase().includes(query) ||
          p.proposedName.toLowerCase().includes(query)
      );
    }

    // Apply status filter
    if (statusFilter !== "all") {
      const statusMap: Record<StatusFilter, RenameStatus | undefined> = {
        all: undefined,
        ready: "ready",
        conflict: "conflict",
        missing: "missing-data",
        "no-change": "no-change",
      };
      const targetStatus = statusMap[statusFilter];
      if (targetStatus) {
        proposals = proposals.filter((p) => p.status === targetStatus);
      }
    }

    // Apply sorting
    proposals.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case "name":
          comparison = a.originalName.localeCompare(b.originalName);
          break;
        case "status":
          comparison = a.status.localeCompare(b.status);
          break;
        case "folder":
          comparison = (a.destinationFolder ?? "").localeCompare(b.destinationFolder ?? "");
          break;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    return {
      ...preview,
      proposals,
    };
  }, [preview, searchQuery, statusFilter, sortField, sortDirection]);

  // Loading state
  if (previewStatus === "generating") {
    return (
      <div
        className="flex items-center justify-center py-16 text-muted-foreground"
        data-testid="preview-panel-loading"
      >
        <div className="flex items-center gap-3">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span>Preparing preview...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (previewStatus === "error" && previewError) {
    return (
      <div
        className="rounded-lg bg-destructive/10 p-6 text-sm text-destructive"
        data-testid="preview-panel-error"
      >
        <p className="font-medium">Something went wrong</p>
        <p className="mt-1 text-destructive/80">{previewError}</p>
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
      {/* Progress/Result Display */}
      <RenameProgress
        isInProgress={isApplying}
        progress={0}
        currentFile={isApplying ? 1 : undefined}
        totalFiles={isApplying ? selectedProposalIds.size : undefined}
        result={lastRenameResult}
        onDismiss={handleDismissResult}
      />

      {/* Preview Table */}
      {!lastRenameResult && filteredPreview && (
        <div className="border rounded-lg overflow-hidden min-h-[300px] max-h-[50vh] flex flex-col bg-card">
          {/* Search/Sort/Filter Toolbar */}
          <PreviewToolbar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            sortField={sortField}
            sortDirection={sortDirection}
            onSortChange={handleSortChange}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            totalCount={preview.proposals.length}
            filteredCount={filteredPreview.proposals.length}
            disabled={isApplying}
          />
          <div className="flex-1 overflow-hidden">
            <PreviewTable
              preview={filteredPreview}
              selectedIds={selectedProposalIds}
              onToggleSelection={toggleProposalSelection}
              onSelectRange={selectProposals}
              collapsedGroups={collapsedGroups}
              onToggleGroup={handleToggleGroup}
              aiSuggestions={aiSuggestions}
            />
          </div>
        </div>
      )}

      {/* Action Bar */}
      {!lastRenameResult && (
        <ActionBar
          summary={preview.summary}
          actionSummary={preview.actionSummary}
          reorganizationMode={reorganizationMode}
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
