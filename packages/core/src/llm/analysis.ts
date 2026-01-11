/**
 * @fileoverview LLM Content Analysis Types & Schemas - Story 10.2
 *
 * Provides types for:
 * - Analysis requests (file content for LLM processing)
 * - Analysis suggestions (naming recommendations from LLM)
 * - Extracted content (preprocessed file content)
 * - Analysis results (complete response with metadata)
 *
 * @module llm/analysis
 */

import { z } from 'zod';

// =============================================================================
// Content Extraction Types (AC1: Content Extraction)
// =============================================================================

/**
 * Extracted content from a file, ready for LLM processing.
 *
 * Content may be truncated to fit model context limits.
 */
export const extractedContentSchema = z.object({
  /** The extracted text content */
  content: z.string(),
  /** Whether content was truncated to fit limits */
  truncated: z.boolean(),
  /** Original content length in characters */
  originalLength: z.number().nonnegative(),
  /** Extracted content length after truncation */
  extractedLength: z.number().nonnegative(),
});

export type ExtractedContent = z.infer<typeof extractedContentSchema>;

/**
 * Create extracted content result.
 */
export function createExtractedContent(
  content: string,
  originalLength: number,
  truncated: boolean
): ExtractedContent {
  return {
    content,
    truncated,
    originalLength,
    extractedLength: content.length,
  };
}

// =============================================================================
// Analysis Request Types (AC2: LLM Generation Request)
// =============================================================================

/**
 * Request configuration for file content analysis.
 */
export const analysisRequestSchema = z.object({
  /** Path to the file being analyzed */
  filePath: z.string(),
  /** Extracted content to analyze */
  content: z.string(),
  /** File type/extension for context */
  fileType: z.string().optional(),
  /** Maximum tokens for LLM response */
  maxTokens: z.number().positive().default(256),
  /** Temperature for generation (lower = more deterministic) */
  temperature: z.number().min(0).max(2).default(0.3),
});

export type AnalysisRequest = z.infer<typeof analysisRequestSchema>;

/**
 * Create an analysis request with defaults.
 */
export function createAnalysisRequest(
  filePath: string,
  content: string,
  options?: Partial<Omit<AnalysisRequest, 'filePath' | 'content'>>
): AnalysisRequest {
  return analysisRequestSchema.parse({
    filePath,
    content,
    ...options,
  });
}

// =============================================================================
// Analysis Suggestion Types (AC3: Suggestion Structure)
// =============================================================================

/**
 * Structured suggestion from LLM analysis.
 *
 * This is what the LLM returns after analyzing file content.
 */
export const analysisSuggestionSchema = z.object({
  /** Suggested filename (without extension) */
  suggestedName: z.string().min(1),
  /** Confidence score 0-1 (1 = highest confidence) */
  confidence: z.number().min(0).max(1),
  /** Brief reasoning for the suggestion */
  reasoning: z.string(),
  /** Extracted keywords from content */
  keywords: z.array(z.string()).optional().default([]),
});

export type AnalysisSuggestion = z.infer<typeof analysisSuggestionSchema>;

/**
 * Validate and parse a raw LLM response into AnalysisSuggestion.
 *
 * Attempts multiple parsing strategies for robustness.
 *
 * @param rawResponse - Raw string response from LLM
 * @returns Parsed suggestion or null if parsing fails
 */
export function parseAnalysisSuggestion(rawResponse: string): AnalysisSuggestion | null {
  // Strategy 1: Direct JSON parse
  try {
    const parsed = JSON.parse(rawResponse);
    const result = analysisSuggestionSchema.safeParse(parsed);
    if (result.success) {
      return result.data;
    }
  } catch {
    // Continue to next strategy
  }

  // Strategy 2: Extract JSON from markdown code block
  const jsonBlockMatch = rawResponse.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (jsonBlockMatch && jsonBlockMatch[1]) {
    try {
      const parsed = JSON.parse(jsonBlockMatch[1].trim());
      const result = analysisSuggestionSchema.safeParse(parsed);
      if (result.success) {
        return result.data;
      }
    } catch {
      // Continue to next strategy
    }
  }

  // Strategy 3: Find JSON object anywhere in response
  const jsonMatch = rawResponse.match(/\{[\s\S]*"suggestedName"[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      const result = analysisSuggestionSchema.safeParse(parsed);
      if (result.success) {
        return result.data;
      }
    } catch {
      // Failed all strategies
    }
  }

  return null;
}

// =============================================================================
// Analysis Result Types (AC3: Complete Result)
// =============================================================================

/**
 * Source of analysis for a file.
 *
 * Story 10.6: Tracks how the analysis was performed.
 *
 * - `llm`: Full LLM text analysis
 * - `vision`: Vision model image analysis
 * - `metadata-only`: Used existing metadata (EXIF, document properties)
 * - `offline-fallback`: LLM was unavailable, used fallback
 */
export const analysisSourceSchema = z.enum(['llm', 'vision', 'metadata-only', 'offline-fallback']);
export type AnalysisSource = z.infer<typeof analysisSourceSchema>;

/**
 * Complete analysis result with metadata.
 *
 * Wraps the suggestion with processing information.
 * Story 10.6: Added analysisSource field.
 */
export const analysisResultSchema = z.object({
  /** Path of the analyzed file */
  filePath: z.string(),
  /** The naming suggestion */
  suggestion: analysisSuggestionSchema,
  /** Model that generated the suggestion */
  modelUsed: z.string(),
  /** Processing time in milliseconds */
  processingTimeMs: z.number().nonnegative(),
  /** Timestamp of analysis */
  analyzedAt: z.string().datetime(),
  /** Whether content was truncated */
  contentTruncated: z.boolean(),
  /** Source of analysis (Story 10.6) */
  analysisSource: analysisSourceSchema.optional().default('llm'),
});

export type AnalysisResult = z.infer<typeof analysisResultSchema>;

/**
 * Create a complete analysis result.
 *
 * Story 10.6: Added analysisSource parameter.
 */
export function createAnalysisResult(
  filePath: string,
  suggestion: AnalysisSuggestion,
  modelUsed: string,
  processingTimeMs: number,
  contentTruncated: boolean,
  analysisSource: AnalysisSource = 'llm'
): AnalysisResult {
  return {
    filePath,
    suggestion,
    modelUsed,
    processingTimeMs,
    analyzedAt: new Date().toISOString(),
    contentTruncated,
    analysisSource,
  };
}

// =============================================================================
// Batch Analysis Types (AC5: Batch Analysis)
// =============================================================================

/**
 * Progress callback for batch analysis.
 */
export type AnalysisProgressCallback = (
  current: number,
  total: number,
  currentFile: string
) => void;

/**
 * Options for batch analysis.
 */
export const batchAnalysisOptionsSchema = z.object({
  /** Maximum concurrent analyses (default: 1 for rate limiting) */
  concurrency: z.number().positive().default(1),
  /** Continue on individual failures */
  continueOnError: z.boolean().default(true),
});

export type BatchAnalysisOptions = z.infer<typeof batchAnalysisOptionsSchema>;

// =============================================================================
// Default Configuration
// =============================================================================

/**
 * Default maximum characters to extract from files.
 *
 * 4000 chars is roughly ~1000 tokens, leaving room for prompt.
 */
export const DEFAULT_MAX_CONTENT_CHARS = 4000;

/**
 * Default temperature for naming suggestions.
 *
 * Lower temperature = more deterministic/consistent.
 */
export const DEFAULT_ANALYSIS_TEMPERATURE = 0.3;

/**
 * Default max tokens for LLM response.
 */
export const DEFAULT_MAX_RESPONSE_TOKENS = 256;
