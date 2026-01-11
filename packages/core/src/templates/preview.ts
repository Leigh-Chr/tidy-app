import path from 'path';
import { ok, err, type Result } from '../types/result.js';
import type {
  FilePreviewResult,
  BatchPreviewResult,
  PlaceholderResolution,
  PlaceholderContext,
  PreviewOptions,
  ParsedTemplate,
  PreviewPlaceholderSource,
} from '../types/template.js';
import type { FileInfo } from '../types/file-info.js';
import type { ImageMetadata } from '../types/image-metadata.js';
import type { PDFMetadata } from '../types/pdf-metadata.js';
import type { OfficeMetadata } from '../types/office-metadata.js';
import { parseTemplate } from './parser.js';
import {
  resolveDatePlaceholder,
  isDatePlaceholder,
} from './resolvers/date-resolver.js';
import {
  resolveMetadataPlaceholder,
  isMetadataPlaceholder,
} from './resolvers/metadata-resolver.js';
import {
  resolveFilePlaceholder,
  isFilePlaceholder,
} from './resolvers/file-resolver.js';
import { sanitizeFilename } from './utils/sanitize.js';

/**
 * Error types for preview operations
 */
export interface PreviewError {
  type: 'parse_error' | 'invalid_filename';
  message: string;
  details?: unknown;
}

/**
 * Valid source values for preview placeholder resolution.
 */
const VALID_PREVIEW_SOURCES: readonly PreviewPlaceholderSource[] = [
  'exif',
  'document',
  'filesystem',
  'fallback',
  'literal',
];

/**
 * Type guard to validate a source string is a valid PreviewPlaceholderSource.
 */
function isValidPreviewSource(source: string): source is PreviewPlaceholderSource {
  return VALID_PREVIEW_SOURCES.includes(source as PreviewPlaceholderSource);
}

/**
 * Safely convert a PlaceholderSource to PreviewPlaceholderSource.
 * Falls back to 'literal' if the source is not recognized.
 */
function toPreviewSource(source: string): PreviewPlaceholderSource {
  return isValidPreviewSource(source) ? source : 'literal';
}

/**
 * Maximum recommended filename length (leaving room for path).
 * Most filesystems support 255 bytes, but we use 200 to leave room for directories.
 */
const MAX_FILENAME_LENGTH = 200;

/**
 * Resolve a single placeholder to its value with full tracking.
 */
function resolvePlaceholder(
  placeholderName: string,
  context: PlaceholderContext,
  options: PreviewOptions
): PlaceholderResolution {
  const fallbackValue = options.fallbacks?.[placeholderName] ?? '';

  // Date placeholders
  if (isDatePlaceholder(placeholderName)) {
    const result = resolveDatePlaceholder(placeholderName, context);
    return {
      placeholder: placeholderName,
      value: result.value,
      source: toPreviewSource(result.source),
      isEmpty: result.value === '',
      usedFallback: false,
    };
  }

  // Metadata placeholders
  if (isMetadataPlaceholder(placeholderName)) {
    const result = resolveMetadataPlaceholder(placeholderName, context, {
      fallback: fallbackValue,
      sanitizeForFilename: options.sanitizeFilenames ?? true,
    });

    // Check if the resolver used a fallback (source is 'literal' with non-empty fallback)
    const usedFallback = result.source === 'literal' && fallbackValue !== '' && result.value === fallbackValue;

    return {
      placeholder: placeholderName,
      value: result.value,
      source: usedFallback ? 'fallback' : toPreviewSource(result.source),
      isEmpty: result.value === '',
      usedFallback,
    };
  }

  // File placeholders
  if (isFilePlaceholder(placeholderName)) {
    const result = resolveFilePlaceholder(placeholderName, context, {
      sanitizeForFilename: options.sanitizeFilenames ?? true,
    });
    return {
      placeholder: placeholderName,
      value: result.value,
      source: toPreviewSource(result.source),
      isEmpty: result.value === '',
      usedFallback: false,
    };
  }

  // Unknown placeholder - use fallback or empty
  const usedFallback = fallbackValue !== '';
  return {
    placeholder: placeholderName,
    value: fallbackValue,
    source: usedFallback ? 'fallback' : 'literal',
    isEmpty: fallbackValue === '',
    usedFallback,
  };
}

/**
 * Build filename from parsed template and resolutions.
 */
function buildFilename(
  template: ParsedTemplate,
  resolutions: PlaceholderResolution[]
): string {
  const resolutionMap = new Map(resolutions.map((r) => [r.placeholder, r.value]));

  return template.tokens
    .map((token) => {
      if (token.type === 'literal') {
        return token.value;
      }
      return resolutionMap.get(token.name) ?? '';
    })
    .join('');
}

/**
 * Internal function to generate preview with a pre-parsed template.
 * Used by both previewFile and previewFiles to avoid re-parsing.
 */
function previewFileInternal(
  file: FileInfo,
  template: ParsedTemplate,
  templatePattern: string,
  metadata: {
    imageMetadata?: ImageMetadata | null;
    pdfMetadata?: PDFMetadata | null;
    officeMetadata?: OfficeMetadata | null;
  },
  options: PreviewOptions
): Result<FilePreviewResult, PreviewError> {
  const context: PlaceholderContext = {
    file,
    imageMetadata: metadata.imageMetadata ?? null,
    pdfMetadata: metadata.pdfMetadata ?? null,
    officeMetadata: metadata.officeMetadata ?? null,
  };

  // Resolve all placeholders
  const resolutions: PlaceholderResolution[] = template.placeholders.map(
    (placeholder) => resolvePlaceholder(placeholder, context, options)
  );

  // Build the proposed filename
  let proposedName = buildFilename(template, resolutions);

  // Sanitize if needed
  if (options.sanitizeFilenames ?? true) {
    proposedName = sanitizeFilename(proposedName);
  }

  // Add extension if not present and requested
  const includeExt = options.includeExtension ?? true;
  if (includeExt && file.extension && !proposedName.endsWith(`.${file.extension}`)) {
    proposedName = `${proposedName}.${file.extension}`;
  }

  // Handle empty or invalid result (Issue 3: comprehensive checks)
  const trimmedName = proposedName.trim();
  const extensionOnly = file.extension ? `.${file.extension}` : '';
  if (
    !trimmedName ||
    trimmedName === '.' ||
    trimmedName === '..' ||
    trimmedName === extensionOnly
  ) {
    return err({
      type: 'invalid_filename',
      message: 'Template produced empty or invalid filename',
    });
  }

  // Identify empty placeholders
  const emptyPlaceholders = resolutions
    .filter((r) => r.isEmpty)
    .map((r) => r.placeholder);

  // Generate warnings
  const warnings: string[] = [];
  if (emptyPlaceholders.length > 0) {
    warnings.push(
      `Empty placeholders: ${emptyPlaceholders.map((p) => `{${p}}`).join(', ')}`
    );
  }

  const usedFallbacks = resolutions.filter((r) => r.usedFallback);
  if (usedFallbacks.length > 0) {
    warnings.push(
      `Used fallback values for: ${usedFallbacks.map((r) => `{${r.placeholder}}`).join(', ')}`
    );
  }

  // Issue 4: Warn if filename is too long for filesystem compatibility
  if (proposedName.length > MAX_FILENAME_LENGTH) {
    warnings.push(
      `Filename may be too long (${String(proposedName.length)} chars, max recommended: ${String(MAX_FILENAME_LENGTH)})`
    );
  }

  // Determine status
  let status: 'ready' | 'warning' | 'error' = 'ready';
  if (warnings.length > 0) {
    status = 'warning';
  }

  // Build proposed path
  const dir = path.dirname(file.path);
  const proposedPath = path.join(dir, proposedName);

  // Build original name with extension
  const originalName = file.extension ? `${file.name}.${file.extension}` : file.name;

  return ok({
    originalPath: file.path,
    originalName,
    proposedName,
    proposedPath,
    template: templatePattern,
    resolutions,
    hasEmptyPlaceholders: emptyPlaceholders.length > 0,
    emptyPlaceholders,
    status,
    warnings,
  });
}

/**
 * Generate preview for a single file.
 *
 * @param file - The file to preview
 * @param templatePattern - The template pattern to apply
 * @param metadata - Optional metadata for the file
 * @param options - Preview options (fallbacks, sanitization)
 * @returns Result with preview details or error
 *
 * @example
 * ```typescript
 * const result = previewFile(file, '{year}-{month}-{original}');
 * if (result.ok) {
 *   console.log(`${result.data.originalName} -> ${result.data.proposedName}`);
 * }
 * ```
 */
export function previewFile(
  file: FileInfo,
  templatePattern: string,
  metadata: {
    imageMetadata?: ImageMetadata | null;
    pdfMetadata?: PDFMetadata | null;
    officeMetadata?: OfficeMetadata | null;
  } = {},
  options: PreviewOptions = {}
): Result<FilePreviewResult, PreviewError> {
  // Parse template
  const parseResult = parseTemplate(templatePattern);
  if (!parseResult.ok) {
    return err({
      type: 'parse_error',
      message: `Invalid template: ${parseResult.error.message}`,
      details: parseResult.error,
    });
  }

  return previewFileInternal(file, parseResult.data, templatePattern, metadata, options);
}

/**
 * Generate preview for multiple files.
 *
 * Processes all files and collects results. Errors on individual files
 * are captured in the results array rather than stopping the batch.
 *
 * @param files - Array of files with their metadata
 * @param templatePattern - The template pattern to apply
 * @param options - Preview options
 * @returns Batch preview result with all file results
 *
 * @example
 * ```typescript
 * const batch = previewFiles(
 *   files.map(f => ({ file: f, imageMetadata: f.metadata })),
 *   '{year}/{month}/{original}'
 * );
 * console.log(`${batch.readyCount} ready, ${batch.warningCount} warnings`);
 * ```
 */
export function previewFiles(
  files: Array<{
    file: FileInfo;
    imageMetadata?: ImageMetadata | null;
    pdfMetadata?: PDFMetadata | null;
    officeMetadata?: OfficeMetadata | null;
  }>,
  templatePattern: string,
  options: PreviewOptions = {}
): BatchPreviewResult {
  const results: FilePreviewResult[] = [];
  let readyCount = 0;
  let warningCount = 0;
  let errorCount = 0;

  // Issue 5: Parse template once for entire batch (performance optimization)
  const parseResult = parseTemplate(templatePattern);
  if (!parseResult.ok) {
    // All files get the same parse error
    for (const { file } of files) {
      const originalName = file.extension
        ? `${file.name}.${file.extension}`
        : file.name;
      results.push({
        originalPath: file.path,
        originalName,
        proposedName: '',
        proposedPath: '',
        template: templatePattern,
        resolutions: [],
        hasEmptyPlaceholders: false,
        emptyPlaceholders: [],
        status: 'error',
        warnings: [],
        error: `Invalid template: ${parseResult.error.message}`,
      });
      errorCount++;
    }
    return {
      template: templatePattern,
      totalFiles: files.length,
      results,
      readyCount,
      warningCount,
      errorCount,
    };
  }

  const template = parseResult.data;

  for (const { file, imageMetadata, pdfMetadata, officeMetadata } of files) {
    const result = previewFileInternal(
      file,
      template,
      templatePattern,
      { imageMetadata, pdfMetadata, officeMetadata },
      options
    );

    if (result.ok) {
      results.push(result.data);

      switch (result.data.status) {
        case 'ready':
          readyCount++;
          break;
        case 'warning':
          warningCount++;
          break;
        case 'error':
          errorCount++;
          break;
      }
    } else {
      // Convert error to result entry
      const originalName = file.extension
        ? `${file.name}.${file.extension}`
        : file.name;

      results.push({
        originalPath: file.path,
        originalName,
        proposedName: '',
        proposedPath: '',
        template: templatePattern,
        resolutions: [],
        hasEmptyPlaceholders: false,
        emptyPlaceholders: [],
        status: 'error',
        warnings: [],
        error: result.error.message,
      });
      errorCount++;
    }
  }

  return {
    template: templatePattern,
    totalFiles: files.length,
    results,
    readyCount,
    warningCount,
    errorCount,
  };
}

/**
 * Format a single preview result for display.
 *
 * @param result - The preview result to format
 * @returns Formatted string for console/UI display
 */
export function formatPreviewResult(result: FilePreviewResult): string {
  const lines: string[] = [];

  // Status indicator
  const statusIcon =
    result.status === 'ready'
      ? '[OK]'
      : result.status === 'warning'
        ? '[WARN]'
        : '[ERR]';

  lines.push(`${statusIcon} ${result.originalName} -> ${result.proposedName || '(error)'}`);

  // Show resolution details
  if (result.resolutions.length > 0) {
    lines.push('  Placeholders:');
    for (const res of result.resolutions) {
      const sourceLabel =
        res.source === 'exif'
          ? 'EXIF'
          : res.source === 'document'
            ? 'Document'
            : res.source === 'filesystem'
              ? 'File'
              : res.source === 'fallback'
                ? 'Fallback'
                : 'Literal';
      const value = res.isEmpty ? '(empty)' : `"${res.value}"`;
      lines.push(`    {${res.placeholder}}: ${value} [${sourceLabel}]`);
    }
  }

  // Show warnings
  if (result.warnings.length > 0) {
    lines.push('  Warnings:');
    for (const warning of result.warnings) {
      lines.push(`    - ${warning}`);
    }
  }

  // Show error
  if (result.error) {
    lines.push(`  Error: ${result.error}`);
  }

  return lines.join('\n');
}

/**
 * Format batch preview for display.
 *
 * @param batch - The batch preview result to format
 * @returns Formatted string with summary and all results
 */
export function formatBatchPreview(batch: BatchPreviewResult): string {
  const lines: string[] = [];

  lines.push(`Template: "${batch.template}"`);
  lines.push(
    `Files: ${String(batch.totalFiles)} (${String(batch.readyCount)} ready, ${String(batch.warningCount)} warnings, ${String(batch.errorCount)} errors)`
  );
  lines.push('');

  for (const result of batch.results) {
    lines.push(formatPreviewResult(result));
    lines.push('');
  }

  return lines.join('\n');
}
