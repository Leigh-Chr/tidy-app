/**
 * @fileoverview Tests for Content Analyzer - Story 10.2
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  analyzeFile,
  analyzeContent,
  analyzeFiles,
  analyzeFilesWithFilter,
  isAnalysisAvailable,
  getAnalysisStatus,
} from './analyzer.js';
import type { OllamaConfig } from './types.js';
import { DEFAULT_LLM_FILE_TYPES } from './types.js';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('Analyzer', () => {
  let testDir: string;

  const defaultConfig: OllamaConfig = {
    enabled: true,
    baseUrl: 'http://localhost:11434',
    timeout: 30000,
    models: { inference: 'mistral' },
    fileTypes: DEFAULT_LLM_FILE_TYPES,
  };

  const createMockGenerateResponse = (suggestion: object) => ({
    ok: true,
    json: () => Promise.resolve({
      model: 'mistral',
      created_at: new Date().toISOString(),
      response: JSON.stringify(suggestion),
      done: true,
      total_duration: 1000000000,
      prompt_eval_count: 100,
      eval_count: 50,
    }),
  });

  const createMockTagsResponse = (modelCount = 1) => ({
    ok: true,
    json: () => Promise.resolve({
      models: Array(modelCount).fill({
        name: 'mistral:latest',
        model: 'mistral:latest',
        modified_at: new Date().toISOString(),
        size: 4000000000,
        digest: 'abc123',
      }),
    }),
  });

  beforeEach(async () => {
    testDir = join(tmpdir(), `analyzer-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
    mockFetch.mockReset();
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  describe('analyzeContent', () => {
    it('analyzes content and returns suggestion', async () => {
      mockFetch.mockResolvedValueOnce(createMockGenerateResponse({
        suggestedName: 'quarterly-report',
        confidence: 0.9,
        reasoning: 'Document discusses Q3 sales',
        keywords: ['quarterly', 'sales', 'report'],
      }));

      const result = await analyzeContent('This is the Q3 sales report...', defaultConfig);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.suggestedName).toBe('quarterly-report');
        expect(result.data.confidence).toBe(0.9);
        expect(result.data.reasoning).toContain('Q3');
      }
    });

    it('includes file type in prompt when provided', async () => {
      mockFetch.mockResolvedValueOnce(createMockGenerateResponse({
        suggestedName: 'test-file',
        confidence: 0.8,
        reasoning: 'Test',
      }));

      await analyzeContent('content', defaultConfig, { fileType: 'md' });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.prompt).toContain('file type: md');
    });

    it('returns error when no model configured', async () => {
      const configNoModel: OllamaConfig = {
        ...defaultConfig,
        models: {},
      };

      const result = await analyzeContent('content', configNoModel);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('MODEL_NOT_FOUND');
      }
    });

    it('returns ANALYSIS_FAILED for unparseable response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          model: 'mistral',
          created_at: new Date().toISOString(),
          response: 'This is not valid JSON at all',
          done: true,
        }),
      });

      const result = await analyzeContent('content', defaultConfig);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('ANALYSIS_FAILED');
        expect(result.error.message).toContain('Failed to parse');
      }
    });

    it('uses correct temperature for naming suggestions', async () => {
      mockFetch.mockResolvedValueOnce(createMockGenerateResponse({
        suggestedName: 'test',
        confidence: 0.5,
        reasoning: 'test',
      }));

      await analyzeContent('content', defaultConfig);

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.options.temperature).toBe(0.3); // Low for consistency
    });

    it('includes system prompt for naming context', async () => {
      mockFetch.mockResolvedValueOnce(createMockGenerateResponse({
        suggestedName: 'test',
        confidence: 0.5,
        reasoning: 'test',
      }));

      await analyzeContent('content', defaultConfig);

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.system).toBeDefined();
      expect(callBody.system).toContain('file naming');
    });
  });

  describe('analyzeFile', () => {
    it('extracts and analyzes file content', async () => {
      const filePath = join(testDir, 'document.txt');
      await writeFile(filePath, 'This is a project proposal for the new website.');

      mockFetch.mockResolvedValueOnce(createMockGenerateResponse({
        suggestedName: 'website-proposal',
        confidence: 0.85,
        reasoning: 'Document is a project proposal',
        keywords: ['website', 'proposal'],
      }));

      const result = await analyzeFile(filePath, defaultConfig);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.filePath).toBe(filePath);
        expect(result.data.suggestion.suggestedName).toBe('website-proposal');
        expect(result.data.modelUsed).toBe('mistral');
        expect(result.data.processingTimeMs).toBeGreaterThanOrEqual(0);
        expect(result.data.contentTruncated).toBe(false);
      }
    });

    it('returns error for non-existent file', async () => {
      const result = await analyzeFile('/nonexistent/path.txt', defaultConfig);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('CONTENT_EXTRACTION_FAILED');
      }
    });

    it('returns error for empty file', async () => {
      const filePath = join(testDir, 'empty.txt');
      await writeFile(filePath, '');

      const result = await analyzeFile(filePath, defaultConfig);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('CONTENT_EXTRACTION_FAILED');
        expect(result.error.message).toContain('empty');
      }
    });

    it('indicates when content was truncated', async () => {
      const filePath = join(testDir, 'large.txt');
      await writeFile(filePath, 'A'.repeat(10000));

      mockFetch.mockResolvedValueOnce(createMockGenerateResponse({
        suggestedName: 'large-file',
        confidence: 0.5,
        reasoning: 'Large file',
      }));

      const result = await analyzeFile(filePath, defaultConfig, {
        maxContentChars: 100,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.contentTruncated).toBe(true);
      }
    });

    it('passes file type option through', async () => {
      const filePath = join(testDir, 'code.ts');
      await writeFile(filePath, 'export function hello() {}');

      mockFetch.mockResolvedValueOnce(createMockGenerateResponse({
        suggestedName: 'hello-function',
        confidence: 0.8,
        reasoning: 'TypeScript function',
      }));

      await analyzeFile(filePath, defaultConfig, { fileType: 'typescript' });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.prompt).toContain('file type: typescript');
    });
  });

  describe('analyzeFiles', () => {
    it('analyzes multiple files', async () => {
      const file1 = join(testDir, 'doc1.txt');
      const file2 = join(testDir, 'doc2.txt');
      await writeFile(file1, 'First document content');
      await writeFile(file2, 'Second document content');

      mockFetch
        .mockResolvedValueOnce(createMockGenerateResponse({
          suggestedName: 'first-doc',
          confidence: 0.8,
          reasoning: 'First',
        }))
        .mockResolvedValueOnce(createMockGenerateResponse({
          suggestedName: 'second-doc',
          confidence: 0.9,
          reasoning: 'Second',
        }));

      const results = await analyzeFiles([file1, file2], defaultConfig);

      expect(results.size).toBe(2);
      expect(results.get(file1)?.ok).toBe(true);
      expect(results.get(file2)?.ok).toBe(true);
    });

    it('calls progress callback for each file', async () => {
      const file1 = join(testDir, 'a.txt');
      const file2 = join(testDir, 'b.txt');
      await writeFile(file1, 'Content A');
      await writeFile(file2, 'Content B');

      mockFetch
        .mockResolvedValueOnce(createMockGenerateResponse({
          suggestedName: 'a',
          confidence: 0.5,
          reasoning: 'A',
        }))
        .mockResolvedValueOnce(createMockGenerateResponse({
          suggestedName: 'b',
          confidence: 0.5,
          reasoning: 'B',
        }));

      const progressCalls: [number, number, string][] = [];

      await analyzeFiles([file1, file2], defaultConfig, {
        onProgress: (current, total, file) => {
          progressCalls.push([current, total, file]);
        },
      });

      expect(progressCalls).toHaveLength(2);
      expect(progressCalls[0]).toEqual([1, 2, file1]);
      expect(progressCalls[1]).toEqual([2, 2, file2]);
    });

    it('continues on error by default', async () => {
      const file1 = join(testDir, 'good.txt');
      const file2 = '/nonexistent/file.txt';
      const file3 = join(testDir, 'also-good.txt');
      await writeFile(file1, 'Good content');
      await writeFile(file3, 'Also good');

      mockFetch
        .mockResolvedValueOnce(createMockGenerateResponse({
          suggestedName: 'good',
          confidence: 0.8,
          reasoning: 'Good',
        }))
        .mockResolvedValueOnce(createMockGenerateResponse({
          suggestedName: 'also-good',
          confidence: 0.8,
          reasoning: 'Also good',
        }));

      const results = await analyzeFiles([file1, file2, file3], defaultConfig);

      expect(results.size).toBe(3);
      expect(results.get(file1)?.ok).toBe(true);
      expect(results.get(file2)?.ok).toBe(false);
      expect(results.get(file3)?.ok).toBe(true);
    });

    it('stops on error when continueOnError is false', async () => {
      const file1 = '/nonexistent/file.txt';
      const file2 = join(testDir, 'good.txt');
      await writeFile(file2, 'Good content');

      const results = await analyzeFiles([file1, file2], defaultConfig, {
        batchOptions: { continueOnError: false },
      });

      expect(results.size).toBe(1); // Only processed first file
      expect(results.get(file1)?.ok).toBe(false);
      expect(results.has(file2)).toBe(false);
    });

    it('handles empty file list', async () => {
      const results = await analyzeFiles([], defaultConfig);

      expect(results.size).toBe(0);
    });
  });

  // Story 10.4: analyzeFilesWithFilter tests
  describe('analyzeFilesWithFilter', () => {
    it('filters files based on file type configuration', async () => {
      const docFile = join(testDir, 'report.pdf');
      const imgFile = join(testDir, 'photo.jpg');
      await writeFile(docFile, 'PDF content');
      await writeFile(imgFile, 'Image data');

      // Story 10.6: Need to mock health check first
      mockFetch
        .mockResolvedValueOnce(createMockTagsResponse())
        .mockResolvedValueOnce(createMockGenerateResponse({
          suggestedName: 'report-doc',
          confidence: 0.8,
          reasoning: 'PDF document',
        }));

      // Default config uses 'documents' preset which includes pdf but not jpg
      const result = await analyzeFilesWithFilter([docFile, imgFile], defaultConfig);

      expect(result.analyzed.size).toBe(1);
      expect(result.skipped.size).toBe(1);
      expect(result.analyzed.has(docFile)).toBe(true);
      expect(result.skipped.has(imgFile)).toBe(true);
    });

    it('includes reason in skipped files', async () => {
      const imgFile = join(testDir, 'photo.jpg');
      await writeFile(imgFile, 'Image data');

      // Story 10.6: Need to mock health check
      mockFetch.mockResolvedValueOnce(createMockTagsResponse());

      const result = await analyzeFilesWithFilter([imgFile], defaultConfig);

      expect(result.skipped.size).toBe(1);
      const skipReason = result.skipped.get(imgFile);
      expect(skipReason).toBeDefined();
      expect(skipReason?.shouldAnalyze).toBe(false);
      expect(skipReason?.reason).toContain('jpg');
    });

    it('respects excluded extensions', async () => {
      const pdfFile = join(testDir, 'doc.pdf');
      await writeFile(pdfFile, 'PDF content');

      const configWithExclusion: OllamaConfig = {
        ...defaultConfig,
        fileTypes: {
          preset: 'documents',
          includedExtensions: [],
          excludedExtensions: ['pdf'],
          skipWithMetadata: true,
        },
      };

      // Story 10.6: Need to mock health check
      mockFetch.mockResolvedValueOnce(createMockTagsResponse());

      const result = await analyzeFilesWithFilter([pdfFile], configWithExclusion);

      expect(result.analyzed.size).toBe(0);
      expect(result.skipped.size).toBe(1);
    });

    it('uses included extensions over preset', async () => {
      const logFile = join(testDir, 'app.log');
      const pdfFile = join(testDir, 'doc.pdf');
      await writeFile(logFile, 'Log content');
      await writeFile(pdfFile, 'PDF content');

      // Story 10.6: Need to mock health check first
      mockFetch
        .mockResolvedValueOnce(createMockTagsResponse())
        .mockResolvedValueOnce(createMockGenerateResponse({
          suggestedName: 'application-log',
          confidence: 0.8,
          reasoning: 'Log file',
        }));

      const configWithInclusion: OllamaConfig = {
        ...defaultConfig,
        fileTypes: {
          preset: 'documents',
          includedExtensions: ['log'],
          excludedExtensions: [],
          skipWithMetadata: true,
        },
      };

      const result = await analyzeFilesWithFilter([logFile, pdfFile], configWithInclusion);

      expect(result.analyzed.size).toBe(1);
      expect(result.skipped.size).toBe(1);
      expect(result.analyzed.has(logFile)).toBe(true);
      expect(result.skipped.has(pdfFile)).toBe(true);
    });

    it('calls progress callback with status for each file', async () => {
      const docFile = join(testDir, 'doc.pdf');
      const imgFile = join(testDir, 'photo.jpg');
      await writeFile(docFile, 'PDF content');
      await writeFile(imgFile, 'Image data');

      // Story 10.6: Need to mock health check first
      mockFetch
        .mockResolvedValueOnce(createMockTagsResponse())
        .mockResolvedValueOnce(createMockGenerateResponse({
          suggestedName: 'doc',
          confidence: 0.8,
          reasoning: 'Doc',
        }));

      const progressCalls: [number, number, string, string][] = [];

      await analyzeFilesWithFilter([docFile, imgFile], defaultConfig, {
        onProgress: (current, total, file, status) => {
          progressCalls.push([current, total, file, status]);
        },
      });

      expect(progressCalls).toHaveLength(2);
      expect(progressCalls[0]).toEqual([1, 2, docFile, 'analyzing']);
      expect(progressCalls[1]).toEqual([2, 2, imgFile, 'skipped']);
    });

    it('analyzes all files with "all" preset', async () => {
      const docFile = join(testDir, 'doc.pdf');
      const imgFile = join(testDir, 'photo.jpg');
      const txtFile = join(testDir, 'readme.txt');
      await writeFile(docFile, 'PDF content');
      await writeFile(imgFile, 'Image data');
      await writeFile(txtFile, 'Text content');

      // Story 10.6: Need to mock health check first
      mockFetch
        .mockResolvedValueOnce(createMockTagsResponse())
        .mockResolvedValueOnce(createMockGenerateResponse({
          suggestedName: 'doc',
          confidence: 0.8,
          reasoning: 'Doc',
        }))
        .mockResolvedValueOnce(createMockGenerateResponse({
          suggestedName: 'photo',
          confidence: 0.8,
          reasoning: 'Photo',
        }))
        .mockResolvedValueOnce(createMockGenerateResponse({
          suggestedName: 'readme',
          confidence: 0.8,
          reasoning: 'Readme',
        }));

      const configAll: OllamaConfig = {
        ...defaultConfig,
        fileTypes: {
          preset: 'all',
          includedExtensions: [],
          excludedExtensions: [],
          skipWithMetadata: true,
        },
      };

      const result = await analyzeFilesWithFilter([docFile, imgFile, txtFile], configAll);

      expect(result.analyzed.size).toBe(3);
      expect(result.skipped.size).toBe(0);
    });

    it('handles empty file list', async () => {
      const result = await analyzeFilesWithFilter([], defaultConfig);

      expect(result.analyzed.size).toBe(0);
      expect(result.skipped.size).toBe(0);
    });

    it('stops on error when continueOnError is false', async () => {
      const badFile = '/nonexistent/file.pdf';
      const goodFile = join(testDir, 'good.pdf');
      await writeFile(goodFile, 'Good PDF content');

      // Story 10.6: Need to mock health check first
      mockFetch.mockResolvedValueOnce(createMockTagsResponse());

      const result = await analyzeFilesWithFilter([badFile, goodFile], defaultConfig, {
        batchOptions: { continueOnError: false },
      });

      expect(result.analyzed.size).toBe(1);
      expect(result.analyzed.get(badFile)?.ok).toBe(false);
      expect(result.analyzed.has(goodFile)).toBe(false);
    });
  });

  describe('isAnalysisAvailable', () => {
    it('returns false when disabled', async () => {
      const config: OllamaConfig = { ...defaultConfig, enabled: false };

      const result = await isAnalysisAvailable(config);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toBe(false);
      }
    });

    it('returns false when no model configured', async () => {
      const config: OllamaConfig = { ...defaultConfig, models: {} };

      const result = await isAnalysisAvailable(config);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toBe(false);
      }
    });

    it('returns true when Ollama is healthy', async () => {
      mockFetch.mockResolvedValueOnce(createMockTagsResponse());

      const result = await isAnalysisAvailable(defaultConfig);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toBe(true);
      }
    });

    it('returns connection error when Ollama unavailable', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('fetch failed'));

      const result = await isAnalysisAvailable(defaultConfig);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('CONNECTION_FAILED');
      }
    });
  });

  describe('getAnalysisStatus', () => {
    it('returns disabled reason when not enabled', async () => {
      const config: OllamaConfig = { ...defaultConfig, enabled: false };

      const status = await getAnalysisStatus(config);

      expect(status.available).toBe(false);
      expect(status.reason).toContain('disabled');
    });

    it('returns no model reason when model missing', async () => {
      const config: OllamaConfig = { ...defaultConfig, models: {} };

      const status = await getAnalysisStatus(config);

      expect(status.available).toBe(false);
      expect(status.reason).toContain('model');
    });

    it('returns connection error reason when Ollama fails', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('fetch failed'));

      const status = await getAnalysisStatus(defaultConfig);

      expect(status.available).toBe(false);
      expect(status.reason).toContain('connection failed');
    });

    it('returns available with model when healthy', async () => {
      mockFetch.mockResolvedValueOnce(createMockTagsResponse());

      const status = await getAnalysisStatus(defaultConfig);

      expect(status.available).toBe(true);
      expect(status.model).toBe('mistral');
      expect(status.reason).toBeUndefined();
    });
  });

  // ===========================================================================
  // Vision Integration Tests - Story 10.5
  // ===========================================================================
  describe('vision integration', () => {
    // Create small test PNG data
    const testPngData = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
      0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41,
      0x54, 0x08, 0xd7, 0x63, 0xf8, 0xff, 0xff, 0x3f,
      0x00, 0x05, 0xfe, 0x02, 0xfe, 0xdc, 0xcc, 0x59,
      0xe7, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e,
      0x44, 0xae, 0x42, 0x60, 0x82,
    ]);

    const visionEnabledConfig: OllamaConfig = {
      enabled: true,
      baseUrl: 'http://localhost:11434',
      timeout: 30000,
      models: { inference: 'mistral', vision: 'llava' },
      fileTypes: DEFAULT_LLM_FILE_TYPES,
      visionEnabled: true,
      skipImagesWithExif: false,
      maxImageSize: 20 * 1024 * 1024,
    };

    const visionDisabledConfig: OllamaConfig = {
      enabled: true,
      baseUrl: 'http://localhost:11434',
      timeout: 30000,
      models: { inference: 'mistral', vision: 'llava' },
      fileTypes: DEFAULT_LLM_FILE_TYPES,
      visionEnabled: false,
      skipImagesWithExif: true,
      maxImageSize: 20 * 1024 * 1024,
    };

    const createMockVisionResponse = (suggestion: object) => ({
      ok: true,
      json: () => Promise.resolve({
        message: {
          role: 'assistant',
          content: JSON.stringify(suggestion),
        },
      }),
    });

    it('routes image files to vision analysis when enabled', async () => {
      const imagePath = join(testDir, 'photo.png');
      await writeFile(imagePath, testPngData);

      mockFetch.mockResolvedValueOnce(createMockVisionResponse({
        suggestedName: 'sunset-beach',
        confidence: 0.9,
        reasoning: 'Image of a sunset at the beach',
        keywords: ['sunset', 'beach'],
      }));

      const result = await analyzeFile(imagePath, visionEnabledConfig);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.suggestion.suggestedName).toBe('sunset-beach');
        expect(result.data.modelUsed).toBe('llava');
      }
    });

    it('uses text analysis for non-image files with vision enabled', async () => {
      const textPath = join(testDir, 'document.txt');
      await writeFile(textPath, 'This is a test document about programming.');

      mockFetch.mockResolvedValueOnce(createMockGenerateResponse({
        suggestedName: 'programming-guide',
        confidence: 0.85,
        reasoning: 'Document about programming',
        keywords: ['programming'],
      }));

      const result = await analyzeFile(textPath, visionEnabledConfig);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.modelUsed).toBe('mistral');
      }
    });

    it('uses text analysis for images when vision disabled', async () => {
      const imagePath = join(testDir, 'photo.png');
      await writeFile(imagePath, testPngData);

      // When vision is disabled, images go through text extraction
      // which reads binary as text and tries inference model
      mockFetch.mockResolvedValueOnce(createMockGenerateResponse({
        suggestedName: 'binary-file',
        confidence: 0.3,
        reasoning: 'Unreadable binary content',
      }));

      const result = await analyzeFile(imagePath, visionDisabledConfig);

      // Should succeed but use inference model, not vision model
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.modelUsed).toBe('mistral'); // Not llava
      }
    });

    it('returns error if vision model not configured', async () => {
      const imagePath = join(testDir, 'photo.png');
      await writeFile(imagePath, testPngData);

      const noVisionModelConfig: OllamaConfig = {
        ...visionEnabledConfig,
        models: { inference: 'mistral' }, // No vision model
      };

      const result = await analyzeFile(imagePath, noVisionModelConfig);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('MODEL_NOT_FOUND');
      }
    });

    it('handles vision API errors gracefully', async () => {
      const imagePath = join(testDir, 'photo.png');
      await writeFile(imagePath, testPngData);

      mockFetch.mockRejectedValueOnce(new TypeError('fetch failed'));

      const result = await analyzeFile(imagePath, visionEnabledConfig);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('CONNECTION_FAILED');
      }
    });

    describe('analyzeFilesWithFilter with vision', () => {
      it('routes image files through vision analysis in batch', async () => {
        const imagePath = join(testDir, 'photo.jpg');
        const textPath = join(testDir, 'document.txt');
        await writeFile(imagePath, testPngData);
        await writeFile(textPath, 'Document content');

        // Story 10.6: Need to mock health check first, then vision, then text
        mockFetch
          .mockResolvedValueOnce(createMockTagsResponse())
          .mockResolvedValueOnce(createMockVisionResponse({
            suggestedName: 'photo-result',
            confidence: 0.85,
            reasoning: 'Photo analysis',
          }))
          .mockResolvedValueOnce(createMockGenerateResponse({
            suggestedName: 'text-result',
            confidence: 0.80,
            reasoning: 'Text analysis',
          }));

        const configWithImagePreset: OllamaConfig = {
          ...visionEnabledConfig,
          fileTypes: { preset: 'all', includedExtensions: [], excludedExtensions: [], skipWithMetadata: false },
        };

        const result = await analyzeFilesWithFilter([imagePath, textPath], configWithImagePreset);

        expect(result.analyzed.size).toBe(2);
        const imageResult = result.analyzed.get(imagePath);
        const textResult = result.analyzed.get(textPath);

        expect(imageResult?.ok).toBe(true);
        expect(textResult?.ok).toBe(true);

        if (imageResult?.ok) {
          expect(imageResult.data.modelUsed).toBe('llava');
        }
        if (textResult?.ok) {
          expect(textResult.data.modelUsed).toBe('mistral');
        }
      });
    });
  });

  // ===========================================================================
  // Offline Fallback Tests - Story 10.6
  // ===========================================================================
  describe('offline fallback', () => {
    const offlineConfig: OllamaConfig & { offlineMode?: string; healthCheckTimeout?: number } = {
      ...defaultConfig,
      offlineMode: 'auto',
      healthCheckTimeout: 5000,
    };

    describe('analyzeFilesWithFilter with offline support', () => {
      it('creates offline fallbacks when LLM disabled', async () => {
        const file1 = join(testDir, 'doc1.pdf');
        const file2 = join(testDir, 'doc2.pdf');
        await writeFile(file1, 'PDF content 1');
        await writeFile(file2, 'PDF content 2');

        const disabledConfig: OllamaConfig = { ...offlineConfig, enabled: false };

        const result = await analyzeFilesWithFilter([file1, file2], disabledConfig);

        expect(result.offlineFallbacks.size).toBe(2);
        expect(result.analyzed.size).toBe(0);
        expect(result.summary.llmStatus).toBe('unavailable');
        expect(result.summary.offlineFallbackCount).toBe(2);
      });

      it('creates offline fallbacks when connection fails', async () => {
        const file1 = join(testDir, 'doc.pdf');
        await writeFile(file1, 'PDF content');

        mockFetch.mockRejectedValue(new TypeError('fetch failed'));

        const result = await analyzeFilesWithFilter([file1], offlineConfig);

        expect(result.offlineFallbacks.size).toBe(1);
        expect(result.analyzed.size).toBe(0);
        expect(result.summary.llmStatus).toBe('unavailable');
      });

      it('returns summary with available status when LLM works', async () => {
        const file1 = join(testDir, 'doc.pdf');
        await writeFile(file1, 'PDF content');

        // First call for health check, second for analysis
        mockFetch
          .mockResolvedValueOnce(createMockTagsResponse())
          .mockResolvedValueOnce(createMockGenerateResponse({
            suggestedName: 'document',
            confidence: 0.8,
            reasoning: 'Document',
          }));

        const result = await analyzeFilesWithFilter([file1], offlineConfig);

        expect(result.analyzed.size).toBe(1);
        expect(result.offlineFallbacks.size).toBe(0);
        expect(result.summary.llmStatus).toBe('available');
        expect(result.summary.llmAnalyzedCount).toBe(1);
      });

      it('detects LLM becoming unavailable mid-batch', async () => {
        const file1 = join(testDir, 'doc1.pdf');
        const file2 = join(testDir, 'doc2.pdf');
        const file3 = join(testDir, 'doc3.pdf');
        await writeFile(file1, 'PDF content 1');
        await writeFile(file2, 'PDF content 2');
        await writeFile(file3, 'PDF content 3');

        // Health check passes, first file succeeds, second file connection fails
        mockFetch
          .mockResolvedValueOnce(createMockTagsResponse())
          .mockResolvedValueOnce(createMockGenerateResponse({
            suggestedName: 'doc1',
            confidence: 0.8,
            reasoning: 'First doc',
          }))
          .mockRejectedValueOnce(new TypeError('fetch failed'));

        const result = await analyzeFilesWithFilter([file1, file2, file3], offlineConfig);

        // First file analyzed, second and third are offline fallbacks
        expect(result.analyzed.size).toBe(1);
        expect(result.offlineFallbacks.size).toBe(2);
        expect(result.summary.llmStatus).toBe('partial');
        expect(result.summary.llmAnalyzedCount).toBe(1);
        expect(result.summary.offlineFallbackCount).toBe(2);
      });

      it('calls progress callback with offline-fallback status', async () => {
        const file1 = join(testDir, 'doc.pdf');
        await writeFile(file1, 'PDF content');

        mockFetch.mockRejectedValue(new TypeError('fetch failed'));

        const progressCalls: [number, number, string, string][] = [];

        await analyzeFilesWithFilter([file1], offlineConfig, {
          onProgress: (current, total, file, status) => {
            progressCalls.push([current, total, file, status]);
          },
        });

        expect(progressCalls.length).toBeGreaterThan(0);
        // At least one call should have offline-fallback status
        const fallbackCall = progressCalls.find(call => call[3] === 'offline-fallback');
        expect(fallbackCall).toBeDefined();
      });

      it('respects offlineMode disabled setting', async () => {
        const file1 = join(testDir, 'doc.pdf');
        await writeFile(file1, 'PDF content');

        mockFetch.mockRejectedValue(new TypeError('fetch failed'));

        const disabledOfflineConfig: OllamaConfig & { offlineMode?: string } = {
          ...offlineConfig,
          offlineMode: 'disabled',
        };

        const result = await analyzeFilesWithFilter([file1], disabledOfflineConfig);

        // With offlineMode: disabled, should fail completely
        expect(result.offlineFallbacks.size).toBe(1);
        expect(result.summary.errors.length).toBeGreaterThan(0);
        expect(result.summary.errors[0]).toContain('LLM required');
      });

      it('includes message in fallback when connection fails', async () => {
        const file1 = join(testDir, 'doc.pdf');
        await writeFile(file1, 'PDF content');

        mockFetch.mockRejectedValue(new TypeError('fetch failed'));

        const result = await analyzeFilesWithFilter([file1], offlineConfig);

        // In auto mode with connection failure, files fall back gracefully
        // The fallback result contains the reason
        expect(result.offlineFallbacks.size).toBe(1);
        const fallback = result.offlineFallbacks.get(file1);
        expect(fallback?.reason).toContain('unavailable');
      });

      it('handles mixed success and offline fallback', async () => {
        const docFile = join(testDir, 'doc.pdf');
        const imgFile = join(testDir, 'photo.jpg'); // Will be skipped by documents preset
        await writeFile(docFile, 'PDF content');
        await writeFile(imgFile, 'Image data');

        mockFetch
          .mockResolvedValueOnce(createMockTagsResponse())
          .mockResolvedValueOnce(createMockGenerateResponse({
            suggestedName: 'document',
            confidence: 0.8,
            reasoning: 'Document',
          }));

        const result = await analyzeFilesWithFilter([docFile, imgFile], offlineConfig);

        expect(result.analyzed.size).toBe(1);
        expect(result.skipped.size).toBe(1);
        expect(result.offlineFallbacks.size).toBe(0);
        expect(result.summary.llmStatus).toBe('available');
        expect(result.summary.skippedCount).toBe(1);
      });

      it('tracks vision analysis separately in summary', async () => {
        const imagePath = join(testDir, 'photo.jpg');
        await writeFile(imagePath, Buffer.from([0x89, 0x50, 0x4e, 0x47])); // PNG header

        const visionConfig: OllamaConfig & { offlineMode?: string; healthCheckTimeout?: number } = {
          ...offlineConfig,
          visionEnabled: true,
          models: { inference: 'mistral', vision: 'llava' },
          fileTypes: { preset: 'images', includedExtensions: [], excludedExtensions: [], skipWithMetadata: false },
        };

        mockFetch
          .mockResolvedValueOnce(createMockTagsResponse())
          .mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({
              message: {
                role: 'assistant',
                content: JSON.stringify({
                  suggestedName: 'photo',
                  confidence: 0.8,
                  reasoning: 'Photo',
                }),
              },
            }),
          });

        const result = await analyzeFilesWithFilter([imagePath], visionConfig);

        expect(result.summary.visionAnalyzedCount).toBe(1);
        expect(result.summary.llmAnalyzedCount).toBe(0);
      });

      it('handles timeout errors as connection errors', async () => {
        const file1 = join(testDir, 'doc.pdf');
        await writeFile(file1, 'PDF content');

        // First call succeeds (health check), second times out
        mockFetch
          .mockResolvedValueOnce(createMockTagsResponse())
          .mockRejectedValueOnce(new DOMException('aborted', 'AbortError'));

        const result = await analyzeFilesWithFilter([file1], offlineConfig);

        // Should handle timeout gracefully
        expect(result.analyzed.size + result.offlineFallbacks.size).toBe(1);
      });

      it('returns empty result for empty file list', async () => {
        const result = await analyzeFilesWithFilter([], offlineConfig);

        expect(result.analyzed.size).toBe(0);
        expect(result.skipped.size).toBe(0);
        expect(result.offlineFallbacks.size).toBe(0);
        expect(result.summary.llmStatus).toBe('unavailable');
      });

      it('preserves offline fallback reason from initial check', async () => {
        const file1 = join(testDir, 'doc.pdf');
        await writeFile(file1, 'PDF content');

        // No model configured - should explain why
        const noModelConfig: OllamaConfig & { offlineMode?: string } = {
          ...offlineConfig,
          models: {},
        };

        const result = await analyzeFilesWithFilter([file1], noModelConfig);

        expect(result.offlineFallbacks.size).toBe(1);
        const fallback = result.offlineFallbacks.get(file1);
        expect(fallback?.reason).toContain('No inference model');
      });

      it('switches to offline mode after connection error mid-batch', async () => {
        const files = Array.from({ length: 5 }, (_, i) => join(testDir, `doc${i}.pdf`));
        for (const file of files) {
          await writeFile(file, 'PDF content');
        }

        // Health check passes, first 2 files succeed, third fails, remaining should fallback
        mockFetch
          .mockResolvedValueOnce(createMockTagsResponse())
          .mockResolvedValueOnce(createMockGenerateResponse({
            suggestedName: 'doc0',
            confidence: 0.8,
            reasoning: 'Doc 0',
          }))
          .mockResolvedValueOnce(createMockGenerateResponse({
            suggestedName: 'doc1',
            confidence: 0.8,
            reasoning: 'Doc 1',
          }))
          .mockRejectedValueOnce(new TypeError('fetch failed'));

        const progressCalls: string[] = [];
        const result = await analyzeFilesWithFilter(files, offlineConfig, {
          onProgress: (_current, _total, _file, status) => {
            progressCalls.push(status);
          },
        });

        expect(result.analyzed.size).toBe(2);
        expect(result.offlineFallbacks.size).toBe(3);
        expect(result.summary.llmStatus).toBe('partial');

        // Should see analyzing for first 3, then offline-fallback for last 2
        expect(progressCalls.filter(s => s === 'analyzing').length).toBe(3);
        expect(progressCalls.filter(s => s === 'offline-fallback').length).toBe(2);
      });

      it('continues without LLM after forced offline mode', async () => {
        const file1 = join(testDir, 'doc.pdf');
        await writeFile(file1, 'PDF content');

        const forcedOfflineConfig: OllamaConfig & { offlineMode?: string } = {
          ...offlineConfig,
          offlineMode: 'enabled',
        };

        // Should NOT call fetch for analysis since offline mode is forced
        const result = await analyzeFilesWithFilter([file1], forcedOfflineConfig);

        expect(result.offlineFallbacks.size).toBe(1);
        expect(result.analyzed.size).toBe(0);
        expect(result.summary.llmStatus).toBe('unavailable');
      });
    });
  });
});
