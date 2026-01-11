/**
 * @fileoverview Vision model analysis for images - Story 10.5
 *
 * Provides functionality for:
 * - Analyzing images using vision-capable Ollama models
 * - Detecting which models support vision capabilities
 * - Generating naming suggestions based on visual content
 *
 * @module llm/vision
 */

import { ok, err, type Result } from '../types/result.js';
import {
  type OllamaConfig,
  type OllamaError,
  type OllamaModel,
  createOllamaError,
} from './types.js';
import { encodeImageToBase64, isImageFile } from './image-encoder.js';
import {
  type AnalysisResult,
  createAnalysisResult,
  parseAnalysisSuggestion,
} from './analysis.js';

// =============================================================================
// Known Vision Models (Task 4.1)
// =============================================================================

/**
 * Known vision-capable models.
 *
 * These models support the `images` parameter in chat requests.
 * Not exhaustive - new vision models are added regularly to Ollama.
 */
export const KNOWN_VISION_MODELS = [
  'llava',
  'llava:7b',
  'llava:13b',
  'llava:34b',
  'llava-llama3',
  'llava-phi3',
  'gemma3',
  'gemma3:2b',
  'gemma3:4b',
  'bakllava',
  'moondream',
  'moondream2',
  'minicpm-v',
  'llama3.2-vision',
] as const;

export type KnownVisionModel = (typeof KNOWN_VISION_MODELS)[number];

// =============================================================================
// Vision Model Detection (Task 4.2, 4.3, 4.4)
// =============================================================================

/**
 * Check if a model name is known to support vision.
 *
 * Compares the base model name (before the colon) against known vision models.
 *
 * @param modelName - Model name to check (e.g., 'llava:latest')
 * @returns True if model is known to support vision
 */
export function isVisionCapableModel(modelName: string): boolean {
  if (!modelName) return false;

  const baseName = modelName.split(':')[0]?.toLowerCase() ?? '';

  return KNOWN_VISION_MODELS.some(known => {
    const knownBase = known.split(':')[0]?.toLowerCase() ?? '';
    return baseName === knownBase || baseName.startsWith(`${knownBase}-`);
  });
}

/**
 * Filter a list of models to only vision-capable ones.
 *
 * @param models - List of installed models
 * @returns Models that support vision
 */
export function detectVisionModels(models: OllamaModel[]): OllamaModel[] {
  return models.filter(model => isVisionCapableModel(model.name));
}

/**
 * Check if the configured vision model is available.
 *
 * @param config - Ollama configuration with vision model setting
 * @param installedModels - List of installed models
 * @returns The matching model or error
 */
export function checkVisionModelAvailable(
  config: OllamaConfig,
  installedModels: OllamaModel[]
): Result<OllamaModel, OllamaError> {
  const visionModelName = config.models?.vision;

  if (!visionModelName) {
    return err(
      createOllamaError('MODEL_NOT_FOUND', 'No vision model configured. Set config.models.vision')
    );
  }

  // Check if it's a known vision model
  if (!isVisionCapableModel(visionModelName)) {
    return err(
      createOllamaError(
        'MODEL_NOT_FOUND',
        `'${visionModelName}' is not a known vision-capable model. Vision models include: llava, gemma3, bakllava, moondream`
      )
    );
  }

  // Find the model in installed models
  const modelBase = visionModelName.split(':')[0]?.toLowerCase() ?? '';
  const installedModel = installedModels.find(m => {
    const installedBase = m.name.split(':')[0]?.toLowerCase() ?? '';
    return installedBase === modelBase || m.name.toLowerCase() === visionModelName.toLowerCase();
  });

  if (!installedModel) {
    return err(
      createOllamaError(
        'MODEL_NOT_FOUND',
        `Vision model '${visionModelName}' not found. Run 'ollama pull ${visionModelName}'`
      )
    );
  }

  return ok(installedModel);
}

// =============================================================================
// Vision Analysis Prompts (Task 3.5)
// =============================================================================

/**
 * System prompt for vision-based naming suggestions.
 */
export const VISION_NAMING_SYSTEM_PROMPT = `You are a file naming assistant analyzing images. Your job is to evaluate existing filenames and suggest improvements ONLY when beneficial.

CRITICAL RULE: The original filename often contains valuable information (dates, project codes, camera identifiers). You MUST preserve these elements unless they are clearly wrong.

Guidelines:
- Use kebab-case (lowercase with hyphens)
- Be concise but descriptive (2-5 words)
- Identify the main subject(s) in the image
- Include relevant context (location, event type, activity)
- If text is visible, consider incorporating key words
- For photos of people: describe setting/activity, not individuals
- For documents/screenshots: focus on document type/topic
- For artwork: describe style or subject matter
- Omit file extension in suggestion

IMPORTANT - When to keep the original name (set keepOriginal: true):
- The original name already describes the image content well
- The original contains important identifiers, dates, or codes
- The image content doesn't provide significantly better naming information
- Any improvement would lose important context from the original

When suggesting a new name:
- Merge relevant parts of the original with visual insights
- Preserve dates, identifiers, or codes from the original
- Only change what genuinely improves clarity`;

/**
 * Create the vision analysis prompt.
 */
function createVisionPrompt(originalName: string): string {
  return `Evaluate this image and decide if the current filename needs improvement.

Current filename: "${originalName}"

If the current filename is already descriptive and meaningful (contains relevant subject, date, or context), set keepOriginal to true. Only suggest a new name if it would be a significant improvement.

Preserve any dates, identifiers, or codes from the original filename if they appear relevant.

Respond ONLY with valid JSON in this exact format (no other text):
{"suggestedName": "descriptive-name", "confidence": 0.85, "reasoning": "Brief explanation of what you see", "keywords": ["keyword1", "keyword2"], "keepOriginal": false}`;
}

// =============================================================================
// Vision Analysis (Task 3.2, 3.3, 3.4, 3.6, 3.7)
// =============================================================================

/**
 * Analyze an image using a vision-capable model.
 *
 * Uses the /api/chat endpoint with base64-encoded image to get
 * naming suggestions based on visual content.
 *
 * @param imagePath - Path to the image file
 * @param config - Ollama configuration with vision model set
 * @returns Analysis result with naming suggestion or error
 *
 * @example
 * ```typescript
 * const result = await analyzeImageWithVision('/path/to/photo.jpg', config);
 * if (result.ok) {
 *   console.log(result.data.suggestion.suggestedName);
 * }
 * ```
 */
export async function analyzeImageWithVision(
  imagePath: string,
  config: OllamaConfig
): Promise<Result<AnalysisResult, OllamaError>> {
  const startTime = Date.now();

  // Validate vision model is configured
  const visionModel = config.models?.vision;
  if (!visionModel) {
    return err(createOllamaError('MODEL_NOT_FOUND', 'No vision model configured. Set config.models.vision'));
  }

  // Validate file is an image
  if (!isImageFile(imagePath)) {
    return err(
      createOllamaError('CONTENT_EXTRACTION_FAILED', `File is not a supported image format: ${imagePath}`)
    );
  }

  // Encode image to base64
  const encodeResult = await encodeImageToBase64(imagePath, config.maxImageSize);
  if (!encodeResult.ok) {
    return encodeResult;
  }

  // Extract original filename (without extension) for the prompt
  const path = await import('path');
  const originalName = path.basename(imagePath, path.extname(imagePath));

  // Build chat request with image
  const requestBody = {
    model: visionModel,
    messages: [
      {
        role: 'system',
        content: VISION_NAMING_SYSTEM_PROMPT,
      },
      {
        role: 'user',
        content: createVisionPrompt(originalName),
        images: [encodeResult.data],
      },
    ],
    stream: false,
    options: {
      temperature: 0.3,
      num_predict: 256,
    },
  };

  // Vision requests take longer - use 2x timeout
  const visionTimeout = config.timeout * 2;

  try {
    const response = await fetchWithTimeout(
      `${config.baseUrl}/api/chat`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      },
      visionTimeout
    );

    if (!response.ok) {
      if (response.status === 404) {
        return err(
          createOllamaError(
            'MODEL_NOT_FOUND',
            `Vision model '${visionModel}' not found. Run 'ollama pull ${visionModel}'`
          )
        );
      }
      return err(createOllamaError('CONNECTION_FAILED', `Vision API returned status ${response.status}`));
    }

    const data = await response.json();
    const content = data.message?.content;

    if (!content) {
      return err(createOllamaError('INVALID_RESPONSE', 'Vision model returned empty response'));
    }

    // Parse the suggestion
    const suggestion = parseAnalysisSuggestion(content);
    if (!suggestion) {
      return err(
        createOllamaError('ANALYSIS_FAILED', `Failed to parse vision response: ${content.slice(0, 200)}`)
      );
    }

    const processingTime = Date.now() - startTime;

    return ok(
      createAnalysisResult(
        imagePath,
        suggestion,
        visionModel,
        processingTime,
        false, // truncated - N/A for vision
        'vision' // Story 10.6: Mark as vision analysis
      )
    );
  } catch (error) {
    return err(categorizeVisionError(error, visionTimeout));
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Fetch with timeout support.
 */
async function fetchWithTimeout(url: string, init: RequestInit, timeout: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Categorize vision-specific errors.
 */
function categorizeVisionError(error: unknown, timeout: number): OllamaError {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return createOllamaError(
      'TIMEOUT',
      `Vision analysis timed out after ${timeout}ms. Try a smaller image or increase timeout.`,
      error
    );
  }

  if (error instanceof TypeError) {
    const message = error.message.toLowerCase();
    if (message.includes('fetch failed') || message.includes('network')) {
      return createOllamaError('CONNECTION_FAILED', 'Failed to connect to Ollama. Is it running?', error);
    }
  }

  if (error instanceof Error) {
    return createOllamaError('CONNECTION_FAILED', `Vision analysis failed: ${error.message}`, error);
  }

  return createOllamaError('CONNECTION_FAILED', 'Unknown error during vision analysis', error);
}
