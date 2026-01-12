import { z } from 'zod';

/**
 * Reorganization mode determines how files are handled during rename operations.
 *
 * - 'rename-only': Files stay in their current locations, only names change (safest)
 * - 'organize': Files are moved to new locations based on folder patterns and destination
 */
export const ReorganizationMode = {
  /** Files stay in place, only names change (default, safest option) */
  RENAME_ONLY: 'rename-only',
  /** Files are moved to new structure based on folder pattern */
  ORGANIZE: 'organize',
} as const;

export type ReorganizationModeType =
  (typeof ReorganizationMode)[keyof typeof ReorganizationMode];

export const reorganizationModeSchema = z.enum(['rename-only', 'organize']);

/**
 * Options for the "organize" mode.
 * Only used when reorganizationMode is 'organize'.
 */
export const organizeOptionsSchema = z.object({
  /**
   * Base destination directory for organized files.
   * If not provided, uses the scanned folder as base.
   */
  destinationDirectory: z.string().optional(),

  /**
   * Folder pattern for organizing files (e.g., "{year}/{month}").
   * Applied relative to destinationDirectory.
   */
  folderPattern: z.string().min(1),

  /**
   * Whether to preserve the relative context from subfolders.
   * When true: /Photos/Vacation/img.jpg → /destination/Vacation/{year}/{month}/img.jpg
   * When false: /Photos/Vacation/img.jpg → /destination/{year}/{month}/img.jpg
   *
   * Default: false
   */
  preserveContext: z.boolean().default(false),

  /**
   * How many levels of parent folders to preserve when preserveContext is true.
   * 0 = preserve none (same as preserveContext: false)
   * 1 = preserve immediate parent folder
   * -1 = preserve all parent folders (from scan root)
   *
   * Default: 1
   */
  contextDepth: z.number().int().default(1),
});

export type OrganizeOptions = z.infer<typeof organizeOptionsSchema>;

/**
 * Complete reorganization settings for preview generation.
 */
export const reorganizationSettingsSchema = z.object({
  /**
   * The reorganization mode.
   * Default: 'rename-only' (safest - files stay in place)
   */
  mode: reorganizationModeSchema.default('rename-only'),

  /**
   * Options for organize mode.
   * Only used when mode is 'organize'.
   */
  organizeOptions: organizeOptionsSchema.optional(),
});

export type ReorganizationSettings = z.infer<typeof reorganizationSettingsSchema>;

/**
 * Action type for a file in the preview.
 * Used to clearly communicate what will happen to each file.
 */
export const FileActionType = {
  /** File will only be renamed (stays in same folder) */
  RENAME: 'rename',
  /** File will be moved to a different folder (may also be renamed) */
  MOVE: 'move',
  /** File will not change (name and location stay the same) */
  NO_CHANGE: 'no-change',
  /** File has a conflict and cannot be processed */
  CONFLICT: 'conflict',
  /** File has an error (invalid name, missing data, etc.) */
  ERROR: 'error',
} as const;

export type FileActionTypeValue =
  (typeof FileActionType)[keyof typeof FileActionType];

export const fileActionTypeSchema = z.enum([
  'rename',
  'move',
  'no-change',
  'conflict',
  'error',
]);

/**
 * Conflict information for a file.
 */
export const fileConflictSchema = z.object({
  /** The type of conflict */
  type: z.enum([
    'duplicate-name',      // Another file in batch has same proposed name
    'file-exists',         // A file already exists at proposed path
    'cross-conflict',      // File A wants to move to where File B is, and vice versa
  ]),
  /** Human-readable description */
  message: z.string(),
  /** ID of the conflicting file (for duplicate-name conflicts) */
  conflictingFileId: z.string().optional(),
  /** Path of the existing file (for file-exists conflicts) */
  existingFilePath: z.string().optional(),
});

export type FileConflict = z.infer<typeof fileConflictSchema>;

/**
 * Summary of preview actions by type.
 */
export const previewActionSummarySchema = z.object({
  /** Number of files that will only be renamed */
  renameCount: z.number().int().nonnegative(),
  /** Number of files that will be moved */
  moveCount: z.number().int().nonnegative(),
  /** Number of files with no changes */
  noChangeCount: z.number().int().nonnegative(),
  /** Number of files with conflicts */
  conflictCount: z.number().int().nonnegative(),
  /** Number of files with errors */
  errorCount: z.number().int().nonnegative(),
});

export type PreviewActionSummary = z.infer<typeof previewActionSummarySchema>;

/**
 * Information about folders that will be empty after the operation.
 */
export const emptyFolderInfoSchema = z.object({
  /** Path to the folder that will be empty */
  path: z.string(),
  /** Number of files being moved out of this folder */
  filesMovedOut: z.number().int().positive(),
});

export type EmptyFolderInfo = z.infer<typeof emptyFolderInfoSchema>;

/**
 * Conflict resolution strategy.
 */
export const ConflictResolution = {
  /** Add a numeric suffix (photo.jpg → photo-2.jpg) */
  ADD_SUFFIX: 'add-suffix',
  /** Add source folder name (photo.jpg → photo-from-vacation.jpg) */
  ADD_SOURCE: 'add-source',
  /** Skip the conflicting file */
  SKIP: 'skip',
  /** Ask user for each conflict (UI will prompt) */
  ASK: 'ask',
} as const;

export type ConflictResolutionType =
  (typeof ConflictResolution)[keyof typeof ConflictResolution];

export const conflictResolutionSchema = z.enum([
  'add-suffix',
  'add-source',
  'skip',
  'ask',
]);

/**
 * Default settings for reorganization.
 */
export const DEFAULT_REORGANIZATION_SETTINGS: ReorganizationSettings = {
  mode: 'rename-only',
};

/**
 * Create default organize options.
 */
export function createDefaultOrganizeOptions(
  folderPattern: string,
  destinationDirectory?: string
): OrganizeOptions {
  return {
    folderPattern,
    destinationDirectory,
    preserveContext: false,
    contextDepth: 1,
  };
}

/**
 * Validate that organize options are complete when mode is 'organize'.
 */
export function validateReorganizationSettings(
  settings: ReorganizationSettings
): { valid: boolean; error?: string } {
  if (settings.mode === 'organize') {
    if (!settings.organizeOptions) {
      return {
        valid: false,
        error: 'Organize options are required when mode is "organize"',
      };
    }
    if (!settings.organizeOptions.folderPattern) {
      return {
        valid: false,
        error: 'Folder pattern is required for organize mode',
      };
    }
  }
  return { valid: true };
}
