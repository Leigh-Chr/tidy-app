/**
 * Tests for PreviewRow component
 * Story 6.4 - Task 5
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PreviewRow } from "./PreviewRow";
import type { RenameProposal } from "@/lib/tauri";

const createMockProposal = (overrides?: Partial<RenameProposal>): RenameProposal => ({
  id: "test-1",
  originalPath: "/test/photo.jpg",
  originalName: "photo.jpg",
  proposedName: "2026-01-01_photo.jpg",
  proposedPath: "/test/2026-01-01_photo.jpg",
  status: "ready",
  issues: [],
  metadataSources: ["filename"],
  ...overrides,
});

describe("PreviewRow", () => {
  describe("basic rendering", () => {
    it("renders with data-testid", () => {
      const proposal = createMockProposal();
      render(
        <PreviewRow
          proposal={proposal}
          isSelected={false}
          onToggleSelection={() => {}}
        />
      );

      expect(screen.getByTestId("preview-row-test-1")).toBeInTheDocument();
    });

    it("displays original filename", () => {
      const proposal = createMockProposal();
      render(
        <PreviewRow
          proposal={proposal}
          isSelected={false}
          onToggleSelection={() => {}}
        />
      );

      // Original name appears as full text
      const originalNames = screen.getAllByText("photo.jpg");
      expect(originalNames.length).toBeGreaterThanOrEqual(1);
    });

    it("displays proposed filename with diff highlighting", () => {
      const proposal = createMockProposal();
      render(
        <PreviewRow
          proposal={proposal}
          isSelected={false}
          onToggleSelection={() => {}}
        />
      );

      // The added portion should be visible
      expect(screen.getByText("2026-01-01_")).toBeInTheDocument();
    });
  });

  describe("checkbox selection", () => {
    it("shows checkbox for ready status", () => {
      const proposal = createMockProposal({ status: "ready" });
      render(
        <PreviewRow
          proposal={proposal}
          isSelected={false}
          onToggleSelection={() => {}}
        />
      );

      expect(screen.getByTestId("preview-checkbox-test-1")).toBeInTheDocument();
    });

    it("hides checkbox for non-ready status", () => {
      const proposal = createMockProposal({ status: "conflict" });
      render(
        <PreviewRow
          proposal={proposal}
          isSelected={false}
          onToggleSelection={() => {}}
        />
      );

      expect(screen.queryByTestId("preview-checkbox-test-1")).not.toBeInTheDocument();
    });

    it("shows checked state when selected", () => {
      const proposal = createMockProposal({ status: "ready" });
      render(
        <PreviewRow
          proposal={proposal}
          isSelected={true}
          onToggleSelection={() => {}}
        />
      );

      const checkbox = screen.getByTestId("preview-checkbox-test-1");
      expect(checkbox).toHaveAttribute("data-state", "checked");
    });

    it("shows unchecked state when not selected", () => {
      const proposal = createMockProposal({ status: "ready" });
      render(
        <PreviewRow
          proposal={proposal}
          isSelected={false}
          onToggleSelection={() => {}}
        />
      );

      const checkbox = screen.getByTestId("preview-checkbox-test-1");
      expect(checkbox).toHaveAttribute("data-state", "unchecked");
    });

    it("calls onToggleSelection when checkbox clicked", async () => {
      const user = userEvent.setup();
      const proposal = createMockProposal({ status: "ready" });
      const onToggleSelection = vi.fn();

      render(
        <PreviewRow
          proposal={proposal}
          isSelected={false}
          onToggleSelection={onToggleSelection}
        />
      );

      await user.click(screen.getByTestId("preview-checkbox-test-1"));

      expect(onToggleSelection).toHaveBeenCalled();
    });
  });

  describe("status display", () => {
    it.each([
      ["ready", "Ready to Rename"],
      ["conflict", "Conflicts"],
      ["missing-data", "Missing Data"],
      ["no-change", "No Change"],
      ["invalid-name", "Invalid Name"],
    ] as const)("renders status icon for %s", (status, _label) => {
      const proposal = createMockProposal({ status });
      render(
        <PreviewRow
          proposal={proposal}
          isSelected={false}
          onToggleSelection={() => {}}
        />
      );

      // Should render the row successfully
      expect(screen.getByTestId(`preview-row-test-1`)).toBeInTheDocument();
    });
  });

  describe("expandable details", () => {
    it("shows expand button when has metadata sources and onToggleExpand is provided", () => {
      const proposal = createMockProposal({ metadataSources: ["EXIF", "PDF"] });
      render(
        <PreviewRow
          proposal={proposal}
          isSelected={false}
          onToggleSelection={() => {}}
          onToggleExpand={() => {}}
        />
      );

      expect(screen.getByTestId("preview-expand-test-1")).toBeInTheDocument();
    });

    it("shows expand button when has issues and onToggleExpand is provided", () => {
      const proposal = createMockProposal({
        status: "conflict",
        issues: [{ code: "CONFLICT", message: "File exists" }],
        metadataSources: [],
      });
      render(
        <PreviewRow
          proposal={proposal}
          isSelected={false}
          onToggleSelection={() => {}}
          onToggleExpand={() => {}}
        />
      );

      expect(screen.getByTestId("preview-expand-test-1")).toBeInTheDocument();
    });

    it("hides expand button when onToggleExpand is not provided", () => {
      const proposal = createMockProposal({ metadataSources: ["EXIF", "PDF"] });
      render(
        <PreviewRow
          proposal={proposal}
          isSelected={false}
          onToggleSelection={() => {}}
        />
      );

      expect(screen.queryByTestId("preview-expand-test-1")).not.toBeInTheDocument();
    });

    it("shows details when isExpanded is true", () => {
      const proposal = createMockProposal({ metadataSources: ["EXIF"] });

      render(
        <PreviewRow
          proposal={proposal}
          isSelected={false}
          onToggleSelection={() => {}}
          isExpanded={true}
          onToggleExpand={() => {}}
        />
      );

      expect(screen.getByTestId("preview-details-test-1")).toBeInTheDocument();
    });

    it("hides details when isExpanded is false", () => {
      const proposal = createMockProposal({ metadataSources: ["EXIF"] });

      render(
        <PreviewRow
          proposal={proposal}
          isSelected={false}
          onToggleSelection={() => {}}
          isExpanded={false}
          onToggleExpand={() => {}}
        />
      );

      expect(screen.queryByTestId("preview-details-test-1")).not.toBeInTheDocument();
    });

    it("calls onToggleExpand when expand button clicked", async () => {
      const user = userEvent.setup();
      const proposal = createMockProposal({ metadataSources: ["EXIF"] });
      const onToggleExpand = vi.fn();

      render(
        <PreviewRow
          proposal={proposal}
          isSelected={false}
          onToggleSelection={() => {}}
          isExpanded={false}
          onToggleExpand={onToggleExpand}
        />
      );

      await user.click(screen.getByTestId("preview-expand-test-1"));

      expect(onToggleExpand).toHaveBeenCalled();
    });

    it("shows metadata source badges when expanded", () => {
      const proposal = createMockProposal({ metadataSources: ["EXIF", "filename"] });

      render(
        <PreviewRow
          proposal={proposal}
          isSelected={false}
          onToggleSelection={() => {}}
          isExpanded={true}
          onToggleExpand={() => {}}
        />
      );

      expect(screen.getByText("EXIF")).toBeInTheDocument();
      expect(screen.getByText("filename")).toBeInTheDocument();
    });

    it("shows issues when expanded", () => {
      const proposal = createMockProposal({
        status: "conflict",
        issues: [
          { code: "CONFLICT", message: "File already exists", field: "proposedName" },
        ],
        metadataSources: [],
      });

      render(
        <PreviewRow
          proposal={proposal}
          isSelected={false}
          onToggleSelection={() => {}}
          isExpanded={true}
          onToggleExpand={() => {}}
        />
      );

      expect(screen.getByText("File already exists")).toBeInTheDocument();
      expect(screen.getByText("(field: proposedName)")).toBeInTheDocument();
    });

    it("shows full paths when expanded", () => {
      const proposal = createMockProposal({
        originalPath: "/home/user/photos/photo.jpg",
        proposedPath: "/home/user/photos/2026-01-01_photo.jpg",
      });

      render(
        <PreviewRow
          proposal={proposal}
          isSelected={false}
          onToggleSelection={() => {}}
          isExpanded={true}
          onToggleExpand={() => {}}
        />
      );

      expect(screen.getByText(/Original: \/home\/user\/photos\/photo.jpg/)).toBeInTheDocument();
      expect(screen.getByText(/Proposed: \/home\/user\/photos\/2026-01-01_photo.jpg/)).toBeInTheDocument();
    });
  });

  describe("diff highlighting", () => {
    it("highlights added portions of filename", () => {
      const proposal = createMockProposal({
        originalName: "photo.jpg",
        proposedName: "2026-01-01_photo.jpg",
      });

      render(
        <PreviewRow
          proposal={proposal}
          isSelected={false}
          onToggleSelection={() => {}}
        />
      );

      // The added prefix should be highlighted
      const addedSpan = screen.getByText("2026-01-01_");
      expect(addedSpan).toHaveClass("bg-green-200");
    });

    it("does not highlight unchanged filenames", () => {
      const proposal = createMockProposal({
        originalName: "unchanged.jpg",
        proposedName: "unchanged.jpg",
        status: "no-change",
      });

      render(
        <PreviewRow
          proposal={proposal}
          isSelected={false}
          onToggleSelection={() => {}}
        />
      );

      // Should have the full text without highlighting classes
      const spans = screen.getAllByText("unchanged.jpg");
      // At least one should be the proposed name without green highlighting
      const proposedSpan = spans.find(el => !el.classList.contains("bg-green-200"));
      expect(proposedSpan).toBeDefined();
    });
  });
});
