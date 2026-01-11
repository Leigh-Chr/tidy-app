/**
 * Tests for ScanOptions component
 * Story 6.5 - Task 2.6
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ScanOptions, FILE_TYPE_FILTERS } from "./ScanOptions";

describe("ScanOptions", () => {
  const defaultProps = {
    recursive: false,
    onRecursiveChange: vi.fn(),
    selectedFileTypes: [] as string[],
    onFileTypesChange: vi.fn(),
  };

  describe("rendering", () => {
    it("renders with data-testid", () => {
      render(<ScanOptions {...defaultProps} />);

      expect(screen.getByTestId("scan-options")).toBeInTheDocument();
    });

    it("displays Include subfolders label", () => {
      render(<ScanOptions {...defaultProps} />);

      expect(screen.getByText("Include subfolders")).toBeInTheDocument();
    });

    it("displays Filter by type label", () => {
      render(<ScanOptions {...defaultProps} />);

      expect(screen.getByText("Filter by type")).toBeInTheDocument();
    });

    it("renders all file type filter options", () => {
      render(<ScanOptions {...defaultProps} />);

      for (const filter of FILE_TYPE_FILTERS) {
        expect(screen.getByText(filter.label)).toBeInTheDocument();
      }
    });

    it("applies custom className", () => {
      render(<ScanOptions {...defaultProps} className="custom-class" />);

      expect(screen.getByTestId("scan-options")).toHaveClass("custom-class");
    });
  });

  describe("recursive toggle", () => {
    it("renders unchecked when recursive is false", () => {
      render(<ScanOptions {...defaultProps} recursive={false} />);

      const toggle = screen.getByTestId("recursive-toggle");
      expect(toggle).toHaveAttribute("data-state", "unchecked");
    });

    it("renders checked when recursive is true", () => {
      render(<ScanOptions {...defaultProps} recursive={true} />);

      const toggle = screen.getByTestId("recursive-toggle");
      expect(toggle).toHaveAttribute("data-state", "checked");
    });

    it("calls onRecursiveChange when toggled", async () => {
      const user = userEvent.setup();
      const onRecursiveChange = vi.fn();
      render(
        <ScanOptions {...defaultProps} onRecursiveChange={onRecursiveChange} />
      );

      await user.click(screen.getByTestId("recursive-toggle"));

      expect(onRecursiveChange).toHaveBeenCalledWith(true);
    });

    it("has accessible label", () => {
      render(<ScanOptions {...defaultProps} />);

      const toggle = screen.getByTestId("recursive-toggle");
      expect(toggle).toHaveAttribute("aria-label", "Include subfolders in scan");
    });
  });

  describe("file type filters", () => {
    it("renders unchecked when no file types selected", () => {
      render(<ScanOptions {...defaultProps} selectedFileTypes={[]} />);

      const imageCheckbox = screen.getByTestId("filter-image");
      expect(imageCheckbox).toHaveAttribute("data-state", "unchecked");
    });

    it("renders checked for selected file types", () => {
      render(<ScanOptions {...defaultProps} selectedFileTypes={["image", "document"]} />);

      expect(screen.getByTestId("filter-image")).toHaveAttribute("data-state", "checked");
      expect(screen.getByTestId("filter-document")).toHaveAttribute("data-state", "checked");
      expect(screen.getByTestId("filter-video")).toHaveAttribute("data-state", "unchecked");
    });

    it("adds file type when checkbox is checked", async () => {
      const user = userEvent.setup();
      const onFileTypesChange = vi.fn();
      render(
        <ScanOptions
          {...defaultProps}
          selectedFileTypes={["document"]}
          onFileTypesChange={onFileTypesChange}
        />
      );

      await user.click(screen.getByTestId("filter-image"));

      expect(onFileTypesChange).toHaveBeenCalledWith(["document", "image"]);
    });

    it("removes file type when checkbox is unchecked", async () => {
      const user = userEvent.setup();
      const onFileTypesChange = vi.fn();
      render(
        <ScanOptions
          {...defaultProps}
          selectedFileTypes={["image", "document"]}
          onFileTypesChange={onFileTypesChange}
        />
      );

      await user.click(screen.getByTestId("filter-image"));

      expect(onFileTypesChange).toHaveBeenCalledWith(["document"]);
    });

    it("shows Showing all files when no filters selected", () => {
      render(<ScanOptions {...defaultProps} selectedFileTypes={[]} />);

      expect(screen.getByText("Showing all files")).toBeInTheDocument();
    });

    it("shows filter count when filters selected", () => {
      render(<ScanOptions {...defaultProps} selectedFileTypes={["image", "document"]} />);

      expect(screen.getByText("Showing 2 types")).toBeInTheDocument();
    });

    it("shows singular type when one filter selected", () => {
      render(<ScanOptions {...defaultProps} selectedFileTypes={["image"]} />);

      expect(screen.getByText("Showing 1 type")).toBeInTheDocument();
    });
  });

  describe("clear filters button", () => {
    it("is not shown when no filters selected", () => {
      render(<ScanOptions {...defaultProps} selectedFileTypes={[]} />);

      expect(screen.queryByTestId("clear-filters")).not.toBeInTheDocument();
    });

    it("is shown when filters are selected", () => {
      render(<ScanOptions {...defaultProps} selectedFileTypes={["image"]} />);

      expect(screen.getByTestId("clear-filters")).toBeInTheDocument();
    });

    it("clears all filters when clicked", async () => {
      const user = userEvent.setup();
      const onFileTypesChange = vi.fn();
      render(
        <ScanOptions
          {...defaultProps}
          selectedFileTypes={["image", "document"]}
          onFileTypesChange={onFileTypesChange}
        />
      );

      await user.click(screen.getByTestId("clear-filters"));

      expect(onFileTypesChange).toHaveBeenCalledWith([]);
    });
  });

  describe("disabled state", () => {
    it("disables recursive toggle when disabled", () => {
      render(<ScanOptions {...defaultProps} disabled={true} />);

      expect(screen.getByTestId("recursive-toggle")).toBeDisabled();
    });

    it("disables all file type checkboxes when disabled", () => {
      render(<ScanOptions {...defaultProps} disabled={true} />);

      for (const filter of FILE_TYPE_FILTERS) {
        expect(screen.getByTestId(`filter-${filter.id}`)).toBeDisabled();
      }
    });

    it("disables clear filters button when disabled", () => {
      render(
        <ScanOptions
          {...defaultProps}
          selectedFileTypes={["image"]}
          disabled={true}
        />
      );

      expect(screen.getByTestId("clear-filters")).toBeDisabled();
    });
  });

  describe("accessibility", () => {
    it("has accessible role for filter group", () => {
      render(<ScanOptions {...defaultProps} />);

      expect(screen.getByRole("group", { name: "File type filters" })).toBeInTheDocument();
    });

    it("has associated labels for all checkboxes", () => {
      render(<ScanOptions {...defaultProps} />);

      for (const filter of FILE_TYPE_FILTERS) {
        const checkbox = screen.getByTestId(`filter-${filter.id}`);
        expect(checkbox).toHaveAttribute("id", `filter-${filter.id}`);
      }
    });
  });
});
