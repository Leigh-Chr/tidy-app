import { describe, it, expect } from 'vitest';
import {
  filterFiles,
  filterByCategory,
  filterByExtensions,
  filterImages,
  filterDocuments,
  filterMetadataSupported,
} from './filter.js';
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

const mockFiles: FileInfo[] = [
  createMockFile({
    path: '/test/photo.jpg',
    name: 'photo',
    extension: 'jpg',
    fullName: 'photo.jpg',
    category: FileCategory.IMAGE,
    metadataSupported: true,
    size: 5000,
  }),
  createMockFile({
    path: '/test/document.pdf',
    name: 'document',
    extension: 'pdf',
    fullName: 'document.pdf',
    category: FileCategory.PDF,
    metadataSupported: true,
    size: 10000,
  }),
  createMockFile({
    path: '/test/data.xlsx',
    name: 'data',
    extension: 'xlsx',
    fullName: 'data.xlsx',
    category: FileCategory.SPREADSHEET,
    metadataSupported: true,
    size: 15000,
  }),
  createMockFile({
    path: '/test/readme.txt',
    name: 'readme',
    extension: 'txt',
    fullName: 'readme.txt',
    category: FileCategory.DOCUMENT,
    metadataSupported: false,
    size: 500,
  }),
  createMockFile({
    path: '/test/slides.pptx',
    name: 'slides',
    extension: 'pptx',
    fullName: 'slides.pptx',
    category: FileCategory.PRESENTATION,
    metadataSupported: true,
    size: 20000,
  }),
  createMockFile({
    path: '/test/archive.zip',
    name: 'archive',
    extension: 'zip',
    fullName: 'archive.zip',
    category: FileCategory.OTHER,
    metadataSupported: false,
    size: 50000,
  }),
];

describe('filterByCategory', () => {
  describe('single category filter (AC1, AC2)', () => {
    it('filters by IMAGE category', () => {
      const result = filterByCategory(mockFiles, FileCategory.IMAGE);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('photo');
      expect(result[0].category).toBe(FileCategory.IMAGE);
    });

    it('filters by PDF category', () => {
      const result = filterByCategory(mockFiles, FileCategory.PDF);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('document');
    });

    it('filters by DOCUMENT category', () => {
      const result = filterByCategory(mockFiles, FileCategory.DOCUMENT);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('readme');
    });

    it('filters by SPREADSHEET category', () => {
      const result = filterByCategory(mockFiles, FileCategory.SPREADSHEET);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('data');
    });

    it('filters by PRESENTATION category', () => {
      const result = filterByCategory(mockFiles, FileCategory.PRESENTATION);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('slides');
    });

    it('filters by OTHER category', () => {
      const result = filterByCategory(mockFiles, FileCategory.OTHER);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('archive');
    });
  });

  describe('multiple category filter - OR logic (AC3)', () => {
    it('filters by multiple categories (PDF and SPREADSHEET)', () => {
      const result = filterByCategory(mockFiles, [
        FileCategory.PDF,
        FileCategory.SPREADSHEET,
      ]);

      expect(result).toHaveLength(2);
      expect(result.map((f) => f.name).sort()).toEqual(['data', 'document']);
    });

    it('filters by all document types', () => {
      const result = filterByCategory(mockFiles, [
        FileCategory.DOCUMENT,
        FileCategory.PDF,
        FileCategory.SPREADSHEET,
        FileCategory.PRESENTATION,
      ]);

      expect(result).toHaveLength(4);
    });

    it('filters by IMAGE and OTHER', () => {
      const result = filterByCategory(mockFiles, [
        FileCategory.IMAGE,
        FileCategory.OTHER,
      ]);

      expect(result).toHaveLength(2);
      expect(result.map((f) => f.name).sort()).toEqual(['archive', 'photo']);
    });
  });

  describe('edge cases', () => {
    it('returns empty array when no matches', () => {
      const onlyImages = [mockFiles[0]];
      const result = filterByCategory(onlyImages, FileCategory.PDF);

      expect(result).toHaveLength(0);
    });

    it('returns empty array for empty input', () => {
      const result = filterByCategory([], FileCategory.IMAGE);

      expect(result).toHaveLength(0);
    });

    it('returns all files when all match', () => {
      const allImages = [
        createMockFile({ category: FileCategory.IMAGE }),
        createMockFile({ category: FileCategory.IMAGE }),
      ];
      const result = filterByCategory(allImages, FileCategory.IMAGE);

      expect(result).toHaveLength(2);
    });
  });
});

describe('filterByExtensions', () => {
  it('filters by single extension', () => {
    const result = filterByExtensions(mockFiles, ['jpg']);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('photo');
  });

  it('filters by multiple extensions', () => {
    const result = filterByExtensions(mockFiles, ['jpg', 'pdf', 'xlsx']);

    expect(result).toHaveLength(3);
  });

  it('handles case insensitivity', () => {
    const result = filterByExtensions(mockFiles, ['JPG', 'PDF']);

    expect(result).toHaveLength(2);
  });

  it('handles uppercase extensions in files', () => {
    const filesWithUppercase = [
      createMockFile({ extension: 'JPG', category: FileCategory.IMAGE }),
    ];
    const result = filterByExtensions(filesWithUppercase, ['jpg']);

    expect(result).toHaveLength(1);
  });

  it('returns empty array when no matches', () => {
    const result = filterByExtensions(mockFiles, ['mp3', 'wav']);

    expect(result).toHaveLength(0);
  });

  it('returns empty array for empty input', () => {
    const result = filterByExtensions([], ['jpg']);

    expect(result).toHaveLength(0);
  });

  it('returns empty array for empty extensions array', () => {
    const result = filterByExtensions(mockFiles, []);

    expect(result).toHaveLength(0);
  });
});

describe('filterFiles (combined filters)', () => {
  it('filters by category only', () => {
    const result = filterFiles(mockFiles, {
      categories: [FileCategory.IMAGE],
    });

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('photo');
  });

  it('filters by extension only', () => {
    const result = filterFiles(mockFiles, {
      extensions: ['pdf'],
    });

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('document');
  });

  it('filters by minimum size', () => {
    const result = filterFiles(mockFiles, {
      minSize: 10000,
    });

    // pdf (10000), xlsx (15000), pptx (20000), zip (50000) = 4 files
    expect(result).toHaveLength(4);
    expect(result.every((f) => f.size >= 10000)).toBe(true);
  });

  it('filters by maximum size', () => {
    const result = filterFiles(mockFiles, {
      maxSize: 5000,
    });

    expect(result).toHaveLength(2);
    expect(result.every((f) => f.size <= 5000)).toBe(true);
  });

  it('filters by size range', () => {
    const result = filterFiles(mockFiles, {
      minSize: 5000,
      maxSize: 15000,
    });

    expect(result).toHaveLength(3);
    expect(result.every((f) => f.size >= 5000 && f.size <= 15000)).toBe(true);
  });

  it('filters by modified date (after)', () => {
    const recentFiles = [
      createMockFile({ modifiedAt: new Date('2024-07-01') }),
      createMockFile({ modifiedAt: new Date('2024-01-01') }),
    ];
    const result = filterFiles(recentFiles, {
      modifiedAfter: new Date('2024-06-01'),
    });

    expect(result).toHaveLength(1);
  });

  it('filters by modified date (before)', () => {
    const recentFiles = [
      createMockFile({ modifiedAt: new Date('2024-07-01') }),
      createMockFile({ modifiedAt: new Date('2024-01-01') }),
    ];
    const result = filterFiles(recentFiles, {
      modifiedBefore: new Date('2024-06-01'),
    });

    expect(result).toHaveLength(1);
  });

  it('combines category and size filters', () => {
    const result = filterFiles(mockFiles, {
      categories: [FileCategory.PDF, FileCategory.SPREADSHEET],
      maxSize: 12000,
    });

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('document');
  });

  it('returns all files with empty options', () => {
    const result = filterFiles(mockFiles, {});

    expect(result).toHaveLength(mockFiles.length);
  });

  it('returns all files with empty categories array', () => {
    const result = filterFiles(mockFiles, { categories: [] });

    expect(result).toHaveLength(mockFiles.length);
  });

  it('returns all files with empty extensions array', () => {
    const result = filterFiles(mockFiles, { extensions: [] });

    expect(result).toHaveLength(mockFiles.length);
  });
});

describe('filterImages (convenience function)', () => {
  it('returns only image files', () => {
    const result = filterImages(mockFiles);

    expect(result).toHaveLength(1);
    expect(result[0].category).toBe(FileCategory.IMAGE);
  });

  it('returns empty array when no images', () => {
    const noImages = mockFiles.filter((f) => f.category !== FileCategory.IMAGE);
    const result = filterImages(noImages);

    expect(result).toHaveLength(0);
  });
});

describe('filterDocuments (convenience function)', () => {
  it('returns all document types (AC2)', () => {
    const result = filterDocuments(mockFiles);

    expect(result).toHaveLength(4);
    const categories = result.map((f) => f.category);
    expect(categories).toContain(FileCategory.DOCUMENT);
    expect(categories).toContain(FileCategory.PDF);
    expect(categories).toContain(FileCategory.SPREADSHEET);
    expect(categories).toContain(FileCategory.PRESENTATION);
  });

  it('excludes images and other files', () => {
    const result = filterDocuments(mockFiles);

    expect(result.some((f) => f.category === FileCategory.IMAGE)).toBe(false);
    expect(result.some((f) => f.category === FileCategory.OTHER)).toBe(false);
  });
});

describe('filterMetadataSupported', () => {
  it('returns only files with metadata support', () => {
    const result = filterMetadataSupported(mockFiles);

    expect(result).toHaveLength(4);
    expect(result.every((f) => f.metadataSupported)).toBe(true);
  });

  it('excludes files without metadata support', () => {
    const result = filterMetadataSupported(mockFiles);

    expect(result.some((f) => f.name === 'readme')).toBe(false);
    expect(result.some((f) => f.name === 'archive')).toBe(false);
  });
});

describe('immutability', () => {
  it('does not mutate the original array', () => {
    const original = [...mockFiles];
    filterByCategory(mockFiles, FileCategory.IMAGE);

    expect(mockFiles).toEqual(original);
  });

  it('returns a new array instance', () => {
    const result = filterByCategory(mockFiles, FileCategory.IMAGE);

    expect(result).not.toBe(mockFiles);
  });
});
