/**
 * @fileoverview LLM Provider Abstraction
 *
 * Provides a unified interface for different LLM backends:
 * - Ollama (local)
 * - OpenAI (cloud)
 * - Future: Anthropic, Mistral, etc.
 *
 * @module llm/provider
 */

import { z } from 'zod';
import { type Result } from '../types/result.js';
import { type HealthStatus, type OllamaError } from './types.js';
import { type AnalysisSuggestion } from './analysis.js';

// =============================================================================
// Provider Types
// =============================================================================

/**
 * Supported LLM provider types.
 */
export const llmProviderTypeSchema = z.enum(['ollama', 'openai']);
export type LlmProviderType = z.infer<typeof llmProviderTypeSchema>;

/**
 * Model info returned by providers.
 */
export interface ProviderModel {
  /** Model identifier */
  id: string;
  /** Display name */
  name: string;
  /** Whether this model supports vision */
  supportsVision: boolean;
  /** Provider-specific metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Request for content analysis.
 */
export interface AnalysisRequest {
  /** Text content to analyze */
  content: string;
  /** File type hint */
  fileType?: string;
  /** Optional system prompt override */
  systemPrompt?: string;
  /** Temperature for generation */
  temperature?: number;
  /** Max tokens for response */
  maxTokens?: number;
}

/**
 * Request for vision analysis.
 */
export interface VisionAnalysisRequest {
  /** Base64 encoded image */
  imageBase64: string;
  /** Image MIME type */
  mimeType: string;
  /** Optional prompt */
  prompt?: string;
  /** Temperature for generation */
  temperature?: number;
  /** Max tokens for response */
  maxTokens?: number;
}

/**
 * LLM Provider interface.
 *
 * All providers must implement this interface to be used
 * interchangeably in the application.
 */
export interface LlmProvider {
  /** Provider type identifier */
  readonly type: LlmProviderType;

  /** Display name for UI */
  readonly displayName: string;

  /**
   * Check if the provider is available and configured correctly.
   */
  checkHealth(): Promise<Result<HealthStatus, OllamaError>>;

  /**
   * List available models from this provider.
   */
  listModels(): Promise<Result<ProviderModel[], OllamaError>>;

  /**
   * Analyze text content and suggest a filename.
   */
  analyzeContent(request: AnalysisRequest): Promise<Result<AnalysisSuggestion, OllamaError>>;

  /**
   * Analyze an image and suggest a filename.
   * Returns error if provider doesn't support vision.
   */
  analyzeImage(request: VisionAnalysisRequest): Promise<Result<AnalysisSuggestion, OllamaError>>;

  /**
   * Check if a specific model supports vision.
   */
  supportsVision(modelId: string): boolean;
}

// =============================================================================
// Provider Configuration
// =============================================================================

/**
 * Base configuration shared by all providers.
 */
export const baseProviderConfigSchema = z.object({
  /** Request timeout in milliseconds */
  timeout: z.number().positive().default(30000),
  /** Model to use for text analysis */
  model: z.string().optional(),
  /** Model to use for vision analysis */
  visionModel: z.string().optional(),
});

export type BaseProviderConfig = z.infer<typeof baseProviderConfigSchema>;

/**
 * OpenAI-specific configuration.
 */
export const openaiConfigSchema = baseProviderConfigSchema.extend({
  /** OpenAI API key */
  apiKey: z.string().min(1),
  /** API base URL (for Azure OpenAI or proxies) */
  baseUrl: z.string().url().default('https://api.openai.com/v1'),
  /** Organization ID (optional) */
  organizationId: z.string().optional(),
});

export type OpenAiConfig = z.infer<typeof openaiConfigSchema>;

/**
 * Default OpenAI configuration.
 */
export const DEFAULT_OPENAI_CONFIG: Omit<OpenAiConfig, 'apiKey'> = {
  timeout: 30000,
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o-mini',
  visionModel: 'gpt-4o',
};

// =============================================================================
// Combined LLM Configuration
// =============================================================================

/**
 * Complete LLM configuration supporting multiple providers.
 */
export const llmConfigSchema = z.object({
  /** Whether LLM features are enabled */
  enabled: z.boolean().default(false),
  /** Which provider to use */
  provider: llmProviderTypeSchema.default('ollama'),
  /** OpenAI configuration (required if provider is 'openai') */
  openai: openaiConfigSchema.partial({ apiKey: true }).optional(),
});

export type LlmConfig = z.infer<typeof llmConfigSchema>;

/**
 * Default LLM configuration.
 */
export const DEFAULT_LLM_CONFIG: LlmConfig = {
  enabled: false,
  provider: 'ollama',
};
