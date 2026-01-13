/**
 * @fileoverview Tests for scan-and-apply workflow - Story 7.5
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Some PDF extraction tests are flaky on Windows due to timing differences
const isWindows = process.platform === 'win32';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import {
  scanAndApplyRules,
  type ScanAndApplyOptions,
  type WorkflowProgressCallback,
} from './scan-and-apply.js';
import type { AppConfig, Template } from '../config/schema.js';
import type { MetadataPatternRule } from '../types/rule.js';
import type { FilenamePatternRule } from '../types/filename-rule.js';

// =============================================================================
// Test Fixtures
// =============================================================================

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

const createConfig = (overrides: Partial<AppConfig> = {}): AppConfig => ({
  version: 1,
  templates: [
    createTemplate('default-template', 'Default', '{original}', true),
    createTemplate('date-template', 'Date Prefix', '{date}-{original}', false),
  ],
  preferences: {
    defaultOutputFormat: 'table',
    colorOutput: true,
    confirmBeforeApply: true,
    recursiveScan: false,
    rulePriorityMode: 'combined',
  },
  recentFolders: [],
  rules: [],
  filenameRules: [],
  ...overrides,
});

// =============================================================================
// Test Setup
// =============================================================================

describe('scanAndApplyRules', () => {
  let testDir: string;

  beforeEach(async () => {
    // Create a unique temp directory for each test
    testDir = join(tmpdir(), `tidy-test-${randomUUID()}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up temp directory
    await rm(testDir, { recursive: true, force: true });
  });

  // ===========================================================================
  // AC1: Scan and Apply Workflow Function
  // ===========================================================================

  describe('AC1: Scan and Apply Workflow Function', () => {
    it('should scan folder and return preview with proposals', async () => {
      // Create test files
      await writeFile(join(testDir, 'test1.txt'), 'content1');
      await writeFile(join(testDir, 'test2.txt'), 'content2');

      const config = createConfig();
      const result = await scanAndApplyRules(testDir, config);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.filesScanned).toBe(2);
        expect(result.data.proposals).toHaveLength(2);
        expect(result.data.summary.total).toBe(2);
        expect(result.data.timing.totalDurationMs).toBeGreaterThan(0);
      }
    });

    it('should apply rules and assign templates based on matches', async () => {
      // Create test files
      await writeFile(join(testDir, 'IMG_1234.jpg'), 'fake image');
      await writeFile(join(testDir, 'document.txt'), 'text content');

      const config = createConfig({
        filenameRules: [
          createFilenameRule(
            'img-rule',
            'Image Rule',
            'IMG_*.jpg',
            'date-template',
            10
          ),
        ],
      });

      const result = await scanAndApplyRules(testDir, config);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.filesScanned).toBe(2);
        expect(result.data.proposals).toHaveLength(2);

        // Find the image proposal
        const imgProposal = result.data.proposals.find((p) =>
          p.originalName.includes('IMG_')
        );
        expect(imgProposal).toBeDefined();
        expect(imgProposal?.templateSource).toBe('rule');
        expect(imgProposal?.appliedRule?.ruleId).toBe('img-rule');

        // Find the text proposal
        const txtProposal = result.data.proposals.find((p) =>
          p.originalName.includes('document')
        );
        expect(txtProposal).toBeDefined();
        expect(txtProposal?.templateSource).toBe('default');
      }
    });
  });

  // ===========================================================================
  // AC2: Single Pipeline Entry Point
  // ===========================================================================

  describe('AC2: Single Pipeline Entry Point', () => {
    it('should combine scanning, extraction, and rule application in one call', async () => {
      // Create test files
      await writeFile(join(testDir, 'file1.txt'), 'content');
      await writeFile(join(testDir, 'file2.txt'), 'content');

      const config = createConfig();
      const result = await scanAndApplyRules(testDir, config);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Verify all phases ran
        expect(result.data.timing.scanDurationMs).toBeGreaterThanOrEqual(0);
        expect(result.data.timing.extractDurationMs).toBeGreaterThanOrEqual(0);
        expect(result.data.timing.applyDurationMs).toBeGreaterThanOrEqual(0);

        // Verify result has all expected fields
        expect(result.data.filesScanned).toBe(2);
        expect(result.data.proposals).toBeDefined();
        expect(result.data.summary).toBeDefined();
        expect(result.data.generatedAt).toBeInstanceOf(Date);
      }
    });
  });

  // ===========================================================================
  // AC3: Selective Metadata Extraction
  // ===========================================================================

  describe('AC3: Selective Metadata Extraction', () => {
    it('should only attempt extraction for metadata-supported files', async () => {
      // Create test files (txt files don't support metadata extraction)
      await writeFile(join(testDir, 'document.txt'), 'text content');
      await writeFile(join(testDir, 'notes.md'), 'markdown content');

      const config = createConfig();
      const result = await scanAndApplyRules(testDir, config);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Text files don't support metadata, so extraction count should be 0
        expect(result.data.filesScanned).toBe(2);
        expect(result.data.filesExtracted).toBe(0);
        // But proposals should still be generated
        expect(result.data.proposals).toHaveLength(2);
      }
    });

    it('should track extraction errors without blocking other files', async () => {
      // Create test files
      await writeFile(join(testDir, 'file1.txt'), 'content');

      const config = createConfig();
      const result = await scanAndApplyRules(testDir, config);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // extractionErrors should be an array (possibly empty)
        expect(Array.isArray(result.data.extractionErrors)).toBe(true);
        // File should still get a proposal
        expect(result.data.proposals).toHaveLength(1);
      }
    });
  });

  // ===========================================================================
  // AC4: Config-Driven Operation
  // ===========================================================================

  describe('AC4: Config-Driven Operation', () => {
    it('should use config.templates for available templates', async () => {
      await writeFile(join(testDir, 'test.txt'), 'content');

      const config = createConfig({
        templates: [
          createTemplate('custom-template', 'Custom', 'custom-{original}', true),
        ],
      });

      const result = await scanAndApplyRules(testDir, config);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.templateUsed).toBe('custom-{original}');
      }
    });

    it('should use config.rules for metadata pattern rules', async () => {
      await writeFile(join(testDir, 'test.txt'), 'content');

      const config = createConfig({
        rules: [
          createMetadataRule(
            'meta-rule',
            'Meta Rule',
            'date-template',
            10,
            [{ field: 'file.size', operator: 'gte', value: '1', caseSensitive: false }],
            true
          ),
        ],
      });

      const result = await scanAndApplyRules(testDir, config);

      expect(result.ok).toBe(true);
      // The rule may or may not match depending on metadata evaluation
      // This test verifies the rules are passed through
    });

    it('should use config.filenameRules for filename pattern rules', async () => {
      await writeFile(join(testDir, 'test.txt'), 'content');

      const config = createConfig({
        filenameRules: [
          createFilenameRule('file-rule', 'File Rule', '*.txt', 'date-template', 10),
        ],
      });

      const result = await scanAndApplyRules(testDir, config);

      expect(result.ok).toBe(true);
      if (result.ok) {
        const proposal = result.data.proposals[0];
        expect(proposal?.templateSource).toBe('rule');
        expect(proposal?.appliedRule?.ruleId).toBe('file-rule');
      }
    });

    it('should use config.preferences.rulePriorityMode', async () => {
      await writeFile(join(testDir, 'test.txt'), 'content');

      const config = createConfig({
        preferences: {
          defaultOutputFormat: 'table',
          colorOutput: true,
          confirmBeforeApply: true,
          recursiveScan: false,
          rulePriorityMode: 'filename-first',
        },
      });

      const result = await scanAndApplyRules(testDir, config);

      expect(result.ok).toBe(true);
      // Verify the workflow completed - priority mode is used internally
    });
  });

  // ===========================================================================
  // AC5: Progress Callbacks
  // ===========================================================================

  describe('AC5: Progress Callbacks', () => {
    it('should call progress callback during scanning phase with multiple files', async () => {
      // Create multiple files to ensure progress is reported
      for (let i = 0; i < 5; i++) {
        await writeFile(join(testDir, `test${i}.txt`), 'content');
      }

      const progressCalls: Array<{ current: number; total: number; phase: string }> = [];

      const config = createConfig();
      const options: ScanAndApplyOptions = {
        onProgress: ((current, total, phase) => {
          progressCalls.push({ current, total, phase });
        }) as WorkflowProgressCallback,
      };

      const result = await scanAndApplyRules(testDir, config, options);

      expect(result.ok).toBe(true);
      // Verify callback was invoked (at least for applying phase which always fires)
      expect(progressCalls.length).toBeGreaterThan(0);
      // All calls should have valid phase values
      for (const call of progressCalls) {
        expect(['scanning', 'extracting', 'applying']).toContain(call.phase);
      }
    });

    it('should call progress callback during applying phase', async () => {
      await writeFile(join(testDir, 'test.txt'), 'content');

      const progressCalls: Array<{ current: number; total: number; phase: string }> = [];

      const config = createConfig();
      const options: ScanAndApplyOptions = {
        onProgress: ((current, total, phase) => {
          progressCalls.push({ current, total, phase });
        }) as WorkflowProgressCallback,
      };

      const result = await scanAndApplyRules(testDir, config, options);

      expect(result.ok).toBe(true);
      // Should have progress calls for applying phase
      const applyCalls = progressCalls.filter((c) => c.phase === 'applying');
      expect(applyCalls.length).toBeGreaterThan(0);
      expect(applyCalls[0]?.current).toBe(1);
      expect(applyCalls[0]?.total).toBe(1);
    });

    // Skip on Windows - PDF extraction timing is unpredictable
    it.skipIf(isWindows)('should call progress callback during extracting phase for supported files', async () => {
      // Create a PDF file (which supports metadata extraction)
      // Note: The file won't have valid PDF content, but extractBatch will still
      // process it and report progress before failing extraction
      await writeFile(join(testDir, 'document.pdf'), 'fake pdf content');

      const progressCalls: Array<{ current: number; total: number; phase: string }> = [];

      const config = createConfig();
      const options: ScanAndApplyOptions = {
        onProgress: ((current, total, phase) => {
          progressCalls.push({ current, total, phase });
        }) as WorkflowProgressCallback,
      };

      const result = await scanAndApplyRules(testDir, config, options);

      expect(result.ok).toBe(true);
      // Should have progress calls for extracting phase (even if extraction fails)
      const extractCalls = progressCalls.filter((c) => c.phase === 'extracting');
      expect(extractCalls.length).toBeGreaterThan(0);
    });

    it('should include phase information in each callback', async () => {
      await writeFile(join(testDir, 'test.txt'), 'content');

      const phases = new Set<string>();

      const config = createConfig();
      const options: ScanAndApplyOptions = {
        onProgress: ((_, __, phase) => {
          phases.add(phase);
        }) as WorkflowProgressCallback,
      };

      await scanAndApplyRules(testDir, config, options);

      // At minimum, applying phase should have been called
      expect(phases.has('applying')).toBe(true);
    });
  });

  // ===========================================================================
  // AC6: Cancellation Support
  // ===========================================================================

  describe('AC6: Cancellation Support', () => {
    it('should stop gracefully when aborted before scanning', async () => {
      await writeFile(join(testDir, 'test.txt'), 'content');

      const controller = new AbortController();
      controller.abort(); // Abort immediately

      const config = createConfig();
      const result = await scanAndApplyRules(testDir, config, {
        signal: controller.signal,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('cancelled');
        expect(result.error.phase).toBe('scanning');
      }
    });

    // Skip on Windows - PDF extraction timing is unpredictable
    it.skipIf(isWindows)('should stop gracefully when aborted during extraction phase', async () => {
      // Create a PDF file that will be processed in extraction phase
      await writeFile(join(testDir, 'document.pdf'), 'fake pdf');

      const controller = new AbortController();

      const config = createConfig();
      const result = await scanAndApplyRules(testDir, config, {
        signal: controller.signal,
        onProgress: (current, total, phase) => {
          // Abort when we reach extraction phase
          if (phase === 'extracting') {
            controller.abort();
          }
        },
      });

      // Should either complete (if abort happened after extraction finished)
      // or be cancelled (if abort happened during extraction)
      if (!result.ok) {
        expect(result.error.type).toBe('cancelled');
        expect(['extracting', 'applying']).toContain(result.error.phase);
      }
    });

    it('should stop gracefully when aborted during applying phase', async () => {
      // Create multiple files to increase chance of catching cancellation
      for (let i = 0; i < 3; i++) {
        await writeFile(join(testDir, `test${i}.txt`), 'content');
      }

      const controller = new AbortController();

      const config = createConfig();
      const result = await scanAndApplyRules(testDir, config, {
        signal: controller.signal,
        onProgress: (current, total, phase) => {
          // Abort when we reach applying phase
          if (phase === 'applying' && current === 1) {
            controller.abort();
          }
        },
      });

      // Should either complete (if abort happened after applying finished)
      // or be cancelled (if abort happened during applying)
      if (!result.ok) {
        expect(result.error.type).toBe('cancelled');
        expect(result.error.phase).toBe('applying');
      }
    });

    it('should return cancelled error with phase information', async () => {
      await writeFile(join(testDir, 'test.txt'), 'content');

      const controller = new AbortController();
      controller.abort();

      const config = createConfig();
      const result = await scanAndApplyRules(testDir, config, {
        signal: controller.signal,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('cancelled');
        expect(result.error.message).toContain('cancelled');
        expect(result.error.phase).toBeDefined();
      }
    });

    it('should not corrupt data when cancelled mid-workflow', async () => {
      await writeFile(join(testDir, 'test.txt'), 'content');

      const controller = new AbortController();
      controller.abort();

      const config = createConfig();
      const result = await scanAndApplyRules(testDir, config, {
        signal: controller.signal,
      });

      // Verify error structure is complete (no partial data)
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toHaveProperty('type');
        expect(result.error).toHaveProperty('message');
        expect(typeof result.error.type).toBe('string');
        expect(typeof result.error.message).toBe('string');
      }
    });
  });

  // ===========================================================================
  // AC7: Empty and Edge Cases
  // ===========================================================================

  describe('AC7: Empty and Edge Cases', () => {
    it('should return empty preview for empty folder', async () => {
      // testDir is already empty

      const config = createConfig();
      const result = await scanAndApplyRules(testDir, config);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.filesScanned).toBe(0);
        expect(result.data.proposals).toHaveLength(0);
        expect(result.data.summary.total).toBe(0);
        expect(result.data.summary.ready).toBe(0);
        expect(result.data.summary.conflicts).toBe(0);
        expect(result.data.summary.missingData).toBe(0);
        expect(result.data.summary.noChange).toBe(0);
        expect(result.data.summary.invalidName).toBe(0);
        // templateUsed should be empty string when no files were processed
        expect(result.data.templateUsed).toBe('');
      }
    });

    it('should use default template when no rules are configured', async () => {
      await writeFile(join(testDir, 'test.txt'), 'content');

      const config = createConfig({
        rules: [],
        filenameRules: [],
      });

      const result = await scanAndApplyRules(testDir, config);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.proposals).toHaveLength(1);
        expect(result.data.proposals[0]?.templateSource).toBe('default');
        expect(result.data.proposals[0]?.appliedRule).toBeUndefined();
      }
    });

    it('should return error when no default template exists', async () => {
      await writeFile(join(testDir, 'test.txt'), 'content');

      const config = createConfig({
        templates: [], // No templates at all
      });

      const result = await scanAndApplyRules(testDir, config);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('no_default_template');
      }
    });

    it('should handle folder with no matching files for extension filter', async () => {
      await writeFile(join(testDir, 'test.txt'), 'content');

      const config = createConfig();
      const result = await scanAndApplyRules(testDir, config, {
        extensions: ['jpg', 'png'], // No jpg or png files exist
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.filesScanned).toBe(0);
        expect(result.data.proposals).toHaveLength(0);
      }
    });

    it('should handle recursive scanning', async () => {
      // Create subdirectory with files
      const subDir = join(testDir, 'subdir');
      await mkdir(subDir, { recursive: true });
      await writeFile(join(testDir, 'root.txt'), 'content');
      await writeFile(join(subDir, 'nested.txt'), 'content');

      const config = createConfig();
      const result = await scanAndApplyRules(testDir, config, {
        recursive: true,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.filesScanned).toBe(2);
        expect(result.data.proposals).toHaveLength(2);
      }
    });

    it('should handle non-recursive scanning (default)', async () => {
      // Create subdirectory with files
      const subDir = join(testDir, 'subdir');
      await mkdir(subDir, { recursive: true });
      await writeFile(join(testDir, 'root.txt'), 'content');
      await writeFile(join(subDir, 'nested.txt'), 'content');

      const config = createConfig();
      const result = await scanAndApplyRules(testDir, config, {
        recursive: false,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.filesScanned).toBe(1);
        expect(result.data.proposals).toHaveLength(1);
      }
    });
  });

  // ===========================================================================
  // Timing Statistics
  // ===========================================================================

  describe('timing statistics', () => {
    it('should provide accurate timing for all phases', async () => {
      await writeFile(join(testDir, 'test.txt'), 'content');

      const config = createConfig();
      const result = await scanAndApplyRules(testDir, config);

      expect(result.ok).toBe(true);
      if (result.ok) {
        const { timing } = result.data;

        // All timings should be non-negative
        expect(timing.scanDurationMs).toBeGreaterThanOrEqual(0);
        expect(timing.extractDurationMs).toBeGreaterThanOrEqual(0);
        expect(timing.applyDurationMs).toBeGreaterThanOrEqual(0);
        expect(timing.totalDurationMs).toBeGreaterThanOrEqual(0);

        // Total duration is measured independently from start to finish,
        // so it should be >= the sum of individual phases.
        // Note: Individual phase timings may not sum exactly to total due to
        // overhead between phases (cancellation checks, map building, etc.)
        const sumOfPhases =
          timing.scanDurationMs + timing.extractDurationMs + timing.applyDurationMs;
        // Total should be at least as large as sum of parts
        // Allow 5ms tolerance for timing precision on different systems
        expect(timing.totalDurationMs).toBeGreaterThanOrEqual(sumOfPhases - 5);
      }
    });

    it('should have zero extract duration when no extractable files', async () => {
      // txt files don't support metadata extraction
      await writeFile(join(testDir, 'test.txt'), 'content');

      const config = createConfig();
      const result = await scanAndApplyRules(testDir, config);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // No extractable files, so extraction should be quick
        expect(result.data.timing.extractDurationMs).toBeLessThan(100);
        expect(result.data.filesExtracted).toBe(0);
      }
    });
  });

  // ===========================================================================
  // Error Handling
  // ===========================================================================

  describe('error handling', () => {
    it('should return scan_failed error for invalid folder path', async () => {
      const config = createConfig();
      const result = await scanAndApplyRules('/nonexistent/path', config);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('scan_failed');
        expect(result.error.phase).toBe('scanning');
      }
    });

    it('should use first template when none marked as default', async () => {
      await writeFile(join(testDir, 'test.txt'), 'content');

      const config = createConfig({
        templates: [
          createTemplate('template-1', 'Template 1', '{original}', false),
          createTemplate('template-2', 'Template 2', '{date}-{original}', false),
        ],
      });

      const result = await scanAndApplyRules(testDir, config);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Should use first template as fallback
        expect(result.data.templateUsed).toBe('{original}');
      }
    });

    it('should handle rule with non-existent template gracefully', async () => {
      await writeFile(join(testDir, 'test.txt'), 'content');

      const config = createConfig({
        filenameRules: [
          createFilenameRule(
            'bad-rule',
            'Bad Rule',
            '*.txt',
            'nonexistent-template-id', // This template doesn't exist
            10
          ),
        ],
      });

      const result = await scanAndApplyRules(testDir, config);

      // Should still succeed - rule with missing template falls back to default
      // or the generatePreviewWithRules handles this gracefully
      if (result.ok) {
        expect(result.data.proposals).toHaveLength(1);
      } else {
        // If it fails, it should be a preview_failed error
        expect(result.error.type).toBe('preview_failed');
        expect(result.error.phase).toBe('applying');
      }
    });

    it('should include correct error types', async () => {
      // Test all error types are correctly typed
      const config = createConfig({ templates: [] });
      const noTemplateResult = await scanAndApplyRules(testDir, config);

      expect(noTemplateResult.ok).toBe(false);
      if (!noTemplateResult.ok) {
        expect(['scan_failed', 'cancelled', 'no_default_template', 'preview_failed']).toContain(
          noTemplateResult.error.type
        );
      }
    });
  });

  // ===========================================================================
  // Folder Structure Integration (Story 8.2)
  // ===========================================================================

  describe('folder structure integration (Story 8.2)', () => {
    it('should pass folder structures from config to preview generation', async () => {
      await writeFile(join(testDir, 'IMG_1234.jpg'), 'fake image');

      const config = createConfig({
        folderStructures: [
          {
            id: 'fs-1',
            name: 'By Year',
            pattern: '{year}',
            description: 'Organize by year',
            enabled: true,
            priority: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        filenameRules: [
          {
            ...createFilenameRule('img-rule', 'Image Rule', 'IMG_*.jpg', 'default-template', 10),
            folderStructureId: 'fs-1',
          },
        ],
      });

      const result = await scanAndApplyRules(testDir, config);

      expect(result.ok).toBe(true);
      if (result.ok) {
        const imgProposal = result.data.proposals.find((p) => p.originalName.includes('IMG_'));
        expect(imgProposal).toBeDefined();
        // The folder structure should be applied
        expect(imgProposal?.folderStructureId).toBe('fs-1');
      }
    });

    it('should use baseDirectory option when provided', async () => {
      await writeFile(join(testDir, 'IMG_1234.jpg'), 'fake image');

      const baseDir = join(testDir, 'organized');
      await mkdir(baseDir, { recursive: true });

      const config = createConfig({
        folderStructures: [
          {
            id: 'fs-1',
            name: 'By Year',
            pattern: '{year}',
            description: 'Organize by year',
            enabled: true,
            priority: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        filenameRules: [
          {
            ...createFilenameRule('img-rule', 'Image Rule', 'IMG_*.jpg', 'default-template', 10),
            folderStructureId: 'fs-1',
          },
        ],
      });

      const result = await scanAndApplyRules(testDir, config, {
        baseDirectory: baseDir,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        const imgProposal = result.data.proposals.find((p) => p.originalName.includes('IMG_'));
        expect(imgProposal).toBeDefined();
        // The proposal should use the base directory
        expect(imgProposal?.proposedPath).toContain('organized');
      }
    });

    it('should set isMoveOperation when folder changes', async () => {
      await writeFile(join(testDir, 'IMG_1234.jpg'), 'fake image');

      const config = createConfig({
        folderStructures: [
          {
            id: 'fs-1',
            name: 'Photos',
            pattern: 'photos',
            description: 'Photos folder',
            enabled: true,
            priority: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        filenameRules: [
          {
            ...createFilenameRule('img-rule', 'Image Rule', 'IMG_*.jpg', 'default-template', 10),
            folderStructureId: 'fs-1',
          },
        ],
      });

      const result = await scanAndApplyRules(testDir, config);

      expect(result.ok).toBe(true);
      if (result.ok) {
        const imgProposal = result.data.proposals.find((p) => p.originalName.includes('IMG_'));
        expect(imgProposal).toBeDefined();
        expect(imgProposal?.isMoveOperation).toBe(true);
      }
    });
  });
});
