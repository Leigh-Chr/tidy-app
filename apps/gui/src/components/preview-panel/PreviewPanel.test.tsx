/**
 * Tests for PreviewPanel component
 * Story 6.4 - Task 10.6
 *
 * Note: Template selection and configuration have moved to ConfigureStep.
 * PreviewPanel now focuses solely on displaying the preview table and action bar.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PreviewPanel } from "./PreviewPanel";
import { useAppStore, type PreviewStatus } from "@/stores/app-store";
import type { RenamePreview, BatchRenameResult, AiSuggestion } from "@/lib/tauri";

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
    preview: null as RenamePreview | null,
    previewStatus: "idle" as PreviewStatus,
    previewError: null as string | null,
    selectedProposalIds: new Set<string>(),
    lastRenameResult: null as BatchRenameResult | null,
    toggleProposalSelection: vi.fn(),
    selectProposals: vi.fn(),
    selectAllReady: vi.fn(),
    deselectAll: vi.fn(),
    applyRenames: vi.fn(),
    clearPreview: vi.fn(),
    aiSuggestions: new Map<string, AiSuggestion>(),
    reorganizationMode: "rename-only" as const,
    setWorkflowStep: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock store to defaults
    mockStore.preview = null;
    mockStore.previewStatus = "idle";
    mockStore.previewError = null;
    mockStore.selectedProposalIds = new Set<string>();
    mockStore.lastRenameResult = null;
    mockStore.aiSuggestions = new Map();
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
      mockStore.preview = createMockPreview();
      mockStore.previewStatus = "ready";
    });

    it("renders preview panel with table and action bar", () => {
      mockUseAppStore.mockReturnValue(mockStore as unknown as ReturnType<typeof useAppStore>);

      render(<PreviewPanel />);

      expect(screen.getByTestId("preview-panel")).toBeInTheDocument();
      expect(screen.getByTestId("action-bar")).toBeInTheDocument();
    });

    it("renders toolbar for filtering and sorting", () => {
      mockUseAppStore.mockReturnValue(mockStore as unknown as ReturnType<typeof useAppStore>);

      render(<PreviewPanel />);

      // Toolbar should be visible
      expect(screen.getByTestId("preview-toolbar")).toBeInTheDocument();
    });
  });

  describe("result display", () => {
    it("shows result and hides action bar after successful rename", () => {
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

    it("calls clearPreview and setWorkflowStep when dismissing result", async () => {
      const user = userEvent.setup();
      mockStore.preview = createMockPreview();
      mockStore.previewStatus = "ready";
      mockStore.lastRenameResult = createMockRenameResult();
      mockUseAppStore.mockReturnValue(mockStore as unknown as ReturnType<typeof useAppStore>);

      render(<PreviewPanel />);

      const dismissButton = screen.getByRole("button", { name: /dismiss/i });
      await user.click(dismissButton);

      expect(mockStore.clearPreview).toHaveBeenCalled();
      expect(mockStore.setWorkflowStep).toHaveBeenCalledWith("select");
    });
  });

  describe("progress display", () => {
    it("shows progress card during rename operation", () => {
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
