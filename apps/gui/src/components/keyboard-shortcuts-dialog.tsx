/**
 * Keyboard Shortcuts Dialog
 *
 * Displays available keyboard shortcuts in a modal dialog.
 * Triggered by pressing "?" or from the help menu.
 */

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatShortcut, useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { Keyboard } from "lucide-react";
import { useEffect, useState } from "react";

interface KeyboardShortcutsDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/**
 * Displays a modal with all available keyboard shortcuts
 */
export function KeyboardShortcutsDialog({
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: KeyboardShortcutsDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const shortcuts = useKeyboardShortcuts();

  // Use controlled or internal state
  const open = controlledOpen ?? internalOpen;
  const onOpenChange = controlledOnOpenChange ?? setInternalOpen;

  // Listen for "?" key to open dialog
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger when typing in inputs
      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      // Open on "?" (Shift+/)
      if (event.key === "?" || (event.shiftKey && event.key === "/")) {
        event.preventDefault();
        onOpenChange(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            Keyboard Shortcuts
          </DialogTitle>
          <DialogDescription>
            Quick access to common actions
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2 py-4">
          {shortcuts.map((shortcut, index) => (
            <div
              key={index}
              className="flex items-center justify-between py-2 border-b border-border/50 last:border-0"
            >
              <span className="text-sm text-foreground">
                {shortcut.description}
              </span>
              <kbd className="inline-flex items-center gap-1 rounded border border-border bg-muted px-2 py-1 font-mono text-xs text-muted-foreground">
                {formatShortcut(shortcut)}
              </kbd>
            </div>
          ))}

          {/* Always-available shortcut */}
          <div className="flex items-center justify-between py-2 border-b border-border/50">
            <span className="text-sm text-foreground">
              Show this dialog
            </span>
            <kbd className="inline-flex items-center gap-1 rounded border border-border bg-muted px-2 py-1 font-mono text-xs text-muted-foreground">
              ?
            </kbd>
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Press <kbd className="px-1 py-0.5 bg-muted rounded">Esc</kbd> to close
        </p>
      </DialogContent>
    </Dialog>
  );
}
