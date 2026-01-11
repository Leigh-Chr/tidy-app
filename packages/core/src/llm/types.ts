/**
 * @fileoverview LLM/Ollama type definitions and Zod schemas - Story 10.1
 *
 * Provides types for:
 * - Ollama configuration (base URL, timeout, models)
 * - Ollama error handling with typed error codes
 * - Health status for connection verification
 * - Model information for discovery
 *
 * @module llm/types
 */

import { z } from 'zod';

// =============================================================================
// Error Types (AC4: Graceful Degradation)
// =============================================================================

/**
 * Error codes for Ollama operations.
 *
 * Used to categorize errors for appropriate handling:
 * - CONNECTION_FAILED: Cannot reach Ollama server
 * - TIMEOUT: Request exceeded timeout threshold
 * - MODEL_NOT_FOUND: Requested model not available
 * - INVALID_RESPONSE: Ollama returned malformed data
 */
export const ollamaErrorCodeSchema = z.enum([
  'CONNECTION_FAILED',
  'TIMEOUT',
  'MODEL_NOT_FOUND',
  'INVALID_RESPONSE',
  'ANALYSIS_FAILED',
  'CONTENT_EXTRACTION_FAILED',
]);

export type OllamaErrorCode = z.infer<typeof ollamaErrorCodeSchema>;

/**
 * Structured error for Ollama operations.
 *
 * All LLM functions return Result<T, OllamaError> - never throw.
 */
export const ollamaErrorSchema = z.object({
  code: ollamaErrorCodeSchema,
  message: z.string(),
  originalError: z.unknown().optional(),
});

export type OllamaError = z.infer<typeof ollamaErrorSchema>;

/**
 * Create an OllamaError with proper typing.
 */
export function createOllamaError(
  code: OllamaErrorCode,
  message: string,
  originalError?: unknown
): OllamaError {
  return { code, message, originalError };
}

// =============================================================================
// Configuration Types (AC1: Ollama Configuration)
// =============================================================================

/**
 * Model selection configuration.
 *
 * Allows specifying preferred models for different use cases.
 */
export const ollamaModelsConfigSchema = z.object({
  /** Model for text generation/inference (e.g., 'mistral', 'llama3') */
  inference: z.string().optional(),
  /** Model for embeddings (e.g., 'all-minilm', 'nomic-embed-text') */
  embedding: z.string().optional(),
  /** Vision-capable model for image analysis (e.g., 'llava', 'gemma3') - Story 10.5 */
  vision: z.string().optional(),
});

export type OllamaModelsConfig = z.infer<typeof ollamaModelsConfigSchema>;

// =============================================================================
// File Type Configuration (Story 10.4: AC1, AC2, AC5)
// =============================================================================

/**
 * File type preset enum.
 *
 * - `images`: Image files (jpg, png, gif, etc.)
 * - `documents`: Office documents and PDFs
 * - `text`: Plain text and markup files
 * - `all`: All of the above combined
 * - `custom`: User-defined extensions only
 */
export const fileTypePresetSchema = z.enum(['images', 'documents', 'text', 'all', 'custom']);

export type FileTypePresetValue = z.infer<typeof fileTypePresetSchema>;

/**
 * Schema for LLM file type configuration.
 *
 * Controls which files are sent to LLM for analysis.
 * Uses a combination of presets and explicit include/exclude lists.
 *
 * Priority order:
 * 1. excludedExtensions (always skip these)
 * 2. includedExtensions (explicit include overrides preset)
 * 3. preset category (default behavior)
 *
 * AC1: File type configuration in settings
 * AC2: File type categories (presets + custom)
 * AC5: Default configuration
 */
export const llmFileTypesSchema = z.object({
  /** Preset category - 'images', 'documents', 'text', 'all', 'custom' */
  preset: fileTypePresetSchema.default('documents'),
  /** Explicit extensions to include (overrides preset when non-empty) */
  includedExtensions: z.array(z.string()).default([]),
  /** Extensions to exclude from analysis (takes precedence over include/preset) */
  excludedExtensions: z.array(z.string()).default([]),
  /** Skip files that already have rich metadata (e.g., EXIF) */
  skipWithMetadata: z.boolean().default(true),
});

export type LlmFileTypes = z.infer<typeof llmFileTypesSchema>;

/**
 * Default LLM file type configuration.
 *
 * Defaults to 'documents' preset which includes:
 * - PDF, Office documents
 * - Files that typically lack rich metadata
 *
 * Images are excluded by default because:
 * - They often have EXIF metadata (Story 2.1)
 * - Vision models require separate configuration (Story 10.5)
 */
export const DEFAULT_LLM_FILE_TYPES: LlmFileTypes = {
  preset: 'documents',
  includedExtensions: [],
  excludedExtensions: [],
  skipWithMetadata: true,
};

// =============================================================================
// Offline Mode Configuration (Story 10.6: AC5)
// =============================================================================

/**
 * Offline mode setting.
 *
 * Controls how tidy-app behaves when LLM is unavailable.
 *
 * - `auto`: Graceful degradation - try LLM, fall back to offline mode if unavailable
 * - `enabled`: Force offline mode - never attempt LLM connection
 * - `disabled`: Require LLM - fail operations if LLM unavailable
 */
export const offlineModeSchema = z.enum(['auto', 'enabled', 'disabled']);
export type OfflineModeValue = z.infer<typeof offlineModeSchema>;

// =============================================================================
// Ollama Configuration (Story 10.1, updated Story 10.4, 10.6)
// =============================================================================

/**
 * Complete Ollama configuration.
 *
 * Stored in app config and used to connect to Ollama.
 */
export const ollamaConfigSchema = z.object({
  /** Whether Ollama integration is enabled */
  enabled: z.boolean().default(false),
  /** Ollama API base URL */
  baseUrl: z.string().url().default('http://localhost:11434'),
  /** Request timeout in milliseconds */
  timeout: z.number().positive().default(30000),
  /** Preferred models for different operations */
  models: ollamaModelsConfigSchema.default({}),
  /** File type configuration for LLM analysis (Story 10.4) */
  fileTypes: llmFileTypesSchema.default(DEFAULT_LLM_FILE_TYPES),
  /** Whether to enable vision model analysis for images (Story 10.5) */
  visionEnabled: z.boolean().default(false),
  /** Skip vision analysis if image has rich EXIF metadata (Story 10.5) */
  skipImagesWithExif: z.boolean().default(true),
  /** Maximum image size in bytes to send to vision model (default: 20MB) (Story 10.5) */
  maxImageSize: z.number().positive().default(20 * 1024 * 1024),
  /** Offline mode behavior (Story 10.6) */
  offlineMode: offlineModeSchema.default('auto'),
  /** Health check timeout in milliseconds for pre-operation checks (Story 10.6) */
  healthCheckTimeout: z.number().positive().default(5000),
});

export type OllamaConfig = z.infer<typeof ollamaConfigSchema>;

/**
 * Default Ollama configuration values.
 */
export const DEFAULT_OLLAMA_CONFIG: OllamaConfig = {
  enabled: false,
  baseUrl: 'http://localhost:11434',
  timeout: 30000,
  models: {},
  fileTypes: DEFAULT_LLM_FILE_TYPES,
  visionEnabled: false,
  skipImagesWithExif: true,
  maxImageSize: 20 * 1024 * 1024,
  offlineMode: 'auto',
  healthCheckTimeout: 5000,
};

// =============================================================================
// Health Status Types (AC2: Connection Verification)
// =============================================================================

/**
 * Health check status for Ollama connection.
 */
export const healthStatusSchema = z.object({
  /** Whether Ollama is reachable and responding */
  available: z.boolean(),
  /** Ollama version (if available) */
  version: z.string().optional(),
  /** Number of models installed (if available) */
  modelCount: z.number().optional(),
  /** Timestamp of health check */
  checkedAt: z.string().datetime(),
});

export type HealthStatus = z.infer<typeof healthStatusSchema>;

/**
 * Create a health status indicating unavailable.
 */
export function createUnavailableHealthStatus(): HealthStatus {
  return {
    available: false,
    checkedAt: new Date().toISOString(),
  };
}

/**
 * Create a health status indicating available.
 */
export function createAvailableHealthStatus(
  modelCount?: number,
  version?: string
): HealthStatus {
  return {
    available: true,
    version,
    modelCount,
    checkedAt: new Date().toISOString(),
  };
}

// =============================================================================
// Model Types (AC3: Model Discovery)
// =============================================================================

/**
 * Model details from Ollama.
 */
export const ollamaModelDetailsSchema = z.object({
  /** Model family (e.g., 'mistral', 'llama') */
  family: z.string().optional(),
  /** Parameter size (e.g., '7B', '13B') */
  parameter_size: z.string().optional(),
  /** Quantization level (e.g., 'Q4_0', 'Q8_0') */
  quantization_level: z.string().optional(),
});

export type OllamaModelDetails = z.infer<typeof ollamaModelDetailsSchema>;

/**
 * Model information from Ollama API.
 *
 * Represents a locally installed model.
 */
export const ollamaModelSchema = z.object({
  /** Model name with tag (e.g., 'mistral:latest') */
  name: z.string(),
  /** Full model identifier */
  model: z.string(),
  /** Last modification timestamp */
  modified_at: z.string(),
  /** Model size in bytes */
  size: z.number(),
  /** Model digest hash */
  digest: z.string(),
  /** Additional model details */
  details: ollamaModelDetailsSchema.optional(),
});

export type OllamaModel = z.infer<typeof ollamaModelSchema>;

/**
 * Response from Ollama /api/tags endpoint.
 */
export const ollamaTagsResponseSchema = z.object({
  models: z.array(ollamaModelSchema).default([]),
});

export type OllamaTagsResponse = z.infer<typeof ollamaTagsResponseSchema>;

// =============================================================================
// Formatted Model Types (for display)
// =============================================================================

/**
 * Formatted model information for display.
 *
 * Human-readable representation of model data.
 */
export interface FormattedModel {
  name: string;
  family: string;
  parameterSize: string;
  sizeFormatted: string;
  sizeBytes: number;
  quantization: string;
}

/**
 * Format model size in human-readable format.
 */
export function formatModelSize(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) {
    return `${gb.toFixed(1)} GB`;
  }
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(0)} MB`;
}

/**
 * Convert OllamaModel to FormattedModel for display.
 */
export function formatModel(model: OllamaModel): FormattedModel {
  return {
    name: model.name,
    family: model.details?.family ?? 'unknown',
    parameterSize: model.details?.parameter_size ?? 'unknown',
    sizeFormatted: formatModelSize(model.size),
    sizeBytes: model.size,
    quantization: model.details?.quantization_level ?? 'unknown',
  };
}
