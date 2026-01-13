import { useEffect, useCallback, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { ChevronLeft } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  useAppStore,
  useScanState,
  usePreviewState,
  useWorkflowState,
  useFilteredFiles,
} from "@/stores/app-store";
import { DropZone } from "@/components/drop-zone/DropZone";
import { PreviewPanel } from "@/components/preview-panel/PreviewPanel";
import { ConfigureStep } from "@/components/configure-step";
import { FileStats } from "@/components/file-stats/FileStats";
import { TitleBar } from "@/components/titlebar/TitleBar";
import { RecentFolders, addRecentFolder } from "@/components/recent-folders";
import { Onboarding } from "@/components/onboarding";
import { WorkflowDots } from "@/components/workflow";
import { Toaster } from "@/components/ui/sonner";
import { openFolderDialog } from "@/lib/tauri";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { KeyboardShortcutsDialog } from "@/components/keyboard-shortcuts-dialog";
import { cn } from "@/lib/utils";
import { handleBackgroundError } from "@/lib/background-errors";

function App() {
  // Use selector hooks for better performance (PERF-001)
  // This prevents re-renders when unrelated state changes
  const { scanStatus, scanResult, scanError, selectedFolder } = useScanState();
  const { preview } = usePreviewState();
  const { workflowStep } = useWorkflowState();

  // Get stable action references (these don't change)
  const selectFolder = useAppStore((state) => state.selectFolder);
  const clearFolder = useAppStore((state) => state.clearFolder);
  const setWorkflowStep = useAppStore((state) => state.setWorkflowStep);
  const loadVersion = useAppStore((state) => state.loadVersion);
  const loadConfig = useAppStore((state) => state.loadConfig);
  const error = useAppStore((state) => state.error);

  // Enable keyboard shortcuts
  useKeyboardShortcuts();

  // Get filtered files using memoized selector (PERF-001)
  const filteredFiles = useFilteredFiles();

  // Window maximized state for conditional styling
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    // Load version and config with centralized error handling (ERR-001, P2-003)
    loadVersion().catch((err) => {
      handleBackgroundError(err, {
        operation: "load version",
        severity: "debug", // Version is non-critical
      });
    });

    // Load config to restore persisted scan options (Story 6.5 - AC1)
    loadConfig().catch((err) => {
      handleBackgroundError(err, {
        operation: "load configuration",
        severity: "error",
        showToast: true,
        toastMessage: "Failed to load configuration. Some features may not work correctly.",
      });
    });
  }, [loadVersion, loadConfig]);

  // Track window maximized state
  useEffect(() => {
    const checkMaximized = async () => {
      const maximized = await getCurrentWindow().isMaximized();
      setIsMaximized(maximized);
    };
    checkMaximized();

    const unlisten = getCurrentWindow().onResized(() => {
      void getCurrentWindow().isMaximized().then(setIsMaximized);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const handleMaximizeToggle = useCallback(async () => {
    const maximized = await getCurrentWindow().isMaximized();
    setIsMaximized(maximized);
  }, []);

  const handleBrowseClick = useCallback(async () => {
    try {
      const path = await openFolderDialog();
      if (path) {
        const result = await selectFolder(path);
        if (result.ok) {
          addRecentFolder(path, result.data.totalCount);
        }
      }
    } catch (e) {
      console.error("Failed to open folder dialog:", e);
    }
  }, [selectFolder]);

  const handleFolderDrop = useCallback(
    async (path: string) => {
      const result = await selectFolder(path);
      if (result.ok) {
        addRecentFolder(path, result.data.totalCount);
      }
    },
    [selectFolder]
  );

  const handleRecentFolderSelect = useCallback(
    async (path: string) => {
      const result = await selectFolder(path);
      if (result.ok) {
        addRecentFolder(path, result.data.totalCount);
      }
    },
    [selectFolder]
  );

  const handleRescan = useCallback(async () => {
    if (selectedFolder) {
      await selectFolder(selectedFolder);
    }
  }, [selectedFolder, selectFolder]);

  const handleBackFromConfigure = useCallback(() => {
    clearFolder();
  }, [clearFolder]);

  const handleContinueToPreview = useCallback(() => {
    setWorkflowStep("preview");
  }, [setWorkflowStep]);

  const handleBackFromPreview = useCallback(() => {
    setWorkflowStep("configure");
  }, [setWorkflowStep]);

  const handleStepClick = useCallback(
    (step: "select" | "configure" | "preview") => {
      setWorkflowStep(step);
    },
    [setWorkflowStep]
  );

  const isScanning = scanStatus === "scanning";
  const hasFolder = selectedFolder !== null;
  const hasResults = scanResult !== null && scanResult.totalCount > 0;
  const isEmpty = scanResult !== null && scanResult.totalCount === 0;
  const hasScanError = scanStatus === "error";

  // Determine which step to show
  const showSelectStep = workflowStep === "select" || !hasFolder;
  const showConfigureStep = workflowStep === "configure" && hasResults;
  const showPreviewStep = workflowStep === "preview" && hasResults && preview;

  return (
    <div className={cn(
      "flex h-screen flex-col overflow-hidden bg-background",
      !isMaximized && "rounded-xl border border-border/50 shadow-2xl"
    )}>
      {/* Title Bar with window controls */}
      <TitleBar
        showBreadcrumb={hasFolder && !showSelectStep}
        isMaximized={isMaximized}
        onMaximizeToggle={handleMaximizeToggle}
      />

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="container mx-auto px-6 py-8">
          {/* Step indicator - shown when not on select step */}
          {hasResults && !showSelectStep && (
            <div className="mb-8">
              <WorkflowDots
                currentStep={workflowStep}
                onStepClick={handleStepClick}
              />
            </div>
          )}

          {/* ===== Step 1: Select Folder ===== */}
          {showSelectStep && (
            <Card className="mx-auto max-w-2xl animate-step-in">
              <CardHeader className="text-center">
                <CardTitle className="text-2xl">Bring order to your files</CardTitle>
                <CardDescription>
                  Drop a folder to get started. Your files stay private and never leave your computer.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <DropZone
                  onFolderSelect={handleFolderDrop}
                  onBrowseClick={handleBrowseClick}
                  isLoading={isScanning}
                  disabled={isScanning}
                />

                {/* Recent Folders - compact */}
                <RecentFolders
                  onSelect={handleRecentFolderSelect}
                  currentFolder={selectedFolder}
                  className="pt-2"
                />

                {/* Error display */}
                {error && (
                  <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                    {error}
                  </div>
                )}

                {/* Scan Error */}
                {hasScanError && scanError && (
                  <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
                    <p className="font-medium">Failed to scan folder</p>
                    <p className="mt-1 text-destructive/80">{scanError}</p>
                  </div>
                )}

                {/* Empty state */}
                {isEmpty && (
                  <div className="text-center py-4 text-muted-foreground">
                    <p className="font-medium">No files found</p>
                    <p className="text-sm mt-1">Try a different folder or enable subfolder scanning</p>
                    <Button onClick={handleRescan} variant="outline" size="sm" className="mt-3">
                      Re-scan
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ===== Step 2: Configure ===== */}
          {showConfigureStep && (
            <ConfigureStep
              onContinue={handleContinueToPreview}
              onBack={handleBackFromConfigure}
            />
          )}

          {/* ===== Step 3: Preview & Apply ===== */}
          {showPreviewStep && (
            <div className="mx-auto max-w-4xl space-y-6 animate-step-in">
              {/* Back button */}
              <Button
                variant="ghost"
                onClick={handleBackFromPreview}
                className="text-muted-foreground -ml-2"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back to options
              </Button>

              {/* File Stats - compact summary */}
              <FileStats files={filteredFiles} label="Files to rename" />

              {/* Preview Panel */}
              <PreviewPanel />

              {/* Bottom action */}
              <div className="flex justify-center pt-4">
                <Button
                  onClick={clearFolder}
                  variant="ghost"
                  className="text-muted-foreground"
                >
                  Start over with different folder
                </Button>
              </div>
            </div>
          )}

          {/* Loading state for configure without preview */}
          {workflowStep === "preview" && hasResults && !preview && (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <div className="flex items-center gap-3">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <span>Preparing preview...</span>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className={cn(
        "border-t border-border/50 bg-muted/20 px-6 py-3",
        !isMaximized && "rounded-b-xl"
      )}>
        <div className="flex items-center justify-center text-xs text-muted-foreground/60">
          <span>Everything happens locally on your computer</span>
        </div>
      </footer>

      {/* Toast notifications */}
      <Toaster position="bottom-right" />

      {/* Onboarding for new users */}
      <Onboarding />

      {/* Keyboard shortcuts dialog (press ? to open) */}
      <KeyboardShortcutsDialog />
    </div>
  );
}

export default App;
