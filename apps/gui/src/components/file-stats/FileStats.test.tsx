/**
 * Tests for FileStats component
 * Story 6.5 - Task 4.6
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FileStats, computeFileStats } from "./FileStats";
import type { FileInfo } from "@/lib/tauri";

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
  createMockFile({ path: "/test/image1.jpg", size: 1024, category: "image" }),
  createMockFile({ path: "/test/image2.png", size: 2048, category: "image" }),
  createMockFile({ path: "/test/doc.pdf", size: 4096, category: "document" }),
  createMockFile({ path: "/test/video.mp4", size: 10240, category: "video" }),
  createMockFile({ path: "/test/other.xyz", size: 512, category: "other" }),
];

describe("FileStats", () => {
  describe("rendering", () => {
    it("renders with data-testid", () => {
      render(<FileStats files={mockFiles} />);

      expect(screen.getByTestId("file-stats")).toBeInTheDocument();
    });

    it("applies custom className", () => {
      render(<FileStats files={mockFiles} className="custom-class" />);

      expect(screen.getByTestId("file-stats")).toHaveClass("custom-class");
    });
  });

  describe("total count", () => {
    it("displays correct total file count", () => {
      render(<FileStats files={mockFiles} />);

      expect(screen.getByTestId("file-stats-total")).toHaveTextContent("5");
    });

    it("displays default label Files", () => {
      render(<FileStats files={mockFiles} />);

      expect(screen.getByText("Files")).toBeInTheDocument();
    });

    it("displays custom label", () => {
      render(<FileStats files={mockFiles} label="Results" />);

      expect(screen.getByText("Results")).toBeInTheDocument();
    });

    it("formats large numbers with locale", () => {
      const manyFiles = Array(1500)
        .fill(null)
        .map((_, i) => createMockFile({ path: `/test/file${i}.jpg` }));

      render(<FileStats files={manyFiles} />);

      // Should display the number (locale formatting varies)
      const totalElement = screen.getByTestId("file-stats-total");
      // Check for the number 1500 in some format (1,500 or 1 500 depending on locale)
      expect(totalElement.textContent).toMatch(/1[,\s]?500/);
    });
  });

  describe("total size", () => {
    it("displays total size in human-readable format", () => {
      render(<FileStats files={mockFiles} />);

      // Total: 1024 + 2048 + 4096 + 10240 + 512 = 17920 bytes = 17.5 KB
      expect(screen.getByTestId("file-stats-size")).toHaveTextContent("17.5 KB");
    });

    it("displays bytes for small sizes", () => {
      const smallFiles = [createMockFile({ size: 100 })];
      render(<FileStats files={smallFiles} />);

      expect(screen.getByTestId("file-stats-size")).toHaveTextContent("100 B");
    });

    it("displays MB for large sizes", () => {
      const largeFiles = [createMockFile({ size: 5 * 1024 * 1024 })];
      render(<FileStats files={largeFiles} />);

      // formatBytes removes trailing .0, so it displays "5 MB" not "5.0 MB"
      expect(screen.getByTestId("file-stats-size")).toHaveTextContent("5 MB");
    });
  });

  describe("category badges", () => {
    it("displays category badges by default", () => {
      render(<FileStats files={mockFiles} />);

      expect(screen.getByTestId("file-stats-categories")).toBeInTheDocument();
    });

    it("displays badge for each category", () => {
      render(<FileStats files={mockFiles} />);

      expect(screen.getByTestId("category-badge-image")).toBeInTheDocument();
      expect(screen.getByTestId("category-badge-document")).toBeInTheDocument();
      expect(screen.getByTestId("category-badge-video")).toBeInTheDocument();
      expect(screen.getByTestId("category-badge-other")).toBeInTheDocument();
    });

    it("displays correct count for each category", () => {
      render(<FileStats files={mockFiles} />);

      expect(screen.getByTestId("category-badge-image")).toHaveTextContent("Images: 2");
      expect(screen.getByTestId("category-badge-document")).toHaveTextContent("Documents: 1");
      expect(screen.getByTestId("category-badge-video")).toHaveTextContent("Videos: 1");
      expect(screen.getByTestId("category-badge-other")).toHaveTextContent("Other: 1");
    });

    it("hides category badges when showCategories is false", () => {
      render(<FileStats files={mockFiles} showCategories={false} />);

      expect(screen.queryByTestId("file-stats-categories")).not.toBeInTheDocument();
    });

    it("sorts categories by count descending", () => {
      render(<FileStats files={mockFiles} />);

      const categories = screen.getByTestId("file-stats-categories");
      const badges = categories.querySelectorAll("[data-testid^='category-badge-']");

      // First badge should be "image" with count 2
      expect(badges[0]).toHaveTextContent("Images: 2");
    });
  });

  describe("empty state", () => {
    it("displays empty state when no files", () => {
      render(<FileStats files={[]} />);

      expect(screen.getByTestId("file-stats-empty")).toBeInTheDocument();
    });

    it("displays No files here message", () => {
      render(<FileStats files={[]} />);

      expect(screen.getByText("No files here")).toBeInTheDocument();
    });

    it("displays helpful suggestion message", () => {
      render(<FileStats files={[]} />);

      expect(
        screen.getByText("Try different filters or another folder")
      ).toBeInTheDocument();
    });

    it("does not show category badges in empty state", () => {
      render(<FileStats files={[]} />);

      expect(screen.queryByTestId("file-stats-categories")).not.toBeInTheDocument();
    });
  });

  describe("accessibility", () => {
    it("has aria-label for total count", () => {
      render(<FileStats files={mockFiles} />);

      expect(screen.getByLabelText("5 files")).toBeInTheDocument();
    });

    it("has aria-label for total size", () => {
      render(<FileStats files={mockFiles} />);

      expect(screen.getByLabelText("Total size: 17.5 KB")).toBeInTheDocument();
    });

    it("has role=group for categories", () => {
      render(<FileStats files={mockFiles} />);

      expect(screen.getByRole("group", { name: "File categories" })).toBeInTheDocument();
    });
  });
});

describe("computeFileStats", () => {
  it("computes correct total", () => {
    const stats = computeFileStats(mockFiles);

    expect(stats.total).toBe(5);
  });

  it("computes correct total size", () => {
    const stats = computeFileStats(mockFiles);

    // 1024 + 2048 + 4096 + 10240 + 512 = 17920
    expect(stats.totalSize).toBe(17920);
  });

  it("computes correct category breakdown", () => {
    const stats = computeFileStats(mockFiles);

    expect(stats.byCategory).toEqual({
      image: 2,
      document: 1,
      video: 1,
      other: 1,
    });
  });

  it("handles empty array", () => {
    const stats = computeFileStats([]);

    expect(stats.total).toBe(0);
    expect(stats.totalSize).toBe(0);
    expect(stats.byCategory).toEqual({});
  });

  it("handles single file", () => {
    const stats = computeFileStats([createMockFile()]);

    expect(stats.total).toBe(1);
    expect(stats.byCategory).toEqual({ image: 1 });
  });
});
