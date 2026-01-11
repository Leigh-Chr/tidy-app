/**
 * @fileoverview Ollama Generate API Wrapper - Story 10.2
 *
 * Provides functions to call the Ollama /api/generate endpoint
 * for text completion/generation.
 *
 * @module llm/generate
 */

import { z } from 'zod';
import { ok, err, type Result } from '../types/result.js';
import {
  type OllamaConfig,
  type OllamaError,
  createOllamaError,
  DEFAULT_OLLAMA_CONFIG,
} from './types.js';

// =============================================================================
// Generate Request/Response Types
// =============================================================================

/**
 * Options for generate request.
 */
export interface GenerateOptions {
  /** Model name (e.g., 'mistral', 'llama3') */
  model: string;
  /** Prompt text */
  prompt: string;
  /** Temperature for generation (0-2, default: 0.7) */
  temperature?: number;
  /** Maximum tokens to generate */
  maxTokens?: number;
  /** System prompt (optional) */
  system?: string;
}

/**
 * Response from generate endpoint.
 */
export interface GenerateResponse {
  /** The generated text response */
  response: string;
  /** Model that generated the response */
  model: string;
  /** Total duration in nanoseconds */
  totalDuration: number;
  /** Number of tokens in prompt */
  promptTokens: number;
  /** Number of tokens generated */
  responseTokens: number;
}

/**
 * Raw response schema from Ollama /api/generate.
 */
const ollamaGenerateResponseSchema = z.object({
  model: z.string(),
  created_at: z.string(),
  response: z.string(),
  done: z.boolean(),
  total_duration: z.number().optional(),
  load_duration: z.number().optional(),
  prompt_eval_count: z.number().optional(),
  prompt_eval_duration: z.number().optional(),
  eval_count: z.number().optional(),
  eval_duration: z.number().optional(),
});

type OllamaGenerateResponse = z.infer<typeof ollamaGenerateResponseSchema>;

// =============================================================================
// Generate Function
// =============================================================================

/**
 * Generate text completion using Ollama.
 *
 * Calls the /api/generate endpoint with stream: false to get
 * a complete response in one request.
 *
 * @param config - Ollama configuration
 * @param options - Generation options
 * @returns Generated text or error
 *
 * @example
 * ```typescript
 * const result = await generateCompletion(config, {
 *   model: 'mistral',
 *   prompt: 'Summarize this document...',
 *   temperature: 0.3,
 * });
 *
 * if (result.ok) {
 *   console.log(result.data.response);
 * }
 * ```
 */
export async function generateCompletion(
  config: Partial<OllamaConfig>,
  options: GenerateOptions
): Promise<Result<GenerateResponse, OllamaError>> {
  const fullConfig = { ...DEFAULT_OLLAMA_CONFIG, ...config };

  const body = {
    model: options.model,
    prompt: options.prompt,
    stream: false, // Get complete response
    options: {
      temperature: options.temperature ?? 0.7,
      num_predict: options.maxTokens ?? 256,
    },
    ...(options.system && { system: options.system }),
  };

  try {
    const response = await fetchWithTimeout(
      `${fullConfig.baseUrl}/api/generate`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
      fullConfig.timeout
    );

    if (!response.ok) {
      // Check for specific error codes
      if (response.status === 404) {
        return err(createOllamaError(
          'MODEL_NOT_FOUND',
          `Model '${options.model}' not found. Run 'ollama pull ${options.model}' to install.`
        ));
      }

      return err(createOllamaError(
        'CONNECTION_FAILED',
        `Ollama returned status ${response.status}: ${response.statusText}`
      ));
    }

    const data = await response.json();
    const parsed = ollamaGenerateResponseSchema.safeParse(data);

    if (!parsed.success) {
      return err(createOllamaError(
        'INVALID_RESPONSE',
        'Invalid response from Ollama generate API',
        parsed.error
      ));
    }

    return ok(formatGenerateResponse(parsed.data));
  } catch (error) {
    return err(categorizeError(error, fullConfig.timeout));
  }
}

/**
 * Generate with simpler interface using config's default inference model.
 *
 * @param config - Ollama configuration (must have models.inference set)
 * @param prompt - The prompt to generate from
 * @param options - Optional generation parameters
 * @returns Generated text or error
 */
export async function generate(
  config: OllamaConfig,
  prompt: string,
  options?: Partial<Omit<GenerateOptions, 'model' | 'prompt'>>
): Promise<Result<string, OllamaError>> {
  const model = config.models?.inference;

  if (!model) {
    return err(createOllamaError(
      'MODEL_NOT_FOUND',
      'No inference model configured. Set config.models.inference'
    ));
  }

  const result = await generateCompletion(config, {
    model,
    prompt,
    ...options,
  });

  if (!result.ok) {
    return result;
  }

  return ok(result.data.response);
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Format raw Ollama response into our GenerateResponse type.
 */
function formatGenerateResponse(raw: OllamaGenerateResponse): GenerateResponse {
  return {
    response: raw.response,
    model: raw.model,
    totalDuration: raw.total_duration ?? 0,
    promptTokens: raw.prompt_eval_count ?? 0,
    responseTokens: raw.eval_count ?? 0,
  };
}

/**
 * Fetch with timeout support.
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
 * Categorize errors into OllamaError.
 */
function categorizeError(error: unknown, timeout: number): OllamaError {
  // Handle AbortError (timeout)
  if (error instanceof DOMException && error.name === 'AbortError') {
    return createOllamaError(
      'TIMEOUT',
      `Generation timed out after ${timeout}ms. Try a smaller prompt or increase timeout.`,
      error
    );
  }

  // Handle TypeError (typically network errors in fetch)
  if (error instanceof TypeError) {
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

  return createOllamaError(
    'CONNECTION_FAILED',
    'Unknown error occurred during generation',
    error
  );
}
