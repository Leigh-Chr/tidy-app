import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, X, Maximize2 } from "lucide-react";
import { useAppStore } from "@/stores/app-store";
import { FolderBreadcrumb } from "@/components/folder-breadcrumb/FolderBreadcrumb";
import { HelpDialog } from "@/components/help-dialog/HelpDialog";
import { SettingsModal } from "@/components/settings-modal/SettingsModal";
import { ModeToggle } from "@/components/ui/mode-toggle";

interface TitleBarProps {
  showBreadcrumb?: boolean;
  isMaximized?: boolean;
  onMaximizeToggle?: () => void;
}

export function TitleBar({ showBreadcrumb = true, isMaximized = false, onMaximizeToggle }: TitleBarProps) {
  const { versionInfo, selectedFolder, clearFolder } = useAppStore();

  const handleMinimize = () => {
    getCurrentWindow().minimize();
  };

  const handleMaximize = async () => {
    await getCurrentWindow().toggleMaximize();
    onMaximizeToggle?.();
  };

  const handleClose = () => {
    getCurrentWindow().close();
  };

  const handleDragStart = (e: React.MouseEvent) => {
    if (e.button === 0) {
      getCurrentWindow().startDragging();
    }
  };

  return (
    <div className={`flex h-11 items-center border-b border-border/50 bg-gradient-to-b from-muted/50 to-background/80 backdrop-blur-md ${!isMaximized ? 'rounded-t-xl' : ''}`}>
      {/* Left side - App title and version (draggable) */}
      <div
        role="presentation"
        className="flex flex-1 items-center gap-3 px-4 h-full cursor-default"
        onMouseDown={handleDragStart}
      >
        <h1 className="text-sm font-semibold text-foreground select-none">
          tidy-app
        </h1>
        {versionInfo && (
          <span className="text-xs text-muted-foreground/70 select-none">
            v{versionInfo.version}
          </span>
        )}
      </div>

      {/* Center - Breadcrumb (when folder selected) */}
      {showBreadcrumb && selectedFolder && (
        <div className="flex items-center">
          <FolderBreadcrumb path={selectedFolder} onClear={clearFolder} />
        </div>
      )}

      {/* Right side - Actions */}
      <div className="flex items-center gap-0.5 px-2">
        <ModeToggle />
        <HelpDialog />
        <SettingsModal />
      </div>

      {/* Window controls */}
      <div className="flex items-center h-full ml-1">
        <button
          className="h-11 w-11 inline-flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          onClick={handleMinimize}
          aria-label="Réduire"
        >
          <Minus className="h-4 w-4" />
        </button>
        <button
          className="h-11 w-11 inline-flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          onClick={handleMaximize}
          aria-label={isMaximized ? "Restaurer" : "Agrandir"}
        >
          {isMaximized ? (
            <Square className="h-3 w-3" />
          ) : (
            <Maximize2 className="h-3.5 w-3.5" />
          )}
        </button>
        <button
          className="h-11 w-11 inline-flex items-center justify-center text-muted-foreground hover:text-red-500 transition-colors"
          onClick={handleClose}
          aria-label="Fermer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
