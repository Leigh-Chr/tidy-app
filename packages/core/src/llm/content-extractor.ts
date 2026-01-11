/**
 * @fileoverview File Content Extractor - Story 10.2
 *
 * Extracts text content from files for LLM analysis.
 * Handles truncation to fit model context limits.
 *
 * @module llm/content-extractor
 */

import { readFile } from 'node:fs/promises';
import { ok, err, type Result } from '../types/result.js';
import { type OllamaError, createOllamaError } from './types.js';
import {
  type ExtractedContent,
  createExtractedContent,
  DEFAULT_MAX_CONTENT_CHARS,
} from './analysis.js';

// =============================================================================
// Extraction Options
// =============================================================================

/**
 * Options for content extraction.
 */
export interface ExtractOptions {
  /** Maximum characters to extract (default: 4000) */
  maxChars?: number;
  /** File encoding (default: utf-8) */
  encoding?: BufferEncoding;
}

const DEFAULT_EXTRACT_OPTIONS: Required<ExtractOptions> = {
  maxChars: DEFAULT_MAX_CONTENT_CHARS,
  encoding: 'utf-8',
};

// =============================================================================
// Text Extraction
// =============================================================================

/**
 * Extract text content from a file.
 *
 * Reads the file and truncates if necessary to fit within maxChars.
 * Currently supports plain text files. PDF/Office support deferred.
 *
 * @param filePath - Absolute path to the file
 * @param options - Extraction options
 * @returns Result containing extracted content or error
 *
 * @example
 * ```typescript
 * const result = await extractTextContent('/path/to/file.txt');
 * if (result.ok) {
 *   console.log(`Extracted ${result.data.extractedLength} chars`);
 *   console.log(`Truncated: ${result.data.truncated}`);
 * }
 * ```
 */
export async function extractTextContent(
  filePath: string,
  options: ExtractOptions = {}
): Promise<Result<ExtractedContent, OllamaError>> {
  const opts = { ...DEFAULT_EXTRACT_OPTIONS, ...options };

  try {
    const content = await readFile(filePath, { encoding: opts.encoding });
    const originalLength = content.length;

    if (originalLength <= opts.maxChars) {
      return ok(createExtractedContent(content, originalLength, false));
    }

    // Truncate content intelligently
    const truncated = truncateContent(content, opts.maxChars);
    return ok(createExtractedContent(truncated, originalLength, true));
  } catch (error) {
    return err(categorizeExtractionError(error, filePath));
  }
}

/**
 * Extract content from a string (for testing or when content is already loaded).
 *
 * @param content - The text content
 * @param filePath - Path for metadata (used in result)
 * @param options - Extraction options
 * @returns Extracted content result
 */
export function extractFromString(
  content: string,
  options: ExtractOptions = {}
): ExtractedContent {
  const maxChars = options.maxChars ?? DEFAULT_MAX_CONTENT_CHARS;
  const originalLength = content.length;

  if (originalLength <= maxChars) {
    return createExtractedContent(content, originalLength, false);
  }

  const truncated = truncateContent(content, maxChars);
  return createExtractedContent(truncated, originalLength, true);
}

// =============================================================================
// Truncation Logic
// =============================================================================

/**
 * Truncate content intelligently.
 *
 * Attempts to break at word/sentence boundaries when possible.
 * Adds truncation indicator when content is cut.
 *
 * @param content - Full content string
 * @param maxChars - Maximum characters to keep
 * @returns Truncated content
 */
function truncateContent(content: string, maxChars: number): string {
  // Reserve space for truncation indicator
  const indicator = '\n\n[... content truncated ...]';
  const targetLength = maxChars - indicator.length;

  if (targetLength <= 0) {
    return indicator;
  }

  // Take first portion
  let truncated = content.slice(0, targetLength);

  // Try to break at a sentence boundary
  const lastPeriod = truncated.lastIndexOf('. ');
  const lastNewline = truncated.lastIndexOf('\n');
  const breakPoint = Math.max(lastPeriod, lastNewline);

  // Only use break point if it's not too far back (within 20% of target)
  const minBreakPoint = targetLength * 0.8;
  if (breakPoint > minBreakPoint) {
    truncated = truncated.slice(0, breakPoint + 1);
  }

  return truncated.trimEnd() + indicator;
}

// =============================================================================
// Error Handling
// =============================================================================

/**
 * Categorize file read errors into OllamaError.
 */
function categorizeExtractionError(error: unknown, filePath: string): OllamaError {
  if (error instanceof Error) {
    const code = (error as NodeJS.ErrnoException).code;

    if (code === 'ENOENT') {
      return createOllamaError(
        'CONTENT_EXTRACTION_FAILED',
        `File not found: ${filePath}`,
        error
      );
    }

    if (code === 'EACCES') {
      return createOllamaError(
        'CONTENT_EXTRACTION_FAILED',
        `Permission denied: ${filePath}`,
        error
      );
    }

    if (code === 'EISDIR') {
      return createOllamaError(
        'CONTENT_EXTRACTION_FAILED',
        `Path is a directory: ${filePath}`,
        error
      );
    }

    return createOllamaError(
      'CONTENT_EXTRACTION_FAILED',
      `Failed to read file: ${error.message}`,
      error
    );
  }

  return createOllamaError(
    'CONTENT_EXTRACTION_FAILED',
    'Unknown error reading file',
    error
  );
}

// =============================================================================
// File Type Support
// =============================================================================

/**
 * Supported file extensions for text extraction.
 */
export const SUPPORTED_TEXT_EXTENSIONS = new Set([
  '.txt',
  '.md',
  '.markdown',
  '.json',
  '.yaml',
  '.yml',
  '.xml',
  '.csv',
  '.log',
  '.js',
  '.ts',
  '.jsx',
  '.tsx',
  '.py',
  '.rb',
  '.rs',
  '.go',
  '.java',
  '.c',
  '.cpp',
  '.h',
  '.hpp',
  '.css',
  '.scss',
  '.html',
  '.htm',
  '.sh',
  '.bash',
  '.zsh',
  '.ps1',
  '.sql',
  '.env',
  '.gitignore',
  '.dockerfile',
]);

/**
 * Check if a file extension is supported for text extraction.
 *
 * @param extension - File extension (with or without dot)
 * @returns True if supported
 */
export function isTextExtractable(extension: string): boolean {
  const ext = extension.startsWith('.') ? extension.toLowerCase() : `.${extension.toLowerCase()}`;
  return SUPPORTED_TEXT_EXTENSIONS.has(ext);
}
