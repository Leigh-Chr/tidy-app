/**
 * Main Zustand store for tidy-app GUI
 *
 * Architecture requirements:
 * - Single store pattern (NO multiple stores)
 * - Status enum, NOT boolean flags
 * - Actions return Result<T> types
 */

import { useMemo } from "react";
import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { invoke } from "@tauri-apps/api/core";
import { handleBackgroundError } from "@/lib/background-errors";
import type {
  AiSuggestion,
  AppConfig,
  BatchAnalysisResult,
  BatchRenameResult,
  ErrorResponse,
  FileInfo,
  FolderStructure,
  HealthStatus,
  LlmProvider,
  OllamaConfig,
  OllamaModel,
  OpenAiConfig,
  OpenAiModel,
  OrganizeOptions,
  Preferences,
  ReorganizationMode,
  RenamePreview,
  RenameProposal,
  ScanResult,
  Template,
  VersionInfo,
} from "@/lib/tauri";
import {
  analyzeFilesWithLlm,
  checkOllamaHealth,
  checkOpenAiHealth,
  listOllamaModels,
  listOpenAiModels,
  parseError,
  recordOperation,
  undoOperation as undoOperationTauri,
} from "@/lib/tauri";
import type { UndoResult } from "@/lib/tauri";
import type { AnalysisProgress } from "@/lib/tauri";

// =============================================================================
// Types
// =============================================================================

export type AppStatus = "idle" | "loading" | "success" | "error";
export type ScanStatus = "idle" | "scanning" | "success" | "error";
export type ConfigStatus = "idle" | "loading" | "saving" | "success" | "error";
export type PreviewStatus = "idle" | "generating" | "ready" | "applying" | "error";
export type LlmStatus = "idle" | "checking" | "available" | "unavailable";
export type AiAnalysisStatus = "idle" | "analyzing" | "done" | "error";

/** Workflow step for the 3-step wizard UI */
export type WorkflowStep = "select" | "configure" | "preview";

/**
 * Check if a template pattern uses AI-related placeholders.
 * Returns true if the template contains {name} or {ai}, meaning AI analysis would be useful.
 *
 * - {name}: Uses AI suggestion if available, otherwise original filename (recommended)
 * - {original}: Always uses original filename (ignores AI)
 * - {ai}: Only uses AI suggestion (empty if not available)
 */
const AI_PLACEHOLDERS = ["name", "ai"];
export function templateNeedsAi(templatePattern: string): boolean {
  const placeholderRegex = /\{([^}]+)\}/g;
  let match;
  while ((match = placeholderRegex.exec(templatePattern)) !== null) {
    const placeholderName = match[1].toLowerCase();
    if (AI_PLACEHOLDERS.includes(placeholderName)) {
      return true;
    }
  }
  return false;
}

// Re-export types for consumers that import from the store
export type { VersionInfo, AppConfig, Template, FolderStructure, Preferences, RenamePreview, RenameProposal, BatchRenameResult, OllamaConfig, OllamaModel, OpenAiConfig, OpenAiModel, HealthStatus, LlmProvider, AiSuggestion, BatchAnalysisResult, ReorganizationMode, OrganizeOptions, AnalysisProgress, ErrorResponse, UndoResult };
export type { CaseStyle, ErrorCategory } from "@/lib/tauri";
export { parseError, formatErrorForDisplay, isErrorResponse } from "@/lib/tauri";
// WorkflowStep is already exported from the type definition above

export type Result<T, E = Error> =
  | { ok: true; data: T }
  | { ok: false; error: E };

/** Scan options for folder scanning (Story 6.5) */
export interface ScanOptionsState {
  /** Scan subdirectories recursively */
  recursive: boolean;
  /** Filter by file categories (empty = all) */
  fileTypes: string[];
}

export interface AppState {
  // App State
  status: AppStatus;
  error: string | null;
  versionInfo: VersionInfo | null;

  // Workflow State (Step-based wizard UI)
  workflowStep: WorkflowStep;

  // Folder/Scan State (Story 6.2)
  selectedFolder: string | null;
  scanStatus: ScanStatus;
  scanResult: ScanResult | null;
  scanError: string | null;

  // Scan Options (Story 6.5)
  scanOptions: ScanOptionsState;

  // Config State (Story 6.3)
  config: AppConfig | null;
  configStatus: ConfigStatus;
  configError: string | null;

  // Preview State (Story 6.4)
  preview: RenamePreview | null;
  previewStatus: PreviewStatus;
  previewError: string | null;
  selectedProposalIds: Set<string>;
  lastRenameResult: BatchRenameResult | null;

  // Folder Structure State
  selectedFolderStructureId: string | null;

  // Reorganization State
  reorganizationMode: ReorganizationMode;
  organizeOptions: OrganizeOptions | null;

  // LLM State
  llmStatus: LlmStatus;
  llmModels: OllamaModel[];
  openaiModels: OpenAiModel[];
  llmError: string | null;

  // AI Analysis State
  aiAnalysisStatus: AiAnalysisStatus;
  aiAnalysisProgress: AnalysisProgress | null;
  aiSuggestions: Map<string, AiSuggestion>;
  aiAnalysisError: string | null;
  lastAnalysisResult: BatchAnalysisResult | null;

  // Actions
  setStatus: (status: AppStatus) => void;
  setError: (error: string | null) => void;
  loadVersion: () => Promise<Result<VersionInfo>>;
  selectFolder: (path: string) => Promise<Result<ScanResult>>;
  clearFolder: () => void;
  reset: () => void;

  // Workflow Actions
  setWorkflowStep: (step: WorkflowStep) => void;
  goToNextStep: () => void;
  goToPreviousStep: () => void;

  // Scan Options Actions (Story 6.5)
  setScanOptions: (options: Partial<ScanOptionsState>) => void;
  getFilteredFiles: () => FileInfo[];

  // Config Actions (Story 6.3)
  loadConfig: () => Promise<Result<AppConfig>>;
  saveConfig: (config: AppConfig) => Promise<Result<void>>;
  updateTemplate: (templateId: string, updates: Partial<Template>) => Promise<Result<void>>;
  addTemplate: (template: Omit<Template, "id" | "createdAt" | "updatedAt">) => Promise<Result<Template>>;
  deleteTemplate: (templateId: string) => Promise<Result<void>>;
  setDefaultTemplate: (templateId: string) => Promise<Result<void>>;
  updatePreferences: (updates: Partial<Preferences>) => Promise<Result<void>>;
  resetConfig: () => Promise<Result<AppConfig>>;

  // Preview Actions (Story 6.4)
  generatePreview: (files: FileInfo[], templatePattern: string) => Promise<Result<RenamePreview>>;
  toggleProposalSelection: (proposalId: string) => void;
  selectProposals: (proposalIds: string[], addToSelection?: boolean) => void;
  selectAllReady: () => void;
  deselectAll: () => void;
  applyRenames: (proposalIds?: string[]) => Promise<Result<BatchRenameResult>>;
  clearPreview: () => void;

  // Undo Actions (UX-P0-004)
  undoLastOperation: () => Promise<Result<UndoResult>>;

  // Folder Structure Actions
  setSelectedFolderStructure: (structureId: string | null) => void;
  addFolderStructure: (structure: Omit<FolderStructure, "id" | "createdAt" | "updatedAt">) => Promise<Result<FolderStructure>>;
  updateFolderStructure: (structureId: string, updates: Partial<FolderStructure>) => Promise<Result<void>>;
  deleteFolderStructure: (structureId: string) => Promise<Result<void>>;
  getSelectedFolderStructure: () => FolderStructure | null;

  // Reorganization Actions
  setReorganizationMode: (mode: ReorganizationMode) => void;
  setOrganizeOptions: (options: OrganizeOptions | null) => void;

  // LLM Actions
  checkLlmHealth: () => Promise<Result<HealthStatus>>;
  loadLlmModels: () => Promise<Result<OllamaModel[]>>;
  loadOpenAiModels: () => Promise<Result<OpenAiModel[]>>;
  updateOllamaConfig: (updates: Partial<OllamaConfig>) => Promise<Result<void>>;

  // AI Analysis Actions
  analyzeFilesWithAi: (files: FileInfo[]) => Promise<Result<BatchAnalysisResult>>;
  clearAiSuggestions: () => void;
  setAiAnalysisProgress: (progress: AnalysisProgress | null) => void;
}

// =============================================================================
// Store
// =============================================================================

const initialState = {
  status: "idle" as AppStatus,
  error: null as string | null,
  versionInfo: null as VersionInfo | null,
  // Workflow state
  workflowStep: "select" as WorkflowStep,
  // Folder/Scan state
  selectedFolder: null as string | null,
  scanStatus: "idle" as ScanStatus,
  scanResult: null as ScanResult | null,
  scanError: null as string | null,
  // Scan Options (Story 6.5)
  scanOptions: {
    recursive: false,
    fileTypes: [] as string[],
  } as ScanOptionsState,
  // Config State (Story 6.3)
  config: null as AppConfig | null,
  configStatus: "idle" as ConfigStatus,
  configError: null as string | null,
  // Preview State (Story 6.4)
  preview: null as RenamePreview | null,
  previewStatus: "idle" as PreviewStatus,
  previewError: null as string | null,
  selectedProposalIds: new Set<string>(),
  lastRenameResult: null as BatchRenameResult | null,
  // Folder Structure State
  selectedFolderStructureId: null as string | null,
  // Reorganization State
  reorganizationMode: "rename-only" as ReorganizationMode,
  organizeOptions: null as OrganizeOptions | null,
  // LLM State
  llmStatus: "idle" as LlmStatus,
  llmModels: [] as OllamaModel[],
  openaiModels: [] as OpenAiModel[],
  llmError: null as string | null,
  // AI Analysis State
  aiAnalysisStatus: "idle" as AiAnalysisStatus,
  aiAnalysisProgress: null as AnalysisProgress | null,
  aiSuggestions: new Map<string, AiSuggestion>(),
  aiAnalysisError: null as string | null,
  lastAnalysisResult: null as BatchAnalysisResult | null,
};

export const useAppStore = create<AppState>((set) => ({
  ...initialState,

  setStatus: (status) => set({ status }),
  setError: (error) => set({ error }),

  loadVersion: async (): Promise<Result<VersionInfo>> => {
    set({ status: "loading", error: null });
    try {
      const info = await invoke<VersionInfo>("get_version");
      set({ versionInfo: info, status: "success" });
      return { ok: true, data: info };
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      set({ error: errorMessage, status: "error" });
      return { ok: false, error: e instanceof Error ? e : new Error(errorMessage) };
    }
  },

  selectFolder: async (path: string): Promise<Result<ScanResult>> => {
    const { scanOptions } = useAppStore.getState();
    set({
      selectedFolder: path,
      scanStatus: "scanning",
      scanError: null,
      // Reset preview state so it regenerates for the new folder
      preview: null,
      previewStatus: "idle",
      previewError: null,
      selectedProposalIds: new Set<string>(),
      lastRenameResult: null,
      // Clear AI suggestions from previous folder (ARCH-001)
      aiAnalysisStatus: "idle",
      aiAnalysisProgress: null,
      aiSuggestions: new Map<string, AiSuggestion>(),
      aiAnalysisError: null,
      lastAnalysisResult: null,
    });

    try {
      const result = await invoke<ScanResult>("scan_folder", {
        path,
        options: { recursive: scanOptions.recursive },
      });
      set({
        scanResult: result,
        scanStatus: "success",
        scanError: null,
        // Auto-advance to configure step on successful scan
        workflowStep: result.totalCount > 0 ? "configure" : "select",
      });
      return { ok: true, data: result };
    } catch (e) {
      // Use structured error parsing to get message and suggestion
      const parsedError = parseError(e);
      const errorMessage = parsedError.suggestion
        ? `${parsedError.message}\n${parsedError.suggestion}`
        : parsedError.message;
      set({
        scanResult: null,
        scanStatus: "error",
        scanError: errorMessage,
      });
      return { ok: false, error: new Error(parsedError.message) };
    }
  },

  clearFolder: () =>
    set({
      selectedFolder: null,
      scanStatus: "idle",
      scanResult: null,
      scanError: null,
      workflowStep: "select",
      // Clear all related state (ARCH-001)
      preview: null,
      previewStatus: "idle",
      previewError: null,
      selectedProposalIds: new Set<string>(),
      lastRenameResult: null,
      aiAnalysisStatus: "idle",
      aiAnalysisProgress: null,
      aiSuggestions: new Map<string, AiSuggestion>(),
      aiAnalysisError: null,
      lastAnalysisResult: null,
      selectedFolderStructureId: null,
      organizeOptions: null,
    }),

  reset: () => set(initialState),

  // ==========================================================================
  // Workflow Actions
  // ==========================================================================

  setWorkflowStep: (step: WorkflowStep) => {
    set({ workflowStep: step });
  },

  goToNextStep: () => {
    const { workflowStep } = useAppStore.getState();
    const steps: WorkflowStep[] = ["select", "configure", "preview"];
    const currentIndex = steps.indexOf(workflowStep);
    if (currentIndex < steps.length - 1) {
      set({ workflowStep: steps[currentIndex + 1] });
    }
  },

  goToPreviousStep: () => {
    const { workflowStep } = useAppStore.getState();
    const steps: WorkflowStep[] = ["select", "configure", "preview"];
    const currentIndex = steps.indexOf(workflowStep);
    if (currentIndex > 0) {
      set({ workflowStep: steps[currentIndex - 1] });
    }
  },

  // ==========================================================================
  // Scan Options Actions (Story 6.5)
  // ==========================================================================

  setScanOptions: (options: Partial<ScanOptionsState>) => {
    // Get config reference before state update to avoid race condition
    const { config } = useAppStore.getState();
    const shouldPersist = options.recursive !== undefined && config !== null;

    set((state) => ({
      scanOptions: {
        ...state.scanOptions,
        ...options,
      },
    }));

    // Persist recursive option to config (Story 6.5 - AC1)
    // Note: We checked config before the set() to avoid race conditions
    if (shouldPersist) {
      // Use Promise.resolve to make this async and non-blocking
      // Added proper error handling to avoid silent failures (P0-002)
      Promise.resolve().then(async () => {
        const result = await useAppStore.getState().updatePreferences({ recursiveScan: options.recursive });
        if (!result.ok) {
          console.warn('Failed to persist scan options:', result.error.message);
          // Note: We don't show a toast here as this is a background save
          // The UI state is already updated, only persistence failed
        }
      });
    }
  },

  getFilteredFiles: (): FileInfo[] => {
    const { scanResult, scanOptions } = useAppStore.getState();
    if (!scanResult) return [];

    const { fileTypes } = scanOptions;
    if (!fileTypes || fileTypes.length === 0) {
      return scanResult.files;
    }

    return scanResult.files.filter((file) => fileTypes.includes(file.category));
  },

  // ==========================================================================
  // Config Actions (Story 6.3)
  // ==========================================================================

  loadConfig: async (): Promise<Result<AppConfig>> => {
    set({ configStatus: "loading", configError: null });
    try {
      const config = await invoke<AppConfig>("get_config");
      // Sync scan options from persisted preferences (Story 6.5 - AC1)
      set({
        config,
        configStatus: "success",
        configError: null,
        scanOptions: {
          ...useAppStore.getState().scanOptions,
          recursive: config.preferences.recursiveScan,
        },
      });
      return { ok: true, data: config };
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      set({ configError: errorMessage, configStatus: "error" });
      return { ok: false, error: e instanceof Error ? e : new Error(errorMessage) };
    }
  },

  saveConfig: async (config: AppConfig): Promise<Result<void>> => {
    set({ configStatus: "saving", configError: null });
    try {
      await invoke<void>("save_config", { config });
      set({ config, configStatus: "success", configError: null });
      return { ok: true, data: undefined };
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      set({ configError: errorMessage, configStatus: "error" });
      return { ok: false, error: e instanceof Error ? e : new Error(errorMessage) };
    }
  },

  updateTemplate: async (templateId: string, updates: Partial<Template>): Promise<Result<void>> => {
    const currentConfig = useAppStore.getState().config;
    if (!currentConfig) {
      const error = new Error("Config not loaded");
      set({ configError: error.message, configStatus: "error" });
      return { ok: false, error };
    }

    const templateIndex = currentConfig.templates.findIndex((t) => t.id === templateId);
    if (templateIndex === -1) {
      const error = new Error(`Template not found: ${templateId}`);
      set({ configError: error.message, configStatus: "error" });
      return { ok: false, error };
    }

    const updatedTemplates = [...currentConfig.templates];
    updatedTemplates[templateIndex] = {
      ...updatedTemplates[templateIndex],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    const updatedConfig: AppConfig = {
      ...currentConfig,
      templates: updatedTemplates,
    };

    return useAppStore.getState().saveConfig(updatedConfig);
  },

  addTemplate: async (
    template: Omit<Template, "id" | "createdAt" | "updatedAt">
  ): Promise<Result<Template>> => {
    const currentConfig = useAppStore.getState().config;
    if (!currentConfig) {
      const error = new Error("Config not loaded");
      set({ configError: error.message, configStatus: "error" });
      return { ok: false, error };
    }

    const now = new Date().toISOString();
    const newTemplate: Template = {
      ...template,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    };

    const updatedConfig: AppConfig = {
      ...currentConfig,
      templates: [...currentConfig.templates, newTemplate],
    };

    const result = await useAppStore.getState().saveConfig(updatedConfig);
    if (!result.ok) {
      return { ok: false, error: result.error };
    }

    return { ok: true, data: newTemplate };
  },

  deleteTemplate: async (templateId: string): Promise<Result<void>> => {
    const currentConfig = useAppStore.getState().config;
    if (!currentConfig) {
      const error = new Error("Config not loaded");
      set({ configError: error.message, configStatus: "error" });
      return { ok: false, error };
    }

    const updatedTemplates = currentConfig.templates.filter((t) => t.id !== templateId);
    if (updatedTemplates.length === currentConfig.templates.length) {
      const error = new Error(`Template not found: ${templateId}`);
      set({ configError: error.message, configStatus: "error" });
      return { ok: false, error };
    }

    const updatedConfig: AppConfig = {
      ...currentConfig,
      templates: updatedTemplates,
    };

    return useAppStore.getState().saveConfig(updatedConfig);
  },

  setDefaultTemplate: async (templateId: string): Promise<Result<void>> => {
    const currentConfig = useAppStore.getState().config;
    if (!currentConfig) {
      const error = new Error("Config not loaded");
      set({ configError: error.message, configStatus: "error" });
      return { ok: false, error };
    }

    const templateExists = currentConfig.templates.some((t) => t.id === templateId);
    if (!templateExists) {
      const error = new Error(`Template not found: ${templateId}`);
      set({ configError: error.message, configStatus: "error" });
      return { ok: false, error };
    }

    const updatedTemplates = currentConfig.templates.map((t) => ({
      ...t,
      isDefault: t.id === templateId,
      updatedAt: t.id === templateId ? new Date().toISOString() : t.updatedAt,
    }));

    const updatedConfig: AppConfig = {
      ...currentConfig,
      templates: updatedTemplates,
    };

    return useAppStore.getState().saveConfig(updatedConfig);
  },

  updatePreferences: async (updates: Partial<Preferences>): Promise<Result<void>> => {
    const currentConfig = useAppStore.getState().config;
    if (!currentConfig) {
      const error = new Error("Config not loaded");
      set({ configError: error.message, configStatus: "error" });
      return { ok: false, error };
    }

    const updatedConfig: AppConfig = {
      ...currentConfig,
      preferences: {
        ...currentConfig.preferences,
        ...updates,
      },
    };

    return useAppStore.getState().saveConfig(updatedConfig);
  },

  resetConfig: async (): Promise<Result<AppConfig>> => {
    set({ configStatus: "loading", configError: null });
    try {
      const config = await invoke<AppConfig>("reset_config");
      set({ config, configStatus: "success", configError: null });
      return { ok: true, data: config };
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      set({ configError: errorMessage, configStatus: "error" });
      return { ok: false, error: e instanceof Error ? e : new Error(errorMessage) };
    }
  },

  // ==========================================================================
  // Preview Actions (Story 6.4)
  // ==========================================================================

  generatePreview: async (
    files: FileInfo[],
    templatePattern: string
  ): Promise<Result<RenamePreview>> => {
    set({
      previewStatus: "generating",
      previewError: null,
      selectedProposalIds: new Set<string>(),
    });
    try {
      // Get reorganization settings from state
      const {
        config,
        selectedFolderStructureId,
        selectedFolder,
        reorganizationMode,
        organizeOptions,
      } = useAppStore.getState();

      // Build options for the preview generation
      // Support both the new reorganizationMode API and legacy folderPattern API
      let effectiveOrganizeOptions: OrganizeOptions | undefined;

      if (reorganizationMode === "organize") {
        // Use explicitly set organize options if available
        if (organizeOptions) {
          effectiveOrganizeOptions = {
            ...organizeOptions,
            destinationDirectory: organizeOptions.destinationDirectory ?? selectedFolder ?? undefined,
          };
        }
        // Or build from selected folder structure
        else if (selectedFolderStructureId && config) {
          const structure = config.folderStructures.find(
            (s) => s.id === selectedFolderStructureId && s.enabled
          );
          if (structure) {
            effectiveOrganizeOptions = {
              folderPattern: structure.pattern,
              destinationDirectory: selectedFolder ?? undefined,
              preserveContext: false,
              contextDepth: 1,
            };
          }
        }
      }

      const preview = await invoke<RenamePreview>("generate_preview", {
        files,
        templatePattern,
        options: {
          reorganizationMode,
          organizeOptions: effectiveOrganizeOptions,
          // Also include legacy fields for backward compatibility
          folderPattern: effectiveOrganizeOptions?.folderPattern,
          baseDirectory: effectiveOrganizeOptions?.destinationDirectory ?? selectedFolder ?? undefined,
        },
      });

      // Apply AI suggestions to proposals if available and template uses AI placeholders
      // Only process when template contains {name} or {ai}:
      // - {name}: Uses AI suggestion if available, otherwise original (replaced here)
      // - {original}: Always uses original filename (not modified)
      // - {ai}: Only AI suggestion (handled here if backend returned empty)
      const { aiSuggestions } = useAppStore.getState();
      const needsAiProcessing = templateNeedsAi(templatePattern);
      if (aiSuggestions.size > 0 && needsAiProcessing) {
        preview.proposals = preview.proposals.map((proposal) => {
          const suggestion = aiSuggestions.get(proposal.originalPath);
          if (suggestion) {
            // Get the original filename without extension
            const originalNameWithoutExt = proposal.originalName.includes(".")
              ? proposal.originalName.substring(0, proposal.originalName.lastIndexOf("."))
              : proposal.originalName;

            // Get the extension
            const ext = proposal.originalName.includes(".")
              ? proposal.originalName.substring(proposal.originalName.lastIndexOf("."))
              : "";

            // Replace the original filename part in the proposed name with AI suggestion
            // This preserves date prefixes and other template parts
            let newName: string;
            const proposedNameWithoutExt = proposal.proposedName.includes(".")
              ? proposal.proposedName.substring(0, proposal.proposedName.lastIndexOf("."))
              : proposal.proposedName;

            if (proposedNameWithoutExt.includes(originalNameWithoutExt)) {
              // Replace original filename with AI suggestion, keeping template structure
              newName = proposal.proposedName.replace(originalNameWithoutExt, suggestion.suggestedName);
            } else {
              // Fallback: template didn't use {original}, just use AI suggestion + extension
              newName = suggestion.suggestedName + ext;
            }

            // Determine the base directory for the file
            const originalDir = proposal.originalPath.substring(
              0,
              proposal.originalPath.lastIndexOf("/") + 1
            );

            // Check if AI suggested a folder
            let targetDir = originalDir;
            let isFolderMove = proposal.isFolderMove ?? false;
            let destinationFolder = proposal.destinationFolder;

            if (suggestion.suggestedFolder) {
              // Use the base directory (selected folder) as root for AI folder suggestion
              const baseDir = selectedFolder ? selectedFolder + "/" : originalDir;
              targetDir = baseDir + suggestion.suggestedFolder + "/";
              // Normalize path (remove double slashes)
              targetDir = targetDir.replace(/\/+/g, "/");
              isFolderMove = true;
              destinationFolder = suggestion.suggestedFolder;
            }

            return {
              ...proposal,
              proposedName: newName,
              proposedPath: targetDir + newName,
              isFolderMove,
              destinationFolder,
              aiSuggestion: suggestion,
            };
          }
          return proposal;
        });
      }

      // Auto-select all ready files by default (UX improvement)
      const readyIds = preview.proposals
        .filter((p) => p.status === "ready")
        .map((p) => p.id);

      set({
        preview,
        previewStatus: "ready",
        previewError: null,
        selectedProposalIds: new Set(readyIds),
      });
      return { ok: true, data: preview };
    } catch (e) {
      // Use structured error parsing
      const parsedError = parseError(e);
      const errorMessage = parsedError.suggestion
        ? `${parsedError.message}\n${parsedError.suggestion}`
        : parsedError.message;
      set({
        preview: null,
        previewStatus: "error",
        previewError: errorMessage,
      });
      return { ok: false, error: new Error(parsedError.message) };
    }
  },

  toggleProposalSelection: (proposalId: string) => {
    set((state) => {
      const newSelection = new Set(state.selectedProposalIds);
      if (newSelection.has(proposalId)) {
        newSelection.delete(proposalId);
      } else {
        newSelection.add(proposalId);
      }
      return { selectedProposalIds: newSelection };
    });
  },

  selectProposals: (proposalIds: string[], addToSelection: boolean = false) => {
    set((state) => {
      const newSelection = addToSelection
        ? new Set(state.selectedProposalIds)
        : new Set<string>();
      for (const id of proposalIds) {
        newSelection.add(id);
      }
      return { selectedProposalIds: newSelection };
    });
  },

  selectAllReady: () => {
    const preview = useAppStore.getState().preview;
    if (!preview) return;

    const readyIds = preview.proposals
      .filter((p) => p.status === "ready")
      .map((p) => p.id);

    set({ selectedProposalIds: new Set(readyIds) });
  },

  deselectAll: () => {
    set({ selectedProposalIds: new Set<string>() });
  },

  applyRenames: async (proposalIds?: string[]): Promise<Result<BatchRenameResult>> => {
    const state = useAppStore.getState();
    const preview = state.preview;

    if (!preview) {
      const error = new Error("No preview available");
      set({ previewError: error.message, previewStatus: "error" });
      return { ok: false, error };
    }

    // Use provided IDs or selected IDs
    const idsToRename = proposalIds ?? Array.from(state.selectedProposalIds);

    if (idsToRename.length === 0) {
      const error = new Error("No files selected for rename");
      set({ previewError: error.message, previewStatus: "error" });
      return { ok: false, error };
    }

    set({ previewStatus: "applying", previewError: null });

    try {
      const result = await invoke<BatchRenameResult>("execute_rename", {
        proposals: preview.proposals,
        options: { proposalIds: idsToRename },
      });

      set({
        previewStatus: "ready",
        previewError: null,
        lastRenameResult: result,
        selectedProposalIds: new Set<string>(),
      });

      // Record operation to history for undo support (Story 9.1)
      // Fire and forget - don't block the UI, but notify on failure (P2-003)
      if (result.summary.succeeded > 0) {
        recordOperation(result).catch((err) => {
          handleBackgroundError(err, {
            operation: "record operation to history",
            severity: "warn",
            showToast: true,
            toastMessage: "Could not save to undo history. Changes were applied but may not be undoable.",
            toastDuration: 5000,
          });
        });
      }

      return { ok: true, data: result };
    } catch (e) {
      // Use structured error parsing
      const parsedError = parseError(e);
      const errorMessage = parsedError.suggestion
        ? `${parsedError.message}\n${parsedError.suggestion}`
        : parsedError.message;
      set({
        previewStatus: "error",
        previewError: errorMessage,
      });
      return { ok: false, error: new Error(parsedError.message) };
    }
  },

  clearPreview: () => {
    set({
      preview: null,
      previewStatus: "idle",
      previewError: null,
      selectedProposalIds: new Set<string>(),
      lastRenameResult: null,
    });
  },

  // ==========================================================================
  // Undo Actions (UX-P0-004)
  // ==========================================================================

  undoLastOperation: async (): Promise<Result<UndoResult>> => {
    const { lastRenameResult, selectedFolder, scanOptions } = useAppStore.getState();

    // Check if there's a last operation to undo
    // The entryId comes from the recorded history entry, but we need to get it
    // For now, we'll use the most recent history entry
    // In a future enhancement, we could store the entry ID in lastRenameResult
    if (!lastRenameResult || lastRenameResult.summary.succeeded === 0) {
      const error = new Error("No operation to undo");
      return { ok: false, error };
    }

    try {
      // Load history to get the most recent entry ID
      const { invoke } = await import("@tauri-apps/api/core");
      const history = await invoke<{ entries: Array<{ id: string; undone: boolean }> }>("load_history");

      // Find the first non-undone entry (most recent)
      const entryToUndo = history.entries.find((e) => !e.undone);
      if (!entryToUndo) {
        const error = new Error("No undoable operation found in history");
        return { ok: false, error };
      }

      // Perform the undo
      const result = await undoOperationTauri(entryToUndo.id);

      if (result.success) {
        // Clear the last rename result since it's been undone
        set({ lastRenameResult: null });

        // Rescan the folder to refresh the file list
        if (selectedFolder) {
          const scanResult = await invoke<ScanResult>("scan_folder", {
            path: selectedFolder,
            options: { recursive: scanOptions.recursive },
          });
          set({
            scanResult,
            scanStatus: "success",
            scanError: null,
            // Clear preview since files have changed
            preview: null,
            previewStatus: "idle",
            previewError: null,
            selectedProposalIds: new Set<string>(),
          });
        }
      }

      return { ok: true, data: result };
    } catch (e) {
      const parsedError = parseError(e);
      return { ok: false, error: new Error(parsedError.message) };
    }
  },

  // ==========================================================================
  // Folder Structure Actions
  // ==========================================================================

  setSelectedFolderStructure: (structureId: string | null) => {
    set({ selectedFolderStructureId: structureId });
  },

  addFolderStructure: async (
    structure: Omit<FolderStructure, "id" | "createdAt" | "updatedAt">
  ): Promise<Result<FolderStructure>> => {
    const currentConfig = useAppStore.getState().config;
    if (!currentConfig) {
      const error = new Error("Config not loaded");
      set({ configError: error.message, configStatus: "error" });
      return { ok: false, error };
    }

    const now = new Date().toISOString();
    const newStructure: FolderStructure = {
      ...structure,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    };

    const updatedConfig: AppConfig = {
      ...currentConfig,
      folderStructures: [...currentConfig.folderStructures, newStructure],
    };

    const result = await useAppStore.getState().saveConfig(updatedConfig);
    if (!result.ok) {
      return { ok: false, error: result.error };
    }

    return { ok: true, data: newStructure };
  },

  updateFolderStructure: async (
    structureId: string,
    updates: Partial<FolderStructure>
  ): Promise<Result<void>> => {
    const currentConfig = useAppStore.getState().config;
    if (!currentConfig) {
      const error = new Error("Config not loaded");
      set({ configError: error.message, configStatus: "error" });
      return { ok: false, error };
    }

    const structureIndex = currentConfig.folderStructures.findIndex(
      (s) => s.id === structureId
    );
    if (structureIndex === -1) {
      const error = new Error(`Folder structure not found: ${structureId}`);
      set({ configError: error.message, configStatus: "error" });
      return { ok: false, error };
    }

    const updatedStructures = [...currentConfig.folderStructures];
    updatedStructures[structureIndex] = {
      ...updatedStructures[structureIndex],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    const updatedConfig: AppConfig = {
      ...currentConfig,
      folderStructures: updatedStructures,
    };

    return useAppStore.getState().saveConfig(updatedConfig);
  },

  deleteFolderStructure: async (structureId: string): Promise<Result<void>> => {
    const currentConfig = useAppStore.getState().config;
    if (!currentConfig) {
      const error = new Error("Config not loaded");
      set({ configError: error.message, configStatus: "error" });
      return { ok: false, error };
    }

    const updatedStructures = currentConfig.folderStructures.filter(
      (s) => s.id !== structureId
    );

    if (updatedStructures.length === currentConfig.folderStructures.length) {
      const error = new Error(`Folder structure not found: ${structureId}`);
      set({ configError: error.message, configStatus: "error" });
      return { ok: false, error };
    }

    // Clear selection if deleting the selected structure
    const { selectedFolderStructureId } = useAppStore.getState();
    if (selectedFolderStructureId === structureId) {
      set({ selectedFolderStructureId: null });
    }

    const updatedConfig: AppConfig = {
      ...currentConfig,
      folderStructures: updatedStructures,
    };

    return useAppStore.getState().saveConfig(updatedConfig);
  },

  getSelectedFolderStructure: (): FolderStructure | null => {
    const { config, selectedFolderStructureId } = useAppStore.getState();
    if (!config || !selectedFolderStructureId) return null;
    return config.folderStructures.find((s) => s.id === selectedFolderStructureId) ?? null;
  },

  // ==========================================================================
  // Reorganization Actions
  // ==========================================================================

  setReorganizationMode: (mode: ReorganizationMode) => {
    set({ reorganizationMode: mode });

    // If switching to rename-only, clear organize options and folder structure selection
    if (mode === "rename-only") {
      set({
        organizeOptions: null,
        selectedFolderStructureId: null,
      });
    }
  },

  setOrganizeOptions: (options: OrganizeOptions | null) => {
    set({ organizeOptions: options });

    // If setting options, ensure we're in organize mode
    if (options) {
      set({ reorganizationMode: "organize" });
    }
  },

  // ==========================================================================
  // LLM Actions
  // ==========================================================================

  checkLlmHealth: async (): Promise<Result<HealthStatus>> => {
    const { config } = useAppStore.getState();
    if (!config) {
      const error = new Error("Config not loaded");
      set({ llmError: error.message, llmStatus: "unavailable" });
      return { ok: false, error };
    }

    set({ llmStatus: "checking", llmError: null });

    try {
      let health: HealthStatus;

      if (config.ollama.provider === "openai") {
        // Check OpenAI health
        health = await checkOpenAiHealth(
          config.ollama.openai.apiKey,
          config.ollama.openai.baseUrl,
          config.ollama.healthCheckTimeout
        );
        set({
          llmStatus: health.available ? "available" : "unavailable",
          llmError: health.available ? null : "OpenAI not configured or unavailable",
        });
      } else {
        // Check Ollama health
        health = await checkOllamaHealth(
          config.ollama.baseUrl,
          config.ollama.healthCheckTimeout
        );
        set({
          llmStatus: health.available ? "available" : "unavailable",
          llmError: health.available ? null : "Ollama is not running",
        });
      }

      return { ok: true, data: health };
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      set({ llmStatus: "unavailable", llmError: errorMessage });
      return { ok: false, error: e instanceof Error ? e : new Error(errorMessage) };
    }
  },

  loadLlmModels: async (): Promise<Result<OllamaModel[]>> => {
    const { config } = useAppStore.getState();
    if (!config) {
      const error = new Error("Config not loaded");
      set({ llmError: error.message });
      return { ok: false, error };
    }

    try {
      const models = await listOllamaModels(
        config.ollama.baseUrl,
        config.ollama.timeout
      );
      set({ llmModels: models, llmError: null });
      return { ok: true, data: models };
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      set({ llmModels: [], llmError: errorMessage });
      return { ok: false, error: e instanceof Error ? e : new Error(errorMessage) };
    }
  },

  loadOpenAiModels: async (): Promise<Result<OpenAiModel[]>> => {
    try {
      const models = await listOpenAiModels();
      set({ openaiModels: models, llmError: null });
      return { ok: true, data: models };
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      set({ openaiModels: [], llmError: errorMessage });
      return { ok: false, error: e instanceof Error ? e : new Error(errorMessage) };
    }
  },

  updateOllamaConfig: async (updates: Partial<OllamaConfig>): Promise<Result<void>> => {
    const currentConfig = useAppStore.getState().config;
    if (!currentConfig) {
      const error = new Error("Config not loaded");
      set({ configError: error.message, configStatus: "error" });
      return { ok: false, error };
    }

    const updatedConfig: AppConfig = {
      ...currentConfig,
      ollama: {
        ...currentConfig.ollama,
        ...updates,
      },
    };

    return useAppStore.getState().saveConfig(updatedConfig);
  },

  // ==========================================================================
  // AI Analysis Actions
  // ==========================================================================

  analyzeFilesWithAi: async (files: FileInfo[]): Promise<Result<BatchAnalysisResult>> => {
    const { config, preview } = useAppStore.getState();
    if (!config) {
      const error = new Error("Config not loaded");
      set({ aiAnalysisError: error.message, aiAnalysisStatus: "error" });
      return { ok: false, error };
    }

    if (!config.ollama.enabled) {
      const error = new Error("AI analysis is disabled");
      set({ aiAnalysisError: error.message, aiAnalysisStatus: "error" });
      return { ok: false, error };
    }

    // Check if current template uses AI placeholders ({name} or {ai})
    // If not, skip AI analysis to save resources but don't show an error
    const defaultTemplate = config.templates?.find((t) => t.isDefault);
    const currentTemplatePattern = preview?.templateUsed ?? defaultTemplate?.pattern;
    if (currentTemplatePattern && !templateNeedsAi(currentTemplatePattern)) {
      // Return an empty result without error - the UI will handle showing appropriate info
      const emptyResult: BatchAnalysisResult = {
        results: [],
        total: 0,
        analyzed: 0,
        failed: 0,
        skipped: files.length,
        llmAvailable: true,
      };
      set({
        aiAnalysisStatus: "idle",
        aiAnalysisError: null,
        lastAnalysisResult: emptyResult,
      });
      // Return success with a marker to indicate why nothing was analyzed
      return { ok: true, data: { ...emptyResult, _templateSkipped: true } };
    }

    set({ aiAnalysisStatus: "analyzing", aiAnalysisProgress: null, aiAnalysisError: null });

    try {
      const { selectedFolder } = useAppStore.getState();
      const filePaths = files.map((f) => f.path);
      const result = await analyzeFilesWithLlm(filePaths, config.ollama, selectedFolder ?? undefined);

      // Build suggestions map from results
      const suggestions = new Map<string, AiSuggestion>();
      for (const r of result.results) {
        if (r.suggestion) {
          suggestions.set(r.filePath, r.suggestion);
        }
      }

      set({
        aiAnalysisStatus: "done",
        aiAnalysisProgress: null,
        aiSuggestions: suggestions,
        aiAnalysisError: null,
        lastAnalysisResult: result,
      });

      // Regenerate preview to apply AI suggestions
      const { preview, scanResult } = useAppStore.getState();
      if (preview && scanResult && suggestions.size > 0) {
        // Regenerate preview with the same template to apply AI suggestions
        useAppStore.getState().generatePreview(scanResult.files, preview.templateUsed);
      }

      return { ok: true, data: result };
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      set({
        aiAnalysisStatus: "error",
        aiAnalysisProgress: null,
        aiAnalysisError: errorMessage,
      });
      return { ok: false, error: e instanceof Error ? e : new Error(errorMessage) };
    }
  },

  clearAiSuggestions: () => {
    set({
      aiAnalysisStatus: "idle",
      aiAnalysisProgress: null,
      aiSuggestions: new Map<string, AiSuggestion>(),
      aiAnalysisError: null,
      lastAnalysisResult: null,
    });

    // Regenerate preview without AI suggestions
    const { preview, scanResult } = useAppStore.getState();
    if (preview && scanResult) {
      useAppStore.getState().generatePreview(scanResult.files, preview.templateUsed);
    }
  },

  setAiAnalysisProgress: (progress: AnalysisProgress | null) => {
    set({ aiAnalysisProgress: progress });
  },
}));

// =============================================================================
// Selector Hooks (using useShallow for better performance)
// =============================================================================
// These hooks prevent unnecessary re-renders by using shallow comparison
// to detect if the selected state slice has actually changed.

/**
 * Select scan-related state (status, result, error, folder)
 * Use this instead of subscribing to the entire store when you only need scan state.
 */
export const useScanState = () =>
  useAppStore(
    useShallow((state) => ({
      scanStatus: state.scanStatus,
      scanResult: state.scanResult,
      scanError: state.scanError,
      selectedFolder: state.selectedFolder,
      scanOptions: state.scanOptions,
    }))
  );

/**
 * Select preview-related state
 * Use this for components that display or manage rename previews.
 */
export const usePreviewState = () =>
  useAppStore(
    useShallow((state) => ({
      preview: state.preview,
      previewStatus: state.previewStatus,
      previewError: state.previewError,
      selectedProposalIds: state.selectedProposalIds,
      lastRenameResult: state.lastRenameResult,
    }))
  );

/**
 * Select config-related state
 * Use this for settings panels and configuration management.
 */
export const useConfigState = () =>
  useAppStore(
    useShallow((state) => ({
      config: state.config,
      configStatus: state.configStatus,
      configError: state.configError,
    }))
  );

/**
 * Select workflow state
 * Use this for step indicators and navigation.
 */
export const useWorkflowState = () =>
  useAppStore(
    useShallow((state) => ({
      workflowStep: state.workflowStep,
    }))
  );

/**
 * Select AI analysis state
 * Use this for AI-related UI components.
 */
export const useAiAnalysisState = () =>
  useAppStore(
    useShallow((state) => ({
      aiAnalysisStatus: state.aiAnalysisStatus,
      aiAnalysisProgress: state.aiAnalysisProgress,
      aiSuggestions: state.aiSuggestions,
      aiAnalysisError: state.aiAnalysisError,
      lastAnalysisResult: state.lastAnalysisResult,
    }))
  );

/**
 * Select LLM/AI provider state
 * Use this for LLM configuration and health status.
 */
export const useLlmState = () =>
  useAppStore(
    useShallow((state) => ({
      llmStatus: state.llmStatus,
      llmModels: state.llmModels,
      openaiModels: state.openaiModels,
      llmError: state.llmError,
    }))
  );

/**
 * Select reorganization state
 * Use this for folder organization settings.
 */
export const useReorganizationState = () =>
  useAppStore(
    useShallow((state) => ({
      reorganizationMode: state.reorganizationMode,
      organizeOptions: state.organizeOptions,
      selectedFolderStructureId: state.selectedFolderStructureId,
    }))
  );

/**
 * Memoized selector for filtered files
 * This is a computed value based on scanResult and scanOptions.
 * Uses useMemo for proper React memoization (P2-001 fix).
 */
export const useFilteredFiles = (): FileInfo[] => {
  const { scanResult, scanOptions } = useAppStore(
    useShallow((state) => ({
      scanResult: state.scanResult,
      scanOptions: state.scanOptions,
    }))
  );

  // Use React's useMemo for proper memoization
  return useMemo(() => {
    if (!scanResult) {
      return [];
    }

    const { fileTypes } = scanOptions;
    if (!fileTypes || fileTypes.length === 0) {
      return scanResult.files;
    }

    return scanResult.files.filter((file) =>
      fileTypes.includes(file.category)
    );
  }, [scanResult, scanOptions]);
};
