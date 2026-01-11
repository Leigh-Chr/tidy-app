/**
 * Tests for FolderBreadcrumb component
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FolderBreadcrumb } from "./FolderBreadcrumb";

describe("FolderBreadcrumb", () => {
  describe("path display", () => {
    it("renders the folder path", () => {
      render(<FolderBreadcrumb path="/home/user/documents" />);

      expect(screen.getByText("/home/user/documents")).toBeInTheDocument();
    });

    it("renders folder icon", () => {
      render(<FolderBreadcrumb path="/test" />);

      const breadcrumb = screen.getByTestId("folder-breadcrumb");
      const svg = breadcrumb.querySelector("svg");
      expect(svg).toBeInTheDocument();
    });
  });

  describe("truncation", () => {
    it("truncates long paths with ellipsis in the middle", () => {
      const longPath = "/home/user/very/long/path/to/some/deeply/nested/folder/structure";
      render(<FolderBreadcrumb path={longPath} maxLength={30} />);

      const displayedPath = screen.getByText(/\.\.\./);
      expect(displayedPath).toBeInTheDocument();
      // Should not display the full path
      expect(screen.queryByText(longPath)).not.toBeInTheDocument();
    });

    it("does not truncate paths shorter than maxLength", () => {
      const shortPath = "/home/user";
      render(<FolderBreadcrumb path={shortPath} maxLength={50} />);

      expect(screen.getByText(shortPath)).toBeInTheDocument();
    });

    it("shows full path in title attribute when truncated", () => {
      const longPath = "/home/user/very/long/path/to/some/deeply/nested/folder/structure";
      render(<FolderBreadcrumb path={longPath} maxLength={30} />);

      const pathElement = screen.getByText(/\.\.\./);
      expect(pathElement).toHaveAttribute("title", longPath);
    });

    it("does not show title attribute when path is not truncated", () => {
      const shortPath = "/home/user";
      render(<FolderBreadcrumb path={shortPath} maxLength={50} />);

      const pathElement = screen.getByText(shortPath);
      expect(pathElement).not.toHaveAttribute("title");
    });

    it("uses default maxLength of 50 when not specified", () => {
      // Path of exactly 50 characters should not be truncated
      const exactPath = "/home/user/documents/folder12345678901234567890123";
      expect(exactPath.length).toBe(50);

      const { rerender } = render(<FolderBreadcrumb path={exactPath} />);
      expect(screen.getByText(exactPath)).toBeInTheDocument();

      // Path of 51 characters should be truncated
      const longerPath = exactPath + "a";
      rerender(<FolderBreadcrumb path={longerPath} />);
      expect(screen.queryByText(longerPath)).not.toBeInTheDocument();
    });
  });

  describe("clear button", () => {
    it("renders clear button when onClear is provided", () => {
      const onClear = vi.fn();
      render(<FolderBreadcrumb path="/test" onClear={onClear} />);

      const clearButton = screen.getByRole("button", { name: /clear folder selection/i });
      expect(clearButton).toBeInTheDocument();
    });

    it("does not render clear button when onClear is not provided", () => {
      render(<FolderBreadcrumb path="/test" />);

      const clearButton = screen.queryByRole("button", { name: /clear folder selection/i });
      expect(clearButton).not.toBeInTheDocument();
    });

    it("calls onClear when clear button is clicked", () => {
      const onClear = vi.fn();
      render(<FolderBreadcrumb path="/test" onClear={onClear} />);

      const clearButton = screen.getByRole("button", { name: /clear folder selection/i });
      fireEvent.click(clearButton);

      expect(onClear).toHaveBeenCalledTimes(1);
    });
  });

  describe("accessibility", () => {
    it("has data-testid for testing", () => {
      render(<FolderBreadcrumb path="/test" />);

      expect(screen.getByTestId("folder-breadcrumb")).toBeInTheDocument();
    });

    it("clear button has accessible label", () => {
      const onClear = vi.fn();
      render(<FolderBreadcrumb path="/test" onClear={onClear} />);

      const clearButton = screen.getByRole("button");
      expect(clearButton).toHaveAttribute("aria-label", "Clear folder selection");
    });
  });
});
