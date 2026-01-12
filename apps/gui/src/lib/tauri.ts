/**
 * Tauri command bindings for tidy-app GUI
 *
 * Command names use snake_case per architecture requirements.
 * All commands use invoke<T>() with explicit return types.
 */

import { invoke } from "@tauri-apps/api/core";

// =============================================================================
// Types
// =============================================================================

export interface VersionInfo {
  version: string;
  core_version: string;
}

/** File category based on extension */
export type FileCategory =
  | "image"
  | "document"
  | "video"
  | "audio"
  | "archive"
  | "code"
  | "data"
  | "other";

/** Metadata capability level */
export type MetadataCapability = "none" | "basic" | "extended" | "full";

/** Information about a scanned file */
export interface FileInfo {
  /** Full absolute path to the file */
  path: string;
  /** Filename without extension */
  name: string;
  /** File extension (without dot) */
  extension: string;
  /** Full filename with extension */
  fullName: string;
  /** File size in bytes */
  size: number;
  /** File creation timestamp (ISO string) */
  createdAt: string;
  /** File modification timestamp (ISO string) */
  modifiedAt: string;
  /** Path relative to scan root */
  relativePath: string;
  /** File category based on extension */
  category: FileCategory;
  /** Whether metadata extraction is supported */
  metadataSupported: boolean;
  /** Level of metadata capability */
  metadataCapability: MetadataCapability;
}

/** Options for folder scanning */
export interface ScanOptions {
  /** Scan subdirectories recursively (default: false) */
  recursive?: boolean;
  /** Filter by file extensions (without dot, e.g., ["jpg", "png"]) */
  extensions?: string[];
}

/** Result of a folder scan */
export interface ScanResult {
  /** List of scanned files */
  files: FileInfo[];
  /** Total number of files found */
  totalCount: number;
  /** Total size in bytes */
  totalSize: number;
  /** Scan session ID (for tracking/cancellation) */
  sessionId?: string;
  /** Whether the scan was cancelled */
  cancelled?: boolean;
}

// =============================================================================
// Scan Progress Types (M4: Progress and Cancellation)
// =============================================================================

/** Phases of scanning operation */
export type ScanPhase =
  | "starting"
  | "discovering"
  | "processing"
  | "complete"
  | "cancelled";

/** Progress event payload for scan operations */
export interface ScanProgress {
  /** Scan session ID */
  sessionId: string;
  /** Current file being processed */
  currentFile: string;
  /** Number of files discovered so far */
  discovered: number;
  /** Number of files processed (after filtering) */
  processed: number;
  /** Current phase of scanning */
  phase: ScanPhase;
  /** Whether scan is complete */
  complete: boolean;
  /** Error message if any */
  error?: string;
}

// =============================================================================
// Config Types (Story 6.3)
// =============================================================================

/** Output format options */
export type OutputFormat = "table" | "json" | "plain";

/**
 * Case normalization style for filenames.
 *
 * Controls how filenames are normalized for consistency.
 * Default: 'kebab-case' (modern, URL-friendly, widely compatible)
 */
export type CaseStyle =
  | "none"        // No transformation - keep original casing
  | "lowercase"   // all lowercase
  | "uppercase"   // ALL UPPERCASE
  | "capitalize"  // First letter uppercase
  | "title-case"  // Each Word Capitalized
  | "kebab-case"  // words-separated-by-hyphens (RECOMMENDED)
  | "snake_case"  // words_separated_by_underscores
  | "camelCase"   // wordsJoinedWithCamelCase
  | "PascalCase"; // WordsJoinedWithPascalCase

/** Template for renaming files */
export interface Template {
  /** Unique identifier (UUID) */
  id: string;
  /** Template name (1-100 chars) */
  name: string;
  /** Naming pattern (1-500 chars) */
  pattern: string;
  /** Optional file type filters */
  fileTypes?: string[];
  /** Whether this is the default template */
  isDefault: boolean;
  /** Creation timestamp (ISO datetime) */
  createdAt: string;
  /** Last update timestamp (ISO datetime) */
  updatedAt: string;
}

/** User preferences */
export interface Preferences {
  /** Default output format (table/json/plain) */
  defaultOutputFormat: OutputFormat;
  /** Whether to use color output */
  colorOutput: boolean;
  /** Whether to confirm before applying renames */
  confirmBeforeApply: boolean;
  /** Whether to scan subdirectories */
  recursiveScan: boolean;
  /** Case normalization style for filenames (default: kebab-case) */
  caseNormalization: CaseStyle;
}

// =============================================================================
// Ollama/LLM Types
// =============================================================================

/** LLM provider type */
export type LlmProvider = "ollama" | "openai";

/** File type preset for LLM analysis */
export type FileTypePreset = "images" | "documents" | "text" | "all" | "custom";

/** Offline mode behavior */
export type OfflineMode = "auto" | "enabled" | "disabled";

/** Model selection for Ollama */
export interface OllamaModelsConfig {
  /** Model for text generation/inference */
  inference?: string;
  /** Vision-capable model for image analysis */
  vision?: string;
}

/** File type configuration for LLM analysis */
export interface LlmFileTypes {
  /** Preset category */
  preset: FileTypePreset;
  /** Explicit extensions to include */
  includedExtensions: string[];
  /** Extensions to exclude */
  excludedExtensions: string[];
  /** Skip files with rich metadata */
  skipWithMetadata: boolean;
}

/** OpenAI configuration */
export interface OpenAiConfig {
  /** API key (empty if not configured) */
  apiKey: string;
  /** API base URL (for Azure OpenAI or proxies) */
  baseUrl: string;
  /** Model to use for text analysis */
  model: string;
  /** Model to use for vision analysis */
  visionModel: string;
}

/** Complete Ollama/LLM configuration */
export interface OllamaConfig {
  /** Whether LLM integration is enabled */
  enabled: boolean;
  /** Which LLM provider to use */
  provider: LlmProvider;
  /** Ollama API base URL */
  baseUrl: string;
  /** Request timeout in milliseconds */
  timeout: number;
  /** Preferred models (for Ollama) */
  models: OllamaModelsConfig;
  /** File type configuration */
  fileTypes: LlmFileTypes;
  /** Enable vision model analysis */
  visionEnabled: boolean;
  /** Skip images with EXIF metadata */
  skipImagesWithExif: boolean;
  /** Max image size for vision analysis */
  maxImageSize: number;
  /** Offline mode behavior */
  offlineMode: OfflineMode;
  /** Health check timeout */
  healthCheckTimeout: number;
  /** OpenAI configuration (used when provider is 'openai') */
  openai: OpenAiConfig;
}

/** Health status for LLM connection */
export interface HealthStatus {
  /** Whether provider is reachable */
  available: boolean;
  /** Number of available models */
  modelCount?: number;
  /** Timestamp of health check */
  checkedAt: string;
}

/** Model information from Ollama */
export interface OllamaModel {
  /** Model name with tag */
  name: string;
  /** Model size in bytes */
  size: number;
  /** Model family */
  family?: string;
}

/** Model information from OpenAI */
export interface OpenAiModel {
  /** Model ID (e.g., 'gpt-4o', 'gpt-4o-mini') */
  id: string;
  /** Display name */
  name: string;
  /** Whether this model supports vision */
  supportsVision: boolean;
}

// =============================================================================
// Folder Structure Types
// =============================================================================

/** A folder structure definition for organizing files into directories */
export interface FolderStructure {
  /** Unique identifier (UUID) */
  id: string;
  /** Human-readable name */
  name: string;
  /** Folder pattern using placeholders (e.g., "{year}/{month}") */
  pattern: string;
  /** Optional description */
  description?: string;
  /** Whether this structure is active */
  enabled: boolean;
  /** Priority for ordering (lower = higher priority) */
  priority: number;
  /** Creation timestamp (ISO datetime) */
  createdAt: string;
  /** Last update timestamp (ISO datetime) */
  updatedAt: string;
}

/** Complete application configuration */
export interface AppConfig {
  /** Config schema version */
  version: 1;
  /** Saved templates */
  templates: Template[];
  /** Folder structures for file organization */
  folderStructures: FolderStructure[];
  /** User preferences */
  preferences: Preferences;
  /** Recently accessed folders */
  recentFolders: string[];
  /** Ollama/LLM configuration */
  ollama: OllamaConfig;
}

// =============================================================================
// Commands
// =============================================================================

/**
 * Get version information for the application
 */
export async function getVersion(): Promise<VersionInfo> {
  return invoke<VersionInfo>("get_version");
}

/**
 * Scan a folder and return information about all files within it
 *
 * @param path - Path to the folder to scan
 * @param options - Optional scan options (recursive, extensions filter)
 * @returns Promise resolving to scan result with files array
 *
 * @example
 * ```typescript
 * const result = await scanFolder('/path/to/folder', { recursive: true });
 * console.log(`Found ${result.totalCount} files`);
 * ```
 */
export async function scanFolder(
  path: string,
  options?: ScanOptions
): Promise<ScanResult> {
  return invoke<ScanResult>("scan_folder", { path, options });
}

/**
 * Scan a folder with progress reporting and cancellation support
 *
 * This function emits "scan-progress" events during the scan.
 * Listen for these events to display progress to the user.
 *
 * @param path - Absolute path to folder to scan
 * @param options - Optional scan configuration
 * @returns Promise resolving to scan results with sessionId
 *
 * @example
 * ```typescript
 * import { listen } from '@tauri-apps/api/event';
 *
 * // Listen for progress events
 * const unlisten = await listen<ScanProgress>('scan-progress', (event) => {
 *   console.log(`Progress: ${event.payload.discovered} files discovered`);
 * });
 *
 * // Start scan
 * const result = await scanFolderWithProgress('/path/to/folder');
 *
 * // Stop listening when done
 * unlisten();
 * ```
 */
export async function scanFolderWithProgress(
  path: string,
  options?: ScanOptions
): Promise<ScanResult> {
  return invoke<ScanResult>("scan_folder_with_progress", { path, options });
}

/**
 * Cancel an active scan session
 *
 * @param sessionId - The session ID returned from scanFolderWithProgress
 * @returns Promise resolving to true if cancellation was successful
 *
 * @example
 * ```typescript
 * // Start a scan
 * const scanPromise = scanFolderWithProgress('/path/to/folder');
 *
 * // Cancel after 5 seconds
 * setTimeout(async () => {
 *   const cancelled = await cancelScan(sessionId);
 *   if (cancelled) console.log('Scan cancelled');
 * }, 5000);
 * ```
 */
export async function cancelScan(sessionId: string): Promise<boolean> {
  return invoke<boolean>("cancel_scan", { sessionId });
}

/**
 * Get the number of active scan sessions
 *
 * @returns Promise resolving to the count of active scans
 */
export async function getActiveScans(): Promise<number> {
  return invoke<number>("get_active_scans");
}

// =============================================================================
// Dialog Functions (Story 6.2)
// =============================================================================

/**
 * Open native folder picker dialog
 *
 * Uses @tauri-apps/plugin-dialog for native OS file picker.
 *
 * @returns Promise resolving to selected folder path, or null if cancelled
 *
 * @example
 * ```typescript
 * const path = await openFolderDialog();
 * if (path) {
 *   console.log(`Selected: ${path}`);
 * }
 * ```
 */
export async function openFolderDialog(): Promise<string | null> {
  // Import dynamically to avoid issues in test environment
  const { open } = await import("@tauri-apps/plugin-dialog");
  const selected = await open({
    directory: true,
    multiple: false,
    title: "Select folder to organize",
  });
  return selected as string | null;
}

// =============================================================================
// Config Functions (Story 6.3)
// =============================================================================

/**
 * Load application configuration from disk
 *
 * Returns default configuration if file doesn't exist or is invalid.
 *
 * @returns Promise resolving to application config
 *
 * @example
 * ```typescript
 * const config = await getConfig();
 * console.log(`Loaded ${config.templates.length} templates`);
 * ```
 */
export async function getConfig(): Promise<AppConfig> {
  return invoke<AppConfig>("get_config");
}

/**
 * Save application configuration to disk
 *
 * Creates config directory if it doesn't exist.
 *
 * @param config - Configuration to save
 * @returns Promise resolving when save completes
 *
 * @example
 * ```typescript
 * await saveConfig({
 *   ...config,
 *   preferences: { ...config.preferences, recursiveScan: true }
 * });
 * ```
 */
export async function saveConfig(config: AppConfig): Promise<void> {
  return invoke<void>("save_config", { config });
}

/**
 * Reset configuration to defaults
 *
 * Deletes existing config file and returns default configuration.
 *
 * @returns Promise resolving to default configuration
 *
 * @example
 * ```typescript
 * const defaultConfig = await resetConfig();
 * console.log('Config reset to defaults');
 * ```
 */
export async function resetConfig(): Promise<AppConfig> {
  return invoke<AppConfig>("reset_config");
}

// =============================================================================
// Reorganization Types
// =============================================================================

/**
 * Reorganization mode determines how files are handled during rename operations.
 *
 * - 'rename-only': Files stay in their current locations, only names change (safest)
 * - 'organize': Files are moved to new locations based on folder patterns and destination
 */
export type ReorganizationMode = "rename-only" | "organize";

/**
 * Options for the "organize" mode.
 * Only used when reorganizationMode is 'organize'.
 */
export interface OrganizeOptions {
  /** Base destination directory for organized files. If not provided, uses the scanned folder as base. */
  destinationDirectory?: string;
  /** Folder pattern for organizing files (e.g., "{year}/{month}"). Applied relative to destinationDirectory. */
  folderPattern: string;
  /**
   * Whether to preserve the relative context from subfolders.
   * When true: /Photos/Vacation/img.jpg → /destination/Vacation/{year}/{month}/img.jpg
   * When false: /Photos/Vacation/img.jpg → /destination/{year}/{month}/img.jpg
   * Default: false
   */
  preserveContext?: boolean;
  /**
   * How many levels of parent folders to preserve when preserveContext is true.
   * 0 = preserve none (same as preserveContext: false)
   * 1 = preserve immediate parent folder
   * -1 = preserve all parent folders (from scan root)
   * Default: 1
   */
  contextDepth?: number;
}

/**
 * Action type for a file in the preview.
 * Used to clearly communicate what will happen to each file.
 */
export type FileActionType =
  | "rename"     // File will only be renamed (stays in same folder)
  | "move"       // File will be moved to a different folder (may also be renamed)
  | "no-change"  // File will not change (name and location stay the same)
  | "conflict"   // File has a conflict and cannot be processed
  | "error";     // File has an error (invalid name, missing data, etc.)

/**
 * Conflict information for a file.
 */
export interface FileConflict {
  /** The type of conflict */
  type: "duplicate-name" | "file-exists" | "cross-conflict";
  /** Human-readable description */
  message: string;
  /** ID of the conflicting file (for duplicate-name conflicts) */
  conflictingFileId?: string;
  /** Path of the existing file (for file-exists conflicts) */
  existingFilePath?: string;
}

/**
 * Summary of preview actions by type.
 */
export interface PreviewActionSummary {
  /** Number of files that will only be renamed */
  renameCount: number;
  /** Number of files that will be moved */
  moveCount: number;
  /** Number of files with no changes */
  noChangeCount: number;
  /** Number of files with conflicts */
  conflictCount: number;
  /** Number of files with errors */
  errorCount: number;
}

/**
 * Conflict resolution strategy.
 */
export type ConflictResolution =
  | "add-suffix"  // Add a numeric suffix (photo.jpg → photo-2.jpg)
  | "add-source"  // Add source folder name (photo.jpg → photo-from-vacation.jpg)
  | "skip"        // Skip the conflicting file
  | "ask";        // Ask user for each conflict (UI will prompt)

// =============================================================================
// Rename Types (Story 6.4)
// =============================================================================

/** Status of a rename proposal */
export type RenameStatus =
  | "ready"
  | "conflict"
  | "missing-data"
  | "no-change"
  | "invalid-name";

/** Issue found with a rename proposal */
export interface RenameIssue {
  /** Issue code for programmatic handling */
  code: string;
  /** Human-readable message */
  message: string;
  /** Field or placeholder that caused the issue (optional) */
  field?: string;
}

/** A single file rename proposal */
export interface RenameProposal {
  /** Unique identifier for selection tracking */
  id: string;
  /** Full path to original file */
  originalPath: string;
  /** Original filename (with extension) */
  originalName: string;
  /** Proposed new filename (with extension) */
  proposedName: string;
  /** Full path with proposed name */
  proposedPath: string;
  /** Status of this proposal */
  status: RenameStatus;
  /** Issues found with this proposal */
  issues: RenameIssue[];
  /** Metadata source badges (e.g., "EXIF", "PDF", "filename") */
  metadataSources?: string[];
  /** Whether this proposal involves moving to a different folder */
  isFolderMove?: boolean;
  /** The destination folder path (if isFolderMove is true) */
  destinationFolder?: string;
  /** AI-generated suggestion for this file (if LLM analysis was performed) */
  aiSuggestion?: AiSuggestion;
  /** Action type for this file (rename, move, no-change, conflict, error) */
  actionType: FileActionType;
  /** Conflict details (if actionType is 'conflict') */
  conflict?: FileConflict;
}

/** Summary statistics for a rename preview */
export interface PreviewSummary {
  total: number;
  ready: number;
  conflicts: number;
  missingData: number;
  noChange: number;
  invalidName: number;
}

/** Complete rename preview result */
export interface RenamePreview {
  /** All file proposals */
  proposals: RenameProposal[];
  /** Summary statistics */
  summary: PreviewSummary;
  /** When the preview was generated (ISO string) */
  generatedAt: string;
  /** Template pattern used */
  templateUsed: string;
  /** Action summary by type (rename, move, no-change, conflict, error) */
  actionSummary: PreviewActionSummary;
  /** Reorganization mode used for this preview */
  reorganizationMode: ReorganizationMode;
}

/** Options for generating a preview */
export interface GeneratePreviewOptions {
  /** Custom date format (default: YYYY-MM-DD) */
  dateFormat?: string;
  /**
   * @deprecated Use reorganizationMode and organizeOptions instead.
   * Folder structure pattern for organizing files (e.g., "{year}/{month}")
   */
  folderPattern?: string;
  /**
   * @deprecated Use reorganizationMode and organizeOptions instead.
   * Base directory for folder organization (destination root)
   */
  baseDirectory?: string;
  /** Reorganization mode (default: 'rename-only') */
  reorganizationMode?: ReorganizationMode;
  /** Options for organize mode (required when reorganizationMode is 'organize') */
  organizeOptions?: OrganizeOptions;
}

/** Outcome of a single file rename */
export type RenameOutcome = "success" | "failed" | "skipped";

/** Result of renaming a single file */
export interface FileRenameResult {
  proposalId: string;
  originalPath: string;
  originalName: string;
  newPath?: string;
  newName?: string;
  outcome: RenameOutcome;
  error?: string;
}

/** Summary of batch rename results */
export interface BatchRenameSummary {
  total: number;
  succeeded: number;
  failed: number;
  skipped: number;
}

/** Complete result of a batch rename operation */
export interface BatchRenameResult {
  success: boolean;
  results: FileRenameResult[];
  summary: BatchRenameSummary;
  startedAt: string;
  completedAt: string;
  durationMs: number;
}

/** Options for executing renames */
export interface ExecuteRenameOptions {
  /** IDs of proposals to rename (if empty, renames all ready) */
  proposalIds?: string[];
}

// =============================================================================
// Rename Functions (Story 6.4)
// =============================================================================

/**
 * Generate a rename preview for files using a template
 *
 * @param files - Array of file info objects to generate preview for
 * @param templatePattern - Template pattern string (e.g., "{date}_{name}.{ext}")
 * @param options - Optional preview options (date format)
 * @returns Promise resolving to rename preview with proposals and summary
 *
 * @example
 * ```typescript
 * const preview = await generatePreview(files, "{date}_{name}.{ext}");
 * console.log(`${preview.summary.ready} files ready to rename`);
 * ```
 */
export async function generatePreview(
  files: FileInfo[],
  templatePattern: string,
  options?: GeneratePreviewOptions
): Promise<RenamePreview> {
  return invoke<RenamePreview>("generate_preview", {
    files,
    templatePattern,
    options,
  });
}

/**
 * Execute batch rename operation on selected proposals
 *
 * @param proposals - Array of rename proposals to execute
 * @param options - Optional execution options (proposal IDs to filter)
 * @returns Promise resolving to batch rename result with success status
 *
 * @example
 * ```typescript
 * const result = await executeRename(proposals, {
 *   proposalIds: selectedIds
 * });
 * if (result.success) {
 *   console.log(`Renamed ${result.summary.succeeded} files`);
 * }
 * ```
 */
export async function executeRename(
  proposals: RenameProposal[],
  options?: ExecuteRenameOptions
): Promise<BatchRenameResult> {
  return invoke<BatchRenameResult>("execute_rename", {
    proposals,
    options,
  });
}

// =============================================================================
// Export Types (Story 6.5)
// =============================================================================

/** Statistics about scanned files */
export interface ExportStatistics {
  total: number;
  byCategory: Record<string, number>;
  totalSize: number;
}

/** Scan result section of export */
export interface ExportScanResult {
  folder: string;
  files: FileInfo[];
  statistics: ExportStatistics;
  scannedAt: string;
}

/** Preview section of export */
export interface ExportPreview {
  proposals: RenameProposal[];
  summary: PreviewSummary;
  templateUsed: string;
}

/** Complete export data structure (matches CLI --format json) */
export interface ExportData {
  scanResult: ExportScanResult;
  preview?: ExportPreview;
  exportedAt: string;
  version: string;
}

/** Input for export command */
export interface ExportInput {
  folder: string;
  files: FileInfo[];
  preview?: RenamePreview;
}

/** Result of export operation */
export interface ExportResult {
  /** Path where file was saved */
  path: string;
  /** Size of exported file in bytes */
  size: number;
}

// =============================================================================
// Export Functions (Story 6.5)
// =============================================================================

/**
 * Export scan results and preview to a JSON file
 *
 * Opens native file save dialog and writes export data.
 * Matches CLI --format json output structure.
 *
 * @param input - Export input containing folder, files, and optional preview
 * @returns Promise resolving to export result with saved path and file size
 * @throws Error if export is cancelled or write fails
 *
 * @example
 * ```typescript
 * const result = await exportResults({
 *   folder: '/path/to/folder',
 *   files: scanResult.files,
 *   preview: renamePreview
 * });
 * console.log(`Exported to ${result.path}`);
 * ```
 */
export async function exportResults(input: ExportInput): Promise<ExportResult> {
  return invoke<ExportResult>("export_results", { input });
}

// =============================================================================
// LLM Functions
// =============================================================================

/**
 * Check Ollama health status
 *
 * Attempts to connect to Ollama API and verify it's responding.
 *
 * @param baseUrl - Ollama API base URL
 * @param timeoutMs - Request timeout in milliseconds
 * @returns Promise resolving to health status
 *
 * @example
 * ```typescript
 * const health = await checkOllamaHealth('http://localhost:11434', 5000);
 * if (health.available) {
 *   console.log(`Ollama connected with ${health.modelCount} models`);
 * }
 * ```
 */
export async function checkOllamaHealth(
  baseUrl: string,
  timeoutMs: number
): Promise<HealthStatus> {
  return invoke<HealthStatus>("check_ollama_health", { baseUrl, timeoutMs });
}

/**
 * List installed Ollama models
 *
 * Retrieves all locally installed models from Ollama.
 *
 * @param baseUrl - Ollama API base URL
 * @param timeoutMs - Request timeout in milliseconds
 * @returns Promise resolving to array of installed models
 *
 * @example
 * ```typescript
 * const models = await listOllamaModels('http://localhost:11434', 5000);
 * console.log(`Found ${models.length} models`);
 * ```
 */
export async function listOllamaModels(
  baseUrl: string,
  timeoutMs: number
): Promise<OllamaModel[]> {
  return invoke<OllamaModel[]>("list_ollama_models", { baseUrl, timeoutMs });
}

/**
 * Check OpenAI health status
 *
 * Attempts to connect to OpenAI API and verify the API key works.
 *
 * @param apiKey - OpenAI API key
 * @param baseUrl - OpenAI API base URL
 * @param timeoutMs - Request timeout in milliseconds
 * @returns Promise resolving to health status
 *
 * @example
 * ```typescript
 * const health = await checkOpenAiHealth('sk-...', 'https://api.openai.com/v1', 5000);
 * if (health.available) {
 *   console.log('OpenAI connected');
 * }
 * ```
 */
export async function checkOpenAiHealth(
  apiKey: string,
  baseUrl: string,
  timeoutMs: number
): Promise<HealthStatus> {
  return invoke<HealthStatus>("check_openai_health", { apiKey, baseUrl, timeoutMs });
}

/**
 * List available OpenAI models
 *
 * Returns recommended models for use with tidy-app.
 *
 * @returns Promise resolving to array of OpenAI models
 *
 * @example
 * ```typescript
 * const models = await listOpenAiModels();
 * console.log(`Found ${models.length} models`);
 * ```
 */
export async function listOpenAiModels(): Promise<OpenAiModel[]> {
  return invoke<OpenAiModel[]>("list_openai_models");
}

// =============================================================================
// AI Analysis Types
// =============================================================================

/** AI-suggested name for a file */
export interface AiSuggestion {
  /** The suggested filename (without extension) */
  suggestedName: string;
  /** Confidence level (0.0 - 1.0) */
  confidence: number;
  /** Brief reasoning for the suggestion */
  reasoning: string;
  /** Keywords extracted from the content */
  keywords: string[];
  /** Suggested folder path for organization (e.g., "Projects/2024") */
  suggestedFolder?: string;
  /** Confidence for folder suggestion (0.0 - 1.0) */
  folderConfidence?: number;
}

/** Result of analyzing a single file */
export interface FileAnalysisResult {
  /** Original file path */
  filePath: string;
  /** AI suggestion (if successful) */
  suggestion?: AiSuggestion;
  /** Error message (if failed) */
  error?: string;
  /** Whether this file was skipped (e.g., not supported) */
  skipped: boolean;
  /** Source of analysis (ollama, openai, ollama-vision, openai-vision, etc.) */
  source: string;
}

/** Batch analysis result */
export interface BatchAnalysisResult {
  /** Results for each file */
  results: FileAnalysisResult[];
  /** Total files processed */
  total: number;
  /** Files successfully analyzed */
  analyzed: number;
  /** Files that failed */
  failed: number;
  /** Files that were skipped */
  skipped: number;
  /** Whether LLM was available */
  llmAvailable: boolean;
}

/** Analysis progress event payload */
export interface AnalysisProgress {
  /** Current file being processed */
  currentFile: string;
  /** Number of files processed so far */
  processed: number;
  /** Total number of files */
  total: number;
  /** Percentage complete (0-100) */
  percent: number;
  /** Current operation phase: starting, analyzing, complete */
  phase: "starting" | "analyzing" | "complete";
}

// =============================================================================
// AI Analysis Functions
// =============================================================================

/**
 * Analyze files with LLM to get naming suggestions
 *
 * Sends file content to configured LLM (Ollama or OpenAI) for analysis.
 * Supports text files and images (when vision is enabled).
 *
 * @param filePaths - Array of file paths to analyze
 * @param config - Ollama/LLM configuration
 * @returns Promise resolving to batch analysis result
 *
 * @example
 * ```typescript
 * const result = await analyzeFilesWithLlm(
 *   files.map(f => f.path),
 *   config.ollama
 * );
 * console.log(`Analyzed ${result.analyzed} files`);
 * for (const r of result.results) {
 *   if (r.suggestion) {
 *     console.log(`${r.filePath}: ${r.suggestion.suggestedName}`);
 *   }
 * }
 * ```
 */
export async function analyzeFilesWithLlm(
  filePaths: string[],
  config: OllamaConfig,
  basePath?: string
): Promise<BatchAnalysisResult> {
  return invoke<BatchAnalysisResult>("analyze_files_with_llm", {
    filePaths,
    config,
    basePath,
  });
}

// =============================================================================
// Cache Management Types
// =============================================================================

/** Statistics about the analysis cache */
export interface CacheStats {
  /** Total number of entries in cache */
  totalEntries: number;
  /** Number of valid (non-expired) entries */
  validEntries: number;
}

// =============================================================================
// Cache Management Functions
// =============================================================================

/**
 * Clear the AI analysis cache
 *
 * Useful for forcing re-analysis of files after configuration changes.
 *
 * @returns Promise resolving to number of cleared entries
 *
 * @example
 * ```typescript
 * const cleared = await clearAnalysisCache();
 * console.log(`Cleared ${cleared} cached results`);
 * ```
 */
export async function clearAnalysisCache(): Promise<number> {
  return invoke<number>("clear_analysis_cache");
}

/**
 * Get cache statistics
 *
 * Returns information about the AI analysis cache.
 *
 * @returns Promise resolving to cache statistics
 *
 * @example
 * ```typescript
 * const stats = await getCacheStats();
 * console.log(`Cache has ${stats.validEntries} valid entries`);
 * ```
 */
export async function getCacheStats(): Promise<CacheStats> {
  return invoke<CacheStats>("get_cache_stats");
}

// =============================================================================
// History Types (Story 9.1)
// =============================================================================

/** Operation type */
export type OperationType = "rename" | "move";

/** Record of a single file operation in history */
export interface FileHistoryRecord {
  /** Original file path before operation */
  originalPath: string;
  /** New file path after operation (if successful) */
  newPath?: string;
  /** Whether this was a move operation (vs just rename) */
  isMoveOperation: boolean;
  /** Whether the operation was successful */
  success: boolean;
  /** Error message if operation failed */
  error?: string;
}

/** Summary of an operation */
export interface OperationSummary {
  succeeded: number;
  skipped: number;
  failed: number;
  directoriesCreated?: number;
}

/** A single operation history entry */
export interface OperationHistoryEntry {
  /** Unique identifier for this entry */
  id: string;
  /** ISO timestamp when operation was performed */
  timestamp: string;
  /** Type of operation (rename or move) */
  operationType: OperationType;
  /** Total number of files in operation */
  fileCount: number;
  /** Summary of outcomes */
  summary: OperationSummary;
  /** Duration in milliseconds */
  durationMs: number;
  /** Individual file records */
  files: FileHistoryRecord[];
  /** Directories created during operation */
  directoriesCreated?: string[];
  /** Whether this operation has been undone */
  undone: boolean;
}

/** The complete history store */
export interface HistoryStore {
  /** Schema version */
  version: string;
  /** All history entries (newest first) */
  entries: OperationHistoryEntry[];
  /** Last modification timestamp */
  lastModified: string;
}

/** Result of an undo operation */
export interface UndoResult {
  /** Whether all files were restored successfully */
  success: boolean;
  /** ID of the entry that was undone */
  entryId: string;
  /** Number of files successfully restored */
  filesRestored: number;
  /** Number of files that failed to restore */
  filesFailed: number;
  /** Error messages for failed files */
  errors: string[];
}

// =============================================================================
// History Functions (Story 9.1)
// =============================================================================

/**
 * Load operation history from storage
 *
 * @returns Promise resolving to history store with all entries
 *
 * @example
 * ```typescript
 * const history = await loadHistory();
 * console.log(`${history.entries.length} operations in history`);
 * ```
 */
export async function loadHistory(): Promise<HistoryStore> {
  return invoke<HistoryStore>("load_history");
}

/**
 * Record a batch rename operation to history
 *
 * @param result - The batch rename result to record
 * @returns Promise resolving to the created history entry
 *
 * @example
 * ```typescript
 * const renameResult = await executeRename(proposals);
 * if (renameResult.success) {
 *   const entry = await recordOperation(renameResult);
 *   console.log(`Recorded with ID: ${entry.id}`);
 * }
 * ```
 */
export async function recordOperation(
  result: BatchRenameResult
): Promise<OperationHistoryEntry> {
  return invoke<OperationHistoryEntry>("record_operation", { result });
}

/**
 * Get a specific history entry by ID
 *
 * @param entryId - ID of the history entry
 * @returns Promise resolving to the history entry
 *
 * @example
 * ```typescript
 * const entry = await getHistoryEntry('abc-123');
 * console.log(`Operation: ${entry.operationType}`);
 * ```
 */
export async function getHistoryEntry(
  entryId: string
): Promise<OperationHistoryEntry> {
  return invoke<OperationHistoryEntry>("get_history_entry", { entryId });
}

/**
 * Get the number of history entries
 *
 * @returns Promise resolving to the count
 *
 * @example
 * ```typescript
 * const count = await getHistoryCount();
 * console.log(`${count} operations in history`);
 * ```
 */
export async function getHistoryCount(): Promise<number> {
  return invoke<number>("get_history_count");
}

/**
 * Undo an operation by restoring files to original locations
 *
 * @param entryId - ID of the history entry to undo
 * @returns Promise resolving to undo result
 *
 * @example
 * ```typescript
 * const result = await undoOperation('abc-123');
 * if (result.success) {
 *   console.log(`Restored ${result.filesRestored} files`);
 * }
 * ```
 */
export async function undoOperation(entryId: string): Promise<UndoResult> {
  return invoke<UndoResult>("undo_operation", { entryId });
}

/**
 * Check if an operation can be undone
 *
 * @param entryId - ID of the history entry
 * @returns Promise resolving to whether undo is possible
 *
 * @example
 * ```typescript
 * if (await canUndoOperation('abc-123')) {
 *   await undoOperation('abc-123');
 * }
 * ```
 */
export async function canUndoOperation(entryId: string): Promise<boolean> {
  return invoke<boolean>("can_undo_operation", { entryId });
}

/**
 * Clear all history entries
 *
 * @returns Promise resolving when history is cleared
 *
 * @example
 * ```typescript
 * await clearHistory();
 * console.log('History cleared');
 * ```
 */
export async function clearHistory(): Promise<void> {
  return invoke<void>("clear_history");
}

// =============================================================================
// Analysis Progress Listener
// =============================================================================

/**
 * Listen for analysis progress events
 *
 * Returns an unsubscribe function to stop listening.
 *
 * @param callback - Function called with progress updates
 * @returns Promise resolving to unsubscribe function
 *
 * @example
 * ```typescript
 * const unlisten = await onAnalysisProgress((progress) => {
 *   console.log(`${progress.percent}% - ${progress.currentFile}`);
 * });
 * // Later, to stop listening:
 * unlisten();
 * ```
 */
export async function onAnalysisProgress(
  callback: (progress: AnalysisProgress) => void
): Promise<() => void> {
  const { listen } = await import("@tauri-apps/api/event");
  const unlisten = await listen<AnalysisProgress>("analysis-progress", (event) => {
    callback(event.payload);
  });
  return unlisten;
}
