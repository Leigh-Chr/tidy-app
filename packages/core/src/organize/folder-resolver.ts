/**
 * @fileoverview Folder path resolution - Story 8.2, Task 3
 *
 * Resolves folder structure patterns using the same placeholder system as naming templates.
 * This module integrates with the existing template resolution system to provide
 * consistent placeholder handling for both filenames and folder paths.
 */

import { ok, err, type Result } from '../types/result.js';
import type { FileInfo } from '../types/file-info.js';
import type { UnifiedMetadata } from '../types/unified-metadata.js';
import type { PlaceholderContext } from '../types/template.js';
import { parseTemplate } from '../templates/parser.js';
import {
  resolveDatePlaceholder,
  isDatePlaceholder,
} from '../templates/resolvers/date-resolver.js';
import {
  resolveMetadataPlaceholder,
  isMetadataPlaceholder,
} from '../templates/resolvers/metadata-resolver.js';
import {
  resolveFilePlaceholder,
  isFilePlaceholder,
} from '../templates/resolvers/file-resolver.js';
import { normalizeFolderPattern, validateFolderPattern } from './folder-pattern.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Options for resolving a folder path from a pattern.
 */
export interface ResolveFolderPathOptions {
  /** Fallback values for missing placeholders */
  fallbacks?: Record<string, string>;
  /** Base directory for the resolved path (not included in resolvedPath, used later) */
  baseDirectory?: string;
}

/**
 * Result of folder path resolution.
 */
export interface FolderPathResolution {
  /** The resolved folder path (relative) */
  resolvedPath: string;
  /** Placeholders that were resolved */
  resolvedPlaceholders: string[];
  /** Placeholders that could not be resolved */
  missingPlaceholders: string[];
  /** Whether fallbacks were used */
  usedFallbacks: boolean;
}

/**
 * Error for folder resolution failures.
 */
export interface FolderResolutionError {
  type: 'missing_metadata' | 'invalid_pattern' | 'resolution_failed';
  message: string;
  missingFields?: string[];
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Build PlaceholderContext from UnifiedMetadata.
 */
function buildPlaceholderContext(metadata: UnifiedMetadata, file: FileInfo): PlaceholderContext {
  return {
    file,
    imageMetadata: metadata.image,
    pdfMetadata: metadata.pdf,
    officeMetadata: metadata.office,
  };
}

/**
 * Resolve a single placeholder and return its value.
 * Returns null if the placeholder could not be resolved.
 */
function resolveSinglePlaceholder(
  placeholderName: string,
  context: PlaceholderContext,
  fallbacks: Record<string, string>
): { value: string | null; usedFallback: boolean } {
  const fallbackValue = fallbacks[placeholderName];

  // Date placeholders
  if (isDatePlaceholder(placeholderName)) {
    const result = resolveDatePlaceholder(placeholderName, context);
    if (result.value && result.value.trim() !== '') {
      return { value: result.value, usedFallback: false };
    }
  }

  // Metadata placeholders
  if (isMetadataPlaceholder(placeholderName)) {
    const result = resolveMetadataPlaceholder(placeholderName, context, {
      fallback: '',
      sanitizeForFilename: true,
    });
    if (result.value && result.value.trim() !== '' && result.source !== 'literal') {
      return { value: result.value.trim(), usedFallback: false };
    }
  }

  // File placeholders
  if (isFilePlaceholder(placeholderName)) {
    const result = resolveFilePlaceholder(placeholderName, context, {
      sanitizeForFilename: true,
    });
    if (result.value && result.value.trim() !== '') {
      return { value: result.value.trim(), usedFallback: false };
    }
  }

  // Try fallback
  if (fallbackValue !== undefined && fallbackValue.trim() !== '') {
    return { value: fallbackValue.trim(), usedFallback: true };
  }

  return { value: null, usedFallback: false };
}

/**
 * Sanitize a path segment to remove invalid characters.
 */
function sanitizePathSegment(segment: string): string {
  // Remove characters that are invalid in folder names (including control chars \x00-\x1f)
  return (
    segment
       
      .replace(/[<>:"|?*\x00-\x1f]/g, '')
      .trim()
  );
}

// =============================================================================
// Main Function
// =============================================================================

/**
 * Resolves a folder pattern to a concrete path using file metadata.
 *
 * Uses the same placeholder system as naming templates:
 * - Date placeholders: {year}, {month}, {day}
 * - Metadata placeholders: {author}, {title}, {cameraMake}, etc.
 * - File placeholders: {original}, {extension}, {category}
 *
 * @param pattern - The folder pattern (e.g., "{year}/{month}")
 * @param metadata - Unified metadata containing file, image, pdf, office metadata
 * @param file - File info for the file being organized
 * @param options - Resolution options (fallbacks, baseDirectory)
 * @returns Result with resolved path or error
 *
 * @example
 * ```typescript
 * const result = resolveFolderPath('{year}/{month}', metadata, file);
 * if (result.ok) {
 *   console.log(`Folder: ${result.data.resolvedPath}`); // "2026/01"
 * }
 * ```
 */
export function resolveFolderPath(
  pattern: string,
  metadata: UnifiedMetadata,
  file: FileInfo,
  options: ResolveFolderPathOptions = {}
): Result<FolderPathResolution, FolderResolutionError> {
  const fallbacks = options.fallbacks ?? {};

  // Validate the pattern
  const validation = validateFolderPattern(pattern);
  if (!validation.valid) {
    return err({
      type: 'invalid_pattern',
      message: validation.errors.join('; '),
    });
  }

  // Parse the normalized pattern to extract placeholders
  const normalizedPattern = validation.normalizedPattern;
  const parseResult = parseTemplate(normalizedPattern);
  if (!parseResult.ok) {
    return err({
      type: 'invalid_pattern',
      message: parseResult.error.message,
    });
  }

  const template = parseResult.data;
  const context = buildPlaceholderContext(metadata, file);

  // Resolve each placeholder
  const resolvedPlaceholders: string[] = [];
  const missingPlaceholders: string[] = [];
  let usedFallbacks = false;
  const resolutionMap = new Map<string, string>();

  for (const placeholder of template.placeholders) {
    const result = resolveSinglePlaceholder(placeholder, context, fallbacks);

    if (result.value !== null) {
      resolvedPlaceholders.push(placeholder);
      resolutionMap.set(placeholder, sanitizePathSegment(result.value));
      if (result.usedFallback) {
        usedFallbacks = true;
      }
    } else {
      missingPlaceholders.push(placeholder);
    }
  }

  // If any placeholders are missing, return error
  if (missingPlaceholders.length > 0) {
    return err({
      type: 'missing_metadata',
      message: `Missing required metadata: ${missingPlaceholders.join(', ')}`,
      missingFields: missingPlaceholders,
    });
  }

  // Build the resolved path from tokens
  let resolvedPath = template.tokens
    .map((token) => {
      if (token.type === 'literal') {
        return token.value;
      }
      return resolutionMap.get(token.name) ?? '';
    })
    .join('');

  // Normalize the resolved path
  resolvedPath = normalizeFolderPattern(resolvedPath);

  return ok({
    resolvedPath,
    resolvedPlaceholders,
    missingPlaceholders: [],
    usedFallbacks,
  });
}
