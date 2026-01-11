/**
 * Tests for AiSettings component
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AiSettings } from "./AiSettings";
import { useAppStore } from "@/stores/app-store";
import type { OllamaConfig } from "@/lib/tauri";

// Mock the store
vi.mock("@/stores/app-store", () => ({
  useAppStore: vi.fn(),
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockConfig: OllamaConfig = {
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
};

const mockStoreState = {
  llmStatus: "idle" as const,
  llmModels: [],
  openaiModels: [],
  llmError: null,
  configStatus: "success" as const,
  checkLlmHealth: vi.fn().mockResolvedValue({ ok: true, data: { available: false } }),
  loadLlmModels: vi.fn().mockResolvedValue({ ok: true, data: [] }),
  loadOpenAiModels: vi.fn().mockResolvedValue({ ok: true, data: [] }),
  updateOllamaConfig: vi.fn().mockResolvedValue({ ok: true, data: undefined }),
};

describe("AiSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAppStore).mockReturnValue(mockStoreState);
  });

  it("renders with default config", () => {
    render(<AiSettings config={mockConfig} />);

    expect(screen.getByTestId("ai-settings-panel")).toBeInTheDocument();
    expect(screen.getByTestId("ollama-enabled-switch")).toBeInTheDocument();
    expect(screen.getByTestId("ollama-base-url")).toHaveValue("http://localhost:11434");
  });

  it("shows disconnected status when idle", () => {
    render(<AiSettings config={mockConfig} />);

    expect(screen.getByText("Disconnected")).toBeInTheDocument();
  });

  it("shows connected status when available", () => {
    vi.mocked(useAppStore).mockReturnValue({
      ...mockStoreState,
      llmStatus: "available",
      llmModels: [
        { name: "mistral:latest", size: 4_000_000_000, family: "mistral" },
      ],
    });

    render(<AiSettings config={mockConfig} />);

    expect(screen.getByText("Connected")).toBeInTheDocument();
    expect(screen.getByText("1 model available")).toBeInTheDocument();
  });

  it("shows checking status while checking connection", () => {
    vi.mocked(useAppStore).mockReturnValue({
      ...mockStoreState,
      llmStatus: "checking",
    });

    render(<AiSettings config={mockConfig} />);

    expect(screen.getByText("Checking connection...")).toBeInTheDocument();
  });

  it("enables toggle triggers config save", async () => {
    const user = userEvent.setup();
    const updateOllamaConfig = vi.fn().mockResolvedValue({ ok: true, data: undefined });
    const checkLlmHealth = vi.fn().mockResolvedValue({ ok: true, data: { available: true } });

    vi.mocked(useAppStore).mockReturnValue({
      ...mockStoreState,
      updateOllamaConfig,
      checkLlmHealth,
    });

    render(<AiSettings config={mockConfig} />);

    const enableSwitch = screen.getByTestId("ollama-enabled-switch");
    await user.click(enableSwitch);

    expect(updateOllamaConfig).toHaveBeenCalledWith({ enabled: true });
  });

  it("populates model select with loaded models", () => {
    const models = [
      { name: "mistral:latest", size: 4_000_000_000, family: "mistral" },
      { name: "llama3:latest", size: 5_000_000_000, family: "llama" },
    ];

    vi.mocked(useAppStore).mockReturnValue({
      ...mockStoreState,
      llmStatus: "available",
      llmModels: models,
    });

    render(<AiSettings config={mockConfig} />);

    // The select should be enabled with models
    const inferenceSelect = screen.getByTestId("inference-model-select");
    expect(inferenceSelect).not.toBeDisabled();
  });

  it("disables vision toggle when no vision models", () => {
    vi.mocked(useAppStore).mockReturnValue({
      ...mockStoreState,
      llmStatus: "available",
      llmModels: [
        { name: "mistral:latest", size: 4_000_000_000, family: "mistral" },
      ],
    });

    render(<AiSettings config={mockConfig} />);

    const visionSwitch = screen.getByTestId("vision-enabled-switch");
    expect(visionSwitch).toBeDisabled();
  });

  it("enables vision toggle when vision models available", () => {
    vi.mocked(useAppStore).mockReturnValue({
      ...mockStoreState,
      llmStatus: "available",
      llmModels: [
        { name: "llava:latest", size: 4_000_000_000, family: "llava" },
      ],
    });

    render(<AiSettings config={mockConfig} />);

    const visionSwitch = screen.getByTestId("vision-enabled-switch");
    expect(visionSwitch).not.toBeDisabled();
  });

  it("displays error state appropriately", () => {
    vi.mocked(useAppStore).mockReturnValue({
      ...mockStoreState,
      llmStatus: "unavailable",
      llmError: "Connection refused",
    });

    render(<AiSettings config={mockConfig} />);

    expect(screen.getByTestId("ai-settings-error")).toBeInTheDocument();
    expect(screen.getByTestId("ai-settings-error")).toHaveTextContent("Connection refused");
  });

  it("calls checkLlmHealth when check button clicked", async () => {
    const user = userEvent.setup();
    const checkLlmHealth = vi.fn().mockResolvedValue({ ok: true, data: { available: true, modelCount: 3 } });
    const loadLlmModels = vi.fn().mockResolvedValue({ ok: true, data: [] });

    vi.mocked(useAppStore).mockReturnValue({
      ...mockStoreState,
      checkLlmHealth,
      loadLlmModels,
    });

    render(<AiSettings config={mockConfig} />);

    const checkBtn = screen.getByTestId("check-connection-btn");
    await user.click(checkBtn);

    expect(checkLlmHealth).toHaveBeenCalled();
  });

  it("shows saving indicator when config is saving", () => {
    vi.mocked(useAppStore).mockReturnValue({
      ...mockStoreState,
      configStatus: "saving",
    });

    render(<AiSettings config={mockConfig} />);

    expect(screen.getByTestId("saving-indicator")).toBeInTheDocument();
    expect(screen.getByText("Saving...")).toBeInTheDocument();
  });
});
