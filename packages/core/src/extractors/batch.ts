import type { FileInfo } from '../types/file-info.js';
import type { UnifiedMetadata } from '../types/unified-metadata.js';
import type { ExtractionError } from '../types/extraction-error.js';
import type { Result } from '../types/result.js';
import type { Logger } from '../utils/logger.js';
import type { RetryOptions } from '../utils/retry.js';
import {
  ExtractionErrorCode,
  createExtractionError,
  inferErrorCode,
} from '../types/extraction-error.js';
import { getFileMetadata } from './unified.js';
import { withRetry, isTransientError } from '../utils/retry.js';

/**
 * Internal type for Promise.allSettled results.
 */
interface FileMetadataResult {
  file: FileInfo;
  result: Result<UnifiedMetadata>;
}

/**
 * Result of batch metadata extraction.
 */
export interface BatchExtractionResult {
  /** Successfully extracted metadata */
  successful: UnifiedMetadata[];
  /** Files that failed extraction with error details */
  failed: ExtractionError[];
  /** Total number of files processed */
  totalProcessed: number;
  /** Count of successful extractions */
  successCount: number;
  /** Count of failed extractions */
  failureCount: number;
}

/**
 * Progress callback signature.
 * @param processed - Number of files processed so far
 * @param total - Total number of files to process
 * @param current - Current file being processed
 */
export type BatchProgressCallback = (
  processed: number,
  total: number,
  current: FileInfo
) => void;

/**
 * Error callback signature.
 * @param error - The extraction error that occurred
 */
export type BatchErrorCallback = (error: ExtractionError) => void;

/**
 * Options for batch extraction.
 */
export interface BatchExtractionOptions {
  /** Maximum concurrent extractions (default: 5) */
  concurrency?: number;
  /** Progress callback */
  onProgress?: BatchProgressCallback;
  /** Error callback (called for each failure) */
  onError?: BatchErrorCallback;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
  /** Logger for automatic error logging (logs file path, error type, and suggestion) */
  logger?: Logger;
  /**
   * Retry options for transient errors (EBUSY, EMFILE, etc.).
   * Set to enable automatic retries on transient failures.
   * Default: no retries
   */
  retryOptions?: Pick<RetryOptions, 'maxRetries' | 'initialDelay' | 'maxDelay'>;
}

/**
 * Extract metadata from multiple files in batch with controlled concurrency.
 *
 * Processes files in chunks, collecting successes and failures separately.
 * Continues processing even when individual files fail, ensuring robust
 * batch operations.
 *
 * @param files - Array of FileInfo objects to process
 * @param options - Batch extraction options
 * @returns Batch extraction result with successful and failed extractions
 *
 * @example
 * ```typescript
 * const result = await extractBatch(files, {
 *   concurrency: 5,
 *   onProgress: (processed, total) => {
 *     console.log(`Processing ${processed}/${total}`);
 *   },
 *   onError: (error) => {
 *     logger.warn(`Failed: ${error.filePath} - ${error.message}`);
 *   },
 * });
 *
 * console.log(`Success: ${result.successCount}, Failed: ${result.failureCount}`);
 * ```
 */
export async function extractBatch(
  files: FileInfo[],
  options: BatchExtractionOptions = {}
): Promise<BatchExtractionResult> {
  const { concurrency = 5, onProgress, onError, signal, logger, retryOptions } =
    options;

  const successful: UnifiedMetadata[] = [];
  const failed: ExtractionError[] = [];

  // Helper to log and report errors
  const reportError = (error: ExtractionError): void => {
    // Log with full context per AC3
    logger?.warn(`Extraction failed: ${error.filePath}`, {
      code: error.code,
      message: error.message,
      suggestion: error.suggestion,
    });
    onError?.(error);
  };

  // Helper to extract with optional retry
  const extractWithRetry = async (
    file: FileInfo
  ): Promise<Result<UnifiedMetadata>> => {
    if (retryOptions) {
      const retryResult = await withRetry(
        async () => {
          const result = await getFileMetadata(file);
          if (!result.ok) {
            throw result.error;
          }
          return result.data;
        },
        {
          ...retryOptions,
          shouldRetry: isTransientError,
          signal,
          onRetry: (error, attempt, delay) => {
            logger?.debug(`Retry ${String(attempt)} for ${file.path} after ${String(delay)}ms`, {
              error: error.message,
            });
          },
        }
      );

      if (retryResult.ok) {
        return { ok: true, data: retryResult.data };
      }
      return { ok: false, error: retryResult.error };
    }

    return getFileMetadata(file);
  };

  // Process files in chunks for controlled concurrency
  for (let i = 0; i < files.length; i += concurrency) {
    // Check for abort signal
    if (signal?.aborted) {
      break;
    }

    const chunk = files.slice(i, i + concurrency);
    const results = await Promise.allSettled(
      chunk.map(async (file) => {
        // Check abort before each extraction
        if (signal?.aborted) {
          throw new Error('Aborted');
        }
        const result = await extractWithRetry(file);
        return { file, result };
      })
    );

    // Process results
    for (let j = 0; j < results.length; j++) {
      const settledResult = results[j];
      const file = chunk[j];
      const processed = i + j + 1;

      // Skip if somehow undefined (shouldn't happen, but TypeScript requires check)
      if (!settledResult || !file) {
        continue;
      }

      // Call progress callback
      onProgress?.(processed, files.length, file);

      if (settledResult.status === 'fulfilled') {
        const fulfilledResult =
          settledResult as PromiseFulfilledResult<FileMetadataResult>;
        const { result } = fulfilledResult.value;
        if (result.ok) {
          // Check if extraction actually succeeded or just returned gracefully
          if (result.data.extractionStatus === 'failed') {
            const error = createExtractionError(
              ExtractionErrorCode.EXTRACTION_FAILED,
              file.path,
              result.data.extractionError
                ? new Error(result.data.extractionError)
                : undefined
            );
            failed.push(error);
            reportError(error);
          } else {
            successful.push(result.data);
          }
        } else {
          // Result.ok is false (shouldn't happen with getFileMetadata, but handle it)
          const error = createExtractionError(
            inferErrorCode(result.error),
            file.path,
            result.error
          );
          failed.push(error);
          reportError(error);
        }
      } else {
        // Promise was rejected (unexpected error)
        const reason =
          settledResult.reason instanceof Error
            ? settledResult.reason
            : new Error(String(settledResult.reason));

        // Don't report abort as an error
        if (reason.message !== 'Aborted') {
          const error = createExtractionError(
            inferErrorCode(reason),
            file.path,
            reason
          );
          failed.push(error);
          reportError(error);
        }
      }
    }
  }

  return {
    successful,
    failed,
    totalProcessed: successful.length + failed.length,
    successCount: successful.length,
    failureCount: failed.length,
  };
}

/**
 * Extract metadata from a single file with error handling.
 *
 * Wraps getFileMetadata with consistent error handling, returning either
 * the metadata or a structured error.
 *
 * @param file - FileInfo object to process
 * @returns Either UnifiedMetadata or ExtractionError
 *
 * @example
 * ```typescript
 * const result = await extractSingle(fileInfo);
 * if ('code' in result) {
 *   console.log(`Error: ${result.message}`);
 *   console.log(`Suggestion: ${result.suggestion}`);
 * } else {
 *   console.log(`Success: ${result.file.fullName}`);
 * }
 * ```
 */
export async function extractSingle(
  file: FileInfo
): Promise<UnifiedMetadata | ExtractionError> {
  try {
    const result = await getFileMetadata(file);

    if (!result.ok) {
      return createExtractionError(
        inferErrorCode(result.error),
        file.path,
        result.error
      );
    }

    if (result.data.extractionStatus === 'failed') {
      return createExtractionError(
        ExtractionErrorCode.EXTRACTION_FAILED,
        file.path,
        result.data.extractionError
          ? new Error(result.data.extractionError)
          : undefined
      );
    }

    return result.data;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    return createExtractionError(inferErrorCode(err), file.path, err);
  }
}

/**
 * Type guard to check if result is an extraction error.
 */
export function isExtractionError(
  result: UnifiedMetadata | ExtractionError
): result is ExtractionError {
  return 'code' in result && 'suggestion' in result;
}
