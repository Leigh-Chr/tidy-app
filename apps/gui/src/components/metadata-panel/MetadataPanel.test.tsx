/**
 * Tests for MetadataPanel component
 * Story 6.5 - Task 7
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MetadataPanel } from "./MetadataPanel";
import type { FileInfo } from "@/lib/tauri";

const createMockFile = (overrides?: Partial<FileInfo>): FileInfo => ({
  path: "/test/photos/image.jpg",
  name: "image",
  extension: "jpg",
  fullName: "image.jpg",
  size: 1048576, // 1 MB
  createdAt: "2026-01-01T10:30:00Z",
  modifiedAt: "2026-01-05T14:45:00Z",
  relativePath: "photos/image.jpg",
  category: "image",
  metadataSupported: true,
  metadataCapability: "full",
  ...overrides,
});

describe("MetadataPanel", () => {
  describe("rendering", () => {
    it("renders with data-testid", () => {
      render(<MetadataPanel file={createMockFile()} />);

      expect(screen.getByTestId("metadata-panel")).toBeInTheDocument();
    });

    it("applies custom className", () => {
      render(<MetadataPanel file={createMockFile()} className="custom-class" />);

      expect(screen.getByTestId("metadata-panel")).toHaveClass("custom-class");
    });
  });

  describe("file system metadata", () => {
    it("displays file system section header", () => {
      render(<MetadataPanel file={createMockFile()} />);

      expect(screen.getByText("File System")).toBeInTheDocument();
    });

    it("displays filename", () => {
      render(<MetadataPanel file={createMockFile()} />);

      expect(screen.getByText("Filename")).toBeInTheDocument();
      expect(screen.getByText("image.jpg")).toBeInTheDocument();
    });

    it("displays file path", () => {
      render(<MetadataPanel file={createMockFile()} />);

      expect(screen.getByText("Path")).toBeInTheDocument();
      expect(screen.getByText("/test/photos/image.jpg")).toBeInTheDocument();
    });

    it("displays file size in human-readable format", () => {
      render(<MetadataPanel file={createMockFile()} />);

      expect(screen.getByText("Size")).toBeInTheDocument();
      expect(screen.getByText("1 MB")).toBeInTheDocument();
    });

    it("displays file extension", () => {
      render(<MetadataPanel file={createMockFile()} />);

      expect(screen.getByText("Extension")).toBeInTheDocument();
      expect(screen.getByText("jpg")).toBeInTheDocument();
    });

    it("displays category", () => {
      render(<MetadataPanel file={createMockFile()} />);

      expect(screen.getByText("Category")).toBeInTheDocument();
      expect(screen.getByText("image")).toBeInTheDocument();
    });

    it("displays created date", () => {
      render(<MetadataPanel file={createMockFile()} />);

      expect(screen.getByText("Created")).toBeInTheDocument();
      // Date format varies by locale, just check it exists
      expect(screen.getByTestId("metadata-created")).toBeInTheDocument();
    });

    it("displays modified date", () => {
      render(<MetadataPanel file={createMockFile()} />);

      expect(screen.getByText("Modified")).toBeInTheDocument();
      expect(screen.getByTestId("metadata-modified")).toBeInTheDocument();
    });
  });

  describe("metadata capability", () => {
    it("displays metadata capability section", () => {
      render(<MetadataPanel file={createMockFile()} />);

      expect(screen.getByText("Metadata Capability")).toBeInTheDocument();
    });

    it("displays supported status when metadataSupported is true", () => {
      render(
        <MetadataPanel
          file={createMockFile({ metadataSupported: true, metadataCapability: "full" })}
        />
      );

      expect(screen.getByTestId("metadata-capability-badge")).toHaveTextContent(
        "Full"
      );
    });

    it("displays none status when metadataSupported is false", () => {
      render(
        <MetadataPanel
          file={createMockFile({ metadataSupported: false, metadataCapability: "none" })}
        />
      );

      expect(screen.getByTestId("metadata-capability-badge")).toHaveTextContent(
        "None"
      );
    });

    it("displays extended capability", () => {
      render(
        <MetadataPanel
          file={createMockFile({ metadataCapability: "extended" })}
        />
      );

      expect(screen.getByTestId("metadata-capability-badge")).toHaveTextContent(
        "Extended"
      );
    });

    it("displays basic capability", () => {
      render(
        <MetadataPanel file={createMockFile({ metadataCapability: "basic" })} />
      );

      expect(screen.getByTestId("metadata-capability-badge")).toHaveTextContent(
        "Basic"
      );
    });
  });

  describe("empty/unavailable metadata", () => {
    it("shows Not available for missing created date", () => {
      render(
        <MetadataPanel file={createMockFile({ createdAt: "" })} />
      );

      expect(screen.getByTestId("metadata-created")).toHaveTextContent(
        "Not available"
      );
    });

    it("handles zero file size", () => {
      render(<MetadataPanel file={createMockFile({ size: 0 })} />);

      expect(screen.getByText("0 B")).toBeInTheDocument();
    });
  });

  describe("file type specific sections", () => {
    it("shows EXIF placeholder for image files with full capability", () => {
      render(
        <MetadataPanel
          file={createMockFile({
            category: "image",
            metadataCapability: "full",
            metadataSupported: true,
          })}
        />
      );

      expect(screen.getByTestId("exif-metadata-section")).toBeInTheDocument();
    });

    it("does not show EXIF section for non-image files", () => {
      render(
        <MetadataPanel
          file={createMockFile({
            category: "document",
            extension: "pdf",
            metadataCapability: "basic",
          })}
        />
      );

      expect(
        screen.queryByTestId("exif-metadata-section")
      ).not.toBeInTheDocument();
    });

    it("shows PDF placeholder for document files with basic capability", () => {
      render(
        <MetadataPanel
          file={createMockFile({
            category: "document",
            extension: "pdf",
            metadataCapability: "basic",
            metadataSupported: true,
          })}
        />
      );

      expect(screen.getByTestId("pdf-metadata-section")).toBeInTheDocument();
    });
  });

  describe("accessibility", () => {
    it("has accessible section headings", () => {
      render(<MetadataPanel file={createMockFile()} />);

      expect(
        screen.getByRole("heading", { name: "File System" })
      ).toBeInTheDocument();
    });

    it("uses definition list structure for metadata", () => {
      render(<MetadataPanel file={createMockFile()} />);

      expect(screen.getByRole("term", { name: /filename/i })).toBeInTheDocument();
    });
  });
});
