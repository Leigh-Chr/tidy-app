/**
 * Tests for app store
 * Task 3.5: Write store tests for folder selection flow
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useAppStore } from "./app-store";
import { invoke } from "@tauri-apps/api/core";

// Mock the invoke function
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

const mockInvoke = vi.mocked(invoke);

describe("useAppStore", () => {
  beforeEach(() => {
    // Reset store before each test
    useAppStore.getState().reset();
    mockInvoke.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("initial state", () => {
    it("has correct initial values", () => {
      const state = useAppStore.getState();

      expect(state.status).toBe("idle");
      expect(state.error).toBeNull();
      expect(state.versionInfo).toBeNull();
      expect(state.selectedFolder).toBeNull();
      expect(state.scanStatus).toBe("idle");
      expect(state.scanResult).toBeNull();
      expect(state.scanError).toBeNull();
      // Config state (Story 6.3)
      expect(state.config).toBeNull();
      expect(state.configStatus).toBe("idle");
      expect(state.configError).toBeNull();
    });
  });

  describe("selectFolder", () => {
    it("sets selected folder and triggers scan", async () => {
      const mockScanResult = {
        files: [
          {
            path: "/test/file.jpg",
            name: "file",
            extension: "jpg",
            fullName: "file.jpg",
            size: 1024,
            createdAt: "2026-01-01T00:00:00Z",
            modifiedAt: "2026-01-01T00:00:00Z",
            relativePath: "file.jpg",
            category: "image",
            metadataSupported: true,
            metadataCapability: "full",
          },
        ],
        totalCount: 1,
        totalSize: 1024,
      };

      mockInvoke.mockResolvedValueOnce(mockScanResult);

      const result = await useAppStore.getState().selectFolder("/test/folder");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual(mockScanResult);
      }

      const state = useAppStore.getState();
      expect(state.selectedFolder).toBe("/test/folder");
      expect(state.scanStatus).toBe("success");
      expect(state.scanResult).toEqual(mockScanResult);
      expect(state.scanError).toBeNull();
    });

    it("sets scan status to scanning during scan", async () => {
      let scanStatusDuringCall: string | null = null;

      mockInvoke.mockImplementationOnce(async () => {
        // Capture state during scan
        scanStatusDuringCall = useAppStore.getState().scanStatus;
        return { files: [], totalCount: 0, totalSize: 0 };
      });

      await useAppStore.getState().selectFolder("/test/folder");

      expect(scanStatusDuringCall).toBe("scanning");
    });

    it("handles scan errors correctly", async () => {
      const error = new Error("Path does not exist");
      mockInvoke.mockRejectedValueOnce(error);

      const result = await useAppStore.getState().selectFolder("/nonexistent");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe("Path does not exist");
      }

      const state = useAppStore.getState();
      expect(state.selectedFolder).toBe("/nonexistent");
      expect(state.scanStatus).toBe("error");
      expect(state.scanResult).toBeNull();
      expect(state.scanError).toBe("Path does not exist");
    });

    it("calls scan_folder with correct arguments and default scan options", async () => {
      mockInvoke.mockResolvedValueOnce({ files: [], totalCount: 0, totalSize: 0 });

      await useAppStore.getState().selectFolder("/my/folder");

      expect(mockInvoke).toHaveBeenCalledWith("scan_folder", {
        path: "/my/folder",
        options: { recursive: false },
      });
    });
  });

  describe("clearFolder", () => {
    it("resets folder-related state", async () => {
      // First, set some folder state
      mockInvoke.mockResolvedValueOnce({ files: [], totalCount: 0, totalSize: 0 });
      await useAppStore.getState().selectFolder("/test/folder");

      // Now clear it
      useAppStore.getState().clearFolder();

      const state = useAppStore.getState();
      expect(state.selectedFolder).toBeNull();
      expect(state.scanStatus).toBe("idle");
      expect(state.scanResult).toBeNull();
      expect(state.scanError).toBeNull();
    });
  });

  describe("reset", () => {
    it("resets all state including folder state", async () => {
      // Set some state
      mockInvoke.mockResolvedValueOnce({ version: "0.2.0", core_version: "0.2.0" });
      await useAppStore.getState().loadVersion();

      mockInvoke.mockResolvedValueOnce({ files: [], totalCount: 0, totalSize: 0 });
      await useAppStore.getState().selectFolder("/test/folder");

      // Reset all
      useAppStore.getState().reset();

      const state = useAppStore.getState();
      expect(state.status).toBe("idle");
      expect(state.versionInfo).toBeNull();
      expect(state.selectedFolder).toBeNull();
      expect(state.scanResult).toBeNull();
    });
  });

  // ==========================================================================
  // Config Actions Tests (Story 6.3)
  // ==========================================================================

  const mockConfig = {
    version: 1 as const,
    templates: [
      {
        id: "template-1",
        name: "Test Template",
        pattern: "{date}-{original}",
        fileTypes: ["jpg", "png"],
        isDefault: true,
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      },
    ],
    folderStructures: [],
    preferences: {
      defaultOutputFormat: "table" as const,
      colorOutput: true,
      confirmBeforeApply: true,
      recursiveScan: false,
    },
    recentFolders: [],
    ollama: {
      enabled: false,
      provider: "ollama" as const,
      baseUrl: "http://localhost:11434",
      timeout: 30000,
      models: {},
      fileTypes: {
        preset: "documents" as const,
        includedExtensions: [],
        excludedExtensions: [],
        skipWithMetadata: true,
      },
      visionEnabled: false,
      skipImagesWithExif: true,
      maxImageSize: 20 * 1024 * 1024,
      offlineMode: "auto" as const,
      healthCheckTimeout: 5000,
      openai: {
        apiKey: "",
        baseUrl: "https://api.openai.com/v1",
        model: "gpt-4o-mini",
        visionModel: "gpt-4o",
      },
    },
  };

  describe("loadConfig", () => {
    it("loads config and updates store", async () => {
      mockInvoke.mockResolvedValueOnce(mockConfig);

      const result = await useAppStore.getState().loadConfig();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual(mockConfig);
      }

      const state = useAppStore.getState();
      expect(state.config).toEqual(mockConfig);
      expect(state.configStatus).toBe("success");
      expect(state.configError).toBeNull();
    });

    it("sets configStatus to loading during load", async () => {
      let statusDuringCall: string | null = null;

      mockInvoke.mockImplementationOnce(async () => {
        statusDuringCall = useAppStore.getState().configStatus;
        return mockConfig;
      });

      await useAppStore.getState().loadConfig();

      expect(statusDuringCall).toBe("loading");
    });

    it("handles load errors", async () => {
      const error = new Error("Failed to read config");
      mockInvoke.mockRejectedValueOnce(error);

      const result = await useAppStore.getState().loadConfig();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe("Failed to read config");
      }

      const state = useAppStore.getState();
      expect(state.configStatus).toBe("error");
      expect(state.configError).toBe("Failed to read config");
    });
  });

  describe("saveConfig", () => {
    it("saves config and updates store", async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      const result = await useAppStore.getState().saveConfig(mockConfig);

      expect(result.ok).toBe(true);
      expect(mockInvoke).toHaveBeenCalledWith("save_config", { config: mockConfig });

      const state = useAppStore.getState();
      expect(state.config).toEqual(mockConfig);
      expect(state.configStatus).toBe("success");
    });

    it("sets configStatus to saving during save", async () => {
      let statusDuringCall: string | null = null;

      mockInvoke.mockImplementationOnce(async () => {
        statusDuringCall = useAppStore.getState().configStatus;
        return undefined;
      });

      await useAppStore.getState().saveConfig(mockConfig);

      expect(statusDuringCall).toBe("saving");
    });

    it("handles save errors", async () => {
      const error = new Error("Write failed");
      mockInvoke.mockRejectedValueOnce(error);

      const result = await useAppStore.getState().saveConfig(mockConfig);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe("Write failed");
      }

      const state = useAppStore.getState();
      expect(state.configStatus).toBe("error");
      expect(state.configError).toBe("Write failed");
    });
  });

  describe("updateTemplate", () => {
    beforeEach(async () => {
      mockInvoke.mockResolvedValueOnce(mockConfig);
      await useAppStore.getState().loadConfig();
      mockInvoke.mockClear();
    });

    it("updates template and saves config", async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      const result = await useAppStore.getState().updateTemplate("template-1", { name: "Updated Name" });

      expect(result.ok).toBe(true);
      expect(mockInvoke).toHaveBeenCalledWith("save_config", expect.objectContaining({
        config: expect.objectContaining({
          templates: expect.arrayContaining([
            expect.objectContaining({ id: "template-1", name: "Updated Name" }),
          ]),
        }),
      }));
    });

    it("returns error if config not loaded", async () => {
      useAppStore.getState().reset();

      const result = await useAppStore.getState().updateTemplate("template-1", { name: "Updated" });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe("Config not loaded");
      }
    });

    it("returns error if template not found", async () => {
      const result = await useAppStore.getState().updateTemplate("nonexistent", { name: "Updated" });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe("Template not found: nonexistent");
      }
    });
  });

  describe("addTemplate", () => {
    beforeEach(async () => {
      mockInvoke.mockResolvedValueOnce(mockConfig);
      await useAppStore.getState().loadConfig();
      mockInvoke.mockClear();
    });

    it("adds template with generated id and timestamps", async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      const result = await useAppStore.getState().addTemplate({
        name: "New Template",
        pattern: "{year}/{original}",
        isDefault: false,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.name).toBe("New Template");
        expect(result.data.id).toBeDefined();
        expect(result.data.createdAt).toBeDefined();
        expect(result.data.updatedAt).toBeDefined();
      }
    });

    it("returns error if config not loaded", async () => {
      useAppStore.getState().reset();

      const result = await useAppStore.getState().addTemplate({
        name: "New",
        pattern: "{date}",
        isDefault: false,
      });

      expect(result.ok).toBe(false);
    });
  });

  describe("deleteTemplate", () => {
    beforeEach(async () => {
      mockInvoke.mockResolvedValueOnce(mockConfig);
      await useAppStore.getState().loadConfig();
      mockInvoke.mockClear();
    });

    it("deletes template and saves config", async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      const result = await useAppStore.getState().deleteTemplate("template-1");

      expect(result.ok).toBe(true);
      expect(mockInvoke).toHaveBeenCalledWith("save_config", expect.objectContaining({
        config: expect.objectContaining({
          templates: [],
        }),
      }));
    });

    it("returns error if template not found", async () => {
      const result = await useAppStore.getState().deleteTemplate("nonexistent");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe("Template not found: nonexistent");
      }
    });
  });

  describe("setDefaultTemplate", () => {
    const configWithMultiple = {
      ...mockConfig,
      templates: [
        { ...mockConfig.templates[0], isDefault: true },
        { ...mockConfig.templates[0], id: "template-2", name: "Second", isDefault: false },
      ],
    };

    beforeEach(async () => {
      mockInvoke.mockResolvedValueOnce(configWithMultiple);
      await useAppStore.getState().loadConfig();
      mockInvoke.mockClear();
    });

    it("sets new default and clears old default", async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      const result = await useAppStore.getState().setDefaultTemplate("template-2");

      expect(result.ok).toBe(true);
      expect(mockInvoke).toHaveBeenCalledWith("save_config", expect.objectContaining({
        config: expect.objectContaining({
          templates: expect.arrayContaining([
            expect.objectContaining({ id: "template-1", isDefault: false }),
            expect.objectContaining({ id: "template-2", isDefault: true }),
          ]),
        }),
      }));
    });

    it("returns error if template not found", async () => {
      const result = await useAppStore.getState().setDefaultTemplate("nonexistent");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe("Template not found: nonexistent");
      }
    });
  });

  describe("updatePreferences", () => {
    beforeEach(async () => {
      mockInvoke.mockResolvedValueOnce(mockConfig);
      await useAppStore.getState().loadConfig();
      mockInvoke.mockClear();
    });

    it("updates preferences and saves config", async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      const result = await useAppStore.getState().updatePreferences({ recursiveScan: true });

      expect(result.ok).toBe(true);
      expect(mockInvoke).toHaveBeenCalledWith("save_config", expect.objectContaining({
        config: expect.objectContaining({
          preferences: expect.objectContaining({ recursiveScan: true }),
        }),
      }));
    });

    it("returns error if config not loaded", async () => {
      useAppStore.getState().reset();

      const result = await useAppStore.getState().updatePreferences({ recursiveScan: true });

      expect(result.ok).toBe(false);
    });
  });

  describe("resetConfig", () => {
    it("calls reset_config and updates store", async () => {
      mockInvoke.mockResolvedValueOnce(mockConfig);

      const result = await useAppStore.getState().resetConfig();

      expect(result.ok).toBe(true);
      expect(mockInvoke).toHaveBeenCalledWith("reset_config");

      const state = useAppStore.getState();
      expect(state.config).toEqual(mockConfig);
      expect(state.configStatus).toBe("success");
    });

    it("handles reset errors", async () => {
      const error = new Error("Reset failed");
      mockInvoke.mockRejectedValueOnce(error);

      const result = await useAppStore.getState().resetConfig();

      expect(result.ok).toBe(false);
      const state = useAppStore.getState();
      expect(state.configStatus).toBe("error");
    });
  });

  // ==========================================================================
  // Preview Actions Tests (Story 6.4)
  // ==========================================================================

  const mockFiles = [
    {
      path: "/test/photo1.jpg",
      name: "photo1",
      extension: "jpg",
      fullName: "photo1.jpg",
      size: 1024,
      createdAt: "2026-01-01T00:00:00Z",
      modifiedAt: "2026-01-01T00:00:00Z",
      relativePath: "photo1.jpg",
      category: "image" as const,
      metadataSupported: true,
      metadataCapability: "full" as const,
    },
    {
      path: "/test/photo2.jpg",
      name: "photo2",
      extension: "jpg",
      fullName: "photo2.jpg",
      size: 2048,
      createdAt: "2026-01-02T00:00:00Z",
      modifiedAt: "2026-01-02T00:00:00Z",
      relativePath: "photo2.jpg",
      category: "image" as const,
      metadataSupported: true,
      metadataCapability: "full" as const,
    },
  ];

  const mockPreview = {
    proposals: [
      {
        id: "proposal-1",
        originalPath: "/test/photo1.jpg",
        originalName: "photo1.jpg",
        proposedName: "2026-01-01_photo1.jpg",
        proposedPath: "/test/2026-01-01_photo1.jpg",
        status: "ready" as const,
        issues: [],
        metadataSources: ["filename"],
      },
      {
        id: "proposal-2",
        originalPath: "/test/photo2.jpg",
        originalName: "photo2.jpg",
        proposedName: "2026-01-02_photo2.jpg",
        proposedPath: "/test/2026-01-02_photo2.jpg",
        status: "ready" as const,
        issues: [],
        metadataSources: ["filename"],
      },
      {
        id: "proposal-3",
        originalPath: "/test/doc.pdf",
        originalName: "doc.pdf",
        proposedName: "doc.pdf",
        proposedPath: "/test/doc.pdf",
        status: "no-change" as const,
        issues: [],
        metadataSources: [],
      },
    ],
    summary: {
      total: 3,
      ready: 2,
      conflicts: 0,
      missingData: 0,
      noChange: 1,
      invalidName: 0,
    },
    generatedAt: "2026-01-10T12:00:00Z",
    templateUsed: "{date}_{name}.{ext}",
  };

  const mockBatchRenameResult = {
    success: true,
    results: [
      {
        proposalId: "proposal-1",
        originalPath: "/test/photo1.jpg",
        originalName: "photo1.jpg",
        newPath: "/test/2026-01-01_photo1.jpg",
        newName: "2026-01-01_photo1.jpg",
        outcome: "success" as const,
      },
      {
        proposalId: "proposal-2",
        originalPath: "/test/photo2.jpg",
        originalName: "photo2.jpg",
        newPath: "/test/2026-01-02_photo2.jpg",
        newName: "2026-01-02_photo2.jpg",
        outcome: "success" as const,
      },
    ],
    summary: {
      total: 2,
      succeeded: 2,
      failed: 0,
      skipped: 0,
    },
    startedAt: "2026-01-10T12:00:00Z",
    completedAt: "2026-01-10T12:00:01Z",
    durationMs: 1000,
  };

  describe("initial preview state", () => {
    it("has correct initial preview values", () => {
      const state = useAppStore.getState();

      expect(state.preview).toBeNull();
      expect(state.previewStatus).toBe("idle");
      expect(state.previewError).toBeNull();
      expect(state.selectedProposalIds).toEqual(new Set());
      expect(state.lastRenameResult).toBeNull();
    });
  });

  describe("generatePreview", () => {
    it("generates preview and updates store", async () => {
      mockInvoke.mockResolvedValueOnce(mockPreview);

      const result = await useAppStore.getState().generatePreview(mockFiles, "{date}_{name}.{ext}");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual(mockPreview);
      }

      const state = useAppStore.getState();
      expect(state.preview).toEqual(mockPreview);
      expect(state.previewStatus).toBe("ready");
      expect(state.previewError).toBeNull();
      expect(state.selectedProposalIds).toEqual(new Set());
    });

    it("sets previewStatus to generating during generation", async () => {
      let statusDuringCall: string | null = null;

      mockInvoke.mockImplementationOnce(async () => {
        statusDuringCall = useAppStore.getState().previewStatus;
        return mockPreview;
      });

      await useAppStore.getState().generatePreview(mockFiles, "{date}_{name}.{ext}");

      expect(statusDuringCall).toBe("generating");
    });

    it("clears previous selection when generating new preview", async () => {
      // Set up some selections first
      mockInvoke.mockResolvedValueOnce(mockPreview);
      await useAppStore.getState().generatePreview(mockFiles, "{date}_{name}.{ext}");
      useAppStore.getState().toggleProposalSelection("proposal-1");
      expect(useAppStore.getState().selectedProposalIds.size).toBe(1);

      // Generate new preview
      mockInvoke.mockResolvedValueOnce(mockPreview);
      await useAppStore.getState().generatePreview(mockFiles, "{year}_{name}.{ext}");

      expect(useAppStore.getState().selectedProposalIds.size).toBe(0);
    });

    it("handles preview generation errors", async () => {
      const error = new Error("Template pattern invalid");
      mockInvoke.mockRejectedValueOnce(error);

      const result = await useAppStore.getState().generatePreview(mockFiles, "{invalid}");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe("Template pattern invalid");
      }

      const state = useAppStore.getState();
      expect(state.preview).toBeNull();
      expect(state.previewStatus).toBe("error");
      expect(state.previewError).toBe("Template pattern invalid");
    });

    it("calls generate_preview with correct arguments", async () => {
      mockInvoke.mockResolvedValueOnce(mockPreview);

      await useAppStore.getState().generatePreview(mockFiles, "{date}_{name}.{ext}");

      expect(mockInvoke).toHaveBeenCalledWith("generate_preview", {
        files: mockFiles,
        templatePattern: "{date}_{name}.{ext}",
        options: {
          folderPattern: undefined,
          baseDirectory: undefined,
        },
      });
    });
  });

  describe("toggleProposalSelection", () => {
    beforeEach(async () => {
      mockInvoke.mockResolvedValueOnce(mockPreview);
      await useAppStore.getState().generatePreview(mockFiles, "{date}_{name}.{ext}");
      mockInvoke.mockClear();
    });

    it("adds proposal to selection when not selected", () => {
      useAppStore.getState().toggleProposalSelection("proposal-1");

      const state = useAppStore.getState();
      expect(state.selectedProposalIds.has("proposal-1")).toBe(true);
      expect(state.selectedProposalIds.size).toBe(1);
    });

    it("removes proposal from selection when already selected", () => {
      useAppStore.getState().toggleProposalSelection("proposal-1");
      useAppStore.getState().toggleProposalSelection("proposal-1");

      const state = useAppStore.getState();
      expect(state.selectedProposalIds.has("proposal-1")).toBe(false);
      expect(state.selectedProposalIds.size).toBe(0);
    });

    it("allows multiple selections", () => {
      useAppStore.getState().toggleProposalSelection("proposal-1");
      useAppStore.getState().toggleProposalSelection("proposal-2");

      const state = useAppStore.getState();
      expect(state.selectedProposalIds.has("proposal-1")).toBe(true);
      expect(state.selectedProposalIds.has("proposal-2")).toBe(true);
      expect(state.selectedProposalIds.size).toBe(2);
    });
  });

  describe("selectAllReady", () => {
    beforeEach(async () => {
      mockInvoke.mockResolvedValueOnce(mockPreview);
      await useAppStore.getState().generatePreview(mockFiles, "{date}_{name}.{ext}");
      mockInvoke.mockClear();
    });

    it("selects all proposals with ready status", () => {
      useAppStore.getState().selectAllReady();

      const state = useAppStore.getState();
      expect(state.selectedProposalIds.has("proposal-1")).toBe(true);
      expect(state.selectedProposalIds.has("proposal-2")).toBe(true);
      expect(state.selectedProposalIds.has("proposal-3")).toBe(false); // no-change status
      expect(state.selectedProposalIds.size).toBe(2);
    });

    it("does nothing if no preview available", () => {
      useAppStore.getState().clearPreview();
      useAppStore.getState().selectAllReady();

      const state = useAppStore.getState();
      expect(state.selectedProposalIds.size).toBe(0);
    });
  });

  describe("deselectAll", () => {
    beforeEach(async () => {
      mockInvoke.mockResolvedValueOnce(mockPreview);
      await useAppStore.getState().generatePreview(mockFiles, "{date}_{name}.{ext}");
      mockInvoke.mockClear();
    });

    it("clears all selections", () => {
      useAppStore.getState().toggleProposalSelection("proposal-1");
      useAppStore.getState().toggleProposalSelection("proposal-2");
      expect(useAppStore.getState().selectedProposalIds.size).toBe(2);

      useAppStore.getState().deselectAll();

      const state = useAppStore.getState();
      expect(state.selectedProposalIds.size).toBe(0);
    });
  });

  describe("applyRenames", () => {
    beforeEach(async () => {
      mockInvoke.mockResolvedValueOnce(mockPreview);
      await useAppStore.getState().generatePreview(mockFiles, "{date}_{name}.{ext}");
      mockInvoke.mockClear();
    });

    it("applies renames for selected proposals", async () => {
      useAppStore.getState().toggleProposalSelection("proposal-1");
      useAppStore.getState().toggleProposalSelection("proposal-2");

      mockInvoke.mockResolvedValueOnce(mockBatchRenameResult);

      const result = await useAppStore.getState().applyRenames();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual(mockBatchRenameResult);
      }

      const state = useAppStore.getState();
      expect(state.lastRenameResult).toEqual(mockBatchRenameResult);
      expect(state.previewStatus).toBe("ready");
      expect(state.selectedProposalIds.size).toBe(0); // Cleared after apply
    });

    it("applies renames for specified proposal IDs", async () => {
      mockInvoke.mockResolvedValueOnce(mockBatchRenameResult);

      const result = await useAppStore.getState().applyRenames(["proposal-1"]);

      expect(result.ok).toBe(true);
      expect(mockInvoke).toHaveBeenCalledWith("execute_rename", {
        proposals: mockPreview.proposals,
        options: { proposalIds: ["proposal-1"] },
      });
    });

    it("sets previewStatus to applying during execution", async () => {
      useAppStore.getState().toggleProposalSelection("proposal-1");

      let statusDuringCall: string | null = null;
      mockInvoke.mockImplementationOnce(async () => {
        statusDuringCall = useAppStore.getState().previewStatus;
        return mockBatchRenameResult;
      });

      await useAppStore.getState().applyRenames();

      expect(statusDuringCall).toBe("applying");
    });

    it("returns error if no preview available", async () => {
      useAppStore.getState().clearPreview();

      const result = await useAppStore.getState().applyRenames();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe("No preview available");
      }
    });

    it("returns error if no files selected", async () => {
      const result = await useAppStore.getState().applyRenames();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe("No files selected for rename");
      }
    });

    it("handles rename execution errors", async () => {
      useAppStore.getState().toggleProposalSelection("proposal-1");

      const error = new Error("File system error");
      mockInvoke.mockRejectedValueOnce(error);

      const result = await useAppStore.getState().applyRenames();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe("File system error");
      }

      const state = useAppStore.getState();
      expect(state.previewStatus).toBe("error");
      expect(state.previewError).toBe("File system error");
    });
  });

  describe("clearPreview", () => {
    beforeEach(async () => {
      mockInvoke.mockResolvedValueOnce(mockPreview);
      await useAppStore.getState().generatePreview(mockFiles, "{date}_{name}.{ext}");
      useAppStore.getState().toggleProposalSelection("proposal-1");
      mockInvoke.mockClear();
    });

    it("resets all preview-related state", () => {
      useAppStore.getState().clearPreview();

      const state = useAppStore.getState();
      expect(state.preview).toBeNull();
      expect(state.previewStatus).toBe("idle");
      expect(state.previewError).toBeNull();
      expect(state.selectedProposalIds.size).toBe(0);
      expect(state.lastRenameResult).toBeNull();
    });
  });

  // ==========================================================================
  // Scan Options Tests (Story 6.5)
  // ==========================================================================

  describe("scanOptions state", () => {
    it("has correct initial scan options values", () => {
      const state = useAppStore.getState();

      expect(state.scanOptions).toEqual({
        recursive: false,
        fileTypes: [],
      });
    });
  });

  describe("setScanOptions", () => {
    it("updates recursive option", () => {
      useAppStore.getState().setScanOptions({ recursive: true });

      const state = useAppStore.getState();
      expect(state.scanOptions.recursive).toBe(true);
    });

    it("updates fileTypes option", () => {
      useAppStore.getState().setScanOptions({ fileTypes: ["image", "document"] });

      const state = useAppStore.getState();
      expect(state.scanOptions.fileTypes).toEqual(["image", "document"]);
    });

    it("preserves existing options when partially updating", () => {
      useAppStore.getState().setScanOptions({ recursive: true, fileTypes: ["image"] });
      useAppStore.getState().setScanOptions({ recursive: false });

      const state = useAppStore.getState();
      expect(state.scanOptions.recursive).toBe(false);
      expect(state.scanOptions.fileTypes).toEqual(["image"]);
    });
  });

  describe("selectFolder with scan options", () => {
    it("passes recursive option to scan_folder command", async () => {
      useAppStore.getState().setScanOptions({ recursive: true });
      mockInvoke.mockResolvedValueOnce({ files: [], totalCount: 0, totalSize: 0 });

      await useAppStore.getState().selectFolder("/test/folder");

      expect(mockInvoke).toHaveBeenCalledWith("scan_folder", {
        path: "/test/folder",
        options: { recursive: true },
      });
    });

    it("passes non-recursive option to scan_folder command", async () => {
      useAppStore.getState().setScanOptions({ recursive: false });
      mockInvoke.mockResolvedValueOnce({ files: [], totalCount: 0, totalSize: 0 });

      await useAppStore.getState().selectFolder("/test/folder");

      expect(mockInvoke).toHaveBeenCalledWith("scan_folder", {
        path: "/test/folder",
        options: { recursive: false },
      });
    });
  });

  describe("filteredFiles selector", () => {
    const scanResultWithCategories = {
      files: [
        {
          path: "/test/image.jpg",
          name: "image",
          extension: "jpg",
          fullName: "image.jpg",
          size: 1024,
          createdAt: "2026-01-01T00:00:00Z",
          modifiedAt: "2026-01-01T00:00:00Z",
          relativePath: "image.jpg",
          category: "image" as const,
          metadataSupported: true,
          metadataCapability: "full" as const,
        },
        {
          path: "/test/doc.pdf",
          name: "doc",
          extension: "pdf",
          fullName: "doc.pdf",
          size: 2048,
          createdAt: "2026-01-01T00:00:00Z",
          modifiedAt: "2026-01-01T00:00:00Z",
          relativePath: "doc.pdf",
          category: "document" as const,
          metadataSupported: true,
          metadataCapability: "basic" as const,
        },
        {
          path: "/test/code.ts",
          name: "code",
          extension: "ts",
          fullName: "code.ts",
          size: 512,
          createdAt: "2026-01-01T00:00:00Z",
          modifiedAt: "2026-01-01T00:00:00Z",
          relativePath: "code.ts",
          category: "code" as const,
          metadataSupported: false,
          metadataCapability: "none" as const,
        },
      ],
      totalCount: 3,
      totalSize: 3584,
    };

    beforeEach(async () => {
      mockInvoke.mockResolvedValueOnce(scanResultWithCategories);
      await useAppStore.getState().selectFolder("/test/folder");
      mockInvoke.mockClear();
    });

    it("returns all files when no filter is set", () => {
      useAppStore.getState().setScanOptions({ fileTypes: [] });

      const filteredFiles = useAppStore.getState().getFilteredFiles();

      expect(filteredFiles.length).toBe(3);
    });

    it("filters by single file type", () => {
      useAppStore.getState().setScanOptions({ fileTypes: ["image"] });

      const filteredFiles = useAppStore.getState().getFilteredFiles();

      expect(filteredFiles.length).toBe(1);
      expect(filteredFiles[0].category).toBe("image");
    });

    it("filters by multiple file types (OR logic)", () => {
      useAppStore.getState().setScanOptions({ fileTypes: ["image", "document"] });

      const filteredFiles = useAppStore.getState().getFilteredFiles();

      expect(filteredFiles.length).toBe(2);
      expect(filteredFiles.map((f) => f.category).sort()).toEqual(["document", "image"]);
    });

    it("returns empty array when no files match filter", () => {
      useAppStore.getState().setScanOptions({ fileTypes: ["video"] });

      const filteredFiles = useAppStore.getState().getFilteredFiles();

      expect(filteredFiles.length).toBe(0);
    });

    it("returns empty array when no scan result exists", () => {
      useAppStore.getState().clearFolder();

      const filteredFiles = useAppStore.getState().getFilteredFiles();

      expect(filteredFiles.length).toBe(0);
    });
  });

  // ==========================================================================
  // Config Persistence Tests (Story 6.5 - Code Review Fix)
  // ==========================================================================

  describe("scan options config persistence", () => {
    it("syncs scanOptions.recursive from config on loadConfig", async () => {
      const configWithRecursive = {
        ...mockConfig,
        preferences: {
          ...mockConfig.preferences,
          recursiveScan: true,
        },
      };
      mockInvoke.mockResolvedValueOnce(configWithRecursive);

      await useAppStore.getState().loadConfig();

      const state = useAppStore.getState();
      expect(state.scanOptions.recursive).toBe(true);
    });

    it("persists recursive option to config when setScanOptions is called", async () => {
      // First load config
      mockInvoke.mockResolvedValueOnce(mockConfig);
      await useAppStore.getState().loadConfig();
      mockInvoke.mockClear();

      // Now change recursive option
      mockInvoke.mockResolvedValueOnce(undefined); // For save_config call
      useAppStore.getState().setScanOptions({ recursive: true });

      // Wait for async save
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Should have called save_config with updated preferences
      expect(mockInvoke).toHaveBeenCalledWith("save_config", expect.objectContaining({
        config: expect.objectContaining({
          preferences: expect.objectContaining({
            recursiveScan: true,
          }),
        }),
      }));
    });

    it("does not persist to config when fileTypes changes (fileTypes not persisted)", async () => {
      // First load config
      mockInvoke.mockResolvedValueOnce(mockConfig);
      await useAppStore.getState().loadConfig();
      mockInvoke.mockClear();

      // Change fileTypes option
      useAppStore.getState().setScanOptions({ fileTypes: ["image"] });

      // Wait a bit to ensure no async call happens
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Should not have called save_config
      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it("does not persist if config is not loaded", () => {
      useAppStore.getState().reset();
      mockInvoke.mockClear();

      // Change recursive option without loading config first
      useAppStore.getState().setScanOptions({ recursive: true });

      // State should still be updated
      expect(useAppStore.getState().scanOptions.recursive).toBe(true);
      // But save_config should not be called
      expect(mockInvoke).not.toHaveBeenCalled();
    });
  });
});
