/**
 * @fileoverview Folder structure manager - CRUD operations - Story 8.1
 *
 * Provides functions to create, read, update, delete, and reorder folder structures.
 * All operations return Result<T, E> types following project conventions.
 */

import { randomUUID } from 'node:crypto';
import { ok, err } from '../types/result.js';
import type { Result } from '../types/result.js';
import type {
  FolderStructure,
  CreateFolderStructureInput,
  UpdateFolderStructureInput,
  FolderStructureError,
} from '../types/folder-structure.js';
import {
  createFolderStructureInputSchema,
  updateFolderStructureInputSchema,
  FolderStructureErrorCode,
  createFolderStructureError,
} from '../types/folder-structure.js';
import { validateFolderPattern } from './folder-pattern.js';

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Generate the next priority value (highest + 10).
 */
function getNextPriority(structures: FolderStructure[]): number {
  if (structures.length === 0) {
    return 10;
  }
  const maxPriority = Math.max(...structures.map((s) => s.priority));
  return maxPriority + 10;
}

/**
 * Check if a name is already used by another structure.
 */
function isNameDuplicate(
  structures: FolderStructure[],
  name: string,
  excludeId?: string
): boolean {
  return structures.some(
    (s) => s.name.toLowerCase() === name.toLowerCase() && s.id !== excludeId
  );
}

// =============================================================================
// Create Operations (AC3)
// =============================================================================

/**
 * Create a new folder structure.
 *
 * @param structures - The current array of folder structures
 * @param input - Structure creation input
 * @returns Result with updated structures array and created structure, or error
 *
 * @example
 * ```typescript
 * const result = createFolderStructure(structures, {
 *   name: 'By Year and Month',
 *   pattern: '{year}/{month}',
 *   description: 'Organize files by date',
 * });
 * if (result.ok) {
 *   const [updatedStructures, newStructure] = result.data;
 * }
 * ```
 */
export function createFolderStructure(
  structures: FolderStructure[],
  input: CreateFolderStructureInput
): Result<[FolderStructure[], FolderStructure], FolderStructureError> {
  // Validate input schema
  const parseResult = createFolderStructureInputSchema.safeParse(input);
  if (!parseResult.success) {
    const issues = parseResult.error.issues;
    const messages = issues.map((e) => e.message).join(', ');
    return err(
      createFolderStructureError(
        FolderStructureErrorCode.INVALID_INPUT,
        `Invalid input: ${messages || 'Validation failed'}`,
        parseResult.error
      )
    );
  }

  const validInput = parseResult.data;

  // Check for duplicate name
  if (isNameDuplicate(structures, validInput.name)) {
    return err(
      createFolderStructureError(
        FolderStructureErrorCode.DUPLICATE_NAME,
        `A folder structure with name "${validInput.name}" already exists`
      )
    );
  }

  // Validate pattern
  const patternValidation = validateFolderPattern(validInput.pattern);
  if (!patternValidation.valid) {
    return err(
      createFolderStructureError(
        FolderStructureErrorCode.INVALID_PATTERN,
        `Invalid pattern: ${patternValidation.errors.join(', ')}`,
        { errors: patternValidation.errors, warnings: patternValidation.warnings }
      )
    );
  }

  // Create new structure
  const now = new Date();
  const newStructure: FolderStructure = {
    id: randomUUID(),
    name: validInput.name,
    pattern: patternValidation.normalizedPattern, // Use normalized pattern
    description: validInput.description,
    enabled: validInput.enabled ?? true,
    priority: validInput.priority ?? getNextPriority(structures),
    createdAt: now,
    updatedAt: now,
  };

  return ok([[...structures, newStructure], newStructure]);
}

// =============================================================================
// Read Operations (AC5)
// =============================================================================

/**
 * Get a folder structure by ID.
 *
 * @param structures - The array of folder structures
 * @param id - The structure ID to find
 * @returns Result with the structure, or not_found error
 */
export function getFolderStructure(
  structures: FolderStructure[],
  id: string
): Result<FolderStructure, FolderStructureError> {
  const structure = structures.find((s) => s.id === id);
  if (!structure) {
    return err(
      createFolderStructureError(
        FolderStructureErrorCode.NOT_FOUND,
        `Folder structure with ID "${id}" not found`
      )
    );
  }
  return ok(structure);
}

/**
 * Get a folder structure by name (case-insensitive).
 *
 * @param structures - The array of folder structures
 * @param name - The structure name to find
 * @returns Result with the structure, or not_found error
 */
export function getFolderStructureByName(
  structures: FolderStructure[],
  name: string
): Result<FolderStructure, FolderStructureError> {
  const structure = structures.find((s) => s.name.toLowerCase() === name.toLowerCase());
  if (!structure) {
    return err(
      createFolderStructureError(
        FolderStructureErrorCode.NOT_FOUND,
        `Folder structure with name "${name}" not found`
      )
    );
  }
  return ok(structure);
}

/**
 * List all folder structures, sorted by priority.
 *
 * @param structures - The array of folder structures
 * @returns Sorted array of all structures (lower priority first)
 */
export function listFolderStructures(structures: FolderStructure[]): FolderStructure[] {
  return [...structures].sort((a, b) => a.priority - b.priority);
}

/**
 * List only enabled folder structures, sorted by priority.
 *
 * @param structures - The array of folder structures
 * @returns Sorted array of enabled structures
 */
export function listEnabledFolderStructures(
  structures: FolderStructure[]
): FolderStructure[] {
  return structures.filter((s) => s.enabled).sort((a, b) => a.priority - b.priority);
}

// =============================================================================
// Update Operations (AC5)
// =============================================================================

/**
 * Update an existing folder structure.
 *
 * @param structures - The current array of folder structures
 * @param id - The ID of the structure to update
 * @param updates - Partial updates to apply
 * @returns Result with updated structures array and updated structure, or error
 */
export function updateFolderStructure(
  structures: FolderStructure[],
  id: string,
  updates: UpdateFolderStructureInput
): Result<[FolderStructure[], FolderStructure], FolderStructureError> {
  // Find existing structure
  const index = structures.findIndex((s) => s.id === id);
  if (index === -1) {
    return err(
      createFolderStructureError(
        FolderStructureErrorCode.NOT_FOUND,
        `Folder structure with ID "${id}" not found`
      )
    );
  }

  // Validate update input
  const parseResult = updateFolderStructureInputSchema.safeParse(updates);
  if (!parseResult.success) {
    const issues = parseResult.error.issues;
    const messages = issues.map((e) => e.message).join(', ');
    return err(
      createFolderStructureError(
        FolderStructureErrorCode.INVALID_INPUT,
        `Invalid input: ${messages || 'Validation failed'}`,
        parseResult.error
      )
    );
  }

  const validUpdates = parseResult.data;

  // Check for duplicate name if name is being updated
  if (validUpdates.name && isNameDuplicate(structures, validUpdates.name, id)) {
    return err(
      createFolderStructureError(
        FolderStructureErrorCode.DUPLICATE_NAME,
        `A folder structure with name "${validUpdates.name}" already exists`
      )
    );
  }

  // Validate pattern if being updated
  let normalizedPattern: string | undefined;
  if (validUpdates.pattern) {
    const patternValidation = validateFolderPattern(validUpdates.pattern);
    if (!patternValidation.valid) {
      return err(
        createFolderStructureError(
          FolderStructureErrorCode.INVALID_PATTERN,
          `Invalid pattern: ${patternValidation.errors.join(', ')}`,
          { errors: patternValidation.errors, warnings: patternValidation.warnings }
        )
      );
    }
    normalizedPattern = patternValidation.normalizedPattern;
  }

  // Apply updates
  const existingStructure = structures[index]!;
  const updatedStructure: FolderStructure = {
    ...existingStructure,
    ...(validUpdates.name !== undefined && { name: validUpdates.name }),
    ...(normalizedPattern !== undefined && { pattern: normalizedPattern }),
    ...(validUpdates.description !== undefined && { description: validUpdates.description }),
    ...(validUpdates.enabled !== undefined && { enabled: validUpdates.enabled }),
    ...(validUpdates.priority !== undefined && { priority: validUpdates.priority }),
    updatedAt: new Date(),
  };

  const updatedStructures = [...structures];
  updatedStructures[index] = updatedStructure;

  return ok([updatedStructures, updatedStructure]);
}

// =============================================================================
// Delete Operations (AC5)
// =============================================================================

/**
 * Delete a folder structure by ID.
 *
 * @param structures - The current array of folder structures
 * @param id - The ID of the structure to delete
 * @returns Result with updated structures array, or error
 */
export function deleteFolderStructure(
  structures: FolderStructure[],
  id: string
): Result<FolderStructure[], FolderStructureError> {
  const index = structures.findIndex((s) => s.id === id);
  if (index === -1) {
    return err(
      createFolderStructureError(
        FolderStructureErrorCode.NOT_FOUND,
        `Folder structure with ID "${id}" not found`
      )
    );
  }

  const updatedStructures = structures.filter((s) => s.id !== id);
  return ok(updatedStructures);
}

// =============================================================================
// Enable/Disable Operations (AC4)
// =============================================================================

/**
 * Toggle the enabled state of a folder structure.
 *
 * @param structures - The current array of folder structures
 * @param id - The ID of the structure to toggle
 * @returns Result with updated structures array and updated structure, or error
 */
export function toggleFolderStructureEnabled(
  structures: FolderStructure[],
  id: string
): Result<[FolderStructure[], FolderStructure], FolderStructureError> {
  const index = structures.findIndex((s) => s.id === id);
  if (index === -1) {
    return err(
      createFolderStructureError(
        FolderStructureErrorCode.NOT_FOUND,
        `Folder structure with ID "${id}" not found`
      )
    );
  }

  const existingStructure = structures[index]!;
  const updatedStructure: FolderStructure = {
    ...existingStructure,
    enabled: !existingStructure.enabled,
    updatedAt: new Date(),
  };

  const updatedStructures = [...structures];
  updatedStructures[index] = updatedStructure;

  return ok([updatedStructures, updatedStructure]);
}

// =============================================================================
// Priority/Ordering Operations (AC4)
// =============================================================================

/**
 * Set the priority of a folder structure.
 *
 * @param structures - The current array of folder structures
 * @param id - The ID of the structure to update
 * @param newPriority - The new priority value
 * @returns Result with updated structures array, or error
 */
export function setFolderStructurePriority(
  structures: FolderStructure[],
  id: string,
  newPriority: number
): Result<FolderStructure[], FolderStructureError> {
  if (newPriority < 0 || !Number.isInteger(newPriority)) {
    return err(
      createFolderStructureError(
        FolderStructureErrorCode.INVALID_INPUT,
        'Priority must be a non-negative integer'
      )
    );
  }

  const index = structures.findIndex((s) => s.id === id);
  if (index === -1) {
    return err(
      createFolderStructureError(
        FolderStructureErrorCode.NOT_FOUND,
        `Folder structure with ID "${id}" not found`
      )
    );
  }

  const existingStructure = structures[index]!;
  const updatedStructure: FolderStructure = {
    ...existingStructure,
    priority: newPriority,
    updatedAt: new Date(),
  };

  const updatedStructures = [...structures];
  updatedStructures[index] = updatedStructure;

  return ok(updatedStructures);
}

/**
 * Reorder folder structures by providing an array of IDs in the desired order.
 * Priority values will be reassigned (10, 20, 30, ...).
 *
 * @param structures - The current array of folder structures
 * @param orderedIds - Array of structure IDs in desired order
 * @returns Result with reordered structures array, or error
 */
export function reorderFolderStructures(
  structures: FolderStructure[],
  orderedIds: string[]
): Result<FolderStructure[], FolderStructureError> {
  // Validate all IDs exist
  const existingIds = new Set(structures.map((s) => s.id));
  const missingIds = orderedIds.filter((id) => !existingIds.has(id));

  if (missingIds.length > 0) {
    return err(
      createFolderStructureError(
        FolderStructureErrorCode.NOT_FOUND,
        `Folder structures not found: ${missingIds.join(', ')}`
      )
    );
  }

  // Validate no duplicate IDs
  const uniqueIds = new Set(orderedIds);
  if (uniqueIds.size !== orderedIds.length) {
    return err(
      createFolderStructureError(
        FolderStructureErrorCode.INVALID_INPUT,
        'Duplicate IDs in ordered list'
      )
    );
  }

  // Create a map of structures by ID
  const structureMap = new Map(structures.map((s) => [s.id, s]));

  // Build reordered array with new priorities
  const now = new Date();
  const reordered: FolderStructure[] = orderedIds.map((id, index) => {
    const structure = structureMap.get(id)!;
    return {
      ...structure,
      priority: (index + 1) * 10,
      updatedAt: now,
    };
  });

  // Add any structures not in the ordered list at the end
  const orderedIdSet = new Set(orderedIds);
  const remaining = structures
    .filter((s) => !orderedIdSet.has(s.id))
    .map((s, index) => ({
      ...s,
      priority: (orderedIds.length + index + 1) * 10,
      updatedAt: now,
    }));

  return ok([...reordered, ...remaining]);
}
