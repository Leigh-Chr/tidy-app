/**
 * @fileoverview Integration tests for unified priority module - Story 7.4
 *
 * Tests the full workflow of:
 * - Priority mode persistence in config save/load
 * - Unified rule list respecting priority mode
 * - Cross-type reordering maintaining consistency
 * - Priority preview matching actual rule evaluation
 * - Priority ties detection and deterministic resolution
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

import type { AppConfig } from '../config/schema.js';
import type { MetadataPatternRule } from '../types/rule.js';
import type { FilenamePatternRule } from '../types/filename-rule.js';
import type { FileInfo } from '../types/file-info.js';
import type { UnifiedMetadata } from '../types/unified-metadata.js';

import { loadConfig, saveConfig } from '../config/loader.js';
import {
  getUnifiedRulePriorities,
  setUnifiedRulePriority,
  reorderUnifiedRules,
} from './unified-priority.js';
import {
  previewRulePriority,
  detectPriorityTies,
} from './priority-preview.js';
import { resolveTemplateForRule } from './template-resolver.js';

// =============================================================================
// Test Setup
// =============================================================================

let testDir: string;

beforeEach(async () => {
  testDir = join(tmpdir(), `tidy-unified-test-${randomUUID().slice(0, 8)}`);
  await mkdir(testDir, { recursive: true });
});

afterEach(async () => {
  await rm(testDir, { recursive: true, force: true });
});

// =============================================================================
// Fixture Creators
// =============================================================================

// Use deterministic UUIDs for testing (based on a predictable pattern)
// Maps friendly IDs used in tests to valid UUIDs
const ID_MAP: Record<string, string> = {
  // Templates
  'template-1': '00000000-0000-4000-8000-000000000001',
  'template-2': '00000000-0000-4000-8000-000000000002',
  'template-3': '00000000-0000-4000-8000-000000000003',
  // Metadata rules
  'meta-1': '11111111-0000-4000-8000-000000000001',
  'meta-2': '11111111-0000-4000-8000-000000000002',
  'meta-3': '11111111-0000-4000-8000-000000000003',
  // Filename rules
  'file-1': '22222222-0000-4000-8000-000000000001',
  'file-2': '22222222-0000-4000-8000-000000000002',
  'file-3': '22222222-0000-4000-8000-000000000003',
};

const toUUID = (id: string): string => ID_MAP[id] || id;
const toUUIDs = (ids: string[]): string[] => ids.map(toUUID);

const createTemplate = (id: string, name: string) => ({
  id: toUUID(id),
  name,
  pattern: `{date}-${name.toLowerCase().replace(/\s+/g, '-')}`,
  isDefault: false,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
});

const createMetadataRule = (
  id: string,
  name: string,
  priority: number,
  templateId: string,
  cameraMakeValue: string = 'Apple'
): MetadataPatternRule => ({
  id: toUUID(id),
  name,
  conditions: [{ field: 'image.cameraMake', operator: 'equals', value: cameraMakeValue }],
  matchMode: 'all',
  templateId: toUUID(templateId),
  priority,
  enabled: true,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
});

const createFilenameRule = (
  id: string,
  name: string,
  pattern: string,
  priority: number,
  templateId: string
): FilenamePatternRule => ({
  id: toUUID(id),
  name,
  pattern,
  caseSensitive: false,
  templateId: toUUID(templateId),
  priority,
  enabled: true,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
});

const createFileInfo = (fullName: string): FileInfo => ({
  path: `/test/${fullName}`,
  name: fullName.replace(/\.[^.]+$/, ''),
  extension: fullName.split('.').pop() || '',
  fullName,
  size: 1024,
  createdAt: new Date('2024-01-15'),
  modifiedAt: new Date('2024-01-15'),
  relativePath: fullName,
  mimeType: 'image/jpeg',
  category: 'image',
  metadataSupported: true,
  metadataCapability: 'full',
});

const createMetadata = (cameraMake: string = 'Apple'): UnifiedMetadata => ({
  file: {
    path: '/test/photo.jpg',
    name: 'photo',
    extension: 'jpg',
    fullName: 'photo.jpg',
    size: 1024,
    createdAt: new Date('2024-01-15'),
    modifiedAt: new Date('2024-01-15'),
    relativePath: 'photo.jpg',
    mimeType: 'image/jpeg',
    category: 'image',
    metadataSupported: true,
    metadataCapability: 'full',
  },
  image: {
    dateTaken: new Date('2024-01-15'),
    cameraMake,
    cameraModel: 'iPhone 15 Pro',
    width: 4032,
    height: 3024,
  },
  pdf: null,
  office: null,
  extractionStatus: 'success',
  extractionError: null,
});

const createTestConfig = (
  priorityMode: 'combined' | 'metadata-first' | 'filename-first' = 'combined'
): AppConfig => ({
  version: 1,
  templates: [
    createTemplate('template-1', 'Template One'),
    createTemplate('template-2', 'Template Two'),
    createTemplate('template-3', 'Template Three'),
  ],
  preferences: {
    defaultOutputFormat: 'table',
    colorOutput: true,
    confirmBeforeApply: true,
    recursiveScan: false,
    rulePriorityMode: priorityMode,
  },
  recentFolders: [],
  rules: [],
  filenameRules: [],
});

// =============================================================================
// 5.1: Priority Mode Persists in Config Save/Load Cycle
// =============================================================================

describe('5.1: Priority mode persists in config save/load cycle', () => {
  it('should persist "combined" mode through save/load', async () => {
    const config = createTestConfig('combined');
    const configPath = join(testDir, 'config.json');

    await saveConfig(config, { configPath });
    const loadResult = await loadConfig({ configPath });

    expect(loadResult.ok).toBe(true);
    if (loadResult.ok) {
      expect(loadResult.data.preferences.rulePriorityMode).toBe('combined');
    }
  });

  it('should persist "metadata-first" mode through save/load', async () => {
    const config = createTestConfig('metadata-first');
    const configPath = join(testDir, 'config.json');

    await saveConfig(config, { configPath });
    const loadResult = await loadConfig({ configPath });

    expect(loadResult.ok).toBe(true);
    if (loadResult.ok) {
      expect(loadResult.data.preferences.rulePriorityMode).toBe('metadata-first');
    }
  });

  it('should persist "filename-first" mode through save/load', async () => {
    const config = createTestConfig('filename-first');
    const configPath = join(testDir, 'config.json');

    await saveConfig(config, { configPath });
    const loadResult = await loadConfig({ configPath });

    expect(loadResult.ok).toBe(true);
    if (loadResult.ok) {
      expect(loadResult.data.preferences.rulePriorityMode).toBe('filename-first');
    }
  });

  it('should default to "combined" when loading config without rulePriorityMode', async () => {
    // Write a config file without the rulePriorityMode field
    const configPath = join(testDir, 'config.json');
    const oldConfig = {
      version: 1,
      templates: [],
      preferences: {
        defaultOutputFormat: 'table',
        colorOutput: true,
        confirmBeforeApply: true,
        recursiveScan: false,
        // Note: rulePriorityMode is missing
      },
      recentFolders: [],
      rules: [],
      filenameRules: [],
    };
    await writeFile(configPath, JSON.stringify(oldConfig, null, 2));

    const loadResult = await loadConfig({ configPath });

    // Should default to 'combined'
    expect(loadResult.ok).toBe(true);
    if (loadResult.ok) {
      expect(loadResult.data.preferences.rulePriorityMode).toBe('combined');
    }
  });
});

// =============================================================================
// 5.2: Unified Rule List Respects Priority Mode
// =============================================================================

describe('5.2: Unified rule list respects priority mode', () => {
  it('should sort all rules by priority in "combined" mode', () => {
    const config = createTestConfig('combined');
    config.rules = [
      createMetadataRule('meta-1', 'Meta Low', 5, 'template-1'),
      createMetadataRule('meta-2', 'Meta High', 15, 'template-2'),
    ];
    config.filenameRules = [
      createFilenameRule('file-1', 'File Medium', '*.jpg', 10, 'template-3'),
    ];

    const unified = getUnifiedRulePriorities(config);

    expect(unified.map((r) => r.id)).toEqual(toUUIDs(['meta-2', 'file-1', 'meta-1']));
    expect(unified.map((r) => r.priority)).toEqual([15, 10, 5]);
  });

  it('should group metadata rules before filename rules in "metadata-first" mode', () => {
    const config = createTestConfig('metadata-first');
    config.rules = [
      createMetadataRule('meta-1', 'Meta Low', 1, 'template-1'),
    ];
    config.filenameRules = [
      createFilenameRule('file-1', 'File High', '*.jpg', 100, 'template-3'),
    ];

    const unified = getUnifiedRulePriorities(config);

    // Metadata first regardless of priority
    expect(unified[0]!.type).toBe('metadata');
    expect(unified[1]!.type).toBe('filename');
  });

  it('should group filename rules before metadata rules in "filename-first" mode', () => {
    const config = createTestConfig('filename-first');
    config.rules = [
      createMetadataRule('meta-1', 'Meta High', 100, 'template-1'),
    ];
    config.filenameRules = [
      createFilenameRule('file-1', 'File Low', '*.jpg', 1, 'template-3'),
    ];

    const unified = getUnifiedRulePriorities(config);

    // Filename first regardless of priority
    expect(unified[0]!.type).toBe('filename');
    expect(unified[1]!.type).toBe('metadata');
  });
});

// =============================================================================
// 5.3: Cross-Type Reordering Maintains Consistency
// =============================================================================

describe('5.3: Cross-type reordering maintains consistency', () => {
  it('should reorder rules across types and assign correct priorities', () => {
    const config = createTestConfig('combined');
    config.rules = [
      createMetadataRule('meta-1', 'Meta 1', 0, 'template-1'),
      createMetadataRule('meta-2', 'Meta 2', 1, 'template-2'),
    ];
    config.filenameRules = [
      createFilenameRule('file-1', 'File 1', '*.jpg', 2, 'template-3'),
    ];

    // Reorder: file-1 first, then meta-1, then meta-2
    const result = reorderUnifiedRules(config, toUUIDs(['file-1', 'meta-1', 'meta-2']));
    expect(result.ok).toBe(true);

    if (result.ok) {
      const unified = getUnifiedRulePriorities(result.data);
      expect(unified.map((r) => r.id)).toEqual(toUUIDs(['file-1', 'meta-1', 'meta-2']));
    }
  });

  it('should persist reordered priorities through save/load', async () => {
    const config = createTestConfig('combined');
    config.rules = [
      createMetadataRule('meta-1', 'Meta 1', 10, 'template-1'),
    ];
    config.filenameRules = [
      createFilenameRule('file-1', 'File 1', '*.jpg', 5, 'template-3'),
    ];

    // Reorder to put filename rule first
    const reorderResult = reorderUnifiedRules(config, toUUIDs(['file-1', 'meta-1']));
    expect(reorderResult.ok).toBe(true);

    if (reorderResult.ok) {
      const configPath = join(testDir, 'config.json');
      await saveConfig(reorderResult.data, { configPath });

      const loadResult = await loadConfig({ configPath });
      expect(loadResult.ok).toBe(true);

      if (loadResult.ok) {
        const unified = getUnifiedRulePriorities(loadResult.data);
        expect(unified.map((r) => r.id)).toEqual(toUUIDs(['file-1', 'meta-1']));
      }
    }
  });

  it('should set individual rule priority and maintain order', () => {
    const config = createTestConfig('combined');
    config.rules = [
      createMetadataRule('meta-1', 'Meta 1', 5, 'template-1'),
    ];
    config.filenameRules = [
      createFilenameRule('file-1', 'File 1', '*.jpg', 10, 'template-3'),
    ];

    // Initially file-1 is higher priority
    let unified = getUnifiedRulePriorities(config);
    expect(unified[0]!.id).toBe(toUUID('file-1'));

    // Set meta-1 to higher priority
    const result = setUnifiedRulePriority(config, toUUID('meta-1'), 20);
    expect(result.ok).toBe(true);

    if (result.ok) {
      unified = getUnifiedRulePriorities(result.data);
      expect(unified[0]!.id).toBe(toUUID('meta-1'));
    }
  });
});

// =============================================================================
// 5.4: Priority Preview Matches Actual Rule Evaluation
// =============================================================================

describe('5.4: Priority preview matches actual rule evaluation', () => {
  it('should preview correctly when metadata rule matches', () => {
    const config = createTestConfig('combined');
    config.rules = [
      createMetadataRule('meta-1', 'Apple Photos', 10, 'template-1', 'Apple'),
    ];
    config.filenameRules = [
      createFilenameRule('file-1', 'JPEG Files', '*.jpg', 5, 'template-3'),
    ];

    const fileInfo = createFileInfo('IMG_1234.jpg');
    const metadata = createMetadata('Apple');

    // Preview
    const preview = previewRulePriority(fileInfo, metadata, config);
    expect(preview.winningRule!.id).toBe(toUUID('meta-1'));

    // Actual resolution
    const resolution = resolveTemplateForRule(
      config.rules,
      config.filenameRules,
      fileInfo,
      metadata,
      config.templates
    );
    expect(resolution.templateId).toBe(toUUID('template-1'));
    expect(resolution.matchedRule!.ruleId).toBe(toUUID('meta-1'));
  });

  it('should preview correctly when filename rule matches', () => {
    const config = createTestConfig('combined');
    config.rules = [
      createMetadataRule('meta-1', 'Canon Photos', 10, 'template-1', 'Canon'),
    ];
    config.filenameRules = [
      createFilenameRule('file-1', 'JPEG Files', '*.jpg', 5, 'template-3'),
    ];

    const fileInfo = createFileInfo('photo.jpg');
    const metadata = createMetadata('Apple'); // Won't match Canon rule

    // Preview
    const preview = previewRulePriority(fileInfo, metadata, config);
    expect(preview.winningRule!.id).toBe(toUUID('file-1'));

    // Actual resolution
    const resolution = resolveTemplateForRule(
      config.rules,
      config.filenameRules,
      fileInfo,
      metadata,
      config.templates
    );
    expect(resolution.templateId).toBe(toUUID('template-3'));
    expect(resolution.matchedRule!.ruleId).toBe(toUUID('file-1'));
  });

  it('should preview correctly with "metadata-first" mode', () => {
    const config = createTestConfig('metadata-first');
    config.rules = [
      createMetadataRule('meta-1', 'Apple Photos', 1, 'template-1', 'Apple'),
    ];
    config.filenameRules = [
      createFilenameRule('file-1', 'JPEG Files', '*.jpg', 100, 'template-3'),
    ];

    const fileInfo = createFileInfo('photo.jpg');
    const metadata = createMetadata('Apple');

    // Preview - metadata rule should win despite lower priority
    const preview = previewRulePriority(fileInfo, metadata, config);
    expect(preview.winningRule!.id).toBe(toUUID('meta-1'));

    // Actual resolution
    const resolution = resolveTemplateForRule(
      config.rules,
      config.filenameRules,
      fileInfo,
      metadata,
      config.templates,
      { priorityMode: 'metadata-first' }
    );
    expect(resolution.matchedRule!.ruleId).toBe(toUUID('meta-1'));
  });
});

// =============================================================================
// 5.5: Priority Ties Detected and Resolved Deterministically
// =============================================================================

describe('5.5: Priority ties detected and resolved deterministically', () => {
  it('should detect priority ties between rules', () => {
    const config = createTestConfig('combined');
    config.rules = [
      {
        ...createMetadataRule('meta-1', 'Meta 1', 5, 'template-1'),
        createdAt: '2024-01-02T00:00:00.000Z', // Newer
      },
      {
        ...createMetadataRule('meta-2', 'Meta 2', 5, 'template-2'),
        createdAt: '2024-01-01T00:00:00.000Z', // Older
      },
    ];

    const ties = detectPriorityTies(config);

    expect(ties).toHaveLength(1);
    expect(ties[0]!.priority).toBe(5);
    expect(ties[0]!.rules).toHaveLength(2);
  });

  it('should resolve ties deterministically by createdAt (older first)', () => {
    const config = createTestConfig('combined');
    config.rules = [
      {
        ...createMetadataRule('meta-1', 'Meta 1', 5, 'template-1', 'Apple'),
        createdAt: '2024-01-02T00:00:00.000Z', // Newer
      },
      {
        ...createMetadataRule('meta-2', 'Meta 2', 5, 'template-2', 'Apple'),
        createdAt: '2024-01-01T00:00:00.000Z', // Older
      },
    ];

    const unified = getUnifiedRulePriorities(config);

    // Older rule should come first when priorities are equal
    expect(unified[0]!.id).toBe(toUUID('meta-2'));
    expect(unified[1]!.id).toBe(toUUID('meta-1'));
  });

  it('should include ties in preview result', () => {
    const config = createTestConfig('combined');
    config.rules = [
      createMetadataRule('meta-1', 'Meta 1', 10, 'template-1', 'Apple'),
      createMetadataRule('meta-2', 'Meta 2', 10, 'template-2', 'Apple'),
    ];

    const fileInfo = createFileInfo('photo.jpg');
    const metadata = createMetadata('Apple');

    const preview = previewRulePriority(fileInfo, metadata, config);

    expect(preview.priorityTies).toHaveLength(1);
    expect(preview.priorityTies[0]!.priority).toBe(10);
  });

  it('should detect ties across rule types', () => {
    const config = createTestConfig('combined');
    config.rules = [
      createMetadataRule('meta-1', 'Meta 1', 7, 'template-1'),
    ];
    config.filenameRules = [
      createFilenameRule('file-1', 'File 1', '*.jpg', 7, 'template-3'),
    ];

    const ties = detectPriorityTies(config);

    expect(ties).toHaveLength(1);
    expect(ties[0]!.priority).toBe(7);
    expect(ties[0]!.rules.map((r) => r.type)).toContain('metadata');
    expect(ties[0]!.rules.map((r) => r.type)).toContain('filename');
  });
});
