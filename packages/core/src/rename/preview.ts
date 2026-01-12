import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { ok, err, type Result } from '../types/result.js';
import type { FileInfo } from '../types/file-info.js';
import type { ImageMetadata } from '../types/image-metadata.js';
import type { PDFMetadata } from '../types/pdf-metadata.js';
import type { OfficeMetadata } from '../types/office-metadata.js';
import type {
  RenameProposal,
  RenamePreview,
  RenameStatusType,
  RenameIssue,
  PreviewSummary,
} from '../types/rename-proposal.js';
import { RenameStatus } from '../types/rename-proposal.js';
import { previewFile } from '../templates/preview.js';
import { isValidFilename } from '../templates/utils/sanitize.js';
import type { CaseStyle } from '../templates/utils/case-normalizer.js';
import { detectFilesystemCollisions, type FilesystemCheckOptions } from './conflicts.js';
import { sanitizeFilename, type SanitizeOptions } from './sanitize.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Metadata bundle for a file.
 */
export interface FileMetadata {
  imageMetadata?: ImageMetadata | null;
  pdfMetadata?: PDFMetadata | null;
  officeMetadata?: OfficeMetadata | null;
}

/**
 * Options for generating a preview.
 */
export interface GeneratePreviewOptions {
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
   * Case normalization style for filenames.
   * @default 'kebab-case'
   */
  caseNormalization?: CaseStyle;
}

/**
 * Error types for preview generation.
 */
export interface GeneratePreviewError {
  type: 'cancelled' | 'generation_error';
  message: string;
}

// =============================================================================
// Main Function
// =============================================================================

/**
 * Generate a rename preview for multiple files using a template.
 *
 * This function:
 * 1. Applies the template to each file
 * 2. Determines status for each proposal (ready, conflict, missing-data, etc.)
 * 3. Detects naming conflicts between files
 * 4. Returns a complete preview without modifying any files
 *
 * @param files - Array of file info objects
 * @param metadataMap - Map from file path to metadata
 * @param templatePattern - Template pattern string (e.g., "{year}-{month}-{original}")
 * @param options - Generation options (progress, cancellation, fallbacks)
 * @returns Result with RenamePreview or error
 *
 * @example
 * ```typescript
 * const result = generatePreview(
 *   files,
 *   metadataMap,
 *   '{year}-{month}-{original}',
 *   { onProgress: (c, t) => console.log(`${c}/${t}`) }
 * );
 * if (result.ok) {
 *   console.log(`${result.data.summary.ready} files ready to rename`);
 * }
 * ```
 */
export function generatePreview(
  files: FileInfo[],
  metadataMap: Map<string, FileMetadata>,
  templatePattern: string,
  options: GeneratePreviewOptions = {}
): Result<RenamePreview, GeneratePreviewError> {
  const {
    onProgress,
    signal,
    fallbacks,
    sanitizeFilenames = true,
    checkFileSystem = true,
    caseSensitive,
    osSanitizeOptions,
    caseNormalization,
  } = options;
  const proposals: RenameProposal[] = [];

  // Track proposed names for conflict detection: Map<normalizedKey, proposalIds[]>
  const proposedNameMap = new Map<string, string[]>();

  try {
    // First pass: generate proposals
    for (let i = 0; i < files.length; i++) {
      // Check for cancellation
      if (signal?.aborted) {
        return err({
          type: 'cancelled',
          message: 'Preview generation cancelled',
        });
      }

      const file = files[i];
      if (!file) continue; // Safety check (shouldn't happen with valid i)
      const metadata = metadataMap.get(file.path) ?? {};

      const proposal = createProposal(
        file,
        metadata,
        templatePattern,
        { fallbacks, sanitizeFilenames, osSanitizeOptions, caseNormalization }
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

    // Third pass: check for filesystem collisions (AC2: collision with existing files)
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
      templateUsed: templatePattern,
    });
  } catch (error) {
    return err({
      type: 'generation_error',
      message: `Preview generation failed: ${(error as Error).message}`,
    });
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Create a single rename proposal for a file.
 */
function createProposal(
  file: FileInfo,
  metadata: FileMetadata,
  templatePattern: string,
  options: {
    fallbacks?: Record<string, string>;
    sanitizeFilenames?: boolean;
    osSanitizeOptions?: SanitizeOptions | false;
    caseNormalization?: CaseStyle;
  }
): RenameProposal {
  const id = randomUUID();
  const issues: RenameIssue[] = [];
  let status: RenameStatusType = RenameStatus.READY;
  let proposedName: string;
  let proposedPath: string;

  // Apply template using the existing preview system
  const previewResult = previewFile(file, templatePattern, metadata, {
    fallbacks: options.fallbacks,
    sanitizeFilenames: options.sanitizeFilenames,
    includeExtension: true,
    caseNormalization: options.caseNormalization,
  });

  if (!previewResult.ok) {
    // Template application failed
    proposedName = file.extension ? `${file.name}.${file.extension}` : file.name;
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
    const originalName = file.extension ? `${file.name}.${file.extension}` : file.name;
    if (proposedName === originalName && status === RenameStatus.READY) {
      status = RenameStatus.NO_CHANGE;
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
  }

  // Build original name
  const originalName = file.extension ? `${file.name}.${file.extension}` : file.name;

  return {
    id,
    originalPath: file.path,
    originalName,
    proposedName,
    proposedPath,
    status,
    issues,
    metadata: buildMetadataRecord(metadata),
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
 */
function calculateSummary(proposals: RenameProposal[]): PreviewSummary {
  return {
    total: proposals.length,
    ready: proposals.filter((p) => p.status === RenameStatus.READY).length,
    conflicts: proposals.filter((p) => p.status === RenameStatus.CONFLICT).length,
    missingData: proposals.filter((p) => p.status === RenameStatus.MISSING_DATA).length,
    noChange: proposals.filter((p) => p.status === RenameStatus.NO_CHANGE).length,
    invalidName: proposals.filter((p) => p.status === RenameStatus.INVALID_NAME).length,
  };
}

/**
 * Build a metadata record from the metadata bundle.
 */
function buildMetadataRecord(metadata: FileMetadata): Record<string, unknown> | undefined {
  if (!metadata.imageMetadata && !metadata.pdfMetadata && !metadata.officeMetadata) {
    return undefined;
  }

  return {
    ...(metadata.imageMetadata && { image: metadata.imageMetadata }),
    ...(metadata.pdfMetadata && { pdf: metadata.pdfMetadata }),
    ...(metadata.officeMetadata && { office: metadata.officeMetadata }),
  };
}
