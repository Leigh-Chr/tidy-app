/**
 * @fileoverview Tests for preview-with-rules - Story 7.3
 */

import { describe, it, expect } from 'vitest';
import {
  generatePreviewWithRules,
  type GeneratePreviewWithRulesOptions,
} from './preview-with-rules.js';
import type { FileInfo } from '../types/file-info.js';
import type { UnifiedMetadata } from '../types/unified-metadata.js';
import type { MetadataPatternRule } from '../types/rule.js';
import type { FilenamePatternRule } from '../types/filename-rule.js';
import type { Template } from '../config/schema.js';
import { FileCategory } from '../types/file-category.js';
import { MetadataCapability } from '../types/metadata-capability.js';

// =============================================================================
// Test Fixtures
// =============================================================================

const createFileInfo = (overrides: Partial<FileInfo> = {}): FileInfo => ({
  path: '/test/IMG_1234.jpg',
  name: 'IMG_1234',
  extension: 'jpg', // Extension without leading dot per FileInfo schema
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

const createUnifiedMetadata = (
  fileInfo: FileInfo,
  overrides: Partial<UnifiedMetadata> = {}
): UnifiedMetadata => ({
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

const createTemplate = (id: string, name: string, pattern: string): Template => ({
  id,
  name,
  pattern,
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
  conditions: MetadataPatternRule['conditions'] = [
    { field: 'image.cameraMake', operator: 'contains', value: 'Apple', caseSensitive: false },
  ],
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

describe('generatePreviewWithRules', () => {
  describe('basic functionality', () => {
    it('should generate preview using default template when no rules match', () => {
      const file = createFileInfo();
      const metadata = createUnifiedMetadata(file, { image: null }); // No image metadata
      const metadataMap = new Map<string, UnifiedMetadata>([[file.path, metadata]]);

      const templates = [
        createTemplate('default-t', 'Default', '{original}'),
        createTemplate('rule-t', 'Rule Template', '{camera}-{original}'),
      ];

      const metadataRules = [
        createMetadataRule('r1', 'Apple Rule', 'rule-t', 10), // Won't match - no image metadata
      ];

      const options: GeneratePreviewWithRulesOptions = {
        metadataRules,
        filenameRules: [],
        templates,
        defaultTemplateId: 'default-t',
      };

      const result = generatePreviewWithRules([file], metadataMap, options);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.proposals).toHaveLength(1);
        expect(result.data.proposals[0]!.templateSource).toBe('default');
        expect(result.data.proposals[0]!.appliedRule).toBeUndefined();
      }
    });

    it('should use rule template when metadata rule matches', () => {
      const file = createFileInfo();
      const metadata = createUnifiedMetadata(file); // Has Apple cameraMake
      const metadataMap = new Map<string, UnifiedMetadata>([[file.path, metadata]]);

      const templates = [
        createTemplate('default-t', 'Default', '{original}'),
        createTemplate('apple-t', 'Apple Template', 'APPLE-{original}'),
      ];

      const metadataRules = [
        createMetadataRule('apple-rule', 'Apple Photos', 'apple-t', 10),
      ];

      const options: GeneratePreviewWithRulesOptions = {
        metadataRules,
        filenameRules: [],
        templates,
        defaultTemplateId: 'default-t',
        caseNormalization: 'none',
      };

      const result = generatePreviewWithRules([file], metadataMap, options);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.proposals).toHaveLength(1);
        expect(result.data.proposals[0]!.templateSource).toBe('rule');
        expect(result.data.proposals[0]!.appliedRule).toEqual({
          ruleId: 'apple-rule',
          ruleName: 'Apple Photos',
          ruleType: 'metadata',
        });
        // Note: sanitization converts APPLE-IMG_1234 to APPLE_IMG_1234 (collapses -_ sequences)
        expect(result.data.proposals[0]!.proposedName).toBe('APPLE_IMG_1234.jpg');
      }
    });

    it('should use rule template when filename rule matches', () => {
      const file = createFileInfo();
      const metadata = createUnifiedMetadata(file, { image: null });
      const metadataMap = new Map<string, UnifiedMetadata>([[file.path, metadata]]);

      const templates = [
        createTemplate('default-t', 'Default', '{original}'),
        createTemplate('img-t', 'IMG Template', 'PHOTO-{original}'),
      ];

      const filenameRules = [
        createFilenameRule('img-rule', 'IMG Files', 'IMG_*.jpg', 'img-t', 10),
      ];

      const options: GeneratePreviewWithRulesOptions = {
        metadataRules: [],
        filenameRules,
        templates,
        defaultTemplateId: 'default-t',
        caseNormalization: 'none',
      };

      const result = generatePreviewWithRules([file], metadataMap, options);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.proposals).toHaveLength(1);
        expect(result.data.proposals[0]!.templateSource).toBe('rule');
        expect(result.data.proposals[0]!.appliedRule).toEqual({
          ruleId: 'img-rule',
          ruleName: 'IMG Files',
          ruleType: 'filename',
        });
        // Note: sanitization converts PHOTO-IMG_1234 to PHOTO_IMG_1234
        expect(result.data.proposals[0]!.proposedName).toBe('PHOTO_IMG_1234.jpg');
      }
    });
  });

  describe('priority handling', () => {
    it('should use highest priority matching rule', () => {
      const file = createFileInfo();
      const metadata = createUnifiedMetadata(file);
      const metadataMap = new Map<string, UnifiedMetadata>([[file.path, metadata]]);

      const templates = [
        createTemplate('default-t', 'Default', '{original}'),
        createTemplate('low-t', 'Low', 'LOW-{original}'),
        createTemplate('high-t', 'High', 'HIGH-{original}'),
      ];

      const metadataRules = [
        createMetadataRule('low-rule', 'Low Priority', 'low-t', 5),
        createMetadataRule('high-rule', 'High Priority', 'high-t', 10),
      ];

      const options: GeneratePreviewWithRulesOptions = {
        metadataRules,
        filenameRules: [],
        templates,
        defaultTemplateId: 'default-t',
        caseNormalization: 'none',
      };

      const result = generatePreviewWithRules([file], metadataMap, options);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.proposals[0]!.appliedRule?.ruleId).toBe('high-rule');
        // Note: sanitization converts HIGH-IMG_1234 to HIGH_IMG_1234
        expect(result.data.proposals[0]!.proposedName).toBe('HIGH_IMG_1234.jpg');
      }
    });

    it('should respect combined priority mode by default', () => {
      const file = createFileInfo();
      const metadata = createUnifiedMetadata(file);
      const metadataMap = new Map<string, UnifiedMetadata>([[file.path, metadata]]);

      const templates = [
        createTemplate('default-t', 'Default', '{original}'),
        createTemplate('meta-t', 'Metadata', 'META-{original}'),
        createTemplate('file-t', 'Filename', 'FILE-{original}'),
      ];

      const metadataRules = [
        createMetadataRule('meta-rule', 'Metadata Rule', 'meta-t', 5),
      ];

      const filenameRules = [
        createFilenameRule('file-rule', 'Filename Rule', 'IMG_*.jpg', 'file-t', 10), // Higher priority
      ];

      const options: GeneratePreviewWithRulesOptions = {
        metadataRules,
        filenameRules,
        templates,
        defaultTemplateId: 'default-t',
        rulePriorityMode: 'combined',
      };

      const result = generatePreviewWithRules([file], metadataMap, options);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.proposals[0]!.appliedRule?.ruleId).toBe('file-rule');
      }
    });

    it('should respect metadata-first priority mode', () => {
      const file = createFileInfo();
      const metadata = createUnifiedMetadata(file);
      const metadataMap = new Map<string, UnifiedMetadata>([[file.path, metadata]]);

      const templates = [
        createTemplate('default-t', 'Default', '{original}'),
        createTemplate('meta-t', 'Metadata', 'META-{original}'),
        createTemplate('file-t', 'Filename', 'FILE-{original}'),
      ];

      const metadataRules = [
        createMetadataRule('meta-rule', 'Metadata Rule', 'meta-t', 5), // Lower priority
      ];

      const filenameRules = [
        createFilenameRule('file-rule', 'Filename Rule', 'IMG_*.jpg', 'file-t', 100), // Higher priority
      ];

      const options: GeneratePreviewWithRulesOptions = {
        metadataRules,
        filenameRules,
        templates,
        defaultTemplateId: 'default-t',
        rulePriorityMode: 'metadata-first', // Metadata rules evaluated first
      };

      const result = generatePreviewWithRules([file], metadataMap, options);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Metadata rule should win because metadata-first
        expect(result.data.proposals[0]!.appliedRule?.ruleId).toBe('meta-rule');
      }
    });
  });

  describe('missing template handling (AC6)', () => {
    it('should fall back to default template with warning when rule template is missing', () => {
      const file = createFileInfo();
      const metadata = createUnifiedMetadata(file);
      const metadataMap = new Map<string, UnifiedMetadata>([[file.path, metadata]]);

      const templates = [
        createTemplate('default-t', 'Default', 'DEFAULT-{original}'),
        // Note: 'missing-t' is NOT in templates - rule references non-existent template
      ];

      const metadataRules = [
        createMetadataRule('apple-rule', 'Apple Photos', 'missing-t', 10), // Template doesn't exist!
      ];

      const options: GeneratePreviewWithRulesOptions = {
        metadataRules,
        filenameRules: [],
        templates,
        defaultTemplateId: 'default-t',
        caseNormalization: 'none',
      };

      const result = generatePreviewWithRules([file], metadataMap, options);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.proposals).toHaveLength(1);
        expect(result.data.proposals[0]!.templateSource).toBe('fallback');
        expect(result.data.proposals[0]!.appliedRule).toBeUndefined(); // No rule applied
        // Should have a warning issue about missing template
        expect(result.data.proposals[0]!.issues.some((i) => i.code === 'RULE_TEMPLATE_MISSING')).toBe(
          true
        );
        // Should use default template
        // Note: sanitization converts DEFAULT-IMG_1234 to DEFAULT_IMG_1234
        expect(result.data.proposals[0]!.proposedName).toBe('DEFAULT_IMG_1234.jpg');
      }
    });
  });

  describe('multiple files', () => {
    it('should process multiple files with different rules', () => {
      const imgFile = createFileInfo();
      const pdfFile = createFileInfo({
        path: '/test/report.pdf',
        name: 'report',
        extension: 'pdf',
        fullName: 'report.pdf',
        category: FileCategory.DOCUMENT,
      });

      const imgMetadata = createUnifiedMetadata(imgFile);
      const pdfMetadata = createUnifiedMetadata(pdfFile, { image: null });

      const metadataMap = new Map<string, UnifiedMetadata>([
        [imgFile.path, imgMetadata],
        [pdfFile.path, pdfMetadata],
      ]);

      const templates = [
        createTemplate('default-t', 'Default', '{original}'),
        createTemplate('photo-t', 'Photos', 'PHOTO-{original}'),
        createTemplate('doc-t', 'Documents', 'DOC-{original}'),
      ];

      const metadataRules = [
        createMetadataRule('photo-rule', 'Photos', 'photo-t', 10),
      ];

      const filenameRules = [
        createFilenameRule('pdf-rule', 'PDFs', '*.pdf', 'doc-t', 10),
      ];

      const options: GeneratePreviewWithRulesOptions = {
        metadataRules,
        filenameRules,
        templates,
        defaultTemplateId: 'default-t',
        caseNormalization: 'none',
      };

      const result = generatePreviewWithRules([imgFile, pdfFile], metadataMap, options);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.proposals).toHaveLength(2);

        // IMG file should match metadata rule
        const imgProposal = result.data.proposals.find((p) =>
          p.originalPath.includes('IMG_1234')
        );
        expect(imgProposal?.appliedRule?.ruleId).toBe('photo-rule');
        // Note: sanitization converts PHOTO-IMG_1234 to PHOTO_IMG_1234
        expect(imgProposal?.proposedName).toBe('PHOTO_IMG_1234.jpg');

        // PDF file should match filename rule
        const pdfProposal = result.data.proposals.find((p) => p.originalPath.includes('report'));
        expect(pdfProposal?.appliedRule?.ruleId).toBe('pdf-rule');
        // Note: sanitization converts DOC-report to DOC_report
        expect(pdfProposal?.proposedName).toBe('DOC_report.pdf');
      }
    });
  });

  describe('summary statistics', () => {
    it('should include summary in result', () => {
      const file = createFileInfo();
      const metadata = createUnifiedMetadata(file);
      const metadataMap = new Map<string, UnifiedMetadata>([[file.path, metadata]]);

      const templates = [createTemplate('default-t', 'Default', '{original}')];

      const options: GeneratePreviewWithRulesOptions = {
        metadataRules: [],
        filenameRules: [],
        templates,
        defaultTemplateId: 'default-t',
      };

      const result = generatePreviewWithRules([file], metadataMap, options);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.summary).toBeDefined();
        expect(result.data.summary.total).toBe(1);
        expect(result.data.generatedAt).toBeInstanceOf(Date);
      }
    });
  });

  describe('edge cases', () => {
    it('should handle empty files array', () => {
      const metadataMap = new Map<string, UnifiedMetadata>();

      const templates = [createTemplate('default-t', 'Default', '{original}')];

      const options: GeneratePreviewWithRulesOptions = {
        metadataRules: [],
        filenameRules: [],
        templates,
        defaultTemplateId: 'default-t',
      };

      const result = generatePreviewWithRules([], metadataMap, options);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.proposals).toHaveLength(0);
        expect(result.data.summary.total).toBe(0);
      }
    });

    it('should handle file with no metadata in map', () => {
      const file = createFileInfo();
      const metadataMap = new Map<string, UnifiedMetadata>(); // Empty map

      const templates = [createTemplate('default-t', 'Default', '{original}')];

      const options: GeneratePreviewWithRulesOptions = {
        metadataRules: [],
        filenameRules: [],
        templates,
        defaultTemplateId: 'default-t',
      };

      const result = generatePreviewWithRules([file], metadataMap, options);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.proposals).toHaveLength(1);
        expect(result.data.proposals[0]!.templateSource).toBe('default');
      }
    });

    it('should skip disabled rules', () => {
      const file = createFileInfo();
      const metadata = createUnifiedMetadata(file);
      const metadataMap = new Map<string, UnifiedMetadata>([[file.path, metadata]]);

      const templates = [
        createTemplate('default-t', 'Default', '{original}'),
        createTemplate('disabled-t', 'Disabled', 'DISABLED-{original}'),
      ];

      const metadataRules = [
        createMetadataRule('disabled-rule', 'Disabled Rule', 'disabled-t', 100, undefined, false), // disabled
      ];

      const options: GeneratePreviewWithRulesOptions = {
        metadataRules,
        filenameRules: [],
        templates,
        defaultTemplateId: 'default-t',
      };

      const result = generatePreviewWithRules([file], metadataMap, options);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Disabled rule should not match
        expect(result.data.proposals[0]!.templateSource).toBe('default');
        expect(result.data.proposals[0]!.appliedRule).toBeUndefined();
      }
    });
  });

  // =============================================================================
  // Story 8.2: Folder Structure Integration Tests
  // =============================================================================

  describe('folder structure integration (Story 8.2)', () => {
    it('should set isMoveOperation when rule has folderStructureId and folder changes', () => {
      const file = createFileInfo({ path: '/source/IMG_1234.jpg' });
      const metadata = createUnifiedMetadata(file);
      const metadataMap = new Map<string, UnifiedMetadata>([[file.path, metadata]]);

      const templates = [
        createTemplate('default-t', 'Default', '{original}'),
        createTemplate('apple-t', 'Apple Template', '{original}'),
      ];

      const folderStructures = [
        {
          id: 'fs-1',
          name: 'By Year/Month',
          pattern: '{year}/{month}',
          description: 'Organize by date',
          enabled: true,
          priority: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const metadataRules: MetadataPatternRule[] = [
        {
          ...createMetadataRule('apple-rule', 'Apple Photos', 'apple-t', 10),
          folderStructureId: 'fs-1',
        },
      ];

      const options: GeneratePreviewWithRulesOptions = {
        metadataRules,
        filenameRules: [],
        templates,
        defaultTemplateId: 'default-t',
        folderStructures,
      };

      const result = generatePreviewWithRules([file], metadataMap, options);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.proposals).toHaveLength(1);
        const proposal = result.data.proposals[0]!;
        expect(proposal.isMoveOperation).toBe(true);
        expect(proposal.folderStructureId).toBe('fs-1');
        // Proposed path should include the resolved folder structure
        expect(proposal.proposedPath).toContain('2026');
        expect(proposal.proposedPath).toContain('01');
      }
    });

    it('should not set isMoveOperation when rule has no folderStructureId', () => {
      const file = createFileInfo({ path: '/source/IMG_1234.jpg' });
      const metadata = createUnifiedMetadata(file);
      const metadataMap = new Map<string, UnifiedMetadata>([[file.path, metadata]]);

      const templates = [
        createTemplate('default-t', 'Default', '{original}'),
        createTemplate('apple-t', 'Apple Template', 'APPLE-{original}'),
      ];

      const metadataRules = [
        createMetadataRule('apple-rule', 'Apple Photos', 'apple-t', 10),
      ];

      const options: GeneratePreviewWithRulesOptions = {
        metadataRules,
        filenameRules: [],
        templates,
        defaultTemplateId: 'default-t',
      };

      const result = generatePreviewWithRules([file], metadataMap, options);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.proposals).toHaveLength(1);
        const proposal = result.data.proposals[0]!;
        expect(proposal.isMoveOperation).toBeUndefined();
        expect(proposal.folderStructureId).toBeUndefined();
      }
    });

    it('should use baseDirectory when provided', () => {
      const file = createFileInfo({ path: '/source/IMG_1234.jpg' });
      const metadata = createUnifiedMetadata(file);
      const metadataMap = new Map<string, UnifiedMetadata>([[file.path, metadata]]);

      const templates = [
        createTemplate('default-t', 'Default', '{original}'),
        createTemplate('apple-t', 'Apple Template', '{original}'),
      ];

      const folderStructures = [
        {
          id: 'fs-1',
          name: 'By Year/Month',
          pattern: '{year}/{month}',
          description: 'Organize by date',
          enabled: true,
          priority: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const metadataRules: MetadataPatternRule[] = [
        {
          ...createMetadataRule('apple-rule', 'Apple Photos', 'apple-t', 10),
          folderStructureId: 'fs-1',
        },
      ];

      const options: GeneratePreviewWithRulesOptions = {
        metadataRules,
        filenameRules: [],
        templates,
        defaultTemplateId: 'default-t',
        folderStructures,
        baseDirectory: '/home/user/organized',
      };

      const result = generatePreviewWithRules([file], metadataMap, options);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.proposals).toHaveLength(1);
        const proposal = result.data.proposals[0]!;
        expect(proposal.proposedPath).toContain('/home/user/organized');
      }
    });

    it('should flag MISSING_DATA when folder structure placeholders cannot be resolved', () => {
      const file = createFileInfo({
        path: '/source/DOC_1234.docx',
        name: 'DOC_1234',
        extension: 'docx',
        fullName: 'DOC_1234.docx',
        category: FileCategory.DOCUMENT,
      });
      // No metadata - can't resolve date placeholders from type-specific metadata
      const metadata: UnifiedMetadata = {
        file,
        image: null,
        pdf: null,
        office: null,
        extractionStatus: 'unsupported',
        extractionError: null,
      };
      const metadataMap = new Map<string, UnifiedMetadata>([[file.path, metadata]]);

      const templates = [
        createTemplate('default-t', 'Default', '{original}'),
      ];

      const folderStructures = [
        {
          id: 'fs-1',
          name: 'By Camera',
          pattern: '{camera}/{location}', // Can't be resolved without image metadata
          description: 'Organize by camera and location',
          enabled: true,
          priority: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const filenameRules: FilenamePatternRule[] = [
        {
          ...createFilenameRule('doc-rule', 'Doc Rule', 'DOC_*', 'default-t', 10),
          folderStructureId: 'fs-1',
        },
      ];

      const options: GeneratePreviewWithRulesOptions = {
        metadataRules: [],
        filenameRules,
        templates,
        defaultTemplateId: 'default-t',
        folderStructures,
      };

      const result = generatePreviewWithRules([file], metadataMap, options);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.proposals).toHaveLength(1);
        const proposal = result.data.proposals[0]!;
        // AC7: file should be flagged with MISSING_DATA status
        expect(proposal.status).toBe('missing-data');
        // Should have a folder resolution issue
        const folderIssue = proposal.issues.find((i) => i.code === 'FOLDER_RESOLUTION_FAILED');
        expect(folderIssue).toBeDefined();
        expect(folderIssue!.message).toContain('Missing required metadata');
      }
    });

    it('should use highest priority rule folder structure when multiple rules match', () => {
      const file = createFileInfo({ path: '/source/IMG_1234.jpg' });
      const metadata = createUnifiedMetadata(file);
      const metadataMap = new Map<string, UnifiedMetadata>([[file.path, metadata]]);

      const templates = [
        createTemplate('default-t', 'Default', '{original}'),
        createTemplate('high-t', 'High Priority', '{original}'),
        createTemplate('low-t', 'Low Priority', '{original}'),
      ];

      const folderStructures = [
        {
          id: 'fs-high',
          name: 'High Priority Folders',
          pattern: 'high/{year}',
          description: '',
          enabled: true,
          priority: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'fs-low',
          name: 'Low Priority Folders',
          pattern: 'low/{year}',
          description: '',
          enabled: true,
          priority: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const metadataRules: MetadataPatternRule[] = [
        {
          ...createMetadataRule('high-rule', 'High Priority Rule', 'high-t', 100),
          folderStructureId: 'fs-high',
        },
        {
          ...createMetadataRule('low-rule', 'Low Priority Rule', 'low-t', 10, [
            { field: 'image.cameraMake', operator: 'exists', caseSensitive: false },
          ]),
          folderStructureId: 'fs-low',
        },
      ];

      const options: GeneratePreviewWithRulesOptions = {
        metadataRules,
        filenameRules: [],
        templates,
        defaultTemplateId: 'default-t',
        folderStructures,
      };

      const result = generatePreviewWithRules([file], metadataMap, options);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.proposals).toHaveLength(1);
        const proposal = result.data.proposals[0]!;
        // Should use high priority folder structure
        expect(proposal.folderStructureId).toBe('fs-high');
        expect(proposal.proposedPath).toContain('high');
      }
    });
  });

  // =============================================================================
  // Story 8.3: Move Statistics in Preview Summary
  // =============================================================================

  describe('move statistics in summary (Story 8.3)', () => {
    it('should count move operations in summary', () => {
      const file1 = createFileInfo({ path: '/test/photos/IMG_001.jpg', name: 'IMG_001' });
      const file2 = createFileInfo({ path: '/test/photos/IMG_002.jpg', name: 'IMG_002' });
      const metadata1 = createUnifiedMetadata(file1);
      const metadata2 = createUnifiedMetadata(file2);
      const metadataMap = new Map<string, UnifiedMetadata>([
        [file1.path, metadata1],
        [file2.path, metadata2],
      ]);

      const folderStructures = [
        {
          id: 'fs-1',
          name: 'By Year',
          pattern: '{year}',
          description: 'Organize by year',
          enabled: true,
          priority: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const templates = [createTemplate('default-t', 'Default', '{original}')];
      const metadataRules: MetadataPatternRule[] = [
        {
          ...createMetadataRule('r1', 'Apple Rule', 'default-t', 10),
          folderStructureId: 'fs-1',
        },
      ];

      const options: GeneratePreviewWithRulesOptions = {
        metadataRules,
        filenameRules: [],
        templates,
        defaultTemplateId: 'default-t',
        folderStructures,
      };

      const result = generatePreviewWithRules([file1, file2], metadataMap, options);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.proposals).toHaveLength(2);
        // Both files should be move operations
        expect(result.data.proposals[0]!.isMoveOperation).toBe(true);
        expect(result.data.proposals[1]!.isMoveOperation).toBe(true);
        // Summary should include move operation count
        expect(result.data.summary.moveOperations).toBe(2);
        expect(result.data.summary.renameOnly).toBe(0);
      }
    });

    it('should count rename-only operations separately', () => {
      const file1 = createFileInfo({ path: '/test/photos/IMG_001.jpg', name: 'IMG_001' });
      const file2 = createFileInfo({ path: '/test/photos/IMG_002.jpg', name: 'IMG_002' });
      const metadata1 = createUnifiedMetadata(file1);
      const metadata2 = createUnifiedMetadata(file2, { image: null }); // No metadata - won't match rule
      const metadataMap = new Map<string, UnifiedMetadata>([
        [file1.path, metadata1],
        [file2.path, metadata2],
      ]);

      const folderStructures = [
        {
          id: 'fs-1',
          name: 'By Year',
          pattern: '{year}',
          description: 'Organize by year',
          enabled: true,
          priority: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const templates = [createTemplate('default-t', 'Default', '{original}')];
      const metadataRules: MetadataPatternRule[] = [
        {
          ...createMetadataRule('r1', 'Apple Rule', 'default-t', 10),
          folderStructureId: 'fs-1', // Only applies when rule matches
        },
      ];

      const options: GeneratePreviewWithRulesOptions = {
        metadataRules,
        filenameRules: [],
        templates,
        defaultTemplateId: 'default-t',
        folderStructures,
      };

      const result = generatePreviewWithRules([file1, file2], metadataMap, options);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.proposals).toHaveLength(2);
        // File1 should be move (rule matched), file2 should not (no rule match)
        expect(result.data.proposals[0]!.isMoveOperation).toBe(true);
        expect(result.data.proposals[1]!.isMoveOperation).toBeUndefined();
        // Summary counts
        expect(result.data.summary.moveOperations).toBe(1);
        expect(result.data.summary.renameOnly).toBe(1);
      }
    });

    it('should handle all rename-only operations', () => {
      const file = createFileInfo();
      const metadata = createUnifiedMetadata(file);
      const metadataMap = new Map<string, UnifiedMetadata>([[file.path, metadata]]);

      const templates = [createTemplate('default-t', 'Default', '{year}_{original}')];

      const options: GeneratePreviewWithRulesOptions = {
        metadataRules: [],
        filenameRules: [],
        templates,
        defaultTemplateId: 'default-t',
        // No folder structures - all operations are rename-only
      };

      const result = generatePreviewWithRules([file], metadataMap, options);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.proposals).toHaveLength(1);
        expect(result.data.proposals[0]!.isMoveOperation).toBeUndefined();
        expect(result.data.summary.moveOperations).toBe(0);
        expect(result.data.summary.renameOnly).toBe(1);
      }
    });

    it('should handle empty proposals', () => {
      const metadataMap = new Map<string, UnifiedMetadata>();
      const templates = [createTemplate('default-t', 'Default', '{original}')];

      const options: GeneratePreviewWithRulesOptions = {
        metadataRules: [],
        filenameRules: [],
        templates,
        defaultTemplateId: 'default-t',
      };

      const result = generatePreviewWithRules([], metadataMap, options);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.proposals).toHaveLength(0);
        expect(result.data.summary.moveOperations).toBe(0);
        expect(result.data.summary.renameOnly).toBe(0);
      }
    });
  });

  // =============================================================================
  // Story 10.3: LLM Suggestion Integration
  // =============================================================================

  describe('LLM suggestion integration (Story 10.3)', () => {
    // Use {name} placeholder which uses AI suggestion if available, otherwise original filename
    const templates = [createTemplate('default-t', 'Default', '{name}')];
    const metadataMap = new Map<string, UnifiedMetadata>();

    it('uses LLM suggestion when confidence meets threshold', () => {
      const file = createFileInfo({
        path: '/docs/document.txt',
        name: 'document',
        extension: 'txt',
        fullName: 'document.txt',
      });
      const files = [file];

      // Create a mock LLM analysis result
      const llmAnalysisResults = new Map([
        [
          file.path,
          {
            filePath: file.path,
            suggestion: {
              suggestedName: 'quarterly-sales-report',
              confidence: 0.9,
              reasoning: 'Document discusses Q3 sales',
              keywords: ['sales', 'quarterly'],
            },
            modelUsed: 'mistral',
            processingTimeMs: 1000,
            analyzedAt: new Date().toISOString(),
            contentTruncated: false,
          },
        ],
      ]);

      const options: GeneratePreviewWithRulesOptions = {
        templates,
        defaultTemplateId: 'default-t',
        enableLlmAnalysis: true,
        llmAnalysisResults,
        llmConfidenceThreshold: 0.7,
      };

      const result = generatePreviewWithRules(files, metadataMap, options);

      expect(result.ok).toBe(true);
      if (result.ok) {
        const proposal = result.data.proposals[0];
        expect(proposal).toBeDefined();
        expect(proposal?.proposedName).toBe('quarterly-sales-report.txt');
        expect(proposal?.templateSource).toBe('llm');
        expect(proposal?.useLlmSuggestion).toBe(true);
        expect(proposal?.llmSuggestion?.suggestedName).toBe('quarterly-sales-report');
        expect(proposal?.llmSuggestion?.confidence).toBe(0.9);
        expect(result.data.summary.llmSuggested).toBe(1);
      }
    });

    it('falls back to template when confidence is below threshold', () => {
      const file = createFileInfo({
        path: '/docs/document.txt',
        name: 'document',
        extension: 'txt',
        fullName: 'document.txt',
      });
      const files = [file];

      // Low confidence LLM result
      const llmAnalysisResults = new Map([
        [
          file.path,
          {
            filePath: file.path,
            suggestion: {
              suggestedName: 'low-confidence-name',
              confidence: 0.4,
              reasoning: 'Not very sure',
              keywords: [],
            },
            modelUsed: 'mistral',
            processingTimeMs: 1000,
            analyzedAt: new Date().toISOString(),
            contentTruncated: false,
          },
        ],
      ]);

      const options: GeneratePreviewWithRulesOptions = {
        templates,
        defaultTemplateId: 'default-t',
        enableLlmAnalysis: true,
        llmAnalysisResults,
        llmConfidenceThreshold: 0.7,
      };

      const result = generatePreviewWithRules(files, metadataMap, options);

      expect(result.ok).toBe(true);
      if (result.ok) {
        const proposal = result.data.proposals[0];
        expect(proposal).toBeDefined();
        // Should use template name, not LLM suggestion
        expect(proposal?.proposedName).toBe('document.txt');
        expect(proposal?.templateSource).toBe('default');
        // useLlmSuggestion is false (not undefined) when LLM exists but not used
        expect(proposal?.useLlmSuggestion).toBe(false);
        // LLM suggestion is still included for reference
        expect(proposal?.llmSuggestion?.suggestedName).toBe('low-confidence-name');
        expect(result.data.summary.llmSuggested).toBe(0);
      }
    });

    it('uses template when enableLlmAnalysis is false', () => {
      const file = createFileInfo({
        path: '/docs/document.txt',
        name: 'document',
        extension: 'txt',
        fullName: 'document.txt',
      });
      const files = [file];

      // Even with high confidence, LLM is disabled
      const llmAnalysisResults = new Map([
        [
          file.path,
          {
            filePath: file.path,
            suggestion: {
              suggestedName: 'should-not-use',
              confidence: 0.95,
              reasoning: 'High confidence',
              keywords: [],
            },
            modelUsed: 'mistral',
            processingTimeMs: 1000,
            analyzedAt: new Date().toISOString(),
            contentTruncated: false,
          },
        ],
      ]);

      const options: GeneratePreviewWithRulesOptions = {
        templates,
        defaultTemplateId: 'default-t',
        enableLlmAnalysis: false,
        llmAnalysisResults,
      };

      const result = generatePreviewWithRules(files, metadataMap, options);

      expect(result.ok).toBe(true);
      if (result.ok) {
        const proposal = result.data.proposals[0];
        expect(proposal).toBeDefined();
        expect(proposal?.proposedName).toBe('document.txt');
        expect(proposal?.templateSource).toBe('default');
        expect(proposal?.llmSuggestion).toBeUndefined();
        expect(proposal?.useLlmSuggestion).toBeUndefined();
      }
    });

    it('handles files without LLM results gracefully', () => {
      const file1 = createFileInfo({
        path: '/docs/with-llm.txt',
        name: 'with-llm',
        extension: 'txt',
        fullName: 'with-llm.txt',
      });
      const file2 = createFileInfo({
        path: '/docs/without-llm.txt',
        name: 'without-llm',
        extension: 'txt',
        fullName: 'without-llm.txt',
      });
      const files = [file1, file2];

      // Only file1 has LLM result
      const llmAnalysisResults = new Map([
        [
          file1.path,
          {
            filePath: file1.path,
            suggestion: {
              suggestedName: 'analyzed-document',
              confidence: 0.85,
              reasoning: 'Good analysis',
              keywords: [],
            },
            modelUsed: 'mistral',
            processingTimeMs: 1000,
            analyzedAt: new Date().toISOString(),
            contentTruncated: false,
          },
        ],
      ]);

      const options: GeneratePreviewWithRulesOptions = {
        templates,
        defaultTemplateId: 'default-t',
        enableLlmAnalysis: true,
        llmAnalysisResults,
        llmConfidenceThreshold: 0.7,
      };

      const result = generatePreviewWithRules(files, metadataMap, options);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.proposals).toHaveLength(2);

        // First file uses LLM
        const proposal1 = result.data.proposals[0];
        expect(proposal1?.proposedName).toBe('analyzed-document.txt');
        expect(proposal1?.useLlmSuggestion).toBe(true);

        // Second file uses template
        const proposal2 = result.data.proposals[1];
        expect(proposal2?.proposedName).toBe('without-llm.txt');
        expect(proposal2?.useLlmSuggestion).toBeUndefined();

        expect(result.data.summary.llmSuggested).toBe(1);
      }
    });

    it('adds informational issue when using LLM suggestion', () => {
      const file = createFileInfo({
        path: '/docs/document.txt',
        name: 'document',
        extension: 'txt',
        fullName: 'document.txt',
      });
      const files = [file];

      const llmAnalysisResults = new Map([
        [
          file.path,
          {
            filePath: file.path,
            suggestion: {
              suggestedName: 'ai-named-file',
              confidence: 0.88,
              reasoning: 'AI suggestion',
              keywords: [],
            },
            modelUsed: 'mistral',
            processingTimeMs: 1000,
            analyzedAt: new Date().toISOString(),
            contentTruncated: false,
          },
        ],
      ]);

      const options: GeneratePreviewWithRulesOptions = {
        templates,
        defaultTemplateId: 'default-t',
        enableLlmAnalysis: true,
        llmAnalysisResults,
        llmConfidenceThreshold: 0.7,
      };

      const result = generatePreviewWithRules(files, metadataMap, options);

      expect(result.ok).toBe(true);
      if (result.ok) {
        const proposal = result.data.proposals[0];
        expect(proposal).toBeDefined();
        const llmIssue = proposal?.issues.find((i) => i.code === 'LLM_SUGGESTION_USED');
        expect(llmIssue).toBeDefined();
        expect(llmIssue?.message).toContain('88%');
      }
    });

    it('respects custom confidence threshold', () => {
      const file = createFileInfo({
        path: '/docs/document.txt',
        name: 'document',
        extension: 'txt',
        fullName: 'document.txt',
      });
      const files = [file];

      const llmAnalysisResults = new Map([
        [
          file.path,
          {
            filePath: file.path,
            suggestion: {
              suggestedName: 'medium-confidence',
              confidence: 0.6,
              reasoning: 'Medium confidence',
              keywords: [],
            },
            modelUsed: 'mistral',
            processingTimeMs: 1000,
            analyzedAt: new Date().toISOString(),
            contentTruncated: false,
          },
        ],
      ]);

      // Set threshold to 0.5 so 0.6 confidence should pass
      const options: GeneratePreviewWithRulesOptions = {
        templates,
        defaultTemplateId: 'default-t',
        enableLlmAnalysis: true,
        llmAnalysisResults,
        llmConfidenceThreshold: 0.5,
      };

      const result = generatePreviewWithRules(files, metadataMap, options);

      expect(result.ok).toBe(true);
      if (result.ok) {
        const proposal = result.data.proposals[0];
        expect(proposal?.useLlmSuggestion).toBe(true);
        expect(proposal?.proposedName).toBe('medium-confidence.txt');
      }
    });

    it('adds LLM_ANALYSIS_FAILED issue when LLM enabled but no result exists (AC4)', () => {
      const file = createFileInfo({
        path: '/docs/failed-analysis.txt',
        name: 'failed-analysis',
        extension: 'txt',
        fullName: 'failed-analysis.txt',
      });
      const files = [file];

      // Empty map simulates all analyses failing
      const llmAnalysisResults = new Map<string, never>();

      const options: GeneratePreviewWithRulesOptions = {
        templates,
        defaultTemplateId: 'default-t',
        enableLlmAnalysis: true,
        llmAnalysisResults, // Provided but empty - file has no result
        llmConfidenceThreshold: 0.7,
      };

      const result = generatePreviewWithRules(files, metadataMap, options);

      expect(result.ok).toBe(true);
      if (result.ok) {
        const proposal = result.data.proposals[0];
        expect(proposal).toBeDefined();
        // Should use template-based name (fallback)
        expect(proposal?.proposedName).toBe('failed-analysis.txt');
        expect(proposal?.templateSource).toBe('default');
        expect(proposal?.useLlmSuggestion).toBeUndefined();
        expect(proposal?.llmSuggestion).toBeUndefined();
        // Should have LLM_ANALYSIS_FAILED issue
        const failedIssue = proposal?.issues.find((i) => i.code === 'LLM_ANALYSIS_FAILED');
        expect(failedIssue).toBeDefined();
        expect(failedIssue?.message).toContain('LLM analysis failed');
      }
    });

    it('calls onLlmProgress callback for each file when LLM enabled (AC5)', () => {
      const file1 = createFileInfo({
        path: '/docs/file1.txt',
        name: 'file1',
        extension: 'txt',
        fullName: 'file1.txt',
      });
      const file2 = createFileInfo({
        path: '/docs/file2.txt',
        name: 'file2',
        extension: 'txt',
        fullName: 'file2.txt',
      });
      const files = [file1, file2];

      const llmAnalysisResults = new Map([
        [
          file1.path,
          {
            filePath: file1.path,
            suggestion: {
              suggestedName: 'analyzed-file-one',
              confidence: 0.85,
              reasoning: 'Test',
              keywords: [],
            },
            modelUsed: 'mistral',
            processingTimeMs: 1000,
            analyzedAt: new Date().toISOString(),
            contentTruncated: false,
          },
        ],
      ]);

      const progressCalls: Array<{ current: number; total: number; file: string }> = [];

      const options: GeneratePreviewWithRulesOptions = {
        templates,
        defaultTemplateId: 'default-t',
        enableLlmAnalysis: true,
        llmAnalysisResults,
        onLlmProgress: (current, total, file) => {
          progressCalls.push({ current, total, file });
        },
      };

      const result = generatePreviewWithRules(files, metadataMap, options);

      expect(result.ok).toBe(true);
      // Should have called progress for each file
      expect(progressCalls).toHaveLength(2);
      expect(progressCalls[0]).toEqual({ current: 1, total: 2, file: file1.path });
      expect(progressCalls[1]).toEqual({ current: 2, total: 2, file: file2.path });
    });

    it('sets useLlmSuggestion to false (not undefined) when LLM exists but below threshold', () => {
      const file = createFileInfo({
        path: '/docs/low-conf.txt',
        name: 'low-conf',
        extension: 'txt',
        fullName: 'low-conf.txt',
      });
      const files = [file];

      const llmAnalysisResults = new Map([
        [
          file.path,
          {
            filePath: file.path,
            suggestion: {
              suggestedName: 'should-not-use',
              confidence: 0.3, // Below threshold
              reasoning: 'Low confidence',
              keywords: [],
            },
            modelUsed: 'mistral',
            processingTimeMs: 1000,
            analyzedAt: new Date().toISOString(),
            contentTruncated: false,
          },
        ],
      ]);

      const options: GeneratePreviewWithRulesOptions = {
        templates,
        defaultTemplateId: 'default-t',
        enableLlmAnalysis: true,
        llmAnalysisResults,
        llmConfidenceThreshold: 0.7,
      };

      const result = generatePreviewWithRules(files, metadataMap, options);

      expect(result.ok).toBe(true);
      if (result.ok) {
        const proposal = result.data.proposals[0];
        expect(proposal).toBeDefined();
        // LLM suggestion should be present
        expect(proposal?.llmSuggestion).toBeDefined();
        // useLlmSuggestion should be explicitly false (not undefined)
        expect(proposal?.useLlmSuggestion).toBe(false);
        // Should use template name
        expect(proposal?.proposedName).toBe('low-conf.txt');
      }
    });
  });
});
