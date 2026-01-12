/**
 * Tests for RenameProgress component
 * Story 6.4 - Task 8
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RenameProgress } from "./RenameProgress";
import type { BatchRenameResult } from "@/lib/tauri";

const createMockResult = (overrides?: Partial<BatchRenameResult>): BatchRenameResult => ({
  success: true,
  results: [
    {
      proposalId: "1",
      originalPath: "/test/photo1.jpg",
      originalName: "photo1.jpg",
      newPath: "/test/2026-01-01_photo1.jpg",
      newName: "2026-01-01_photo1.jpg",
      outcome: "success",
    },
  ],
  summary: {
    total: 1,
    succeeded: 1,
    failed: 0,
    skipped: 0,
  },
  startedAt: "2026-01-10T12:00:00Z",
  completedAt: "2026-01-10T12:00:01Z",
  durationMs: 1000,
  ...overrides,
});

describe("RenameProgress", () => {
  describe("progress state", () => {
    it("renders progress card when in progress", () => {
      render(
        <RenameProgress
          isInProgress={true}
          progress={50}
        />
      );

      expect(screen.getByTestId("rename-progress-card")).toBeInTheDocument();
    });

    it("displays progress percentage", () => {
      render(
        <RenameProgress
          isInProgress={true}
          progress={75}
        />
      );

      expect(screen.getByText("75%")).toBeInTheDocument();
    });

    it("displays progress label", () => {
      render(
        <RenameProgress
          isInProgress={true}
          progress={50}
        />
      );

      // "Calm & Confident" text - shows "Working..." when no file count
      expect(screen.getByTestId("rename-progress-label")).toHaveTextContent(
        "Working..."
      );
    });

    it("renders progress bar", () => {
      render(
        <RenameProgress
          isInProgress={true}
          progress={50}
        />
      );

      expect(screen.getByTestId("rename-progress-bar")).toBeInTheDocument();
    });
  });

  describe("success result", () => {
    it("renders result card on success", () => {
      render(
        <RenameProgress
          isInProgress={false}
          result={createMockResult()}
        />
      );

      expect(screen.getByTestId("rename-result-card")).toBeInTheDocument();
    });

    it("displays success title", () => {
      render(
        <RenameProgress
          isInProgress={false}
          result={createMockResult()}
        />
      );

      // "Calm & Confident" text
      expect(screen.getByTestId("rename-result-title")).toHaveTextContent(
        "All done"
      );
    });

    it("displays success summary", () => {
      render(
        <RenameProgress
          isInProgress={false}
          result={createMockResult({ summary: { total: 5, succeeded: 5, failed: 0, skipped: 0 } })}
        />
      );

      expect(screen.getByTestId("rename-result-summary")).toHaveTextContent(
        "5 files renamed"
      );
    });

    it("uses singular form for single file", () => {
      render(
        <RenameProgress
          isInProgress={false}
          result={createMockResult({ summary: { total: 1, succeeded: 1, failed: 0, skipped: 0 } })}
        />
      );

      expect(screen.getByTestId("rename-result-summary")).toHaveTextContent(
        "1 file renamed"
      );
    });

    it("displays duration", () => {
      render(
        <RenameProgress
          isInProgress={false}
          result={createMockResult({ durationMs: 1234 })}
        />
      );

      expect(screen.getByTestId("rename-result-summary")).toHaveTextContent(
        "1234ms"
      );
    });
  });

  describe("partial success result", () => {
    it("displays partial success title", () => {
      render(
        <RenameProgress
          isInProgress={false}
          result={createMockResult({
            summary: { total: 5, succeeded: 3, failed: 2, skipped: 0 },
          })}
        />
      );

      // "Calm & Confident" text
      expect(screen.getByTestId("rename-result-title")).toHaveTextContent(
        "Partially done"
      );
    });

    it("shows failed count", () => {
      render(
        <RenameProgress
          isInProgress={false}
          result={createMockResult({
            summary: { total: 5, succeeded: 3, failed: 2, skipped: 0 },
          })}
        />
      );

      expect(screen.getByTestId("rename-result-summary")).toHaveTextContent(
        "2 failed"
      );
    });
  });

  describe("failure result", () => {
    it("displays failure title", () => {
      render(
        <RenameProgress
          isInProgress={false}
          result={createMockResult({
            success: false,
            summary: { total: 2, succeeded: 0, failed: 2, skipped: 0 },
          })}
        />
      );

      // "Calm & Confident" text
      expect(screen.getByTestId("rename-result-title")).toHaveTextContent(
        "Something went wrong"
      );
    });

    it("shows error details", () => {
      render(
        <RenameProgress
          isInProgress={false}
          result={createMockResult({
            success: false,
            results: [
              {
                proposalId: "1",
                originalPath: "/test/photo1.jpg",
                originalName: "photo1.jpg",
                outcome: "failed",
                error: "Permission denied",
              },
            ],
            summary: { total: 1, succeeded: 0, failed: 1, skipped: 0 },
          })}
        />
      );

      expect(screen.getByTestId("rename-result-errors")).toBeInTheDocument();
      expect(screen.getByText("photo1.jpg")).toBeInTheDocument();
      expect(screen.getByText(/Permission denied/)).toBeInTheDocument();
    });
  });

  describe("skipped files", () => {
    it("shows skipped count when present", () => {
      render(
        <RenameProgress
          isInProgress={false}
          result={createMockResult({
            summary: { total: 5, succeeded: 3, failed: 0, skipped: 2 },
          })}
        />
      );

      expect(screen.getByTestId("rename-result-summary")).toHaveTextContent(
        "2 skipped"
      );
    });
  });

  describe("actions", () => {
    it("shows undo button on success when handler provided", () => {
      render(
        <RenameProgress
          isInProgress={false}
          result={createMockResult()}
          onUndo={() => {}}
        />
      );

      expect(screen.getByTestId("rename-result-undo")).toBeInTheDocument();
    });

    it("hides undo button when no handler", () => {
      render(
        <RenameProgress
          isInProgress={false}
          result={createMockResult()}
        />
      );

      expect(screen.queryByTestId("rename-result-undo")).not.toBeInTheDocument();
    });

    it("calls onUndo when undo button clicked", async () => {
      const user = userEvent.setup();
      const onUndo = vi.fn();

      render(
        <RenameProgress
          isInProgress={false}
          result={createMockResult()}
          onUndo={onUndo}
        />
      );

      await user.click(screen.getByTestId("rename-result-undo"));

      expect(onUndo).toHaveBeenCalled();
    });

    it("shows dismiss button when handler provided", () => {
      render(
        <RenameProgress
          isInProgress={false}
          result={createMockResult()}
          onDismiss={() => {}}
        />
      );

      expect(screen.getByTestId("rename-result-dismiss")).toBeInTheDocument();
    });

    it("calls onDismiss when dismiss button clicked", async () => {
      const user = userEvent.setup();
      const onDismiss = vi.fn();

      render(
        <RenameProgress
          isInProgress={false}
          result={createMockResult()}
          onDismiss={onDismiss}
        />
      );

      await user.click(screen.getByTestId("rename-result-dismiss"));

      expect(onDismiss).toHaveBeenCalled();
    });
  });

  describe("empty states", () => {
    it("renders nothing when not in progress and no result", () => {
      const { container } = render(
        <RenameProgress
          isInProgress={false}
        />
      );

      expect(container.firstChild).toBeNull();
    });

    it("renders nothing when result is null", () => {
      const { container } = render(
        <RenameProgress
          isInProgress={false}
          result={null}
        />
      );

      expect(container.firstChild).toBeNull();
    });
  });
});
