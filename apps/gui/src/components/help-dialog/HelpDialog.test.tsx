/**
 * Tests for HelpDialog component
 * Story 6.5 - Task 5
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HelpDialog } from "./HelpDialog";

// Mock tauri getVersion
vi.mock("@/lib/tauri", () => ({
  getVersion: vi.fn().mockResolvedValue({
    version: "0.2.0",
    core_version: "0.2.0",
  }),
}));

describe("HelpDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders trigger button", () => {
      render(<HelpDialog />);

      expect(screen.getByTestId("help-dialog-trigger")).toBeInTheDocument();
    });

    it("applies custom trigger className", () => {
      render(<HelpDialog triggerClassName="custom-class" />);

      expect(screen.getByTestId("help-dialog-trigger")).toHaveClass(
        "custom-class"
      );
    });

    it("opens dialog when trigger clicked", async () => {
      const user = userEvent.setup();
      render(<HelpDialog />);

      await user.click(screen.getByTestId("help-dialog-trigger"));

      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("displays dialog title", async () => {
      const user = userEvent.setup();
      render(<HelpDialog />);

      await user.click(screen.getByTestId("help-dialog-trigger"));

      expect(screen.getByText("Help & About")).toBeInTheDocument();
    });
  });

  describe("version display (AC4)", () => {
    it("displays version information", async () => {
      const user = userEvent.setup();
      render(<HelpDialog />);

      await user.click(screen.getByTestId("help-dialog-trigger"));

      await waitFor(() => {
        expect(screen.getByTestId("version-info")).toBeInTheDocument();
      });
    });

    it("shows app version from Tauri", async () => {
      const user = userEvent.setup();
      render(<HelpDialog />);

      await user.click(screen.getByTestId("help-dialog-trigger"));

      await waitFor(() => {
        expect(screen.getByTestId("app-version")).toHaveTextContent("0.2.0");
      });
    });

    it("shows core version", async () => {
      const user = userEvent.setup();
      render(<HelpDialog />);

      await user.click(screen.getByTestId("help-dialog-trigger"));

      await waitFor(() => {
        expect(screen.getByTestId("core-version")).toHaveTextContent("0.2.0");
      });
    });
  });

  describe("documentation link (AC4)", () => {
    it("displays documentation link", async () => {
      const user = userEvent.setup();
      render(<HelpDialog />);

      await user.click(screen.getByTestId("help-dialog-trigger"));

      const docLink = screen.getByTestId("documentation-link");
      expect(docLink).toBeInTheDocument();
      expect(docLink).toHaveAttribute("href");
    });

    it("documentation link opens in new tab", async () => {
      const user = userEvent.setup();
      render(<HelpDialog />);

      await user.click(screen.getByTestId("help-dialog-trigger"));

      const docLink = screen.getByTestId("documentation-link");
      expect(docLink).toHaveAttribute("target", "_blank");
      expect(docLink).toHaveAttribute("rel", "noopener noreferrer");
    });
  });

  describe("license information (AC4)", () => {
    it("displays license information", async () => {
      const user = userEvent.setup();
      render(<HelpDialog />);

      await user.click(screen.getByTestId("help-dialog-trigger"));

      expect(screen.getByTestId("license-info")).toBeInTheDocument();
    });

    it("shows MIT license", async () => {
      const user = userEvent.setup();
      render(<HelpDialog />);

      await user.click(screen.getByTestId("help-dialog-trigger"));

      expect(screen.getByText(/MIT/i)).toBeInTheDocument();
    });
  });

  describe("keyboard shortcuts (AC4)", () => {
    it("displays keyboard shortcuts section", async () => {
      const user = userEvent.setup();
      render(<HelpDialog />);

      await user.click(screen.getByTestId("help-dialog-trigger"));

      expect(screen.getByTestId("keyboard-shortcuts")).toBeInTheDocument();
    });

    it("lists at least one shortcut", async () => {
      const user = userEvent.setup();
      render(<HelpDialog />);

      await user.click(screen.getByTestId("help-dialog-trigger"));

      const shortcuts = screen.getByTestId("keyboard-shortcuts");
      expect(shortcuts.querySelectorAll("[data-testid^='shortcut-']").length).toBeGreaterThan(0);
    });
  });

  describe("quick start guide (AC4)", () => {
    it("displays quick start section", async () => {
      const user = userEvent.setup();
      render(<HelpDialog />);

      await user.click(screen.getByTestId("help-dialog-trigger"));

      expect(screen.getByTestId("quick-start-guide")).toBeInTheDocument();
    });

    it("shows getting started steps", async () => {
      const user = userEvent.setup();
      render(<HelpDialog />);

      await user.click(screen.getByTestId("help-dialog-trigger"));

      expect(screen.getByText(/Select a folder/i)).toBeInTheDocument();
    });
  });

  describe("controlled mode", () => {
    it("can be controlled externally", async () => {
      const onOpenChange = vi.fn();
      render(<HelpDialog open={true} onOpenChange={onOpenChange} />);

      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("calls onOpenChange when closed", async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      render(<HelpDialog open={true} onOpenChange={onOpenChange} />);

      // Press escape to close
      await user.keyboard("{Escape}");

      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe("accessibility", () => {
    it("dialog has aria-labelledby", async () => {
      const user = userEvent.setup();
      render(<HelpDialog />);

      await user.click(screen.getByTestId("help-dialog-trigger"));

      const dialog = screen.getByRole("dialog");
      expect(dialog).toHaveAttribute("aria-labelledby");
    });

    it("dialog has aria-describedby", async () => {
      const user = userEvent.setup();
      render(<HelpDialog />);

      await user.click(screen.getByTestId("help-dialog-trigger"));

      const dialog = screen.getByRole("dialog");
      expect(dialog).toHaveAttribute("aria-describedby");
    });

    it("trigger button has accessible label", () => {
      render(<HelpDialog />);

      expect(
        screen.getByRole("button", { name: /help/i })
      ).toBeInTheDocument();
    });
  });
});
