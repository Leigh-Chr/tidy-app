/**
 * @fileoverview Preview formatting and filtering utilities - Story 8.3
 *
 * Provides functions for formatting and filtering rename proposals
 * to display move operation previews to users.
 */

import { dirname } from 'node:path';
import { stat } from 'node:fs/promises';
import { ok, err, type Result } from '../types/result.js';
import type { RenameProposal } from '../types/rename-proposal.js';
import type { FolderStructure } from '../types/folder-structure.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Display information for a move operation preview.
 */
export interface MovePreviewDisplay {
  /** Original file path */
  sourcePath: string;
  /** Destination file path */
  destinationPath: string;
  /** Original filename */
  sourceFilename: string;
  /** Proposed filename (may be same as source) */
  destinationFilename: string;
  /** Whether this is a move (true) or rename-only (false) */
  isMoveOperation: boolean;
  /** Name of the folder structure applied (if any) */
  folderStructureName?: string;
  /** Formatted display: "source → destination" */
  formatted: string;
}

/**
 * Filter type for preview operations.
 */
export type PreviewFilterType = 'all' | 'move' | 'rename';

/**
 * Analysis of destination folders for move operations.
 */
export interface DestinationFolderAnalysis {
  /** Unique destination folders that already exist */
  existingFolders: string[];
  /** Unique destination folders that need to be created */
  newFolders: string[];
  /** Total unique destination folders */
  totalFolders: number;
}

// =============================================================================
// Formatting Functions
// =============================================================================

/**
 * Format source and destination paths with an arrow separator.
 *
 * @param sourcePath - The original file path
 * @param destinationPath - The proposed destination path
 * @returns Formatted string: "source → destination"
 *
 * @example
 * ```typescript
 * formatSourceToDestination('/photos/IMG_001.jpg', '/organized/2026/01/photo.jpg')
 * // Returns: '/photos/IMG_001.jpg → /organized/2026/01/photo.jpg'
 * ```
 */
export function formatSourceToDestination(sourcePath: string, destinationPath: string): string {
  return `${sourcePath} → ${destinationPath}`;
}

/**
 * Get the name of a folder structure by its ID.
 *
 * @param id - The folder structure ID to look up
 * @param structures - Array of available folder structures
 * @returns The folder structure name, or undefined if not found
 *
 * @example
 * ```typescript
 * const name = getFolderStructureName('fs-1', folderStructures);
 * // Returns: 'By Year/Month' or undefined
 * ```
 */
export function getFolderStructureName(
  id: string,
  structures: FolderStructure[]
): string | undefined {
  if (!id) return undefined;
  const structure = structures.find((s) => s.id === id);
  return structure?.name;
}

/**
 * Format a rename proposal into a move preview display object.
 *
 * Provides all the information needed to display a file movement
 * or rename operation in the UI.
 *
 * @param proposal - The rename proposal to format
 * @param folderStructures - Available folder structures for name lookup
 * @returns MovePreviewDisplay with all formatting information
 *
 * @example
 * ```typescript
 * const display = formatMovePreview(proposal, folderStructures);
 * console.log(display.formatted);
 * // '/photos/IMG_001.jpg → /organized/2026/01/photo.jpg'
 * console.log(display.folderStructureName);
 * // 'By Year/Month'
 * ```
 */
export function formatMovePreview(
  proposal: RenameProposal,
  folderStructures: FolderStructure[]
): MovePreviewDisplay {
  const isMoveOperation = proposal.isMoveOperation === true;

  let folderStructureName: string | undefined;
  if (proposal.folderStructureId) {
    folderStructureName = getFolderStructureName(proposal.folderStructureId, folderStructures);
  }

  return {
    sourcePath: proposal.originalPath,
    destinationPath: proposal.proposedPath,
    sourceFilename: proposal.originalName,
    destinationFilename: proposal.proposedName,
    isMoveOperation,
    folderStructureName,
    formatted: formatSourceToDestination(proposal.originalPath, proposal.proposedPath),
  };
}

// =============================================================================
// Filtering Functions
// =============================================================================

/**
 * Filter rename proposals by operation type.
 *
 * @param proposals - Array of rename proposals to filter
 * @param filterType - Type of operations to include: 'all', 'move', or 'rename'
 * @returns Filtered array of proposals (new array, not mutated)
 *
 * @example
 * ```typescript
 * // Get only move operations
 * const moves = filterPreviewByOperationType(proposals, 'move');
 *
 * // Get only rename-in-place operations
 * const renames = filterPreviewByOperationType(proposals, 'rename');
 *
 * // Get all operations (returns a copy)
 * const all = filterPreviewByOperationType(proposals, 'all');
 * ```
 */
export function filterPreviewByOperationType(
  proposals: RenameProposal[],
  filterType: PreviewFilterType
): RenameProposal[] {
  switch (filterType) {
    case 'move':
      return proposals.filter((p) => p.isMoveOperation === true);
    case 'rename':
      return proposals.filter((p) => p.isMoveOperation !== true);
    case 'all':
    default:
      return [...proposals];
  }
}

// =============================================================================
// Folder Analysis Functions
// =============================================================================

/**
 * Check if a directory exists on the filesystem.
 * Returns true only if the path exists AND is a directory.
 */
async function directoryExists(path: string): Promise<{ exists: boolean; error?: Error }> {
  try {
    const stats = await stat(path);
    return { exists: stats.isDirectory() };
  } catch (error) {
    // ENOENT = path doesn't exist - this is expected
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { exists: false };
    }
    // Other errors (EPERM, EACCES, etc.) should be reported
    return { exists: false, error: error as Error };
  }
}

/**
 * Analyze destination folders from rename proposals.
 *
 * Extracts unique destination directories from move operations and
 * checks the filesystem to determine which folders exist vs need creation.
 *
 * @param proposals - Array of rename proposals to analyze
 * @param baseDirectory - Optional base directory to resolve relative paths against
 * @returns Result with folder analysis or error (e.g., permission denied)
 *
 * @example
 * ```typescript
 * const result = await analyzeDestinationFolders(proposals);
 * if (result.ok) {
 *   console.log(`New folders to create: ${result.data.newFolders.join(', ')}`);
 *   console.log(`Existing folders: ${result.data.existingFolders.join(', ')}`);
 * }
 * ```
 */
export async function analyzeDestinationFolders(
  proposals: RenameProposal[],
  _baseDirectory?: string // Reserved for future use - path resolution relative to base
): Promise<Result<DestinationFolderAnalysis, Error>> {
  // Filter to only move operations
  const moveProposals = proposals.filter((p) => p.isMoveOperation === true);

  // Extract unique destination directories
  const uniqueFolders = new Set<string>();
  for (const proposal of moveProposals) {
    const folder = dirname(proposal.proposedPath);
    uniqueFolders.add(folder);
  }

  // Check which folders exist
  const existingFolders: string[] = [];
  const newFolders: string[] = [];
  const errors: Error[] = [];

  for (const folder of uniqueFolders) {
    const result = await directoryExists(folder);
    if (result.error) {
      // Collect filesystem errors (permission denied, etc.)
      errors.push(result.error);
    } else if (result.exists) {
      existingFolders.push(folder);
    } else {
      newFolders.push(folder);
    }
  }

  // If any filesystem errors occurred, return error result
  if (errors.length > 0) {
    const errorMessages = errors.map((e) => e.message).join('; ');
    return err(new Error(`Failed to analyze some folders: ${errorMessages}`));
  }

  // Sort for deterministic output
  existingFolders.sort();
  newFolders.sort();

  return ok({
    existingFolders,
    newFolders,
    totalFolders: uniqueFolders.size,
  });
}
