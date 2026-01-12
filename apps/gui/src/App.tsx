import { useEffect, useCallback, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/stores/app-store";
import { DropZone } from "@/components/drop-zone/DropZone";
import { PreviewPanel } from "@/components/preview-panel/PreviewPanel";
import { ScanOptions } from "@/components/scan-options/ScanOptions";
import { FileStats } from "@/components/file-stats/FileStats";
import { ExportButton } from "@/components/export-button/ExportButton";
import { TitleBar } from "@/components/titlebar/TitleBar";
import { RecentFolders, addRecentFolder } from "@/components/recent-folders";
import { Onboarding } from "@/components/onboarding";
import { Toaster } from "@/components/ui/sonner";
import { openFolderDialog } from "@/lib/tauri";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";

function App() {
  const {
    error,
    loadVersion,
    loadConfig,
    selectedFolder,
    scanStatus,
    scanResult,
    scanError,
    selectFolder,
    clearFolder,
    preview,
    getFilteredFiles,
  } = useAppStore();

  // Enable keyboard shortcuts
  useKeyboardShortcuts();

  // Get filtered files for display
  const filteredFiles = getFilteredFiles();

  // Window maximized state for conditional styling
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    loadVersion();
    // Load config to restore persisted scan options (Story 6.5 - AC1)
    loadConfig();
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

  const isScanning = scanStatus === "scanning";
  const hasFolder = selectedFolder !== null;
  const hasResults = scanResult !== null && scanResult.totalCount > 0;
  const isEmpty = scanResult !== null && scanResult.totalCount === 0;
  const hasScanError = scanStatus === "error";

  return (
    <div className={`flex h-screen flex-col overflow-hidden bg-background ${!isMaximized ? 'rounded-xl border border-border/50 shadow-2xl' : ''}`}>
      {/* Title Bar with window controls */}
      <TitleBar showBreadcrumb={hasFolder} isMaximized={isMaximized} onMaximizeToggle={handleMaximizeToggle} />

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto container mx-auto px-6 py-8">
        {/* Welcome Card - shown when no folder selected */}
        {!hasFolder && (
          <Card className="mx-auto max-w-2xl">
            <CardHeader>
              <CardTitle>Bring order to your files</CardTitle>
              <CardDescription>
                Drop a folder to get started. Your files stay private and never leave your computer.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DropZone
                onFolderSelect={handleFolderDrop}
                onBrowseClick={handleBrowseClick}
                isLoading={isScanning}
                disabled={isScanning}
              />

              {/* Scan Options */}
              <ScanOptions className="mt-6" />

              {/* Recent Folders */}
              <RecentFolders
                onSelect={handleRecentFolderSelect}
                currentFolder={selectedFolder}
                className="mt-6"
              />

              {/* Error display only */}
              {error && (
                <div className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Preview Panel - shown when folder is scanned with results */}
        {hasResults && (
          <div className="mx-auto max-w-4xl space-y-6">
            {/* File Statistics Summary */}
            <FileStats files={filteredFiles} label="Files found" />

            {/* Scan Options for filtering with Re-scan button */}
            <div className="flex items-end gap-4">
              <div className="flex-1">
                <ScanOptions disabled={isScanning} />
              </div>
              <Button
                onClick={handleRescan}
                variant="secondary"
                size="sm"
                disabled={isScanning}
                className="shrink-0"
              >
                {isScanning ? "Scanning..." : "Re-scan"}
              </Button>
            </div>

            {/* Preview Panel */}
            <PreviewPanel />

            {/* Action Buttons */}
            <div className="flex gap-2">
              <ExportButton
                folder={selectedFolder!}
                files={filteredFiles}
                preview={preview ?? undefined}
              />
              <Button
                onClick={clearFolder}
                variant="outline"
                className="flex-1"
              >
                Select Different Folder
              </Button>
            </div>
          </div>
        )}

        {/* Empty state - shown when folder scanned but no files found */}
        {isEmpty && (
          <div className="mx-auto max-w-2xl space-y-6">
            {/* Empty FileStats component shows "No files found" */}
            <FileStats files={[]} />

            {/* Scan Options for retrying with different settings */}
            <div className="flex items-end gap-4">
              <div className="flex-1">
                <ScanOptions disabled={isScanning} />
              </div>
              <Button
                onClick={handleRescan}
                variant="secondary"
                size="sm"
                disabled={isScanning}
              >
                {isScanning ? "Scanning..." : "Re-scan"}
              </Button>
            </div>

            <Button onClick={clearFolder} variant="outline" className="w-full">
              Try Another Folder
            </Button>
          </div>
        )}

        {/* Error state - shown when scan failed */}
        {hasScanError && scanError && (
          <Card className="mx-auto max-w-2xl">
            <CardContent className="pt-6">
              <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
                <p className="font-medium">Failed to scan folder</p>
                <p className="mt-1">{scanError}</p>
                {/* Actionable recovery suggestions */}
                <div className="mt-3 pt-3 border-t border-destructive/20 text-xs space-y-1">
                  <p className="font-medium">Suggestions:</p>
                  <ul className="list-disc list-inside space-y-0.5 text-destructive/80">
                    {scanError.toLowerCase().includes("permission") && (
                      <li>Check that you have read access to this folder</li>
                    )}
                    {scanError.toLowerCase().includes("not found") && (
                      <li>The folder may have been moved or deleted</li>
                    )}
                    {scanError.toLowerCase().includes("network") && (
                      <li>Check your network connection if this is a remote folder</li>
                    )}
                    <li>Try selecting a different folder</li>
                    <li>Ensure the folder contains files (not just subfolders)</li>
                  </ul>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <Button onClick={handleRescan} variant="secondary" className="flex-1">
                  Retry Scan
                </Button>
                <Button onClick={clearFolder} variant="outline" className="flex-1">
                  Try Another Folder
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Footer */}
      <footer className={`border-t border-border/50 bg-muted/20 px-6 py-3 ${!isMaximized ? 'rounded-b-xl' : ''}`}>
        <div className="flex items-center justify-center text-xs text-muted-foreground/60">
          <span>Everything happens locally on your computer</span>
        </div>
      </footer>

      {/* Toast notifications */}
      <Toaster position="bottom-right" />

      {/* Onboarding for new users */}
      <Onboarding />
    </div>
  );
}

export default App;
