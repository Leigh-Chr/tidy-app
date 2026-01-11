/**
 * Tests for ExportButton component
 * Story 6.5 - Task 6
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExportButton } from "./ExportButton";
import type { FileInfo, RenamePreview } from "@/lib/tauri";

// Mock tauri
vi.mock("@/lib/tauri", () => ({
  exportResults: vi.fn().mockResolvedValue({
    path: "/home/user/export.json",
    size: 1024,
  }),
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  },
}));

const createMockFile = (overrides?: Partial<FileInfo>): FileInfo => ({
  path: "/test/file.jpg",
  name: "file",
  extension: "jpg",
  fullName: "file.jpg",
  size: 1024,
  createdAt: "2026-01-01T00:00:00Z",
  modifiedAt: "2026-01-01T00:00:00Z",
  relativePath: "file.jpg",
  category: "image",
  metadataSupported: true,
  metadataCapability: "full",
  ...overrides,
});

const mockFiles: FileInfo[] = [
  createMockFile({ path: "/test/image1.jpg" }),
  createMockFile({ path: "/test/image2.png", category: "image" }),
  createMockFile({ path: "/test/doc.pdf", category: "document" }),
];

const mockPreview: RenamePreview = {
  proposals: [
    {
      id: "1",
      originalPath: "/test/image1.jpg",
      originalName: "image1.jpg",
      proposedName: "2026-01-01_image1.jpg",
      proposedPath: "/test/2026-01-01_image1.jpg",
      status: "ready",
      issues: [],
    },
  ],
  summary: {
    total: 1,
    ready: 1,
    conflicts: 0,
    missingData: 0,
    noChange: 0,
    invalidName: 0,
  },
  generatedAt: "2026-01-01T12:00:00Z",
  templateUsed: "{date}_{name}.{ext}",
};

describe("ExportButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders export button", () => {
      render(<ExportButton folder="/test" files={mockFiles} />);

      expect(screen.getByTestId("export-button")).toBeInTheDocument();
    });

    it("displays Export text by default", () => {
      render(<ExportButton folder="/test" files={mockFiles} />);

      expect(screen.getByText("Export")).toBeInTheDocument();
    });

    it("shows Download icon", () => {
      render(<ExportButton folder="/test" files={mockFiles} />);

      const button = screen.getByTestId("export-button");
      expect(button.querySelector("svg")).toBeInTheDocument();
    });

    it("applies custom className", () => {
      render(
        <ExportButton
          folder="/test"
          files={mockFiles}
          className="custom-class"
        />
      );

      expect(screen.getByTestId("export-button")).toHaveClass("custom-class");
    });
  });

  describe("disabled state", () => {
    it("is disabled when no files", () => {
      render(<ExportButton folder="/test" files={[]} />);

      expect(screen.getByTestId("export-button")).toBeDisabled();
    });

    it("is enabled when files exist", () => {
      render(<ExportButton folder="/test" files={mockFiles} />);

      expect(screen.getByTestId("export-button")).not.toBeDisabled();
    });

    it("is disabled when disabled prop is true", () => {
      render(<ExportButton folder="/test" files={mockFiles} disabled />);

      expect(screen.getByTestId("export-button")).toBeDisabled();
    });
  });

  describe("export functionality", () => {
    it("calls exportResults when clicked", async () => {
      const { exportResults } = await import("@/lib/tauri");
      const user = userEvent.setup();

      render(<ExportButton folder="/test/folder" files={mockFiles} />);

      await user.click(screen.getByTestId("export-button"));

      await waitFor(() => {
        expect(exportResults).toHaveBeenCalledWith({
          folder: "/test/folder",
          files: mockFiles,
          preview: undefined,
        });
      });
    });

    it("includes preview when provided", async () => {
      const { exportResults } = await import("@/lib/tauri");
      const user = userEvent.setup();

      render(
        <ExportButton
          folder="/test/folder"
          files={mockFiles}
          preview={mockPreview}
        />
      );

      await user.click(screen.getByTestId("export-button"));

      await waitFor(() => {
        expect(exportResults).toHaveBeenCalledWith({
          folder: "/test/folder",
          files: mockFiles,
          preview: mockPreview,
        });
      });
    });

    it("shows success toast on successful export", async () => {
      const { toast } = await import("sonner");
      const user = userEvent.setup();

      render(<ExportButton folder="/test/folder" files={mockFiles} />);

      await user.click(screen.getByTestId("export-button"));

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalled();
      });
    });

    it("shows error toast on export failure", async () => {
      const { exportResults } = await import("@/lib/tauri");
      const { toast } = await import("sonner");
      vi.mocked(exportResults).mockRejectedValueOnce(new Error("Export failed"));
      const user = userEvent.setup();

      render(<ExportButton folder="/test/folder" files={mockFiles} />);

      await user.click(screen.getByTestId("export-button"));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalled();
      });
    });

    it("calls onExportComplete callback on success", async () => {
      const onExportComplete = vi.fn();
      const user = userEvent.setup();

      render(
        <ExportButton
          folder="/test/folder"
          files={mockFiles}
          onExportComplete={onExportComplete}
        />
      );

      await user.click(screen.getByTestId("export-button"));

      await waitFor(() => {
        expect(onExportComplete).toHaveBeenCalledWith({
          path: "/home/user/export.json",
          size: 1024,
        });
      });
    });
  });

  describe("loading state", () => {
    it("shows loading state while exporting", async () => {
      const { exportResults } = await import("@/lib/tauri");
      vi.mocked(exportResults).mockImplementationOnce(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );
      const user = userEvent.setup();

      render(<ExportButton folder="/test/folder" files={mockFiles} />);

      await user.click(screen.getByTestId("export-button"));

      // Button should be disabled during export
      expect(screen.getByTestId("export-button")).toBeDisabled();
    });
  });

  describe("accessibility", () => {
    it("has accessible name", () => {
      render(<ExportButton folder="/test" files={mockFiles} />);

      expect(
        screen.getByRole("button", { name: /export/i })
      ).toBeInTheDocument();
    });

    it("indicates disabled state to screen readers", () => {
      render(<ExportButton folder="/test" files={[]} />);

      expect(screen.getByTestId("export-button")).toHaveAttribute(
        "aria-disabled",
        "true"
      );
    });
  });
});
