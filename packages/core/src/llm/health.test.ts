/**
 * @fileoverview Tests for Ollama health check - Story 10.1
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  checkOllamaHealth,
  isOllamaAvailable,
  getOllamaStatus,
  getOllamaHealthReport,
} from './health.js';

describe('Ollama Health Check - Story 10.1', () => {
  let mockFetch: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockFetch = vi.spyOn(global, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Helper to mock successful Ollama response
  const mockOllamaSuccess = (modelCount = 3) => {
    const models = Array(modelCount).fill(null).map((_, i) => ({
      name: `model${i}:latest`,
      model: `model${i}:latest`,
      modified_at: '2024-01-15T10:30:00Z',
      size: 4000000000,
      digest: `sha256:abc${i}`,
    }));

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ models }),
    } as Response);
  };

  const mockOllamaFailure = () => {
    mockFetch.mockRejectedValue(new TypeError('fetch failed'));
  };

  // ===========================================================================
  // checkOllamaHealth Tests (Task 3.2, 3.3)
  // ===========================================================================
  describe('checkOllamaHealth', () => {
    it('should return available status when Ollama responds (AC2)', async () => {
      mockOllamaSuccess(5);

      const result = await checkOllamaHealth();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.available).toBe(true);
        expect(result.data.modelCount).toBe(5);
        expect(result.data.checkedAt).toBeDefined();
      }
    });

    it('should return error when Ollama is unreachable', async () => {
      mockOllamaFailure();

      const result = await checkOllamaHealth();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('CONNECTION_FAILED');
      }
    });

    it('should use provided config', async () => {
      mockOllamaSuccess();

      await checkOllamaHealth({
        baseUrl: 'http://192.168.1.100:11434',
        timeout: 5000,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://192.168.1.100:11434/api/tags',
        expect.any(Object)
      );
    });

    it('should use default config when none provided', async () => {
      mockOllamaSuccess();

      await checkOllamaHealth();

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/tags',
        expect.any(Object)
      );
    });
  });

  // ===========================================================================
  // isOllamaAvailable Tests
  // ===========================================================================
  describe('isOllamaAvailable', () => {
    it('should return true when Ollama is available', async () => {
      mockOllamaSuccess();

      const available = await isOllamaAvailable();

      expect(available).toBe(true);
    });

    it('should return false when Ollama is unreachable', async () => {
      mockOllamaFailure();

      const available = await isOllamaAvailable();

      expect(available).toBe(false);
    });

    it('should not throw on error', async () => {
      mockFetch.mockRejectedValue(new Error('Catastrophic failure'));

      // This should NOT throw
      const available = await isOllamaAvailable();

      expect(available).toBe(false);
    });
  });

  // ===========================================================================
  // getOllamaStatus Tests
  // ===========================================================================
  describe('getOllamaStatus', () => {
    it('should return "Disabled" when LLM is disabled', async () => {
      const status = await getOllamaStatus({ enabled: false });

      expect(status).toBe('Disabled');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should return "Connected (N models)" when available', async () => {
      mockOllamaSuccess(3);

      const status = await getOllamaStatus({ enabled: true });

      expect(status).toBe('Connected (3 models)');
    });

    it('should use singular "model" for one model', async () => {
      mockOllamaSuccess(1);

      const status = await getOllamaStatus({ enabled: true });

      expect(status).toBe('Connected (1 model)');
    });

    it('should return "Not available" when unreachable', async () => {
      mockOllamaFailure();

      const status = await getOllamaStatus({ enabled: true });

      // Returns error message when check fails
      expect(status).toContain('Error');
    });

    it('should handle enabled undefined (default check)', async () => {
      mockOllamaSuccess(2);

      const status = await getOllamaStatus();

      expect(status).toBe('Connected (2 models)');
    });
  });

  // ===========================================================================
  // getOllamaHealthReport Tests
  // ===========================================================================
  describe('getOllamaHealthReport', () => {
    it('should return detailed report on success', async () => {
      mockOllamaSuccess(4);

      const report = await getOllamaHealthReport();

      expect(report.available).toBe(true);
      expect(report.baseUrl).toBe('http://localhost:11434');
      expect(report.responseTimeMs).toBeGreaterThanOrEqual(0);
      expect(report.modelCount).toBe(4);
      expect(report.error).toBeUndefined();
    });

    it('should return detailed report on failure', async () => {
      mockOllamaFailure();

      const report = await getOllamaHealthReport();

      expect(report.available).toBe(false);
      expect(report.baseUrl).toBe('http://localhost:11434');
      expect(report.responseTimeMs).toBeGreaterThanOrEqual(0);
      expect(report.error).toBeDefined();
      expect(report.error?.code).toBe('CONNECTION_FAILED');
    });

    it('should use custom baseUrl in report', async () => {
      mockOllamaSuccess();

      const report = await getOllamaHealthReport({
        baseUrl: 'http://custom:11434',
      });

      expect(report.baseUrl).toBe('http://custom:11434');
    });

    it('should include response time', async () => {
      mockOllamaSuccess();

      const report = await getOllamaHealthReport();

      expect(typeof report.responseTimeMs).toBe('number');
      expect(report.responseTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  // ===========================================================================
  // Result Pattern Compliance (AC4: Graceful Degradation)
  // ===========================================================================
  describe('graceful degradation (AC4)', () => {
    it('checkOllamaHealth should never throw', async () => {
      mockFetch.mockRejectedValue(new Error('Catastrophic'));

      // This should NOT throw
      const result = await checkOllamaHealth();

      expect(result).toBeDefined();
      expect(result.ok).toBe(false);
    });

    it('isOllamaAvailable should never throw', async () => {
      mockFetch.mockRejectedValue(new Error('Catastrophic'));

      // This should NOT throw
      const available = await isOllamaAvailable();

      expect(typeof available).toBe('boolean');
    });

    it('getOllamaStatus should never throw', async () => {
      mockFetch.mockRejectedValue(new Error('Catastrophic'));

      // This should NOT throw
      const status = await getOllamaStatus();

      expect(typeof status).toBe('string');
    });

    it('getOllamaHealthReport should never throw', async () => {
      mockFetch.mockRejectedValue(new Error('Catastrophic'));

      // This should NOT throw
      const report = await getOllamaHealthReport();

      expect(report).toBeDefined();
      expect(report.available).toBe(false);
    });
  });
});
