import { z } from 'zod';

/**
 * Error codes for metadata extraction failures.
 */
export const ExtractionErrorCode = {
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  CORRUPTED_FILE: 'CORRUPTED_FILE',
  PASSWORD_PROTECTED: 'PASSWORD_PROTECTED',
  UNSUPPORTED_FORMAT: 'UNSUPPORTED_FORMAT',
  EXTRACTION_FAILED: 'EXTRACTION_FAILED',
} as const;

export type ExtractionErrorCode =
  (typeof ExtractionErrorCode)[keyof typeof ExtractionErrorCode];

/**
 * Zod schema for ExtractionErrorCode.
 */
export const extractionErrorCodeSchema = z.enum([
  'FILE_NOT_FOUND',
  'PERMISSION_DENIED',
  'CORRUPTED_FILE',
  'PASSWORD_PROTECTED',
  'UNSUPPORTED_FORMAT',
  'EXTRACTION_FAILED',
]);

/**
 * Structured error information for metadata extraction failures.
 */
export interface ExtractionError {
  /** Error code categorizing the failure type */
  code: ExtractionErrorCode;
  /** Human-readable error message */
  message: string;
  /** Path to the file that failed extraction */
  filePath: string;
  /** Suggested action to resolve the error */
  suggestion: string;
}

/**
 * Zod schema for ExtractionError.
 */
export const extractionErrorSchema = z.object({
  code: extractionErrorCodeSchema,
  message: z.string(),
  filePath: z.string(),
  suggestion: z.string(),
});

/**
 * Suggestions for each error code.
 */
const ERROR_SUGGESTIONS: Record<ExtractionErrorCode, string> = {
  FILE_NOT_FOUND: 'Verify the file exists and path is correct',
  PERMISSION_DENIED:
    'Check file permissions or run with elevated privileges',
  CORRUPTED_FILE:
    'The file may be damaged. Try re-downloading or restoring from backup',
  PASSWORD_PROTECTED: 'Remove password protection to extract metadata',
  UNSUPPORTED_FORMAT: 'This file type does not support metadata extraction',
  EXTRACTION_FAILED: 'Try re-scanning or check if file is valid',
};

/**
 * Create a structured extraction error with appropriate suggestion.
 *
 * @param code - Error code categorizing the failure
 * @param filePath - Path to the file that failed
 * @param originalError - Optional original error for message extraction
 * @returns Structured ExtractionError
 *
 * @example
 * ```typescript
 * const error = createExtractionError(
 *   ExtractionErrorCode.CORRUPTED_FILE,
 *   '/path/to/file.jpg',
 *   new Error('Invalid EXIF data')
 * );
 * // error.suggestion === 'The file may be damaged...'
 * ```
 */
export function createExtractionError(
  code: ExtractionErrorCode,
  filePath: string,
  originalError?: Error
): ExtractionError {
  return {
    code,
    message: originalError?.message ?? code,
    filePath,
    suggestion: ERROR_SUGGESTIONS[code],
  };
}

/**
 * Infer error code from an Error instance based on message patterns.
 *
 * @param error - The original error
 * @returns Best matching ExtractionErrorCode
 */
export function inferErrorCode(error: Error): ExtractionErrorCode {
  const message = error.message.toLowerCase();

  if (message.includes('enoent') || message.includes('not found')) {
    return ExtractionErrorCode.FILE_NOT_FOUND;
  }
  if (
    message.includes('eacces') ||
    message.includes('permission') ||
    message.includes('access denied')
  ) {
    return ExtractionErrorCode.PERMISSION_DENIED;
  }
  if (
    message.includes('corrupt') ||
    message.includes('invalid') ||
    message.includes('malformed')
  ) {
    return ExtractionErrorCode.CORRUPTED_FILE;
  }
  if (message.includes('password') || message.includes('encrypted')) {
    return ExtractionErrorCode.PASSWORD_PROTECTED;
  }
  if (message.includes('unsupported') || message.includes('unknown format')) {
    return ExtractionErrorCode.UNSUPPORTED_FORMAT;
  }

  return ExtractionErrorCode.EXTRACTION_FAILED;
}
