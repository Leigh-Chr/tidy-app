/**
 * @fileoverview Content Analyzer - Story 10.2
 *
 * Orchestrates file content extraction and LLM analysis
 * to generate intelligent naming suggestions.
 *
 * @module llm/analyzer
 */

import { ok, err, type Result } from '../types/result.js';
import { type OllamaConfig, type OllamaError, createOllamaError } from './types.js';
import { checkOllamaHealth } from './health.js';
import { extractTextContent } from './content-extractor.js';
import { generateCompletion } from './generate.js';
import {
  type AnalysisSuggestion,
  type AnalysisResult,
  type AnalysisProgressCallback,
  type BatchAnalysisOptions,
  createAnalysisResult,
  parseAnalysisSuggestion,
  batchAnalysisOptionsSchema,
  DEFAULT_ANALYSIS_TEMPERATURE,
  DEFAULT_MAX_RESPONSE_TOKENS,
  DEFAULT_MAX_CONTENT_CHARS,
} from './analysis.js';
import { shouldAnalyzeFile, type FilterResult } from './file-type-filter.js';
import { isImageFile } from './image-encoder.js';
import { analyzeImageWithVision } from './vision.js';
import {
  checkLlmAvailabilityForOperation,
  shouldProceedWithOperation,
  createOfflineFallbackResult,
  createBatchOfflineSummary,
  isConnectionError,
  type OfflineFallbackResult,
  type BatchOfflineSummary,
} from './offline.js';

// =============================================================================
// Prompt Templates
// =============================================================================

/**
 * System prompt for naming suggestions.
 */
const NAMING_SYSTEM_PROMPT = `You are a file naming assistant. Your job is to evaluate existing filenames and suggest improvements ONLY when beneficial.

CRITICAL RULE: The original filename often contains valuable information (dates, project codes, version numbers, identifiers). You MUST preserve these elements unless they are clearly wrong.

Guidelines:
- Use kebab-case (lowercase with hyphens)
- Be concise but descriptive (2-5 words)
- Include relevant dates if found (YYYY-MM-DD format at start)
- Omit file extension in suggestion
- Extract key themes, topics, or subjects
- For documents: focus on topic/purpose
- For code: focus on functionality/module name
- For data: focus on dataset description

IMPORTANT - When to keep the original name (set keepOriginal: true):
- The original name is already descriptive and meaningful
- The original contains important identifiers, codes, or references
- The content doesn't provide significantly better naming information
- Any improvement would lose important context from the original

When suggesting a new name:
- Merge relevant parts of the original with new insights from content
- Preserve dates, version numbers, project codes from the original
- Only change what genuinely improves clarity`;

/**
 * Create the analysis prompt for a file.
 */
function createAnalysisPrompt(content: string, fileType?: string, originalName?: string): string {
  const fileContext = fileType ? `File type: ${fileType}` : '';
  const nameContext = originalName ? `Current filename: "${originalName}"` : '';

  return `Evaluate whether this file needs renaming and suggest an improved name if beneficial.

${nameContext}
${fileContext}

Content:
---
${content}
---

Evaluate the current filename against the content. If the original name is already good, set keepOriginal to true and return the original name. Only suggest a different name if it would be a significant improvement.

Respond ONLY with valid JSON in this exact format (no other text):
{"suggestedName": "descriptive-name", "confidence": 0.85, "reasoning": "Brief explanation", "keywords": ["keyword1", "keyword2"], "keepOriginal": false}`;
}

// =============================================================================
// Single File Analysis
// =============================================================================

/**
 * Analyze a file's content and generate naming suggestion.
 *
 * This is the main entry point for analyzing a single file.
 * Story 10.5: Routes image files to vision analysis when enabled.
 *
 * @param filePath - Path to the file to analyze
 * @param config - Ollama configuration
 * @param options - Optional analysis parameters
 * @returns Analysis result with naming suggestion or error
 *
 * @example
 * ```typescript
 * const result = await analyzeFile('/path/to/document.txt', config);
 * if (result.ok) {
 *   console.log(`Suggested: ${result.data.suggestion.suggestedName}`);
 *   console.log(`Confidence: ${result.data.suggestion.confidence}`);
 * }
 * ```
 */
export async function analyzeFile(
  filePath: string,
  config: OllamaConfig,
  options?: {
    maxContentChars?: number;
    fileType?: string;
  }
): Promise<Result<AnalysisResult, OllamaError>> {
  const startTime = Date.now();
  const maxChars = options?.maxContentChars ?? DEFAULT_MAX_CONTENT_CHARS;

  // Story 10.5: Route image files to vision analysis when enabled
  if (config.visionEnabled && isImageFile(filePath)) {
    return analyzeImageWithVision(filePath, config);
  }

  // Text-based analysis for non-image files
  // Extract content from file
  const extractResult = await extractTextContent(filePath, { maxChars });
  if (!extractResult.ok) {
    return extractResult;
  }

  const { content, truncated } = extractResult.data;

  // Skip if no content
  if (content.trim().length === 0) {
    return err(createOllamaError(
      'CONTENT_EXTRACTION_FAILED',
      `File is empty or contains no extractable text: ${filePath}`
    ));
  }

  // Extract original filename (without extension) for the prompt
  const path = await import('path');
  const originalName = path.basename(filePath, path.extname(filePath));

  // Analyze the content
  const analyzeResult = await analyzeContent(content, config, {
    fileType: options?.fileType,
    originalName,
  });

  if (!analyzeResult.ok) {
    return analyzeResult;
  }

  const processingTime = Date.now() - startTime;
  const model = config.models?.inference ?? 'unknown';

  return ok(createAnalysisResult(
    filePath,
    analyzeResult.data,
    model,
    processingTime,
    truncated
  ));
}

/**
 * Analyze content string directly (for testing or pre-extracted content).
 *
 * @param content - Text content to analyze
 * @param config - Ollama configuration
 * @param options - Optional parameters
 * @returns Naming suggestion or error
 */
export async function analyzeContent(
  content: string,
  config: OllamaConfig,
  options?: {
    fileType?: string;
    originalName?: string;
  }
): Promise<Result<AnalysisSuggestion, OllamaError>> {
  // Get the model
  const model = config.models?.inference;
  if (!model) {
    return err(createOllamaError(
      'MODEL_NOT_FOUND',
      'No inference model configured. Set config.models.inference'
    ));
  }

  // Create the prompt
  const prompt = createAnalysisPrompt(content, options?.fileType, options?.originalName);

  // Generate completion
  const generateResult = await generateCompletion(config, {
    model,
    prompt,
    system: NAMING_SYSTEM_PROMPT,
    temperature: DEFAULT_ANALYSIS_TEMPERATURE,
    maxTokens: DEFAULT_MAX_RESPONSE_TOKENS,
  });

  if (!generateResult.ok) {
    return generateResult;
  }

  // Parse the response
  const suggestion = parseAnalysisSuggestion(generateResult.data.response);

  if (!suggestion) {
    return err(createOllamaError(
      'ANALYSIS_FAILED',
      `Failed to parse LLM response as naming suggestion. Raw response: ${generateResult.data.response.slice(0, 200)}`
    ));
  }

  return ok(suggestion);
}

// =============================================================================
// Batch Analysis
// =============================================================================

/**
 * Result of batch analysis with file type filtering.
 *
 * Story 10.4: Includes skipped files that didn't match file type configuration.
 * Story 10.6: Includes offline fallbacks and LLM status summary.
 */
export interface BatchAnalysisResult {
  /** Files that were analyzed with their results */
  analyzed: Map<string, Result<AnalysisResult, OllamaError>>;
  /** Files that were skipped due to file type filtering (Story 10.4) */
  skipped: Map<string, FilterResult>;
  /** Files that fell back to offline mode (Story 10.6) */
  offlineFallbacks: Map<string, OfflineFallbackResult>;
  /** Summary of batch processing with offline information (Story 10.6) */
  summary: BatchOfflineSummary;
}

/**
 * Progress callback for filtered batch analysis.
 *
 * Story 10.4: Enhanced to report skipped files.
 * Story 10.6: Enhanced to report offline fallback files.
 */
export type FilteredAnalysisProgressCallback = (
  current: number,
  total: number,
  file: string,
  status: 'analyzing' | 'skipped' | 'offline-fallback'
) => void;

/**
 * Analyze multiple files in batch with file type filtering.
 *
 * Story 10.4: Respects file type configuration to skip files
 * that don't match the configured extensions.
 *
 * Story 10.6: Adds offline fallback support. Performs a pre-operation
 * availability check and handles connection failures gracefully.
 * If LLM becomes unavailable mid-batch, remaining files fall back
 * to offline mode automatically.
 *
 * Processes files sequentially by default to respect rate limits.
 * Use progress callback to track progress.
 *
 * @param filePaths - Array of file paths to analyze
 * @param config - Ollama configuration (includes fileTypes)
 * @param options - Batch processing options
 * @returns Batch result with analyzed, skipped, and offline fallback files
 *
 * @example
 * ```typescript
 * const result = await analyzeFilesWithFilter(files, config, {
 *   onProgress: (current, total, file, status) => {
 *     if (status === 'skipped') {
 *       console.log(`Skipping ${file} (${current}/${total})`);
 *     } else if (status === 'offline-fallback') {
 *       console.log(`Offline fallback ${file} (${current}/${total})`);
 *     } else {
 *       console.log(`Analyzing ${file} (${current}/${total})`);
 *     }
 *   },
 * });
 *
 * console.log(`Analyzed: ${result.analyzed.size}, Skipped: ${result.skipped.size}`);
 * console.log(`LLM Status: ${result.summary.llmStatus}`);
 *
 * for (const [path, analysisResult] of result.analyzed) {
 *   if (analysisResult.ok) {
 *     console.log(`${path}: ${analysisResult.data.suggestion.suggestedName}`);
 *   }
 * }
 * ```
 */
export async function analyzeFilesWithFilter(
  filePaths: string[],
  config: OllamaConfig,
  options?: {
    onProgress?: FilteredAnalysisProgressCallback;
    batchOptions?: Partial<BatchAnalysisOptions>;
  }
): Promise<BatchAnalysisResult> {
  const batchOpts = batchAnalysisOptionsSchema.parse(options?.batchOptions ?? {});
  const analyzed = new Map<string, Result<AnalysisResult, OllamaError>>();
  const skipped = new Map<string, FilterResult>();
  const offlineFallbacks = new Map<string, OfflineFallbackResult>();
  const errors: string[] = [];

  // Story 10.6: Pre-operation availability check
  const availability = await checkLlmAvailabilityForOperation(config);
  const decision = shouldProceedWithOperation(config, availability);

  // If operation should not proceed, return early with all files as offline fallbacks
  if (!decision.proceed) {
    for (const filePath of filePaths) {
      offlineFallbacks.set(filePath, createOfflineFallbackResult(
        filePath,
        decision.message
      ));
    }
    errors.push(decision.message);
    return {
      analyzed,
      skipped,
      offlineFallbacks,
      summary: createBatchOfflineSummary(0, 0, filePaths.length, 0, errors),
    };
  }

  // Track whether LLM is currently available (may change mid-batch)
  let llmAvailable = !decision.useOfflineMode;
  let llmUnavailableReason = decision.useOfflineMode ? decision.message : '';

  // Counters for summary
  let llmAnalyzedCount = 0;
  let visionAnalyzedCount = 0;

  // Sequential processing by design: respects Ollama rate limits (concurrency=1 default)
  let i = 0;
  for (const filePath of filePaths) {
    i++;

    // Check if file should be analyzed based on file type configuration (Story 10.4)
    const filterResult = shouldAnalyzeFile(filePath, config.fileTypes);

    if (!filterResult.ok) {
      // Filter check failed unexpectedly - treat as error
      analyzed.set(filePath, err(createOllamaError(
        'CONTENT_EXTRACTION_FAILED',
        `File type filter check failed: ${filterResult.error.message}`
      )));
      options?.onProgress?.(i, filePaths.length, filePath, 'analyzing');
      continue;
    }

    if (!filterResult.data.shouldAnalyze) {
      // File filtered out - skip LLM analysis
      skipped.set(filePath, filterResult.data);
      options?.onProgress?.(i, filePaths.length, filePath, 'skipped');
      continue;
    }

    // Story 10.6: If LLM is unavailable, create offline fallback
    if (!llmAvailable) {
      offlineFallbacks.set(filePath, createOfflineFallbackResult(
        filePath,
        llmUnavailableReason || 'LLM unavailable'
      ));
      options?.onProgress?.(i, filePaths.length, filePath, 'offline-fallback');
      continue;
    }

    // Report progress for analysis
    options?.onProgress?.(i, filePaths.length, filePath, 'analyzing');

    // Proceed with LLM analysis
    const result = await analyzeFile(filePath, config);

    // Story 10.6: Detect LLM becoming unavailable mid-batch
    if (!result.ok && isConnectionError(result.error)) {
      // LLM became unavailable - switch to offline mode for remaining files
      llmAvailable = false;
      llmUnavailableReason = result.error.message;
      errors.push(`LLM became unavailable: ${result.error.message}`);

      // Add this file to offline fallbacks instead of analyzed
      offlineFallbacks.set(filePath, createOfflineFallbackResult(
        filePath,
        result.error.message
      ));
      continue;
    }

    analyzed.set(filePath, result);

    // Track successful analysis types for summary
    if (result.ok) {
      // Determine if this was a vision or text analysis
      // Vision analysis is used for images when visionEnabled is true
      if (config.visionEnabled && isImageFile(filePath)) {
        visionAnalyzedCount++;
      } else {
        llmAnalyzedCount++;
      }
    }

    // Stop on error if configured (but not for connection errors handled above)
    if (!result.ok && !batchOpts.continueOnError) {
      errors.push(result.error.message);
      break;
    }
  }

  // Create summary
  const summary = createBatchOfflineSummary(
    llmAnalyzedCount,
    visionAnalyzedCount,
    offlineFallbacks.size,
    skipped.size,
    errors
  );

  return { analyzed, skipped, offlineFallbacks, summary };
}

/**
 * Analyze multiple files in batch.
 *
 * Processes files sequentially by default to respect rate limits.
 * Use progress callback to track progress.
 *
 * Note: This function does NOT apply file type filtering. Use
 * `analyzeFilesWithFilter` for filtering support (Story 10.4).
 *
 * @param filePaths - Array of file paths to analyze
 * @param config - Ollama configuration
 * @param options - Batch processing options
 * @returns Map of file paths to their analysis results
 *
 * @example
 * ```typescript
 * const results = await analyzeFiles(files, config, {
 *   onProgress: (current, total, file) => {
 *     console.log(`Processing ${current}/${total}: ${file}`);
 *   },
 * });
 *
 * for (const [path, result] of results) {
 *   if (result.ok) {
 *     console.log(`${path}: ${result.data.suggestion.suggestedName}`);
 *   }
 * }
 * ```
 */
export async function analyzeFiles(
  filePaths: string[],
  config: OllamaConfig,
  options?: {
    onProgress?: AnalysisProgressCallback;
    batchOptions?: Partial<BatchAnalysisOptions>;
  }
): Promise<Map<string, Result<AnalysisResult, OllamaError>>> {
  const batchOpts = batchAnalysisOptionsSchema.parse(options?.batchOptions ?? {});
  const results = new Map<string, Result<AnalysisResult, OllamaError>>();

  // Sequential processing by design: respects Ollama rate limits (concurrency=1 default)
  let i = 0;
  for (const filePath of filePaths) {
    i++;

    // Report progress
    options?.onProgress?.(i, filePaths.length, filePath);

    // Analyze file
    const result = await analyzeFile(filePath, config);
    results.set(filePath, result);

    // Stop on error if configured
    if (!result.ok && !batchOpts.continueOnError) {
      break;
    }
  }

  return results;
}

// =============================================================================
// Availability Check
// =============================================================================

/**
 * Check if Ollama is available for analysis.
 *
 * @param config - Ollama configuration
 * @returns True if Ollama is available and has inference model
 */
export async function isAnalysisAvailable(
  config: OllamaConfig
): Promise<Result<boolean, OllamaError>> {
  // Check if enabled
  if (!config.enabled) {
    return ok(false);
  }

  // Check if model configured
  if (!config.models?.inference) {
    return ok(false);
  }

  // Check Ollama health
  const healthResult = await checkOllamaHealth(config);
  if (!healthResult.ok) {
    return healthResult;
  }

  return ok(healthResult.data.available);
}

/**
 * Get analysis availability with detailed status.
 *
 * @param config - Ollama configuration
 * @returns Detailed availability information
 */
export async function getAnalysisStatus(config: OllamaConfig): Promise<{
  available: boolean;
  reason?: string;
  model?: string;
}> {
  if (!config.enabled) {
    return { available: false, reason: 'LLM integration is disabled' };
  }

  const inferenceModel = config.models?.inference;
  if (!inferenceModel) {
    return { available: false, reason: 'No inference model configured' };
  }

  const healthResult = await checkOllamaHealth(config);
  if (!healthResult.ok) {
    return {
      available: false,
      reason: `Ollama connection failed: ${healthResult.error.message}`,
    };
  }

  if (!healthResult.data.available) {
    return { available: false, reason: 'Ollama is not responding' };
  }

  return {
    available: true,
    model: inferenceModel,
  };
}
