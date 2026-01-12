/**
 * Tests for ConfirmRename component
 * Story 6.4 - Task 7
 *
 * Updated for "Calm & Confident" design:
 * - Simplified dialog text
 * - Friendly warning messages
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmRename } from "./ConfirmRename";
import type { PreviewSummary } from "@/lib/tauri";

const createMockSummary = (overrides?: Partial<PreviewSummary>): PreviewSummary => ({
  total: 10,
  ready: 5,
  conflicts: 0,
  missingData: 0,
  noChange: 5,
  invalidName: 0,
  ...overrides,
});

describe("ConfirmRename", () => {
  describe("rendering", () => {
    it("renders dialog when open", () => {
      render(
        <ConfirmRename
          open={true}
          fileCount={5}
          onConfirm={() => {}}
          onCancel={() => {}}
        />
      );

      expect(screen.getByTestId("confirm-rename-dialog")).toBeInTheDocument();
    });

    it("does not render dialog when closed", () => {
      render(
        <ConfirmRename
          open={false}
          fileCount={5}
          onConfirm={() => {}}
          onCancel={() => {}}
        />
      );

      expect(screen.queryByTestId("confirm-rename-dialog")).not.toBeInTheDocument();
    });

    it("displays file count", () => {
      render(
        <ConfirmRename
          open={true}
          fileCount={5}
          onConfirm={() => {}}
          onCancel={() => {}}
        />
      );

      expect(screen.getByTestId("confirm-rename-count")).toHaveTextContent(
        "5 files selected."
      );
    });

    it("uses singular form for single file", () => {
      render(
        <ConfirmRename
          open={true}
          fileCount={1}
          onConfirm={() => {}}
          onCancel={() => {}}
        />
      );

      expect(screen.getByTestId("confirm-rename-count")).toHaveTextContent(
        "1 file selected."
      );
    });
  });

  describe("warning message", () => {
    it("shows warning when there are conflicts", () => {
      render(
        <ConfirmRename
          open={true}
          fileCount={5}
          summary={createMockSummary({ conflicts: 2 })}
          onConfirm={() => {}}
          onCancel={() => {}}
        />
      );

      expect(screen.getByTestId("confirm-rename-warning")).toBeInTheDocument();
      expect(screen.getByText(/2 with naming conflicts/)).toBeInTheDocument();
    });

    it("shows warning when there is missing data", () => {
      render(
        <ConfirmRename
          open={true}
          fileCount={5}
          summary={createMockSummary({ missingData: 3 })}
          onConfirm={() => {}}
          onCancel={() => {}}
        />
      );

      expect(screen.getByTestId("confirm-rename-warning")).toBeInTheDocument();
      expect(screen.getByText(/3 missing required data/)).toBeInTheDocument();
    });

    it("shows both conflict and missing data warnings", () => {
      render(
        <ConfirmRename
          open={true}
          fileCount={5}
          summary={createMockSummary({ conflicts: 2, missingData: 1 })}
          onConfirm={() => {}}
          onCancel={() => {}}
        />
      );

      expect(screen.getByText(/2 with naming conflicts/)).toBeInTheDocument();
      expect(screen.getByText(/1 missing required data/)).toBeInTheDocument();
    });

    it("does not show warning when no issues", () => {
      render(
        <ConfirmRename
          open={true}
          fileCount={5}
          summary={createMockSummary({ conflicts: 0, missingData: 0 })}
          onConfirm={() => {}}
          onCancel={() => {}}
        />
      );

      expect(screen.queryByTestId("confirm-rename-warning")).not.toBeInTheDocument();
    });

    it("does not show warning when no summary provided", () => {
      render(
        <ConfirmRename
          open={true}
          fileCount={5}
          onConfirm={() => {}}
          onCancel={() => {}}
        />
      );

      expect(screen.queryByTestId("confirm-rename-warning")).not.toBeInTheDocument();
    });
  });

  describe("buttons", () => {
    it("displays Cancel button", () => {
      render(
        <ConfirmRename
          open={true}
          fileCount={5}
          onConfirm={() => {}}
          onCancel={() => {}}
        />
      );

      expect(screen.getByTestId("confirm-rename-cancel")).toBeInTheDocument();
    });

    it("displays Rename confirm button", () => {
      render(
        <ConfirmRename
          open={true}
          fileCount={5}
          onConfirm={() => {}}
          onCancel={() => {}}
        />
      );

      const confirmButton = screen.getByTestId("confirm-rename-confirm");
      expect(confirmButton).toBeInTheDocument();
      expect(confirmButton).toHaveTextContent("Rename");
    });

    it("calls onConfirm when confirm button clicked", async () => {
      const user = userEvent.setup();
      const onConfirm = vi.fn();

      render(
        <ConfirmRename
          open={true}
          fileCount={5}
          onConfirm={onConfirm}
          onCancel={() => {}}
        />
      );

      await user.click(screen.getByTestId("confirm-rename-confirm"));

      expect(onConfirm).toHaveBeenCalled();
    });

    it("calls onCancel when cancel button clicked", async () => {
      const user = userEvent.setup();
      const onCancel = vi.fn();

      render(
        <ConfirmRename
          open={true}
          fileCount={5}
          onConfirm={() => {}}
          onCancel={onCancel}
        />
      );

      await user.click(screen.getByTestId("confirm-rename-cancel"));

      expect(onCancel).toHaveBeenCalled();
    });
  });
});
