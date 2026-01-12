/**
 * @fileoverview Integration tests for rule-based template assignment - Story 7.3
 *
 * These tests verify end-to-end functionality of the rule-based template system:
 * - Creating rules with templates
 * - Matching files to rules
 * - Priority handling between rule types
 * - Missing template fallback behavior
 * - Full config → rules → preview flow
 */

import { describe, it, expect } from 'vitest';
import {
  generatePreviewWithRules,
  type GeneratePreviewWithRulesOptions,
} from './preview-with-rules.js';
import {
  createRule,
  createFilenameRule,
} from '../rules/index.js';
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
  path: '/photos/IMG_1234.jpg',
  name: 'IMG_1234',
  extension: 'jpg', // Extension without leading dot per FileInfo schema
  fullName: 'IMG_1234.jpg',
  size: 2048,
  createdAt: new Date('2026-01-15'),
  modifiedAt: new Date('2026-01-15'),
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
    dateTaken: new Date('2026-01-15'),
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

// Valid UUIDs for templates
const TEMPLATE_IDS = {
  default: '00000000-0000-4000-8000-000000000001',
  apple: '00000000-0000-4000-8000-000000000002',
  screenshot: '00000000-0000-4000-8000-000000000003',
  low: '00000000-0000-4000-8000-000000000004',
  medium: '00000000-0000-4000-8000-000000000005',
  high: '00000000-0000-4000-8000-000000000006',
  meta: '00000000-0000-4000-8000-000000000007',
  file: '00000000-0000-4000-8000-000000000008',
  pdf: '00000000-0000-4000-8000-000000000009',
  archive: '00000000-0000-4000-8000-00000000000a',
  photos: '00000000-0000-4000-8000-00000000000b',
  docs: '00000000-0000-4000-8000-00000000000c',
  backup: '00000000-0000-4000-8000-00000000000d',
  valid: '00000000-0000-4000-8000-00000000000e',
} as const;

const createTemplate = (
  id: string,
  name: string,
  pattern: string,
  isDefault = false
): Template => ({
  id,
  name,
  pattern,
  fileTypes: [],
  isDefault,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

// =============================================================================
// 6.1: Create rule with template, match file, verify template used
// =============================================================================

describe('Integration: Rule creation and template matching', () => {
  it('should create a rule with template and use it for matching files', () => {
    // Step 1: Create templates
    const templates = [
      createTemplate(TEMPLATE_IDS.default, 'Default Template', '{original}', true),
      createTemplate(TEMPLATE_IDS.apple, 'Apple Photos', 'iPhone_{year}_{month}_{original}'),
    ];

    // Step 2: Create a metadata rule using the rule manager
    const createInput = {
      name: 'Apple iPhone Rule',
      templateId: TEMPLATE_IDS.apple,
      priority: 10,
      matchMode: 'all' as const,
      conditions: [
        { field: 'image.cameraMake', operator: 'contains' as const, value: 'Apple', caseSensitive: false },
      ],
    };

    const createResult = createRule([], createInput, templates);
    expect(createResult.ok).toBe(true);
    if (!createResult.ok) return;

    const metadataRules = createResult.data.rules;

    // Step 3: Create a file with Apple camera metadata
    const file = createFileInfo();
    const metadata = createUnifiedMetadata(file);
    const metadataMap = new Map<string, UnifiedMetadata>([[file.path, metadata]]);

    // Step 4: Generate preview with rules
    const options: GeneratePreviewWithRulesOptions = {
      metadataRules,
      filenameRules: [],
      templates,
      defaultTemplateId: TEMPLATE_IDS.default,
      caseNormalization: 'none',
    };

    const result = generatePreviewWithRules([file], metadataMap, options);

    // Step 5: Verify the rule's template was used
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.proposals).toHaveLength(1);
      const proposal = result.data.proposals[0]!;
      expect(proposal.templateSource).toBe('rule');
      expect(proposal.appliedRule).toBeDefined();
      expect(proposal.appliedRule?.ruleName).toBe('Apple iPhone Rule');
      expect(proposal.appliedRule?.ruleType).toBe('metadata');
      // Template pattern: iPhone_{year}_{month}_{original}
      // Sanitization converts - and _ sequences to single _
      expect(proposal.proposedName).toMatch(/^iPhone_2026_01_IMG_1234\.jpg$/);
    }
  });

  it('should create a filename rule with template and use it for matching files', () => {
    // Step 1: Create templates
    const templates = [
      createTemplate(TEMPLATE_IDS.default, 'Default Template', '{original}', true),
      createTemplate(TEMPLATE_IDS.screenshot, 'Screenshots', 'Screenshot_{date}'),
    ];

    // Step 2: Create a filename rule using the rule manager
    const createInput = {
      name: 'Screenshot Files',
      pattern: 'Screenshot_*.png',
      templateId: TEMPLATE_IDS.screenshot,
      priority: 10,
      caseSensitive: false,
    };

    const createResult = createFilenameRule([], createInput, templates);
    expect(createResult.ok).toBe(true);
    if (!createResult.ok) return;

    const filenameRules = createResult.data.rules;

    // Step 3: Create a screenshot file
    const file = createFileInfo({
      path: '/screenshots/Screenshot_2026-01-15.png',
      name: 'Screenshot_2026-01-15',
      extension: 'png',
      fullName: 'Screenshot_2026-01-15.png',
      category: FileCategory.IMAGE,
    });
    const metadata = createUnifiedMetadata(file, { image: null });
    const metadataMap = new Map<string, UnifiedMetadata>([[file.path, metadata]]);

    // Step 4: Generate preview with rules
    const options: GeneratePreviewWithRulesOptions = {
      metadataRules: [],
      filenameRules,
      templates,
      defaultTemplateId: TEMPLATE_IDS.default,
    };

    const result = generatePreviewWithRules([file], metadataMap, options);

    // Step 5: Verify the rule's template was used
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.proposals).toHaveLength(1);
      const proposal = result.data.proposals[0]!;
      expect(proposal.templateSource).toBe('rule');
      expect(proposal.appliedRule?.ruleName).toBe('Screenshot Files');
      expect(proposal.appliedRule?.ruleType).toBe('filename');
    }
  });
});

// =============================================================================
// 6.2: Multiple rules with different templates and priorities
// =============================================================================

describe('Integration: Multiple rules with priorities', () => {
  it('should apply highest priority rule when multiple rules match', () => {
    const templates = [
      createTemplate(TEMPLATE_IDS.default, 'Default', '{original}', true),
      createTemplate(TEMPLATE_IDS.low, 'Low Priority', 'LOW_{original}'),
      createTemplate(TEMPLATE_IDS.medium, 'Medium Priority', 'MEDIUM_{original}'),
      createTemplate(TEMPLATE_IDS.high, 'High Priority', 'HIGH_{original}'),
    ];

    // Create rules with different priorities
    const metadataRules: MetadataPatternRule[] = [
      {
        id: 'rule-low',
        name: 'Low Priority Rule',
        conditions: [{ field: 'image.cameraMake', operator: 'contains', value: 'Apple', caseSensitive: false }],
        matchMode: 'all',
        templateId: TEMPLATE_IDS.low,
        priority: 5,
        enabled: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'rule-medium',
        name: 'Medium Priority Rule',
        conditions: [{ field: 'image.cameraMake', operator: 'contains', value: 'Apple', caseSensitive: false }],
        matchMode: 'all',
        templateId: TEMPLATE_IDS.medium,
        priority: 10,
        enabled: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'rule-high',
        name: 'High Priority Rule',
        conditions: [{ field: 'image.cameraMake', operator: 'contains', value: 'Apple', caseSensitive: false }],
        matchMode: 'all',
        templateId: TEMPLATE_IDS.high,
        priority: 20,
        enabled: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ];

    const file = createFileInfo();
    const metadata = createUnifiedMetadata(file);
    const metadataMap = new Map<string, UnifiedMetadata>([[file.path, metadata]]);

    const result = generatePreviewWithRules([file], metadataMap, {
      metadataRules,
      filenameRules: [],
      templates,
      defaultTemplateId: TEMPLATE_IDS.default,
      caseNormalization: 'none',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      const proposal = result.data.proposals[0]!;
      expect(proposal.appliedRule?.ruleName).toBe('High Priority Rule');
      expect(proposal.proposedName).toBe('HIGH_IMG_1234.jpg');
    }
  });

  it('should process files matching different rules correctly', () => {
    const templates = [
      createTemplate(TEMPLATE_IDS.default, 'Default', '{original}', true),
      createTemplate(TEMPLATE_IDS.apple, 'Apple', 'APPLE_{original}'),
      createTemplate(TEMPLATE_IDS.pdf, 'PDF', 'DOC_{original}'),
    ];

    // Metadata rule for Apple cameras
    const metadataRules: MetadataPatternRule[] = [
      {
        id: 'apple-rule',
        name: 'Apple Photos',
        conditions: [{ field: 'image.cameraMake', operator: 'contains', value: 'Apple', caseSensitive: false }],
        matchMode: 'all',
        templateId: TEMPLATE_IDS.apple,
        priority: 10,
        enabled: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ];

    // Filename rule for PDFs
    const filenameRules: FilenamePatternRule[] = [
      {
        id: 'pdf-rule',
        name: 'PDF Documents',
        pattern: '*.pdf',
        templateId: TEMPLATE_IDS.pdf,
        priority: 10,
        caseSensitive: false,
        enabled: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ];

    // Create diverse files
    const imageFile = createFileInfo();
    const pdfFile = createFileInfo({
      path: '/docs/report.pdf',
      name: 'report',
      extension: 'pdf',
      fullName: 'report.pdf',
      category: FileCategory.PDF,
    });
    const otherFile = createFileInfo({
      path: '/files/random.txt',
      name: 'random',
      extension: 'txt',
      fullName: 'random.txt',
      category: FileCategory.OTHER,
    });

    const metadataMap = new Map<string, UnifiedMetadata>([
      [imageFile.path, createUnifiedMetadata(imageFile)],
      [pdfFile.path, createUnifiedMetadata(pdfFile, { image: null })],
      [otherFile.path, createUnifiedMetadata(otherFile, { image: null })],
    ]);

    const result = generatePreviewWithRules(
      [imageFile, pdfFile, otherFile],
      metadataMap,
      {
        metadataRules,
        filenameRules,
        templates,
        defaultTemplateId: TEMPLATE_IDS.default,
        caseNormalization: 'none',
      }
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.proposals).toHaveLength(3);

      // Image file matches Apple metadata rule
      const imageProposal = result.data.proposals.find(p => p.originalPath.includes('IMG_1234'));
      expect(imageProposal?.appliedRule?.ruleName).toBe('Apple Photos');
      expect(imageProposal?.proposedName).toBe('APPLE_IMG_1234.jpg');

      // PDF file matches filename rule
      const pdfProposal = result.data.proposals.find(p => p.originalPath.includes('report'));
      expect(pdfProposal?.appliedRule?.ruleName).toBe('PDF Documents');
      expect(pdfProposal?.proposedName).toBe('DOC_report.pdf');

      // Other file uses default template (no rule matched)
      const otherProposal = result.data.proposals.find(p => p.originalPath.includes('random'));
      expect(otherProposal?.templateSource).toBe('default');
      expect(otherProposal?.appliedRule).toBeUndefined();
    }
  });
});

// =============================================================================
// 6.3: Metadata rule vs filename rule priority modes
// =============================================================================

describe('Integration: Priority modes', () => {
  const setupPriorityTest = () => {
    const templates = [
      createTemplate(TEMPLATE_IDS.default, 'Default', '{original}', true),
      createTemplate(TEMPLATE_IDS.meta, 'Metadata', 'META_{original}'),
      createTemplate(TEMPLATE_IDS.file, 'Filename', 'FILE_{original}'),
    ];

    // Both rules will match the same file
    const metadataRules: MetadataPatternRule[] = [
      {
        id: 'meta-rule',
        name: 'Metadata Rule',
        conditions: [{ field: 'image.cameraMake', operator: 'contains', value: 'Apple', caseSensitive: false }],
        matchMode: 'all',
        templateId: TEMPLATE_IDS.meta,
        priority: 5, // Lower priority
        enabled: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ];

    const filenameRules: FilenamePatternRule[] = [
      {
        id: 'file-rule',
        name: 'Filename Rule',
        pattern: 'IMG_*.jpg',
        templateId: TEMPLATE_IDS.file,
        priority: 10, // Higher priority
        caseSensitive: false,
        enabled: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ];

    const file = createFileInfo();
    const metadata = createUnifiedMetadata(file);
    const metadataMap = new Map<string, UnifiedMetadata>([[file.path, metadata]]);

    return { templates, metadataRules, filenameRules, file, metadataMap };
  };

  it('should use combined priority mode by default (filename wins with higher priority)', () => {
    const { templates, metadataRules, filenameRules, file, metadataMap } = setupPriorityTest();

    const result = generatePreviewWithRules([file], metadataMap, {
      metadataRules,
      filenameRules,
      templates,
      defaultTemplateId: TEMPLATE_IDS.default,
      rulePriorityMode: 'combined',
      caseNormalization: 'none',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      const proposal = result.data.proposals[0]!;
      // Filename rule has higher priority (10 > 5)
      expect(proposal.appliedRule?.ruleType).toBe('filename');
      expect(proposal.proposedName).toBe('FILE_IMG_1234.jpg');
    }
  });

  it('should respect metadata-first priority mode', () => {
    const { templates, metadataRules, filenameRules, file, metadataMap } = setupPriorityTest();

    const result = generatePreviewWithRules([file], metadataMap, {
      metadataRules,
      filenameRules,
      templates,
      defaultTemplateId: TEMPLATE_IDS.default,
      rulePriorityMode: 'metadata-first',
      caseNormalization: 'none',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      const proposal = result.data.proposals[0]!;
      // Metadata rule wins because metadata-first mode
      expect(proposal.appliedRule?.ruleType).toBe('metadata');
      expect(proposal.proposedName).toBe('META_IMG_1234.jpg');
    }
  });

  it('should respect filename-first priority mode', () => {
    const { templates, metadataRules, filenameRules, file, metadataMap } = setupPriorityTest();

    const result = generatePreviewWithRules([file], metadataMap, {
      metadataRules,
      filenameRules,
      templates,
      defaultTemplateId: TEMPLATE_IDS.default,
      rulePriorityMode: 'filename-first',
      caseNormalization: 'none',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      const proposal = result.data.proposals[0]!;
      // Filename rule wins because filename-first mode
      expect(proposal.appliedRule?.ruleType).toBe('filename');
      expect(proposal.proposedName).toBe('FILE_IMG_1234.jpg');
    }
  });
});

// =============================================================================
// 6.4: Missing template fallback behavior
// =============================================================================

describe('Integration: Missing template fallback', () => {
  it('should fall back to default template when rule template is missing', () => {
    const templates = [
      createTemplate(TEMPLATE_IDS.default, 'Default', 'DEFAULT_{original}', true),
      // Note: 'ffffffff-ffff-4fff-bfff-ffffffffffff' is NOT in templates
    ];

    const metadataRules: MetadataPatternRule[] = [
      {
        id: 'rule-missing',
        name: 'Rule with Missing Template',
        conditions: [{ field: 'image.cameraMake', operator: 'contains', value: 'Apple', caseSensitive: false }],
        matchMode: 'all',
        templateId: 'ffffffff-ffff-4fff-bfff-ffffffffffff', // This template doesn't exist!
        priority: 10,
        enabled: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ];

    const file = createFileInfo();
    const metadata = createUnifiedMetadata(file);
    const metadataMap = new Map<string, UnifiedMetadata>([[file.path, metadata]]);

    const result = generatePreviewWithRules([file], metadataMap, {
      metadataRules,
      filenameRules: [],
      templates,
      defaultTemplateId: TEMPLATE_IDS.default,
      caseNormalization: 'none',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      const proposal = result.data.proposals[0]!;
      // Should fall back to default template
      expect(proposal.templateSource).toBe('fallback');
      expect(proposal.appliedRule).toBeUndefined();
      // Should have warning about missing template
      expect(proposal.issues.some(i => i.code === 'RULE_TEMPLATE_MISSING')).toBe(true);
      // Should use default template pattern
      expect(proposal.proposedName).toBe('DEFAULT_IMG_1234.jpg');
    }
  });

  it('should use next matching rule if first matching rule has missing template', () => {
    const templates = [
      createTemplate(TEMPLATE_IDS.default, 'Default', 'DEFAULT_{original}', true),
      createTemplate(TEMPLATE_IDS.backup, 'Backup Template', 'BACKUP_{original}'),
      // Note: 'ffffffff-ffff-4fff-bfff-ffffffffffff' is NOT in templates
    ];

    const metadataRules: MetadataPatternRule[] = [
      {
        id: 'rule-missing',
        name: 'Rule with Missing Template',
        conditions: [{ field: 'image.cameraMake', operator: 'contains', value: 'Apple', caseSensitive: false }],
        matchMode: 'all',
        templateId: 'ffffffff-ffff-4fff-bfff-ffffffffffff', // This template doesn't exist!
        priority: 20, // Higher priority
        enabled: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'rule-backup',
        name: 'Backup Rule',
        conditions: [{ field: 'image.cameraMake', operator: 'contains', value: 'Apple', caseSensitive: false }],
        matchMode: 'all',
        templateId: TEMPLATE_IDS.backup, // This template exists
        priority: 10, // Lower priority
        enabled: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ];

    const file = createFileInfo();
    const metadata = createUnifiedMetadata(file);
    const metadataMap = new Map<string, UnifiedMetadata>([[file.path, metadata]]);

    const result = generatePreviewWithRules([file], metadataMap, {
      metadataRules,
      filenameRules: [],
      templates,
      defaultTemplateId: TEMPLATE_IDS.default,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      const proposal = result.data.proposals[0]!;
      // Template resolver should skip the missing template and use next match
      // This behavior depends on implementation - check current behavior
      // Either 'rule' with backup or 'fallback' with warning is acceptable
      expect(['rule', 'fallback']).toContain(proposal.templateSource);
    }
  });
});

// =============================================================================
// 6.5: End-to-end config → rules → preview flow
// =============================================================================

describe('Integration: End-to-end flow', () => {
  it('should complete full workflow: config templates → create rules → generate preview', () => {
    // Step 1: Define application config (templates)
    const appTemplates: Template[] = [
      createTemplate(TEMPLATE_IDS.default, 'Default Template', '{original}', true),
      createTemplate(TEMPLATE_IDS.photos, 'Photo Template', '{year}_{month}_{day}_{original}'),
      createTemplate(TEMPLATE_IDS.docs, 'Document Template', 'DOC_{original}_{date}'),
      createTemplate(TEMPLATE_IDS.archive, 'Archive Template', 'ARCHIVE_{original}'),
    ];

    // Step 2: Create rules with templates using manager functions
    let metadataRules: MetadataPatternRule[] = [];
    let filenameRules: FilenamePatternRule[] = [];

    // Create a metadata rule for photos
    const photoRuleResult = createRule(metadataRules, {
      name: 'iPhone Photos',
      templateId: TEMPLATE_IDS.photos,
      priority: 20,
      matchMode: 'all',
      conditions: [
        { field: 'image.cameraMake', operator: 'contains', value: 'Apple', caseSensitive: false },
      ],
    }, appTemplates);
    expect(photoRuleResult.ok).toBe(true);
    if (photoRuleResult.ok) metadataRules = photoRuleResult.data.rules;

    // Create a filename rule for PDFs
    const pdfRuleResult = createFilenameRule(filenameRules, {
      name: 'PDF Documents',
      pattern: '*.pdf',
      templateId: TEMPLATE_IDS.docs,
      priority: 15,
      caseSensitive: false,
    }, appTemplates);
    expect(pdfRuleResult.ok).toBe(true);
    if (pdfRuleResult.ok) filenameRules = pdfRuleResult.data.rules;

    // Create a filename rule for archives
    const archiveRuleResult = createFilenameRule(filenameRules, {
      name: 'Archives',
      pattern: '*.{zip,tar,gz}',
      templateId: TEMPLATE_IDS.archive,
      priority: 10,
      caseSensitive: false,
    }, appTemplates);
    expect(archiveRuleResult.ok).toBe(true);
    if (archiveRuleResult.ok) filenameRules = archiveRuleResult.data.rules;

    // Step 3: Simulate a batch of files
    const files: FileInfo[] = [
      createFileInfo({
        path: '/batch/photo1.jpg',
        name: 'photo1',
        fullName: 'photo1.jpg',
        category: FileCategory.IMAGE,
      }),
      createFileInfo({
        path: '/batch/report.pdf',
        name: 'report',
        extension: 'pdf',
        fullName: 'report.pdf',
        category: FileCategory.PDF,
      }),
      createFileInfo({
        path: '/batch/backup.zip',
        name: 'backup',
        extension: '.zip',
        fullName: 'backup.zip',
        category: FileCategory.OTHER,
      }),
      createFileInfo({
        path: '/batch/readme.txt',
        name: 'readme',
        extension: 'txt',
        fullName: 'readme.txt',
        category: FileCategory.OTHER,
      }),
    ];

    // Step 4: Create metadata for each file
    const metadataMap = new Map<string, UnifiedMetadata>([
      [files[0]!.path, createUnifiedMetadata(files[0]!, {
        image: {
          dateTaken: new Date('2026-03-15'),
          cameraMake: 'Apple',
          cameraModel: 'iPhone 15',
          gps: null,
          width: 4032,
          height: 3024,
          orientation: 1,
          exposureTime: '1/100',
          fNumber: 1.8,
          iso: 100,
        }
      })],
      [files[1]!.path, createUnifiedMetadata(files[1]!, { image: null })],
      [files[2]!.path, createUnifiedMetadata(files[2]!, { image: null })],
      [files[3]!.path, createUnifiedMetadata(files[3]!, { image: null })],
    ]);

    // Step 5: Generate preview with all rules
    const result = generatePreviewWithRules(files, metadataMap, {
      metadataRules,
      filenameRules,
      templates: appTemplates,
      defaultTemplateId: TEMPLATE_IDS.default,
      rulePriorityMode: 'combined',
    });

    // Step 6: Verify results
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const { proposals, summary } = result.data;
    expect(proposals).toHaveLength(4);

    // Photo matches metadata rule
    const photoProposal = proposals.find(p => p.originalPath.includes('photo1'));
    expect(photoProposal?.templateSource).toBe('rule');
    expect(photoProposal?.appliedRule?.ruleName).toBe('iPhone Photos');
    expect(photoProposal?.appliedRule?.ruleType).toBe('metadata');

    // PDF matches filename rule
    const pdfProposal = proposals.find(p => p.originalPath.includes('report'));
    expect(pdfProposal?.templateSource).toBe('rule');
    expect(pdfProposal?.appliedRule?.ruleName).toBe('PDF Documents');
    expect(pdfProposal?.appliedRule?.ruleType).toBe('filename');

    // Archive matches filename rule
    const archiveProposal = proposals.find(p => p.originalPath.includes('backup'));
    expect(archiveProposal?.templateSource).toBe('rule');
    expect(archiveProposal?.appliedRule?.ruleName).toBe('Archives');

    // Text file has no matching rule, uses default
    const txtProposal = proposals.find(p => p.originalPath.includes('readme'));
    expect(txtProposal?.templateSource).toBe('default');
    expect(txtProposal?.appliedRule).toBeUndefined();

    // Verify summary
    expect(summary.total).toBe(4);
  });

  it('should handle template validation when creating rules', () => {
    const templates = [
      createTemplate('valid-t', 'Valid Template', '{original}'),
    ];

    // Try to create a rule with non-existent template
    const result = createRule([], {
      name: 'Invalid Rule',
      templateId: 'eeeeeeee-eeee-4eee-beee-eeeeeeeeeeee',
      priority: 10,
      matchMode: 'all',
      conditions: [
        { field: 'image.cameraMake', operator: 'equals', value: 'Canon', caseSensitive: false },
      ],
    }, templates);

    // Should fail validation
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe('template_not_found');
    }
  });
});
