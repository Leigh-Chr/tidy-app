/**
 * @fileoverview Organize module exports - Story 8.1, 8.2, 8.3
 *
 * Provides folder structure management and file organization capabilities:
 * - Folder pattern validation and normalization
 * - Folder structure CRUD operations
 * - Folder path resolution from patterns (Story 8.2)
 * - Preview formatting and filtering (Story 8.3)
 */

// Folder pattern validation
export {
  validateFolderPattern,
  isValidFolderPattern,
  normalizeFolderPattern,
  extractFolderPlaceholders,
  VALID_FOLDER_PLACEHOLDERS,
} from './folder-pattern.js';

// Folder structure management (Story 8.1, Task 3)
export {
  createFolderStructure,
  getFolderStructure,
  getFolderStructureByName,
  updateFolderStructure,
  deleteFolderStructure,
  listFolderStructures,
  listEnabledFolderStructures,
  toggleFolderStructureEnabled,
  setFolderStructurePriority,
  reorderFolderStructures,
} from './folder-structure-manager.js';

// Folder path resolution (Story 8.2)
export {
  resolveFolderPath,
  type ResolveFolderPathOptions,
  type FolderPathResolution,
  type FolderResolutionError,
} from './folder-resolver.js';

// Preview formatting and filtering (Story 8.3)
export {
  formatMovePreview,
  formatSourceToDestination,
  getFolderStructureName,
  filterPreviewByOperationType,
  analyzeDestinationFolders,
  type MovePreviewDisplay,
  type PreviewFilterType,
  type DestinationFolderAnalysis,
} from './preview-formatter.js';
