import { describe, it, expect } from 'vitest';
import {
  ExtractionErrorCode,
  extractionErrorCodeSchema,
  extractionErrorSchema,
  createExtractionError,
  inferErrorCode,
} from './extraction-error.js';

describe('ExtractionErrorCode', () => {
  it('should define all expected error codes', () => {
    expect(ExtractionErrorCode.FILE_NOT_FOUND).toBe('FILE_NOT_FOUND');
    expect(ExtractionErrorCode.PERMISSION_DENIED).toBe('PERMISSION_DENIED');
    expect(ExtractionErrorCode.CORRUPTED_FILE).toBe('CORRUPTED_FILE');
    expect(ExtractionErrorCode.PASSWORD_PROTECTED).toBe('PASSWORD_PROTECTED');
    expect(ExtractionErrorCode.UNSUPPORTED_FORMAT).toBe('UNSUPPORTED_FORMAT');
    expect(ExtractionErrorCode.EXTRACTION_FAILED).toBe('EXTRACTION_FAILED');
  });
});

describe('extractionErrorCodeSchema', () => {
  it('should validate valid error codes', () => {
    expect(extractionErrorCodeSchema.parse('FILE_NOT_FOUND')).toBe(
      'FILE_NOT_FOUND'
    );
    expect(extractionErrorCodeSchema.parse('PERMISSION_DENIED')).toBe(
      'PERMISSION_DENIED'
    );
  });

  it('should reject invalid error codes', () => {
    expect(() => extractionErrorCodeSchema.parse('INVALID_CODE')).toThrow();
    expect(() => extractionErrorCodeSchema.parse('')).toThrow();
    expect(() => extractionErrorCodeSchema.parse(123)).toThrow();
  });
});

describe('extractionErrorSchema', () => {
  it('should validate a complete extraction error', () => {
    const error = {
      code: 'FILE_NOT_FOUND' as const,
      message: 'File does not exist',
      filePath: '/path/to/file.jpg',
      suggestion: 'Verify the file exists',
    };

    const result = extractionErrorSchema.parse(error);
    expect(result).toEqual(error);
  });

  it('should reject errors with missing fields', () => {
    expect(() =>
      extractionErrorSchema.parse({
        code: 'FILE_NOT_FOUND',
        message: 'Error',
        // missing filePath and suggestion
      })
    ).toThrow();
  });
});

describe('createExtractionError', () => {
  it('should create error with code and file path', () => {
    const error = createExtractionError(
      ExtractionErrorCode.FILE_NOT_FOUND,
      '/path/to/file.jpg'
    );

    expect(error.code).toBe('FILE_NOT_FOUND');
    expect(error.filePath).toBe('/path/to/file.jpg');
    expect(error.message).toBe('FILE_NOT_FOUND');
    expect(error.suggestion).toBe('Verify the file exists and path is correct');
  });

  it('should use original error message when provided', () => {
    const originalError = new Error('ENOENT: no such file or directory');
    const error = createExtractionError(
      ExtractionErrorCode.FILE_NOT_FOUND,
      '/path/to/file.jpg',
      originalError
    );

    expect(error.message).toBe('ENOENT: no such file or directory');
  });

  it('should provide appropriate suggestion for each error code', () => {
    const suggestions: Record<string, string> = {
      FILE_NOT_FOUND: 'Verify the file exists and path is correct',
      PERMISSION_DENIED:
        'Check file permissions or run with elevated privileges',
      CORRUPTED_FILE:
        'The file may be damaged. Try re-downloading or restoring from backup',
      PASSWORD_PROTECTED: 'Remove password protection to extract metadata',
      UNSUPPORTED_FORMAT: 'This file type does not support metadata extraction',
      EXTRACTION_FAILED: 'Try re-scanning or check if file is valid',
    };

    for (const [code, expectedSuggestion] of Object.entries(suggestions)) {
      const error = createExtractionError(
        code as ExtractionErrorCode,
        '/test.jpg'
      );
      expect(error.suggestion).toBe(expectedSuggestion);
    }
  });

  it('should create valid schema-compliant error', () => {
    const error = createExtractionError(
      ExtractionErrorCode.CORRUPTED_FILE,
      '/path/to/corrupt.pdf',
      new Error('Invalid PDF structure')
    );

    expect(() => extractionErrorSchema.parse(error)).not.toThrow();
  });
});

describe('inferErrorCode', () => {
  it('should infer FILE_NOT_FOUND from ENOENT errors', () => {
    expect(inferErrorCode(new Error('ENOENT: no such file'))).toBe(
      'FILE_NOT_FOUND'
    );
    expect(inferErrorCode(new Error('File not found'))).toBe('FILE_NOT_FOUND');
  });

  it('should infer PERMISSION_DENIED from permission errors', () => {
    expect(inferErrorCode(new Error('EACCES: permission denied'))).toBe(
      'PERMISSION_DENIED'
    );
    expect(inferErrorCode(new Error('Access denied'))).toBe('PERMISSION_DENIED');
  });

  it('should infer CORRUPTED_FILE from corruption errors', () => {
    expect(inferErrorCode(new Error('Corrupt file header'))).toBe(
      'CORRUPTED_FILE'
    );
    expect(inferErrorCode(new Error('Invalid EXIF data'))).toBe(
      'CORRUPTED_FILE'
    );
    expect(inferErrorCode(new Error('Malformed data'))).toBe('CORRUPTED_FILE');
  });

  it('should infer PASSWORD_PROTECTED from encryption errors', () => {
    expect(inferErrorCode(new Error('Password required'))).toBe(
      'PASSWORD_PROTECTED'
    );
    expect(inferErrorCode(new Error('File is encrypted'))).toBe(
      'PASSWORD_PROTECTED'
    );
  });

  it('should infer UNSUPPORTED_FORMAT from format errors', () => {
    expect(inferErrorCode(new Error('Unsupported format'))).toBe(
      'UNSUPPORTED_FORMAT'
    );
    expect(inferErrorCode(new Error('Unknown format'))).toBe(
      'UNSUPPORTED_FORMAT'
    );
  });

  it('should default to EXTRACTION_FAILED for unknown errors', () => {
    expect(inferErrorCode(new Error('Something went wrong'))).toBe(
      'EXTRACTION_FAILED'
    );
    expect(inferErrorCode(new Error(''))).toBe('EXTRACTION_FAILED');
  });

  it('should be case insensitive', () => {
    expect(inferErrorCode(new Error('FILE NOT FOUND'))).toBe('FILE_NOT_FOUND');
    expect(inferErrorCode(new Error('Permission Denied'))).toBe(
      'PERMISSION_DENIED'
    );
  });
});
