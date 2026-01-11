/**
 * @fileoverview Tests for offline operation support - Story 10.6
 *
 * Tests for:
 * - Pre-operation availability check
 * - Operation decision logic
 * - Offline fallback result creation
 * - Batch offline summary generation
 * - Connection error detection
 *
 * @module llm/offline.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  checkLlmAvailabilityForOperation,
  shouldProceedWithOperation,
  createOfflineFallbackResult,
  createBatchOfflineSummary,
  isConnectionError,
  formatOfflineStatus,
  OFFLINE_MESSAGES,
  type LlmAvailabilityStatus,
  type OfflineFallbackResult,
  type BatchOfflineSummary,
} from './offline.js';
import { type OllamaConfig, DEFAULT_OLLAMA_CONFIG, createOllamaError } from './types.js';
import * as healthModule from './health.js';

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Create a test config with specified overrides.
 */
function createTestConfig(overrides: Partial<OllamaConfig> = {}): OllamaConfig {
  return {
    ...DEFAULT_OLLAMA_CONFIG,
    enabled: true,
    models: { inference: 'mistral' },
    ...overrides,
  };
}

/**
 * Create an extended config with offline fields.
 */
function createExtendedConfig(
  overrides: Partial<OllamaConfig & { offlineMode?: string; healthCheckTimeout?: number }> = {}
): OllamaConfig & { offlineMode?: string; healthCheckTimeout?: number } {
  return {
    ...createTestConfig(),
    offlineMode: 'auto',
    healthCheckTimeout: 5000,
    ...overrides,
  };
}

// =============================================================================
// checkLlmAvailabilityForOperation Tests
// =============================================================================

describe('checkLlmAvailabilityForOperation', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return unavailable when LLM is disabled', async () => {
    const config = createTestConfig({ enabled: false });

    const status = await checkLlmAvailabilityForOperation(config);

    expect(status.available).toBe(false);
    expect(status.reason).toContain('disabled');
    expect(status.suggestion).toContain('tidy config set llm.enabled true');
  });

  it('should return unavailable when offline mode is enabled', async () => {
    const config = createExtendedConfig({ offlineMode: 'enabled' });

    const status = await checkLlmAvailabilityForOperation(config);

    expect(status.available).toBe(false);
    expect(status.reason).toContain('Offline mode');
    expect(status.suggestion).toContain('offlineMode auto');
  });

  it('should return unavailable when no inference model configured', async () => {
    const config = createTestConfig({ models: {} });

    const status = await checkLlmAvailabilityForOperation(config);

    expect(status.available).toBe(false);
    expect(status.reason).toContain('No inference model');
    expect(status.suggestion).toContain('models.inference');
  });

  it('should return unavailable when models is undefined', async () => {
    const config = createTestConfig({ models: undefined });

    const status = await checkLlmAvailabilityForOperation(config);

    expect(status.available).toBe(false);
    expect(status.reason).toContain('No inference model');
  });

  it('should return unavailable when health check fails with connection error', async () => {
    const config = createTestConfig();
    vi.spyOn(healthModule, 'checkOllamaHealth').mockResolvedValue({
      ok: false,
      error: createOllamaError('CONNECTION_FAILED', 'Connection refused'),
    });

    const status = await checkLlmAvailabilityForOperation(config);

    expect(status.available).toBe(false);
    expect(status.reason).toContain('Cannot connect');
    expect(status.suggestion).toContain('ollama serve');
    expect(status.responseTimeMs).toBeDefined();
  });

  it('should return unavailable when health check fails with timeout', async () => {
    const config = createTestConfig();
    vi.spyOn(healthModule, 'checkOllamaHealth').mockResolvedValue({
      ok: false,
      error: createOllamaError('TIMEOUT', 'Request timed out'),
    });

    const status = await checkLlmAvailabilityForOperation(config);

    expect(status.available).toBe(false);
    expect(status.reason).toContain('not responding');
    expect(status.suggestion).toContain('ollama -v');
  });

  it('should return unavailable when Ollama is not responding', async () => {
    const config = createTestConfig();
    vi.spyOn(healthModule, 'checkOllamaHealth').mockResolvedValue({
      ok: true,
      data: {
        available: false,
        checkedAt: new Date().toISOString(),
      },
    });

    const status = await checkLlmAvailabilityForOperation(config);

    expect(status.available).toBe(false);
    expect(status.reason).toContain('not responding');
  });

  it('should return available when health check succeeds', async () => {
    const config = createTestConfig();
    vi.spyOn(healthModule, 'checkOllamaHealth').mockResolvedValue({
      ok: true,
      data: {
        available: true,
        modelCount: 3,
        checkedAt: new Date().toISOString(),
      },
    });

    const status = await checkLlmAvailabilityForOperation(config);

    expect(status.available).toBe(true);
    expect(status.reason).toContain('3 models');
    expect(status.suggestion).toBe('');
    expect(status.responseTimeMs).toBeDefined();
  });

  it('should return correct singular form for 1 model', async () => {
    const config = createTestConfig();
    vi.spyOn(healthModule, 'checkOllamaHealth').mockResolvedValue({
      ok: true,
      data: {
        available: true,
        modelCount: 1,
        checkedAt: new Date().toISOString(),
      },
    });

    const status = await checkLlmAvailabilityForOperation(config);

    expect(status.reason).toContain('1 model');
    expect(status.reason).not.toContain('models');
  });

  it('should use healthCheckTimeout from config', async () => {
    const config = createExtendedConfig({ healthCheckTimeout: 2000 });
    const healthSpy = vi.spyOn(healthModule, 'checkOllamaHealth').mockResolvedValue({
      ok: true,
      data: {
        available: true,
        modelCount: 1,
        checkedAt: new Date().toISOString(),
      },
    });

    await checkLlmAvailabilityForOperation(config);

    expect(healthSpy).toHaveBeenCalledWith(
      expect.objectContaining({ timeout: 2000 })
    );
  });

  it('should default to 5000ms timeout when healthCheckTimeout not set', async () => {
    const config = createTestConfig();
    const healthSpy = vi.spyOn(healthModule, 'checkOllamaHealth').mockResolvedValue({
      ok: true,
      data: {
        available: true,
        checkedAt: new Date().toISOString(),
      },
    });

    await checkLlmAvailabilityForOperation(config);

    expect(healthSpy).toHaveBeenCalledWith(
      expect.objectContaining({ timeout: 5000 })
    );
  });

  it('should handle 0 models gracefully', async () => {
    const config = createTestConfig();
    vi.spyOn(healthModule, 'checkOllamaHealth').mockResolvedValue({
      ok: true,
      data: {
        available: true,
        modelCount: 0,
        checkedAt: new Date().toISOString(),
      },
    });

    const status = await checkLlmAvailabilityForOperation(config);

    expect(status.available).toBe(true);
    expect(status.reason).toContain('0 models');
  });

  it('should handle undefined modelCount', async () => {
    const config = createTestConfig();
    vi.spyOn(healthModule, 'checkOllamaHealth').mockResolvedValue({
      ok: true,
      data: {
        available: true,
        checkedAt: new Date().toISOString(),
      },
    });

    const status = await checkLlmAvailabilityForOperation(config);

    expect(status.available).toBe(true);
    expect(status.reason).toContain('0 models');
  });
});

// =============================================================================
// shouldProceedWithOperation Tests
// =============================================================================

describe('shouldProceedWithOperation', () => {
  const availableStatus: LlmAvailabilityStatus = {
    available: true,
    reason: 'Connected with 3 models',
    suggestion: '',
    responseTimeMs: 50,
  };

  const unavailableStatus: LlmAvailabilityStatus = {
    available: false,
    reason: 'Connection refused',
    suggestion: 'Start Ollama with: ollama serve',
    responseTimeMs: 100,
  };

  it('should proceed with LLM when available', () => {
    const config = createTestConfig();

    const decision = shouldProceedWithOperation(config, availableStatus);

    expect(decision.proceed).toBe(true);
    expect(decision.useOfflineMode).toBe(false);
    expect(decision.message).toBe('LLM available');
  });

  it('should proceed in offline mode when offlineMode is auto and LLM unavailable', () => {
    const config = createExtendedConfig({ offlineMode: 'auto' });

    const decision = shouldProceedWithOperation(config, unavailableStatus);

    expect(decision.proceed).toBe(true);
    expect(decision.useOfflineMode).toBe(true);
    expect(decision.message).toContain('offline mode');
    expect(decision.message).toContain('Connection refused');
  });

  it('should proceed in offline mode when offlineMode is enabled', () => {
    const config = createExtendedConfig({ offlineMode: 'enabled' });

    const decision = shouldProceedWithOperation(config, unavailableStatus);

    expect(decision.proceed).toBe(true);
    expect(decision.useOfflineMode).toBe(true);
    expect(decision.message).toContain('configured');
  });

  it('should NOT proceed when offlineMode is disabled and LLM unavailable', () => {
    const config = createExtendedConfig({ offlineMode: 'disabled' });

    const decision = shouldProceedWithOperation(config, unavailableStatus);

    expect(decision.proceed).toBe(false);
    expect(decision.useOfflineMode).toBe(false);
    expect(decision.message).toContain('LLM required');
    expect(decision.message).toContain('unavailable');
  });

  it('should default to auto when offlineMode not set', () => {
    const config = createTestConfig();

    const decision = shouldProceedWithOperation(config, unavailableStatus);

    expect(decision.proceed).toBe(true);
    expect(decision.useOfflineMode).toBe(true);
  });

  it('should proceed with LLM even when offlineMode is disabled if available', () => {
    const config = createExtendedConfig({ offlineMode: 'disabled' });

    const decision = shouldProceedWithOperation(config, availableStatus);

    expect(decision.proceed).toBe(true);
    expect(decision.useOfflineMode).toBe(false);
  });
});

// =============================================================================
// createOfflineFallbackResult Tests
// =============================================================================

describe('createOfflineFallbackResult', () => {
  it('should create a valid offline fallback result', () => {
    const result = createOfflineFallbackResult(
      '/path/to/file.pdf',
      'Connection timeout'
    );

    expect(result.filePath).toBe('/path/to/file.pdf');
    expect(result.analysisSource).toBe('offline-fallback');
    expect(result.reason).toBe('Connection timeout');
    expect(result.suggestion).toBeNull();
    expect(result.timestamp).toBeDefined();
  });

  it('should set a valid ISO timestamp', () => {
    const before = new Date().toISOString();
    const result = createOfflineFallbackResult('/file.txt', 'reason');
    const after = new Date().toISOString();

    expect(result.timestamp >= before).toBe(true);
    expect(result.timestamp <= after).toBe(true);
  });

  it('should handle empty reason', () => {
    const result = createOfflineFallbackResult('/file.txt', '');

    expect(result.reason).toBe('');
  });

  it('should handle paths with special characters', () => {
    const path = '/path/to/file with spaces & symbols!.pdf';
    const result = createOfflineFallbackResult(path, 'reason');

    expect(result.filePath).toBe(path);
  });
});

// =============================================================================
// createBatchOfflineSummary Tests
// =============================================================================

describe('createBatchOfflineSummary', () => {
  it('should return available status when all files analyzed with LLM', () => {
    const summary = createBatchOfflineSummary(10, 0, 0, 0, []);

    expect(summary.llmStatus).toBe('available');
    expect(summary.llmAnalyzedCount).toBe(10);
    expect(summary.offlineFallbackCount).toBe(0);
  });

  it('should return available status with vision analysis', () => {
    const summary = createBatchOfflineSummary(5, 5, 0, 0, []);

    expect(summary.llmStatus).toBe('available');
    expect(summary.visionAnalyzedCount).toBe(5);
  });

  it('should return unavailable when all files fell back', () => {
    const summary = createBatchOfflineSummary(0, 0, 10, 0, []);

    expect(summary.llmStatus).toBe('unavailable');
    expect(summary.offlineFallbackCount).toBe(10);
  });

  it('should return partial when mix of LLM and fallback', () => {
    const summary = createBatchOfflineSummary(5, 0, 5, 0, []);

    expect(summary.llmStatus).toBe('partial');
  });

  it('should return partial with vision and fallback mix', () => {
    const summary = createBatchOfflineSummary(0, 5, 5, 0, []);

    expect(summary.llmStatus).toBe('partial');
  });

  it('should track skipped files', () => {
    const summary = createBatchOfflineSummary(0, 0, 0, 10, []);

    expect(summary.skippedCount).toBe(10);
    expect(summary.llmStatus).toBe('unavailable');
  });

  it('should track errors', () => {
    const errors = ['Error 1', 'Error 2'];
    const summary = createBatchOfflineSummary(0, 0, 5, 0, errors);

    expect(summary.errors).toEqual(errors);
    expect(summary.errors).toHaveLength(2);
  });

  it('should handle all zeros', () => {
    const summary = createBatchOfflineSummary(0, 0, 0, 0, []);

    expect(summary.llmStatus).toBe('unavailable');
  });
});

// =============================================================================
// isConnectionError Tests
// =============================================================================

describe('isConnectionError', () => {
  it('should return true for CONNECTION_FAILED', () => {
    const error = createOllamaError('CONNECTION_FAILED', 'Connection refused');

    expect(isConnectionError(error)).toBe(true);
  });

  it('should return true for TIMEOUT', () => {
    const error = createOllamaError('TIMEOUT', 'Request timed out');

    expect(isConnectionError(error)).toBe(true);
  });

  it('should return false for MODEL_NOT_FOUND', () => {
    const error = createOllamaError('MODEL_NOT_FOUND', 'Model not found');

    expect(isConnectionError(error)).toBe(false);
  });

  it('should return false for INVALID_RESPONSE', () => {
    const error = createOllamaError('INVALID_RESPONSE', 'Invalid JSON');

    expect(isConnectionError(error)).toBe(false);
  });

  it('should return false for ANALYSIS_FAILED', () => {
    const error = createOllamaError('ANALYSIS_FAILED', 'Failed to parse');

    expect(isConnectionError(error)).toBe(false);
  });

  it('should return false for CONTENT_EXTRACTION_FAILED', () => {
    const error = createOllamaError('CONTENT_EXTRACTION_FAILED', 'Cannot read file');

    expect(isConnectionError(error)).toBe(false);
  });
});

// =============================================================================
// formatOfflineStatus Tests
// =============================================================================

describe('formatOfflineStatus', () => {
  it('should format available status correctly', () => {
    const status: LlmAvailabilityStatus = {
      available: true,
      reason: 'Connected with 3 models',
      suggestion: '',
      responseTimeMs: 50,
    };

    const lines = formatOfflineStatus(status);

    expect(lines).toContain('Mode:            Connected');
    expect(lines.some(l => l.includes('3 models'))).toBe(true);
    expect(lines.some(l => l.includes('50ms'))).toBe(true);
  });

  it('should format unavailable status correctly', () => {
    const status: LlmAvailabilityStatus = {
      available: false,
      reason: 'Connection refused',
      suggestion: 'Start Ollama with: ollama serve',
    };

    const lines = formatOfflineStatus(status);

    expect(lines.some(l => l.includes('Offline'))).toBe(true);
    expect(lines.some(l => l.includes('Connection refused'))).toBe(true);
    expect(lines.some(l => l.includes('ollama serve'))).toBe(true);
  });

  it('should omit response time when not available', () => {
    const status: LlmAvailabilityStatus = {
      available: true,
      reason: 'Connected',
      suggestion: '',
    };

    const lines = formatOfflineStatus(status);

    expect(lines.some(l => l.includes('Response time'))).toBe(false);
  });

  it('should omit suggestion when empty', () => {
    const status: LlmAvailabilityStatus = {
      available: false,
      reason: 'Disabled',
      suggestion: '',
    };

    const lines = formatOfflineStatus(status);

    expect(lines.some(l => l.includes('Suggestion'))).toBe(false);
  });
});

// =============================================================================
// OFFLINE_MESSAGES Tests
// =============================================================================

describe('OFFLINE_MESSAGES', () => {
  it('should have reason and suggestion for all message types', () => {
    const messageTypes = [
      'CONNECTION_REFUSED',
      'TIMEOUT',
      'DISABLED',
      'OFFLINE_MODE_ENABLED',
      'NO_MODEL',
      'NOT_RESPONDING',
    ] as const;

    for (const type of messageTypes) {
      expect(OFFLINE_MESSAGES[type].reason).toBeDefined();
      expect(OFFLINE_MESSAGES[type].reason.length).toBeGreaterThan(0);
      expect(OFFLINE_MESSAGES[type].suggestion).toBeDefined();
      expect(OFFLINE_MESSAGES[type].suggestion.length).toBeGreaterThan(0);
    }
  });
});
