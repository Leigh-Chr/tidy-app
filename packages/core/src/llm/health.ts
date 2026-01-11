/**
 * @fileoverview Ollama health check - Story 10.1
 *
 * Provides health check functionality for Ollama connection verification.
 * Uses the /api/tags endpoint as a lightweight way to verify connectivity.
 *
 * @module llm/health
 */

import type { Result } from '../types/result.js';
import {
  type OllamaConfig,
  type OllamaError,
  type HealthStatus,
  DEFAULT_OLLAMA_CONFIG,
} from './types.js';
import { createOllamaClient, type OllamaClientOptions } from './client.js';

// =============================================================================
// Health Check Functions
// =============================================================================

/**
 * Check if Ollama is available and responding.
 *
 * This is the primary way to verify Ollama connectivity before using
 * LLM features. Returns a HealthStatus indicating availability.
 *
 * @param config - Ollama configuration
 * @returns Health status result
 *
 * @example
 * ```typescript
 * const result = await checkOllamaHealth({
 *   baseUrl: 'http://localhost:11434',
 *   timeout: 5000,
 * });
 *
 * if (result.ok && result.data.available) {
 *   console.log(`Ollama running with ${result.data.modelCount} models`);
 * } else if (result.ok && !result.data.available) {
 *   console.log('Ollama not available');
 * } else {
 *   console.error(`Health check failed: ${result.error.message}`);
 * }
 * ```
 */
export async function checkOllamaHealth(
  config: Partial<OllamaConfig> = {}
): Promise<Result<HealthStatus, OllamaError>> {
  const clientOptions: OllamaClientOptions = {
    baseUrl: config.baseUrl ?? DEFAULT_OLLAMA_CONFIG.baseUrl,
    timeout: config.timeout ?? DEFAULT_OLLAMA_CONFIG.timeout,
  };

  const client = createOllamaClient(clientOptions);
  return client.checkHealth();
}

/**
 * Quick availability check - returns boolean only.
 *
 * Simplified health check that returns true if Ollama is reachable,
 * false otherwise. Does not throw.
 *
 * @param config - Ollama configuration
 * @returns true if Ollama is available, false otherwise
 *
 * @example
 * ```typescript
 * const available = await isOllamaAvailable();
 * if (available) {
 *   // Proceed with LLM features
 * }
 * ```
 */
export async function isOllamaAvailable(
  config: Partial<OllamaConfig> = {}
): Promise<boolean> {
  const result = await checkOllamaHealth(config);
  return result.ok && result.data.available;
}

/**
 * Get Ollama status summary for display.
 *
 * Returns a human-readable status string suitable for CLI or GUI display.
 *
 * @param config - Ollama configuration
 * @returns Status string
 *
 * @example
 * ```typescript
 * const status = await getOllamaStatus();
 * console.log(`LLM Status: ${status}`);
 * // "Connected (3 models)" or "Not available" or "Disabled"
 * ```
 */
export async function getOllamaStatus(
  config: Partial<OllamaConfig> = {}
): Promise<string> {
  // Check if LLM is disabled
  if (config.enabled === false) {
    return 'Disabled';
  }

  const result = await checkOllamaHealth(config);

  if (!result.ok) {
    return `Error: ${result.error.message}`;
  }

  if (!result.data.available) {
    return 'Not available';
  }

  const modelInfo = result.data.modelCount !== undefined
    ? ` (${result.data.modelCount} model${result.data.modelCount === 1 ? '' : 's'})`
    : '';

  return `Connected${modelInfo}`;
}

/**
 * Get detailed health information.
 *
 * Returns full health details including connection status, error information,
 * and timing. Useful for debugging connection issues.
 *
 * @param config - Ollama configuration
 * @returns Detailed health report
 */
export async function getOllamaHealthReport(
  config: Partial<OllamaConfig> = {}
): Promise<OllamaHealthReport> {
  const startTime = Date.now();
  const result = await checkOllamaHealth(config);
  const responseTime = Date.now() - startTime;

  const baseUrl = config.baseUrl ?? DEFAULT_OLLAMA_CONFIG.baseUrl;

  if (!result.ok) {
    return {
      available: false,
      baseUrl,
      responseTimeMs: responseTime,
      error: result.error,
    };
  }

  return {
    available: result.data.available,
    baseUrl,
    responseTimeMs: responseTime,
    modelCount: result.data.modelCount,
    version: result.data.version,
  };
}

/**
 * Detailed health report for diagnostics.
 */
export interface OllamaHealthReport {
  /** Whether Ollama is reachable */
  available: boolean;
  /** Base URL that was checked */
  baseUrl: string;
  /** Response time in milliseconds */
  responseTimeMs: number;
  /** Number of models (if available) */
  modelCount?: number;
  /** Ollama version (if available) */
  version?: string;
  /** Error details (if check failed) */
  error?: OllamaError;
}
