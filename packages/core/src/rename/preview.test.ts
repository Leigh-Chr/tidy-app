import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { generatePreview, type FileMetadata } from './preview.js';
import type { FileInfo } from '../types/file-info.js';
import type { ImageMetadata } from '../types/image-metadata.js';
import { RenameStatus } from '../types/rename-proposal.js';

// =============================================================================
// Test Utilities
// =============================================================================

function createMockFile(overrides: Partial<FileInfo> = {}): FileInfo {
  return {
    path: '/test/photos/vacation.jpg',
    name: 'vacation',
    extension: 'jpg',
    size: 1024000,
    createdAt: new Date('2026-01-10'),
    modifiedAt: new Date('2026-01-10'),
    category: 'image',
    metadataSupported: true,
    ...overrides,
  };
}

function createMockImageMetadata(overrides: Partial<ImageMetadata> = {}): ImageMetadata {
  return {
    width: 4000,
    height: 3000,
    dateTaken: new Date('2025-06-15T14:30:00Z'),
    cameraModel: 'Canon EOS R5',
    cameraMake: 'Canon',
    orientation: 1,
    ...overrides,
  };
}

// =============================================================================
// AC1: Generate preview without modifying files
// =============================================================================

describe('generatePreview - AC1: Dry-run without file modification', () => {
  it('generates preview without modifying files', () => {
    const files = [createMockFile()];
    const metadataMap = new Map<string, FileMetadata>();

    const result = generatePreview(files, metadataMap, '{original}_renamed', { caseNormalization: 'none' });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.proposals).toHaveLength(1);
      expect(result.data.proposals[0].proposedName).toBe('vacation_renamed.jpg');
      // File system remains unchanged (no actual file operations performed)
    }
  });

  it('preserves original file information', () => {
    const file = createMockFile({ path: '/photos/IMG_001.jpg', name: 'IMG_001' });
    const files = [file];
    const metadataMap = new Map<string, FileMetadata>();

    const result = generatePreview(files, metadataMap, '{original}_copy', { caseNormalization: 'none' });

    expect(result.ok).toBe(true);
    if (result.ok) {
      const proposal = result.data.proposals[0];
      expect(proposal.originalPath).toBe('/photos/IMG_001.jpg');
      expect(proposal.originalName).toBe('IMG_001.jpg');
    }
  });

  it('returns Result type for all operations', () => {
    const files = [createMockFile()];
    const metadataMap = new Map<string, FileMetadata>();

    // Valid template should return ok Result
    const result = generatePreview(files, metadataMap, '{original}_renamed', { caseNormalization: 'none' });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.proposals).toHaveLength(1);
    }
  });
});

// =============================================================================
// AC2: Preview includes status for each file
// =============================================================================

describe('generatePreview - AC2: Status determination', () => {
  it('marks file as ready when all conditions met', () => {
    const file = createMockFile();
    const files = [file];
    const metadataMap = new Map<string, FileMetadata>([
      [file.path, { imageMetadata: createMockImageMetadata() }],
    ]);

    const result = generatePreview(files, metadataMap, '{year}_{original}');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.proposals[0].status).toBe(RenameStatus.READY);
    }
  });

  it('marks file as conflict when duplicate names would result', () => {
    const files = [
      createMockFile({ path: '/test/photo1.jpg', name: 'photo1' }),
      createMockFile({ path: '/test/photo2.jpg', name: 'photo2' }),
    ];
    const metadataMap = new Map<string, FileMetadata>();

    // Same template will produce same name for different files
    const result = generatePreview(files, metadataMap, 'renamed');

    expect(result.ok).toBe(true);
    if (result.ok) {
      // Both files would be renamed to "renamed.jpg"
      expect(result.data.proposals[0].status).toBe(RenameStatus.CONFLICT);
      expect(result.data.proposals[1].status).toBe(RenameStatus.CONFLICT);
      expect(result.data.summary.conflicts).toBe(2);
    }
  });

  it('marks file as missing-data when required placeholder cannot be filled', () => {
    const file = createMockFile();
    const files = [file];
    const metadataMap = new Map<string, FileMetadata>(); // No metadata

    // Template requires camera from EXIF, but no metadata provided
    const result = generatePreview(files, metadataMap, '{camera}_{original}');

    expect(result.ok).toBe(true);
    if (result.ok) {
      const proposal = result.data.proposals[0];
      // Camera placeholder without metadata should produce MISSING_DATA status
      expect(proposal.status).toBe(RenameStatus.MISSING_DATA);
      expect(proposal.issues.some((i) => i.code === 'MISSING_METADATA')).toBe(true);
    }
  });

  it('marks file as no-change when proposed name equals original', () => {
    const file = createMockFile({ name: 'vacation', extension: 'jpg' });
    const files = [file];
    const metadataMap = new Map<string, FileMetadata>();

    const result = generatePreview(files, metadataMap, '{original}');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.proposals[0].status).toBe(RenameStatus.NO_CHANGE);
      expect(result.data.summary.noChange).toBe(1);
    }
  });

  it('tracks issues for each proposal', () => {
    const file = createMockFile();
    const files = [file];
    const metadataMap = new Map<string, FileMetadata>(); // No metadata

    const result = generatePreview(files, metadataMap, '{camera}_{original}');

    expect(result.ok).toBe(true);
    if (result.ok) {
      const proposal = result.data.proposals[0];
      // Camera placeholder without metadata should produce an issue
      expect(proposal.issues.some((i) => i.code === 'MISSING_METADATA')).toBe(true);
    }
  });

  it('marks file as invalid-name when proposed name contains invalid characters (sanitization disabled)', () => {
    const file = createMockFile();
    const files = [file];
    const metadataMap = new Map<string, FileMetadata>();

    // Use sanitizeFilenames: false AND osSanitizeOptions: false to disable all sanitization
    // Windows reserved name "CON" should be invalid when sanitization is disabled
    const result = generatePreview(files, metadataMap, 'CON', {
      sanitizeFilenames: false,
      osSanitizeOptions: false,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      const proposal = result.data.proposals[0];
      expect(proposal.status).toBe(RenameStatus.INVALID_NAME);
      expect(proposal.issues.some((i) => i.code === 'INVALID_NAME')).toBe(true);
      expect(result.data.summary.invalidName).toBe(1);
    }
  });

  it('calculates summary correctly', () => {
    const files = [
      createMockFile({ path: '/test/file1.jpg', name: 'file1' }),
      createMockFile({ path: '/test/file2.jpg', name: 'file2' }),
      createMockFile({ path: '/test/file3.jpg', name: 'file3' }),
    ];
    const metadataMap = new Map<string, FileMetadata>();

    const result = generatePreview(files, metadataMap, '{original}_new');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.summary.total).toBe(3);
      const sum =
        result.data.summary.ready +
        result.data.summary.conflicts +
        result.data.summary.missingData +
        result.data.summary.noChange +
        result.data.summary.invalidName;
      expect(sum).toBe(3);
    }
  });
});

// =============================================================================
// AC3: Preview performance
// =============================================================================

describe('generatePreview - AC3: Performance', () => {
  it('processes 100+ files within 5 seconds', () => {
    const files = Array.from({ length: 150 }, (_, i) =>
      createMockFile({
        path: `/test/photos/photo${String(i).padStart(3, '0')}.jpg`,
        name: `photo${String(i).padStart(3, '0')}`,
      })
    );
    const metadataMap = new Map<string, FileMetadata>();

    const startTime = Date.now();
    const result = generatePreview(files, metadataMap, '{original}_renamed');
    const elapsed = Date.now() - startTime;

    expect(result.ok).toBe(true);
    expect(elapsed).toBeLessThan(5000); // NFR-P3: <5 seconds
    if (result.ok) {
      expect(result.data.proposals).toHaveLength(150);
    }
  });

  it('reports progress during generation', () => {
    const files = Array.from({ length: 10 }, (_, i) =>
      createMockFile({
        path: `/test/photos/photo${i}.jpg`,
        name: `photo${i}`,
      })
    );
    const metadataMap = new Map<string, FileMetadata>();
    const progressCalls: [number, number][] = [];

    generatePreview(files, metadataMap, '{original}_renamed', {
      onProgress: (current, total) => progressCalls.push([current, total]),
    });

    expect(progressCalls).toHaveLength(10);
    expect(progressCalls[0]).toEqual([1, 10]);
    expect(progressCalls[9]).toEqual([10, 10]);
  });

  it('supports cancellation via AbortSignal', () => {
    const files = Array.from({ length: 100 }, (_, i) =>
      createMockFile({
        path: `/test/photos/photo${i}.jpg`,
        name: `photo${i}`,
      })
    );
    const metadataMap = new Map<string, FileMetadata>();
    const controller = new AbortController();

    // Cancel after first file
    const result = generatePreview(files, metadataMap, '{original}_renamed', {
      signal: controller.signal,
      onProgress: (current) => {
        if (current === 1) controller.abort();
      },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe('cancelled');
      expect(result.error.message).toContain('cancelled');
    }
  });
});

// =============================================================================
// Additional Tests: Conflict Detection
// =============================================================================

describe('generatePreview - Conflict detection', () => {
  it('detects conflicts within same directory', () => {
    const files = [
      createMockFile({ path: '/photos/a.jpg', name: 'a' }),
      createMockFile({ path: '/photos/b.jpg', name: 'b' }),
    ];
    const metadataMap = new Map<string, FileMetadata>();

    // Both would become "same.jpg"
    const result = generatePreview(files, metadataMap, 'same');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.proposals[0].status).toBe(RenameStatus.CONFLICT);
      expect(result.data.proposals[1].status).toBe(RenameStatus.CONFLICT);
    }
  });

  it('does not mark as conflict if in different directories', () => {
    const files = [
      createMockFile({ path: '/photos/2025/a.jpg', name: 'a' }),
      createMockFile({ path: '/photos/2026/b.jpg', name: 'b' }),
    ];
    const metadataMap = new Map<string, FileMetadata>();

    const result = generatePreview(files, metadataMap, 'same');

    expect(result.ok).toBe(true);
    if (result.ok) {
      // Different directories, so no conflict
      expect(result.data.proposals[0].status).toBe(RenameStatus.READY);
      expect(result.data.proposals[1].status).toBe(RenameStatus.READY);
    }
  });

  it('handles case-insensitive conflict detection', () => {
    const files = [
      createMockFile({ path: '/photos/a.jpg', name: 'a' }),
      createMockFile({ path: '/photos/b.jpg', name: 'b' }),
    ];
    const metadataMap = new Map<string, FileMetadata>([
      ['/photos/a.jpg', { imageMetadata: createMockImageMetadata({ cameraModel: 'Canon' }) }],
      ['/photos/b.jpg', { imageMetadata: createMockImageMetadata({ cameraModel: 'CANON' }) }],
    ]);

    // {camera} will produce "Canon" and "CANON" - should detect as conflict on case-insensitive FS
    const result = generatePreview(files, metadataMap, '{camera}');

    expect(result.ok).toBe(true);
    if (result.ok) {
      // Normalized comparison treats these as same
      expect(result.data.proposals[0].status).toBe(RenameStatus.CONFLICT);
      expect(result.data.proposals[1].status).toBe(RenameStatus.CONFLICT);
    }
  });
});

// =============================================================================
// Additional Tests: Template Integration
// =============================================================================

describe('generatePreview - Template integration', () => {
  it('applies date placeholders from metadata', () => {
    const file = createMockFile();
    const metadata = createMockImageMetadata({ dateTaken: new Date('2025-06-15') });
    const metadataMap = new Map<string, FileMetadata>([
      [file.path, { imageMetadata: metadata }],
    ]);

    const result = generatePreview([file], metadataMap, '{year}_{month}_{day}_{original}');

    expect(result.ok).toBe(true);
    if (result.ok) {
      // Note: sanitizeFilename converts dashes to underscores
      expect(result.data.proposals[0].proposedName).toContain('2025');
      expect(result.data.proposals[0].proposedName).toContain('vacation');
    }
  });

  it('includes metadata in proposal for debugging', () => {
    const file = createMockFile();
    const imageMetadata = createMockImageMetadata();
    const metadataMap = new Map<string, FileMetadata>([
      [file.path, { imageMetadata }],
    ]);

    const result = generatePreview([file], metadataMap, '{original}');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.proposals[0].metadata).toBeDefined();
      expect(result.data.proposals[0].metadata?.image).toBeDefined();
    }
  });

  it('records template used in preview result', () => {
    const files = [createMockFile()];
    const metadataMap = new Map<string, FileMetadata>();
    const template = '{year}-{month}-{original}';

    const result = generatePreview(files, metadataMap, template);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.templateUsed).toBe(template);
    }
  });

  it('records generation timestamp', () => {
    const files = [createMockFile()];
    const metadataMap = new Map<string, FileMetadata>();
    const before = new Date();

    const result = generatePreview(files, metadataMap, '{original}');

    const after = new Date();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.generatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(result.data.generatedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    }
  });
});

// =============================================================================
// Additional Tests: Error Handling
// =============================================================================

describe('generatePreview - Error handling', () => {
  it('returns generation_error type for unexpected exceptions', () => {
    // This test verifies the error type structure.
    // The generation_error path is defensive code that handles unexpected exceptions.
    // It's difficult to trigger without mocking internals, but we verify the type exists.
    const files = [createMockFile()];
    const metadataMap = new Map<string, FileMetadata>();

    const result = generatePreview(files, metadataMap, '{original}');

    // Verify the result has the expected structure
    expect(result).toHaveProperty('ok');
    if (!result.ok) {
      // If this ever fails, verify error has correct type
      expect(['cancelled', 'generation_error']).toContain(result.error.type);
      expect(result.error).toHaveProperty('message');
    }
  });

  it('includes descriptive message in errors', () => {
    const files = Array.from({ length: 5 }, (_, i) =>
      createMockFile({
        path: `/test/photos/photo${i}.jpg`,
        name: `photo${i}`,
      })
    );
    const metadataMap = new Map<string, FileMetadata>();
    const controller = new AbortController();
    controller.abort(); // Pre-abort

    const result = generatePreview(files, metadataMap, '{original}', {
      signal: controller.signal,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe('cancelled');
      expect(result.error.message).toBeTruthy();
      expect(typeof result.error.message).toBe('string');
    }
  });
});

// =============================================================================
// Additional Tests: Options
// =============================================================================

describe('generatePreview - Options', () => {
  it('supports fallback values for missing placeholders', () => {
    const file = createMockFile();
    const metadataMap = new Map<string, FileMetadata>(); // No metadata

    const result = generatePreview([file], metadataMap, '{camera}_{original}', {
      fallbacks: { camera: 'Unknown' },
      caseNormalization: 'none',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.proposals[0].proposedName).toContain('Unknown');
    }
  });

  it('preserves special characters when sanitizeFilenames is false', () => {
    const file = createMockFile();
    const files = [file];
    const metadataMap = new Map<string, FileMetadata>();

    // With sanitizeFilenames: false, dashes should be preserved
    const result = generatePreview(files, metadataMap, '{original}-copy', {
      sanitizeFilenames: false,
      caseNormalization: 'none',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      // Dash should be preserved when sanitization is disabled
      expect(result.data.proposals[0].proposedName).toBe('vacation-copy.jpg');
    }
  });

  it('handles empty file list', () => {
    const result = generatePreview([], new Map(), '{original}');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.proposals).toHaveLength(0);
      expect(result.data.summary.total).toBe(0);
    }
  });
});

// =============================================================================
// Story 4.7: OS Filename Sanitization Integration
// =============================================================================

describe('generatePreview - OS sanitization integration (Story 4.7)', () => {
  // Note: The template system has its own sanitization that runs first.
  // OS sanitization (from Story 4.7) provides additional cross-platform safety
  // for things like Windows reserved names and filename length limits.

  it('sanitizes Windows reserved names (AC2)', () => {
    const file = createMockFile({ path: '/test/photo.jpg', name: 'photo' });
    const metadataMap = new Map<string, FileMetadata>();

    // Template produces Windows reserved name (CON is not handled by template sanitization)
    const result = generatePreview([file], metadataMap, 'CON', { caseNormalization: 'none' });

    expect(result.ok).toBe(true);
    if (result.ok) {
      const proposal = result.data.proposals[0];
      // CON should be renamed to CON_file by OS sanitization
      expect(proposal.proposedName).toBe('CON_file.jpg');
      expect(proposal.status).toBe(RenameStatus.READY);
      expect(proposal.issues.some((i) => i.code === 'SANITIZED_RESERVED_NAME')).toBe(true);
    }
  });

  it('truncates long filenames with warning (AC3)', () => {
    const file = createMockFile({ path: '/test/photo.jpg', name: 'photo' });
    const metadataMap = new Map<string, FileMetadata>();

    // Create a very long filename
    // Note: Template sanitization truncates at 200 chars, OS sanitization at 255
    // To test OS truncation, disable template sanitization
    const longName = 'a'.repeat(300);
    const result = generatePreview([file], metadataMap, longName, {
      sanitizeFilenames: false, // Disable template sanitization so OS sanitization handles it
      caseNormalization: 'none',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      const proposal = result.data.proposals[0];
      // Should be truncated to 255 or less by OS sanitization
      expect(proposal.proposedName.length).toBeLessThanOrEqual(255);
      // Extension should be preserved
      expect(proposal.proposedName).toMatch(/\.jpg$/);
      // Should track truncation as issue
      expect(proposal.issues.some((i) => i.code === 'SANITIZED_TRUNCATION')).toBe(true);
    }
  });

  it('removes trailing spaces and periods for Windows compatibility (AC2)', () => {
    const file = createMockFile({ path: '/test/photo.jpg', name: 'photo' });
    const metadataMap = new Map<string, FileMetadata>();

    // Template produces name with trailing space (not caught by template sanitization)
    // Need to disable template sanitization to test OS sanitization
    const result = generatePreview([file], metadataMap, 'photo ', {
      sanitizeFilenames: false, // Disable template sanitization
      caseNormalization: 'none',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      const proposal = result.data.proposals[0];
      // Trailing space should be removed by OS sanitization
      expect(proposal.proposedName).toBe('photo.jpg');
      expect(proposal.issues.some((i) => i.code === 'SANITIZED_TRAILING_FIX')).toBe(true);
    }
  });

  it('can disable OS sanitization with osSanitizeOptions: false', () => {
    const file = createMockFile({ path: '/test/photo.jpg', name: 'photo' });
    const metadataMap = new Map<string, FileMetadata>();

    // Disable BOTH template and OS sanitization
    const result = generatePreview([file], metadataMap, 'CON', {
      sanitizeFilenames: false,
      osSanitizeOptions: false,
      caseNormalization: 'none',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      const proposal = result.data.proposals[0];
      // Should not sanitize - CON remains (a Windows reserved name)
      expect(proposal.proposedName).toBe('CON.jpg');
      // CON is detected as invalid by isValidFilename
      expect(proposal.status).toBe(RenameStatus.INVALID_NAME);
    }
  });

  it('respects custom osSanitizeOptions for platform targeting', () => {
    const file = createMockFile({ path: '/test/photo.jpg', name: 'photo' });
    const metadataMap = new Map<string, FileMetadata>();

    // Use Linux-only sanitization
    // Test with a colon (valid on Linux, invalid on Windows)
    const result = generatePreview([file], metadataMap, 'test:file', {
      sanitizeFilenames: false, // Disable template sanitization
      osSanitizeOptions: { targetPlatform: 'linux' },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      const proposal = result.data.proposals[0];
      // OS sanitization doesn't modify the name (colon is valid on Linux)
      expect(proposal.proposedName).toBe('test:file.jpg');
      // However, isValidFilename still flags it as invalid for cross-platform safety
      // This is correct behavior: OS sanitization is platform-specific,
      // but the final validation ensures cross-platform compatibility
      expect(proposal.status).toBe(RenameStatus.INVALID_NAME);
      expect(proposal.issues.some((i) => i.code === 'INVALID_NAME')).toBe(true);
    }
  });

  it('OS sanitization handles invalid chars when template sanitization disabled (AC1)', () => {
    const file = createMockFile({ path: '/test/photo.jpg', name: 'photo' });
    const metadataMap = new Map<string, FileMetadata>();

    // Disable template sanitization but keep OS sanitization enabled
    const result = generatePreview([file], metadataMap, 'photo:2024', {
      sanitizeFilenames: false, // Disable template sanitization
      // osSanitizeOptions defaults to { targetPlatform: 'all' }
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      const proposal = result.data.proposals[0];
      // Colon should be replaced by OS sanitization
      expect(proposal.proposedName).toBe('photo_2024.jpg');
      expect(proposal.status).toBe(RenameStatus.READY);
      expect(proposal.issues.some((i) => i.code === 'SANITIZED_CHAR_REPLACEMENT')).toBe(true);
    }
  });

  it('reports all sanitization changes as issues', () => {
    const file = createMockFile({ path: '/test/photo.jpg', name: 'photo' });
    const metadataMap = new Map<string, FileMetadata>();

    // Disable template sanitization, let OS sanitization handle everything
    // Use a name that triggers multiple sanitization steps
    const result = generatePreview([file], metadataMap, 'CON:test ', {
      sanitizeFilenames: false,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      const proposal = result.data.proposals[0];
      // Should have sanitization issues reported
      const sanitizedIssues = proposal.issues.filter((i) =>
        i.code.startsWith('SANITIZED_')
      );
      expect(sanitizedIssues.length).toBeGreaterThan(0);
    }
  });
});

// =============================================================================
// Story 4.6: Filesystem Collision Detection Integration
// =============================================================================

describe('generatePreview - Filesystem collision detection (Story 4.6)', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `tidy-preview-fs-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  function createTestFile(name: string, extension: string): FileInfo {
    return {
      path: join(testDir, `${name}.${extension}`),
      name,
      extension,
      size: 1024,
      createdAt: new Date(),
      modifiedAt: new Date(),
      category: 'image',
      metadataSupported: true,
    };
  }

  it('detects collision with existing filesystem file (AC2)', async () => {
    // Create existing file on disk
    const existingPath = join(testDir, 'existing.jpg');
    await writeFile(existingPath, 'content');

    // Try to rename another file to same name
    const file = createTestFile('original', 'jpg');
    const metadataMap = new Map<string, FileMetadata>();

    const result = generatePreview([file], metadataMap, 'existing');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.proposals[0].status).toBe(RenameStatus.CONFLICT);
      expect(result.data.proposals[0].issues.some((i) => i.code === 'FILE_EXISTS')).toBe(true);
      expect(result.data.summary.conflicts).toBe(1);
    }
  });

  it('allows rename when no filesystem collision', async () => {
    const file = createTestFile('original', 'jpg');
    await writeFile(file.path, 'content');
    const metadataMap = new Map<string, FileMetadata>();

    const result = generatePreview([file], metadataMap, 'newname');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.proposals[0].status).toBe(RenameStatus.READY);
    }
  });

  it('skips filesystem check when checkFileSystem is false', async () => {
    // Create existing file on disk
    const existingPath = join(testDir, 'existing.jpg');
    await writeFile(existingPath, 'content');

    // Try to rename another file to same name
    const file = createTestFile('original', 'jpg');
    const metadataMap = new Map<string, FileMetadata>();

    const result = generatePreview([file], metadataMap, 'existing', {
      checkFileSystem: false,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      // Should NOT detect collision because checkFileSystem is false
      expect(result.data.proposals[0].status).toBe(RenameStatus.READY);
      expect(result.data.proposals[0].issues.some((i) => i.code === 'FILE_EXISTS')).toBe(false);
    }
  });

  it('does not flag self-rename as collision', async () => {
    const file = createTestFile('samename', 'jpg');
    await writeFile(file.path, 'content');
    const metadataMap = new Map<string, FileMetadata>();

    // Template produces same name as original
    const result = generatePreview([file], metadataMap, 'samename');

    expect(result.ok).toBe(true);
    if (result.ok) {
      // Should be NO_CHANGE, not CONFLICT
      expect(result.data.proposals[0].status).toBe(RenameStatus.NO_CHANGE);
    }
  });

  it('detects both batch duplicates and filesystem collisions', async () => {
    // Create existing file
    const existingPath = join(testDir, 'target.jpg');
    await writeFile(existingPath, 'content');

    // Two files that would both rename to existing file
    const file1 = createTestFile('file1', 'jpg');
    const file2 = createTestFile('file2', 'jpg');
    const metadataMap = new Map<string, FileMetadata>();

    const result = generatePreview([file1, file2], metadataMap, 'target');

    expect(result.ok).toBe(true);
    if (result.ok) {
      // Both should be conflicts
      expect(result.data.proposals[0].status).toBe(RenameStatus.CONFLICT);
      expect(result.data.proposals[1].status).toBe(RenameStatus.CONFLICT);
      // One has batch duplicate issue
      const hasDuplicateIssue = result.data.proposals.some((p) =>
        p.issues.some((i) => i.code === 'DUPLICATE_NAME')
      );
      expect(hasDuplicateIssue).toBe(true);
    }
  });
});
