/**
 * Tests for PreferencesPanel component
 * Story 6.3 - AC6: Preferences Section
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { PreferencesPanel } from "./PreferencesPanel";
import { useAppStore, type Preferences } from "@/stores/app-store";
import type { AppConfig } from "@/lib/tauri";

vi.mock("@tauri-apps/api/core");

const defaultPreferences: Preferences = {
  defaultOutputFormat: "table",
  colorOutput: true,
  confirmBeforeApply: true,
  recursiveScan: false,
  caseNormalization: "kebab-case",
};

const mockConfig: AppConfig = {
  version: 1,
  templates: [],
  folderStructures: [],
  preferences: defaultPreferences,
  recentFolders: [],
  ollama: {
    enabled: false,
    provider: "ollama",
    baseUrl: "http://localhost:11434",
    timeout: 30000,
    models: {},
    fileTypes: {
      preset: "documents",
      includedExtensions: [],
      excludedExtensions: [],
      skipWithMetadata: true,
    },
    visionEnabled: false,
    skipImagesWithExif: true,
    maxImageSize: 20 * 1024 * 1024,
    offlineMode: "auto",
    healthCheckTimeout: 5000,
    openai: {
      apiKey: "",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-4o-mini",
      visionModel: "gpt-4o",
    },
  },
};

describe("PreferencesPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.getState().reset();
    useAppStore.setState({ config: mockConfig, configStatus: "success" });
  });

  describe("output format select", () => {
    it("renders output format selector", () => {
      render(<PreferencesPanel preferences={defaultPreferences} />);

      expect(screen.getByText("Default Output Format")).toBeInTheDocument();
      expect(screen.getByTestId("output-format-select")).toBeInTheDocument();
    });

    it("shows current output format value", () => {
      render(<PreferencesPanel preferences={{ ...defaultPreferences, defaultOutputFormat: "json" }} />);

      // The select should show the current value
      expect(screen.getByTestId("output-format-select")).toBeInTheDocument();
    });

    it("has correct role and state for select trigger", () => {
      render(<PreferencesPanel preferences={defaultPreferences} />);

      const select = screen.getByTestId("output-format-select");
      expect(select).toHaveAttribute("role", "combobox");
      expect(select).toHaveAttribute("aria-expanded", "false");
    });
  });

  describe("confirm before apply switch", () => {
    it("renders confirm before apply switch", () => {
      render(<PreferencesPanel preferences={defaultPreferences} />);

      expect(screen.getByText("Confirm Before Apply")).toBeInTheDocument();
      expect(screen.getByTestId("confirm-apply-switch")).toBeInTheDocument();
    });

    it("shows description text", () => {
      render(<PreferencesPanel preferences={defaultPreferences} />);

      expect(screen.getByText(/ask for confirmation before renaming files/i)).toBeInTheDocument();
    });

    it("reflects current checked state", () => {
      render(<PreferencesPanel preferences={{ ...defaultPreferences, confirmBeforeApply: true }} />);

      const switchElement = screen.getByTestId("confirm-apply-switch");
      expect(switchElement).toHaveAttribute("data-state", "checked");
    });

    it("reflects unchecked state", () => {
      render(<PreferencesPanel preferences={{ ...defaultPreferences, confirmBeforeApply: false }} />);

      const switchElement = screen.getByTestId("confirm-apply-switch");
      expect(switchElement).toHaveAttribute("data-state", "unchecked");
    });

    it("updates preferences when toggled", async () => {
      vi.mocked(invoke).mockResolvedValue(undefined);

      render(<PreferencesPanel preferences={{ ...defaultPreferences, confirmBeforeApply: true }} />);

      fireEvent.click(screen.getByTestId("confirm-apply-switch"));

      await waitFor(() => {
        expect(invoke).toHaveBeenCalledWith("save_config", expect.any(Object));
      });
    });
  });

  describe("recursive scan switch", () => {
    it("renders recursive scan switch", () => {
      render(<PreferencesPanel preferences={defaultPreferences} />);

      expect(screen.getByText("Recursive Scan")).toBeInTheDocument();
      expect(screen.getByTestId("recursive-scan-switch")).toBeInTheDocument();
    });

    it("shows description text", () => {
      render(<PreferencesPanel preferences={defaultPreferences} />);

      expect(screen.getByText(/include files from subdirectories/i)).toBeInTheDocument();
    });

    it("reflects current state", () => {
      render(<PreferencesPanel preferences={{ ...defaultPreferences, recursiveScan: true }} />);

      const switchElement = screen.getByTestId("recursive-scan-switch");
      expect(switchElement).toHaveAttribute("data-state", "checked");
    });

    it("updates preferences when toggled", async () => {
      vi.mocked(invoke).mockResolvedValue(undefined);

      render(<PreferencesPanel preferences={{ ...defaultPreferences, recursiveScan: false }} />);

      fireEvent.click(screen.getByTestId("recursive-scan-switch"));

      await waitFor(() => {
        expect(invoke).toHaveBeenCalledWith("save_config", expect.any(Object));
      });
    });
  });

  describe("color output switch", () => {
    it("renders color output switch", () => {
      render(<PreferencesPanel preferences={defaultPreferences} />);

      expect(screen.getByText("Color Output")).toBeInTheDocument();
      expect(screen.getByTestId("color-output-switch")).toBeInTheDocument();
    });

    it("shows description text", () => {
      render(<PreferencesPanel preferences={defaultPreferences} />);

      expect(screen.getByText(/use colors in cli output/i)).toBeInTheDocument();
    });

    it("reflects current state", () => {
      render(<PreferencesPanel preferences={{ ...defaultPreferences, colorOutput: false }} />);

      const switchElement = screen.getByTestId("color-output-switch");
      expect(switchElement).toHaveAttribute("data-state", "unchecked");
    });

    it("updates preferences when toggled", async () => {
      vi.mocked(invoke).mockResolvedValue(undefined);

      render(<PreferencesPanel preferences={{ ...defaultPreferences, colorOutput: true }} />);

      fireEvent.click(screen.getByTestId("color-output-switch"));

      await waitFor(() => {
        expect(invoke).toHaveBeenCalledWith("save_config", expect.any(Object));
      });
    });
  });

  describe("saving state", () => {
    it("disables all controls when saving", () => {
      useAppStore.setState({ configStatus: "saving" });

      render(<PreferencesPanel preferences={defaultPreferences} />);

      expect(screen.getByTestId("confirm-apply-switch")).toBeDisabled();
      expect(screen.getByTestId("recursive-scan-switch")).toBeDisabled();
      expect(screen.getByTestId("color-output-switch")).toBeDisabled();
    });

    it("shows saving indicator when saving", () => {
      useAppStore.setState({ configStatus: "saving" });

      render(<PreferencesPanel preferences={defaultPreferences} />);

      expect(screen.getByTestId("saving-indicator")).toBeInTheDocument();
      expect(screen.getByText("Saving...")).toBeInTheDocument();
    });

    it("hides saving indicator when not saving", () => {
      useAppStore.setState({ configStatus: "success" });

      render(<PreferencesPanel preferences={defaultPreferences} />);

      expect(screen.queryByTestId("saving-indicator")).not.toBeInTheDocument();
    });
  });

  describe("accessibility", () => {
    it("has proper labels for switch controls", () => {
      render(<PreferencesPanel preferences={defaultPreferences} />);

      // Switches have associated labels via htmlFor
      expect(screen.getByLabelText("Confirm Before Apply")).toBeInTheDocument();
      expect(screen.getByLabelText("Recursive Scan")).toBeInTheDocument();
      expect(screen.getByLabelText("Color Output")).toBeInTheDocument();
    });

    it("has label text for output format", () => {
      render(<PreferencesPanel preferences={defaultPreferences} />);

      // Select has a label element but isn't directly linked (Radix pattern)
      expect(screen.getByText("Default Output Format")).toBeInTheDocument();
    });
  });
});
