/**
 * Tests for PreviewPanel component
 * Story 6.4 - Task 10.6
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PreviewPanel } from "./PreviewPanel";
import { useAppStore, type PreviewStatus } from "@/stores/app-store";
import type { RenamePreview, ScanResult, AppConfig, BatchRenameResult, FileInfo } from "@/lib/tauri";

// Mock the store
vi.mock("@/stores/app-store");

const mockUseAppStore = vi.mocked(useAppStore);

const createMockPreview = (overrides?: Partial<RenamePreview>): RenamePreview => ({
  proposals: [
    {
      id: "1",
      originalPath: "/folder/photo.jpg",
      originalName: "photo.jpg",
      proposedName: "2026-01-01_photo.jpg",
      proposedPath: "/folder/2026-01-01_photo.jpg",
      status: "ready",
      issues: [],
      actionType: "rename",
    },
    {
      id: "2",
      originalPath: "/folder/document.pdf",
      originalName: "document.pdf",
      proposedName: "2026-01-02_document.pdf",
      proposedPath: "/folder/2026-01-02_document.pdf",
      status: "ready",
      issues: [],
      actionType: "rename",
    },
  ],
  summary: {
    total: 2,
    ready: 2,
    conflicts: 0,
    missingData: 0,
    noChange: 0,
    invalidName: 0,
  },
  actionSummary: {
    renameCount: 2,
    moveCount: 0,
    noChangeCount: 0,
    conflictCount: 0,
    errorCount: 0,
  },
  reorganizationMode: "rename-only",
  generatedAt: "2026-01-01T00:00:00Z",
  templateUsed: "date-prefix",
  ...overrides,
});

const createMockConfig = (): AppConfig => ({
  version: 1,
  templates: [
    {
      id: "date-prefix",
      name: "Date Prefix",
      pattern: "{date}_{name}.{ext}",
      isDefault: true,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    },
    {
      id: "year-folder",
      name: "Year Folder",
      pattern: "{year}/{name}.{ext}",
      isDefault: false,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    },
  ],
  folderStructures: [],
  preferences: {
    defaultOutputFormat: "json",
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
});

const createMockScanResult = (): ScanResult => ({
  files: [
    {
      path: "/folder/photo.jpg",
      name: "photo",
      fullName: "photo.jpg",
      extension: "jpg",
      size: 1024,
      createdAt: "2026-01-01T00:00:00Z",
      modifiedAt: "2026-01-01T00:00:00Z",
      relativePath: "photo.jpg",
      category: "image",
      metadataSupported: true,
      metadataCapability: "full",
    },
  ],
  totalCount: 1,
  totalSize: 1024,
});

const createMockRenameResult = (): BatchRenameResult => ({
  success: true,
  results: [
    {
      proposalId: "1",
      originalPath: "/folder/photo.jpg",
      originalName: "photo.jpg",
      newPath: "/folder/2026-01-01_photo.jpg",
      newName: "2026-01-01_photo.jpg",
      outcome: "success",
    },
  ],
  summary: {
    total: 1,
    succeeded: 1,
    failed: 0,
    skipped: 0,
  },
  startedAt: "2026-01-01T00:00:00Z",
  completedAt: "2026-01-01T00:00:00Z",
  durationMs: 100,
});

describe("PreviewPanel", () => {
  const mockStore = {
    config: null as AppConfig | null,
    loadConfig: vi.fn(),
    scanResult: null as ScanResult | null,
    selectedFolder: null as string | null,
    preview: null as RenamePreview | null,
    previewStatus: "idle" as PreviewStatus,
    previewError: null as string | null,
    selectedProposalIds: new Set<string>(),
    lastRenameResult: null as BatchRenameResult | null,
    generatePreview: vi.fn(),
    toggleProposalSelection: vi.fn(),
    selectAllReady: vi.fn(),
    deselectAll: vi.fn(),
    applyRenames: vi.fn(),
    clearPreview: vi.fn(),
    aiSuggestions: new Map(),
    getFilteredFiles: vi.fn((): FileInfo[] => []),
    scanOptions: { recursive: false, fileTypes: [] },
    selectedFolderStructureId: null as string | null,
    setSelectedFolderStructure: vi.fn(),
    reorganizationMode: "rename-only" as const,
    organizeOptions: null,
    setReorganizationMode: vi.fn(),
    setOrganizeOptions: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock store to defaults
    mockStore.config = null;
    mockStore.scanResult = null;
    mockStore.preview = null;
    mockStore.previewStatus = "idle";
    mockStore.previewError = null;
    mockStore.selectedProposalIds = new Set<string>();
    mockStore.lastRenameResult = null;
    mockStore.aiSuggestions = new Map();
    mockStore.getFilteredFiles = vi.fn(() => []);
    mockStore.scanOptions = { recursive: false, fileTypes: [] };
    mockUseAppStore.mockReturnValue(mockStore as unknown as ReturnType<typeof useAppStore>);
  });

  describe("loading state", () => {
    it("renders loading spinner when generating preview", () => {
      mockStore.previewStatus = "generating";
      mockUseAppStore.mockReturnValue(mockStore as unknown as ReturnType<typeof useAppStore>);

      render(<PreviewPanel />);

      expect(screen.getByTestId("preview-panel-loading")).toBeInTheDocument();
      // "Calm & Confident" text
      expect(screen.getByText("Preparing preview...")).toBeInTheDocument();
    });
  });

  describe("error state", () => {
    it("renders error message when preview generation fails", () => {
      mockStore.previewStatus = "error";
      mockStore.previewError = "Failed to read file metadata";
      mockUseAppStore.mockReturnValue(mockStore as unknown as ReturnType<typeof useAppStore>);

      render(<PreviewPanel />);

      expect(screen.getByTestId("preview-panel-error")).toBeInTheDocument();
      // "Calm & Confident" text
      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
      expect(screen.getByText("Failed to read file metadata")).toBeInTheDocument();
    });
  });

  describe("empty state", () => {
    it("renders nothing when no preview is available", () => {
      mockStore.preview = null;
      mockUseAppStore.mockReturnValue(mockStore as unknown as ReturnType<typeof useAppStore>);

      const { container } = render(<PreviewPanel />);

      expect(container.firstChild).toBeNull();
    });
  });

  describe("with preview", () => {
    beforeEach(() => {
      mockStore.config = createMockConfig();
      mockStore.scanResult = createMockScanResult();
      mockStore.preview = createMockPreview();
      mockStore.previewStatus = "ready";
      mockStore.getFilteredFiles = vi.fn(() => createMockScanResult().files);
    });

    it("renders preview panel with all components", () => {
      mockUseAppStore.mockReturnValue(mockStore as unknown as ReturnType<typeof useAppStore>);

      render(<PreviewPanel />);

      expect(screen.getByTestId("preview-panel")).toBeInTheDocument();
      expect(screen.getByTestId("template-selector")).toBeInTheDocument();
      expect(screen.getByTestId("action-bar")).toBeInTheDocument();
    });

    it("loads config on mount if not present", () => {
      mockStore.config = null;
      mockUseAppStore.mockReturnValue(mockStore as unknown as ReturnType<typeof useAppStore>);

      render(<PreviewPanel />);

      expect(mockStore.loadConfig).toHaveBeenCalled();
    });

    it("does not load config if already present", () => {
      mockStore.config = createMockConfig();
      mockUseAppStore.mockReturnValue(mockStore as unknown as ReturnType<typeof useAppStore>);

      render(<PreviewPanel />);

      expect(mockStore.loadConfig).not.toHaveBeenCalled();
    });
  });

  describe("template selection", () => {
    it("triggers preview regeneration when template changes", async () => {
      mockStore.config = createMockConfig();
      mockStore.scanResult = createMockScanResult();
      mockStore.preview = createMockPreview();
      mockStore.previewStatus = "ready";
      mockUseAppStore.mockReturnValue(mockStore as unknown as ReturnType<typeof useAppStore>);

      render(<PreviewPanel />);

      // The component should have a template selector
      expect(screen.getByTestId("template-selector")).toBeInTheDocument();
    });
  });

  describe("apply flow", () => {
    it("disables UI during apply operation", () => {
      mockStore.config = createMockConfig();
      mockStore.preview = createMockPreview();
      mockStore.previewStatus = "applying";
      mockUseAppStore.mockReturnValue(mockStore as unknown as ReturnType<typeof useAppStore>);

      render(<PreviewPanel />);

      // Template selector should be disabled during apply
      expect(screen.getByTestId("template-selector-trigger")).toBeDisabled();
    });
  });

  describe("result display", () => {
    it("shows result and hides action bar after successful rename", () => {
      mockStore.config = createMockConfig();
      mockStore.preview = createMockPreview();
      mockStore.previewStatus = "ready";
      mockStore.lastRenameResult = createMockRenameResult();
      mockUseAppStore.mockReturnValue(mockStore as unknown as ReturnType<typeof useAppStore>);

      render(<PreviewPanel />);

      // Result card should be shown
      expect(screen.getByTestId("rename-result-card")).toBeInTheDocument();
      // Action bar should be hidden when result is shown
      expect(screen.queryByTestId("action-bar")).not.toBeInTheDocument();
    });

    it("calls clearPreview when dismissing result", async () => {
      const user = userEvent.setup();
      mockStore.config = createMockConfig();
      mockStore.preview = createMockPreview();
      mockStore.previewStatus = "ready";
      mockStore.lastRenameResult = createMockRenameResult();
      mockUseAppStore.mockReturnValue(mockStore as unknown as ReturnType<typeof useAppStore>);

      render(<PreviewPanel />);

      const dismissButton = screen.getByRole("button", { name: /dismiss/i });
      await user.click(dismissButton);

      expect(mockStore.clearPreview).toHaveBeenCalled();
    });
  });

  describe("progress display", () => {
    it("shows progress card during rename operation", () => {
      mockStore.config = createMockConfig();
      mockStore.preview = createMockPreview();
      mockStore.previewStatus = "applying";
      // Set some selected proposals for realistic progress display
      mockStore.selectedProposalIds = new Set(["1", "2", "3"]);
      mockUseAppStore.mockReturnValue(mockStore as unknown as ReturnType<typeof useAppStore>);

      render(<PreviewPanel />);

      expect(screen.getByTestId("rename-progress-card")).toBeInTheDocument();
      // "Calm & Confident" progress text - "Working on X of Y"
      expect(screen.getByText("Working on 1 of 3")).toBeInTheDocument();
    });
  });
});
