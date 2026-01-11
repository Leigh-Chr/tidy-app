/**
 * @fileoverview Tests for Ollama Generate API - Story 10.2
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateCompletion, generate } from './generate.js';
import type { OllamaConfig } from './types.js';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('Generate', () => {
  const defaultConfig: OllamaConfig = {
    enabled: true,
    baseUrl: 'http://localhost:11434',
    timeout: 30000,
    models: { inference: 'mistral' },
  };

  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('generateCompletion', () => {
    it('generates text successfully', async () => {
      const mockResponse = {
        model: 'mistral',
        created_at: '2024-01-15T10:30:00Z',
        response: 'This is the generated response',
        done: true,
        total_duration: 1500000000,
        prompt_eval_count: 50,
        eval_count: 30,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await generateCompletion(defaultConfig, {
        model: 'mistral',
        prompt: 'Hello world',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.response).toBe('This is the generated response');
        expect(result.data.model).toBe('mistral');
        expect(result.data.promptTokens).toBe(50);
        expect(result.data.responseTokens).toBe(30);
      }
    });

    it('sends correct request body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          model: 'mistral',
          created_at: new Date().toISOString(),
          response: 'test',
          done: true,
        }),
      });

      await generateCompletion(defaultConfig, {
        model: 'llama3',
        prompt: 'Test prompt',
        temperature: 0.5,
        maxTokens: 100,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/generate',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.model).toBe('llama3');
      expect(callBody.prompt).toBe('Test prompt');
      expect(callBody.stream).toBe(false);
      expect(callBody.options.temperature).toBe(0.5);
      expect(callBody.options.num_predict).toBe(100);
    });

    it('includes system prompt when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          model: 'mistral',
          created_at: new Date().toISOString(),
          response: 'test',
          done: true,
        }),
      });

      await generateCompletion(defaultConfig, {
        model: 'mistral',
        prompt: 'User prompt',
        system: 'You are a helpful assistant',
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.system).toBe('You are a helpful assistant');
    });

    it('returns MODEL_NOT_FOUND error for 404 response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      const result = await generateCompletion(defaultConfig, {
        model: 'nonexistent-model',
        prompt: 'test',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('MODEL_NOT_FOUND');
        expect(result.error.message).toContain('nonexistent-model');
      }
    });

    it('returns CONNECTION_FAILED error for other HTTP errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const result = await generateCompletion(defaultConfig, {
        model: 'mistral',
        prompt: 'test',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('CONNECTION_FAILED');
        expect(result.error.message).toContain('500');
      }
    });

    it('returns INVALID_RESPONSE for malformed response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ invalid: 'response' }),
      });

      const result = await generateCompletion(defaultConfig, {
        model: 'mistral',
        prompt: 'test',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('INVALID_RESPONSE');
      }
    });

    it('returns TIMEOUT error when request times out', async () => {
      const abortError = new DOMException('Aborted', 'AbortError');
      mockFetch.mockRejectedValueOnce(abortError);

      const result = await generateCompletion(
        { ...defaultConfig, timeout: 1000 },
        { model: 'mistral', prompt: 'test' }
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('TIMEOUT');
        expect(result.error.message).toContain('1000ms');
      }
    });

    it('returns CONNECTION_FAILED for network errors', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('fetch failed'));

      const result = await generateCompletion(defaultConfig, {
        model: 'mistral',
        prompt: 'test',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('CONNECTION_FAILED');
        expect(result.error.message).toContain('connect');
      }
    });

    it('uses default temperature when not provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          model: 'mistral',
          created_at: new Date().toISOString(),
          response: 'test',
          done: true,
        }),
      });

      await generateCompletion(defaultConfig, {
        model: 'mistral',
        prompt: 'test',
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.options.temperature).toBe(0.7);
    });

    it('uses default maxTokens when not provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          model: 'mistral',
          created_at: new Date().toISOString(),
          response: 'test',
          done: true,
        }),
      });

      await generateCompletion(defaultConfig, {
        model: 'mistral',
        prompt: 'test',
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.options.num_predict).toBe(256);
    });

    it('handles missing optional response fields', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          model: 'mistral',
          created_at: new Date().toISOString(),
          response: 'Generated text',
          done: true,
          // No duration or token counts
        }),
      });

      const result = await generateCompletion(defaultConfig, {
        model: 'mistral',
        prompt: 'test',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.response).toBe('Generated text');
        expect(result.data.totalDuration).toBe(0);
        expect(result.data.promptTokens).toBe(0);
        expect(result.data.responseTokens).toBe(0);
      }
    });
  });

  describe('generate', () => {
    it('uses configured inference model', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          model: 'mistral',
          created_at: new Date().toISOString(),
          response: 'Generated text',
          done: true,
        }),
      });

      const result = await generate(defaultConfig, 'Test prompt');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toBe('Generated text');
      }

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.model).toBe('mistral');
    });

    it('returns error when no inference model configured', async () => {
      const configNoModel: OllamaConfig = {
        ...defaultConfig,
        models: {},
      };

      const result = await generate(configNoModel, 'Test prompt');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('MODEL_NOT_FOUND');
        expect(result.error.message).toContain('inference');
      }
    });

    it('passes through custom options', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          model: 'mistral',
          created_at: new Date().toISOString(),
          response: 'test',
          done: true,
        }),
      });

      await generate(defaultConfig, 'Test prompt', {
        temperature: 0.2,
        maxTokens: 50,
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.options.temperature).toBe(0.2);
      expect(callBody.options.num_predict).toBe(50);
    });

    it('propagates errors from generateCompletion', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('fetch failed'));

      const result = await generate(defaultConfig, 'Test prompt');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('CONNECTION_FAILED');
      }
    });
  });
});
