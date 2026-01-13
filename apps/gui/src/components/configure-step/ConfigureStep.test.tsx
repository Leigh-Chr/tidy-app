/**
 * Tests for ConfigureStep component (TEST-002)
 *
 * Tests the configuration step of the workflow wizard.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfigureStep } from "./ConfigureStep";
import type { AppConfig, Template, FileInfo, ScanResult } from "@/lib/tauri";

// Define mock data first
const mockTemplate: Template = {
  id: "1",
  name: "dated-photos",
  pattern: "{year}-{month}-{day}_{original}",
  isDefault: true,
  createdAt: "2024-01-01",
  updatedAt: "2024-01-01",
};

const mockConfig: AppConfig = {
  version: 1,
  templates: [
    mockTemplate,
    {
      id: "2",
      name: "simple",
      pattern: "{original}",
      isDefault: false,
      createdAt: "2024-01-01",
      updatedAt: "2024-01-01",
    },
  ],
  folderStructures: [],
  preferences: {
    defaultOutputFormat: "table",
    colorOutput: true,
    confirmBeforeApply: true,
    recursiveScan: false,
    caseNormalization: "kebab-case",
  },
  recentFolders: [],
  ollama: {
    enabled: false,
    provider: "ollama",
    baseUrl: "http://localhost:11434",
    timeout: 30000,
    healthCheckTimeout: 5000,
    models: {
      inference: "llama2",
      vision: "llava",
    },
    fileTypes: {
      preset: "all",
      includedExtensions: ["pdf", "docx", "xlsx", "jpg", "png", "gif"],
      excludedExtensions: [],
      skipWithMetadata: true,
    },
    visionEnabled: false,
    skipImagesWithExif: true,
    maxImageSize: 10485760,
    offlineMode: "auto",
    openai: {
      apiKey: "",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-4o-mini",
      visionModel: "gpt-4o",
    },
  },
};

const mockFiles: FileInfo[] = [
  {
    path: "/test/folder/photo1.jpg",
    name: "photo1",
    extension: "jpg",
    fullName: "photo1.jpg",
    size: 1024000,
    createdAt: "2024-01-01T00:00:00Z",
    modifiedAt: "2024-01-01T00:00:00Z",
    relativePath: "photo1.jpg",
    category: "image",
    metadataSupported: true,
    metadataCapability: "full",
  },
  {
    path: "/test/folder/photo2.png",
    name: "photo2",
    extension: "png",
    fullName: "photo2.png",
    size: 2048000,
    createdAt: "2024-01-02T00:00:00Z",
    modifiedAt: "2024-01-02T00:00:00Z",
    relativePath: "photo2.png",
    category: "image",
    metadataSupported: true,
    metadataCapability: "full",
  },
];

const mockScanResult: ScanResult = {
  files: mockFiles,
  totalCount: 2,
  totalSize: 3072000,
  skipped: [],
  skippedCount: 0,
};

// Create mock functions
const mockLoadConfig = vi.fn();
const mockSetScanOptions = vi.fn();
const mockGeneratePreview = vi.fn().mockResolvedValue(undefined);
const mockGetFilteredFiles = vi.fn();

// Default mock store state
const createMockStore = (overrides = {}) => ({
  config: mockConfig,
  loadConfig: mockLoadConfig,
  selectedFolder: "/test/folder",
  scanResult: mockScanResult,
  getFilteredFiles: mockGetFilteredFiles,
  scanOptions: { recursive: false },
  setScanOptions: mockSetScanOptions,
  generatePreview: mockGeneratePreview,
  llmStatus: "unavailable" as const,
  ...overrides,
});

let mockStoreState = createMockStore();

// Mock the store
vi.mock("@/stores/app-store", () => ({
  useAppStore: vi.fn(() => mockStoreState),
}));

// Mock child components to simplify testing
vi.mock("@/components/template-selector/TemplateSelector", () => ({
  TemplateSelector: ({
    templates,
    selectedId,
    onSelect,
  }: {
    templates: Template[];
    selectedId: string | null;
    onSelect: (id: string) => void;
  }) => (
    <select
      data-testid="template-selector"
      value={selectedId || ""}
      onChange={(e) => onSelect(e.target.value)}
    >
      {templates.map((t) => (
        <option key={t.id} value={t.id}>
          {t.name}
        </option>
      ))}
    </select>
  ),
}));

vi.mock("@/components/ai-analysis", () => ({
  AiAnalysisBar: () => <div data-testid="ai-analysis-bar">AI Analysis</div>,
}));

vi.mock("@/components/skipped-files", () => ({
  SkippedFilesIndicator: ({ skippedCount }: { skippedCount: number }) => (
    <div data-testid="skipped-files-indicator">{skippedCount} files skipped</div>
  ),
}));

describe("ConfigureStep", () => {
  const mockOnContinue = vi.fn();
  const mockOnBack = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetFilteredFiles.mockReturnValue(mockFiles);
    mockGeneratePreview.mockResolvedValue(undefined);
    // Reset to default store state
    mockStoreState = createMockStore();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("should show loading state when config is not loaded", () => {
      mockStoreState = createMockStore({ config: null });

      render(<ConfigureStep onContinue={mockOnContinue} onBack={mockOnBack} />);

      // Should show loading spinner
      const spinner = document.querySelector(".animate-spin");
      expect(spinner).toBeInTheDocument();
    });

    it("should display file count", () => {
      render(<ConfigureStep onContinue={mockOnContinue} onBack={mockOnBack} />);

      expect(screen.getByText("2")).toBeInTheDocument();
      expect(screen.getByText("files")).toBeInTheDocument();
    });

    it("should display folder name", () => {
      render(<ConfigureStep onContinue={mockOnContinue} onBack={mockOnBack} />);

      // Check for the folder icon and name display
      expect(screen.getByText(/📁.*folder/)).toBeInTheDocument();
    });

    it("should render template selector", () => {
      render(<ConfigureStep onContinue={mockOnContinue} onBack={mockOnBack} />);

      expect(screen.getByTestId("template-selector")).toBeInTheDocument();
    });

    it("should render continue button", () => {
      render(<ConfigureStep onContinue={mockOnContinue} onBack={mockOnBack} />);

      expect(screen.getByRole("button", { name: /Continue to Preview/i })).toBeInTheDocument();
    });

    it("should render back button", () => {
      render(<ConfigureStep onContinue={mockOnContinue} onBack={mockOnBack} />);

      expect(screen.getByRole("button", { name: /Choose different folder/i })).toBeInTheDocument();
    });
  });

  describe("skipped files", () => {
    it("should show skipped files indicator when there are skipped files", () => {
      mockStoreState = createMockStore({
        scanResult: {
          ...mockScanResult,
          skipped: [{ path: "/test/file.txt", reason: "permissionDenied" }],
          skippedCount: 5,
        },
      });

      render(<ConfigureStep onContinue={mockOnContinue} onBack={mockOnBack} />);

      expect(screen.getByTestId("skipped-files-indicator")).toBeInTheDocument();
      expect(screen.getByText("5 files skipped")).toBeInTheDocument();
    });

    it("should not show skipped files indicator when no files are skipped", () => {
      render(<ConfigureStep onContinue={mockOnContinue} onBack={mockOnBack} />);

      expect(screen.queryByTestId("skipped-files-indicator")).not.toBeInTheDocument();
    });
  });

  describe("options section", () => {
    it("should have collapsed options by default", () => {
      render(<ConfigureStep onContinue={mockOnContinue} onBack={mockOnBack} />);

      // Options should be collapsed initially - check that "More options" button is present
      const moreOptionsButton = screen.getByRole("button", { name: /More options/i });
      expect(moreOptionsButton).toBeInTheDocument();
      // The parent collapsible should be closed
      expect(moreOptionsButton.closest("[data-state]")).toHaveAttribute("data-state", "closed");
    });

    it("should expand options when clicking More options", async () => {
      const user = userEvent.setup();
      render(<ConfigureStep onContinue={mockOnContinue} onBack={mockOnBack} />);

      await user.click(screen.getByRole("button", { name: /More options/i }));

      expect(screen.getByLabelText(/Include subfolders in scan/i)).toBeInTheDocument();
    });

    it("should update recursive option when toggled", async () => {
      const user = userEvent.setup();
      render(<ConfigureStep onContinue={mockOnContinue} onBack={mockOnBack} />);

      // Expand options
      await user.click(screen.getByRole("button", { name: /More options/i }));

      // Toggle recursive switch
      const recursiveSwitch = screen.getByLabelText(/Include subfolders in scan/i);
      await user.click(recursiveSwitch);

      expect(mockSetScanOptions).toHaveBeenCalledWith({ recursive: true });
    });
  });

  describe("navigation", () => {
    it("should call onBack when back button is clicked", async () => {
      const user = userEvent.setup();
      render(<ConfigureStep onContinue={mockOnContinue} onBack={mockOnBack} />);

      await user.click(screen.getByRole("button", { name: /Choose different folder/i }));

      expect(mockOnBack).toHaveBeenCalled();
    });

    it("should generate preview and call onContinue when continue is clicked", async () => {
      const user = userEvent.setup();
      render(<ConfigureStep onContinue={mockOnContinue} onBack={mockOnBack} />);

      await user.click(screen.getByRole("button", { name: /Continue to Preview/i }));

      await waitFor(() => {
        expect(mockGeneratePreview).toHaveBeenCalled();
        expect(mockOnContinue).toHaveBeenCalled();
      });
    });

    it("should disable continue button when no files", () => {
      mockGetFilteredFiles.mockReturnValue([]);

      render(<ConfigureStep onContinue={mockOnContinue} onBack={mockOnBack} />);

      const continueButton = screen.getByRole("button", { name: /Continue to Preview/i });
      expect(continueButton).toBeDisabled();
    });
  });

  describe("template selection", () => {
    it("should select default template on mount", () => {
      render(<ConfigureStep onContinue={mockOnContinue} onBack={mockOnBack} />);

      const selector = screen.getByTestId("template-selector") as HTMLSelectElement;
      expect(selector.value).toBe("1"); // Default template ID
    });

    it("should update selected template when changed", async () => {
      const user = userEvent.setup();
      render(<ConfigureStep onContinue={mockOnContinue} onBack={mockOnBack} />);

      const selector = screen.getByTestId("template-selector");
      await user.selectOptions(selector, "2");

      expect((selector as HTMLSelectElement).value).toBe("2");
    });

    it("should use selected template pattern when generating preview", async () => {
      const user = userEvent.setup();
      render(<ConfigureStep onContinue={mockOnContinue} onBack={mockOnBack} />);

      // Select the simple template
      const selector = screen.getByTestId("template-selector");
      await user.selectOptions(selector, "2");

      // Click continue
      await user.click(screen.getByRole("button", { name: /Continue to Preview/i }));

      await waitFor(() => {
        expect(mockGeneratePreview).toHaveBeenCalledWith(mockFiles, "{original}");
      });
    });
  });

  describe("AI features", () => {
    it("should not show AI section when AI is disabled", async () => {
      render(<ConfigureStep onContinue={mockOnContinue} onBack={mockOnBack} />);

      // Expand options
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: /More options/i }));

      expect(screen.queryByTestId("ai-analysis-bar")).not.toBeInTheDocument();
    });

    it("should show AI section when AI is enabled", async () => {
      mockStoreState = createMockStore({
        config: {
          ...mockConfig,
          ollama: { ...mockConfig.ollama, enabled: true },
        },
        llmStatus: "available" as const,
      });

      render(<ConfigureStep onContinue={mockOnContinue} onBack={mockOnBack} />);

      // Expand options
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: /More options/i }));

      expect(screen.getByTestId("ai-analysis-bar")).toBeInTheDocument();
    });
  });

  describe("config loading", () => {
    it("should call loadConfig when config is not loaded", () => {
      mockStoreState = createMockStore({ config: null });

      render(<ConfigureStep onContinue={mockOnContinue} onBack={mockOnBack} />);

      expect(mockLoadConfig).toHaveBeenCalled();
    });
  });
});
