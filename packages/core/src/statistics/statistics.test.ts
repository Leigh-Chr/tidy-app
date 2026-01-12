import { describe, it, expect } from 'vitest';
import {
  calculateStatistics,
  formatStatistics,
  formatBytes,
  formatCount,
} from './statistics.js';
import { FileCategory } from '../types/file-category.js';
import { MetadataCapability } from '../types/metadata-capability.js';
import type { FileInfo } from '../types/file-info.js';

/**
 * Create a mock FileInfo object for testing.
 */
function createMockFile(overrides: Partial<FileInfo> = {}): FileInfo {
  return {
    path: '/test/file.txt',
    name: 'file',
    extension: 'txt',
    fullName: 'file.txt',
    size: 1024,
    createdAt: new Date('2024-01-01'),
    modifiedAt: new Date('2024-06-15'),
    category: FileCategory.DOCUMENT,
    metadataSupported: false,
    metadataCapability: MetadataCapability.BASIC,
    ...overrides,
  };
}

describe('calculateStatistics', () => {
  describe('total calculations (AC1)', () => {
    it('calculates total file count correctly', () => {
      const files = [
        createMockFile(),
        createMockFile(),
        createMockFile(),
      ];

      const stats = calculateStatistics(files);

      expect(stats.totalFiles).toBe(3);
    });

    it('calculates total size correctly', () => {
      const files = [
        createMockFile({ size: 1000 }),
        createMockFile({ size: 2000 }),
        createMockFile({ size: 3000 }),
      ];

      const stats = calculateStatistics(files);

      expect(stats.totalSize).toBe(6000);
    });

    it('handles large file sizes', () => {
      const files = [
        createMockFile({ size: 1073741824 }), // 1 GB
        createMockFile({ size: 2147483648 }), // 2 GB
      ];

      const stats = calculateStatistics(files);

      expect(stats.totalSize).toBe(3221225472); // 3 GB
    });
  });

  describe('category grouping (AC1)', () => {
    it('groups files by category', () => {
      const files = [
        createMockFile({ category: FileCategory.IMAGE }),
        createMockFile({ category: FileCategory.IMAGE }),
        createMockFile({ category: FileCategory.DOCUMENT }),
        createMockFile({ category: FileCategory.VIDEO }),
      ];

      const stats = calculateStatistics(files);

      expect(stats.byCategory[FileCategory.IMAGE]).toBe(2);
      expect(stats.byCategory[FileCategory.DOCUMENT]).toBe(1);
      expect(stats.byCategory[FileCategory.VIDEO]).toBe(1);
      expect(stats.byCategory[FileCategory.AUDIO]).toBe(0);
      expect(stats.byCategory[FileCategory.ARCHIVE]).toBe(0);
      expect(stats.byCategory[FileCategory.OTHER]).toBe(0);
    });

    it('initializes all categories to zero', () => {
      const files = [createMockFile({ category: FileCategory.IMAGE })];

      const stats = calculateStatistics(files);

      // All categories should exist, even if 0
      expect(stats.byCategory).toHaveProperty(FileCategory.IMAGE);
      expect(stats.byCategory).toHaveProperty(FileCategory.DOCUMENT);
      expect(stats.byCategory).toHaveProperty(FileCategory.VIDEO);
      expect(stats.byCategory).toHaveProperty(FileCategory.AUDIO);
      expect(stats.byCategory).toHaveProperty(FileCategory.ARCHIVE);
      expect(stats.byCategory).toHaveProperty(FileCategory.OTHER);
    });

    it('handles all files in OTHER category', () => {
      const files = [
        createMockFile({ category: FileCategory.OTHER }),
        createMockFile({ category: FileCategory.OTHER }),
      ];

      const stats = calculateStatistics(files);

      expect(stats.byCategory[FileCategory.OTHER]).toBe(2);
    });
  });

  describe('metadata supported count (AC1)', () => {
    it('counts metadata-supported files', () => {
      const files = [
        createMockFile({ metadataSupported: true }),
        createMockFile({ metadataSupported: true }),
        createMockFile({ metadataSupported: false }),
      ];

      const stats = calculateStatistics(files);

      expect(stats.metadataSupportedCount).toBe(2);
    });

    it('handles all files with metadata support', () => {
      const files = [
        createMockFile({ metadataSupported: true }),
        createMockFile({ metadataSupported: true }),
      ];

      const stats = calculateStatistics(files);

      expect(stats.metadataSupportedCount).toBe(2);
    });

    it('handles no files with metadata support', () => {
      const files = [
        createMockFile({ metadataSupported: false }),
        createMockFile({ metadataSupported: false }),
      ];

      const stats = calculateStatistics(files);

      expect(stats.metadataSupportedCount).toBe(0);
    });
  });

  describe('filtered statistics (AC2)', () => {
    it('calculates correctly for filtered file set', () => {
      // Simulate a filtered set (only images)
      const filteredFiles = [
        createMockFile({ category: FileCategory.IMAGE, size: 5000 }),
        createMockFile({ category: FileCategory.IMAGE, size: 3000 }),
      ];

      const stats = calculateStatistics(filteredFiles);

      expect(stats.totalFiles).toBe(2);
      expect(stats.totalSize).toBe(8000);
      expect(stats.byCategory[FileCategory.IMAGE]).toBe(2);
      expect(stats.byCategory[FileCategory.DOCUMENT]).toBe(0);
    });

    it('reflects filtered subset accurately', () => {
      // Original set: 5 files
      // Filtered to: 2 documents
      const filteredFiles = [
        createMockFile({ category: FileCategory.DOCUMENT, size: 1000 }),
        createMockFile({ category: FileCategory.DOCUMENT, size: 2000 }),
      ];

      const stats = calculateStatistics(filteredFiles);

      expect(stats.totalFiles).toBe(2);
      expect(stats.totalSize).toBe(3000);
    });
  });

  describe('empty array handling (AC3)', () => {
    it('returns zero counts for empty array', () => {
      const stats = calculateStatistics([]);

      expect(stats.totalFiles).toBe(0);
      expect(stats.totalSize).toBe(0);
      expect(stats.metadataSupportedCount).toBe(0);
    });

    it('initializes all categories to zero for empty array', () => {
      const stats = calculateStatistics([]);

      expect(stats.byCategory[FileCategory.IMAGE]).toBe(0);
      expect(stats.byCategory[FileCategory.DOCUMENT]).toBe(0);
      expect(stats.byCategory[FileCategory.DOCUMENT]).toBe(0);
      expect(stats.byCategory[FileCategory.DOCUMENT]).toBe(0);
      expect(stats.byCategory[FileCategory.DOCUMENT]).toBe(0);
      expect(stats.byCategory[FileCategory.OTHER]).toBe(0);
    });

    it('does not throw for empty array', () => {
      expect(() => calculateStatistics([])).not.toThrow();
    });
  });
});

describe('formatBytes', () => {
  describe('basic formatting', () => {
    it('formats 0 bytes', () => {
      expect(formatBytes(0)).toBe('0 B');
    });

    it('formats bytes (< 1KB)', () => {
      expect(formatBytes(512)).toBe('512.00 B');
      expect(formatBytes(1)).toBe('1.00 B');
    });

    it('formats kilobytes', () => {
      expect(formatBytes(1024)).toBe('1.00 KB');
      expect(formatBytes(1536)).toBe('1.50 KB');
      expect(formatBytes(2048)).toBe('2.00 KB');
    });

    it('formats megabytes', () => {
      expect(formatBytes(1048576)).toBe('1.00 MB');
      expect(formatBytes(1572864)).toBe('1.50 MB');
      expect(formatBytes(10485760)).toBe('10.00 MB');
    });

    it('formats gigabytes', () => {
      expect(formatBytes(1073741824)).toBe('1.00 GB');
      expect(formatBytes(5368709120)).toBe('5.00 GB');
    });

    it('formats terabytes', () => {
      expect(formatBytes(1099511627776)).toBe('1.00 TB');
    });
  });

  describe('custom decimals', () => {
    it('respects custom decimal places', () => {
      expect(formatBytes(1536, 0)).toBe('2 KB');
      expect(formatBytes(1536, 1)).toBe('1.5 KB');
      expect(formatBytes(1536, 3)).toBe('1.500 KB');
    });
  });

  describe('edge cases', () => {
    it('handles negative values', () => {
      expect(formatBytes(-1)).toBe('Invalid size');
      expect(formatBytes(-1024)).toBe('Invalid size');
    });

    it('handles very large values', () => {
      const result = formatBytes(1125899906842624); // 1 PB
      // Should cap at TB
      expect(result).toBe('1024.00 TB');
    });
  });
});

describe('formatCount', () => {
  it('formats zero files', () => {
    expect(formatCount(0)).toBe('No files');
  });

  it('formats single file', () => {
    expect(formatCount(1)).toBe('1 file');
  });

  it('formats multiple files', () => {
    expect(formatCount(2)).toBe('2 files');
    expect(formatCount(42)).toBe('42 files');
    expect(formatCount(100)).toBe('100 files');
  });

  it('formats large numbers with locale separators', () => {
    // Note: exact format depends on locale (comma, dot, or space as separator)
    const result = formatCount(1000);
    // Should contain "1", some separator(s), "000", and "files"
    expect(result).toContain('1');
    expect(result).toContain('000');
    expect(result).toContain('files');
  });

  it('formats very large numbers', () => {
    const result = formatCount(1000000);
    // Should contain "1", some separator(s), and "files"
    expect(result).toContain('1');
    expect(result).toContain('files');
    // Total should have 7 digits (1,000,000) with some separators
    expect(result.replace(/\D/g, '')).toBe('1000000');
  });
});

describe('formatStatistics', () => {
  const mockFiles = [
    createMockFile({
      category: FileCategory.IMAGE,
      size: 5000,
      metadataSupported: true,
    }),
    createMockFile({
      category: FileCategory.IMAGE,
      size: 3000,
      metadataSupported: true,
    }),
    createMockFile({
      category: FileCategory.DOCUMENT,
      size: 10000,
      metadataSupported: true,
    }),
    createMockFile({
      category: FileCategory.VIDEO,
      size: 2000,
      metadataSupported: false,
    }),
  ];

  it('includes formatted size string', () => {
    const stats = calculateStatistics(mockFiles);
    const formatted = formatStatistics(stats);

    expect(formatted.formattedSize).toBe('19.53 KB');
  });

  it('includes formatted count string', () => {
    const stats = calculateStatistics(mockFiles);
    const formatted = formatStatistics(stats);

    expect(formatted.formattedCount).toBe('4 files');
  });

  it('includes category breakdown sorted by count', () => {
    const stats = calculateStatistics(mockFiles);
    const formatted = formatStatistics(stats);

    expect(formatted.categoryBreakdown).toHaveLength(3); // Only non-zero categories
    expect(formatted.categoryBreakdown[0].category).toBe(FileCategory.IMAGE);
    expect(formatted.categoryBreakdown[0].count).toBe(2);
    expect(formatted.categoryBreakdown[1].count).toBe(1);
  });

  it('excludes zero-count categories from breakdown', () => {
    const stats = calculateStatistics(mockFiles);
    const formatted = formatStatistics(stats);

    const categories = formatted.categoryBreakdown.map((b) => b.category);
    expect(categories).not.toContain(FileCategory.AUDIO);
    expect(categories).not.toContain(FileCategory.ARCHIVE);
    expect(categories).not.toContain(FileCategory.OTHER);
  });

  it('calculates percentages correctly', () => {
    const stats = calculateStatistics(mockFiles);
    const formatted = formatStatistics(stats);

    // IMAGE: 2/4 = 50%, DOCUMENT: 1/4 = 25%, VIDEO: 1/4 = 25%
    const imageEntry = formatted.categoryBreakdown.find(
      (b) => b.category === FileCategory.IMAGE
    );
    expect(imageEntry?.percentage).toBe(50);

    const documentEntry = formatted.categoryBreakdown.find(
      (b) => b.category === FileCategory.DOCUMENT
    );
    expect(documentEntry?.percentage).toBe(25);

    const videoEntry = formatted.categoryBreakdown.find(
      (b) => b.category === FileCategory.VIDEO
    );
    expect(videoEntry?.percentage).toBe(25);
  });

  it('rounds percentages to whole numbers', () => {
    const files = [
      createMockFile({ category: FileCategory.IMAGE }),
      createMockFile({ category: FileCategory.IMAGE }),
      createMockFile({ category: FileCategory.DOCUMENT }),
    ];
    const stats = calculateStatistics(files);
    const formatted = formatStatistics(stats);

    // IMAGE: 2/3 = 66.67% -> 67
    // PDF: 1/3 = 33.33% -> 33
    const imageEntry = formatted.categoryBreakdown.find(
      (b) => b.category === FileCategory.IMAGE
    );
    expect(imageEntry?.percentage).toBe(67);
  });

  it('handles empty statistics', () => {
    const stats = calculateStatistics([]);
    const formatted = formatStatistics(stats);

    expect(formatted.formattedSize).toBe('0 B');
    expect(formatted.formattedCount).toBe('No files');
    expect(formatted.categoryBreakdown).toHaveLength(0);
  });

  it('preserves original statistics properties', () => {
    const stats = calculateStatistics(mockFiles);
    const formatted = formatStatistics(stats);

    expect(formatted.totalFiles).toBe(stats.totalFiles);
    expect(formatted.totalSize).toBe(stats.totalSize);
    expect(formatted.metadataSupportedCount).toBe(stats.metadataSupportedCount);
    expect(formatted.byCategory).toEqual(stats.byCategory);
  });
});

describe('immutability', () => {
  it('does not mutate input files array', () => {
    const files = [
      createMockFile({ size: 1000 }),
      createMockFile({ size: 2000 }),
    ];
    const original = [...files];

    calculateStatistics(files);

    expect(files).toEqual(original);
  });

  it('formatStatistics does not mutate input stats', () => {
    const stats = calculateStatistics([
      createMockFile({ category: FileCategory.IMAGE }),
    ]);
    const originalStats = { ...stats };

    formatStatistics(stats);

    expect(stats.totalFiles).toBe(originalStats.totalFiles);
    expect(stats.totalSize).toBe(originalStats.totalSize);
  });
});
