/**
 * Tests for ActionBar component
 * Story 6.4 - Task 6
 *
 * Updated for simplified "Calm & Confident" design:
 * - Stats moved to tooltip
 * - Minimal selection display
 * - Focus on main CTA
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ActionBar } from "./ActionBar";
import type { PreviewSummary } from "@/lib/tauri";

const createMockSummary = (overrides?: Partial<PreviewSummary>): PreviewSummary => ({
  total: 10,
  ready: 5,
  conflicts: 2,
  missingData: 1,
  noChange: 2,
  invalidName: 0,
  ...overrides,
});

describe("ActionBar", () => {
  describe("rendering", () => {
    it("renders with data-testid", () => {
      render(
        <ActionBar
          summary={createMockSummary()}
          selectedCount={0}
          hasApplied={false}
          isApplying={false}
          onSelectAllReady={() => {}}
          onDeselectAll={() => {}}
          onApply={() => {}}
        />
      );

      expect(screen.getByTestId("action-bar")).toBeInTheDocument();
    });

    it("displays Done state when changes have been applied", () => {
      render(
        <ActionBar
          summary={createMockSummary()}
          selectedCount={0}
          hasApplied={true}
          isApplying={false}
          onSelectAllReady={() => {}}
          onDeselectAll={() => {}}
          onApply={() => {}}
        />
      );

      expect(screen.getByText("Done")).toBeInTheDocument();
    });
  });

  describe("selection count", () => {
    it("displays selection count", () => {
      render(
        <ActionBar
          summary={createMockSummary({ ready: 5 })}
          selectedCount={3}
          hasApplied={false}
          isApplying={false}
          onSelectAllReady={() => {}}
          onDeselectAll={() => {}}
          onApply={() => {}}
        />
      );

      expect(screen.getByTestId("action-bar-selection")).toHaveTextContent("3 selected");
    });

    it("shows zero selection when nothing selected", () => {
      render(
        <ActionBar
          summary={createMockSummary({ ready: 5 })}
          selectedCount={0}
          hasApplied={false}
          isApplying={false}
          onSelectAllReady={() => {}}
          onDeselectAll={() => {}}
          onApply={() => {}}
        />
      );

      expect(screen.getByTestId("action-bar-selection")).toHaveTextContent("0 selected");
    });

    it("shows 'of X ready' when there are issues", () => {
      render(
        <ActionBar
          summary={createMockSummary({ ready: 5, conflicts: 2 })}
          selectedCount={3}
          hasApplied={false}
          isApplying={false}
          onSelectAllReady={() => {}}
          onDeselectAll={() => {}}
          onApply={() => {}}
        />
      );

      expect(screen.getByTestId("action-bar-selection")).toHaveTextContent("of 5 ready");
    });
  });

  describe("select all button", () => {
    it("shows Select All button when not all ready files selected", () => {
      render(
        <ActionBar
          summary={createMockSummary({ ready: 5 })}
          selectedCount={2}
          hasApplied={false}
          isApplying={false}
          onSelectAllReady={() => {}}
          onDeselectAll={() => {}}
          onApply={() => {}}
        />
      );

      expect(screen.getByTestId("action-bar-select-all")).toBeInTheDocument();
    });

    it("hides Select All button when all ready files selected", () => {
      render(
        <ActionBar
          summary={createMockSummary({ ready: 5 })}
          selectedCount={5}
          hasApplied={false}
          isApplying={false}
          onSelectAllReady={() => {}}
          onDeselectAll={() => {}}
          onApply={() => {}}
        />
      );

      expect(screen.queryByTestId("action-bar-select-all")).not.toBeInTheDocument();
    });

    it("hides Select All button when no ready files", () => {
      render(
        <ActionBar
          summary={createMockSummary({ ready: 0 })}
          selectedCount={0}
          hasApplied={false}
          isApplying={false}
          onSelectAllReady={() => {}}
          onDeselectAll={() => {}}
          onApply={() => {}}
        />
      );

      expect(screen.queryByTestId("action-bar-select-all")).not.toBeInTheDocument();
    });

    it("calls onSelectAllReady when clicked", async () => {
      const user = userEvent.setup();
      const onSelectAllReady = vi.fn();

      render(
        <ActionBar
          summary={createMockSummary({ ready: 5 })}
          selectedCount={2}
          hasApplied={false}
          isApplying={false}
          onSelectAllReady={onSelectAllReady}
          onDeselectAll={() => {}}
          onApply={() => {}}
        />
      );

      await user.click(screen.getByTestId("action-bar-select-all"));

      expect(onSelectAllReady).toHaveBeenCalled();
    });
  });

  describe("clear button", () => {
    it("shows Clear button when files are selected but not all", () => {
      render(
        <ActionBar
          summary={createMockSummary({ ready: 5 })}
          selectedCount={3}
          hasApplied={false}
          isApplying={false}
          onSelectAllReady={() => {}}
          onDeselectAll={() => {}}
          onApply={() => {}}
        />
      );

      expect(screen.getByTestId("action-bar-deselect-all")).toBeInTheDocument();
    });

    it("hides Clear button when no files selected", () => {
      render(
        <ActionBar
          summary={createMockSummary()}
          selectedCount={0}
          hasApplied={false}
          isApplying={false}
          onSelectAllReady={() => {}}
          onDeselectAll={() => {}}
          onApply={() => {}}
        />
      );

      expect(screen.queryByTestId("action-bar-deselect-all")).not.toBeInTheDocument();
    });

    it("hides Clear button when all ready files are selected", () => {
      render(
        <ActionBar
          summary={createMockSummary({ ready: 5 })}
          selectedCount={5}
          hasApplied={false}
          isApplying={false}
          onSelectAllReady={() => {}}
          onDeselectAll={() => {}}
          onApply={() => {}}
        />
      );

      expect(screen.queryByTestId("action-bar-deselect-all")).not.toBeInTheDocument();
    });

    it("calls onDeselectAll when clicked", async () => {
      const user = userEvent.setup();
      const onDeselectAll = vi.fn();

      render(
        <ActionBar
          summary={createMockSummary({ ready: 5 })}
          selectedCount={3}
          hasApplied={false}
          isApplying={false}
          onSelectAllReady={() => {}}
          onDeselectAll={onDeselectAll}
          onApply={() => {}}
        />
      );

      await user.click(screen.getByTestId("action-bar-deselect-all"));

      expect(onDeselectAll).toHaveBeenCalled();
    });
  });

  describe("apply button", () => {
    it("displays Rename button with file count", () => {
      render(
        <ActionBar
          summary={createMockSummary()}
          selectedCount={3}
          hasApplied={false}
          isApplying={false}
          onSelectAllReady={() => {}}
          onDeselectAll={() => {}}
          onApply={() => {}}
        />
      );

      expect(screen.getByTestId("action-bar-apply")).toBeInTheDocument();
      expect(screen.getByText("Rename 3 files")).toBeInTheDocument();
    });

    it("shows singular 'file' for single selection", () => {
      render(
        <ActionBar
          summary={createMockSummary()}
          selectedCount={1}
          hasApplied={false}
          isApplying={false}
          onSelectAllReady={() => {}}
          onDeselectAll={() => {}}
          onApply={() => {}}
        />
      );

      expect(screen.getByText("Rename 1 file")).toBeInTheDocument();
    });

    it("disables Apply button when no files selected", () => {
      render(
        <ActionBar
          summary={createMockSummary()}
          selectedCount={0}
          hasApplied={false}
          isApplying={false}
          onSelectAllReady={() => {}}
          onDeselectAll={() => {}}
          onApply={() => {}}
        />
      );

      expect(screen.getByTestId("action-bar-apply")).toBeDisabled();
    });

    it("enables Apply button when files are selected", () => {
      render(
        <ActionBar
          summary={createMockSummary()}
          selectedCount={3}
          hasApplied={false}
          isApplying={false}
          onSelectAllReady={() => {}}
          onDeselectAll={() => {}}
          onApply={() => {}}
        />
      );

      expect(screen.getByTestId("action-bar-apply")).not.toBeDisabled();
    });

    it("shows Working... text when applying", () => {
      render(
        <ActionBar
          summary={createMockSummary()}
          selectedCount={3}
          hasApplied={false}
          isApplying={true}
          onSelectAllReady={() => {}}
          onDeselectAll={() => {}}
          onApply={() => {}}
        />
      );

      expect(screen.getByText("Working...")).toBeInTheDocument();
    });

    it("disables Apply button when applying", () => {
      render(
        <ActionBar
          summary={createMockSummary()}
          selectedCount={3}
          hasApplied={false}
          isApplying={true}
          onSelectAllReady={() => {}}
          onDeselectAll={() => {}}
          onApply={() => {}}
        />
      );

      expect(screen.getByTestId("action-bar-apply")).toBeDisabled();
    });

    it("calls onApply when clicked", async () => {
      const user = userEvent.setup();
      const onApply = vi.fn();

      render(
        <ActionBar
          summary={createMockSummary()}
          selectedCount={3}
          hasApplied={false}
          isApplying={false}
          onSelectAllReady={() => {}}
          onDeselectAll={() => {}}
          onApply={onApply}
        />
      );

      await user.click(screen.getByTestId("action-bar-apply"));

      expect(onApply).toHaveBeenCalled();
    });
  });
});
