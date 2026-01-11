/**
 * @fileoverview Tests for LLM types and schemas - Story 10.1
 */

import { describe, it, expect } from 'vitest';
import {
  ollamaErrorCodeSchema,
  ollamaErrorSchema,
  createOllamaError,
  ollamaConfigSchema,
  DEFAULT_OLLAMA_CONFIG,
  healthStatusSchema,
  createUnavailableHealthStatus,
  createAvailableHealthStatus,
  ollamaModelSchema,
  ollamaModelDetailsSchema,
  ollamaTagsResponseSchema,
  formatModelSize,
  formatModel,
  // Story 10.4: File type schemas
  llmFileTypesSchema,
  fileTypePresetSchema,
  DEFAULT_LLM_FILE_TYPES,
  type LlmFileTypes,
  type OllamaModel,
  type OllamaConfig,
} from './types.js';

describe('LLM Types - Story 10.1', () => {
  // ===========================================================================
  // Error Code Schema Tests (Task 1.3)
  // ===========================================================================
  describe('ollamaErrorCodeSchema', () => {
    it('should accept valid error codes', () => {
      expect(ollamaErrorCodeSchema.parse('CONNECTION_FAILED')).toBe('CONNECTION_FAILED');
      expect(ollamaErrorCodeSchema.parse('TIMEOUT')).toBe('TIMEOUT');
      expect(ollamaErrorCodeSchema.parse('MODEL_NOT_FOUND')).toBe('MODEL_NOT_FOUND');
      expect(ollamaErrorCodeSchema.parse('INVALID_RESPONSE')).toBe('INVALID_RESPONSE');
    });

    it('should reject invalid error codes', () => {
      expect(() => ollamaErrorCodeSchema.parse('UNKNOWN_ERROR')).toThrow();
      expect(() => ollamaErrorCodeSchema.parse('')).toThrow();
      expect(() => ollamaErrorCodeSchema.parse(123)).toThrow();
    });
  });

  describe('ollamaErrorSchema', () => {
    it('should validate complete error object', () => {
      const error = {
        code: 'CONNECTION_FAILED',
        message: 'Cannot connect to Ollama',
        originalError: new Error('ECONNREFUSED'),
      };
      const parsed = ollamaErrorSchema.parse(error);
      expect(parsed.code).toBe('CONNECTION_FAILED');
      expect(parsed.message).toBe('Cannot connect to Ollama');
      expect(parsed.originalError).toBeDefined();
    });

    it('should allow optional originalError', () => {
      const error = {
        code: 'TIMEOUT',
        message: 'Request timed out',
      };
      const parsed = ollamaErrorSchema.parse(error);
      expect(parsed.code).toBe('TIMEOUT');
      expect(parsed.originalError).toBeUndefined();
    });
  });

  describe('createOllamaError', () => {
    it('should create error with all fields', () => {
      const originalErr = new Error('test');
      const error = createOllamaError('CONNECTION_FAILED', 'Test message', originalErr);
      expect(error.code).toBe('CONNECTION_FAILED');
      expect(error.message).toBe('Test message');
      expect(error.originalError).toBe(originalErr);
    });

    it('should create error without originalError', () => {
      const error = createOllamaError('TIMEOUT', 'Timed out');
      expect(error.code).toBe('TIMEOUT');
      expect(error.message).toBe('Timed out');
      expect(error.originalError).toBeUndefined();
    });
  });

  // ===========================================================================
  // Configuration Schema Tests (Task 1.2)
  // ===========================================================================
  describe('ollamaConfigSchema', () => {
    it('should provide defaults for empty object', () => {
      const config = ollamaConfigSchema.parse({});
      expect(config.enabled).toBe(false);
      expect(config.baseUrl).toBe('http://localhost:11434');
      expect(config.timeout).toBe(30000);
      expect(config.models).toEqual({});
    });

    it('should accept valid complete config', () => {
      const input = {
        enabled: true,
        baseUrl: 'http://192.168.1.100:11434',
        timeout: 60000,
        models: {
          inference: 'mistral:latest',
          embedding: 'all-minilm',
        },
      };
      const config = ollamaConfigSchema.parse(input);
      expect(config.enabled).toBe(true);
      expect(config.baseUrl).toBe('http://192.168.1.100:11434');
      expect(config.timeout).toBe(60000);
      expect(config.models.inference).toBe('mistral:latest');
      expect(config.models.embedding).toBe('all-minilm');
    });

    it('should reject invalid URL', () => {
      expect(() => ollamaConfigSchema.parse({
        baseUrl: 'not-a-url',
      })).toThrow();
    });

    it('should reject negative timeout', () => {
      expect(() => ollamaConfigSchema.parse({
        timeout: -1000,
      })).toThrow();
    });

    it('should reject zero timeout', () => {
      expect(() => ollamaConfigSchema.parse({
        timeout: 0,
      })).toThrow();
    });
  });

  describe('DEFAULT_OLLAMA_CONFIG', () => {
    it('should have expected default values', () => {
      expect(DEFAULT_OLLAMA_CONFIG.enabled).toBe(false);
      expect(DEFAULT_OLLAMA_CONFIG.baseUrl).toBe('http://localhost:11434');
      expect(DEFAULT_OLLAMA_CONFIG.timeout).toBe(30000);
      expect(DEFAULT_OLLAMA_CONFIG.models).toEqual({});
    });

    it('should be valid according to schema', () => {
      const parsed = ollamaConfigSchema.parse(DEFAULT_OLLAMA_CONFIG);
      expect(parsed).toEqual(DEFAULT_OLLAMA_CONFIG);
    });
  });

  // ===========================================================================
  // Health Status Schema Tests (Task 1.2)
  // ===========================================================================
  describe('healthStatusSchema', () => {
    it('should validate available status', () => {
      const status = {
        available: true,
        version: '0.1.23',
        modelCount: 5,
        checkedAt: '2026-01-11T10:00:00.000Z',
      };
      const parsed = healthStatusSchema.parse(status);
      expect(parsed.available).toBe(true);
      expect(parsed.version).toBe('0.1.23');
      expect(parsed.modelCount).toBe(5);
    });

    it('should validate unavailable status', () => {
      const status = {
        available: false,
        checkedAt: '2026-01-11T10:00:00.000Z',
      };
      const parsed = healthStatusSchema.parse(status);
      expect(parsed.available).toBe(false);
      expect(parsed.version).toBeUndefined();
      expect(parsed.modelCount).toBeUndefined();
    });

    it('should reject invalid datetime', () => {
      expect(() => healthStatusSchema.parse({
        available: true,
        checkedAt: 'not-a-date',
      })).toThrow();
    });
  });

  describe('createUnavailableHealthStatus', () => {
    it('should create unavailable status', () => {
      const status = createUnavailableHealthStatus();
      expect(status.available).toBe(false);
      expect(status.checkedAt).toBeDefined();
      // Validate it's a valid ISO string
      expect(() => new Date(status.checkedAt)).not.toThrow();
    });
  });

  describe('createAvailableHealthStatus', () => {
    it('should create available status with model count', () => {
      const status = createAvailableHealthStatus(3, '0.1.23');
      expect(status.available).toBe(true);
      expect(status.modelCount).toBe(3);
      expect(status.version).toBe('0.1.23');
      expect(status.checkedAt).toBeDefined();
    });

    it('should create available status without optional fields', () => {
      const status = createAvailableHealthStatus();
      expect(status.available).toBe(true);
      expect(status.modelCount).toBeUndefined();
      expect(status.version).toBeUndefined();
    });
  });

  // ===========================================================================
  // Model Schema Tests (Task 1.2)
  // ===========================================================================
  describe('ollamaModelDetailsSchema', () => {
    it('should validate complete details', () => {
      const details = {
        family: 'mistral',
        parameter_size: '7B',
        quantization_level: 'Q4_0',
      };
      const parsed = ollamaModelDetailsSchema.parse(details);
      expect(parsed.family).toBe('mistral');
      expect(parsed.parameter_size).toBe('7B');
      expect(parsed.quantization_level).toBe('Q4_0');
    });

    it('should allow empty details', () => {
      const parsed = ollamaModelDetailsSchema.parse({});
      expect(parsed.family).toBeUndefined();
      expect(parsed.parameter_size).toBeUndefined();
      expect(parsed.quantization_level).toBeUndefined();
    });
  });

  describe('ollamaModelSchema', () => {
    it('should validate complete model', () => {
      const model = {
        name: 'mistral:latest',
        model: 'mistral:latest',
        modified_at: '2024-01-15T10:30:00Z',
        size: 4109865472,
        digest: 'sha256:abc123',
        details: {
          family: 'mistral',
          parameter_size: '7B',
          quantization_level: 'Q4_0',
        },
      };
      const parsed = ollamaModelSchema.parse(model);
      expect(parsed.name).toBe('mistral:latest');
      expect(parsed.size).toBe(4109865472);
      expect(parsed.details?.family).toBe('mistral');
    });

    it('should validate model without details', () => {
      const model = {
        name: 'llama3:latest',
        model: 'llama3:latest',
        modified_at: '2024-01-15T10:30:00Z',
        size: 8000000000,
        digest: 'sha256:def456',
      };
      const parsed = ollamaModelSchema.parse(model);
      expect(parsed.name).toBe('llama3:latest');
      expect(parsed.details).toBeUndefined();
    });

    it('should reject missing required fields', () => {
      expect(() => ollamaModelSchema.parse({
        name: 'test',
        // missing other required fields
      })).toThrow();
    });
  });

  describe('ollamaTagsResponseSchema', () => {
    it('should validate response with models', () => {
      const response = {
        models: [
          {
            name: 'mistral:latest',
            model: 'mistral:latest',
            modified_at: '2024-01-15T10:30:00Z',
            size: 4109865472,
            digest: 'sha256:abc123',
          },
        ],
      };
      const parsed = ollamaTagsResponseSchema.parse(response);
      expect(parsed.models).toHaveLength(1);
      expect(parsed.models[0].name).toBe('mistral:latest');
    });

    it('should default to empty array for missing models', () => {
      const parsed = ollamaTagsResponseSchema.parse({});
      expect(parsed.models).toEqual([]);
    });
  });

  // ===========================================================================
  // Formatting Functions Tests
  // ===========================================================================
  describe('formatModelSize', () => {
    it('should format bytes to GB for large sizes', () => {
      expect(formatModelSize(4109865472)).toBe('3.8 GB');
      expect(formatModelSize(8 * 1024 * 1024 * 1024)).toBe('8.0 GB');
    });

    it('should format bytes to MB for smaller sizes', () => {
      expect(formatModelSize(500 * 1024 * 1024)).toBe('500 MB');
      expect(formatModelSize(100 * 1024 * 1024)).toBe('100 MB');
    });

    it('should handle edge cases', () => {
      expect(formatModelSize(0)).toBe('0 MB');
      expect(formatModelSize(1024 * 1024 * 1024)).toBe('1.0 GB');
    });
  });

  describe('formatModel', () => {
    it('should format model with complete details', () => {
      const model: OllamaModel = {
        name: 'mistral:latest',
        model: 'mistral:latest',
        modified_at: '2024-01-15T10:30:00Z',
        size: 4109865472,
        digest: 'sha256:abc123',
        details: {
          family: 'mistral',
          parameter_size: '7B',
          quantization_level: 'Q4_0',
        },
      };
      const formatted = formatModel(model);
      expect(formatted.name).toBe('mistral:latest');
      expect(formatted.family).toBe('mistral');
      expect(formatted.parameterSize).toBe('7B');
      expect(formatted.quantization).toBe('Q4_0');
      expect(formatted.sizeBytes).toBe(4109865472);
      expect(formatted.sizeFormatted).toBe('3.8 GB');
    });

    it('should handle missing details', () => {
      const model: OllamaModel = {
        name: 'custom:v1',
        model: 'custom:v1',
        modified_at: '2024-01-15T10:30:00Z',
        size: 1000000000,
        digest: 'sha256:xyz789',
      };
      const formatted = formatModel(model);
      expect(formatted.name).toBe('custom:v1');
      expect(formatted.family).toBe('unknown');
      expect(formatted.parameterSize).toBe('unknown');
      expect(formatted.quantization).toBe('unknown');
    });
  });
});

// =============================================================================
// Story 10.4: LLM File Type Configuration Tests
// =============================================================================
describe('LLM File Types - Story 10.4', () => {
  // ===========================================================================
  // File Type Preset Schema Tests (AC2)
  // ===========================================================================
  describe('fileTypePresetSchema', () => {
    it('should accept valid preset names', () => {
      expect(fileTypePresetSchema.parse('images')).toBe('images');
      expect(fileTypePresetSchema.parse('documents')).toBe('documents');
      expect(fileTypePresetSchema.parse('text')).toBe('text');
      expect(fileTypePresetSchema.parse('all')).toBe('all');
      expect(fileTypePresetSchema.parse('custom')).toBe('custom');
    });

    it('should reject invalid preset names', () => {
      expect(() => fileTypePresetSchema.parse('invalid')).toThrow();
      expect(() => fileTypePresetSchema.parse('')).toThrow();
      expect(() => fileTypePresetSchema.parse('Images')).toThrow(); // case sensitive
    });
  });

  // ===========================================================================
  // LLM File Types Schema Tests (AC1, AC5)
  // ===========================================================================
  describe('llmFileTypesSchema', () => {
    it('should provide default values for empty object', () => {
      const result = llmFileTypesSchema.parse({});
      expect(result.preset).toBe('documents');
      expect(result.includedExtensions).toEqual([]);
      expect(result.excludedExtensions).toEqual([]);
      expect(result.skipWithMetadata).toBe(true);
    });

    it('should accept complete configuration', () => {
      const config: LlmFileTypes = {
        preset: 'custom',
        includedExtensions: ['log', 'conf'],
        excludedExtensions: ['exe', 'dll'],
        skipWithMetadata: false,
      };
      const result = llmFileTypesSchema.parse(config);
      expect(result.preset).toBe('custom');
      expect(result.includedExtensions).toEqual(['log', 'conf']);
      expect(result.excludedExtensions).toEqual(['exe', 'dll']);
      expect(result.skipWithMetadata).toBe(false);
    });

    it('should accept preset with empty extensions', () => {
      const result = llmFileTypesSchema.parse({
        preset: 'images',
      });
      expect(result.preset).toBe('images');
      expect(result.includedExtensions).toEqual([]);
    });

    it('should accept extensions with dots', () => {
      const result = llmFileTypesSchema.parse({
        includedExtensions: ['.pdf', '.doc'],
      });
      expect(result.includedExtensions).toEqual(['.pdf', '.doc']);
    });

    it('should accept extensions without dots', () => {
      const result = llmFileTypesSchema.parse({
        includedExtensions: ['pdf', 'doc'],
      });
      expect(result.includedExtensions).toEqual(['pdf', 'doc']);
    });

    it('should reject invalid preset', () => {
      expect(() => llmFileTypesSchema.parse({
        preset: 'invalid',
      })).toThrow();
    });

    it('should reject non-array for extensions', () => {
      expect(() => llmFileTypesSchema.parse({
        includedExtensions: 'pdf',
      })).toThrow();
    });

    it('should reject non-boolean for skipWithMetadata', () => {
      expect(() => llmFileTypesSchema.parse({
        skipWithMetadata: 'yes',
      })).toThrow();
    });
  });

  // ===========================================================================
  // Default File Types Tests (AC5)
  // ===========================================================================
  describe('DEFAULT_LLM_FILE_TYPES', () => {
    it('should have documents as default preset', () => {
      expect(DEFAULT_LLM_FILE_TYPES.preset).toBe('documents');
    });

    it('should have empty extension arrays by default', () => {
      expect(DEFAULT_LLM_FILE_TYPES.includedExtensions).toEqual([]);
      expect(DEFAULT_LLM_FILE_TYPES.excludedExtensions).toEqual([]);
    });

    it('should skip files with metadata by default', () => {
      expect(DEFAULT_LLM_FILE_TYPES.skipWithMetadata).toBe(true);
    });

    it('should be valid according to schema', () => {
      const parsed = llmFileTypesSchema.parse(DEFAULT_LLM_FILE_TYPES);
      expect(parsed).toEqual(DEFAULT_LLM_FILE_TYPES);
    });
  });

  // ===========================================================================
  // Ollama Config with File Types Tests (AC1)
  // ===========================================================================
  describe('ollamaConfigSchema with fileTypes', () => {
    it('should include fileTypes with defaults', () => {
      const config = ollamaConfigSchema.parse({});
      expect(config.fileTypes).toBeDefined();
      expect(config.fileTypes.preset).toBe('documents');
    });

    it('should accept custom file types configuration', () => {
      const config = ollamaConfigSchema.parse({
        enabled: true,
        fileTypes: {
          preset: 'images',
          excludedExtensions: ['gif'],
        },
      });
      expect(config.fileTypes.preset).toBe('images');
      expect(config.fileTypes.excludedExtensions).toEqual(['gif']);
    });

    it('should preserve other config with file types', () => {
      const config = ollamaConfigSchema.parse({
        enabled: true,
        baseUrl: 'http://192.168.1.100:11434',
        timeout: 60000,
        models: { inference: 'mistral' },
        fileTypes: { preset: 'all' },
      });
      expect(config.enabled).toBe(true);
      expect(config.baseUrl).toBe('http://192.168.1.100:11434');
      expect(config.timeout).toBe(60000);
      expect(config.models.inference).toBe('mistral');
      expect(config.fileTypes.preset).toBe('all');
    });
  });

  describe('DEFAULT_OLLAMA_CONFIG with fileTypes', () => {
    it('should include fileTypes in defaults', () => {
      expect(DEFAULT_OLLAMA_CONFIG.fileTypes).toBeDefined();
      expect(DEFAULT_OLLAMA_CONFIG.fileTypes).toEqual(DEFAULT_LLM_FILE_TYPES);
    });

    it('should be valid according to updated schema', () => {
      const parsed = ollamaConfigSchema.parse(DEFAULT_OLLAMA_CONFIG);
      expect(parsed.fileTypes).toEqual(DEFAULT_LLM_FILE_TYPES);
    });
  });

  // ===========================================================================
  // Backward Compatibility Tests
  // ===========================================================================
  describe('backward compatibility', () => {
    it('should handle config without fileTypes (pre-10.4)', () => {
      const oldConfig = {
        enabled: true,
        baseUrl: 'http://localhost:11434',
        timeout: 30000,
        models: { inference: 'mistral' },
        // No fileTypes field
      };
      const parsed = ollamaConfigSchema.parse(oldConfig);
      expect(parsed.fileTypes).toBeDefined();
      expect(parsed.fileTypes.preset).toBe('documents');
    });

    it('should handle partial fileTypes config', () => {
      const config = {
        fileTypes: { preset: 'images' },
        // Other fileTypes fields default
      };
      const parsed = ollamaConfigSchema.parse(config);
      expect(parsed.fileTypes.preset).toBe('images');
      expect(parsed.fileTypes.includedExtensions).toEqual([]);
      expect(parsed.fileTypes.excludedExtensions).toEqual([]);
      expect(parsed.fileTypes.skipWithMetadata).toBe(true);
    });
  });
});

// =============================================================================
// Story 10.5: Vision Model Support Tests
// =============================================================================
describe('Vision Model Configuration - Story 10.5', () => {
  // ===========================================================================
  // Task 1.1: Vision Model in ollamaModelsConfigSchema
  // ===========================================================================
  describe('ollamaModelsConfigSchema with vision', () => {
    it('should accept vision model configuration', () => {
      const models = {
        inference: 'mistral:latest',
        embedding: 'all-minilm',
        vision: 'llava',
      };
      const parsed = ollamaConfigSchema.parse({ models }).models;
      expect(parsed.vision).toBe('llava');
    });

    it('should allow vision model without inference/embedding', () => {
      const models = { vision: 'gemma3' };
      const parsed = ollamaConfigSchema.parse({ models }).models;
      expect(parsed.vision).toBe('gemma3');
      expect(parsed.inference).toBeUndefined();
      expect(parsed.embedding).toBeUndefined();
    });

    it('should allow empty models (vision optional)', () => {
      const parsed = ollamaConfigSchema.parse({}).models;
      expect(parsed.vision).toBeUndefined();
    });
  });

  // ===========================================================================
  // Task 1.2: visionEnabled flag
  // ===========================================================================
  describe('visionEnabled configuration', () => {
    it('should default visionEnabled to false', () => {
      const config = ollamaConfigSchema.parse({});
      expect(config.visionEnabled).toBe(false);
    });

    it('should accept visionEnabled: true', () => {
      const config = ollamaConfigSchema.parse({ visionEnabled: true });
      expect(config.visionEnabled).toBe(true);
    });

    it('should reject non-boolean visionEnabled', () => {
      expect(() => ollamaConfigSchema.parse({ visionEnabled: 'yes' })).toThrow();
    });
  });

  // ===========================================================================
  // Task 1.3: skipImagesWithExif configuration
  // ===========================================================================
  describe('skipImagesWithExif configuration', () => {
    it('should default skipImagesWithExif to true', () => {
      const config = ollamaConfigSchema.parse({});
      expect(config.skipImagesWithExif).toBe(true);
    });

    it('should accept skipImagesWithExif: false', () => {
      const config = ollamaConfigSchema.parse({ skipImagesWithExif: false });
      expect(config.skipImagesWithExif).toBe(false);
    });

    it('should reject non-boolean skipImagesWithExif', () => {
      expect(() => ollamaConfigSchema.parse({ skipImagesWithExif: 'no' })).toThrow();
    });
  });

  // ===========================================================================
  // Task 1.4/1.5: maxImageSize configuration
  // ===========================================================================
  describe('maxImageSize configuration', () => {
    it('should default maxImageSize to 20MB', () => {
      const config = ollamaConfigSchema.parse({});
      expect(config.maxImageSize).toBe(20 * 1024 * 1024);
    });

    it('should accept custom maxImageSize', () => {
      const config = ollamaConfigSchema.parse({ maxImageSize: 10 * 1024 * 1024 });
      expect(config.maxImageSize).toBe(10 * 1024 * 1024);
    });

    it('should reject zero maxImageSize', () => {
      expect(() => ollamaConfigSchema.parse({ maxImageSize: 0 })).toThrow();
    });

    it('should reject negative maxImageSize', () => {
      expect(() => ollamaConfigSchema.parse({ maxImageSize: -1 })).toThrow();
    });
  });

  // ===========================================================================
  // Complete Vision Configuration Tests
  // ===========================================================================
  describe('complete vision configuration', () => {
    it('should accept full vision configuration', () => {
      const config = ollamaConfigSchema.parse({
        enabled: true,
        baseUrl: 'http://localhost:11434',
        timeout: 60000,
        models: {
          inference: 'mistral',
          vision: 'llava',
        },
        visionEnabled: true,
        skipImagesWithExif: false,
        maxImageSize: 15 * 1024 * 1024,
      });
      expect(config.visionEnabled).toBe(true);
      expect(config.skipImagesWithExif).toBe(false);
      expect(config.maxImageSize).toBe(15 * 1024 * 1024);
      expect(config.models.vision).toBe('llava');
    });

    it('should include vision fields in DEFAULT_OLLAMA_CONFIG', () => {
      expect(DEFAULT_OLLAMA_CONFIG.visionEnabled).toBe(false);
      expect(DEFAULT_OLLAMA_CONFIG.skipImagesWithExif).toBe(true);
      expect(DEFAULT_OLLAMA_CONFIG.maxImageSize).toBe(20 * 1024 * 1024);
    });
  });

  // ===========================================================================
  // Backward Compatibility Tests for Vision
  // ===========================================================================
  describe('backward compatibility with vision fields', () => {
    it('should handle config without vision fields (pre-10.5)', () => {
      const oldConfig = {
        enabled: true,
        baseUrl: 'http://localhost:11434',
        timeout: 30000,
        models: { inference: 'mistral' },
        fileTypes: { preset: 'documents' },
        // No vision fields
      };
      const parsed = ollamaConfigSchema.parse(oldConfig);
      expect(parsed.visionEnabled).toBe(false);
      expect(parsed.skipImagesWithExif).toBe(true);
      expect(parsed.maxImageSize).toBe(20 * 1024 * 1024);
    });

    it('should preserve existing fields when adding vision config', () => {
      const config = ollamaConfigSchema.parse({
        enabled: true,
        baseUrl: 'http://192.168.1.100:11434',
        timeout: 45000,
        models: { inference: 'llama3', vision: 'llava' },
        fileTypes: { preset: 'all' },
        visionEnabled: true,
      });
      expect(config.enabled).toBe(true);
      expect(config.baseUrl).toBe('http://192.168.1.100:11434');
      expect(config.timeout).toBe(45000);
      expect(config.fileTypes.preset).toBe('all');
      expect(config.visionEnabled).toBe(true);
      expect(config.models.vision).toBe('llava');
    });
  });
});
