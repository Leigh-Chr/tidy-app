/**
 * Tests for SkippedFilesIndicator component (UX-002)
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SkippedFilesIndicator } from "./SkippedFilesIndicator";
import type { SkippedFile } from "@/lib/tauri";

describe("SkippedFilesIndicator", () => {
  const mockSkippedFiles: SkippedFile[] = [
    { path: "/path/to/file1.txt", reason: "metadataError", error: "Cannot read metadata" },
    { path: "/path/to/file2.jpg", reason: "permissionDenied" },
    { path: "/path/to/file3.pdf", reason: "filteredByExtension" },
    { path: "/path/to/file4.doc", reason: "other", error: "Unknown error" },
  ];

  it("should not render when no skipped files", () => {
    const { container } = render(
      <SkippedFilesIndicator skippedFiles={[]} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("should not render when skippedCount is 0", () => {
    const { container } = render(
      <SkippedFilesIndicator skippedFiles={[]} skippedCount={0} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("should render trigger button with correct count", () => {
    render(<SkippedFilesIndicator skippedFiles={mockSkippedFiles} />);

    const trigger = screen.getByTestId("skipped-files-trigger");
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveTextContent("4 files skipped during scan");
  });

  it("should use singular 'file' for count of 1", () => {
    render(<SkippedFilesIndicator skippedFiles={[mockSkippedFiles[0]]} />);

    expect(screen.getByTestId("skipped-files-trigger")).toHaveTextContent(
      "1 file skipped during scan"
    );
  });

  it("should expand when trigger is clicked", async () => {
    const user = userEvent.setup();
    render(<SkippedFilesIndicator skippedFiles={mockSkippedFiles} />);

    // Initially collapsed - content not visible
    const trigger = screen.getByTestId("skipped-files-trigger");
    expect(trigger.parentElement).toHaveAttribute("data-state", "closed");

    // Click to expand
    await user.click(trigger);

    // Content should now be visible
    expect(trigger.parentElement).toHaveAttribute("data-state", "open");
    expect(screen.getByTestId("skipped-files-content")).toBeInTheDocument();
  });

  it("should show reason badges in expanded view", async () => {
    const user = userEvent.setup();
    render(<SkippedFilesIndicator skippedFiles={mockSkippedFiles} />);

    await user.click(screen.getByTestId("skipped-files-trigger"));

    // Check that badges are shown for each reason
    expect(screen.getByText(/Metadata Error: 1/)).toBeInTheDocument();
    expect(screen.getByText(/Permission Denied: 1/)).toBeInTheDocument();
    expect(screen.getByText(/Filtered: 1/)).toBeInTheDocument();
    expect(screen.getByText(/Other: 1/)).toBeInTheDocument();
  });

  it("should show file names in expanded view", async () => {
    const user = userEvent.setup();
    render(<SkippedFilesIndicator skippedFiles={mockSkippedFiles} />);

    await user.click(screen.getByTestId("skipped-files-trigger"));

    // Check that file names are shown
    expect(screen.getByText("file1.txt")).toBeInTheDocument();
    expect(screen.getByText("file2.jpg")).toBeInTheDocument();
    expect(screen.getByText("file3.pdf")).toBeInTheDocument();
    expect(screen.getByText("file4.doc")).toBeInTheDocument();
  });

  it("should limit displayed files to 10", async () => {
    const user = userEvent.setup();
    const manyFiles: SkippedFile[] = Array.from({ length: 15 }, (_, i) => ({
      path: `/path/to/file${i}.txt`,
      reason: "metadataError" as const,
    }));

    render(<SkippedFilesIndicator skippedFiles={manyFiles} />);

    await user.click(screen.getByTestId("skipped-files-trigger"));

    // Should show "...and X more" message
    expect(screen.getByText("...and 5 more")).toBeInTheDocument();
  });

  it("should use skippedCount prop when provided", () => {
    render(
      <SkippedFilesIndicator
        skippedFiles={mockSkippedFiles.slice(0, 2)}
        skippedCount={10}
      />
    );

    expect(screen.getByTestId("skipped-files-trigger")).toHaveTextContent(
      "10 files skipped during scan"
    );
  });

  it("should collapse when trigger is clicked again", async () => {
    const user = userEvent.setup();
    render(<SkippedFilesIndicator skippedFiles={mockSkippedFiles} />);

    const trigger = screen.getByTestId("skipped-files-trigger");

    // Open
    await user.click(trigger);
    expect(trigger.parentElement).toHaveAttribute("data-state", "open");
    expect(screen.getByTestId("skipped-files-content")).toBeInTheDocument();

    // Close
    await user.click(trigger);
    expect(trigger.parentElement).toHaveAttribute("data-state", "closed");
  });
});
