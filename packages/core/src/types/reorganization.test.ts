import { describe, it, expect } from 'vitest';
import {
  ReorganizationMode,
  reorganizationModeSchema,
  organizeOptionsSchema,
  reorganizationSettingsSchema,
  FileActionType,
  fileActionTypeSchema,
  fileConflictSchema,
  previewActionSummarySchema,
  emptyFolderInfoSchema,
  ConflictResolution,
  conflictResolutionSchema,
  DEFAULT_REORGANIZATION_SETTINGS,
  createDefaultOrganizeOptions,
  validateReorganizationSettings,
  type ReorganizationSettings,
  type OrganizeOptions,
} from './reorganization.js';

describe('reorganization types', () => {
  describe('ReorganizationMode', () => {
    it('defines correct mode values', () => {
      expect(ReorganizationMode.RENAME_ONLY).toBe('rename-only');
      expect(ReorganizationMode.ORGANIZE).toBe('organize');
    });

    it('schema validates correct values', () => {
      expect(reorganizationModeSchema.parse('rename-only')).toBe('rename-only');
      expect(reorganizationModeSchema.parse('organize')).toBe('organize');
    });

    it('schema rejects invalid values', () => {
      expect(() => reorganizationModeSchema.parse('invalid')).toThrow();
      expect(() => reorganizationModeSchema.parse('')).toThrow();
      expect(() => reorganizationModeSchema.parse(null)).toThrow();
    });
  });

  describe('OrganizeOptions', () => {
    it('parses valid options', () => {
      const options: OrganizeOptions = {
        folderPattern: '{year}/{month}',
        destinationDirectory: '/output',
        preserveContext: true,
        contextDepth: 2,
      };
      expect(organizeOptionsSchema.parse(options)).toEqual(options);
    });

    it('applies defaults for optional fields', () => {
      const minimal = { folderPattern: '{year}' };
      const result = organizeOptionsSchema.parse(minimal);
      expect(result.preserveContext).toBe(false);
      expect(result.contextDepth).toBe(1);
    });

    it('requires folderPattern to be non-empty', () => {
      expect(() => organizeOptionsSchema.parse({ folderPattern: '' })).toThrow();
    });

    it('allows destinationDirectory to be optional', () => {
      const result = organizeOptionsSchema.parse({ folderPattern: '{year}' });
      expect(result.destinationDirectory).toBeUndefined();
    });
  });

  describe('ReorganizationSettings', () => {
    it('parses complete settings', () => {
      const settings: ReorganizationSettings = {
        mode: 'organize',
        organizeOptions: {
          folderPattern: '{year}/{month}',
          preserveContext: false,
          contextDepth: 1,
        },
      };
      expect(reorganizationSettingsSchema.parse(settings)).toMatchObject(settings);
    });

    it('defaults to rename-only mode', () => {
      const result = reorganizationSettingsSchema.parse({});
      expect(result.mode).toBe('rename-only');
    });

    it('allows organizeOptions to be optional', () => {
      const result = reorganizationSettingsSchema.parse({ mode: 'rename-only' });
      expect(result.organizeOptions).toBeUndefined();
    });
  });

  describe('FileActionType', () => {
    it('defines all action types', () => {
      expect(FileActionType.RENAME).toBe('rename');
      expect(FileActionType.MOVE).toBe('move');
      expect(FileActionType.NO_CHANGE).toBe('no-change');
      expect(FileActionType.CONFLICT).toBe('conflict');
      expect(FileActionType.ERROR).toBe('error');
    });

    it('schema validates all types', () => {
      expect(fileActionTypeSchema.parse('rename')).toBe('rename');
      expect(fileActionTypeSchema.parse('move')).toBe('move');
      expect(fileActionTypeSchema.parse('no-change')).toBe('no-change');
      expect(fileActionTypeSchema.parse('conflict')).toBe('conflict');
      expect(fileActionTypeSchema.parse('error')).toBe('error');
    });
  });

  describe('FileConflict', () => {
    it('parses duplicate-name conflict', () => {
      const conflict = {
        type: 'duplicate-name' as const,
        message: 'Another file would have the same name',
        conflictingFileId: 'file-123',
      };
      expect(fileConflictSchema.parse(conflict)).toEqual(conflict);
    });

    it('parses file-exists conflict', () => {
      const conflict = {
        type: 'file-exists' as const,
        message: 'A file already exists at this path',
        existingFilePath: '/path/to/existing.jpg',
      };
      expect(fileConflictSchema.parse(conflict)).toEqual(conflict);
    });

    it('parses cross-conflict', () => {
      const conflict = {
        type: 'cross-conflict' as const,
        message: 'Files would swap positions',
      };
      expect(fileConflictSchema.parse(conflict)).toEqual(conflict);
    });
  });

  describe('PreviewActionSummary', () => {
    it('parses valid summary', () => {
      const summary = {
        renameCount: 10,
        moveCount: 5,
        noChangeCount: 2,
        conflictCount: 1,
        errorCount: 0,
      };
      expect(previewActionSummarySchema.parse(summary)).toEqual(summary);
    });

    it('rejects negative counts', () => {
      expect(() =>
        previewActionSummarySchema.parse({
          renameCount: -1,
          moveCount: 0,
          noChangeCount: 0,
          conflictCount: 0,
          errorCount: 0,
        })
      ).toThrow();
    });
  });

  describe('EmptyFolderInfo', () => {
    it('parses valid info', () => {
      const info = {
        path: '/photos/vacation',
        filesMovedOut: 5,
      };
      expect(emptyFolderInfoSchema.parse(info)).toEqual(info);
    });

    it('requires filesMovedOut to be positive', () => {
      expect(() =>
        emptyFolderInfoSchema.parse({
          path: '/photos',
          filesMovedOut: 0,
        })
      ).toThrow();
    });
  });

  describe('ConflictResolution', () => {
    it('defines all resolution strategies', () => {
      expect(ConflictResolution.ADD_SUFFIX).toBe('add-suffix');
      expect(ConflictResolution.ADD_SOURCE).toBe('add-source');
      expect(ConflictResolution.SKIP).toBe('skip');
      expect(ConflictResolution.ASK).toBe('ask');
    });

    it('schema validates all strategies', () => {
      expect(conflictResolutionSchema.parse('add-suffix')).toBe('add-suffix');
      expect(conflictResolutionSchema.parse('add-source')).toBe('add-source');
      expect(conflictResolutionSchema.parse('skip')).toBe('skip');
      expect(conflictResolutionSchema.parse('ask')).toBe('ask');
    });
  });

  describe('DEFAULT_REORGANIZATION_SETTINGS', () => {
    it('defaults to rename-only mode', () => {
      expect(DEFAULT_REORGANIZATION_SETTINGS.mode).toBe('rename-only');
    });

    it('has no organize options by default', () => {
      expect(DEFAULT_REORGANIZATION_SETTINGS.organizeOptions).toBeUndefined();
    });
  });

  describe('createDefaultOrganizeOptions', () => {
    it('creates options with folder pattern', () => {
      const options = createDefaultOrganizeOptions('{year}/{month}');
      expect(options.folderPattern).toBe('{year}/{month}');
      expect(options.preserveContext).toBe(false);
      expect(options.contextDepth).toBe(1);
    });

    it('includes destination directory when provided', () => {
      const options = createDefaultOrganizeOptions('{year}', '/output');
      expect(options.destinationDirectory).toBe('/output');
    });

    it('omits destination directory when not provided', () => {
      const options = createDefaultOrganizeOptions('{year}');
      expect(options.destinationDirectory).toBeUndefined();
    });
  });

  describe('validateReorganizationSettings', () => {
    it('validates rename-only mode without options', () => {
      const result = validateReorganizationSettings({
        mode: 'rename-only',
      });
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('validates organize mode with complete options', () => {
      const result = validateReorganizationSettings({
        mode: 'organize',
        organizeOptions: {
          folderPattern: '{year}/{month}',
          preserveContext: false,
          contextDepth: 1,
        },
      });
      expect(result.valid).toBe(true);
    });

    it('rejects organize mode without options', () => {
      const result = validateReorganizationSettings({
        mode: 'organize',
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Organize options are required');
    });

    it('rejects organize mode with empty folder pattern', () => {
      const result = validateReorganizationSettings({
        mode: 'organize',
        organizeOptions: {
          folderPattern: '',
          preserveContext: false,
          contextDepth: 1,
        },
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Folder pattern is required');
    });
  });
});
