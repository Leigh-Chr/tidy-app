/**
 * Main Zustand store for tidy-app GUI
 *
 * Architecture requirements:
 * - Single store pattern (NO multiple stores)
 * - Status enum, NOT boolean flags
 * - Actions return Result<T> types
 */

import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type {
  AiSuggestion,
  AppConfig,
  BatchAnalysisResult,
  BatchRenameResult,
  FileInfo,
  HealthStatus,
  LlmProvider,
  OllamaConfig,
  OllamaModel,
  OpenAiConfig,
  OpenAiModel,
  Preferences,
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
} from "@/lib/tauri";

// =============================================================================
// Types
// =============================================================================

export type AppStatus = "idle" | "loading" | "success" | "error";
export type ScanStatus = "idle" | "scanning" | "success" | "error";
export type ConfigStatus = "idle" | "loading" | "saving" | "success" | "error";
export type PreviewStatus = "idle" | "generating" | "ready" | "applying" | "error";
export type LlmStatus = "idle" | "checking" | "available" | "unavailable";
export type AiAnalysisStatus = "idle" | "analyzing" | "done" | "error";

// Re-export types for consumers that import from the store
export type { VersionInfo, AppConfig, Template, Preferences, RenamePreview, RenameProposal, BatchRenameResult, OllamaConfig, OllamaModel, OpenAiConfig, OpenAiModel, HealthStatus, LlmProvider, AiSuggestion, BatchAnalysisResult };

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

  // LLM State
  llmStatus: LlmStatus;
  llmModels: OllamaModel[];
  openaiModels: OpenAiModel[];
  llmError: string | null;

  // AI Analysis State
  aiAnalysisStatus: AiAnalysisStatus;
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
  selectAllReady: () => void;
  deselectAll: () => void;
  applyRenames: (proposalIds?: string[]) => Promise<Result<BatchRenameResult>>;
  clearPreview: () => void;

  // LLM Actions
  checkLlmHealth: () => Promise<Result<HealthStatus>>;
  loadLlmModels: () => Promise<Result<OllamaModel[]>>;
  loadOpenAiModels: () => Promise<Result<OpenAiModel[]>>;
  updateOllamaConfig: (updates: Partial<OllamaConfig>) => Promise<Result<void>>;

  // AI Analysis Actions
  analyzeFilesWithAi: (files: FileInfo[]) => Promise<Result<BatchAnalysisResult>>;
  clearAiSuggestions: () => void;
}

// =============================================================================
// Store
// =============================================================================

const initialState = {
  status: "idle" as AppStatus,
  error: null as string | null,
  versionInfo: null as VersionInfo | null,
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
  // LLM State
  llmStatus: "idle" as LlmStatus,
  llmModels: [] as OllamaModel[],
  openaiModels: [] as OpenAiModel[],
  llmError: null as string | null,
  // AI Analysis State
  aiAnalysisStatus: "idle" as AiAnalysisStatus,
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
      });
      return { ok: true, data: result };
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      set({
        scanResult: null,
        scanStatus: "error",
        scanError: errorMessage,
      });
      return { ok: false, error: e instanceof Error ? e : new Error(errorMessage) };
    }
  },

  clearFolder: () =>
    set({
      selectedFolder: null,
      scanStatus: "idle",
      scanResult: null,
      scanError: null,
    }),

  reset: () => set(initialState),

  // ==========================================================================
  // Scan Options Actions (Story 6.5)
  // ==========================================================================

  setScanOptions: (options: Partial<ScanOptionsState>) => {
    set((state) => ({
      scanOptions: {
        ...state.scanOptions,
        ...options,
      },
    }));

    // Persist recursive option to config (Story 6.5 - AC1)
    if (options.recursive !== undefined) {
      const { config } = useAppStore.getState();
      if (config) {
        useAppStore.getState().updatePreferences({ recursiveScan: options.recursive });
      }
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
      const preview = await invoke<RenamePreview>("generate_preview", {
        files,
        templatePattern,
        options: undefined,
      });

      // Apply AI suggestions to proposals if available
      const { aiSuggestions } = useAppStore.getState();
      if (aiSuggestions.size > 0) {
        preview.proposals = preview.proposals.map((proposal) => {
          const suggestion = aiSuggestions.get(proposal.originalPath);
          if (suggestion) {
            // Get the file extension from the original name
            const ext = proposal.originalName.includes(".")
              ? "." + proposal.originalName.split(".").pop()
              : "";
            const newName = suggestion.suggestedName + ext;
            const dir = proposal.originalPath.substring(
              0,
              proposal.originalPath.lastIndexOf("/") + 1
            );
            return {
              ...proposal,
              proposedName: newName,
              proposedPath: dir + newName,
              // Don't add "AI" to metadataSources - it's shown separately via aiSuggestions
            };
          }
          return proposal;
        });
      }

      set({
        preview,
        previewStatus: "ready",
        previewError: null,
      });
      return { ok: true, data: preview };
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      set({
        preview: null,
        previewStatus: "error",
        previewError: errorMessage,
      });
      return { ok: false, error: e instanceof Error ? e : new Error(errorMessage) };
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

      return { ok: true, data: result };
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      set({
        previewStatus: "error",
        previewError: errorMessage,
      });
      return { ok: false, error: e instanceof Error ? e : new Error(errorMessage) };
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
    const { config } = useAppStore.getState();
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

    set({ aiAnalysisStatus: "analyzing", aiAnalysisError: null });

    try {
      const filePaths = files.map((f) => f.path);
      const result = await analyzeFilesWithLlm(filePaths, config.ollama);

      // Build suggestions map from results
      const suggestions = new Map<string, AiSuggestion>();
      for (const r of result.results) {
        if (r.suggestion) {
          suggestions.set(r.filePath, r.suggestion);
        }
      }

      set({
        aiAnalysisStatus: "done",
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
        aiAnalysisError: errorMessage,
      });
      return { ok: false, error: e instanceof Error ? e : new Error(errorMessage) };
    }
  },

  clearAiSuggestions: () => {
    set({
      aiAnalysisStatus: "idle",
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
}));
