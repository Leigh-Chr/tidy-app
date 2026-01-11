/**
 * Tests for DropZone component
 * Task 1.5: Write component tests for drag-drop states
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DropZone } from "./DropZone";

describe("DropZone", () => {
  const mockOnFolderSelect = vi.fn();

  beforeEach(() => {
    mockOnFolderSelect.mockClear();
  });

  describe("default state", () => {
    it("renders drop zone with default prompt text", () => {
      render(<DropZone onFolderSelect={mockOnFolderSelect} />);

      expect(screen.getByText(/drop a folder here/i)).toBeInTheDocument();
      // "or" and "Browse" button are in separate elements
      expect(screen.getByText(/^or$/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /browse/i })).toBeInTheDocument();
    });

    it("displays privacy message", () => {
      render(<DropZone onFolderSelect={mockOnFolderSelect} />);

      expect(
        screen.getByText(/your files never leave your computer/i)
      ).toBeInTheDocument();
    });

    it("has dashed border in default state", () => {
      render(<DropZone onFolderSelect={mockOnFolderSelect} />);

      const dropZone = screen.getByTestId("drop-zone");
      expect(dropZone).toHaveClass("border-dashed");
    });
  });

  describe("drag over state", () => {
    it("changes appearance on drag enter", () => {
      render(<DropZone onFolderSelect={mockOnFolderSelect} />);

      const dropZone = screen.getByTestId("drop-zone");

      // Simulate drag enter
      fireEvent.dragEnter(dropZone, {
        dataTransfer: { types: ["Files"] },
      });

      // Should have hover state classes
      expect(dropZone).toHaveClass("border-primary");
    });

    it("shows drop indicator text on drag over", () => {
      render(<DropZone onFolderSelect={mockOnFolderSelect} />);

      const dropZone = screen.getByTestId("drop-zone");

      fireEvent.dragEnter(dropZone, {
        dataTransfer: { types: ["Files"] },
      });

      expect(screen.getByText(/drop to scan/i)).toBeInTheDocument();
    });

    it("reverts to default state on drag leave", () => {
      render(<DropZone onFolderSelect={mockOnFolderSelect} />);

      const dropZone = screen.getByTestId("drop-zone");

      // Drag enter then leave
      fireEvent.dragEnter(dropZone, {
        dataTransfer: { types: ["Files"] },
      });
      fireEvent.dragLeave(dropZone);

      expect(dropZone).not.toHaveClass("border-primary");
      expect(screen.getByText(/drop a folder here/i)).toBeInTheDocument();
    });
  });

  describe("drop handling", () => {
    it("calls onFolderSelect with folder path on drop", () => {
      render(<DropZone onFolderSelect={mockOnFolderSelect} />);

      const dropZone = screen.getByTestId("drop-zone");

      // Create mock file with webkitGetAsEntry
      const mockEntry = {
        isDirectory: true,
        fullPath: "/test/folder",
        name: "folder",
      };

      const mockItem = {
        webkitGetAsEntry: () => mockEntry,
      };

      const mockDataTransfer = {
        items: [mockItem],
        types: ["Files"],
      };

      fireEvent.drop(dropZone, {
        dataTransfer: mockDataTransfer,
        preventDefault: vi.fn(),
      });

      // The drop handler should process the folder
      expect(mockOnFolderSelect).toHaveBeenCalledTimes(1);
    });

    it("resets drag state after drop", () => {
      render(<DropZone onFolderSelect={mockOnFolderSelect} />);

      const dropZone = screen.getByTestId("drop-zone");

      fireEvent.dragEnter(dropZone, {
        dataTransfer: { types: ["Files"] },
      });

      fireEvent.drop(dropZone, {
        dataTransfer: {
          items: [],
          types: ["Files"],
        },
      });

      expect(dropZone).not.toHaveClass("border-primary");
    });
  });

  describe("browse button", () => {
    it("renders browse button", () => {
      render(<DropZone onFolderSelect={mockOnFolderSelect} />);

      expect(
        screen.getByRole("button", { name: /browse/i })
      ).toBeInTheDocument();
    });

    it("calls onBrowseClick when browse button is clicked", () => {
      const mockOnBrowseClick = vi.fn();
      render(
        <DropZone
          onFolderSelect={mockOnFolderSelect}
          onBrowseClick={mockOnBrowseClick}
        />
      );

      const browseButton = screen.getByRole("button", { name: /browse/i });
      fireEvent.click(browseButton);

      expect(mockOnBrowseClick).toHaveBeenCalledTimes(1);
    });
  });

  describe("disabled state", () => {
    it("shows disabled state when disabled prop is true", () => {
      render(<DropZone onFolderSelect={mockOnFolderSelect} disabled />);

      const dropZone = screen.getByTestId("drop-zone");
      expect(dropZone).toHaveClass("opacity-50");
      expect(dropZone).toHaveClass("cursor-not-allowed");
    });

    it("does not respond to drag events when disabled", () => {
      render(<DropZone onFolderSelect={mockOnFolderSelect} disabled />);

      const dropZone = screen.getByTestId("drop-zone");

      fireEvent.dragEnter(dropZone, {
        dataTransfer: { types: ["Files"] },
      });

      // Should not change to hover state
      expect(dropZone).not.toHaveClass("border-primary");
    });

    it("disables browse button when disabled", () => {
      render(<DropZone onFolderSelect={mockOnFolderSelect} disabled />);

      const browseButton = screen.getByRole("button", { name: /browse/i });
      expect(browseButton).toBeDisabled();
    });
  });

  describe("loading state", () => {
    it("shows loading indicator when isLoading is true", () => {
      render(<DropZone onFolderSelect={mockOnFolderSelect} isLoading />);

      expect(screen.getByText(/scanning/i)).toBeInTheDocument();
    });

    it("hides default prompt when loading", () => {
      render(<DropZone onFolderSelect={mockOnFolderSelect} isLoading />);

      expect(screen.queryByText(/drop a folder here/i)).not.toBeInTheDocument();
    });
  });
});
