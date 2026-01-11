/**
 * Tests for PreviewTable component
 * Story 6.4 - Task 4
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PreviewTable } from "./PreviewTable";
import type { RenamePreview, RenameStatus } from "@/lib/tauri";

const createMockPreview = (overrides?: Partial<RenamePreview>): RenamePreview => ({
  proposals: [
    {
      id: "1",
      originalPath: "/test/photo1.jpg",
      originalName: "photo1.jpg",
      proposedName: "2026-01-01_photo1.jpg",
      proposedPath: "/test/2026-01-01_photo1.jpg",
      status: "ready",
      issues: [],
      metadataSources: ["filename"],
    },
    {
      id: "2",
      originalPath: "/test/photo2.jpg",
      originalName: "photo2.jpg",
      proposedName: "2026-01-02_photo2.jpg",
      proposedPath: "/test/2026-01-02_photo2.jpg",
      status: "ready",
      issues: [],
      metadataSources: ["EXIF"],
    },
    {
      id: "3",
      originalPath: "/test/doc.pdf",
      originalName: "doc.pdf",
      proposedName: "doc.pdf",
      proposedPath: "/test/doc.pdf",
      status: "no-change",
      issues: [],
      metadataSources: [],
    },
    {
      id: "4",
      originalPath: "/test/conflict.jpg",
      originalName: "conflict.jpg",
      proposedName: "existing.jpg",
      proposedPath: "/test/existing.jpg",
      status: "conflict",
      issues: [{ code: "CONFLICT", message: "File already exists" }],
      metadataSources: [],
    },
  ],
  summary: {
    total: 4,
    ready: 2,
    conflicts: 1,
    missingData: 0,
    noChange: 1,
    invalidName: 0,
  },
  generatedAt: "2026-01-10T12:00:00Z",
  templateUsed: "{date}_{name}.{ext}",
  ...overrides,
});

describe("PreviewTable", () => {
  it("renders preview table with data-testid", () => {
    const preview = createMockPreview();
    const onToggleSelection = vi.fn();

    render(
      <PreviewTable
        preview={preview}
        selectedIds={new Set()}
        onToggleSelection={onToggleSelection}
      />
    );

    expect(screen.getByTestId("preview-table")).toBeInTheDocument();
  });

  it("renders empty state when no proposals", () => {
    const preview = createMockPreview({ proposals: [] });
    const onToggleSelection = vi.fn();

    render(
      <PreviewTable
        preview={preview}
        selectedIds={new Set()}
        onToggleSelection={onToggleSelection}
      />
    );

    expect(screen.getByTestId("preview-table-empty")).toBeInTheDocument();
    expect(screen.getByText("No files to preview")).toBeInTheDocument();
  });

  it("renders column headers", () => {
    const preview = createMockPreview();
    const onToggleSelection = vi.fn();

    render(
      <PreviewTable
        preview={preview}
        selectedIds={new Set()}
        onToggleSelection={onToggleSelection}
      />
    );

    expect(screen.getByText("Original Name")).toBeInTheDocument();
    expect(screen.getByText("Proposed Name")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
  });

  it("groups proposals by status with headers", () => {
    const preview = createMockPreview();
    const onToggleSelection = vi.fn();

    render(
      <PreviewTable
        preview={preview}
        selectedIds={new Set()}
        onToggleSelection={onToggleSelection}
      />
    );

    // Should show status group headers
    expect(screen.getByTestId("preview-group-ready")).toBeInTheDocument();
    expect(screen.getByTestId("preview-group-conflict")).toBeInTheDocument();
    expect(screen.getByTestId("preview-group-no-change")).toBeInTheDocument();
  });

  it("shows count in group headers", () => {
    const preview = createMockPreview();
    const onToggleSelection = vi.fn();

    render(
      <PreviewTable
        preview={preview}
        selectedIds={new Set()}
        onToggleSelection={onToggleSelection}
      />
    );

    const readyGroup = screen.getByTestId("preview-group-ready");
    expect(within(readyGroup).getByText("(2)")).toBeInTheDocument();
  });

  it("renders individual proposal rows", () => {
    const preview = createMockPreview();
    const onToggleSelection = vi.fn();

    render(
      <PreviewTable
        preview={preview}
        selectedIds={new Set()}
        onToggleSelection={onToggleSelection}
      />
    );

    expect(screen.getByTestId("preview-row-1")).toBeInTheDocument();
    expect(screen.getByTestId("preview-row-2")).toBeInTheDocument();
    expect(screen.getByTestId("preview-row-3")).toBeInTheDocument();
    expect(screen.getByTestId("preview-row-4")).toBeInTheDocument();
  });

  it("calls onToggleGroup when clicking a group header", async () => {
    const user = userEvent.setup();
    const preview = createMockPreview();
    const onToggleSelection = vi.fn();
    const onToggleGroup = vi.fn();

    render(
      <PreviewTable
        preview={preview}
        selectedIds={new Set()}
        onToggleSelection={onToggleSelection}
        onToggleGroup={onToggleGroup}
      />
    );

    await user.click(screen.getByTestId("preview-group-ready"));

    expect(onToggleGroup).toHaveBeenCalledWith("ready");
  });

  it("hides rows when group is collapsed", () => {
    const preview = createMockPreview();
    const onToggleSelection = vi.fn();
    const collapsedGroups = new Set<RenameStatus>(["ready"]);

    render(
      <PreviewTable
        preview={preview}
        selectedIds={new Set()}
        onToggleSelection={onToggleSelection}
        collapsedGroups={collapsedGroups}
      />
    );

    // Ready group header should be visible
    expect(screen.getByTestId("preview-group-ready")).toBeInTheDocument();

    // But ready rows should not be rendered
    expect(screen.queryByTestId("preview-row-1")).not.toBeInTheDocument();
    expect(screen.queryByTestId("preview-row-2")).not.toBeInTheDocument();

    // Other groups should still show their rows
    expect(screen.getByTestId("preview-row-3")).toBeInTheDocument(); // no-change
    expect(screen.getByTestId("preview-row-4")).toBeInTheDocument(); // conflict
  });

  it("orders groups by status priority (ready first, no-change last)", () => {
    const preview = createMockPreview();
    const onToggleSelection = vi.fn();

    render(
      <PreviewTable
        preview={preview}
        selectedIds={new Set()}
        onToggleSelection={onToggleSelection}
      />
    );

    const groups = screen.getAllByTestId(/preview-group-/);

    // Check order: ready, conflict, no-change
    expect(groups[0]).toHaveAttribute("data-testid", "preview-group-ready");
    expect(groups[1]).toHaveAttribute("data-testid", "preview-group-conflict");
    expect(groups[2]).toHaveAttribute("data-testid", "preview-group-no-change");
  });

  it("passes selection state to rows", () => {
    const preview = createMockPreview();
    const onToggleSelection = vi.fn();
    const selectedIds = new Set(["1"]);

    render(
      <PreviewTable
        preview={preview}
        selectedIds={selectedIds}
        onToggleSelection={onToggleSelection}
      />
    );

    // The first row should be selected
    const checkbox = screen.getByTestId("preview-checkbox-1");
    expect(checkbox).toHaveAttribute("data-state", "checked");
  });

  it("renders scroll container for virtualization", () => {
    const preview = createMockPreview();
    const onToggleSelection = vi.fn();

    render(
      <PreviewTable
        preview={preview}
        selectedIds={new Set()}
        onToggleSelection={onToggleSelection}
      />
    );

    expect(screen.getByTestId("preview-table-scroll")).toBeInTheDocument();
  });
});
