import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  extractBatch,
  extractSingle,
  isExtractionError,
} from './batch.js';
import type { FileInfo } from '../types/file-info.js';
import { FileCategory } from '../types/file-category.js';
import * as unified from './unified.js';

// Create mock file info
function createMockFileInfo(
  overrides: Partial<FileInfo> = {}
): FileInfo {
  return {
    path: '/test/file.txt',
    fullName: 'file.txt',
    baseName: 'file',
    extension: '.txt',
    size: 1000,
    createdAt: new Date('2026-01-01'),
    modifiedAt: new Date('2026-01-02'),
    category: FileCategory.OTHER,
    metadataSupported: false,
    ...overrides,
  };
}

describe('extractBatch', () => {
  let getFileMetadataSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    getFileMetadataSpy = vi.spyOn(unified, 'getFileMetadata');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should process empty file array', async () => {
    const result = await extractBatch([]);

    expect(result.successful).toHaveLength(0);
    expect(result.failed).toHaveLength(0);
    expect(result.totalProcessed).toBe(0);
    expect(result.successCount).toBe(0);
    expect(result.failureCount).toBe(0);
  });

  it('should process files successfully', async () => {
    const files = [
      createMockFileInfo({ path: '/test/file1.jpg', fullName: 'file1.jpg' }),
      createMockFileInfo({ path: '/test/file2.jpg', fullName: 'file2.jpg' }),
    ];

    getFileMetadataSpy.mockImplementation((file) =>
      Promise.resolve({
        ok: true as const,
        data: {
          file,
          image: null,
          pdf: null,
          office: null,
          extractionStatus: 'success' as const,
          extractionError: null,
        },
      })
    );

    const result = await extractBatch(files);

    expect(result.successCount).toBe(2);
    expect(result.failureCount).toBe(0);
    expect(result.totalProcessed).toBe(2);
    expect(result.successful).toHaveLength(2);
    expect(result.failed).toHaveLength(0);
  });

  it('should handle mixed success and failure', async () => {
    const files = [
      createMockFileInfo({ path: '/test/good.jpg', fullName: 'good.jpg' }),
      createMockFileInfo({ path: '/test/bad.jpg', fullName: 'bad.jpg' }),
      createMockFileInfo({ path: '/test/good2.jpg', fullName: 'good2.jpg' }),
    ];

    getFileMetadataSpy.mockImplementation((file) => {
      if (file.path.includes('bad')) {
        return Promise.resolve({
          ok: true as const,
          data: {
            file,
            image: null,
            pdf: null,
            office: null,
            extractionStatus: 'failed' as const,
            extractionError: 'Corrupted file',
          },
        });
      }
      return Promise.resolve({
        ok: true as const,
        data: {
          file,
          image: null,
          pdf: null,
          office: null,
          extractionStatus: 'success' as const,
          extractionError: null,
        },
      });
    });

    const result = await extractBatch(files);

    expect(result.successCount).toBe(2);
    expect(result.failureCount).toBe(1);
    expect(result.totalProcessed).toBe(3);
  });

  it('should call progress callback', async () => {
    const files = [
      createMockFileInfo({ path: '/test/file1.jpg' }),
      createMockFileInfo({ path: '/test/file2.jpg' }),
    ];

    getFileMetadataSpy.mockResolvedValue({
      ok: true as const,
      data: {
        file: files[0],
        image: null,
        pdf: null,
        office: null,
        extractionStatus: 'success' as const,
        extractionError: null,
      },
    });

    const onProgress = vi.fn();
    await extractBatch(files, { onProgress });

    expect(onProgress).toHaveBeenCalledTimes(2);
    expect(onProgress).toHaveBeenCalledWith(1, 2, files[0]);
    expect(onProgress).toHaveBeenCalledWith(2, 2, files[1]);
  });

  it('should call error callback on failure', async () => {
    const files = [
      createMockFileInfo({ path: '/test/bad.jpg', fullName: 'bad.jpg' }),
    ];

    getFileMetadataSpy.mockResolvedValue({
      ok: true as const,
      data: {
        file: files[0],
        image: null,
        pdf: null,
        office: null,
        extractionStatus: 'failed' as const,
        extractionError: 'File not found',
      },
    });

    const onError = vi.fn();
    await extractBatch(files, { onError });

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'EXTRACTION_FAILED',
        filePath: '/test/bad.jpg',
      })
    );
  });

  it('should respect concurrency limit', async () => {
    const files = Array.from({ length: 10 }, (_, i) =>
      createMockFileInfo({ path: `/test/file${String(i)}.jpg` })
    );

    let maxConcurrent = 0;
    let currentConcurrent = 0;

    getFileMetadataSpy.mockImplementation(async (file) => {
      currentConcurrent++;
      maxConcurrent = Math.max(maxConcurrent, currentConcurrent);

      // Simulate some async work
      await new Promise((resolve) => setTimeout(resolve, 10));

      currentConcurrent--;
      return {
        ok: true as const,
        data: {
          file,
          image: null,
          pdf: null,
          office: null,
          extractionStatus: 'success' as const,
          extractionError: null,
        },
      };
    });

    await extractBatch(files, { concurrency: 3 });

    expect(maxConcurrent).toBeLessThanOrEqual(3);
  });

  it('should stop processing when aborted', async () => {
    const files = Array.from({ length: 10 }, (_, i) =>
      createMockFileInfo({ path: `/test/file${String(i)}.jpg` })
    );

    const controller = new AbortController();
    let processedCount = 0;

    getFileMetadataSpy.mockImplementation((file) => {
      processedCount++;
      if (processedCount === 3) {
        controller.abort();
      }
      return Promise.resolve({
        ok: true as const,
        data: {
          file,
          image: null,
          pdf: null,
          office: null,
          extractionStatus: 'success' as const,
          extractionError: null,
        },
      });
    });

    const result = await extractBatch(files, {
      signal: controller.signal,
      concurrency: 2,
    });

    // Should have processed some but not all files
    expect(result.totalProcessed).toBeLessThan(10);
  });

  it('should handle unexpected Promise rejections', async () => {
    const files = [
      createMockFileInfo({ path: '/test/file.jpg', fullName: 'file.jpg' }),
    ];

    getFileMetadataSpy.mockRejectedValue(new Error('Unexpected error'));

    const result = await extractBatch(files);

    expect(result.successCount).toBe(0);
    expect(result.failureCount).toBe(1);
    expect(result.failed[0].code).toBe('EXTRACTION_FAILED');
  });

  it('should handle files with unsupported status', async () => {
    const files = [
      createMockFileInfo({
        path: '/test/file.xyz',
        fullName: 'file.xyz',
        metadataSupported: false,
      }),
    ];

    getFileMetadataSpy.mockResolvedValue({
      ok: true as const,
      data: {
        file: files[0],
        image: null,
        pdf: null,
        office: null,
        extractionStatus: 'unsupported' as const,
        extractionError: null,
      },
    });

    const result = await extractBatch(files);

    // Unsupported files are considered "successful" (not errors)
    expect(result.successCount).toBe(1);
    expect(result.failureCount).toBe(0);
  });
});

describe('extractSingle', () => {
  let getFileMetadataSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    getFileMetadataSpy = vi.spyOn(unified, 'getFileMetadata');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return metadata on success', async () => {
    const file = createMockFileInfo({ path: '/test/file.jpg' });

    getFileMetadataSpy.mockResolvedValue({
      ok: true as const,
      data: {
        file,
        image: null,
        pdf: null,
        office: null,
        extractionStatus: 'success' as const,
        extractionError: null,
      },
    });

    const result = await extractSingle(file);

    expect(isExtractionError(result)).toBe(false);
    expect(result).toHaveProperty('extractionStatus', 'success');
  });

  it('should return error on extraction failure', async () => {
    const file = createMockFileInfo({ path: '/test/bad.jpg' });

    getFileMetadataSpy.mockResolvedValue({
      ok: true as const,
      data: {
        file,
        image: null,
        pdf: null,
        office: null,
        extractionStatus: 'failed' as const,
        extractionError: 'File corrupted',
      },
    });

    const result = await extractSingle(file);

    expect(isExtractionError(result)).toBe(true);
    if (isExtractionError(result)) {
      expect(result.code).toBe('EXTRACTION_FAILED');
      expect(result.filePath).toBe('/test/bad.jpg');
    }
  });

  it('should handle thrown errors', async () => {
    const file = createMockFileInfo({ path: '/test/file.jpg' });

    getFileMetadataSpy.mockRejectedValue(new Error('ENOENT: file not found'));

    const result = await extractSingle(file);

    expect(isExtractionError(result)).toBe(true);
    if (isExtractionError(result)) {
      expect(result.code).toBe('FILE_NOT_FOUND');
    }
  });
});

describe('isExtractionError', () => {
  it('should return true for extraction errors', () => {
    const error = {
      code: 'FILE_NOT_FOUND' as const,
      message: 'File not found',
      filePath: '/test/file.jpg',
      suggestion: 'Check the path',
    };

    expect(isExtractionError(error)).toBe(true);
  });

  it('should return false for unified metadata', () => {
    const metadata = {
      file: createMockFileInfo(),
      image: null,
      pdf: null,
      office: null,
      extractionStatus: 'success' as const,
      extractionError: null,
    };

    expect(isExtractionError(metadata)).toBe(false);
  });
});

describe('extractBatch with logger', () => {
  let getFileMetadataSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    getFileMetadataSpy = vi.spyOn(unified, 'getFileMetadata');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should log errors with file path, code, and suggestion', async () => {
    const files = [
      createMockFileInfo({ path: '/test/bad.jpg', fullName: 'bad.jpg' }),
    ];

    getFileMetadataSpy.mockResolvedValue({
      ok: true as const,
      data: {
        file: files[0],
        image: null,
        pdf: null,
        office: null,
        extractionStatus: 'failed' as const,
        extractionError: 'Corrupted file',
      },
    });

    const mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    await extractBatch(files, { logger: mockLogger });

    expect(mockLogger.warn).toHaveBeenCalledTimes(1);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('/test/bad.jpg'),
      expect.objectContaining({
        code: 'EXTRACTION_FAILED',
        suggestion: expect.any(String),
      })
    );
  });

  it('should call both logger and onError callback', async () => {
    const files = [
      createMockFileInfo({ path: '/test/bad.jpg', fullName: 'bad.jpg' }),
    ];

    getFileMetadataSpy.mockResolvedValue({
      ok: true as const,
      data: {
        file: files[0],
        image: null,
        pdf: null,
        office: null,
        extractionStatus: 'failed' as const,
        extractionError: 'Error',
      },
    });

    const mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const onError = vi.fn();

    await extractBatch(files, { logger: mockLogger, onError });

    expect(mockLogger.warn).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(1);
  });
});

describe('extractBatch with retry', () => {
  let getFileMetadataSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    getFileMetadataSpy = vi.spyOn(unified, 'getFileMetadata');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should retry on transient errors when retryOptions provided', async () => {
    const files = [
      createMockFileInfo({ path: '/test/file.jpg', fullName: 'file.jpg' }),
    ];

    // First call fails with transient error, second succeeds
    getFileMetadataSpy
      .mockRejectedValueOnce(new Error('EBUSY: resource busy'))
      .mockResolvedValueOnce({
        ok: true as const,
        data: {
          file: files[0],
          image: null,
          pdf: null,
          office: null,
          extractionStatus: 'success' as const,
          extractionError: null,
        },
      });

    const result = await extractBatch(files, {
      retryOptions: { maxRetries: 3, initialDelay: 1 },
    });

    expect(result.successCount).toBe(1);
    expect(result.failureCount).toBe(0);
    expect(getFileMetadataSpy).toHaveBeenCalledTimes(2);
  });

  it('should not retry without retryOptions', async () => {
    const files = [
      createMockFileInfo({ path: '/test/file.jpg', fullName: 'file.jpg' }),
    ];

    getFileMetadataSpy.mockRejectedValue(new Error('EBUSY: resource busy'));

    const result = await extractBatch(files);

    expect(result.successCount).toBe(0);
    expect(result.failureCount).toBe(1);
    expect(getFileMetadataSpy).toHaveBeenCalledTimes(1);
  });

  it('should log retry attempts when logger provided', async () => {
    const files = [
      createMockFileInfo({ path: '/test/file.jpg', fullName: 'file.jpg' }),
    ];

    getFileMetadataSpy
      .mockRejectedValueOnce(new Error('EBUSY: resource busy'))
      .mockResolvedValueOnce({
        ok: true as const,
        data: {
          file: files[0],
          image: null,
          pdf: null,
          office: null,
          extractionStatus: 'success' as const,
          extractionError: null,
        },
      });

    const mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    await extractBatch(files, {
      retryOptions: { maxRetries: 3, initialDelay: 1 },
      logger: mockLogger,
    });

    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Retry'),
      expect.objectContaining({ error: expect.any(String) })
    );
  });
});
