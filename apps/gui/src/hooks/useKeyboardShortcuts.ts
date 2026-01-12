/**
 * Keyboard Shortcuts Hook
 *
 * Provides global keyboard shortcuts for common actions.
 * Shortcuts are disabled when typing in input fields.
 */

import { useEffect, useCallback, useMemo } from "react";
import { useAppStore } from "@/stores/app-store";
import { openFolderDialog } from "@/lib/tauri";
import { addRecentFolder } from "@/components/recent-folders";

interface ShortcutConfig {
  /** Key to match (lowercase) */
  key: string;
  /** Requires Ctrl (Cmd on Mac) */
  ctrl?: boolean;
  /** Requires Shift */
  shift?: boolean;
  /** Requires Alt (Option on Mac) */
  alt?: boolean;
  /** Action to perform */
  action: () => void | Promise<void>;
  /** Description for help tooltip */
  description: string;
  /** Only active when condition is true */
  when?: () => boolean;
}

/**
 * Hook to register global keyboard shortcuts
 */
export function useKeyboardShortcuts() {
  const {
    selectedFolder,
    preview,
    selectedProposalIds,
    previewStatus,
    selectFolder,
    clearFolder,
    selectAllReady,
    deselectAll,
    applyRenames,
  } = useAppStore();

  const hasFolder = selectedFolder !== null;
  const hasPreview = preview !== null;
  const hasSelection = selectedProposalIds.size > 0;
  const isApplying = previewStatus === "applying";

  // Open folder dialog
  const openFolder = useCallback(async () => {
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

  // Define shortcuts - memoized to prevent useEffect from re-running
  const shortcuts: ShortcutConfig[] = useMemo(
    () => [
      {
        key: "o",
        ctrl: true,
        action: openFolder,
        description: "Open folder",
      },
      {
        key: "a",
        ctrl: true,
        action: selectAllReady,
        description: "Select all ready files",
        when: () => hasPreview && !isApplying,
      },
      {
        key: "d",
        ctrl: true,
        action: deselectAll,
        description: "Deselect all",
        when: () => hasSelection && !isApplying,
      },
      {
        key: "enter",
        ctrl: true,
        action: () => void applyRenames(),
        description: "Apply renames",
        when: () => hasSelection && !isApplying,
      },
      {
        key: "escape",
        action: () => {
          if (hasFolder) {
            clearFolder();
          }
        },
        description: "Clear selection / Go back",
        when: () => hasFolder,
      },
    ],
    [openFolder, selectAllReady, deselectAll, applyRenames, clearFolder, hasPreview, hasSelection, hasFolder, isApplying]
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      const target = event.target as HTMLElement;
      const isInputField =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      const isInDialog = target.closest('[role="dialog"]');

      // Allow Escape even in inputs/dialogs to close them
      if (event.key.toLowerCase() === "escape") {
        // In dialogs, let the dialog handle Escape naturally (don't prevent default)
        if (isInDialog) {
          return;
        }
        // Outside dialogs, handle Escape for clearing folder
      } else if (isInputField || isInDialog) {
        // Block other shortcuts in inputs/dialogs
        return;
      }

      // Find matching shortcut
      const key = event.key.toLowerCase();
      const ctrl = event.ctrlKey || event.metaKey; // Support Cmd on Mac
      const shift = event.shiftKey;
      const alt = event.altKey;

      for (const shortcut of shortcuts) {
        const ctrlMatch = shortcut.ctrl ? ctrl : !ctrl;
        const shiftMatch = shortcut.shift ? shift : !shift;
        const altMatch = shortcut.alt ? alt : !alt;
        const keyMatch = shortcut.key === key;
        const whenMatch = !shortcut.when || shortcut.when();

        if (ctrlMatch && shiftMatch && altMatch && keyMatch && whenMatch) {
          event.preventDefault();
          event.stopPropagation();
          void shortcut.action();
          return;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [shortcuts]);

  return shortcuts;
}

/**
 * Get keyboard shortcut display string
 */
export function formatShortcut(shortcut: ShortcutConfig): string {
  const isMac = navigator.platform.toLowerCase().includes("mac");
  const parts: string[] = [];

  if (shortcut.ctrl) {
    parts.push(isMac ? "⌘" : "Ctrl");
  }
  if (shortcut.shift) {
    parts.push(isMac ? "⇧" : "Shift");
  }
  if (shortcut.alt) {
    parts.push(isMac ? "⌥" : "Alt");
  }

  // Format key
  const keyDisplay =
    shortcut.key === "enter"
      ? "↵"
      : shortcut.key === "escape"
        ? "Esc"
        : shortcut.key.toUpperCase();
  parts.push(keyDisplay);

  return parts.join(isMac ? "" : "+");
}
