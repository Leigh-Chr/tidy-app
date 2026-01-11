/**
 * Tests for AiAnalysisBar component
 *
 * Tests AI analysis controls and status display.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { AiAnalysisBar } from "./AiAnalysisBar";
import { useAppStore } from "@/stores/app-store";
import type { AppConfig, FileInfo } from "@/lib/tauri";

vi.mock("@tauri-apps/api/core");

const createMockFile = (overrides: Partial<FileInfo> = {}): FileInfo => ({
  path: "/test/file.txt",
  name: "file",
  extension: "txt",
  fullName: "file.txt",
  size: 1024,
  createdAt: "2024-01-01T00:00:00Z",
  modifiedAt: "2024-01-01T00:00:00Z",
  relativePath: "file.txt",
  category: "code",
  metadataSupported: false,
  metadataCapability: "none",
  ...overrides,
});

const mockConfig: AppConfig = {
  version: 1,
  templates: [],
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

const mockFiles: FileInfo[] = [
  createMockFile({ path: "/test/file1.txt", name: "file1" }),
  createMockFile({ path: "/test/file2.txt", name: "file2" }),
];

describe("AiAnalysisBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.getState().reset();
  });

  describe("when AI is disabled", () => {
    it("does not render when LLM is disabled", () => {
      useAppStore.setState({ config: mockConfig });

      render(<AiAnalysisBar files={mockFiles} />);

      expect(screen.queryByTestId("ai-analysis-bar")).not.toBeInTheDocument();
    });
  });

  describe("when AI is enabled", () => {
    const enabledConfig: AppConfig = {
      ...mockConfig,
      ollama: {
        ...mockConfig.ollama,
        enabled: true,
        models: {
          inference: "llama3",
        },
      },
    };

    beforeEach(() => {
      useAppStore.setState({
        config: enabledConfig,
        llmStatus: "available",
      });
    });

    it("renders the analysis bar", () => {
      render(<AiAnalysisBar files={mockFiles} />);

      expect(screen.getByTestId("ai-analysis-bar")).toBeInTheDocument();
      expect(screen.getByText("AI Analysis")).toBeInTheDocument();
    });

    it("shows Ollama provider badge", () => {
      render(<AiAnalysisBar files={mockFiles} />);

      expect(screen.getByText("Ollama")).toBeInTheDocument();
    });

    it("shows OpenAI provider badge when configured", () => {
      useAppStore.setState({
        config: {
          ...enabledConfig,
          ollama: {
            ...enabledConfig.ollama,
            provider: "openai",
            openai: {
              apiKey: "sk-test",
              baseUrl: "https://api.openai.com/v1",
              model: "gpt-4o-mini",
              visionModel: "gpt-4o",
            },
          },
        },
      });

      render(<AiAnalysisBar files={mockFiles} />);

      expect(screen.getByText("OpenAI")).toBeInTheDocument();
    });

    it("renders analyze button", () => {
      render(<AiAnalysisBar files={mockFiles} />);

      expect(screen.getByTestId("analyze-with-ai")).toBeInTheDocument();
      expect(screen.getByText("Analyze with AI")).toBeInTheDocument();
    });

    it("disables analyze button when no files", () => {
      render(<AiAnalysisBar files={[]} />);

      expect(screen.getByTestId("analyze-with-ai")).toBeDisabled();
    });

    it("disables analyze button when LLM unavailable", () => {
      useAppStore.setState({ llmStatus: "unavailable" });

      render(<AiAnalysisBar files={mockFiles} />);

      expect(screen.getByTestId("analyze-with-ai")).toBeDisabled();
    });

    it("shows analyzing state", () => {
      useAppStore.setState({ aiAnalysisStatus: "analyzing" });

      render(<AiAnalysisBar files={mockFiles} />);

      // The button text or nearby progress indicator shows analyzing state
      const button = screen.getByTestId("analyze-with-ai");
      expect(button).toHaveTextContent(/analyzing/i);
    });

    it("shows results summary after analysis", () => {
      useAppStore.setState({
        aiAnalysisStatus: "done",
        aiSuggestions: new Map([
          ["/test/file1.txt", { suggestedName: "test", confidence: 0.9, reasoning: "Test", keywords: [] }],
        ]),
        lastAnalysisResult: {
          results: [],
          total: 2,
          analyzed: 1,
          failed: 0,
          skipped: 1,
          llmAvailable: true,
        },
      });

      render(<AiAnalysisBar files={mockFiles} />);

      expect(screen.getByText("1 analyzed")).toBeInTheDocument();
      expect(screen.getByText("1 skipped")).toBeInTheDocument();
    });

    it("shows clear button when results exist", () => {
      useAppStore.setState({
        aiAnalysisStatus: "done",
        aiSuggestions: new Map([
          ["/test/file1.txt", { suggestedName: "test", confidence: 0.9, reasoning: "Test", keywords: [] }],
        ]),
        lastAnalysisResult: {
          results: [],
          total: 1,
          analyzed: 1,
          failed: 0,
          skipped: 0,
          llmAvailable: true,
        },
      });

      render(<AiAnalysisBar files={mockFiles} />);

      expect(screen.getByTestId("clear-ai-analysis")).toBeInTheDocument();
    });

    it("shows re-analyze button when results exist", () => {
      useAppStore.setState({
        aiAnalysisStatus: "done",
        aiSuggestions: new Map([
          ["/test/file1.txt", { suggestedName: "test", confidence: 0.9, reasoning: "Test", keywords: [] }],
        ]),
        lastAnalysisResult: {
          results: [],
          total: 1,
          analyzed: 1,
          failed: 0,
          skipped: 0,
          llmAvailable: true,
        },
      });

      render(<AiAnalysisBar files={mockFiles} />);

      expect(screen.getByText("Re-analyze")).toBeInTheDocument();
    });

    it("enables analyze button when LLM is available and files exist", async () => {
      // Set the state BEFORE render to bypass the health check effect
      // Mock the health check to return healthy
      vi.mocked(invoke).mockImplementation(async (cmd) => {
        if (cmd === "check_ollama_health") {
          return { available: true, modelCount: 3, checkedAt: new Date().toISOString() };
        }
        return {};
      });

      // Render component (it will trigger health check)
      render(<AiAnalysisBar files={mockFiles} />);

      // Wait for the health check to complete and update the store
      await waitFor(() => {
        expect(useAppStore.getState().llmStatus).toBe("available");
      });

      // Now the button should be enabled
      const button = screen.getByTestId("analyze-with-ai");
      expect(button).not.toBeDisabled();
    });

    it("clears suggestions when clear is clicked", async () => {
      useAppStore.setState({
        aiAnalysisStatus: "done",
        aiSuggestions: new Map([
          ["/test/file1.txt", { suggestedName: "test", confidence: 0.9, reasoning: "Test", keywords: [] }],
        ]),
        lastAnalysisResult: {
          results: [],
          total: 1,
          analyzed: 1,
          failed: 0,
          skipped: 0,
          llmAvailable: true,
        },
      });

      render(<AiAnalysisBar files={mockFiles} />);

      fireEvent.click(screen.getByTestId("clear-ai-analysis"));

      expect(useAppStore.getState().aiSuggestions.size).toBe(0);
      expect(useAppStore.getState().aiAnalysisStatus).toBe("idle");
    });
  });
});
