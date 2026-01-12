/**
 * @fileoverview Integration tests for filename pattern rules - Story 7.2
 *
 * Tests the complete flow:
 * - Creating filename rules
 * - Persisting rules to config
 * - Reloading rules from config
 * - Evaluating rules against files
 * - Priority ordering
 */

import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import type { FileInfo } from '../types/file-info.js';
import { FileCategory } from '../types/file-category.js';
import { MetadataCapability } from '../types/metadata-capability.js';
import type { FilenamePatternRule } from '../types/filename-rule.js';
import type { AppConfig } from '../config/schema.js';
import { loadConfig, saveConfig } from '../config/loader.js';
import {
  createFilenameRule,
  getFilenameRule,
  deleteFilenameRule,
  listFilenameRules,
  reorderFilenameRules,
} from './filename-manager.js';
import {
  evaluateFilenameRule,
  findMatchingFilenameRule,
  evaluateFilenameRulesForFiles,
} from './filename-evaluator.js';

// =============================================================================
// Test Fixtures
// =============================================================================

const TEMPLATE_ID_1 = '550e8400-e29b-41d4-a716-446655440001';
const TEMPLATE_ID_2 = '550e8400-e29b-41d4-a716-446655440002';
const TEMPLATE_ID_3 = '550e8400-e29b-41d4-a716-446655440003';

function createMockFileInfo(fullName: string, category = FileCategory.IMAGE): FileInfo {
  const ext = fullName.includes('.') ? fullName.split('.').pop()! : '';
  const name = fullName.includes('.') ? fullName.slice(0, fullName.lastIndexOf('.')) : fullName;

  return {
    path: `/photos/${fullName}`,
    name,
    extension: ext,
    fullName,
    size: 1024,
    createdAt: new Date('2024-01-01'),
    modifiedAt: new Date('2024-01-01'),
    category,
    metadataSupported: true,
    metadataCapability: MetadataCapability.FULL,
  };
}

// =============================================================================
// AC6 / 8.1: Rule Persistence Integration Tests
// =============================================================================

describe('8.1: Filename Rule Persistence', () => {
  let tempDir: string;
  let configPath: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tidy-filename-test-'));
    configPath = path.join(tempDir, 'config.json');
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should persist filename rules to config and reload them', async () => {
    // Create initial config (strict: false to get defaults when file doesn't exist)
    let config = await loadConfig({ configPath, strict: false });
    expect(config.ok).toBe(true);
    if (!config.ok) return;

    let currentConfig = config.data;
    expect(currentConfig.filenameRules).toEqual([]);

    // Create a filename rule
    const createResult = createFilenameRule(currentConfig.filenameRules, {
      name: 'iPhone Photos',
      pattern: 'IMG_*.{jpg,jpeg,heic}',
      templateId: TEMPLATE_ID_1,
      priority: 10,
      caseSensitive: false,
    });

    expect(createResult.ok).toBe(true);
    if (!createResult.ok) return;

    // Save the config
    const updatedConfig: AppConfig = {
      ...currentConfig,
      filenameRules: createResult.data.rules,
    };

    const saveResult = await saveConfig(updatedConfig, { configPath });
    expect(saveResult.ok).toBe(true);

    // Reload the config
    const reloadResult = await loadConfig({ configPath });
    expect(reloadResult.ok).toBe(true);
    if (!reloadResult.ok) return;

    const reloadedConfig = reloadResult.data;

    // Verify the rule was persisted
    expect(reloadedConfig.filenameRules).toHaveLength(1);
    expect(reloadedConfig.filenameRules[0]!.name).toBe('iPhone Photos');
    expect(reloadedConfig.filenameRules[0]!.pattern).toBe('IMG_*.{jpg,jpeg,heic}');
    expect(reloadedConfig.filenameRules[0]!.templateId).toBe(TEMPLATE_ID_1);
    expect(reloadedConfig.filenameRules[0]!.priority).toBe(10);
    expect(reloadedConfig.filenameRules[0]!.caseSensitive).toBe(false);
    expect(reloadedConfig.filenameRules[0]!.enabled).toBe(true);
  });

  it('should maintain rule order when persisting and reloading', async () => {
    // Create initial config (strict: false to get defaults when file doesn't exist)
    const config = await loadConfig({ configPath, strict: false });
    expect(config.ok).toBe(true);
    if (!config.ok) return;

    let currentRules: FilenamePatternRule[] = [];

    // Create multiple rules
    const rule1 = createFilenameRule(currentRules, {
      name: 'Rule 1',
      pattern: '*.jpg',
      templateId: TEMPLATE_ID_1,
      priority: 5,
    });
    expect(rule1.ok).toBe(true);
    if (!rule1.ok) return;
    currentRules = rule1.data.rules;

    const rule2 = createFilenameRule(currentRules, {
      name: 'Rule 2',
      pattern: '*.png',
      templateId: TEMPLATE_ID_2,
      priority: 10,
    });
    expect(rule2.ok).toBe(true);
    if (!rule2.ok) return;
    currentRules = rule2.data.rules;

    const rule3 = createFilenameRule(currentRules, {
      name: 'Rule 3',
      pattern: '*.gif',
      templateId: TEMPLATE_ID_3,
      priority: 1,
    });
    expect(rule3.ok).toBe(true);
    if (!rule3.ok) return;
    currentRules = rule3.data.rules;

    // Save
    const updatedConfig: AppConfig = {
      ...config.data,
      filenameRules: currentRules,
    };
    await saveConfig(updatedConfig, { configPath });

    // Reload
    const reloadResult = await loadConfig({ configPath });
    expect(reloadResult.ok).toBe(true);
    if (!reloadResult.ok) return;

    // List rules (should be sorted by priority)
    const sorted = listFilenameRules(reloadResult.data.filenameRules);

    expect(sorted[0]!.name).toBe('Rule 2'); // priority 10
    expect(sorted[1]!.name).toBe('Rule 1'); // priority 5
    expect(sorted[2]!.name).toBe('Rule 3'); // priority 1
  });

  it('should validate rules on load (reject invalid patterns)', async () => {
    // Manually write invalid config
    const invalidConfig = {
      version: 1,
      templates: [],
      preferences: {
        defaultOutputFormat: 'table',
        colorOutput: true,
        confirmBeforeApply: true,
        recursiveScan: false,
      },
      recentFolders: [],
      rules: [],
      filenameRules: [
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Bad Rule',
          pattern: '[unclosed',
          caseSensitive: false,
          templateId: TEMPLATE_ID_1,
          priority: 0,
          enabled: true,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      ],
    };

    await fs.writeFile(configPath, JSON.stringify(invalidConfig));

    // Loading should fail validation - use strict: false to test fallback behavior
    const loadResult = await loadConfig({ configPath, strict: false });

    // The loader should fall back to defaults when strict: false
    expect(loadResult.ok).toBe(true);
    if (loadResult.ok) {
      // The invalid rule was rejected, so filenameRules defaults to empty array
      expect(loadResult.data.filenameRules).toEqual([]);
    }
  });
});

// =============================================================================
// AC5 / 8.2: Evaluate Filename Rules Against Real Files
// =============================================================================

describe('8.2: Evaluate Filename Rules Against Files', () => {
  it('should match iPhone photos with IMG_*.{jpg,jpeg,heic} pattern', () => {
    const rule: FilenamePatternRule = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'iPhone Photos',
      pattern: 'IMG_*.{jpg,jpeg,heic}',
      caseSensitive: false,
      templateId: TEMPLATE_ID_1,
      priority: 10,
      enabled: true,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };

    // Should match
    expect(
      evaluateFilenameRule(rule, createMockFileInfo('IMG_1234.jpg')).ok &&
        evaluateFilenameRule(rule, createMockFileInfo('IMG_1234.jpg')).ok
    ).toBe(true);
    const jpgResult = evaluateFilenameRule(rule, createMockFileInfo('IMG_1234.jpg'));
    if (jpgResult.ok) expect(jpgResult.data.matches).toBe(true);

    expect(
      evaluateFilenameRule(rule, createMockFileInfo('IMG_0001.jpeg')).ok &&
        evaluateFilenameRule(rule, createMockFileInfo('IMG_0001.jpeg')).ok
    ).toBe(true);
    const jpegResult = evaluateFilenameRule(rule, createMockFileInfo('IMG_0001.jpeg'));
    if (jpegResult.ok) expect(jpegResult.data.matches).toBe(true);

    expect(
      evaluateFilenameRule(rule, createMockFileInfo('IMG_9999.heic')).ok &&
        evaluateFilenameRule(rule, createMockFileInfo('IMG_9999.heic')).ok
    ).toBe(true);
    const heicResult = evaluateFilenameRule(rule, createMockFileInfo('IMG_9999.heic'));
    if (heicResult.ok) expect(heicResult.data.matches).toBe(true);

    // Should not match
    const dscResult = evaluateFilenameRule(rule, createMockFileInfo('DSC_1234.jpg'));
    if (dscResult.ok) expect(dscResult.data.matches).toBe(false);

    const pngResult = evaluateFilenameRule(rule, createMockFileInfo('IMG_1234.png'));
    if (pngResult.ok) expect(pngResult.data.matches).toBe(false);
  });

  it('should match screenshots with Screen Shot* pattern', () => {
    const rule: FilenamePatternRule = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'macOS Screenshots',
      pattern: 'Screen Shot*.png',
      caseSensitive: false,
      templateId: TEMPLATE_ID_1,
      priority: 5,
      enabled: true,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };

    const match = evaluateFilenameRule(
      rule,
      createMockFileInfo('Screen Shot 2024-01-15 at 10.30.45.png')
    );
    expect(match.ok).toBe(true);
    if (match.ok) expect(match.data.matches).toBe(true);

    const noMatch = evaluateFilenameRule(rule, createMockFileInfo('screenshot.png'));
    expect(noMatch.ok).toBe(true);
    if (noMatch.ok) expect(noMatch.data.matches).toBe(false);
  });

  it('should match date-prefixed files with character ranges', () => {
    const rule: FilenamePatternRule = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Date Prefixed',
      pattern: '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]_*',
      caseSensitive: false,
      templateId: TEMPLATE_ID_1,
      priority: 5,
      enabled: true,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };

    const match = evaluateFilenameRule(rule, createMockFileInfo('2024-01-15_vacation_photo.jpg'));
    expect(match.ok).toBe(true);
    if (match.ok) expect(match.data.matches).toBe(true);

    const noMatch = evaluateFilenameRule(rule, createMockFileInfo('vacation_photo_2024.jpg'));
    expect(noMatch.ok).toBe(true);
    if (noMatch.ok) expect(noMatch.data.matches).toBe(false);
  });

  it('should handle case-sensitive matching', () => {
    const caseSensitiveRule: FilenamePatternRule = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Case Sensitive',
      pattern: 'IMG_*.JPG',
      caseSensitive: true,
      templateId: TEMPLATE_ID_1,
      priority: 5,
      enabled: true,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };

    const exactMatch = evaluateFilenameRule(
      caseSensitiveRule,
      createMockFileInfo('IMG_1234.JPG')
    );
    expect(exactMatch.ok && exactMatch.data.matches).toBe(true);

    const wrongCase = evaluateFilenameRule(
      caseSensitiveRule,
      createMockFileInfo('IMG_1234.jpg')
    );
    expect(wrongCase.ok && wrongCase.data.matches).toBe(false);

    const caseInsensitiveRule: FilenamePatternRule = {
      ...caseSensitiveRule,
      caseSensitive: false,
    };

    const matchesEither = evaluateFilenameRule(
      caseInsensitiveRule,
      createMockFileInfo('IMG_1234.jpg')
    );
    expect(matchesEither.ok && matchesEither.data.matches).toBe(true);
  });
});

// =============================================================================
// AC5 / 8.3: Multiple Rules with Priority Ordering
// =============================================================================

describe('8.3: Multiple Filename Rules with Priority Ordering', () => {
  const rules: FilenamePatternRule[] = [
    {
      id: 'rule-generic-jpg',
      name: 'All JPGs',
      pattern: '*.jpg',
      caseSensitive: false,
      templateId: TEMPLATE_ID_1,
      priority: 1, // Lowest priority
      enabled: true,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    },
    {
      id: 'rule-iphone',
      name: 'iPhone Photos',
      pattern: 'IMG_*.{jpg,jpeg,heic}',
      caseSensitive: false,
      templateId: TEMPLATE_ID_2,
      priority: 10, // Highest priority
      enabled: true,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    },
    {
      id: 'rule-dsc',
      name: 'DSC Photos',
      pattern: 'DSC_*.jpg',
      caseSensitive: false,
      templateId: TEMPLATE_ID_3,
      priority: 5, // Medium priority
      enabled: true,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    },
  ];

  it('should return highest-priority matching rule', () => {
    // IMG_1234.jpg matches both "All JPGs" and "iPhone Photos"
    // Should return "iPhone Photos" (priority 10)
    const match = findMatchingFilenameRule(rules, createMockFileInfo('IMG_1234.jpg'));

    expect(match).not.toBeNull();
    expect(match?.rule.name).toBe('iPhone Photos');
    expect(match?.rule.templateId).toBe(TEMPLATE_ID_2);
  });

  it('should fall back to lower priority when higher priority does not match', () => {
    // random_photo.jpg only matches "All JPGs"
    const match = findMatchingFilenameRule(rules, createMockFileInfo('random_photo.jpg'));

    expect(match).not.toBeNull();
    expect(match?.rule.name).toBe('All JPGs');
    expect(match?.rule.templateId).toBe(TEMPLATE_ID_1);
  });

  it('should return null when no rules match', () => {
    const match = findMatchingFilenameRule(rules, createMockFileInfo('document.pdf'));

    expect(match).toBeNull();
  });

  it('should correctly assign templates to multiple files', () => {
    const files: FileInfo[] = [
      createMockFileInfo('IMG_1234.jpg'),
      createMockFileInfo('DSC_5678.jpg'),
      createMockFileInfo('random.jpg'),
      createMockFileInfo('document.pdf', FileCategory.DOCUMENT),
    ];

    const results = evaluateFilenameRulesForFiles(rules, files);

    expect(results).toHaveLength(4);

    // IMG_1234.jpg -> iPhone Photos (highest priority match)
    expect(results[0]!.templateId).toBe(TEMPLATE_ID_2);

    // DSC_5678.jpg -> DSC Photos (priority 5, more specific than All JPGs)
    expect(results[1]!.templateId).toBe(TEMPLATE_ID_3);

    // random.jpg -> All JPGs (only match)
    expect(results[2]!.templateId).toBe(TEMPLATE_ID_1);

    // document.pdf -> no match
    expect(results[3]!.templateId).toBeNull();
  });

  it('should skip disabled rules even if they have higher priority', () => {
    const rulesWithDisabled: FilenamePatternRule[] = [
      {
        ...rules[0]!,
        priority: 1,
      },
      {
        ...rules[1]!,
        priority: 10,
        enabled: false, // Disabled
      },
      {
        ...rules[2]!,
        priority: 5,
      },
    ];

    // IMG_1234.jpg would match "iPhone Photos" but it's disabled
    // Should fall back to "All JPGs" (only other match)
    const match = findMatchingFilenameRule(
      rulesWithDisabled,
      createMockFileInfo('IMG_1234.jpg')
    );

    expect(match).not.toBeNull();
    expect(match?.rule.name).toBe('All JPGs');
  });

  it('should respect reordering when priorities change', () => {
    let currentRules: FilenamePatternRule[] = [];

    // Create rules
    const rule1Result = createFilenameRule(currentRules, {
      name: 'Rule A',
      pattern: '*.jpg',
      templateId: TEMPLATE_ID_1,
      priority: 0,
    });
    expect(rule1Result.ok).toBe(true);
    if (!rule1Result.ok) return;
    currentRules = rule1Result.data.rules;

    const rule2Result = createFilenameRule(currentRules, {
      name: 'Rule B',
      pattern: 'IMG_*.jpg',
      templateId: TEMPLATE_ID_2,
      priority: 0,
    });
    expect(rule2Result.ok).toBe(true);
    if (!rule2Result.ok) return;
    currentRules = rule2Result.data.rules;

    const rule3Result = createFilenameRule(currentRules, {
      name: 'Rule C',
      pattern: 'IMG_????.*',
      templateId: TEMPLATE_ID_3,
      priority: 0,
    });
    expect(rule3Result.ok).toBe(true);
    if (!rule3Result.ok) return;
    currentRules = rule3Result.data.rules;

    // Get rule IDs
    const ruleA = currentRules.find((r) => r.name === 'Rule A')!;
    const ruleB = currentRules.find((r) => r.name === 'Rule B')!;
    const ruleC = currentRules.find((r) => r.name === 'Rule C')!;

    // Reorder: C, B, A (C gets highest priority)
    const reorderResult = reorderFilenameRules(currentRules, [ruleC.id, ruleB.id, ruleA.id]);
    expect(reorderResult.ok).toBe(true);
    if (!reorderResult.ok) return;

    // Now Rule C should match first for IMG_1234.jpg
    const match = findMatchingFilenameRule(
      reorderResult.data,
      createMockFileInfo('IMG_1234.jpg')
    );

    expect(match?.rule.name).toBe('Rule C');
    expect(match?.rule.templateId).toBe(TEMPLATE_ID_3);
  });
});

// =============================================================================
// End-to-End Integration
// =============================================================================

describe('End-to-End: Complete Workflow', () => {
  let tempDir: string;
  let configPath: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tidy-e2e-test-'));
    configPath = path.join(tempDir, 'config.json');
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should create rules, save, reload, and evaluate against files', async () => {
    // 1. Load initial config (strict: false to get defaults when file doesn't exist)
    const initialConfig = await loadConfig({ configPath, strict: false });
    expect(initialConfig.ok).toBe(true);
    if (!initialConfig.ok) return;

    // 2. Create multiple filename rules
    let rules: FilenamePatternRule[] = [];

    const rule1 = createFilenameRule(rules, {
      name: 'iPhone Photos',
      pattern: 'IMG_*.{jpg,jpeg,heic}',
      templateId: TEMPLATE_ID_1,
      priority: 10,
    });
    expect(rule1.ok).toBe(true);
    if (!rule1.ok) return;
    rules = rule1.data.rules;

    const rule2 = createFilenameRule(rules, {
      name: 'Screenshots',
      pattern: 'Screen Shot*',
      templateId: TEMPLATE_ID_2,
      priority: 5,
    });
    expect(rule2.ok).toBe(true);
    if (!rule2.ok) return;
    rules = rule2.data.rules;

    const rule3 = createFilenameRule(rules, {
      name: 'PDFs',
      pattern: '*.pdf',
      templateId: TEMPLATE_ID_3,
      priority: 1,
    });
    expect(rule3.ok).toBe(true);
    if (!rule3.ok) return;
    rules = rule3.data.rules;

    // 3. Save config
    const configToSave: AppConfig = {
      ...initialConfig.data,
      filenameRules: rules,
    };
    await saveConfig(configToSave, { configPath });

    // 4. Reload config
    const reloadedConfig = await loadConfig({ configPath });
    expect(reloadedConfig.ok).toBe(true);
    if (!reloadedConfig.ok) return;

    // 5. Verify rules were persisted
    expect(reloadedConfig.data.filenameRules).toHaveLength(3);

    // 6. Evaluate against files
    const files: FileInfo[] = [
      createMockFileInfo('IMG_1234.jpg'),
      createMockFileInfo('Screen Shot 2024-01-15.png'),
      createMockFileInfo('report.pdf', FileCategory.DOCUMENT),
      createMockFileInfo('random.txt', FileCategory.OTHER),
    ];

    const results = evaluateFilenameRulesForFiles(reloadedConfig.data.filenameRules, files);

    // 7. Verify results
    expect(results[0]!.templateId).toBe(TEMPLATE_ID_1); // iPhone Photos
    expect(results[1]!.templateId).toBe(TEMPLATE_ID_2); // Screenshots
    expect(results[2]!.templateId).toBe(TEMPLATE_ID_3); // PDFs
    expect(results[3]!.templateId).toBeNull(); // No match

    // 8. Delete a rule and verify
    const deleteResult = deleteFilenameRule(
      reloadedConfig.data.filenameRules,
      rule2.data.rule.id
    );
    expect(deleteResult.ok).toBe(true);
    if (!deleteResult.ok) return;

    // 9. Save updated config
    const updatedConfig: AppConfig = {
      ...reloadedConfig.data,
      filenameRules: deleteResult.data,
    };
    await saveConfig(updatedConfig, { configPath });

    // 10. Final reload and verify
    const finalConfig = await loadConfig({ configPath });
    expect(finalConfig.ok).toBe(true);
    if (!finalConfig.ok) return;

    expect(finalConfig.data.filenameRules).toHaveLength(2);
    expect(finalConfig.data.filenameRules.find((r) => r.name === 'Screenshots')).toBeUndefined();
  });
});
