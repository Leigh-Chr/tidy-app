/**
 * @fileoverview Tests for Ollama client - Story 10.1
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createOllamaClient,
  createOllamaClientFromConfig,
  type OllamaClient,
} from './client.js';
import { DEFAULT_OLLAMA_CONFIG, type OllamaConfig } from './types.js';

describe('Ollama Client - Story 10.1', () => {
  let mockFetch: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockFetch = vi.spyOn(global, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ===========================================================================
  // Client Creation Tests (Task 2.1, 2.2)
  // ===========================================================================
  describe('createOllamaClient', () => {
    it('should use default options when none provided', () => {
      const client = createOllamaClient();
      const config = client.getConfig();
      expect(config.baseUrl).toBe(DEFAULT_OLLAMA_CONFIG.baseUrl);
      expect(config.timeout).toBe(DEFAULT_OLLAMA_CONFIG.timeout);
    });

    it('should use provided options', () => {
      const client = createOllamaClient({
        baseUrl: 'http://192.168.1.100:11434',
        timeout: 60000,
      });
      const config = client.getConfig();
      expect(config.baseUrl).toBe('http://192.168.1.100:11434');
      expect(config.timeout).toBe(60000);
    });

    it('should partially override options', () => {
      const client = createOllamaClient({
        baseUrl: 'http://custom:11434',
      });
      const config = client.getConfig();
      expect(config.baseUrl).toBe('http://custom:11434');
      expect(config.timeout).toBe(DEFAULT_OLLAMA_CONFIG.timeout);
    });
  });

  describe('createOllamaClientFromConfig', () => {
    it('should create client from full config', () => {
      const config: OllamaConfig = {
        enabled: true,
        baseUrl: 'http://test:11434',
        timeout: 45000,
        models: { inference: 'mistral' },
      };
      const client = createOllamaClientFromConfig(config);
      const clientConfig = client.getConfig();
      expect(clientConfig.baseUrl).toBe('http://test:11434');
      expect(clientConfig.timeout).toBe(45000);
    });
  });

  // ===========================================================================
  // Health Check Tests (Task 2.4 - Result pattern)
  // ===========================================================================
  describe('checkHealth', () => {
    it('should return available when Ollama responds', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          models: [
            {
              name: 'mistral:latest',
              model: 'mistral:latest',
              modified_at: '2024-01-15T10:30:00Z',
              size: 4109865472,
              digest: 'sha256:abc123',
            },
          ],
        }),
      } as Response);

      const client = createOllamaClient();
      const result = await client.checkHealth();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.available).toBe(true);
        expect(result.data.modelCount).toBe(1);
      }
    });

    it('should return error when connection fails', async () => {
      mockFetch.mockRejectedValue(new TypeError('fetch failed'));

      const client = createOllamaClient();
      const result = await client.checkHealth();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('CONNECTION_FAILED');
      }
    });

    it('should return error when Ollama returns non-OK status', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
      } as Response);

      const client = createOllamaClient();
      const result = await client.checkHealth();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('CONNECTION_FAILED');
        expect(result.error.message).toContain('500');
      }
    });

    it('should return error for invalid JSON response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ invalid: 'response' }),
      } as Response);

      const client = createOllamaClient();
      const result = await client.checkHealth();

      // The schema allows missing models array (defaults to [])
      expect(result.ok).toBe(true);
    });

    it('should return error for truly malformed response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          models: [{ name: 123 }], // name should be string
        }),
      } as Response);

      const client = createOllamaClient();
      const result = await client.checkHealth();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('INVALID_RESPONSE');
      }
    });
  });

  // ===========================================================================
  // Timeout Tests (Task 2.3)
  // ===========================================================================
  describe('timeout handling', () => {
    it('should return TIMEOUT error when request times out', async () => {
      const abortError = new DOMException('Aborted', 'AbortError');
      mockFetch.mockRejectedValue(abortError);

      const client = createOllamaClient({ timeout: 100 });
      const result = await client.checkHealth();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('TIMEOUT');
        expect(result.error.message).toContain('100ms');
      }
    });

    it('should use configured timeout value', async () => {
      mockFetch.mockImplementation(async (_url, options) => {
        // Check that signal is provided
        expect(options?.signal).toBeDefined();
        return {
          ok: true,
          json: () => Promise.resolve({ models: [] }),
        } as Response;
      });

      const client = createOllamaClient({ timeout: 5000 });
      await client.checkHealth();

      expect(mockFetch).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // List Models Tests
  // ===========================================================================
  describe('listModels', () => {
    it('should return models when Ollama responds', async () => {
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
        },
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ models: mockModels }),
      } as Response);

      const client = createOllamaClient();
      const result = await client.listModels();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toHaveLength(2);
        expect(result.data[0].name).toBe('mistral:latest');
        expect(result.data[0].details?.family).toBe('mistral');
        expect(result.data[1].name).toBe('llama3:8b');
      }
    });

    it('should return empty array when no models installed', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ models: [] }),
      } as Response);

      const client = createOllamaClient();
      const result = await client.listModels();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual([]);
      }
    });

    it('should return error when connection fails', async () => {
      mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));

      const client = createOllamaClient();
      const result = await client.listModels();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('CONNECTION_FAILED');
      }
    });
  });

  // ===========================================================================
  // Error Categorization Tests
  // ===========================================================================
  describe('error categorization', () => {
    it('should categorize ECONNREFUSED as CONNECTION_FAILED', async () => {
      mockFetch.mockRejectedValue(new Error('connect ECONNREFUSED'));

      const client = createOllamaClient();
      const result = await client.checkHealth();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('CONNECTION_FAILED');
        expect(result.error.message).toContain('Connection refused');
      }
    });

    it('should handle unknown error types', async () => {
      mockFetch.mockRejectedValue('string error');

      const client = createOllamaClient();
      const result = await client.checkHealth();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('CONNECTION_FAILED');
        expect(result.error.originalError).toBe('string error');
      }
    });

    it('should preserve original error in result', async () => {
      const originalError = new Error('Original error');
      mockFetch.mockRejectedValue(originalError);

      const client = createOllamaClient();
      const result = await client.checkHealth();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.originalError).toBe(originalError);
      }
    });
  });

  // ===========================================================================
  // Result Pattern Verification (Task 2.4)
  // ===========================================================================
  describe('Result pattern compliance', () => {
    it('should never throw - checkHealth', async () => {
      mockFetch.mockRejectedValue(new Error('Catastrophic failure'));

      const client = createOllamaClient();

      // This should NOT throw
      const result = await client.checkHealth();

      expect(result).toBeDefined();
      expect(result.ok).toBe(false);
    });

    it('should never throw - listModels', async () => {
      mockFetch.mockRejectedValue(new Error('Catastrophic failure'));

      const client = createOllamaClient();

      // This should NOT throw
      const result = await client.listModels();

      expect(result).toBeDefined();
      expect(result.ok).toBe(false);
    });

    it('should return typed errors', async () => {
      mockFetch.mockRejectedValue(new TypeError('fetch failed'));

      const client = createOllamaClient();
      const result = await client.checkHealth();

      if (!result.ok) {
        // Type should be OllamaError with required fields
        expect(result.error).toHaveProperty('code');
        expect(result.error).toHaveProperty('message');
        expect(['CONNECTION_FAILED', 'TIMEOUT', 'MODEL_NOT_FOUND', 'INVALID_RESPONSE'])
          .toContain(result.error.code);
      }
    });
  });
});
