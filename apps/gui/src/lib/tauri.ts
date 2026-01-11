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
}

// =============================================================================
// Config Types (Story 6.3)
// =============================================================================

/** Output format options */
export type OutputFormat = "table" | "json" | "plain";

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
}

/** Complete application configuration */
export interface AppConfig {
  /** Config schema version */
  version: 1;
  /** Saved templates */
  templates: Template[];
  /** User preferences */
  preferences: Preferences;
  /** Recently accessed folders */
  recentFolders: string[];
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
}

/** Options for generating a preview */
export interface GeneratePreviewOptions {
  /** Custom date format (default: YYYY-MM-DD) */
  dateFormat?: string;
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
