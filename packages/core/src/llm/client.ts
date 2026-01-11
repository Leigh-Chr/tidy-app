/**
 * @fileoverview Ollama HTTP client - Story 10.1
 *
 * Provides a thin HTTP wrapper around the Ollama API.
 * All methods return Result<T, OllamaError> - never throw.
 *
 * @module llm/client
 */

import { ok, err, type Result } from '../types/result.js';
import {
  type OllamaConfig,
  type OllamaError,
  type HealthStatus,
  type OllamaModel,
  createOllamaError,
  createAvailableHealthStatus,
  ollamaTagsResponseSchema,
  DEFAULT_OLLAMA_CONFIG,
} from './types.js';

// =============================================================================
// Client Options
// =============================================================================

/**
 * Options for creating an Ollama client.
 */
export interface OllamaClientOptions {
  /** Base URL for Ollama API */
  baseUrl?: string;
  /** Request timeout in milliseconds */
  timeout?: number;
}

/**
 * Ollama client interface.
 *
 * Provides methods to interact with a local Ollama instance.
 */
export interface OllamaClient {
  /** Check if Ollama is available */
  checkHealth(): Promise<Result<HealthStatus, OllamaError>>;
  /** List installed models */
  listModels(): Promise<Result<OllamaModel[], OllamaError>>;
  /** Get client configuration */
  getConfig(): OllamaClientOptions;
}

// =============================================================================
// Client Implementation
// =============================================================================

/**
 * Create an Ollama client.
 *
 * @param options - Client configuration options
 * @returns Configured Ollama client instance
 *
 * @example
 * ```typescript
 * const client = createOllamaClient({
 *   baseUrl: 'http://localhost:11434',
 *   timeout: 30000,
 * });
 *
 * const health = await client.checkHealth();
 * if (health.ok && health.data.available) {
 *   const models = await client.listModels();
 * }
 * ```
 */
export function createOllamaClient(options: OllamaClientOptions = {}): OllamaClient {
  const config: Required<OllamaClientOptions> = {
    baseUrl: options.baseUrl ?? DEFAULT_OLLAMA_CONFIG.baseUrl,
    timeout: options.timeout ?? DEFAULT_OLLAMA_CONFIG.timeout,
  };

  return {
    checkHealth: () => checkHealth(config),
    listModels: () => listModels(config),
    getConfig: () => ({ ...config }),
  };
}

/**
 * Create an Ollama client from app configuration.
 *
 * @param config - Full Ollama configuration
 * @returns Configured Ollama client instance
 */
export function createOllamaClientFromConfig(config: OllamaConfig): OllamaClient {
  return createOllamaClient({
    baseUrl: config.baseUrl,
    timeout: config.timeout,
  });
}

// =============================================================================
// HTTP Operations
// =============================================================================

/**
 * Check if Ollama is available and responding.
 *
 * Calls the /api/tags endpoint which returns quickly and indicates
 * the server is running.
 *
 * @param options - Client options
 * @returns Health status result
 */
async function checkHealth(
  options: Required<OllamaClientOptions>
): Promise<Result<HealthStatus, OllamaError>> {
  try {
    const response = await fetchWithTimeout(
      `${options.baseUrl}/api/tags`,
      { method: 'GET' },
      options.timeout
    );

    if (!response.ok) {
      return err(createOllamaError(
        'CONNECTION_FAILED',
        `Ollama returned status ${response.status}`
      ));
    }

    const data = await response.json();
    const parsed = ollamaTagsResponseSchema.safeParse(data);

    if (!parsed.success) {
      return err(createOllamaError(
        'INVALID_RESPONSE',
        'Invalid response from Ollama API',
        parsed.error
      ));
    }

    return ok(createAvailableHealthStatus(parsed.data.models.length));
  } catch (error) {
    return err(categorizeError(error, options.timeout));
  }
}

/**
 * List all locally installed models.
 *
 * @param options - Client options
 * @returns Array of installed models
 */
async function listModels(
  options: Required<OllamaClientOptions>
): Promise<Result<OllamaModel[], OllamaError>> {
  try {
    const response = await fetchWithTimeout(
      `${options.baseUrl}/api/tags`,
      { method: 'GET' },
      options.timeout
    );

    if (!response.ok) {
      return err(createOllamaError(
        'CONNECTION_FAILED',
        `Ollama returned status ${response.status}`
      ));
    }

    const data = await response.json();
    const parsed = ollamaTagsResponseSchema.safeParse(data);

    if (!parsed.success) {
      return err(createOllamaError(
        'INVALID_RESPONSE',
        'Invalid response from Ollama API',
        parsed.error
      ));
    }

    return ok(parsed.data.models);
  } catch (error) {
    return err(categorizeError(error, options.timeout));
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Fetch with timeout support.
 *
 * @param url - URL to fetch
 * @param init - Fetch options
 * @param timeout - Timeout in milliseconds
 * @returns Fetch response
 */
async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeout: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Categorize an error into an OllamaError.
 *
 * @param error - The caught error
 * @param timeout - Timeout value for error message
 * @returns Categorized OllamaError
 */
function categorizeError(error: unknown, timeout: number): OllamaError {
  // Handle AbortError (timeout)
  if (error instanceof DOMException && error.name === 'AbortError') {
    return createOllamaError(
      'TIMEOUT',
      `Connection timed out after ${timeout}ms`,
      error
    );
  }

  // Handle TypeError (typically network errors in fetch)
  if (error instanceof TypeError) {
    // Check for common connection refused patterns
    const message = error.message.toLowerCase();
    if (message.includes('fetch failed') || message.includes('network')) {
      return createOllamaError(
        'CONNECTION_FAILED',
        'Failed to connect to Ollama. Is it running?',
        error
      );
    }
  }

  // Handle generic errors
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (message.includes('econnrefused') || message.includes('connect')) {
      return createOllamaError(
        'CONNECTION_FAILED',
        'Connection refused. Is Ollama running?',
        error
      );
    }
    return createOllamaError(
      'CONNECTION_FAILED',
      `Connection error: ${error.message}`,
      error
    );
  }

  // Unknown error type
  return createOllamaError(
    'CONNECTION_FAILED',
    'Unknown error occurred',
    error
  );
}
