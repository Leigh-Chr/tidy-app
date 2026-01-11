/**
 * @fileoverview Image encoding for vision model analysis - Story 10.5
 *
 * Provides utilities for:
 * - Encoding images to base64 for vision API
 * - Detecting image files by extension
 * - Validating image size for API limits
 *
 * @module llm/image-encoder
 */

import { readFile } from 'node:fs/promises';
import { ok, err, type Result } from '../types/result.js';
import { type OllamaError, createOllamaError } from './types.js';

// =============================================================================
// Constants
// =============================================================================

/**
 * Supported image extensions for vision analysis.
 *
 * These are common image formats supported by Ollama vision models.
 */
export const VISION_SUPPORTED_EXTENSIONS = [
  'jpg',
  'jpeg',
  'png',
  'gif',
  'webp',
  'heic',
] as const;

export type VisionSupportedExtension = (typeof VISION_SUPPORTED_EXTENSIONS)[number];

/**
 * Default maximum image size in bytes (20MB).
 *
 * Vision models have limits on image size. This default is conservative
 * to prevent memory issues and timeouts.
 */
export const DEFAULT_MAX_IMAGE_SIZE = 20 * 1024 * 1024;

// =============================================================================
// Extension Utilities
// =============================================================================

/**
 * Extract the file extension from a path, lowercase.
 *
 * @param filePath - Path to the file
 * @returns Lowercase extension without dot, or undefined if none
 */
export function getImageExtension(filePath: string): string | undefined {
  if (!filePath) return undefined;

  const lastDot = filePath.lastIndexOf('.');
  const lastSlash = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));

  // No extension if no dot, or dot is before last path separator
  if (lastDot === -1 || lastDot < lastSlash) {
    return undefined;
  }

  const ext = filePath.slice(lastDot + 1);
  return ext.length > 0 ? ext.toLowerCase() : undefined;
}

/**
 * Check if a file is an image based on extension.
 *
 * @param filePath - Path to the file
 * @returns True if the file has a supported image extension
 */
export function isImageFile(filePath: string): boolean {
  const ext = getImageExtension(filePath);
  if (!ext) return false;

  return (VISION_SUPPORTED_EXTENSIONS as readonly string[]).includes(ext);
}

// =============================================================================
// Image Encoding
// =============================================================================

/**
 * Encode an image file to base64 for vision API.
 *
 * Reads the image file and converts it to a base64 string suitable for
 * inclusion in Ollama vision API requests.
 *
 * @param filePath - Path to the image file
 * @param maxSize - Maximum file size in bytes (default: 20MB)
 * @returns Base64-encoded image string or error
 *
 * @example
 * ```typescript
 * const result = await encodeImageToBase64('/path/to/photo.jpg');
 * if (result.ok) {
 *   // Use result.data in vision API request
 * }
 * ```
 */
export async function encodeImageToBase64(
  filePath: string,
  maxSize: number = DEFAULT_MAX_IMAGE_SIZE
): Promise<Result<string, OllamaError>> {
  try {
    const buffer = await readFile(filePath);

    if (buffer.length > maxSize) {
      const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(1);
      return err(
        createOllamaError(
          'CONTENT_EXTRACTION_FAILED',
          `Image file exceeds maximum size (${maxSizeMB}MB): ${filePath}`
        )
      );
    }

    const base64 = buffer.toString('base64');
    return ok(base64);
  } catch (error) {
    return err(
      createOllamaError('CONTENT_EXTRACTION_FAILED', `Failed to read image file: ${filePath}`, error)
    );
  }
}
