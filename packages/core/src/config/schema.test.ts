/**
 * @fileoverview Tests for configuration schema - Story 7.4, 8.1
 *
 * Tests for rulePriorityMode preference and folderStructures in config schema.
 */

import { describe, it, expect } from 'vitest';
import {
  preferencesSchema,
  appConfigSchema,
  DEFAULT_CONFIG,
  type AppConfig,
  rulePriorityModeSchema,
  type RulePriorityMode,
} from './schema.js';
import type { FolderStructure } from '../types/folder-structure.js';

describe('rulePriorityModeSchema', () => {
  it('should accept "combined" mode', () => {
    const result = rulePriorityModeSchema.safeParse('combined');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('combined');
    }
  });

  it('should accept "metadata-first" mode', () => {
    const result = rulePriorityModeSchema.safeParse('metadata-first');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('metadata-first');
    }
  });

  it('should accept "filename-first" mode', () => {
    const result = rulePriorityModeSchema.safeParse('filename-first');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('filename-first');
    }
  });

  it('should reject invalid mode', () => {
    const result = rulePriorityModeSchema.safeParse('invalid-mode');
    expect(result.success).toBe(false);
  });

  it('should reject empty string', () => {
    const result = rulePriorityModeSchema.safeParse('');
    expect(result.success).toBe(false);
  });
});

describe('preferencesSchema with rulePriorityMode', () => {
  it('should default rulePriorityMode to "combined"', () => {
    const result = preferencesSchema.parse({});
    expect(result.rulePriorityMode).toBe('combined');
  });

  it('should accept explicit rulePriorityMode', () => {
    const result = preferencesSchema.parse({
      rulePriorityMode: 'metadata-first',
    });
    expect(result.rulePriorityMode).toBe('metadata-first');
  });

  it('should reject invalid rulePriorityMode', () => {
    const result = preferencesSchema.safeParse({
      rulePriorityMode: 'invalid',
    });
    expect(result.success).toBe(false);
  });

  it('should preserve all other defaults with rulePriorityMode', () => {
    const result = preferencesSchema.parse({
      rulePriorityMode: 'filename-first',
    });
    expect(result).toEqual({
      defaultOutputFormat: 'table',
      colorOutput: true,
      confirmBeforeApply: true,
      recursiveScan: false,
      rulePriorityMode: 'filename-first',
      caseNormalization: 'kebab-case',
    });
  });
});

describe('appConfigSchema with rulePriorityMode', () => {
  it('should include rulePriorityMode in preferences', () => {
    const config: AppConfig = {
      version: 1,
      templates: [],
      preferences: {
        defaultOutputFormat: 'table',
        colorOutput: true,
        confirmBeforeApply: true,
        recursiveScan: false,
        rulePriorityMode: 'combined',
        caseNormalization: 'kebab-case',
      },
      recentFolders: [],
      rules: [],
      filenameRules: [],
      folderStructures: [],
    };

    const result = appConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.preferences.rulePriorityMode).toBe('combined');
    }
  });

  it('should default rulePriorityMode when preferences are partially specified', () => {
    const partialConfig = {
      version: 1 as const,
      preferences: {
        colorOutput: false,
      },
    };

    const result = appConfigSchema.parse(partialConfig);
    expect(result.preferences.rulePriorityMode).toBe('combined');
  });
});

describe('DEFAULT_CONFIG', () => {
  it('should have rulePriorityMode set to "combined"', () => {
    expect(DEFAULT_CONFIG.preferences.rulePriorityMode).toBe('combined');
  });

  it('should be valid according to appConfigSchema', () => {
    const result = appConfigSchema.safeParse(DEFAULT_CONFIG);
    expect(result.success).toBe(true);
  });
});

describe('RulePriorityMode type', () => {
  it('should be exported and usable', () => {
    const modes: RulePriorityMode[] = ['combined', 'metadata-first', 'filename-first'];
    expect(modes).toHaveLength(3);
  });
});

// =============================================================================
// Folder Structures Tests (Story 8.1)
// =============================================================================

describe('appConfigSchema with folderStructures', () => {
  it('should default folderStructures to empty array', () => {
    const partialConfig = {
      version: 1 as const,
    };

    const result = appConfigSchema.parse(partialConfig);
    expect(result.folderStructures).toEqual([]);
  });

  it('should accept valid folderStructures array', () => {
    const now = new Date();
    const structure: FolderStructure = {
      id: 'test-id',
      name: 'By Year',
      pattern: '{year}/{month}',
      description: 'Organize by date',
      enabled: true,
      priority: 10,
      createdAt: now,
      updatedAt: now,
    };

    const config = {
      version: 1 as const,
      folderStructures: [structure],
    };

    const result = appConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.folderStructures).toHaveLength(1);
      expect(result.data.folderStructures[0]!.name).toBe('By Year');
    }
  });

  it('should accept folderStructures with optional description undefined', () => {
    const now = new Date();
    const structure: FolderStructure = {
      id: 'test-id',
      name: 'Simple',
      pattern: '{year}',
      enabled: true,
      priority: 10,
      createdAt: now,
      updatedAt: now,
    };

    const config = {
      version: 1 as const,
      folderStructures: [structure],
    };

    const result = appConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
  });

  it('should reject folderStructures with invalid structure', () => {
    const config = {
      version: 1 as const,
      folderStructures: [
        {
          id: 'test-id',
          name: '', // Invalid: empty name
          pattern: '{year}',
          enabled: true,
          priority: 10,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    };

    const result = appConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
  });
});

describe('DEFAULT_CONFIG with folderStructures', () => {
  it('should have folderStructures as empty array', () => {
    expect(DEFAULT_CONFIG.folderStructures).toEqual([]);
  });

  it('should include folderStructures in the type', () => {
    // Type check - this ensures AppConfig includes folderStructures
    const structures: FolderStructure[] = DEFAULT_CONFIG.folderStructures;
    expect(Array.isArray(structures)).toBe(true);
  });
});
