/**
 * Help & About Dialog Component
 *
 * Displays:
 * - Application version information
 * - Documentation link
 * - License information
 * - Keyboard shortcuts
 * - Quick start guide
 *
 * Story 6.5 - Task 5: Create Help/About Dialog
 */

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { HelpCircle, ExternalLink, Keyboard, Rocket, Info } from "lucide-react";
import { getVersion, type VersionInfo } from "@/lib/tauri";
import { cn } from "@/lib/utils";

/** Props for the HelpDialog component */
export interface HelpDialogProps {
  /** Custom className for the trigger button */
  triggerClassName?: string;
  /** Control open state externally */
  open?: boolean;
  /** Callback when open state changes */
  onOpenChange?: (open: boolean) => void;
}

/** Keyboard shortcut definition */
interface KeyboardShortcut {
  id: string;
  keys: string[];
  description: string;
}

/** Keyboard shortcuts available in the application */
const KEYBOARD_SHORTCUTS: KeyboardShortcut[] = [
  { id: "open-folder", keys: ["Ctrl/⌘", "O"], description: "Open folder picker" },
  { id: "select-all", keys: ["Ctrl/⌘", "A"], description: "Select all ready files" },
  { id: "deselect-all", keys: ["Ctrl/⌘", "D"], description: "Deselect all files" },
  { id: "rename", keys: ["Ctrl/⌘", "Enter"], description: "Apply renames" },
  { id: "escape", keys: ["Esc"], description: "Cancel / Go back" },
  { id: "shift-click", keys: ["Shift", "Click"], description: "Select range of files" },
];

/** Quick start steps */
const QUICK_START_STEPS = [
  "Select a folder containing files you want to organize",
  "Choose a naming template or create a custom one",
  "Review the preview to see proposed changes",
  "Apply the renames with a single click",
];

/**
 * HelpDialog component for displaying help and about information
 */
export function HelpDialog({
  triggerClassName,
  open,
  onOpenChange,
}: HelpDialogProps) {
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);

  // Load version info when dialog opens
  useEffect(() => {
    const loadVersion = async () => {
      try {
        const info = await getVersion();
        setVersionInfo(info);
      } catch {
        // Fallback if Tauri command fails (e.g., in dev mode)
        setVersionInfo({ version: "dev", core_version: "dev" });
      }
    };
    loadVersion();
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(triggerClassName)}
          data-testid="help-dialog-trigger"
          aria-label="Help"
        >
          <HelpCircle className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Help & About</DialogTitle>
          <DialogDescription>
            Tidy App helps you organize and rename files with ease.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Version Information */}
          <section data-testid="version-info">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-2">
              <Info className="h-4 w-4" />
              Version Information
            </h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="text-muted-foreground">App Version:</div>
              <div className="font-mono" data-testid="app-version">
                {versionInfo?.version ?? "Loading..."}
              </div>
              <div className="text-muted-foreground">Core Version:</div>
              <div className="font-mono" data-testid="core-version">
                {versionInfo?.core_version ?? "Loading..."}
              </div>
            </div>
          </section>

          <Separator />

          {/* Quick Start Guide */}
          <section data-testid="quick-start-guide">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-2">
              <Rocket className="h-4 w-4" />
              Quick Start Guide
            </h3>
            <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
              {QUICK_START_STEPS.map((step, index) => (
                <li key={index}>{step}</li>
              ))}
            </ol>
          </section>

          <Separator />

          {/* Keyboard Shortcuts */}
          <section data-testid="keyboard-shortcuts">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-2">
              <Keyboard className="h-4 w-4" />
              Keyboard Shortcuts
            </h3>
            <div className="space-y-2">
              {KEYBOARD_SHORTCUTS.map((shortcut) => (
                <div
                  key={shortcut.id}
                  className="flex items-center justify-between text-sm"
                  data-testid={`shortcut-${shortcut.id}`}
                >
                  <span className="text-muted-foreground">
                    {shortcut.description}
                  </span>
                  <div className="flex gap-1">
                    {shortcut.keys.map((key, i) => (
                      <kbd
                        key={i}
                        className="px-2 py-0.5 text-xs font-mono bg-muted rounded border border-border"
                      >
                        {key}
                      </kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <Separator />

          {/* Documentation & License */}
          <section>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-2">
              <ExternalLink className="h-4 w-4" />
              Resources
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Documentation:</span>
                <a
                  href="https://github.com/your-org/tidy-app#readme"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline flex items-center gap-1"
                  data-testid="documentation-link"
                >
                  View on GitHub
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <div
                className="flex items-center justify-between"
                data-testid="license-info"
              >
                <span className="text-muted-foreground">License:</span>
                <span className="font-medium">MIT License</span>
              </div>
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
