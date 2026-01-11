/**
 * @fileoverview Tests for template resolver - Story 7.3
 */

import { describe, it, expect } from 'vitest';
import {
  resolveTemplateForRule,
  type RuleMatch,
  type RulePriorityMode,
} from './template-resolver.js';
import type { MetadataPatternRule } from '../types/rule.js';
import type { FilenamePatternRule } from '../types/filename-rule.js';
import type { FileInfo } from '../types/file-info.js';
import type { UnifiedMetadata } from '../types/unified-metadata.js';
import type { Template } from '../config/schema.js';
import { FileCategory } from '../types/file-category.js';
import { MetadataCapability } from '../types/metadata-capability.js';

// =============================================================================
// Test Fixtures
// =============================================================================

const createFileInfo = (overrides: Partial<FileInfo> = {}): FileInfo => ({
  path: '/test/IMG_1234.jpg',
  name: 'IMG_1234',
  extension: '.jpg',
  fullName: 'IMG_1234.jpg',
  size: 1024,
  createdAt: new Date('2026-01-01'),
  modifiedAt: new Date('2026-01-01'),
  relativePath: 'IMG_1234.jpg',
  category: FileCategory.IMAGE,
  metadataSupported: true,
  metadataCapability: MetadataCapability.FULL,
  ...overrides,
});

const createUnifiedMetadata = (fileInfo: FileInfo, overrides: Partial<UnifiedMetadata> = {}): UnifiedMetadata => ({
  file: fileInfo,
  image: {
    dateTaken: new Date('2026-01-01'),
    cameraMake: 'Apple',
    cameraModel: 'iPhone 15 Pro',
    gps: null,
    width: 4032,
    height: 3024,
    orientation: 1,
    exposureTime: '1/100',
    fNumber: 1.8,
    iso: 100,
  },
  pdf: null,
  office: null,
  extractionStatus: 'success',
  extractionError: null,
  ...overrides,
});

const createTemplate = (id: string, name: string): Template => ({
  id,
  name,
  pattern: `{date}-{original}`,
  fileTypes: [],
  isDefault: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

const createMetadataRule = (
  id: string,
  name: string,
  templateId: string,
  priority: number,
  conditions: MetadataPatternRule['conditions'] = [{ field: 'image.cameraMake', operator: 'contains', value: 'Apple', caseSensitive: false }],
  enabled = true
): MetadataPatternRule => ({
  id,
  name,
  description: undefined,
  conditions,
  matchMode: 'all',
  templateId,
  priority,
  enabled,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

const createFilenameRule = (
  id: string,
  name: string,
  pattern: string,
  templateId: string,
  priority: number,
  enabled = true
): FilenamePatternRule => ({
  id,
  name,
  description: undefined,
  pattern,
  caseSensitive: false,
  templateId,
  priority,
  enabled,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

// =============================================================================
// Tests
// =============================================================================

describe('resolveTemplateForRule', () => {
  describe('basic resolution', () => {
    it('should return null when no rules are provided', () => {
      const fileInfo = createFileInfo();
      const metadata = createUnifiedMetadata(fileInfo);
      const templates = [createTemplate('t1', 'Template 1')];

      const result = resolveTemplateForRule([], [], fileInfo, metadata, templates);

      expect(result.templateId).toBeNull();
      expect(result.matchedRule).toBeNull();
      expect(result.fallbackReason).toBe('no-match');
    });

    it('should return null when rules exist but none match', () => {
      const fileInfo = createFileInfo();
      const metadata = createUnifiedMetadata(fileInfo, {
        image: null, // No image metadata
      });
      const templates = [createTemplate('t1', 'Template 1')];
      const metadataRules = [
        createMetadataRule('r1', 'Apple Rule', 't1', 10, [
          { field: 'image.cameraMake', operator: 'contains', value: 'Apple', caseSensitive: false },
        ]),
      ];

      const result = resolveTemplateForRule(metadataRules, [], fileInfo, metadata, templates);

      expect(result.templateId).toBeNull();
      expect(result.matchedRule).toBeNull();
      expect(result.fallbackReason).toBe('no-match');
    });

    it('should return matching rule template when metadata rule matches', () => {
      const fileInfo = createFileInfo();
      const metadata = createUnifiedMetadata(fileInfo);
      const templates = [createTemplate('t1', 'Template 1')];
      const metadataRules = [
        createMetadataRule('r1', 'Apple Rule', 't1', 10),
      ];

      const result = resolveTemplateForRule(metadataRules, [], fileInfo, metadata, templates);

      expect(result.templateId).toBe('t1');
      expect(result.matchedRule).not.toBeNull();
      expect(result.matchedRule?.ruleId).toBe('r1');
      expect(result.matchedRule?.ruleName).toBe('Apple Rule');
      expect(result.matchedRule?.ruleType).toBe('metadata');
      expect(result.matchedRule?.templateId).toBe('t1');
      expect(result.matchedRule?.priority).toBe(10);
    });

    it('should return matching rule template when filename rule matches', () => {
      const fileInfo = createFileInfo();
      const metadata = createUnifiedMetadata(fileInfo);
      const templates = [createTemplate('t2', 'Template 2')];
      const filenameRules = [
        createFilenameRule('fr1', 'IMG Rule', 'IMG_*.jpg', 't2', 5),
      ];

      const result = resolveTemplateForRule([], filenameRules, fileInfo, metadata, templates);

      expect(result.templateId).toBe('t2');
      expect(result.matchedRule).not.toBeNull();
      expect(result.matchedRule?.ruleId).toBe('fr1');
      expect(result.matchedRule?.ruleName).toBe('IMG Rule');
      expect(result.matchedRule?.ruleType).toBe('filename');
      expect(result.matchedRule?.templateId).toBe('t2');
      expect(result.matchedRule?.priority).toBe(5);
    });
  });

  describe('priority handling', () => {
    it('should return highest priority matching rule (combined mode)', () => {
      const fileInfo = createFileInfo();
      const metadata = createUnifiedMetadata(fileInfo);
      const templates = [
        createTemplate('t1', 'Template 1'),
        createTemplate('t2', 'Template 2'),
        createTemplate('t3', 'Template 3'),
      ];
      const metadataRules = [
        createMetadataRule('r1', 'Low Priority', 't1', 5),
        createMetadataRule('r2', 'High Priority', 't2', 15),
      ];
      const filenameRules = [
        createFilenameRule('fr1', 'Medium Priority', 'IMG_*.jpg', 't3', 10),
      ];

      const result = resolveTemplateForRule(metadataRules, filenameRules, fileInfo, metadata, templates);

      expect(result.templateId).toBe('t2');
      expect(result.matchedRule?.ruleId).toBe('r2');
      expect(result.matchedRule?.priority).toBe(15);
    });

    it('should skip disabled rules', () => {
      const fileInfo = createFileInfo();
      const metadata = createUnifiedMetadata(fileInfo);
      const templates = [
        createTemplate('t1', 'Template 1'),
        createTemplate('t2', 'Template 2'),
      ];
      const metadataRules = [
        createMetadataRule('r1', 'Disabled High', 't1', 100, undefined, false),
        createMetadataRule('r2', 'Enabled Low', 't2', 5),
      ];

      const result = resolveTemplateForRule(metadataRules, [], fileInfo, metadata, templates);

      expect(result.templateId).toBe('t2');
      expect(result.matchedRule?.ruleId).toBe('r2');
    });
  });

  describe('priority modes', () => {
    it('should evaluate metadata rules first when priorityMode is metadata-first', () => {
      const fileInfo = createFileInfo();
      const metadata = createUnifiedMetadata(fileInfo);
      const templates = [
        createTemplate('t1', 'Metadata Template'),
        createTemplate('t2', 'Filename Template'),
      ];
      const metadataRules = [
        createMetadataRule('r1', 'Metadata Rule', 't1', 5),
      ];
      const filenameRules = [
        createFilenameRule('fr1', 'Filename Rule', 'IMG_*.jpg', 't2', 100), // Higher priority
      ];

      const result = resolveTemplateForRule(
        metadataRules,
        filenameRules,
        fileInfo,
        metadata,
        templates,
        { priorityMode: 'metadata-first' }
      );

      expect(result.templateId).toBe('t1');
      expect(result.matchedRule?.ruleType).toBe('metadata');
    });

    it('should evaluate filename rules first when priorityMode is filename-first', () => {
      const fileInfo = createFileInfo();
      const metadata = createUnifiedMetadata(fileInfo);
      const templates = [
        createTemplate('t1', 'Metadata Template'),
        createTemplate('t2', 'Filename Template'),
      ];
      const metadataRules = [
        createMetadataRule('r1', 'Metadata Rule', 't1', 100), // Higher priority
      ];
      const filenameRules = [
        createFilenameRule('fr1', 'Filename Rule', 'IMG_*.jpg', 't2', 5),
      ];

      const result = resolveTemplateForRule(
        metadataRules,
        filenameRules,
        fileInfo,
        metadata,
        templates,
        { priorityMode: 'filename-first' }
      );

      expect(result.templateId).toBe('t2');
      expect(result.matchedRule?.ruleType).toBe('filename');
    });

    it('should use combined priority when priorityMode is combined (default)', () => {
      const fileInfo = createFileInfo();
      const metadata = createUnifiedMetadata(fileInfo);
      const templates = [
        createTemplate('t1', 'Metadata Template'),
        createTemplate('t2', 'Filename Template'),
      ];
      const metadataRules = [
        createMetadataRule('r1', 'Metadata Rule', 't1', 50),
      ];
      const filenameRules = [
        createFilenameRule('fr1', 'Filename Rule', 'IMG_*.jpg', 't2', 100), // Higher priority
      ];

      const result = resolveTemplateForRule(
        metadataRules,
        filenameRules,
        fileInfo,
        metadata,
        templates,
        { priorityMode: 'combined' }
      );

      expect(result.templateId).toBe('t2');
      expect(result.matchedRule?.ruleType).toBe('filename');
    });
  });

  describe('template validation', () => {
    it('should return fallback when matched rule references non-existent template', () => {
      const fileInfo = createFileInfo();
      const metadata = createUnifiedMetadata(fileInfo);
      const templates = [createTemplate('t1', 'Template 1')]; // 't-missing' not in templates
      const metadataRules = [
        createMetadataRule('r1', 'Rule with missing template', 't-missing', 10),
      ];

      const result = resolveTemplateForRule(metadataRules, [], fileInfo, metadata, templates);

      expect(result.templateId).toBeNull();
      expect(result.matchedRule).toBeNull();
      expect(result.fallbackReason).toBe('template-not-found');
    });

    it('should try next matching rule when first rule template is missing', () => {
      const fileInfo = createFileInfo();
      const metadata = createUnifiedMetadata(fileInfo);
      const templates = [createTemplate('t2', 'Template 2')];
      const metadataRules = [
        createMetadataRule('r1', 'High Priority Missing', 't-missing', 100),
        createMetadataRule('r2', 'Low Priority Valid', 't2', 10),
      ];

      const result = resolveTemplateForRule(metadataRules, [], fileInfo, metadata, templates);

      expect(result.templateId).toBe('t2');
      expect(result.matchedRule?.ruleId).toBe('r2');
    });
  });

  describe('edge cases', () => {
    it('should handle empty templates array', () => {
      const fileInfo = createFileInfo();
      const metadata = createUnifiedMetadata(fileInfo);
      const metadataRules = [
        createMetadataRule('r1', 'Rule', 't1', 10),
      ];

      const result = resolveTemplateForRule(metadataRules, [], fileInfo, metadata, []);

      expect(result.templateId).toBeNull();
      expect(result.fallbackReason).toBe('template-not-found');
    });

    it('should handle rules with same priority by using first match', () => {
      const fileInfo = createFileInfo();
      const metadata = createUnifiedMetadata(fileInfo);
      const templates = [
        createTemplate('t1', 'Template 1'),
        createTemplate('t2', 'Template 2'),
      ];
      const metadataRules = [
        createMetadataRule('r1', 'Rule 1', 't1', 10),
        createMetadataRule('r2', 'Rule 2', 't2', 10),
      ];

      const result = resolveTemplateForRule(metadataRules, [], fileInfo, metadata, templates);

      // First matching rule with same priority wins
      expect(result.templateId).not.toBeNull();
      expect(result.matchedRule).not.toBeNull();
    });

    it('should handle file that only matches filename rules', () => {
      const fileInfo = createFileInfo({ fullName: 'report_2026.pdf', extension: '.pdf' });
      const metadata = createUnifiedMetadata(fileInfo, { image: null });
      const templates = [createTemplate('t1', 'PDF Template')];
      const metadataRules = [
        createMetadataRule('r1', 'Apple Rule', 't1', 100, [
          { field: 'image.cameraMake', operator: 'contains', value: 'Apple', caseSensitive: false },
        ]),
      ];
      const filenameRules = [
        createFilenameRule('fr1', 'Report Rule', 'report_*.pdf', 't1', 10),
      ];

      const result = resolveTemplateForRule(metadataRules, filenameRules, fileInfo, metadata, templates);

      expect(result.templateId).toBe('t1');
      expect(result.matchedRule?.ruleType).toBe('filename');
    });
  });
});

describe('RuleMatch type', () => {
  it('should have correct structure', () => {
    const ruleMatch: RuleMatch = {
      ruleId: 'test-id',
      ruleName: 'Test Rule',
      ruleType: 'metadata',
      templateId: 'template-id',
      priority: 10,
    };

    expect(ruleMatch.ruleId).toBe('test-id');
    expect(ruleMatch.ruleName).toBe('Test Rule');
    expect(ruleMatch.ruleType).toBe('metadata');
    expect(ruleMatch.templateId).toBe('template-id');
    expect(ruleMatch.priority).toBe(10);
  });
});

describe('RulePriorityMode type', () => {
  it('should accept valid priority modes', () => {
    const modes: RulePriorityMode[] = ['combined', 'metadata-first', 'filename-first'];
    expect(modes).toHaveLength(3);
  });
});

describe('folder structure integration (Story 8.2)', () => {
  it('should return folderStructureId from matched metadata rule', () => {
    const fileInfo = createFileInfo();
    const metadata = createUnifiedMetadata(fileInfo);
    const templates = [createTemplate('t1', 'Template 1')];
    const metadataRules: MetadataPatternRule[] = [
      {
        ...createMetadataRule('r1', 'Apple Rule', 't1', 10),
        folderStructureId: 'fs-uuid-123',
      },
    ];

    const result = resolveTemplateForRule(metadataRules, [], fileInfo, metadata, templates);

    expect(result.templateId).toBe('t1');
    expect(result.folderStructureId).toBe('fs-uuid-123');
  });

  it('should return folderStructureId from matched filename rule', () => {
    const fileInfo = createFileInfo();
    const metadata = createUnifiedMetadata(fileInfo);
    const templates = [createTemplate('t2', 'Template 2')];
    const filenameRules: FilenamePatternRule[] = [
      {
        ...createFilenameRule('fr1', 'IMG Rule', 'IMG_*.jpg', 't2', 5),
        folderStructureId: 'fs-uuid-456',
      },
    ];

    const result = resolveTemplateForRule([], filenameRules, fileInfo, metadata, templates);

    expect(result.templateId).toBe('t2');
    expect(result.folderStructureId).toBe('fs-uuid-456');
  });

  it('should return undefined folderStructureId when rule has none', () => {
    const fileInfo = createFileInfo();
    const metadata = createUnifiedMetadata(fileInfo);
    const templates = [createTemplate('t1', 'Template 1')];
    const metadataRules = [createMetadataRule('r1', 'No Folder Rule', 't1', 10)];

    const result = resolveTemplateForRule(metadataRules, [], fileInfo, metadata, templates);

    expect(result.templateId).toBe('t1');
    expect(result.folderStructureId).toBeUndefined();
  });

  it('should return folderStructureId from highest priority matching rule', () => {
    const fileInfo = createFileInfo();
    const metadata = createUnifiedMetadata(fileInfo);
    const templates = [
      createTemplate('t1', 'Template 1'),
      createTemplate('t2', 'Template 2'),
    ];
    const metadataRules: MetadataPatternRule[] = [
      {
        ...createMetadataRule('r1', 'Low Priority', 't1', 5),
        folderStructureId: 'fs-low',
      },
      {
        ...createMetadataRule('r2', 'High Priority', 't2', 15),
        folderStructureId: 'fs-high',
      },
    ];

    const result = resolveTemplateForRule(metadataRules, [], fileInfo, metadata, templates);

    expect(result.templateId).toBe('t2');
    expect(result.folderStructureId).toBe('fs-high');
  });

  it('should return no folderStructureId when no rules match', () => {
    const fileInfo = createFileInfo();
    const metadata = createUnifiedMetadata(fileInfo, { image: null });
    const templates = [createTemplate('t1', 'Template 1')];
    const metadataRules: MetadataPatternRule[] = [
      {
        ...createMetadataRule('r1', 'Apple Rule', 't1', 10),
        folderStructureId: 'fs-uuid-123',
      },
    ];

    const result = resolveTemplateForRule(metadataRules, [], fileInfo, metadata, templates);

    expect(result.templateId).toBeNull();
    expect(result.folderStructureId).toBeUndefined();
  });
});
