/**
 * @fileoverview Folder structure type definitions - Story 8.1
 *
 * Defines schemas and types for folder structures that organize files
 * into directory hierarchies based on patterns using placeholders.
 */

import { z } from 'zod';

// =============================================================================
// Folder Structure Types (AC2: type definition with id, name, pattern, etc.)
// =============================================================================

/**
 * Zod schema for folder structure.
 * Folder structures define how files are organized into directories.
 */
export const folderStructureSchema = z.object({
  /** Unique identifier */
  id: z.string().min(1),
  /** Human-readable name */
  name: z.string().min(1),
  /** Folder pattern using placeholders (e.g., "{year}/{month}") */
  pattern: z.string().min(1),
  /** Optional description */
  description: z.string().optional(),
  /** Whether this structure is active */
  enabled: z.boolean(),
  /** Priority for conflict resolution (lower = higher priority) */
  priority: z.number().int().min(0),
  /** Creation timestamp */
  createdAt: z.coerce.date(),
  /** Last modification timestamp */
  updatedAt: z.coerce.date(),
});

/**
 * A folder structure definition for organizing files.
 */
export type FolderStructure = z.infer<typeof folderStructureSchema>;

// =============================================================================
// Create Input (AC3: create folder structure)
// =============================================================================

/**
 * Zod schema for creating a new folder structure.
 */
export const createFolderStructureInputSchema = z.object({
  /** Human-readable name (required) */
  name: z.string().min(1, 'Name is required'),
  /** Folder pattern using placeholders (required) */
  pattern: z.string().min(1, 'Pattern is required'),
  /** Optional description */
  description: z.string().optional(),
  /** Whether this structure is active (defaults to true) */
  enabled: z.boolean().optional().default(true),
  /** Priority for conflict resolution (optional, auto-assigned if not provided) */
  priority: z.number().int().min(0).optional(),
});

/**
 * Input for creating a new folder structure.
 */
export type CreateFolderStructureInput = z.infer<typeof createFolderStructureInputSchema>;

// =============================================================================
// Update Input (AC5: CRUD operations - update)
// =============================================================================

/**
 * Zod schema for updating an existing folder structure.
 * All fields are optional - only provided fields are updated.
 */
export const updateFolderStructureInputSchema = z.object({
  /** Human-readable name */
  name: z.string().min(1).optional(),
  /** Folder pattern using placeholders */
  pattern: z.string().min(1).optional(),
  /** Optional description */
  description: z.string().optional(),
  /** Whether this structure is active */
  enabled: z.boolean().optional(),
  /** Priority for conflict resolution */
  priority: z.number().int().min(0).optional(),
});

/**
 * Input for updating an existing folder structure.
 */
export type UpdateFolderStructureInput = z.infer<typeof updateFolderStructureInputSchema>;

// =============================================================================
// Error Types (AC5: Result<T> pattern)
// =============================================================================

/**
 * Error codes for folder structure operations.
 */
export const FolderStructureErrorCode = {
  /** Structure with given ID not found */
  NOT_FOUND: 'not_found',
  /** Structure with same name already exists */
  DUPLICATE_NAME: 'duplicate_name',
  /** Pattern syntax is invalid */
  INVALID_PATTERN: 'invalid_pattern',
  /** Input validation failed */
  INVALID_INPUT: 'invalid_input',
} as const;

export type FolderStructureErrorCodeType =
  (typeof FolderStructureErrorCode)[keyof typeof FolderStructureErrorCode];

/**
 * Error type for folder structure operations.
 */
export interface FolderStructureError {
  type: FolderStructureErrorCodeType;
  message: string;
  details?: unknown;
}

/**
 * Creates a typed FolderStructureError.
 *
 * @param type - The error code
 * @param message - Human-readable error message
 * @param details - Optional additional details
 * @returns FolderStructureError object
 */
export function createFolderStructureError(
  type: FolderStructureErrorCodeType,
  message: string,
  details?: unknown
): FolderStructureError {
  return { type, message, details };
}

// =============================================================================
// Validation Result Types (AC6: folder structure validation)
// =============================================================================

/**
 * Result of validating a folder pattern.
 */
export interface FolderPatternValidationResult {
  /** Whether the pattern is valid */
  valid: boolean;
  /** Validation error messages (empty if valid) */
  errors: string[];
  /** Warning messages (pattern is valid but may have issues) */
  warnings: string[];
  /** Placeholders found in the pattern */
  placeholders: string[];
  /** Normalized pattern (path separators standardized) */
  normalizedPattern: string;
}

/**
 * Zod schema for folder pattern validation result.
 */
export const folderPatternValidationResultSchema = z.object({
  valid: z.boolean(),
  errors: z.array(z.string()),
  warnings: z.array(z.string()),
  placeholders: z.array(z.string()),
  normalizedPattern: z.string(),
});
