/**
 * Tests for SettingsModal component
 * Story 6.3 - AC1: Settings Modal Opens
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { invoke } from "@tauri-apps/api/core";
import { SettingsModal } from "./SettingsModal";
import { useAppStore } from "@/stores/app-store";
import type { AppConfig } from "@/lib/tauri";

vi.mock("@tauri-apps/api/core");

const mockConfig: AppConfig = {
  version: 1,
  templates: [
    {
      id: "template-1",
      name: "Test Template",
      pattern: "{name}.{ext}",
      fileTypes: ["jpg", "png"],
      isDefault: true,
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
    },
  ],
  preferences: {
    defaultOutputFormat: "table",
    colorOutput: true,
    confirmBeforeApply: true,
    recursiveScan: false,
  },
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

describe("SettingsModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.getState().reset();
  });

  describe("trigger button", () => {
    it("renders settings trigger button", () => {
      render(<SettingsModal />);

      expect(screen.getByTestId("settings-trigger")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /open settings/i })).toBeInTheDocument();
    });

    it("opens modal when trigger is clicked", async () => {
      vi.mocked(invoke).mockResolvedValue(mockConfig);
      render(<SettingsModal />);

      fireEvent.click(screen.getByTestId("settings-trigger"));

      await waitFor(() => {
        expect(screen.getByTestId("settings-modal")).toBeInTheDocument();
      });
    });
  });

  describe("controlled mode", () => {
    it("respects external open state", async () => {
      vi.mocked(invoke).mockResolvedValue(mockConfig);
      const onOpenChange = vi.fn();

      render(<SettingsModal open={true} onOpenChange={onOpenChange} />);

      await waitFor(() => {
        expect(screen.getByTestId("settings-modal")).toBeInTheDocument();
      });
    });

    it("calls onOpenChange when closed", async () => {
      vi.mocked(invoke).mockResolvedValue(mockConfig);
      const onOpenChange = vi.fn();

      render(<SettingsModal open={true} onOpenChange={onOpenChange} />);

      await waitFor(() => {
        expect(screen.getByTestId("settings-modal")).toBeInTheDocument();
      });

      // Close via escape key
      fireEvent.keyDown(screen.getByTestId("settings-modal"), { key: "Escape" });

      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe("loading state", () => {
    it("shows loading spinner when config is loading", async () => {
      // Never resolve to keep loading state
      vi.mocked(invoke).mockImplementation(() => new Promise(() => {}));

      render(<SettingsModal open={true} />);

      await waitFor(() => {
        expect(screen.getByRole("status", { name: /loading settings/i })).toBeInTheDocument();
      });
    });
  });

  describe("error state", () => {
    it("shows error message when config fails to load", async () => {
      vi.mocked(invoke).mockRejectedValue(new Error("Failed to load"));

      render(<SettingsModal open={true} />);

      await waitFor(() => {
        expect(screen.getByTestId("settings-error")).toBeInTheDocument();
        expect(screen.getByText(/failed to load settings/i)).toBeInTheDocument();
      });
    });

    it("shows retry button on error", async () => {
      vi.mocked(invoke).mockRejectedValue(new Error("Failed to load"));

      render(<SettingsModal open={true} />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
      });
    });

    it("retries loading when retry button is clicked", async () => {
      vi.mocked(invoke)
        .mockRejectedValueOnce(new Error("Failed"))
        .mockResolvedValueOnce(mockConfig);

      render(<SettingsModal open={true} />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: /retry/i }));

      await waitFor(() => {
        expect(screen.getByTestId("tab-templates")).toBeInTheDocument();
      });
    });
  });

  describe("tabs navigation", () => {
    beforeEach(async () => {
      vi.mocked(invoke).mockResolvedValue(mockConfig);
    });

    it("renders templates and preferences tabs", async () => {
      render(<SettingsModal open={true} />);

      await waitFor(() => {
        expect(screen.getByTestId("tab-templates")).toBeInTheDocument();
        expect(screen.getByTestId("tab-preferences")).toBeInTheDocument();
      });
    });

    it("shows templates tab content by default", async () => {
      render(<SettingsModal open={true} />);

      await waitFor(() => {
        expect(screen.getByTestId("templates-tab-content")).toBeInTheDocument();
        expect(screen.getByTestId("template-list")).toBeInTheDocument();
      });
    });

    it("switches to preferences tab when clicked", async () => {
      const user = userEvent.setup();
      render(<SettingsModal open={true} />);

      await waitFor(() => {
        expect(screen.getByTestId("tab-preferences")).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("tab-preferences"));

      // The preferences tab should become selected (aria-selected)
      await waitFor(() => {
        const prefsTab = screen.getByTestId("tab-preferences");
        expect(prefsTab).toHaveAttribute("aria-selected", "true");
      });
    });
  });

  describe("modal header", () => {
    it("displays settings title", async () => {
      vi.mocked(invoke).mockResolvedValue(mockConfig);
      render(<SettingsModal open={true} />);

      await waitFor(() => {
        expect(screen.getByText("Settings")).toBeInTheDocument();
      });
    });

    it("displays settings description", async () => {
      vi.mocked(invoke).mockResolvedValue(mockConfig);
      render(<SettingsModal open={true} />);

      await waitFor(() => {
        expect(screen.getByText(/manage your templates and preferences/i)).toBeInTheDocument();
      });
    });
  });
});
