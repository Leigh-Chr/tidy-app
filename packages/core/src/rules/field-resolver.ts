/**
 * @fileoverview Field path resolver for rule evaluation - Story 7.1
 *
 * Resolves field paths (e.g., "image.cameraMake", "pdf.author") to actual values
 * from UnifiedMetadata objects.
 */

import type { UnifiedMetadata } from '../types/unified-metadata.js';
import type { FileInfo } from '../types/file-info.js';
import type { ImageMetadata } from '../types/image-metadata.js';
import type { PDFMetadata } from '../types/pdf-metadata.js';
import type { OfficeMetadata } from '../types/office-metadata.js';
import { parseFieldPath, type FieldNamespaceType } from '../types/rule.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Result of resolving a field path.
 */
export interface FieldResolutionResult {
  /** Whether the field was found (path is valid and value exists) */
  found: boolean;
  /** The resolved value (string representation) */
  value: string | null;
  /** Original value type for debugging */
  originalType: 'string' | 'number' | 'boolean' | 'date' | 'object' | 'null' | 'undefined';
}

// =============================================================================
// Value Conversion
// =============================================================================

/**
 * Convert a value to a string for comparison.
 * Handles dates, numbers, booleans, and objects.
 */
function valueToString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number') {
    return value.toString();
  }

  if (typeof value === 'boolean') {
    return value.toString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'object') {
    // For objects like GPS coordinates, return JSON string
    return JSON.stringify(value);
  }

  return String(value);
}

/**
 * Get the type of a value for debugging.
 */
function getValueType(value: unknown): FieldResolutionResult['originalType'] {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (value instanceof Date) return 'date';
  if (typeof value === 'object') return 'object';
  return typeof value as 'string' | 'number' | 'boolean';
}

// =============================================================================
// Namespace Resolvers
// =============================================================================

/**
 * Resolve a path within the image namespace.
 */
function resolveImagePath(metadata: ImageMetadata | null, path: string[]): unknown {
  if (!metadata) return undefined;

  const [field, ...rest] = path;

  // Handle nested paths (e.g., gps.latitude)
  if (field === 'gps' && rest.length > 0) {
    if (!metadata.gps) return undefined;
    const gpsField = rest[0];
    if (gpsField === 'latitude') return metadata.gps.latitude;
    if (gpsField === 'longitude') return metadata.gps.longitude;
    return undefined;
  }

  // Direct field access
  switch (field) {
    case 'dateTaken':
      return metadata.dateTaken;
    case 'cameraMake':
      return metadata.cameraMake;
    case 'cameraModel':
      return metadata.cameraModel;
    case 'gps':
      return metadata.gps;
    case 'width':
      return metadata.width;
    case 'height':
      return metadata.height;
    case 'orientation':
      return metadata.orientation;
    case 'exposureTime':
      return metadata.exposureTime;
    case 'fNumber':
      return metadata.fNumber;
    case 'iso':
      return metadata.iso;
    // Aliases for convenience
    case 'camera':
      // Combined camera make + model
      if (metadata.cameraMake && metadata.cameraModel) {
        return `${metadata.cameraMake} ${metadata.cameraModel}`;
      }
      return metadata.cameraMake || metadata.cameraModel || null;
    case 'make':
      return metadata.cameraMake;
    case 'model':
      return metadata.cameraModel;
    default:
      return undefined;
  }
}

/**
 * Resolve a path within the PDF namespace.
 */
function resolvePdfPath(metadata: PDFMetadata | null, path: string[]): unknown {
  if (!metadata) return undefined;

  const [field] = path;

  switch (field) {
    case 'title':
      return metadata.title;
    case 'author':
      return metadata.author;
    case 'subject':
      return metadata.subject;
    case 'keywords':
      return metadata.keywords;
    case 'creator':
      return metadata.creator;
    case 'producer':
      return metadata.producer;
    case 'creationDate':
      return metadata.creationDate;
    case 'modificationDate':
      return metadata.modificationDate;
    case 'pageCount':
      return metadata.pageCount;
    default:
      return undefined;
  }
}

/**
 * Resolve a path within the Office namespace.
 */
function resolveOfficePath(metadata: OfficeMetadata | null, path: string[]): unknown {
  if (!metadata) return undefined;

  const [field] = path;

  switch (field) {
    case 'title':
      return metadata.title;
    case 'subject':
      return metadata.subject;
    case 'creator':
      return metadata.creator;
    case 'author':
      // Alias for creator
      return metadata.creator;
    case 'keywords':
      return metadata.keywords;
    case 'description':
      return metadata.description;
    case 'lastModifiedBy':
      return metadata.lastModifiedBy;
    case 'created':
      return metadata.created;
    case 'modified':
      return metadata.modified;
    case 'revision':
      return metadata.revision;
    case 'category':
      return metadata.category;
    case 'application':
      return metadata.application;
    case 'appVersion':
      return metadata.appVersion;
    case 'pageCount':
      return metadata.pageCount;
    case 'wordCount':
      return metadata.wordCount;
    default:
      return undefined;
  }
}

/**
 * Resolve a path within the file namespace.
 */
function resolveFilePath(fileInfo: FileInfo, path: string[]): unknown {
  const [field] = path;

  switch (field) {
    case 'path':
      return fileInfo.path;
    case 'name':
      return fileInfo.name;
    case 'extension':
      return fileInfo.extension;
    case 'fullName':
      return fileInfo.fullName;
    case 'size':
      return fileInfo.size;
    case 'createdAt':
      return fileInfo.createdAt;
    case 'modifiedAt':
      return fileInfo.modifiedAt;
    case 'relativePath':
      return fileInfo.relativePath;
    case 'mimeType':
      return fileInfo.mimeType;
    case 'category':
      return fileInfo.category;
    case 'metadataSupported':
      return fileInfo.metadataSupported;
    case 'metadataCapability':
      return fileInfo.metadataCapability;
    default:
      return undefined;
  }
}

// =============================================================================
// Main Resolver
// =============================================================================

/**
 * Resolve a field path to a value from UnifiedMetadata.
 *
 * @param fieldPath - The field path (e.g., "image.cameraMake", "pdf.author")
 * @param metadata - The unified metadata object
 * @returns Resolution result with found status and value
 *
 * @example
 * ```ts
 * const result = resolveFieldPath('image.cameraMake', metadata);
 * if (result.found) {
 *   console.log(result.value); // "Apple"
 * }
 * ```
 */
export function resolveFieldPath(
  fieldPath: string,
  metadata: UnifiedMetadata
): FieldResolutionResult {
  const { namespace, path } = parseFieldPath(fieldPath);

  // Invalid path format
  if (namespace === null || path.length === 0) {
    return {
      found: false,
      value: null,
      originalType: 'undefined',
    };
  }

  let rawValue: unknown;

  // Resolve based on namespace
  switch (namespace as FieldNamespaceType) {
    case 'image':
      rawValue = resolveImagePath(metadata.image, path);
      break;
    case 'pdf':
      rawValue = resolvePdfPath(metadata.pdf, path);
      break;
    case 'office':
      rawValue = resolveOfficePath(metadata.office, path);
      break;
    case 'file':
      rawValue = resolveFilePath(metadata.file, path);
      break;
    default:
      return {
        found: false,
        value: null,
        originalType: 'undefined',
      };
  }

  // Convert value to string
  const stringValue = valueToString(rawValue);
  const originalType = getValueType(rawValue);

  return {
    found: rawValue !== undefined && rawValue !== null,
    value: stringValue,
    originalType,
  };
}

/**
 * Check if a field exists and has a non-null value.
 *
 * @param fieldPath - The field path to check
 * @param metadata - The unified metadata object
 * @returns true if the field exists and has a value
 */
export function fieldExists(fieldPath: string, metadata: UnifiedMetadata): boolean {
  const result = resolveFieldPath(fieldPath, metadata);
  return result.found;
}

/**
 * Get multiple field values at once.
 * Useful for debugging or displaying all resolved values.
 *
 * @param fieldPaths - Array of field paths
 * @param metadata - The unified metadata object
 * @returns Map of field path to resolution result
 */
export function resolveMultipleFields(
  fieldPaths: string[],
  metadata: UnifiedMetadata
): Map<string, FieldResolutionResult> {
  const results = new Map<string, FieldResolutionResult>();

  for (const fieldPath of fieldPaths) {
    results.set(fieldPath, resolveFieldPath(fieldPath, metadata));
  }

  return results;
}
