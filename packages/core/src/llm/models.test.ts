/**
 * @fileoverview Tests for Ollama model discovery - Story 10.1
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  listOllamaModels,
  listFormattedModels,
  getModelCount,
  isModelInstalled,
  findModel,
  getModelNames,
  getModelsByFamily,
  getModelsSummary,
} from './models.js';

describe('Ollama Model Discovery - Story 10.1', () => {
  let mockFetch: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockFetch = vi.spyOn(global, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Test data
  const mockModels = [
    {
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
    },
    {
      name: 'llama3:8b',
      model: 'llama3:8b',
      modified_at: '2024-01-16T10:30:00Z',
      size: 8000000000,
      digest: 'sha256:def456',
      details: {
        family: 'llama',
        parameter_size: '8B',
        quantization_level: 'Q4_K_M',
      },
    },
    {
      name: 'llama3:70b',
      model: 'llama3:70b',
      modified_at: '2024-01-16T10:30:00Z',
      size: 40000000000,
      digest: 'sha256:ghi789',
      details: {
        family: 'llama',
        parameter_size: '70B',
        quantization_level: 'Q4_0',
      },
    },
  ];

  const mockOllamaSuccess = (models = mockModels) => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ models }),
    } as Response);
  };

  const mockOllamaFailure = () => {
    mockFetch.mockRejectedValue(new TypeError('fetch failed'));
  };

  // ===========================================================================
  // listOllamaModels Tests (AC3)
  // ===========================================================================
  describe('listOllamaModels (AC3)', () => {
    it('should return installed models', async () => {
      mockOllamaSuccess();

      const result = await listOllamaModels();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toHaveLength(3);
        expect(result.data[0].name).toBe('mistral:latest');
        expect(result.data[0].details?.family).toBe('mistral');
      }
    });

    it('should return empty array when no models', async () => {
      mockOllamaSuccess([]);

      const result = await listOllamaModels();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual([]);
      }
    });

    it('should return error when Ollama unreachable', async () => {
      mockOllamaFailure();

      const result = await listOllamaModels();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('CONNECTION_FAILED');
      }
    });

    it('should include model size (AC3)', async () => {
      mockOllamaSuccess();

      const result = await listOllamaModels();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data[0].size).toBe(4109865472);
      }
    });

    it('should include model family (AC3)', async () => {
      mockOllamaSuccess();

      const result = await listOllamaModels();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data[0].details?.family).toBe('mistral');
      }
    });
  });

  // ===========================================================================
  // listFormattedModels Tests
  // ===========================================================================
  describe('listFormattedModels', () => {
    it('should return formatted model info', async () => {
      mockOllamaSuccess();

      const result = await listFormattedModels();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toHaveLength(3);
        expect(result.data[0].name).toBe('mistral:latest');
        expect(result.data[0].family).toBe('mistral');
        expect(result.data[0].parameterSize).toBe('7B');
        expect(result.data[0].sizeFormatted).toBe('3.8 GB');
      }
    });

    it('should handle models without details', async () => {
      mockOllamaSuccess([{
        name: 'custom:v1',
        model: 'custom:v1',
        modified_at: '2024-01-15T10:30:00Z',
        size: 1000000000,
        digest: 'sha256:xyz',
      }]);

      const result = await listFormattedModels();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data[0].family).toBe('unknown');
        expect(result.data[0].parameterSize).toBe('unknown');
      }
    });
  });

  // ===========================================================================
  // getModelCount Tests
  // ===========================================================================
  describe('getModelCount', () => {
    it('should return model count', async () => {
      mockOllamaSuccess();

      const result = await getModelCount();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toBe(3);
      }
    });

    it('should return 0 when no models', async () => {
      mockOllamaSuccess([]);

      const result = await getModelCount();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toBe(0);
      }
    });
  });

  // ===========================================================================
  // isModelInstalled Tests
  // ===========================================================================
  describe('isModelInstalled', () => {
    it('should return true for installed model', async () => {
      mockOllamaSuccess();

      const result = await isModelInstalled('mistral:latest');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toBe(true);
      }
    });

    it('should return false for uninstalled model', async () => {
      mockOllamaSuccess();

      const result = await isModelInstalled('gpt-4:latest');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toBe(false);
      }
    });

    it('should be case-insensitive', async () => {
      mockOllamaSuccess();

      const result = await isModelInstalled('MISTRAL:LATEST');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toBe(true);
      }
    });
  });

  // ===========================================================================
  // findModel Tests
  // ===========================================================================
  describe('findModel', () => {
    it('should find model by name', async () => {
      mockOllamaSuccess();

      const result = await findModel('mistral:latest');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).not.toBeNull();
        expect(result.data?.name).toBe('mistral:latest');
        expect(result.data?.size).toBe(4109865472);
      }
    });

    it('should return null for unknown model', async () => {
      mockOllamaSuccess();

      const result = await findModel('unknown:model');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toBeNull();
      }
    });

    it('should be case-insensitive', async () => {
      mockOllamaSuccess();

      const result = await findModel('LLAMA3:8B');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data?.name).toBe('llama3:8b');
      }
    });
  });

  // ===========================================================================
  // getModelNames Tests
  // ===========================================================================
  describe('getModelNames', () => {
    it('should return array of model names', async () => {
      mockOllamaSuccess();

      const result = await getModelNames();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual(['mistral:latest', 'llama3:8b', 'llama3:70b']);
      }
    });

    it('should return empty array when no models', async () => {
      mockOllamaSuccess([]);

      const result = await getModelNames();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual([]);
      }
    });
  });

  // ===========================================================================
  // getModelsByFamily Tests
  // ===========================================================================
  describe('getModelsByFamily', () => {
    it('should group models by family', async () => {
      mockOllamaSuccess();

      const result = await getModelsByFamily();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.get('mistral')).toHaveLength(1);
        expect(result.data.get('llama')).toHaveLength(2);
      }
    });

    it('should use "unknown" for models without family', async () => {
      mockOllamaSuccess([{
        name: 'custom:v1',
        model: 'custom:v1',
        modified_at: '2024-01-15T10:30:00Z',
        size: 1000000000,
        digest: 'sha256:xyz',
      }]);

      const result = await getModelsByFamily();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.get('unknown')).toHaveLength(1);
      }
    });
  });

  // ===========================================================================
  // getModelsSummary Tests
  // ===========================================================================
  describe('getModelsSummary', () => {
    it('should return complete summary', async () => {
      mockOllamaSuccess();

      const result = await getModelsSummary();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.total).toBe(3);
        expect(result.data.totalSizeBytes).toBe(4109865472 + 8000000000 + 40000000000);
        expect(result.data.byFamily).toEqual({ mistral: 1, llama: 2 });
        expect(result.data.totalSizeFormatted).toContain('GB');
      }
    });

    it('should handle empty models', async () => {
      mockOllamaSuccess([]);

      const result = await getModelsSummary();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.total).toBe(0);
        expect(result.data.totalSizeBytes).toBe(0);
        expect(result.data.byFamily).toEqual({});
      }
    });
  });

  // ===========================================================================
  // Result Pattern Compliance (AC4: Graceful Degradation)
  // ===========================================================================
  describe('graceful degradation (AC4)', () => {
    it('listOllamaModels should never throw', async () => {
      mockFetch.mockRejectedValue(new Error('Catastrophic'));

      const result = await listOllamaModels();

      expect(result).toBeDefined();
      expect(result.ok).toBe(false);
    });

    it('findModel should never throw', async () => {
      mockFetch.mockRejectedValue(new Error('Catastrophic'));

      const result = await findModel('test');

      expect(result).toBeDefined();
      expect(result.ok).toBe(false);
    });

    it('getModelsSummary should never throw', async () => {
      mockFetch.mockRejectedValue(new Error('Catastrophic'));

      const result = await getModelsSummary();

      expect(result).toBeDefined();
      expect(result.ok).toBe(false);
    });
  });
});
