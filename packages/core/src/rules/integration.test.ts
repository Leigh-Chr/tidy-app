/**
 * @fileoverview Integration tests for rules module - Story 7.1
 *
 * These tests verify end-to-end functionality:
 * - Rule persistence in config
 * - Rule evaluation against real metadata
 * - Priority-based rule matching
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Config operations
import { loadConfig, saveConfig } from '../config/loader.js';
import type { AppConfig } from '../config/schema.js';
import { DEFAULT_CONFIG } from '../config/schema.js';

// Rule types
import type { MetadataPatternRule, CreateRuleInput } from '../types/rule.js';

// Rule management
import { createRule, listRules, listEnabledRules } from './manager.js';

// Rule evaluation
import { evaluateRule, findMatchingRule, findAllMatchingRules } from './evaluator.js';

// Metadata types for testing
import type { UnifiedMetadata } from '../types/unified-metadata.js';
import { FileCategory } from '../types/file-category.js';
import { MetadataCapability } from '../types/metadata-capability.js';

// =============================================================================
// Test Fixtures
// =============================================================================

function createTestMetadata(overrides: Partial<UnifiedMetadata> = {}): UnifiedMetadata {
  return {
    file: {
      path: '/photos/IMG_1234.jpg',
      name: 'IMG_1234',
      extension: 'jpg',
      fullName: 'IMG_1234.jpg',
      size: 2500000,
      createdAt: new Date('2026-01-10T10:00:00Z'),
      modifiedAt: new Date('2026-01-10T11:00:00Z'),
      relativePath: 'photos/IMG_1234.jpg',
      mimeType: 'image/jpeg',
      category: FileCategory.IMAGE,
      metadataSupported: true,
      metadataCapability: MetadataCapability.FULL,
    },
    image: {
      dateTaken: new Date('2026-01-05T14:30:00Z'),
      cameraMake: 'Apple',
      cameraModel: 'iPhone 15 Pro',
      gps: { latitude: 48.8584, longitude: 2.2945 },
      width: 4032,
      height: 3024,
      orientation: 1,
      exposureTime: '1/125',
      fNumber: 1.78,
      iso: 100,
    },
    pdf: null,
    office: null,
    extractionStatus: 'success',
    extractionError: null,
    ...overrides,
  };
}

function createPDFMetadata(): UnifiedMetadata {
  return {
    file: {
      path: '/docs/report.pdf',
      name: 'report',
      extension: 'pdf',
      fullName: 'report.pdf',
      size: 1500000,
      createdAt: new Date('2026-01-10T10:00:00Z'),
      modifiedAt: new Date('2026-01-10T11:00:00Z'),
      relativePath: 'docs/report.pdf',
      mimeType: 'application/pdf',
      category: FileCategory.PDF,
      metadataSupported: true,
      metadataCapability: MetadataCapability.FULL,
    },
    image: null,
    pdf: {
      title: 'Annual Report 2025',
      author: 'Jane Smith',
      subject: 'Financial Review',
      creator: 'Microsoft Word',
      producer: 'Adobe PDF',
      creationDate: new Date('2025-12-15T09:00:00Z'),
      modificationDate: new Date('2025-12-20T14:30:00Z'),
      pageCount: 45,
      keywords: ['finance', 'annual', 'report'],
    },
    office: null,
    extractionStatus: 'success',
    extractionError: null,
  };
}

// =============================================================================
// Integration Test: Config Persistence
// =============================================================================

describe('Rule persistence in config', () => {
  let testDir: string;
  let testConfigPath: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `tidy-rule-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(testDir, { recursive: true });
    testConfigPath = join(testDir, 'config.json');
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('creates rule, saves config, reloads, and verifies rule persisted', async () => {
    // 1. Start with default config
    let config: AppConfig = { ...DEFAULT_CONFIG, rules: [] };

    // 2. Create a new rule
    const input: CreateRuleInput = {
      name: 'iPhone Photos',
      conditions: [
        { field: 'image.cameraMake', operator: 'contains', value: 'Apple', caseSensitive: false },
        { field: 'file.category', operator: 'equals', value: 'image', caseSensitive: false },
      ],
      matchMode: 'all',
      templateId: '550e8400-e29b-41d4-a716-446655440000',
      priority: 10,
      enabled: true,
    };

    const createResult = createRule(config.rules, input);
    expect(createResult.ok).toBe(true);
    if (!createResult.ok) return;

    // 3. Update config with new rule
    config = { ...config, rules: createResult.data.rules };
    expect(config.rules).toHaveLength(1);

    // 4. Save config to disk
    const saveResult = await saveConfig(config, { configPath: testConfigPath });
    expect(saveResult.ok).toBe(true);

    // 5. Reload config from disk
    const loadResult = await loadConfig({ configPath: testConfigPath });
    expect(loadResult.ok).toBe(true);
    if (!loadResult.ok) return;

    // 6. Verify rule was persisted correctly
    const loadedConfig = loadResult.data;
    expect(loadedConfig.rules).toHaveLength(1);

    const loadedRule = loadedConfig.rules[0]!;
    expect(loadedRule.name).toBe('iPhone Photos');
    expect(loadedRule.conditions).toHaveLength(2);
    expect(loadedRule.matchMode).toBe('all');
    expect(loadedRule.priority).toBe(10);
    expect(loadedRule.enabled).toBe(true);
    expect(loadedRule.id).toBeDefined();
    expect(loadedRule.createdAt).toBeDefined();
    expect(loadedRule.updatedAt).toBeDefined();
  });

  it('preserves multiple rules with different priorities', async () => {
    let config: AppConfig = { ...DEFAULT_CONFIG, rules: [] };

    // Create multiple rules
    const rules: CreateRuleInput[] = [
      {
        name: 'High Priority Rule',
        conditions: [{ field: 'file.extension', operator: 'equals', value: 'jpg' }],
        templateId: '550e8400-e29b-41d4-a716-446655440001',
        priority: 100,
      },
      {
        name: 'Medium Priority Rule',
        conditions: [{ field: 'file.extension', operator: 'equals', value: 'png' }],
        templateId: '550e8400-e29b-41d4-a716-446655440002',
        priority: 50,
      },
      {
        name: 'Low Priority Rule',
        conditions: [{ field: 'file.extension', operator: 'equals', value: 'gif' }],
        templateId: '550e8400-e29b-41d4-a716-446655440003',
        priority: 1,
      },
    ];

    // Add all rules
    let currentRules: MetadataPatternRule[] = [];
    for (const input of rules) {
      const result = createRule(currentRules, input);
      expect(result.ok).toBe(true);
      if (result.ok) {
        currentRules = result.data.rules;
      }
    }

    config = { ...config, rules: currentRules };

    // Save and reload
    await saveConfig(config, { configPath: testConfigPath });
    const loadResult = await loadConfig({ configPath: testConfigPath });
    expect(loadResult.ok).toBe(true);
    if (!loadResult.ok) return;

    // Verify rules are persisted and ordered by priority
    const sorted = listRules(loadResult.data.rules);
    expect(sorted).toHaveLength(3);
    expect(sorted[0]!.name).toBe('High Priority Rule');
    expect(sorted[1]!.name).toBe('Medium Priority Rule');
    expect(sorted[2]!.name).toBe('Low Priority Rule');
  });
});

// =============================================================================
// Integration Test: Rule Evaluation with Real Metadata
// =============================================================================

describe('Rule evaluation against real metadata', () => {
  it('evaluates rule against image metadata', () => {
    const metadata = createTestMetadata();
    const rule: MetadataPatternRule = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Apple Camera Photos',
      conditions: [
        { field: 'image.cameraMake', operator: 'equals', value: 'Apple', caseSensitive: false },
      ],
      matchMode: 'all',
      templateId: '550e8400-e29b-41d4-a716-446655440001',
      priority: 10,
      enabled: true,
      createdAt: '2026-01-10T12:00:00.000Z',
      updatedAt: '2026-01-10T12:00:00.000Z',
    };

    const result = evaluateRule(rule, metadata);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.matches).toBe(true);
      expect(result.data.matchedConditions).toContain('image.cameraMake');
    }
  });

  it('evaluates rule against PDF metadata', () => {
    const metadata = createPDFMetadata();
    const rule: MetadataPatternRule = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Jane Smith Documents',
      conditions: [
        { field: 'pdf.author', operator: 'equals', value: 'Jane Smith', caseSensitive: false },
        { field: 'file.category', operator: 'equals', value: 'pdf', caseSensitive: false },
      ],
      matchMode: 'all',
      templateId: '550e8400-e29b-41d4-a716-446655440001',
      priority: 10,
      enabled: true,
      createdAt: '2026-01-10T12:00:00.000Z',
      updatedAt: '2026-01-10T12:00:00.000Z',
    };

    const result = evaluateRule(rule, metadata);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.matches).toBe(true);
      expect(result.data.matchedConditions).toHaveLength(2);
    }
  });

  it('evaluates complex multi-condition rule with AND logic', () => {
    const metadata = createTestMetadata();
    const rule: MetadataPatternRule = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'iPhone 15 Pro High ISO',
      conditions: [
        { field: 'image.cameraMake', operator: 'equals', value: 'Apple', caseSensitive: false },
        { field: 'image.cameraModel', operator: 'contains', value: 'iPhone 15', caseSensitive: false },
        { field: 'file.extension', operator: 'equals', value: 'jpg', caseSensitive: false },
      ],
      matchMode: 'all',
      templateId: '550e8400-e29b-41d4-a716-446655440001',
      priority: 10,
      enabled: true,
      createdAt: '2026-01-10T12:00:00.000Z',
      updatedAt: '2026-01-10T12:00:00.000Z',
    };

    const result = evaluateRule(rule, metadata);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.matches).toBe(true);
      expect(result.data.matchedConditions).toHaveLength(3);
    }
  });

  it('evaluates rule with OR logic', () => {
    const metadata = createTestMetadata();
    const rule: MetadataPatternRule = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Apple or Samsung',
      conditions: [
        { field: 'image.cameraMake', operator: 'equals', value: 'Samsung', caseSensitive: false }, // No match
        { field: 'image.cameraMake', operator: 'equals', value: 'Apple', caseSensitive: false }, // Match
      ],
      matchMode: 'any',
      templateId: '550e8400-e29b-41d4-a716-446655440001',
      priority: 10,
      enabled: true,
      createdAt: '2026-01-10T12:00:00.000Z',
      updatedAt: '2026-01-10T12:00:00.000Z',
    };

    const result = evaluateRule(rule, metadata);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.matches).toBe(true);
    }
  });

  it('evaluates regex condition', () => {
    const metadata = createTestMetadata();
    const rule: MetadataPatternRule = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'IMG Files',
      conditions: [
        { field: 'file.name', operator: 'regex', value: '^IMG_\\d+$', caseSensitive: false },
      ],
      matchMode: 'all',
      templateId: '550e8400-e29b-41d4-a716-446655440001',
      priority: 10,
      enabled: true,
      createdAt: '2026-01-10T12:00:00.000Z',
      updatedAt: '2026-01-10T12:00:00.000Z',
    };

    const result = evaluateRule(rule, metadata);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.matches).toBe(true);
    }
  });

  it('evaluates exists condition for GPS data', () => {
    const metadata = createTestMetadata();
    const rule: MetadataPatternRule = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Geotagged Photos',
      conditions: [{ field: 'image.gps', operator: 'exists', caseSensitive: false }],
      matchMode: 'all',
      templateId: '550e8400-e29b-41d4-a716-446655440001',
      priority: 10,
      enabled: true,
      createdAt: '2026-01-10T12:00:00.000Z',
      updatedAt: '2026-01-10T12:00:00.000Z',
    };

    const result = evaluateRule(rule, metadata);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.matches).toBe(true);
    }
  });

  it('evaluates notExists condition', () => {
    const metadata = createTestMetadata(); // Has no PDF metadata
    const rule: MetadataPatternRule = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Non-PDF Files',
      conditions: [{ field: 'pdf.author', operator: 'notExists', caseSensitive: false }],
      matchMode: 'all',
      templateId: '550e8400-e29b-41d4-a716-446655440001',
      priority: 10,
      enabled: true,
      createdAt: '2026-01-10T12:00:00.000Z',
      updatedAt: '2026-01-10T12:00:00.000Z',
    };

    const result = evaluateRule(rule, metadata);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.matches).toBe(true);
    }
  });
});

// =============================================================================
// Integration Test: Multiple Rules with Priority Ordering
// =============================================================================

describe('Multiple rules with priority ordering', () => {
  it('returns highest priority matching rule', () => {
    const metadata = createTestMetadata();
    const rules: MetadataPatternRule[] = [
      {
        id: 'low-priority',
        name: 'Low Priority (Generic Images)',
        conditions: [{ field: 'file.category', operator: 'equals', value: 'image', caseSensitive: false }],
        matchMode: 'all',
        templateId: 'template-low',
        priority: 1,
        enabled: true,
        createdAt: '2026-01-10T12:00:00.000Z',
        updatedAt: '2026-01-10T12:00:00.000Z',
      },
      {
        id: 'high-priority',
        name: 'High Priority (Apple Photos)',
        conditions: [
          { field: 'image.cameraMake', operator: 'equals', value: 'Apple', caseSensitive: false },
        ],
        matchMode: 'all',
        templateId: 'template-high',
        priority: 10,
        enabled: true,
        createdAt: '2026-01-10T12:00:00.000Z',
        updatedAt: '2026-01-10T12:00:00.000Z',
      },
      {
        id: 'medium-priority',
        name: 'Medium Priority (JPG Files)',
        conditions: [{ field: 'file.extension', operator: 'equals', value: 'jpg', caseSensitive: false }],
        matchMode: 'all',
        templateId: 'template-medium',
        priority: 5,
        enabled: true,
        createdAt: '2026-01-10T12:00:00.000Z',
        updatedAt: '2026-01-10T12:00:00.000Z',
      },
    ];

    // All three rules match, but high priority should be returned
    const match = findMatchingRule(rules, metadata);

    expect(match).not.toBeNull();
    expect(match!.id).toBe('high-priority');
    expect(match!.templateId).toBe('template-high');
  });

  it('returns all matching rules sorted by priority', () => {
    const metadata = createTestMetadata();
    const rules: MetadataPatternRule[] = [
      {
        id: 'low-priority',
        name: 'Low Priority',
        conditions: [{ field: 'file.category', operator: 'equals', value: 'image', caseSensitive: false }],
        matchMode: 'all',
        templateId: 'template-low',
        priority: 1,
        enabled: true,
        createdAt: '2026-01-10T12:00:00.000Z',
        updatedAt: '2026-01-10T12:00:00.000Z',
      },
      {
        id: 'non-matching',
        name: 'Non-Matching (Samsung)',
        conditions: [
          { field: 'image.cameraMake', operator: 'equals', value: 'Samsung', caseSensitive: false },
        ],
        matchMode: 'all',
        templateId: 'template-samsung',
        priority: 100, // Highest priority but won't match
        enabled: true,
        createdAt: '2026-01-10T12:00:00.000Z',
        updatedAt: '2026-01-10T12:00:00.000Z',
      },
      {
        id: 'high-priority',
        name: 'High Priority',
        conditions: [
          { field: 'image.cameraMake', operator: 'equals', value: 'Apple', caseSensitive: false },
        ],
        matchMode: 'all',
        templateId: 'template-high',
        priority: 10,
        enabled: true,
        createdAt: '2026-01-10T12:00:00.000Z',
        updatedAt: '2026-01-10T12:00:00.000Z',
      },
    ];

    const matches = findAllMatchingRules(rules, metadata);

    expect(matches).toHaveLength(2); // non-matching rule excluded
    expect(matches[0]!.rule.id).toBe('high-priority'); // Highest matching priority
    expect(matches[1]!.rule.id).toBe('low-priority'); // Lower priority
  });

  it('skips disabled rules regardless of priority', () => {
    const metadata = createTestMetadata();
    const rules: MetadataPatternRule[] = [
      {
        id: 'disabled-high',
        name: 'Disabled High Priority',
        conditions: [
          { field: 'image.cameraMake', operator: 'equals', value: 'Apple', caseSensitive: false },
        ],
        matchMode: 'all',
        templateId: 'template-disabled',
        priority: 100,
        enabled: false, // Disabled
        createdAt: '2026-01-10T12:00:00.000Z',
        updatedAt: '2026-01-10T12:00:00.000Z',
      },
      {
        id: 'enabled-low',
        name: 'Enabled Low Priority',
        conditions: [{ field: 'file.category', operator: 'equals', value: 'image', caseSensitive: false }],
        matchMode: 'all',
        templateId: 'template-enabled',
        priority: 1,
        enabled: true,
        createdAt: '2026-01-10T12:00:00.000Z',
        updatedAt: '2026-01-10T12:00:00.000Z',
      },
    ];

    const match = findMatchingRule(rules, metadata);

    expect(match).not.toBeNull();
    expect(match!.id).toBe('enabled-low'); // Disabled rule skipped
  });

  it('returns null when no rules match', () => {
    const metadata = createTestMetadata();
    const rules: MetadataPatternRule[] = [
      {
        id: 'samsung-rule',
        name: 'Samsung Photos',
        conditions: [
          { field: 'image.cameraMake', operator: 'equals', value: 'Samsung', caseSensitive: false },
        ],
        matchMode: 'all',
        templateId: 'template-samsung',
        priority: 10,
        enabled: true,
        createdAt: '2026-01-10T12:00:00.000Z',
        updatedAt: '2026-01-10T12:00:00.000Z',
      },
    ];

    const match = findMatchingRule(rules, metadata);

    expect(match).toBeNull();
  });

  it('filters enabled rules correctly', () => {
    const rules: MetadataPatternRule[] = [
      {
        id: 'enabled-1',
        name: 'Enabled 1',
        conditions: [{ field: 'file.extension', operator: 'equals', value: 'jpg' }],
        matchMode: 'all',
        templateId: 'template-1',
        priority: 5,
        enabled: true,
        createdAt: '2026-01-10T12:00:00.000Z',
        updatedAt: '2026-01-10T12:00:00.000Z',
      },
      {
        id: 'disabled-1',
        name: 'Disabled 1',
        conditions: [{ field: 'file.extension', operator: 'equals', value: 'png' }],
        matchMode: 'all',
        templateId: 'template-2',
        priority: 10,
        enabled: false,
        createdAt: '2026-01-10T12:00:00.000Z',
        updatedAt: '2026-01-10T12:00:00.000Z',
      },
      {
        id: 'enabled-2',
        name: 'Enabled 2',
        conditions: [{ field: 'file.extension', operator: 'equals', value: 'gif' }],
        matchMode: 'all',
        templateId: 'template-3',
        priority: 15,
        enabled: true,
        createdAt: '2026-01-10T12:00:00.000Z',
        updatedAt: '2026-01-10T12:00:00.000Z',
      },
    ];

    const enabled = listEnabledRules(rules);

    expect(enabled).toHaveLength(2);
    expect(enabled[0]!.id).toBe('enabled-2'); // Higher priority
    expect(enabled[1]!.id).toBe('enabled-1');
    expect(enabled.every((r) => r.enabled)).toBe(true);
  });
});
