/**
 * @fileoverview Scan and apply rules workflow - Story 7.5
 *
 * Provides a unified workflow that combines folder scanning, metadata extraction,
 * and rule-based template application into a single operation.
 */

import type { Result } from '../types/result.js';
import { ok, err } from '../types/result.js';
import type { UnifiedMetadata } from '../types/unified-metadata.js';
import type { RenamePreview } from '../types/rename-proposal.js';
import type { AppConfig } from '../config/schema.js';
import type { SanitizeOptions } from '../rename/sanitize.js';
import { scanFolder } from '../scanner/scanner.js';
import { extractBatch } from '../extractors/batch.js';
import { generatePreviewWithRules } from '../rename/preview-with-rules.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Progress callback with phase information.
 *
 * @param current - Current item number being processed
 * @param total - Total items to process (-1 if unknown during scanning)
 * @param phase - Current workflow phase
 */
export type WorkflowProgressCallback = (
  current: number,
  total: number,
  phase: 'scanning' | 'extracting' | 'applying'
) => void;

/**
 * Options for the scan-and-apply workflow.
 */
export interface ScanAndApplyOptions {
  /** Scan subdirectories recursively (default: false) */
  recursive?: boolean;
  /** Filter by file extensions (without dot, e.g., ['jpg', 'png']) */
  extensions?: string[];
  /** Progress callback with phase information */
  onProgress?: WorkflowProgressCallback;
  /** AbortSignal for cancellation support */
  signal?: AbortSignal;
  /** Override for OS-level filename sanitization */
  osSanitizeOptions?: SanitizeOptions | false;
  /** Fallback values for missing placeholders */
  fallbacks?: Record<string, string>;
  /** Whether to check filesystem for existing file collisions (default: true) */
  checkFileSystem?: boolean;
  /** Base directory for file moves when using folder structures (Story 8.2) */
  baseDirectory?: string;
}

/**
 * Timing statistics for the workflow.
 */
export interface WorkflowTiming {
  /** Duration of scanning phase in milliseconds */
  scanDurationMs: number;
  /** Duration of extraction phase in milliseconds */
  extractDurationMs: number;
  /** Duration of rule application phase in milliseconds */
  applyDurationMs: number;
  /** Total workflow duration in milliseconds */
  totalDurationMs: number;
}

/**
 * Extraction error details.
 */
export interface ExtractionErrorInfo {
  /** Path to the file that failed extraction */
  path: string;
  /** Error message */
  error: string;
}

/**
 * Result of the scan-and-apply workflow.
 * Extends RenamePreview with workflow-specific metadata.
 */
export interface ScanAndApplyResult extends RenamePreview {
  /** Number of files found during scan */
  filesScanned: number;
  /** Number of files with metadata successfully extracted */
  filesExtracted: number;
  /** Extraction errors (non-blocking) */
  extractionErrors: ExtractionErrorInfo[];
  /** Workflow timing statistics */
  timing: WorkflowTiming;
}

/**
 * Error types for scan-and-apply workflow.
 */
export interface ScanAndApplyError {
  type: 'scan_failed' | 'cancelled' | 'no_default_template' | 'preview_failed';
  message: string;
  phase?: 'scanning' | 'extracting' | 'applying';
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Find the default template ID from config.
 * Returns the first template with isDefault: true, or the first template if none is default.
 */
function findDefaultTemplateId(config: AppConfig): string | null {
  // First try to find a template explicitly marked as default
  const defaultTemplate = config.templates.find((t) => t.isDefault);
  if (defaultTemplate) {
    return defaultTemplate.id;
  }

  // Fall back to first template if available
  if (config.templates.length > 0) {
    return config.templates[0]!.id;
  }

  return null;
}

/**
 * Convert BatchExtractionResult to a Map<path, UnifiedMetadata>.
 */
function buildMetadataMap(
  successful: UnifiedMetadata[]
): Map<string, UnifiedMetadata> {
  const map = new Map<string, UnifiedMetadata>();
  for (const metadata of successful) {
    map.set(metadata.file.path, metadata);
  }
  return map;
}

// =============================================================================
// Main Function
// =============================================================================

/**
 * Scan a folder, extract metadata, and apply rules to generate rename preview.
 *
 * This is the main entry point for the complete file organization workflow.
 * It combines scanning, metadata extraction, and rule-based template application
 * into a single, progress-reporting operation.
 *
 * **Workflow Phases:**
 * 1. **Scanning**: Discover files in the folder
 * 2. **Extracting**: Extract metadata from supported files
 * 3. **Applying**: Evaluate rules and generate rename proposals
 *
 * @param folderPath - Path to the folder to scan
 * @param config - Application configuration with rules, templates, and preferences
 * @param options - Workflow options (recursive, extensions, progress, abort)
 * @returns Result with ScanAndApplyResult or error
 *
 * @example
 * ```typescript
 * const result = await scanAndApplyRules('/path/to/photos', config, {
 *   recursive: false,
 *   onProgress: (current, total, phase) => {
 *     console.log(`${phase}: ${current}/${total}`);
 *   },
 * });
 *
 * if (result.ok) {
 *   console.log(`${result.data.filesScanned} files found`);
 *   console.log(`${result.data.proposals.length} rename proposals`);
 *   console.log(`${result.data.summary.ready} ready to rename`);
 * }
 * ```
 */
export async function scanAndApplyRules(
  folderPath: string,
  config: AppConfig,
  options: ScanAndApplyOptions = {}
): Promise<Result<ScanAndApplyResult, ScanAndApplyError>> {
  const {
    recursive = false,
    extensions,
    onProgress,
    signal,
    osSanitizeOptions,
    fallbacks,
    checkFileSystem = true,
    baseDirectory,
  } = options;

  const totalStartTime = Date.now();

  // Validate default template exists
  const defaultTemplateId = findDefaultTemplateId(config);
  if (!defaultTemplateId) {
    return err({
      type: 'no_default_template',
      message: 'No default template configured. Add at least one template to the configuration.',
    });
  }

  // =========================================================================
  // Phase 1: Scan
  // =========================================================================
  const scanStartTime = Date.now();

  // Check for cancellation before starting
  if (signal?.aborted) {
    return err({
      type: 'cancelled',
      message: 'Workflow cancelled before scanning',
      phase: 'scanning',
    });
  }

  const scanResult = await scanFolder(folderPath, {
    recursive,
    extensions,
    signal,
    onProgress: onProgress
      ? (current, total) => onProgress(current, total, 'scanning')
      : undefined,
  });

  const scanDurationMs = Date.now() - scanStartTime;

  if (!scanResult.ok) {
    // Check if it was a cancellation (check signal first, then error message as fallback)
    if (signal?.aborted || scanResult.error.message.toLowerCase().includes('cancel')) {
      return err({
        type: 'cancelled',
        message: 'Workflow cancelled during scanning',
        phase: 'scanning',
      });
    }
    return err({
      type: 'scan_failed',
      message: scanResult.error.message,
      phase: 'scanning',
    });
  }

  const files = scanResult.data;
  const filesScanned = files.length;

  // Handle empty folder case
  if (filesScanned === 0) {
    return ok({
      proposals: [],
      summary: {
        total: 0,
        ready: 0,
        conflicts: 0,
        missingData: 0,
        noChange: 0,
        invalidName: 0,
      },
      generatedAt: new Date(),
      // Empty string indicates no template was actually applied (no files to process)
      templateUsed: '',
      filesScanned: 0,
      filesExtracted: 0,
      extractionErrors: [],
      timing: {
        scanDurationMs,
        extractDurationMs: 0,
        applyDurationMs: 0,
        totalDurationMs: Date.now() - totalStartTime,
      },
    });
  }

  // =========================================================================
  // Phase 2: Extract
  // =========================================================================
  const extractStartTime = Date.now();

  // Check for cancellation before extraction
  if (signal?.aborted) {
    return err({
      type: 'cancelled',
      message: 'Workflow cancelled before extraction',
      phase: 'extracting',
    });
  }

  // Filter to files that support metadata extraction
  const extractableFiles = files.filter((f) => f.metadataSupported);
  const extractionErrors: ExtractionErrorInfo[] = [];
  let metadataMap: Map<string, UnifiedMetadata>;

  if (extractableFiles.length > 0) {
    const extractResult = await extractBatch(extractableFiles, {
      signal,
      onProgress: onProgress
        ? (processed, total) => onProgress(processed, total, 'extracting')
        : undefined,
    });

    // Collect extraction errors (non-blocking)
    for (const failed of extractResult.failed) {
      extractionErrors.push({
        path: failed.filePath,
        error: failed.message,
      });
    }

    metadataMap = buildMetadataMap(extractResult.successful);
  } else {
    metadataMap = new Map();
  }

  const extractDurationMs = Date.now() - extractStartTime;
  const filesExtracted = metadataMap.size;

  // Check for cancellation after extraction
  if (signal?.aborted) {
    return err({
      type: 'cancelled',
      message: 'Workflow cancelled after extraction',
      phase: 'extracting',
    });
  }

  // =========================================================================
  // Phase 3: Apply Rules
  // =========================================================================
  const applyStartTime = Date.now();

  // Check for cancellation before rule application
  if (signal?.aborted) {
    return err({
      type: 'cancelled',
      message: 'Workflow cancelled before applying rules',
      phase: 'applying',
    });
  }

  const previewResult = generatePreviewWithRules(files, metadataMap, {
    metadataRules: config.rules,
    filenameRules: config.filenameRules,
    templates: config.templates,
    defaultTemplateId,
    rulePriorityMode: config.preferences.rulePriorityMode,
    signal,
    fallbacks,
    checkFileSystem,
    osSanitizeOptions,
    // Story 8.2: Pass folder structures for file organization
    folderStructures: config.folderStructures,
    baseDirectory,
    onProgress: onProgress
      ? (current, total) => onProgress(current, total, 'applying')
      : undefined,
  });

  const applyDurationMs = Date.now() - applyStartTime;
  const totalDurationMs = Date.now() - totalStartTime;

  if (!previewResult.ok) {
    if (previewResult.error.type === 'cancelled') {
      return err({
        type: 'cancelled',
        message: 'Workflow cancelled during rule application',
        phase: 'applying',
      });
    }
    return err({
      type: 'preview_failed',
      message: previewResult.error.message,
      phase: 'applying',
    });
  }

  const preview = previewResult.data;

  // =========================================================================
  // Build Final Result
  // =========================================================================
  return ok({
    ...preview,
    filesScanned,
    filesExtracted,
    extractionErrors,
    timing: {
      scanDurationMs,
      extractDurationMs,
      applyDurationMs,
      totalDurationMs,
    },
  });
}
