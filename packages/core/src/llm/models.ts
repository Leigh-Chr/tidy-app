/**
 * @fileoverview Ollama model discovery - Story 10.1
 *
 * Provides functions to list and inspect locally installed Ollama models.
 *
 * @module llm/models
 */

import type { Result } from '../types/result.js';
import {
  type OllamaConfig,
  type OllamaError,
  type OllamaModel,
  type FormattedModel,
  formatModel,
  DEFAULT_OLLAMA_CONFIG,
} from './types.js';
import { createOllamaClient, type OllamaClientOptions } from './client.js';

// =============================================================================
// Model Discovery Functions (AC3)
// =============================================================================

/**
 * List all locally installed Ollama models.
 *
 * Returns an array of OllamaModel objects with full details about
 * each installed model including name, size, family, and parameters.
 *
 * @param config - Ollama configuration
 * @returns Array of installed models
 *
 * @example
 * ```typescript
 * const result = await listOllamaModels();
 * if (result.ok) {
 *   for (const model of result.data) {
 *     console.log(`${model.name}: ${model.details?.family || 'unknown'}`);
 *   }
 * }
 * ```
 */
export async function listOllamaModels(
  config: Partial<OllamaConfig> = {}
): Promise<Result<OllamaModel[], OllamaError>> {
  const clientOptions: OllamaClientOptions = {
    baseUrl: config.baseUrl ?? DEFAULT_OLLAMA_CONFIG.baseUrl,
    timeout: config.timeout ?? DEFAULT_OLLAMA_CONFIG.timeout,
  };

  const client = createOllamaClient(clientOptions);
  return client.listModels();
}

/**
 * List installed models with formatted output.
 *
 * Returns models in a display-friendly format with human-readable
 * sizes and normalized field values.
 *
 * @param config - Ollama configuration
 * @returns Array of formatted models
 *
 * @example
 * ```typescript
 * const result = await listFormattedModels();
 * if (result.ok) {
 *   for (const model of result.data) {
 *     console.log(`${model.name} - ${model.sizeFormatted} (${model.parameterSize})`);
 *   }
 * }
 * ```
 */
export async function listFormattedModels(
  config: Partial<OllamaConfig> = {}
): Promise<Result<FormattedModel[], OllamaError>> {
  const result = await listOllamaModels(config);

  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    data: result.data.map(formatModel),
  };
}

/**
 * Get the count of installed models.
 *
 * @param config - Ollama configuration
 * @returns Number of installed models
 */
export async function getModelCount(
  config: Partial<OllamaConfig> = {}
): Promise<Result<number, OllamaError>> {
  const result = await listOllamaModels(config);

  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    data: result.data.length,
  };
}

/**
 * Check if a specific model is installed.
 *
 * @param modelName - Name of model to check (e.g., 'mistral:latest')
 * @param config - Ollama configuration
 * @returns true if model is installed
 *
 * @example
 * ```typescript
 * const result = await isModelInstalled('mistral:latest');
 * if (result.ok && result.data) {
 *   // Model is available
 * }
 * ```
 */
export async function isModelInstalled(
  modelName: string,
  config: Partial<OllamaConfig> = {}
): Promise<Result<boolean, OllamaError>> {
  const result = await listOllamaModels(config);

  if (!result.ok) {
    return result;
  }

  const normalizedSearch = modelName.toLowerCase();
  const found = result.data.some(
    (model) => model.name.toLowerCase() === normalizedSearch
  );

  return {
    ok: true,
    data: found,
  };
}

/**
 * Find a model by name.
 *
 * Returns the full model details if found, null otherwise.
 *
 * @param modelName - Name of model to find
 * @param config - Ollama configuration
 * @returns Model details or null
 */
export async function findModel(
  modelName: string,
  config: Partial<OllamaConfig> = {}
): Promise<Result<OllamaModel | null, OllamaError>> {
  const result = await listOllamaModels(config);

  if (!result.ok) {
    return result;
  }

  const normalizedSearch = modelName.toLowerCase();
  const model = result.data.find(
    (m) => m.name.toLowerCase() === normalizedSearch
  );

  return {
    ok: true,
    data: model ?? null,
  };
}

/**
 * Get model names only.
 *
 * Returns a simple array of model names for selection lists.
 *
 * @param config - Ollama configuration
 * @returns Array of model names
 */
export async function getModelNames(
  config: Partial<OllamaConfig> = {}
): Promise<Result<string[], OllamaError>> {
  const result = await listOllamaModels(config);

  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    data: result.data.map((m) => m.name),
  };
}

/**
 * Get models grouped by family.
 *
 * Organizes models by their family (e.g., 'mistral', 'llama', 'qwen').
 *
 * @param config - Ollama configuration
 * @returns Map of family to models
 */
export async function getModelsByFamily(
  config: Partial<OllamaConfig> = {}
): Promise<Result<Map<string, OllamaModel[]>, OllamaError>> {
  const result = await listOllamaModels(config);

  if (!result.ok) {
    return result;
  }

  const grouped = new Map<string, OllamaModel[]>();

  for (const model of result.data) {
    const family = model.details?.family ?? 'unknown';
    const existing = grouped.get(family) ?? [];
    existing.push(model);
    grouped.set(family, existing);
  }

  return {
    ok: true,
    data: grouped,
  };
}

/**
 * Summary of installed models.
 */
export interface ModelsSummary {
  /** Total number of models */
  total: number;
  /** Total size of all models in bytes */
  totalSizeBytes: number;
  /** Formatted total size */
  totalSizeFormatted: string;
  /** Models grouped by family */
  byFamily: Record<string, number>;
}

/**
 * Get a summary of installed models.
 *
 * @param config - Ollama configuration
 * @returns Models summary
 */
export async function getModelsSummary(
  config: Partial<OllamaConfig> = {}
): Promise<Result<ModelsSummary, OllamaError>> {
  const result = await listOllamaModels(config);

  if (!result.ok) {
    return result;
  }

  const totalSizeBytes = result.data.reduce((sum, m) => sum + m.size, 0);
  const byFamily: Record<string, number> = {};

  for (const model of result.data) {
    const family = model.details?.family ?? 'unknown';
    byFamily[family] = (byFamily[family] ?? 0) + 1;
  }

  return {
    ok: true,
    data: {
      total: result.data.length,
      totalSizeBytes,
      totalSizeFormatted: formatTotalSize(totalSizeBytes),
      byFamily,
    },
  };
}

/**
 * Format total size in human-readable format.
 */
function formatTotalSize(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) {
    return `${gb.toFixed(1)} GB`;
  }
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(0)} MB`;
}
