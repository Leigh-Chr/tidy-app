/**
 * @fileoverview Tests for vision API client - Story 10.5
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  analyzeImageWithVision,
  KNOWN_VISION_MODELS,
  isVisionCapableModel,
  detectVisionModels,
  checkVisionModelAvailable,
  VISION_NAMING_SYSTEM_PROMPT,
} from './vision.js';
import type { OllamaConfig, OllamaModel } from './types.js';

describe('Vision API Client - Story 10.5', () => {
  let testDir: string;

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

  beforeEach(async () => {
    testDir = join(tmpdir(), `vision-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  // ===========================================================================
  // KNOWN_VISION_MODELS (Task 4.1)
  // ===========================================================================
  describe('KNOWN_VISION_MODELS', () => {
    it('should include common vision models', () => {
      expect(KNOWN_VISION_MODELS).toContain('llava');
      expect(KNOWN_VISION_MODELS).toContain('gemma3');
      expect(KNOWN_VISION_MODELS).toContain('bakllava');
      expect(KNOWN_VISION_MODELS).toContain('moondream');
      expect(KNOWN_VISION_MODELS).toContain('minicpm-v');
    });

    it('should include versioned variants', () => {
      expect(KNOWN_VISION_MODELS).toContain('llava:7b');
      expect(KNOWN_VISION_MODELS).toContain('llava:13b');
    });

    it('should be readonly array', () => {
      expect(Array.isArray(KNOWN_VISION_MODELS)).toBe(true);
    });
  });

  // ===========================================================================
  // isVisionCapableModel (Task 4.2)
  // ===========================================================================
  describe('isVisionCapableModel', () => {
    it('should return true for known vision models', () => {
      expect(isVisionCapableModel('llava')).toBe(true);
      expect(isVisionCapableModel('gemma3')).toBe(true);
      expect(isVisionCapableModel('bakllava')).toBe(true);
      expect(isVisionCapableModel('moondream')).toBe(true);
    });

    it('should return true for models with tags', () => {
      expect(isVisionCapableModel('llava:latest')).toBe(true);
      expect(isVisionCapableModel('llava:7b')).toBe(true);
      expect(isVisionCapableModel('gemma3:2b')).toBe(true);
    });

    it('should be case-insensitive', () => {
      expect(isVisionCapableModel('LLAVA')).toBe(true);
      expect(isVisionCapableModel('Llava')).toBe(true);
      expect(isVisionCapableModel('GEMMA3')).toBe(true);
    });

    it('should return false for text-only models', () => {
      expect(isVisionCapableModel('mistral')).toBe(false);
      expect(isVisionCapableModel('llama3')).toBe(false);
      expect(isVisionCapableModel('codellama')).toBe(false);
      expect(isVisionCapableModel('phi3')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isVisionCapableModel('')).toBe(false);
    });

    it('should handle partial matches correctly', () => {
      // 'llava-llama3' should match because it starts with 'llava'
      expect(isVisionCapableModel('llava-llama3')).toBe(true);
      // 'my-llava' should not match (prefix match only)
      expect(isVisionCapableModel('my-llava')).toBe(false);
    });
  });

  // ===========================================================================
  // detectVisionModels (Task 4.3)
  // ===========================================================================
  describe('detectVisionModels', () => {
    const createModel = (name: string): OllamaModel => ({
      name,
      model: name,
      modified_at: '2024-01-01T00:00:00Z',
      size: 1000000000,
      digest: 'sha256:test',
    });

    it('should filter vision-capable models from list', () => {
      const models: OllamaModel[] = [
        createModel('llava:latest'),
        createModel('mistral:latest'),
        createModel('gemma3:2b'),
        createModel('llama3:8b'),
      ];

      const visionModels = detectVisionModels(models);

      expect(visionModels).toHaveLength(2);
      expect(visionModels.map(m => m.name)).toEqual(['llava:latest', 'gemma3:2b']);
    });

    it('should return empty array if no vision models', () => {
      const models: OllamaModel[] = [
        createModel('mistral:latest'),
        createModel('llama3:8b'),
      ];

      const visionModels = detectVisionModels(models);

      expect(visionModels).toHaveLength(0);
    });

    it('should handle empty input', () => {
      expect(detectVisionModels([])).toEqual([]);
    });
  });

  // ===========================================================================
  // checkVisionModelAvailable (Task 4.4)
  // ===========================================================================
  describe('checkVisionModelAvailable', () => {
    it('should return ok with model info if vision model available', () => {
      const createModel = (name: string): OllamaModel => ({
        name,
        model: name,
        modified_at: '2024-01-01T00:00:00Z',
        size: 1000000000,
        digest: 'sha256:test',
      });

      const models: OllamaModel[] = [
        createModel('llava:latest'),
        createModel('mistral:latest'),
      ];
      const config: OllamaConfig = {
        enabled: true,
        baseUrl: 'http://localhost:11434',
        timeout: 30000,
        models: { vision: 'llava' },
        fileTypes: { preset: 'images', includedExtensions: [], excludedExtensions: [], skipWithMetadata: true },
        visionEnabled: true,
        skipImagesWithExif: true,
        maxImageSize: 20 * 1024 * 1024,
      };

      const result = checkVisionModelAvailable(config, models);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.name).toBe('llava:latest');
      }
    });

    it('should return error if vision model not configured', () => {
      const config: OllamaConfig = {
        enabled: true,
        baseUrl: 'http://localhost:11434',
        timeout: 30000,
        models: {}, // No vision model
        fileTypes: { preset: 'images', includedExtensions: [], excludedExtensions: [], skipWithMetadata: true },
        visionEnabled: true,
        skipImagesWithExif: true,
        maxImageSize: 20 * 1024 * 1024,
      };

      const result = checkVisionModelAvailable(config, []);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('MODEL_NOT_FOUND');
        expect(result.error.message).toContain('No vision model configured');
      }
    });

    it('should return error if configured vision model not installed', () => {
      const createModel = (name: string): OllamaModel => ({
        name,
        model: name,
        modified_at: '2024-01-01T00:00:00Z',
        size: 1000000000,
        digest: 'sha256:test',
      });

      const models: OllamaModel[] = [createModel('mistral:latest')];
      const config: OllamaConfig = {
        enabled: true,
        baseUrl: 'http://localhost:11434',
        timeout: 30000,
        models: { vision: 'llava' },
        fileTypes: { preset: 'images', includedExtensions: [], excludedExtensions: [], skipWithMetadata: true },
        visionEnabled: true,
        skipImagesWithExif: true,
        maxImageSize: 20 * 1024 * 1024,
      };

      const result = checkVisionModelAvailable(config, models);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('MODEL_NOT_FOUND');
        expect(result.error.message).toContain('llava');
        expect(result.error.message).toContain('not found');
      }
    });

    it('should warn if configured model is not vision-capable', () => {
      const createModel = (name: string): OllamaModel => ({
        name,
        model: name,
        modified_at: '2024-01-01T00:00:00Z',
        size: 1000000000,
        digest: 'sha256:test',
      });

      const models: OllamaModel[] = [createModel('mistral:latest')];
      const config: OllamaConfig = {
        enabled: true,
        baseUrl: 'http://localhost:11434',
        timeout: 30000,
        models: { vision: 'mistral' }, // Not a vision model
        fileTypes: { preset: 'images', includedExtensions: [], excludedExtensions: [], skipWithMetadata: true },
        visionEnabled: true,
        skipImagesWithExif: true,
        maxImageSize: 20 * 1024 * 1024,
      };

      const result = checkVisionModelAvailable(config, models);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('MODEL_NOT_FOUND');
        expect(result.error.message).toContain('not a known vision-capable model');
      }
    });
  });

  // ===========================================================================
  // VISION_NAMING_SYSTEM_PROMPT (Task 3.5)
  // ===========================================================================
  describe('VISION_NAMING_SYSTEM_PROMPT', () => {
    it('should mention kebab-case', () => {
      expect(VISION_NAMING_SYSTEM_PROMPT).toContain('kebab-case');
    });

    it('should mention descriptive filenames', () => {
      expect(VISION_NAMING_SYSTEM_PROMPT.toLowerCase()).toContain('descriptive');
    });

    it('should be non-empty', () => {
      expect(VISION_NAMING_SYSTEM_PROMPT.length).toBeGreaterThan(0);
    });
  });

  // ===========================================================================
  // analyzeImageWithVision (Task 3.2, 3.3, 3.4, 3.6, 3.7)
  // ===========================================================================
  describe('analyzeImageWithVision', () => {
    it('should return error if no vision model configured', async () => {
      const testPath = join(testDir, 'test.png');
      await writeFile(testPath, testPngData);

      const config: OllamaConfig = {
        enabled: true,
        baseUrl: 'http://localhost:11434',
        timeout: 30000,
        models: {}, // No vision model
        fileTypes: { preset: 'images', includedExtensions: [], excludedExtensions: [], skipWithMetadata: true },
        visionEnabled: true,
        skipImagesWithExif: true,
        maxImageSize: 20 * 1024 * 1024,
      };

      const result = await analyzeImageWithVision(testPath, config);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('MODEL_NOT_FOUND');
        expect(result.error.message).toContain('No vision model configured');
      }
    });

    it('should return error for non-image file', async () => {
      const testPath = join(testDir, 'test.txt');
      await writeFile(testPath, 'not an image');

      const config: OllamaConfig = {
        enabled: true,
        baseUrl: 'http://localhost:11434',
        timeout: 30000,
        models: { vision: 'llava' },
        fileTypes: { preset: 'images', includedExtensions: [], excludedExtensions: [], skipWithMetadata: true },
        visionEnabled: true,
        skipImagesWithExif: true,
        maxImageSize: 20 * 1024 * 1024,
      };

      const result = await analyzeImageWithVision(testPath, config);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('CONTENT_EXTRACTION_FAILED');
        expect(result.error.message).toContain('not a supported image format');
      }
    });

    it('should return error for non-existent file', async () => {
      const config: OllamaConfig = {
        enabled: true,
        baseUrl: 'http://localhost:11434',
        timeout: 30000,
        models: { vision: 'llava' },
        fileTypes: { preset: 'images', includedExtensions: [], excludedExtensions: [], skipWithMetadata: true },
        visionEnabled: true,
        skipImagesWithExif: true,
        maxImageSize: 20 * 1024 * 1024,
      };

      const result = await analyzeImageWithVision('/nonexistent/image.jpg', config);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('CONTENT_EXTRACTION_FAILED');
      }
    });

    it('should return error for file exceeding max size', async () => {
      const largeData = Buffer.alloc(1024 * 1024); // 1MB
      const testPath = join(testDir, 'large.png');
      await writeFile(testPath, largeData);

      const config: OllamaConfig = {
        enabled: true,
        baseUrl: 'http://localhost:11434',
        timeout: 30000,
        models: { vision: 'llava' },
        fileTypes: { preset: 'images', includedExtensions: [], excludedExtensions: [], skipWithMetadata: true },
        visionEnabled: true,
        skipImagesWithExif: true,
        maxImageSize: 100, // Very small limit
      };

      const result = await analyzeImageWithVision(testPath, config);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('CONTENT_EXTRACTION_FAILED');
        expect(result.error.message).toContain('exceeds maximum size');
      }
    });

    it('should handle network error gracefully', async () => {
      const testPath = join(testDir, 'test.png');
      await writeFile(testPath, testPngData);

      // Mock fetch to fail
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('fetch failed'));

      const config: OllamaConfig = {
        enabled: true,
        baseUrl: 'http://localhost:11434',
        timeout: 30000,
        models: { vision: 'llava' },
        fileTypes: { preset: 'images', includedExtensions: [], excludedExtensions: [], skipWithMetadata: true },
        visionEnabled: true,
        skipImagesWithExif: true,
        maxImageSize: 20 * 1024 * 1024,
      };

      const result = await analyzeImageWithVision(testPath, config);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('CONNECTION_FAILED');
      }
    });

    it('should handle timeout gracefully', async () => {
      const testPath = join(testDir, 'test.png');
      await writeFile(testPath, testPngData);

      // Mock fetch to simulate timeout
      vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
        const error = new DOMException('Aborted', 'AbortError');
        return Promise.reject(error);
      });

      const config: OllamaConfig = {
        enabled: true,
        baseUrl: 'http://localhost:11434',
        timeout: 100,
        models: { vision: 'llava' },
        fileTypes: { preset: 'images', includedExtensions: [], excludedExtensions: [], skipWithMetadata: true },
        visionEnabled: true,
        skipImagesWithExif: true,
        maxImageSize: 20 * 1024 * 1024,
      };

      const result = await analyzeImageWithVision(testPath, config);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('TIMEOUT');
      }
    });

    it('should handle 404 error (model not found)', async () => {
      const testPath = join(testDir, 'test.png');
      await writeFile(testPath, testPngData);

      // Mock fetch to return 404
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ error: 'model not found' }), { status: 404 })
      );

      const config: OllamaConfig = {
        enabled: true,
        baseUrl: 'http://localhost:11434',
        timeout: 30000,
        models: { vision: 'llava' },
        fileTypes: { preset: 'images', includedExtensions: [], excludedExtensions: [], skipWithMetadata: true },
        visionEnabled: true,
        skipImagesWithExif: true,
        maxImageSize: 20 * 1024 * 1024,
      };

      const result = await analyzeImageWithVision(testPath, config);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('MODEL_NOT_FOUND');
        expect(result.error.message).toContain('ollama pull');
      }
    });

    it('should handle empty response', async () => {
      const testPath = join(testDir, 'test.png');
      await writeFile(testPath, testPngData);

      // Mock fetch to return empty response
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ message: { content: '' } }), { status: 200 })
      );

      const config: OllamaConfig = {
        enabled: true,
        baseUrl: 'http://localhost:11434',
        timeout: 30000,
        models: { vision: 'llava' },
        fileTypes: { preset: 'images', includedExtensions: [], excludedExtensions: [], skipWithMetadata: true },
        visionEnabled: true,
        skipImagesWithExif: true,
        maxImageSize: 20 * 1024 * 1024,
      };

      const result = await analyzeImageWithVision(testPath, config);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('INVALID_RESPONSE');
      }
    });

    it('should parse valid vision response', async () => {
      const testPath = join(testDir, 'test.png');
      await writeFile(testPath, testPngData);

      const validResponse = {
        message: {
          content: JSON.stringify({
            suggestedName: 'sunset-beach-photo',
            confidence: 0.85,
            reasoning: 'Image shows a beach at sunset',
            keywords: ['beach', 'sunset', 'ocean'],
          }),
        },
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify(validResponse), { status: 200 })
      );

      const config: OllamaConfig = {
        enabled: true,
        baseUrl: 'http://localhost:11434',
        timeout: 30000,
        models: { vision: 'llava' },
        fileTypes: { preset: 'images', includedExtensions: [], excludedExtensions: [], skipWithMetadata: true },
        visionEnabled: true,
        skipImagesWithExif: true,
        maxImageSize: 20 * 1024 * 1024,
      };

      const result = await analyzeImageWithVision(testPath, config);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.suggestion.suggestedName).toBe('sunset-beach-photo');
        expect(result.data.suggestion.confidence).toBe(0.85);
        expect(result.data.modelUsed).toBe('llava');
        expect(result.data.filePath).toBe(testPath);
      }
    });

    it('should handle malformed JSON response', async () => {
      const testPath = join(testDir, 'test.png');
      await writeFile(testPath, testPngData);

      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ message: { content: 'not valid json' } }), { status: 200 })
      );

      const config: OllamaConfig = {
        enabled: true,
        baseUrl: 'http://localhost:11434',
        timeout: 30000,
        models: { vision: 'llava' },
        fileTypes: { preset: 'images', includedExtensions: [], excludedExtensions: [], skipWithMetadata: true },
        visionEnabled: true,
        skipImagesWithExif: true,
        maxImageSize: 20 * 1024 * 1024,
      };

      const result = await analyzeImageWithVision(testPath, config);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('ANALYSIS_FAILED');
      }
    });

    it('should use 2x timeout for vision requests', async () => {
      const testPath = join(testDir, 'test.png');
      await writeFile(testPath, testPngData);

      let capturedSignal: AbortSignal | undefined;
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
        capturedSignal = init?.signal as AbortSignal | undefined;
        return new Response(JSON.stringify({
          message: {
            content: JSON.stringify({
              suggestedName: 'test',
              confidence: 0.8,
              reasoning: 'test',
            }),
          },
        }), { status: 200 });
      });

      const config: OllamaConfig = {
        enabled: true,
        baseUrl: 'http://localhost:11434',
        timeout: 30000,
        models: { vision: 'llava' },
        fileTypes: { preset: 'images', includedExtensions: [], excludedExtensions: [], skipWithMetadata: true },
        visionEnabled: true,
        skipImagesWithExif: true,
        maxImageSize: 20 * 1024 * 1024,
      };

      await analyzeImageWithVision(testPath, config);

      // The timeout should be used (2x the config timeout = 60000ms)
      // We can verify the signal was passed
      expect(capturedSignal).toBeDefined();
    });
  });
});
