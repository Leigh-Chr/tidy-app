/**
 * @fileoverview Tests for file type filter - Story 10.4
 */

import { describe, it, expect } from 'vitest';
import {
  getExtension,
  normalizeExt,
  shouldAnalyzeFile,
  filterFiles,
  getFilterSummary,
  type FilterResult,
  type BatchFilterResult,
} from './file-type-filter.js';
import type { LlmFileTypes } from './types.js';

// =============================================================================
// Utility Function Tests
// =============================================================================

describe('getExtension', () => {
  it('should extract simple extension', () => {
    expect(getExtension('/path/to/file.pdf')).toBe('pdf');
    expect(getExtension('/path/to/file.txt')).toBe('txt');
  });

  it('should preserve case', () => {
    expect(getExtension('/path/to/file.PDF')).toBe('PDF');
    expect(getExtension('/path/to/file.TXT')).toBe('TXT');
  });

  it('should handle multiple dots', () => {
    expect(getExtension('/path/to/file.test.pdf')).toBe('pdf');
    expect(getExtension('/path/to/archive.tar.gz')).toBe('gz');
  });

  it('should return empty for no extension', () => {
    expect(getExtension('/path/to/file')).toBe('');
    expect(getExtension('/path/to/Makefile')).toBe('');
  });

  it('should handle hidden files', () => {
    expect(getExtension('/path/to/.gitignore')).toBe('');
    expect(getExtension('/path/to/.config.json')).toBe('json');
  });

  it('should handle Windows paths', () => {
    expect(getExtension('C:\\Users\\test\\file.pdf')).toBe('pdf');
    expect(getExtension('C:\\path\\to\\file')).toBe('');
  });

  it('should handle empty path', () => {
    expect(getExtension('')).toBe('');
  });

  it('should handle just filename', () => {
    expect(getExtension('file.txt')).toBe('txt');
    expect(getExtension('file')).toBe('');
  });
});

describe('normalizeExt', () => {
  it('should remove leading dot', () => {
    expect(normalizeExt('.pdf')).toBe('pdf');
    expect(normalizeExt('.txt')).toBe('txt');
  });

  it('should handle extension without dot', () => {
    expect(normalizeExt('pdf')).toBe('pdf');
    expect(normalizeExt('txt')).toBe('txt');
  });

  it('should convert to lowercase', () => {
    expect(normalizeExt('PDF')).toBe('pdf');
    expect(normalizeExt('.PDF')).toBe('pdf');
    expect(normalizeExt('TXT')).toBe('txt');
  });

  it('should handle empty string', () => {
    expect(normalizeExt('')).toBe('');
  });

  it('should only remove one leading dot', () => {
    expect(normalizeExt('..pdf')).toBe('.pdf');
  });
});

// =============================================================================
// shouldAnalyzeFile Tests
// =============================================================================

describe('shouldAnalyzeFile', () => {
  // Default config for testing
  const defaultConfig: LlmFileTypes = {
    preset: 'documents',
    includedExtensions: [],
    excludedExtensions: [],
    skipWithMetadata: true,
  };

  describe('extension matching', () => {
    it('should include file matching preset', () => {
      const result = shouldAnalyzeFile('/path/to/report.pdf', defaultConfig);
      expect(result.ok).toBe(true);
      expect(result.data?.shouldAnalyze).toBe(true);
      expect(result.data?.reason).toContain('pdf');
      expect(result.data?.reason).toContain('documents');
    });

    it('should exclude file not in preset', () => {
      const result = shouldAnalyzeFile('/path/to/photo.jpg', defaultConfig);
      expect(result.ok).toBe(true);
      expect(result.data?.shouldAnalyze).toBe(false);
      expect(result.data?.reason).toContain('jpg');
      expect(result.data?.reason).toContain('not in preset');
    });

    it('should be case-insensitive for extensions', () => {
      const result1 = shouldAnalyzeFile('/path/to/file.PDF', defaultConfig);
      const result2 = shouldAnalyzeFile('/path/to/file.pdf', defaultConfig);
      expect(result1.data?.shouldAnalyze).toBe(true);
      expect(result2.data?.shouldAnalyze).toBe(true);
    });
  });

  describe('excluded extensions priority', () => {
    const configWithExclusions: LlmFileTypes = {
      preset: 'all',
      includedExtensions: [],
      excludedExtensions: ['exe', 'dll', '.bat'],
      skipWithMetadata: true,
    };

    it('should exclude files in excludedExtensions', () => {
      const result = shouldAnalyzeFile('/path/to/app.exe', configWithExclusions);
      expect(result.ok).toBe(true);
      expect(result.data?.shouldAnalyze).toBe(false);
      expect(result.data?.reason).toContain('excluded');
    });

    it('should handle exclusion with dot prefix', () => {
      const result = shouldAnalyzeFile('/path/to/script.bat', configWithExclusions);
      expect(result.ok).toBe(true);
      expect(result.data?.shouldAnalyze).toBe(false);
    });

    it('should be case-insensitive for exclusions', () => {
      const result = shouldAnalyzeFile('/path/to/app.EXE', configWithExclusions);
      expect(result.ok).toBe(true);
      expect(result.data?.shouldAnalyze).toBe(false);
    });

    it('should exclude even if in preset', () => {
      // pdf is in documents preset, but we're excluding it
      const config: LlmFileTypes = {
        preset: 'documents',
        includedExtensions: [],
        excludedExtensions: ['pdf'],
        skipWithMetadata: true,
      };
      const result = shouldAnalyzeFile('/path/to/file.pdf', config);
      expect(result.data?.shouldAnalyze).toBe(false);
      expect(result.data?.reason).toContain('excluded');
    });
  });

  describe('included extensions priority', () => {
    const configWithInclusions: LlmFileTypes = {
      preset: 'documents', // This should be ignored when inclusions are specified
      includedExtensions: ['log', 'conf', '.cfg'],
      excludedExtensions: [],
      skipWithMetadata: true,
    };

    it('should include files in includedExtensions', () => {
      const result = shouldAnalyzeFile('/path/to/app.log', configWithInclusions);
      expect(result.ok).toBe(true);
      expect(result.data?.shouldAnalyze).toBe(true);
      expect(result.data?.reason).toContain('explicitly included');
    });

    it('should handle inclusion with dot prefix', () => {
      const result = shouldAnalyzeFile('/path/to/app.cfg', configWithInclusions);
      expect(result.ok).toBe(true);
      expect(result.data?.shouldAnalyze).toBe(true);
    });

    it('should exclude files not in includedExtensions', () => {
      // pdf is in documents preset but not in includedExtensions
      const result = shouldAnalyzeFile('/path/to/file.pdf', configWithInclusions);
      expect(result.ok).toBe(true);
      expect(result.data?.shouldAnalyze).toBe(false);
      expect(result.data?.reason).toContain('not in include list');
    });

    it('should override preset when inclusions are specified', () => {
      const result = shouldAnalyzeFile('/path/to/doc.docx', configWithInclusions);
      expect(result.data?.shouldAnalyze).toBe(false);
    });
  });

  describe('exclusion takes priority over inclusion', () => {
    const config: LlmFileTypes = {
      preset: 'all',
      includedExtensions: ['pdf', 'docx', 'exe'],
      excludedExtensions: ['exe'], // Even though exe is in inclusions, it should be excluded
      skipWithMetadata: true,
    };

    it('should exclude even if also in includedExtensions', () => {
      const result = shouldAnalyzeFile('/path/to/app.exe', config);
      expect(result.ok).toBe(true);
      expect(result.data?.shouldAnalyze).toBe(false);
      expect(result.data?.reason).toContain('excluded');
    });

    it('should include files not excluded', () => {
      const result = shouldAnalyzeFile('/path/to/doc.pdf', config);
      expect(result.ok).toBe(true);
      expect(result.data?.shouldAnalyze).toBe(true);
    });
  });

  describe('preset categories', () => {
    it('should use images preset correctly', () => {
      const config: LlmFileTypes = {
        preset: 'images',
        includedExtensions: [],
        excludedExtensions: [],
        skipWithMetadata: true,
      };
      expect(shouldAnalyzeFile('/path/photo.jpg', config).data?.shouldAnalyze).toBe(true);
      expect(shouldAnalyzeFile('/path/photo.png', config).data?.shouldAnalyze).toBe(true);
      expect(shouldAnalyzeFile('/path/doc.pdf', config).data?.shouldAnalyze).toBe(false);
    });

    it('should use text preset correctly', () => {
      const config: LlmFileTypes = {
        preset: 'text',
        includedExtensions: [],
        excludedExtensions: [],
        skipWithMetadata: true,
      };
      expect(shouldAnalyzeFile('/path/readme.txt', config).data?.shouldAnalyze).toBe(true);
      expect(shouldAnalyzeFile('/path/readme.md', config).data?.shouldAnalyze).toBe(true);
      expect(shouldAnalyzeFile('/path/data.json', config).data?.shouldAnalyze).toBe(true);
      expect(shouldAnalyzeFile('/path/photo.jpg', config).data?.shouldAnalyze).toBe(false);
    });

    it('should use all preset correctly', () => {
      const config: LlmFileTypes = {
        preset: 'all',
        includedExtensions: [],
        excludedExtensions: [],
        skipWithMetadata: true,
      };
      expect(shouldAnalyzeFile('/path/photo.jpg', config).data?.shouldAnalyze).toBe(true);
      expect(shouldAnalyzeFile('/path/doc.pdf', config).data?.shouldAnalyze).toBe(true);
      expect(shouldAnalyzeFile('/path/readme.txt', config).data?.shouldAnalyze).toBe(true);
      // Unknown extension not in any preset
      expect(shouldAnalyzeFile('/path/app.xyz', config).data?.shouldAnalyze).toBe(false);
    });

    it('should handle custom preset with no extensions', () => {
      const config: LlmFileTypes = {
        preset: 'custom',
        includedExtensions: [],
        excludedExtensions: [],
        skipWithMetadata: true,
      };
      const result = shouldAnalyzeFile('/path/file.pdf', config);
      expect(result.data?.shouldAnalyze).toBe(false);
      expect(result.data?.reason).toContain('custom');
    });

    it('should handle custom preset with included extensions', () => {
      const config: LlmFileTypes = {
        preset: 'custom',
        includedExtensions: ['log', 'dat'],
        excludedExtensions: [],
        skipWithMetadata: true,
      };
      expect(shouldAnalyzeFile('/path/app.log', config).data?.shouldAnalyze).toBe(true);
      expect(shouldAnalyzeFile('/path/file.dat', config).data?.shouldAnalyze).toBe(true);
      expect(shouldAnalyzeFile('/path/doc.pdf', config).data?.shouldAnalyze).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle files with no extension', () => {
      const result = shouldAnalyzeFile('/path/to/Makefile', defaultConfig);
      expect(result.ok).toBe(true);
      expect(result.data?.shouldAnalyze).toBe(false);
      expect(result.data?.reason).toContain('no extension');
    });

    it('should handle hidden files without extension', () => {
      const result = shouldAnalyzeFile('/path/.gitignore', defaultConfig);
      expect(result.ok).toBe(true);
      expect(result.data?.shouldAnalyze).toBe(false);
    });

    it('should handle hidden files with extension', () => {
      const config: LlmFileTypes = {
        preset: 'text',
        includedExtensions: [],
        excludedExtensions: [],
        skipWithMetadata: true,
      };
      const result = shouldAnalyzeFile('/path/.config.json', config);
      expect(result.ok).toBe(true);
      expect(result.data?.shouldAnalyze).toBe(true);
    });

    it('should handle files with multiple dots', () => {
      const result = shouldAnalyzeFile('/path/file.test.pdf', defaultConfig);
      expect(result.ok).toBe(true);
      expect(result.data?.shouldAnalyze).toBe(true);
    });
  });
});

// =============================================================================
// filterFiles Tests
// =============================================================================

describe('filterFiles', () => {
  const config: LlmFileTypes = {
    preset: 'documents',
    includedExtensions: [],
    excludedExtensions: [],
    skipWithMetadata: true,
  };

  it('should filter files into toAnalyze and skipped', () => {
    const files = [
      '/path/report.pdf',
      '/path/photo.jpg',
      '/path/data.xlsx',
      '/path/readme.txt',
    ];

    const result = filterFiles(files, config);

    expect(result.toAnalyze).toContain('/path/report.pdf');
    expect(result.toAnalyze).toContain('/path/data.xlsx');
    expect(result.skipped.has('/path/photo.jpg')).toBe(true);
    expect(result.skipped.has('/path/readme.txt')).toBe(true);
  });

  it('should handle empty file list', () => {
    const result = filterFiles([], config);
    expect(result.toAnalyze).toEqual([]);
    expect(result.skipped.size).toBe(0);
  });

  it('should handle all files matching', () => {
    const files = ['/path/doc1.pdf', '/path/doc2.docx', '/path/data.xlsx'];
    const result = filterFiles(files, config);
    expect(result.toAnalyze).toHaveLength(3);
    expect(result.skipped.size).toBe(0);
  });

  it('should handle no files matching', () => {
    const files = ['/path/photo1.jpg', '/path/photo2.png', '/path/readme.txt'];
    const result = filterFiles(files, config);
    expect(result.toAnalyze).toHaveLength(0);
    expect(result.skipped.size).toBe(3);
  });

  it('should preserve filter reasons in skipped map', () => {
    const files = ['/path/photo.jpg'];
    const result = filterFiles(files, config);

    const reason = result.skipped.get('/path/photo.jpg');
    expect(reason).toBeDefined();
    expect(reason?.shouldAnalyze).toBe(false);
    expect(reason?.reason).toBeTruthy();
  });
});

// =============================================================================
// getFilterSummary Tests
// =============================================================================

describe('getFilterSummary', () => {
  it('should summarize empty results', () => {
    const result: BatchFilterResult = {
      toAnalyze: [],
      skipped: new Map(),
    };
    expect(getFilterSummary(result)).toBe('No files to filter');
  });

  it('should summarize all analyzed', () => {
    const result: BatchFilterResult = {
      toAnalyze: ['/a.pdf', '/b.pdf', '/c.pdf'],
      skipped: new Map(),
    };
    expect(getFilterSummary(result)).toBe('All 3 file(s) will be analyzed');
  });

  it('should summarize all skipped', () => {
    const skipped = new Map<string, FilterResult>();
    skipped.set('/a.jpg', { shouldAnalyze: false, reason: 'test' });
    skipped.set('/b.jpg', { shouldAnalyze: false, reason: 'test' });

    const result: BatchFilterResult = {
      toAnalyze: [],
      skipped,
    };
    expect(getFilterSummary(result)).toBe('All 2 file(s) will be skipped');
  });

  it('should summarize mixed results', () => {
    const skipped = new Map<string, FilterResult>();
    skipped.set('/photo.jpg', { shouldAnalyze: false, reason: 'test' });

    const result: BatchFilterResult = {
      toAnalyze: ['/doc1.pdf', '/doc2.pdf'],
      skipped,
    };
    expect(getFilterSummary(result)).toBe('2 file(s) to analyze, 1 file(s) skipped');
  });
});
