/**
 * @fileoverview Rule-aware preview generation - Story 7.3
 *
 * Generates rename previews using rule-based template selection.
 * Files are matched against metadata and filename rules to determine
 * which template to use for each file.
 */

import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { ok, err, type Result } from '../types/result.js';
import type { FileInfo } from '../types/file-info.js';
import type { UnifiedMetadata } from '../types/unified-metadata.js';
import { createEmptyUnifiedMetadata } from '../types/unified-metadata.js';
import type { MetadataPatternRule } from '../types/rule.js';
import type { FilenamePatternRule } from '../types/filename-rule.js';
import type { Template } from '../config/schema.js';
import type {
  RenameProposal,
  RenamePreview,
  RenameStatusType,
  RenameIssue,
  PreviewSummary,
  AppliedRule,
  TemplateSource,
  LlmSuggestion,
} from '../types/rename-proposal.js';
import type { OllamaConfig } from '../llm/types.js';
import type { AnalysisResult } from '../llm/analysis.js';
import { RenameStatus } from '../types/rename-proposal.js';
import { previewFile } from '../templates/preview.js';
import { isValidFilename } from '../templates/utils/sanitize.js';
import { detectFilesystemCollisions, type FilesystemCheckOptions } from './conflicts.js';
import { sanitizeFilename, type SanitizeOptions } from './sanitize.js';
import {
  resolveTemplateForRule,
  type RulePriorityMode,
} from '../rules/template-resolver.js';
import type { FolderStructure } from '../types/folder-structure.js';
import { resolveFolderPath } from '../organize/folder-resolver.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Options for generating a rule-aware preview.
 */
export interface GeneratePreviewWithRulesOptions {
  /** Metadata pattern rules to evaluate */
  metadataRules?: MetadataPatternRule[];
  /** Filename pattern rules to evaluate */
  filenameRules?: FilenamePatternRule[];
  /** Available templates */
  templates: Template[];
  /** Default template ID to use when no rules match */
  defaultTemplateId: string;
  /** Rule priority mode: 'combined' (default), 'metadata-first', 'filename-first' */
  rulePriorityMode?: RulePriorityMode;
  /** Progress callback: (current, total) => void */
  onProgress?: (current: number, total: number) => void;
  /** AbortSignal for cancellation support */
  signal?: AbortSignal;
  /** Fallback values for missing placeholders */
  fallbacks?: Record<string, string>;
  /** Whether to sanitize filenames (default: true) */
  sanitizeFilenames?: boolean;
  /** Whether to check filesystem for existing file collisions (default: true) */
  checkFileSystem?: boolean;
  /** Override case sensitivity detection for filesystem checks */
  caseSensitive?: boolean;
  /**
   * Options for OS-level filename sanitization (Story 4.7).
   * Set to false to disable OS sanitization entirely.
   * Set to SanitizeOptions to customize sanitization behavior.
   * @default { targetPlatform: 'all' }
   */
  osSanitizeOptions?: SanitizeOptions | false;
  /**
   * Folder structures for organizing files into directories (Story 8.2).
   * Rules with folderStructureId will use these to determine target directories.
   */
  folderStructures?: FolderStructure[];
  /**
   * Base directory for move operations (Story 8.2).
   * When provided, resolved folder paths are relative to this directory.
   * Default: same as source directory.
   */
  baseDirectory?: string;
  /**
   * Enable LLM analysis for naming suggestions (Story 10.3).
   * When true, pre-analyzed results from llmAnalysisResults will be used.
   * Note: This function does NOT call Ollama directly - callers must
   * analyze files separately using the llm module and pass results here.
   */
  enableLlmAnalysis?: boolean;
  /**
   * Ollama configuration - reserved for future inline analysis.
   * Currently unused: pass pre-analyzed results via llmAnalysisResults instead.
   * @deprecated Will be used in future for inline analysis; currently ignored.
   */
  llmConfig?: OllamaConfig;
  /**
   * Pre-analyzed LLM results to avoid re-analysis (Story 10.3).
   * Map from file path to analysis result.
   */
  llmAnalysisResults?: Map<string, AnalysisResult>;
  /**
   * Progress callback for LLM analysis (Story 10.3).
   * Called for each file analyzed.
   */
  onLlmProgress?: (current: number, total: number, file: string) => void;
  /**
   * Minimum confidence threshold for using LLM suggestions (Story 10.3).
   * Suggestions below this threshold will not be used. Default: 0.7
   */
  llmConfidenceThreshold?: number;
}

/**
 * Error types for preview generation.
 */
export interface GeneratePreviewWithRulesError {
  type: 'cancelled' | 'generation_error' | 'default_template_not_found';
  message: string;
}

// =============================================================================
// Main Function
// =============================================================================

/**
 * Generate a rename preview using rule-based template selection.
 *
 * For each file:
 * 1. Evaluate rules (metadata + filename) to find matching rule
 * 2. Use matched rule's template, or default template if no match
 * 3. Generate rename proposal with template source tracking
 *
 * @param files - Array of file info objects
 * @param metadataMap - Map from file path to unified metadata
 * @param options - Generation options including rules, templates, and settings
 * @returns Result with RenamePreview or error
 *
 * @example
 * ```typescript
 * const result = generatePreviewWithRules(
 *   files,
 *   metadataMap,
 *   {
 *     metadataRules: config.rules,
 *     filenameRules: config.filenameRules,
 *     templates: config.templates,
 *     defaultTemplateId: config.defaultTemplateId,
 *   }
 * );
 * if (result.ok) {
 *   for (const proposal of result.data.proposals) {
 *     console.log(`${proposal.originalName} → ${proposal.proposedName}`);
 *     console.log(`  Template source: ${proposal.templateSource}`);
 *     if (proposal.appliedRule) {
 *       console.log(`  Matched rule: ${proposal.appliedRule.ruleName}`);
 *     }
 *   }
 * }
 * ```
 */
export function generatePreviewWithRules(
  files: FileInfo[],
  metadataMap: Map<string, UnifiedMetadata>,
  options: GeneratePreviewWithRulesOptions
): Result<RenamePreview, GeneratePreviewWithRulesError> {
  const {
    metadataRules = [],
    filenameRules = [],
    templates,
    defaultTemplateId,
    rulePriorityMode = 'combined',
    onProgress,
    signal,
    fallbacks,
    sanitizeFilenames = true,
    checkFileSystem = true,
    caseSensitive,
    osSanitizeOptions,
    folderStructures = [],
    baseDirectory,
    enableLlmAnalysis = false,
    llmAnalysisResults,
    llmConfidenceThreshold = 0.7,
    onLlmProgress,
  } = options;

  // Validate default template exists
  const defaultTemplate = templates.find((t) => t.id === defaultTemplateId);
  if (!defaultTemplate) {
    return err({
      type: 'default_template_not_found',
      message: `Default template "${defaultTemplateId}" not found`,
    });
  }

  const proposals: RenameProposal[] = [];

  // Track proposed names for conflict detection: Map<normalizedKey, proposalIds[]>
  const proposedNameMap = new Map<string, string[]>();

  try {
    // First pass: generate proposals with rule-based template selection
    for (let i = 0; i < files.length; i++) {
      // Check for cancellation
      if (signal?.aborted) {
        return err({
          type: 'cancelled',
          message: 'Preview generation cancelled',
        });
      }

      const file = files[i];
      if (!file) continue;

      const metadata = metadataMap.get(file.path);

      // Resolve template for this file based on rules
      const templateResolution = resolveTemplateForFile(
        file,
        metadata,
        metadataRules,
        filenameRules,
        templates,
        defaultTemplate,
        rulePriorityMode
      );

      // Get LLM analysis result if available (Story 10.3)
      let llmResult = enableLlmAnalysis ? llmAnalysisResults?.get(file.path) : undefined;
      let llmAnalysisFailed = false;

      // Report LLM progress and track if analysis was expected but missing (AC5)
      if (enableLlmAnalysis) {
        onLlmProgress?.(i + 1, files.length, file.path);

        // If LLM was enabled but no result exists, mark as failed (AC4)
        if (!llmResult && llmAnalysisResults !== undefined) {
          llmAnalysisFailed = true;
        }
      }

      const proposal = createProposal(
        file,
        metadata,
        templateResolution,
        {
          fallbacks,
          sanitizeFilenames,
          osSanitizeOptions,
          folderStructures,
          baseDirectory,
          llmResult,
          llmConfidenceThreshold,
          llmAnalysisFailed,
        }
      );
      proposals.push(proposal);

      // Track for conflict detection
      const key = normalizePathKey(proposal.proposedPath);
      const existing = proposedNameMap.get(key) ?? [];
      existing.push(proposal.id);
      proposedNameMap.set(key, existing);

      // Report progress
      onProgress?.(i + 1, files.length);
    }

    // Second pass: mark batch duplicates (same proposed name within batch)
    markConflicts(proposals, proposedNameMap);

    // Third pass: check for filesystem collisions
    if (checkFileSystem) {
      const fsCheckOptions: FilesystemCheckOptions = {
        checkFileSystem: true,
        ...(caseSensitive !== undefined && { caseSensitive }),
      };
      markFilesystemCollisions(proposals, fsCheckOptions);
    }

    // Calculate summary
    const summary = calculateSummary(proposals);

    return ok({
      proposals,
      summary,
      generatedAt: new Date(),
      templateUsed: defaultTemplate.pattern, // Default template pattern for reference
    });
  } catch (error) {
    return err({
      type: 'generation_error',
      message: `Preview generation failed: ${(error as Error).message}`,
    });
  }
}

// =============================================================================
// Internal Types
// =============================================================================

/**
 * Result of template resolution for a single file.
 */
interface TemplateResolutionForFile {
  /** Template to use */
  template: Template;
  /** Source of the template */
  templateSource: TemplateSource;
  /** Matched rule info (if any) */
  appliedRule?: AppliedRule;
  /** Warning issues to add to proposal */
  warnings: RenameIssue[];
  /** Folder structure ID from matched rule (Story 8.2) */
  folderStructureId?: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Resolve which template to use for a file.
 */
function resolveTemplateForFile(
  file: FileInfo,
  metadata: UnifiedMetadata | undefined,
  metadataRules: MetadataPatternRule[],
  filenameRules: FilenamePatternRule[],
  templates: Template[],
  defaultTemplate: Template,
  priorityMode: RulePriorityMode
): TemplateResolutionForFile {
  const warnings: RenameIssue[] = [];

  // If no metadata, create a minimal metadata object for rule evaluation
  const effectiveMetadata: UnifiedMetadata = metadata ?? createEmptyUnifiedMetadata(file);

  // Try to resolve template from rules
  const resolution = resolveTemplateForRule(
    metadataRules,
    filenameRules,
    file,
    effectiveMetadata,
    templates,
    { priorityMode }
  );

  // Rule matched and template found
  if (resolution.templateId && resolution.matchedRule) {
    const template = templates.find((t) => t.id === resolution.templateId);
    if (template) {
      return {
        template,
        templateSource: 'rule',
        appliedRule: {
          ruleId: resolution.matchedRule.ruleId,
          ruleName: resolution.matchedRule.ruleName,
          ruleType: resolution.matchedRule.ruleType,
        },
        warnings,
        // Use folderStructureId from template resolver (Story 8.2)
        folderStructureId: resolution.folderStructureId,
      };
    }
  }

  // Handle missing template case (rule matched but template deleted)
  if (resolution.fallbackReason === 'template-not-found') {
    warnings.push({
      code: 'RULE_TEMPLATE_MISSING',
      message: 'Rule matched but its template was not found, using default template',
    });
    return {
      template: defaultTemplate,
      templateSource: 'fallback',
      warnings,
    };
  }

  // No rules matched - use default
  return {
    template: defaultTemplate,
    templateSource: 'default',
    warnings,
  };
}

/**
 * Create a single rename proposal for a file.
 */
function createProposal(
  file: FileInfo,
  metadata: UnifiedMetadata | undefined,
  templateResolution: TemplateResolutionForFile,
  options: {
    fallbacks?: Record<string, string>;
    sanitizeFilenames?: boolean;
    osSanitizeOptions?: SanitizeOptions | false;
    folderStructures?: FolderStructure[];
    baseDirectory?: string;
    llmResult?: AnalysisResult;
    llmConfidenceThreshold?: number;
    llmAnalysisFailed?: boolean;
  }
): RenameProposal {
  const id = randomUUID();
  const issues: RenameIssue[] = [...templateResolution.warnings];
  let status: RenameStatusType = RenameStatus.READY;
  let proposedName: string;
  let proposedPath: string;
  let isMoveOperation: boolean | undefined;
  let folderStructureId: string | undefined = templateResolution.folderStructureId;
  let llmSuggestion: LlmSuggestion | undefined;
  let useLlmSuggestion = false;
  let templateSource: TemplateSource = templateResolution.templateSource;

  // Extract LLM suggestion if available (Story 10.3)
  if (options.llmResult) {
    const suggestion = options.llmResult.suggestion;
    llmSuggestion = {
      suggestedName: suggestion.suggestedName,
      confidence: suggestion.confidence,
      reasoning: suggestion.reasoning,
      keywords: suggestion.keywords,
    };

    // Determine if we should use the LLM suggestion based on confidence
    const threshold = options.llmConfidenceThreshold ?? 0.7;
    if (suggestion.confidence >= threshold) {
      useLlmSuggestion = true;
    }
  }

  // Add issue if LLM analysis was expected but failed (AC4: Graceful Fallback)
  if (options.llmAnalysisFailed) {
    issues.push({
      code: 'LLM_ANALYSIS_FAILED',
      message: 'LLM analysis failed or was unavailable, using template-based naming',
    });
  }

  // Convert UnifiedMetadata to FileMetadata format expected by previewFile
  const fileMetadata = metadata
    ? {
        imageMetadata: metadata.image,
        pdfMetadata: metadata.pdf,
        officeMetadata: metadata.office,
      }
    : {};

  // Story 10.3: Use LLM suggestion if confidence is high enough
  if (useLlmSuggestion && llmSuggestion) {
    // Use LLM-suggested name with file extension
    const extension = file.extension ?? '';
    proposedName = `${llmSuggestion.suggestedName}${extension}`;
    proposedPath = join(dirname(file.path), proposedName);
    templateSource = 'llm';

    // Add informational issue about LLM usage
    issues.push({
      code: 'LLM_SUGGESTION_USED',
      message: `Using LLM suggestion (confidence: ${(llmSuggestion.confidence * 100).toFixed(0)}%)`,
    });
  } else {
    // Apply template using the existing preview system
    const previewResult = previewFile(file, templateResolution.template.pattern, fileMetadata, {
      fallbacks: options.fallbacks,
      sanitizeFilenames: options.sanitizeFilenames,
      includeExtension: true,
    });

    if (!previewResult.ok) {
      // Template application failed
      proposedName = file.extension ? `${file.name}${file.extension}` : file.name;
      proposedPath = file.path;
      issues.push({
        code: 'TEMPLATE_ERROR',
        message: previewResult.error.message,
      });
      status = RenameStatus.MISSING_DATA;
    } else {
      const preview = previewResult.data;
      proposedName = preview.proposedName;
      proposedPath = preview.proposedPath;

      // Check for empty placeholders (indicates missing metadata)
      if (preview.hasEmptyPlaceholders) {
        for (const placeholder of preview.emptyPlaceholders) {
          issues.push({
            code: 'MISSING_METADATA',
            message: `Placeholder {${placeholder}} could not be filled`,
            field: placeholder,
          });
        }
        status = RenameStatus.MISSING_DATA;
      }

      // Check for fallback usage (warning but not error)
      const fallbackResolutions = preview.resolutions.filter((r) => r.usedFallback);
      for (const res of fallbackResolutions) {
        issues.push({
          code: 'USED_FALLBACK',
          message: `Used fallback value for {${res.placeholder}}`,
          field: res.placeholder,
        });
      }

      // Check if name would be unchanged (only if not already flagged as missing data)
      const originalName = file.extension ? `${file.name}${file.extension}` : file.name;
      if (proposedName === originalName && status === RenameStatus.READY) {
        status = RenameStatus.NO_CHANGE;
      }
    }
  }

  // Apply OS-level sanitization (Story 4.7)
  if (options.osSanitizeOptions !== false) {
    const sanitizeOpts: SanitizeOptions =
      typeof options.osSanitizeOptions === 'object'
        ? options.osSanitizeOptions
        : { targetPlatform: 'all' };

    const sanitizeResult = sanitizeFilename(proposedName, sanitizeOpts);

    if (sanitizeResult.wasModified) {
      // Update proposed name and path
      proposedName = sanitizeResult.sanitized;
      proposedPath = join(dirname(proposedPath), proposedName);

      // Track each sanitization change as an issue
      for (const change of sanitizeResult.changes) {
        let code: string;
        switch (change.type) {
          case 'char_replacement':
            code = 'SANITIZED_CHAR_REPLACEMENT';
            break;
          case 'reserved_name':
            code = 'SANITIZED_RESERVED_NAME';
            break;
          case 'truncation':
            code = 'SANITIZED_TRUNCATION';
            break;
          case 'trailing_fix':
            code = 'SANITIZED_TRAILING_FIX';
            break;
          default:
            code = 'SANITIZED';
        }
        issues.push({
          code,
          message: change.message,
        });
      }
    }
  }

  // Check for invalid filename (highest priority - overwrites other statuses)
  if (!isValidFilename(proposedName)) {
    issues.push({
      code: 'INVALID_NAME',
      message: 'Proposed filename contains invalid characters',
    });
    status = RenameStatus.INVALID_NAME;
  }

  // Build original name
  const originalName = file.extension ? `${file.name}${file.extension}` : file.name;

  // Story 8.2: Resolve folder structure if present
  if (folderStructureId && options.folderStructures && options.folderStructures.length > 0) {
    const folderStructure = options.folderStructures.find((fs) => fs.id === folderStructureId);

    if (folderStructure?.enabled) {
      // Create effective metadata for folder resolution
      const effectiveMetadata = metadata ?? createEmptyUnifiedMetadata(file);

      const folderResult = resolveFolderPath(
        folderStructure.pattern,
        effectiveMetadata,
        file,
        { fallbacks: options.fallbacks }
      );

      if (folderResult.ok) {
        // Calculate new proposed path with folder structure
        const baseDir = options.baseDirectory ?? dirname(file.path);
        const resolvedFolder = folderResult.data.resolvedPath;

        // Construct full proposed path
        proposedPath = join(baseDir, resolvedFolder, proposedName);

        // Detect if this is a move operation (directory changed)
        const originalDir = dirname(file.path);
        const proposedDir = dirname(proposedPath);
        if (originalDir !== proposedDir) {
          isMoveOperation = true;
        }
      } else {
        // Folder resolution failed - add issue and flag as MISSING_DATA (AC7)
        issues.push({
          code: 'FOLDER_RESOLUTION_FAILED',
          message: `Folder structure resolution failed: ${folderResult.error.message}`,
        });
        // Per AC7: file is flagged with MISSING_DATA status when folder placeholders cannot be resolved
        status = RenameStatus.MISSING_DATA;
        folderStructureId = undefined; // Clear since resolution failed
      }
    }
  }

  return {
    id,
    originalPath: file.path,
    originalName,
    proposedName,
    proposedPath,
    status,
    issues,
    metadata: buildMetadataRecord(metadata),
    appliedRule: templateResolution.appliedRule,
    templateSource,
    isMoveOperation,
    folderStructureId,
    llmSuggestion,
    // Set to true/false when LLM was involved, undefined when LLM was not used at all
    useLlmSuggestion: llmSuggestion !== undefined ? useLlmSuggestion : undefined,
  };
}

/**
 * Normalize a path for conflict detection (case-insensitive, forward slashes).
 */
function normalizePathKey(filePath: string): string {
  return filePath.toLowerCase().replace(/\\/g, '/');
}

/**
 * Mark proposals that have naming conflicts (batch duplicates).
 */
function markConflicts(
  proposals: RenameProposal[],
  proposedNameMap: Map<string, string[]>
): void {
  for (const [, ids] of proposedNameMap) {
    if (ids.length > 1) {
      // Multiple proposals would result in the same path
      for (const id of ids) {
        const proposal = proposals.find((p) => p.id === id);
        if (proposal?.status === RenameStatus.READY) {
          proposal.status = RenameStatus.CONFLICT;
          proposal.issues.push({
            code: 'DUPLICATE_NAME',
            message: 'Another file would have the same name in this directory',
          });
        }
      }
    }
  }
}

/**
 * Mark proposals that would collide with existing filesystem files.
 */
function markFilesystemCollisions(
  proposals: RenameProposal[],
  options: FilesystemCheckOptions
): void {
  const collisions = detectFilesystemCollisions(proposals, options);

  for (const [proposalId, conflicts] of collisions) {
    const proposal = proposals.find((p) => p.id === proposalId);
    if (proposal && proposal.status === RenameStatus.READY) {
      proposal.status = RenameStatus.CONFLICT;
      for (const conflict of conflicts) {
        proposal.issues.push({
          code: conflict.code,
          message: conflict.message,
        });
      }
    }
  }
}

/**
 * Calculate summary statistics from proposals.
 * Includes move operation counts (Story 8.3) and LLM-suggested counts (Story 10.3).
 */
function calculateSummary(proposals: RenameProposal[]): PreviewSummary {
  const moveOperations = proposals.filter((p) => p.isMoveOperation === true).length;
  const renameOnly = proposals.length - moveOperations;
  const llmSuggested = proposals.filter((p) => p.useLlmSuggestion === true).length;

  return {
    total: proposals.length,
    ready: proposals.filter((p) => p.status === RenameStatus.READY).length,
    conflicts: proposals.filter((p) => p.status === RenameStatus.CONFLICT).length,
    missingData: proposals.filter((p) => p.status === RenameStatus.MISSING_DATA).length,
    noChange: proposals.filter((p) => p.status === RenameStatus.NO_CHANGE).length,
    invalidName: proposals.filter((p) => p.status === RenameStatus.INVALID_NAME).length,
    moveOperations,
    renameOnly,
    llmSuggested,
  };
}

/**
 * Build a metadata record from unified metadata.
 */
function buildMetadataRecord(metadata: UnifiedMetadata | undefined): Record<string, unknown> | undefined {
  if (!metadata) {
    return undefined;
  }

  if (!metadata.image && !metadata.pdf && !metadata.office) {
    return undefined;
  }

  return {
    ...(metadata.image && { image: metadata.image }),
    ...(metadata.pdf && { pdf: metadata.pdf }),
    ...(metadata.office && { office: metadata.office }),
  };
}
