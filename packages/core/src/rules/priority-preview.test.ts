/**
 * @fileoverview Tests for priority preview module - Story 7.4
 *
 * Tests for:
 * - RulePriorityPreview type
 * - previewRulePriority() function
 * - Priority tie detection
 */

import { describe, it, expect } from 'vitest';
import type { AppConfig } from '../config/schema.js';
import type { MetadataPatternRule } from '../types/rule.js';
import type { FilenamePatternRule } from '../types/filename-rule.js';
import type { FileInfo } from '../types/file-info.js';
import type { UnifiedMetadata } from '../types/unified-metadata.js';
import {
  previewRulePriority,
  detectPriorityTies,
  type RulePriorityPreview,
} from './priority-preview.js';

// =============================================================================
// Test Fixtures
// =============================================================================

const createMetadataRule = (overrides: Partial<MetadataPatternRule> = {}): MetadataPatternRule => ({
  id: 'meta-rule-1',
  name: 'Metadata Rule 1',
  conditions: [{ field: 'image.cameraMake', operator: 'equals', value: 'Apple' }],
  matchMode: 'all',
  templateId: 'template-1',
  priority: 0,
  enabled: true,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  ...overrides,
});

const createFilenameRule = (overrides: Partial<FilenamePatternRule> = {}): FilenamePatternRule => ({
  id: 'file-rule-1',
  name: 'Filename Rule 1',
  pattern: '*.jpg',
  caseSensitive: false,
  templateId: 'template-2',
  priority: 0,
  enabled: true,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  ...overrides,
});

const createConfig = (
  rules: MetadataPatternRule[] = [],
  filenameRules: FilenamePatternRule[] = [],
  rulePriorityMode: 'combined' | 'metadata-first' | 'filename-first' = 'combined'
): AppConfig => ({
  version: 1,
  templates: [
    {
      id: 'template-1',
      name: 'Template 1',
      pattern: '{date}-{original}',
      isDefault: true,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    },
    {
      id: 'template-2',
      name: 'Template 2',
      pattern: '{year}/{month}/{original}',
      isDefault: false,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    },
  ],
  preferences: {
    defaultOutputFormat: 'table',
    colorOutput: true,
    confirmBeforeApply: true,
    recursiveScan: false,
    rulePriorityMode,
  },
  recentFolders: [],
  rules,
  filenameRules,
});

const createFileInfo = (overrides: Partial<FileInfo> = {}): FileInfo => ({
  path: '/photos/IMG_1234.jpg',
  name: 'IMG_1234',
  extension: 'jpg',
  fullName: 'IMG_1234.jpg',
  size: 1024 * 1024,
  createdAt: new Date('2024-01-15'),
  modifiedAt: new Date('2024-01-15'),
  relativePath: 'photos/IMG_1234.jpg',
  mimeType: 'image/jpeg',
  category: 'image',
  metadataSupported: true,
  metadataCapability: 'full',
  ...overrides,
});

const createMetadata = (overrides: Partial<UnifiedMetadata> = {}): UnifiedMetadata => ({
  file: {
    path: '/photos/IMG_1234.jpg',
    name: 'IMG_1234',
    extension: 'jpg',
    fullName: 'IMG_1234.jpg',
    size: 1024 * 1024,
    createdAt: new Date('2024-01-15'),
    modifiedAt: new Date('2024-01-15'),
    relativePath: 'photos/IMG_1234.jpg',
    mimeType: 'image/jpeg',
    category: 'image',
    metadataSupported: true,
    metadataCapability: 'full',
  },
  image: {
    dateTaken: new Date('2024-01-15'),
    cameraMake: 'Apple',
    cameraModel: 'iPhone 15 Pro',
    width: 4032,
    height: 3024,
  },
  pdf: null,
  office: null,
  extractionStatus: 'success',
  extractionError: null,
  ...overrides,
});

// =============================================================================
// previewRulePriority Tests
// =============================================================================

describe('previewRulePriority', () => {
  describe('no rules', () => {
    it('should return null winning rule when no rules exist', () => {
      const config = createConfig([], []);
      const fileInfo = createFileInfo();
      const metadata = createMetadata();

      const result = previewRulePriority(fileInfo, metadata, config);

      expect(result.winningRule).toBeNull();
      expect(result.evaluationOrder).toHaveLength(0);
      expect(result.matchedButLost).toHaveLength(0);
      expect(result.priorityTies).toHaveLength(0);
    });
  });

  describe('single matching rule', () => {
    it('should return the matching metadata rule as winner', () => {
      const metaRule = createMetadataRule({
        id: 'meta-1',
        name: 'Apple Photos',
        conditions: [{ field: 'image.cameraMake', operator: 'equals', value: 'Apple' }],
        priority: 5,
      });
      const config = createConfig([metaRule], []);
      const fileInfo = createFileInfo();
      const metadata = createMetadata();

      const result = previewRulePriority(fileInfo, metadata, config);

      expect(result.winningRule).not.toBeNull();
      expect(result.winningRule!.id).toBe('meta-1');
      expect(result.winningRule!.type).toBe('metadata');
    });

    it('should return the matching filename rule as winner', () => {
      const fileRule = createFilenameRule({
        id: 'file-1',
        name: 'JPEG Files',
        pattern: '*.jpg',
        priority: 3,
      });
      const config = createConfig([], [fileRule]);
      const fileInfo = createFileInfo({ fullName: 'photo.jpg' });
      const metadata = createMetadata();

      const result = previewRulePriority(fileInfo, metadata, config);

      expect(result.winningRule).not.toBeNull();
      expect(result.winningRule!.id).toBe('file-1');
      expect(result.winningRule!.type).toBe('filename');
    });
  });

  describe('multiple matching rules', () => {
    it('should return highest priority rule as winner', () => {
      const metaRule1 = createMetadataRule({
        id: 'meta-1',
        name: 'Low Priority Rule',
        conditions: [{ field: 'image.cameraMake', operator: 'equals', value: 'Apple' }],
        priority: 5,
      });
      const metaRule2 = createMetadataRule({
        id: 'meta-2',
        name: 'High Priority Rule',
        conditions: [{ field: 'image.cameraMake', operator: 'contains', value: 'App' }],
        priority: 10,
      });
      const config = createConfig([metaRule1, metaRule2], []);
      const fileInfo = createFileInfo();
      const metadata = createMetadata();

      const result = previewRulePriority(fileInfo, metadata, config);

      expect(result.winningRule!.id).toBe('meta-2');
      expect(result.matchedButLost).toHaveLength(1);
      expect(result.matchedButLost[0]!.id).toBe('meta-1');
    });

    it('should include all matched rules in matchedButLost', () => {
      const metaRule1 = createMetadataRule({
        id: 'meta-1',
        name: 'Rule 1',
        conditions: [{ field: 'image.cameraMake', operator: 'contains', value: 'Apple' }],
        priority: 1,
      });
      const metaRule2 = createMetadataRule({
        id: 'meta-2',
        name: 'Rule 2',
        conditions: [{ field: 'image.cameraMake', operator: 'equals', value: 'Apple' }],
        priority: 2,
      });
      const metaRule3 = createMetadataRule({
        id: 'meta-3',
        name: 'Rule 3',
        conditions: [{ field: 'image.cameraMake', operator: 'startsWith', value: 'App' }],
        priority: 10,
      });
      const config = createConfig([metaRule1, metaRule2, metaRule3], []);
      const fileInfo = createFileInfo();
      const metadata = createMetadata();

      const result = previewRulePriority(fileInfo, metadata, config);

      expect(result.winningRule!.id).toBe('meta-3');
      expect(result.matchedButLost).toHaveLength(2);
      expect(result.matchedButLost.map((r) => r.id)).toContain('meta-1');
      expect(result.matchedButLost.map((r) => r.id)).toContain('meta-2');
    });
  });

  describe('disabled rules', () => {
    it('should skip disabled rules', () => {
      const metaRule = createMetadataRule({
        id: 'meta-1',
        name: 'Disabled Rule',
        conditions: [{ field: 'image.cameraMake', operator: 'equals', value: 'Apple' }],
        priority: 10,
        enabled: false,
      });
      const fileRule = createFilenameRule({
        id: 'file-1',
        name: 'Enabled Rule',
        pattern: '*.jpg',
        priority: 5,
        enabled: true,
      });
      const config = createConfig([metaRule], [fileRule]);
      const fileInfo = createFileInfo({ fullName: 'photo.jpg' });
      const metadata = createMetadata();

      const result = previewRulePriority(fileInfo, metadata, config);

      // Disabled rule should be skipped, filename rule should win
      expect(result.winningRule!.id).toBe('file-1');
    });

    it('should mark disabled rules with skipReason', () => {
      const metaRule = createMetadataRule({
        id: 'meta-1',
        enabled: false,
        priority: 10,
      });
      const config = createConfig([metaRule], []);
      const fileInfo = createFileInfo();
      const metadata = createMetadata();

      const result = previewRulePriority(fileInfo, metadata, config);

      const disabledEntry = result.evaluationOrder.find((e) => e.rule.id === 'meta-1');
      expect(disabledEntry).toBeDefined();
      expect(disabledEntry!.willEvaluate).toBe(false);
      expect(disabledEntry!.skipReason).toBe('disabled');
    });
  });

  describe('non-matching rules', () => {
    it('should not include non-matching rules in matchedButLost', () => {
      const metaRule1 = createMetadataRule({
        id: 'meta-1',
        name: 'Matches',
        conditions: [{ field: 'image.cameraMake', operator: 'equals', value: 'Apple' }],
        priority: 5,
      });
      const metaRule2 = createMetadataRule({
        id: 'meta-2',
        name: 'Does Not Match',
        conditions: [{ field: 'image.cameraMake', operator: 'equals', value: 'Canon' }],
        priority: 10,
      });
      const config = createConfig([metaRule1, metaRule2], []);
      const fileInfo = createFileInfo();
      const metadata = createMetadata();

      const result = previewRulePriority(fileInfo, metadata, config);

      expect(result.winningRule!.id).toBe('meta-1');
      expect(result.matchedButLost).toHaveLength(0);
    });
  });

  describe('evaluation order', () => {
    it('should include all rules in evaluation order', () => {
      const metaRule = createMetadataRule({ id: 'meta-1', priority: 5 });
      const fileRule = createFilenameRule({ id: 'file-1', priority: 3 });
      const config = createConfig([metaRule], [fileRule], 'combined');
      const fileInfo = createFileInfo();
      const metadata = createMetadata();

      const result = previewRulePriority(fileInfo, metadata, config);

      expect(result.evaluationOrder).toHaveLength(2);
      // Higher priority first
      expect(result.evaluationOrder[0]!.rule.id).toBe('meta-1');
      expect(result.evaluationOrder[1]!.rule.id).toBe('file-1');
    });

    it('should respect metadata-first mode in evaluation order', () => {
      const metaRule = createMetadataRule({ id: 'meta-1', priority: 1 });
      const fileRule = createFilenameRule({ id: 'file-1', priority: 10 });
      const config = createConfig([metaRule], [fileRule], 'metadata-first');
      const fileInfo = createFileInfo();
      const metadata = createMetadata();

      const result = previewRulePriority(fileInfo, metadata, config);

      // Metadata rules first regardless of priority
      expect(result.evaluationOrder[0]!.rule.id).toBe('meta-1');
      expect(result.evaluationOrder[1]!.rule.id).toBe('file-1');
    });

    it('should respect filename-first mode in evaluation order', () => {
      const metaRule = createMetadataRule({ id: 'meta-1', priority: 10 });
      const fileRule = createFilenameRule({ id: 'file-1', priority: 1 });
      const config = createConfig([metaRule], [fileRule], 'filename-first');
      const fileInfo = createFileInfo();
      const metadata = createMetadata();

      const result = previewRulePriority(fileInfo, metadata, config);

      // Filename rules first regardless of priority
      expect(result.evaluationOrder[0]!.rule.id).toBe('file-1');
      expect(result.evaluationOrder[1]!.rule.id).toBe('meta-1');
    });
  });
});

// =============================================================================
// detectPriorityTies Tests
// =============================================================================

describe('detectPriorityTies', () => {
  it('should return empty array when no ties exist', () => {
    const metaRule1 = createMetadataRule({ id: 'meta-1', priority: 5 });
    const metaRule2 = createMetadataRule({ id: 'meta-2', name: 'Meta 2', priority: 10 });
    const config = createConfig([metaRule1, metaRule2], []);

    const ties = detectPriorityTies(config);

    expect(ties).toHaveLength(0);
  });

  it('should detect ties between metadata rules', () => {
    const metaRule1 = createMetadataRule({ id: 'meta-1', name: 'Meta 1', priority: 5 });
    const metaRule2 = createMetadataRule({ id: 'meta-2', name: 'Meta 2', priority: 5 });
    const config = createConfig([metaRule1, metaRule2], []);

    const ties = detectPriorityTies(config);

    expect(ties).toHaveLength(1);
    expect(ties[0]!.priority).toBe(5);
    expect(ties[0]!.rules).toHaveLength(2);
    expect(ties[0]!.rules.map((r) => r.id)).toContain('meta-1');
    expect(ties[0]!.rules.map((r) => r.id)).toContain('meta-2');
  });

  it('should detect ties between filename rules', () => {
    const fileRule1 = createFilenameRule({ id: 'file-1', name: 'File 1', priority: 3 });
    const fileRule2 = createFilenameRule({ id: 'file-2', name: 'File 2', priority: 3 });
    const config = createConfig([], [fileRule1, fileRule2]);

    const ties = detectPriorityTies(config);

    expect(ties).toHaveLength(1);
    expect(ties[0]!.priority).toBe(3);
  });

  it('should detect ties across rule types', () => {
    const metaRule = createMetadataRule({ id: 'meta-1', priority: 7 });
    const fileRule = createFilenameRule({ id: 'file-1', priority: 7 });
    const config = createConfig([metaRule], [fileRule]);

    const ties = detectPriorityTies(config);

    expect(ties).toHaveLength(1);
    expect(ties[0]!.priority).toBe(7);
    expect(ties[0]!.rules.map((r) => r.type)).toContain('metadata');
    expect(ties[0]!.rules.map((r) => r.type)).toContain('filename');
  });

  it('should detect multiple tie groups', () => {
    const metaRule1 = createMetadataRule({ id: 'meta-1', name: 'M1', priority: 5 });
    const metaRule2 = createMetadataRule({ id: 'meta-2', name: 'M2', priority: 5 });
    const fileRule1 = createFilenameRule({ id: 'file-1', name: 'F1', priority: 10 });
    const fileRule2 = createFilenameRule({ id: 'file-2', name: 'F2', priority: 10 });
    const config = createConfig([metaRule1, metaRule2], [fileRule1, fileRule2]);

    const ties = detectPriorityTies(config);

    expect(ties).toHaveLength(2);
    const tieAt5 = ties.find((t) => t.priority === 5);
    const tieAt10 = ties.find((t) => t.priority === 10);
    expect(tieAt5).toBeDefined();
    expect(tieAt10).toBeDefined();
    expect(tieAt5!.rules).toHaveLength(2);
    expect(tieAt10!.rules).toHaveLength(2);
  });

  it('should include ties in preview result', () => {
    const metaRule1 = createMetadataRule({
      id: 'meta-1',
      name: 'M1',
      priority: 5,
      conditions: [{ field: 'image.cameraMake', operator: 'equals', value: 'Apple' }],
    });
    const metaRule2 = createMetadataRule({
      id: 'meta-2',
      name: 'M2',
      priority: 5,
      conditions: [{ field: 'image.cameraMake', operator: 'contains', value: 'App' }],
    });
    const config = createConfig([metaRule1, metaRule2], []);
    const fileInfo = createFileInfo();
    const metadata = createMetadata();

    const result = previewRulePriority(fileInfo, metadata, config);

    expect(result.priorityTies).toHaveLength(1);
    expect(result.priorityTies[0]!.priority).toBe(5);
  });
});

// =============================================================================
// RulePriorityPreview Type Tests
// =============================================================================

describe('RulePriorityPreview type', () => {
  it('should have correct shape', () => {
    const config = createConfig([], []);
    const fileInfo = createFileInfo();
    const metadata = createMetadata();

    const result = previewRulePriority(fileInfo, metadata, config);

    // Verify all expected properties exist
    expect(result).toHaveProperty('evaluationOrder');
    expect(result).toHaveProperty('winningRule');
    expect(result).toHaveProperty('matchedButLost');
    expect(result).toHaveProperty('priorityTies');

    // Verify types
    expect(Array.isArray(result.evaluationOrder)).toBe(true);
    expect(Array.isArray(result.matchedButLost)).toBe(true);
    expect(Array.isArray(result.priorityTies)).toBe(true);
  });
});
