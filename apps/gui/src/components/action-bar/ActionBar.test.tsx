/**
 * Tests for ActionBar component
 * Story 6.4 - Task 6
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

    it("displays safety message when no changes applied", () => {
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

      expect(screen.getByTestId("action-bar-safety-message")).toBeInTheDocument();
      expect(screen.getByText(/Nothing has changed yet/)).toBeInTheDocument();
    });

    it("displays applied message when changes have been applied", () => {
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

      expect(screen.getByTestId("action-bar-applied-message")).toBeInTheDocument();
      expect(screen.getByText(/Changes have been applied/)).toBeInTheDocument();
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

      expect(screen.getByText(/3 of 5 ready files selected/)).toBeInTheDocument();
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

      expect(screen.getByText(/0 of 5 ready files selected/)).toBeInTheDocument();
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
    it("shows Clear button when files are selected", () => {
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

    it("calls onDeselectAll when clicked", async () => {
      const user = userEvent.setup();
      const onDeselectAll = vi.fn();

      render(
        <ActionBar
          summary={createMockSummary()}
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
    it("displays Apply Rename button", () => {
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
      expect(screen.getByText(/Apply Rename/)).toBeInTheDocument();
    });

    it("shows selected count in button when files selected", () => {
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

      expect(screen.getByText("(3)")).toBeInTheDocument();
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

    it("shows Applying... text when applying", () => {
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

      expect(screen.getByText("Applying...")).toBeInTheDocument();
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

  describe("summary stats", () => {
    it("displays summary statistics", () => {
      render(
        <ActionBar
          summary={createMockSummary({
            total: 10,
            ready: 5,
            conflicts: 2,
            missingData: 1,
            noChange: 2,
          })}
          selectedCount={0}
          hasApplied={false}
          isApplying={false}
          onSelectAllReady={() => {}}
          onDeselectAll={() => {}}
          onApply={() => {}}
        />
      );

      const summary = screen.getByTestId("action-bar-summary");
      expect(summary).toBeInTheDocument();
      expect(summary).toHaveTextContent("5 ready");
      expect(summary).toHaveTextContent("2 conflicts");
      expect(summary).toHaveTextContent("1 missing data");
      expect(summary).toHaveTextContent("2 no change");
      expect(summary).toHaveTextContent("10 total files");
    });

    it("hides conflict stat when zero", () => {
      render(
        <ActionBar
          summary={createMockSummary({ conflicts: 0 })}
          selectedCount={0}
          hasApplied={false}
          isApplying={false}
          onSelectAllReady={() => {}}
          onDeselectAll={() => {}}
          onApply={() => {}}
        />
      );

      expect(screen.queryByText(/conflicts/)).not.toBeInTheDocument();
    });
  });
});
