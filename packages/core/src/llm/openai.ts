/**
 * @fileoverview OpenAI Provider Implementation
 *
 * Provides LLM functionality via OpenAI's API:
 * - GPT-4o, GPT-4o-mini for text analysis
 * - GPT-4o for vision analysis
 *
 * @module llm/openai
 */

import { ok, err, type Result } from '../types/result.js';
import {
  type HealthStatus,
  type OllamaError,
  createOllamaError,
  createAvailableHealthStatus,
  createUnavailableHealthStatus,
} from './types.js';
import { type AnalysisSuggestion, parseAnalysisSuggestion } from './analysis.js';
import {
  type LlmProvider,
  type ProviderModel,
  type AnalysisRequest,
  type VisionAnalysisRequest,
  type OpenAiConfig,
  DEFAULT_OPENAI_CONFIG,
} from './provider.js';

// =============================================================================
// OpenAI API Types
// =============================================================================

interface OpenAiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | OpenAiContentPart[];
}

interface OpenAiContentPart {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: {
    url: string;
    detail?: 'low' | 'high' | 'auto';
  };
}

interface OpenAiChatRequest {
  model: string;
  messages: OpenAiMessage[];
  temperature?: number;
  max_tokens?: number;
}

interface OpenAiChatResponse {
  id: string;
  choices: Array<{
    message: {
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface OpenAiModelsResponse {
  data: Array<{
    id: string;
    owned_by: string;
  }>;
}

interface OpenAiErrorResponse {
  error: {
    message: string;
    type: string;
    code?: string;
  };
}

// =============================================================================
// Constants
// =============================================================================

/**
 * OpenAI models that support vision.
 */
const VISION_MODELS = ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4-vision-preview'];

/**
 * Default models to show in the UI.
 */
const RECOMMENDED_MODELS: ProviderModel[] = [
  { id: 'gpt-4o', name: 'GPT-4o', supportsVision: true },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', supportsVision: true },
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', supportsVision: true },
  { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', supportsVision: false },
];

/**
 * System prompt for naming suggestions.
 */
const NAMING_SYSTEM_PROMPT = `You are a file naming assistant. Your job is to suggest descriptive filenames based on content analysis.

Guidelines:
- Use kebab-case (lowercase with hyphens)
- Be concise but descriptive (2-5 words)
- Include relevant dates if found (YYYY-MM-DD format at start)
- Omit file extension in suggestion
- Extract key themes, topics, or subjects
- For documents: focus on topic/purpose
- For code: focus on functionality/module name
- For data: focus on dataset description

Respond ONLY with valid JSON in this exact format (no other text):
{"suggestedName": "descriptive-name", "confidence": 0.85, "reasoning": "Brief explanation", "keywords": ["keyword1", "keyword2"]}`;

/**
 * System prompt for vision analysis.
 */
const VISION_SYSTEM_PROMPT = `You are a file naming assistant analyzing images. Suggest descriptive filenames based on image content.

Guidelines:
- Use kebab-case (lowercase with hyphens)
- Be concise but descriptive (2-5 words)
- For photos: describe subject, location, or event
- For screenshots: describe content or application
- For diagrams: describe topic or purpose
- For artwork: describe style and subject

Respond ONLY with valid JSON in this exact format (no other text):
{"suggestedName": "descriptive-name", "confidence": 0.85, "reasoning": "Brief explanation", "keywords": ["keyword1", "keyword2"]}`;

// =============================================================================
// OpenAI Provider
// =============================================================================

/**
 * Create an OpenAI provider instance.
 */
export function createOpenAiProvider(config: OpenAiConfig): LlmProvider {
  const baseUrl = config.baseUrl || DEFAULT_OPENAI_CONFIG.baseUrl;
  const timeout = config.timeout || DEFAULT_OPENAI_CONFIG.timeout;

  /**
   * Make an authenticated request to OpenAI API.
   */
  async function fetchApi<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<Result<T, OllamaError>> {
    const url = `${baseUrl}${endpoint}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
          ...(config.organizationId && { 'OpenAI-Organization': config.organizationId }),
          ...options.headers,
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({}))) as OpenAiErrorResponse;
        const message = errorData.error?.message || `HTTP ${response.status}`;

        if (response.status === 401) {
          return err(createOllamaError('CONNECTION_FAILED', 'Invalid API key'));
        }
        if (response.status === 429) {
          return err(createOllamaError('TIMEOUT', 'Rate limit exceeded. Please try again later.'));
        }
        if (response.status === 404) {
          return err(createOllamaError('MODEL_NOT_FOUND', message));
        }

        return err(createOllamaError('INVALID_RESPONSE', message));
      }

      const data = (await response.json()) as T;
      return ok(data);
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          return err(createOllamaError('TIMEOUT', 'Request timed out'));
        }
        if (error.message.includes('fetch')) {
          return err(createOllamaError('CONNECTION_FAILED', 'Cannot connect to OpenAI API'));
        }
        return err(createOllamaError('CONNECTION_FAILED', error.message));
      }

      return err(createOllamaError('CONNECTION_FAILED', 'Unknown error'));
    }
  }

  return {
    type: 'openai',
    displayName: 'OpenAI',

    async checkHealth(): Promise<Result<HealthStatus, OllamaError>> {
      // Try to list models to verify API key works
      const result = await fetchApi<OpenAiModelsResponse>('/models');

      if (!result.ok) {
        return ok(createUnavailableHealthStatus());
      }

      const modelCount = result.data.data.length;
      return ok(createAvailableHealthStatus(modelCount));
    },

    async listModels(): Promise<Result<ProviderModel[], OllamaError>> {
      // For OpenAI, we return recommended models rather than all available
      // (OpenAI has many fine-tuned models that aren't useful here)
      return ok(RECOMMENDED_MODELS);
    },

    async analyzeContent(request: AnalysisRequest): Promise<Result<AnalysisSuggestion, OllamaError>> {
      const model = config.model || DEFAULT_OPENAI_CONFIG.model!;
      const systemPrompt = request.systemPrompt || NAMING_SYSTEM_PROMPT;

      const fileContext = request.fileType ? ` (file type: ${request.fileType})` : '';
      const userPrompt = `Analyze the following file content${fileContext} and suggest a descriptive filename.\n\nContent:\n---\n${request.content}\n---`;

      const chatRequest: OpenAiChatRequest = {
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: request.temperature ?? 0.3,
        max_tokens: request.maxTokens ?? 256,
      };

      const result = await fetchApi<OpenAiChatResponse>('/chat/completions', {
        method: 'POST',
        body: JSON.stringify(chatRequest),
      });

      if (!result.ok) {
        return err(result.error);
      }

      const content = result.data.choices[0]?.message?.content;
      if (!content) {
        return err(createOllamaError('INVALID_RESPONSE', 'Empty response from OpenAI'));
      }

      const suggestion = parseAnalysisSuggestion(content);
      if (!suggestion) {
        return err(createOllamaError('ANALYSIS_FAILED', 'Failed to parse analysis response'));
      }

      return ok(suggestion);
    },

    async analyzeImage(request: VisionAnalysisRequest): Promise<Result<AnalysisSuggestion, OllamaError>> {
      const model = config.visionModel || DEFAULT_OPENAI_CONFIG.visionModel!;

      if (!VISION_MODELS.some((m) => model.includes(m))) {
        return err(createOllamaError('MODEL_NOT_FOUND', `Model ${model} does not support vision`));
      }

      const userContent: OpenAiContentPart[] = [
        {
          type: 'image_url',
          image_url: {
            url: `data:${request.mimeType};base64,${request.imageBase64}`,
            detail: 'low', // Use low detail for faster/cheaper analysis
          },
        },
        {
          type: 'text',
          text: request.prompt || 'Analyze this image and suggest a descriptive filename.',
        },
      ];

      const chatRequest: OpenAiChatRequest = {
        model,
        messages: [
          { role: 'system', content: VISION_SYSTEM_PROMPT },
          { role: 'user', content: userContent },
        ],
        temperature: request.temperature ?? 0.3,
        max_tokens: request.maxTokens ?? 256,
      };

      const result = await fetchApi<OpenAiChatResponse>('/chat/completions', {
        method: 'POST',
        body: JSON.stringify(chatRequest),
      });

      if (!result.ok) {
        return err(result.error);
      }

      const content = result.data.choices[0]?.message?.content;
      if (!content) {
        return err(createOllamaError('INVALID_RESPONSE', 'Empty response from OpenAI'));
      }

      const suggestion = parseAnalysisSuggestion(content);
      if (!suggestion) {
        return err(createOllamaError('ANALYSIS_FAILED', 'Failed to parse vision analysis response'));
      }

      return ok(suggestion);
    },

    supportsVision(modelId: string): boolean {
      return VISION_MODELS.some((m) => modelId.includes(m));
    },
  };
}

/**
 * Check if an OpenAI API key is valid format.
 */
export function isValidOpenAiKey(key: string): boolean {
  // OpenAI keys start with sk- and are 51 characters
  // Project keys start with sk-proj- and are longer
  return /^sk-[a-zA-Z0-9]{32,}$/.test(key) || /^sk-proj-[a-zA-Z0-9-_]{32,}$/.test(key);
}

/**
 * Mask an API key for display.
 */
export function maskApiKey(key: string): string {
  if (key.length <= 8) return '••••••••';
  return `${key.slice(0, 7)}...${key.slice(-4)}`;
}
