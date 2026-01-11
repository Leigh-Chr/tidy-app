import { describe, it, expect } from 'vitest';
import {
  scanStatisticsSchema,
  scanResultSchema,
  type ScanStatistics,
  type ScanResult,
} from './scan-result.js';
import { calculateStatistics } from '../statistics/statistics.js';
import { FileCategory } from './file-category.js';
import { MetadataCapability } from './metadata-capability.js';
import type { FileInfo } from './file-info.js';

describe('scanStatisticsSchema', () => {
  const validStatistics: ScanStatistics = {
    totalFiles: 10,
    totalSize: 1024000,
    byCategory: {
      [FileCategory.IMAGE]: 5,
      [FileCategory.DOCUMENT]: 2,
      [FileCategory.PDF]: 1,
      [FileCategory.SPREADSHEET]: 1,
      [FileCategory.PRESENTATION]: 0,
      [FileCategory.OTHER]: 1,
    },
    metadataSupportedCount: 6,
  };

  it('parses valid statistics', () => {
    const result = scanStatisticsSchema.parse(validStatistics);

    expect(result.totalFiles).toBe(10);
    expect(result.totalSize).toBe(1024000);
    expect(result.metadataSupportedCount).toBe(6);
  });

  it('accepts zero values', () => {
    const emptyStats: ScanStatistics = {
      totalFiles: 0,
      totalSize: 0,
      byCategory: {
        [FileCategory.IMAGE]: 0,
        [FileCategory.DOCUMENT]: 0,
        [FileCategory.PDF]: 0,
        [FileCategory.SPREADSHEET]: 0,
        [FileCategory.PRESENTATION]: 0,
        [FileCategory.OTHER]: 0,
      },
      metadataSupportedCount: 0,
    };

    const result = scanStatisticsSchema.parse(emptyStats);
    expect(result.totalFiles).toBe(0);
  });

  it('rejects negative totalFiles', () => {
    const invalid = { ...validStatistics, totalFiles: -1 };
    expect(() => scanStatisticsSchema.parse(invalid)).toThrow();
  });

  it('rejects negative totalSize', () => {
    const invalid = { ...validStatistics, totalSize: -1 };
    expect(() => scanStatisticsSchema.parse(invalid)).toThrow();
  });
});

describe('scanResultSchema', () => {
  const validResult: ScanResult = {
    files: [],
    statistics: {
      totalFiles: 0,
      totalSize: 0,
      byCategory: {
        [FileCategory.IMAGE]: 0,
        [FileCategory.DOCUMENT]: 0,
        [FileCategory.PDF]: 0,
        [FileCategory.SPREADSHEET]: 0,
        [FileCategory.PRESENTATION]: 0,
        [FileCategory.OTHER]: 0,
      },
      metadataSupportedCount: 0,
    },
    scannedAt: new Date('2024-01-01T12:00:00Z'),
    rootPath: '/home/user/documents',
    recursive: false,
  };

  it('parses valid scan result', () => {
    const result = scanResultSchema.parse(validResult);

    expect(result.files).toEqual([]);
    expect(result.rootPath).toBe('/home/user/documents');
    expect(result.recursive).toBe(false);
  });

  it('accepts recursive true', () => {
    const recursiveResult = { ...validResult, recursive: true };
    const result = scanResultSchema.parse(recursiveResult);
    expect(result.recursive).toBe(true);
  });

  it('rejects missing rootPath', () => {
    const invalid = { ...validResult };
    delete (invalid as Record<string, unknown>).rootPath;
    expect(() => scanResultSchema.parse(invalid)).toThrow();
  });

  it('rejects non-date scannedAt', () => {
    const invalid = { ...validResult, scannedAt: 'not a date' };
    expect(() => scanResultSchema.parse(invalid)).toThrow();
  });
});

describe('calculateStatistics', () => {
  const createFile = (
    overrides: Partial<FileInfo> = {}
  ): FileInfo => ({
    path: '/test/file.txt',
    name: 'file',
    extension: 'txt',
    fullName: 'file.txt',
    size: 1024,
    createdAt: new Date(),
    modifiedAt: new Date(),
    category: FileCategory.DOCUMENT,
    metadataSupported: false,
    metadataCapability: MetadataCapability.BASIC,
    ...overrides,
  });

  it('returns correct counts for empty array', () => {
    const result = calculateStatistics([]);

    expect(result.totalFiles).toBe(0);
    expect(result.totalSize).toBe(0);
    expect(result.metadataSupportedCount).toBe(0);
    expect(result.byCategory[FileCategory.IMAGE]).toBe(0);
  });

  it('calculates total files correctly', () => {
    const files = [createFile(), createFile(), createFile()];
    const result = calculateStatistics(files);

    expect(result.totalFiles).toBe(3);
  });

  it('calculates total size correctly', () => {
    const files = [
      createFile({ size: 100 }),
      createFile({ size: 200 }),
      createFile({ size: 300 }),
    ];
    const result = calculateStatistics(files);

    expect(result.totalSize).toBe(600);
  });

  it('counts files by category correctly', () => {
    const files = [
      createFile({ category: FileCategory.IMAGE }),
      createFile({ category: FileCategory.IMAGE }),
      createFile({ category: FileCategory.PDF }),
      createFile({ category: FileCategory.DOCUMENT }),
      createFile({ category: FileCategory.OTHER }),
    ];
    const result = calculateStatistics(files);

    expect(result.byCategory[FileCategory.IMAGE]).toBe(2);
    expect(result.byCategory[FileCategory.PDF]).toBe(1);
    expect(result.byCategory[FileCategory.DOCUMENT]).toBe(1);
    expect(result.byCategory[FileCategory.OTHER]).toBe(1);
    expect(result.byCategory[FileCategory.SPREADSHEET]).toBe(0);
    expect(result.byCategory[FileCategory.PRESENTATION]).toBe(0);
  });

  it('counts metadata supported files correctly', () => {
    const files = [
      createFile({ metadataSupported: true }),
      createFile({ metadataSupported: true }),
      createFile({ metadataSupported: false }),
      createFile({ metadataSupported: true }),
    ];
    const result = calculateStatistics(files);

    expect(result.metadataSupportedCount).toBe(3);
  });

  it('handles mixed file types correctly', () => {
    const files = [
      createFile({
        category: FileCategory.IMAGE,
        metadataSupported: true,
        size: 5000,
      }),
      createFile({
        category: FileCategory.PDF,
        metadataSupported: true,
        size: 10000,
      }),
      createFile({
        category: FileCategory.DOCUMENT,
        metadataSupported: false,
        size: 2000,
      }),
    ];
    const result = calculateStatistics(files);

    expect(result.totalFiles).toBe(3);
    expect(result.totalSize).toBe(17000);
    expect(result.metadataSupportedCount).toBe(2);
    expect(result.byCategory[FileCategory.IMAGE]).toBe(1);
    expect(result.byCategory[FileCategory.PDF]).toBe(1);
    expect(result.byCategory[FileCategory.DOCUMENT]).toBe(1);
  });
});
