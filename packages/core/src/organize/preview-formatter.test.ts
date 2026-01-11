/**
 * @fileoverview Tests for preview-formatter - Story 8.3
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fs from 'node:fs/promises';
import {
  formatMovePreview,
  formatSourceToDestination,
  getFolderStructureName,
  filterPreviewByOperationType,
  analyzeDestinationFolders,
} from './preview-formatter.js';
import type { RenameProposal } from '../types/rename-proposal.js';
import { RenameStatus } from '../types/rename-proposal.js';
import type { FolderStructure } from '../types/folder-structure.js';

// Mock fs/promises for analyzeDestinationFolders tests
vi.mock('node:fs/promises', () => ({
  stat: vi.fn(),
}));

// =============================================================================
// Test Fixtures
// =============================================================================

const createProposal = (overrides: Partial<RenameProposal> = {}): RenameProposal => ({
  id: '123',
  originalPath: '/photos/IMG_001.jpg',
  originalName: 'IMG_001.jpg',
  proposedName: '2026-01-10_photo.jpg',
  proposedPath: '/photos/2026-01-10_photo.jpg',
  status: RenameStatus.READY,
  issues: [],
  ...overrides,
});

const createFolderStructure = (overrides: Partial<FolderStructure> = {}): FolderStructure => ({
  id: 'fs-1',
  name: 'By Year/Month',
  pattern: '{year}/{month}',
  description: 'Organize by date',
  enabled: true,
  priority: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

// =============================================================================
// formatSourceToDestination Tests (AC1)
// =============================================================================

describe('formatSourceToDestination', () => {
  it('should format source and destination with arrow', () => {
    const result = formatSourceToDestination(
      '/photos/IMG_001.jpg',
      '/organized/2026/01/2026-01-10_photo.jpg'
    );
    expect(result).toBe('/photos/IMG_001.jpg → /organized/2026/01/2026-01-10_photo.jpg');
  });

  it('should handle same source and destination', () => {
    const result = formatSourceToDestination('/photos/IMG_001.jpg', '/photos/IMG_001.jpg');
    expect(result).toBe('/photos/IMG_001.jpg → /photos/IMG_001.jpg');
  });

  it('should handle empty paths', () => {
    const result = formatSourceToDestination('', '');
    expect(result).toBe(' → ');
  });

  it('should handle Windows-style paths', () => {
    const result = formatSourceToDestination(
      'C:\\photos\\IMG_001.jpg',
      'C:\\organized\\2026\\01\\photo.jpg'
    );
    expect(result).toBe('C:\\photos\\IMG_001.jpg → C:\\organized\\2026\\01\\photo.jpg');
  });
});

// =============================================================================
// formatMovePreview Tests (AC1, AC2, AC3)
// =============================================================================

describe('formatMovePreview', () => {
  const folderStructures = [
    createFolderStructure({ id: 'fs-1', name: 'By Year/Month' }),
    createFolderStructure({ id: 'fs-2', name: 'By Category' }),
  ];

  describe('basic formatting', () => {
    it('should format a move operation proposal', () => {
      const proposal = createProposal({
        originalPath: '/photos/IMG_001.jpg',
        originalName: 'IMG_001.jpg',
        proposedPath: '/organized/2026/01/2026-01-10_photo.jpg',
        proposedName: '2026-01-10_photo.jpg',
        isMoveOperation: true,
        folderStructureId: 'fs-1',
      });

      const result = formatMovePreview(proposal, folderStructures);

      expect(result.sourcePath).toBe('/photos/IMG_001.jpg');
      expect(result.destinationPath).toBe('/organized/2026/01/2026-01-10_photo.jpg');
      expect(result.sourceFilename).toBe('IMG_001.jpg');
      expect(result.destinationFilename).toBe('2026-01-10_photo.jpg');
      expect(result.isMoveOperation).toBe(true);
      expect(result.folderStructureName).toBe('By Year/Month');
      expect(result.formatted).toBe(
        '/photos/IMG_001.jpg → /organized/2026/01/2026-01-10_photo.jpg'
      );
    });

    it('should format a rename-only proposal', () => {
      const proposal = createProposal({
        originalPath: '/photos/IMG_001.jpg',
        originalName: 'IMG_001.jpg',
        proposedPath: '/photos/2026-01-10_photo.jpg',
        proposedName: '2026-01-10_photo.jpg',
        isMoveOperation: false,
      });

      const result = formatMovePreview(proposal, folderStructures);

      expect(result.sourcePath).toBe('/photos/IMG_001.jpg');
      expect(result.destinationPath).toBe('/photos/2026-01-10_photo.jpg');
      expect(result.isMoveOperation).toBe(false);
      expect(result.folderStructureName).toBeUndefined();
    });

    it('should handle proposal without isMoveOperation set', () => {
      const proposal = createProposal({
        isMoveOperation: undefined,
      });

      const result = formatMovePreview(proposal, folderStructures);

      expect(result.isMoveOperation).toBe(false);
      expect(result.folderStructureName).toBeUndefined();
    });
  });

  describe('folder structure name resolution (AC3)', () => {
    it('should include folder structure name when folderStructureId is set', () => {
      const proposal = createProposal({
        isMoveOperation: true,
        folderStructureId: 'fs-2',
      });

      const result = formatMovePreview(proposal, folderStructures);

      expect(result.folderStructureName).toBe('By Category');
    });

    it('should return undefined name when folderStructureId not found', () => {
      const proposal = createProposal({
        isMoveOperation: true,
        folderStructureId: 'fs-unknown',
      });

      const result = formatMovePreview(proposal, folderStructures);

      expect(result.folderStructureName).toBeUndefined();
    });

    it('should return undefined name when folderStructures array is empty', () => {
      const proposal = createProposal({
        isMoveOperation: true,
        folderStructureId: 'fs-1',
      });

      const result = formatMovePreview(proposal, []);

      expect(result.folderStructureName).toBeUndefined();
    });

    it('should return undefined name when folderStructureId is not set', () => {
      const proposal = createProposal({
        isMoveOperation: true,
        folderStructureId: undefined,
      });

      const result = formatMovePreview(proposal, folderStructures);

      expect(result.folderStructureName).toBeUndefined();
    });
  });
});

// =============================================================================
// getFolderStructureName Tests (AC3)
// =============================================================================

describe('getFolderStructureName', () => {
  const structures: FolderStructure[] = [
    createFolderStructure({ id: 'fs-1', name: 'By Year' }),
    createFolderStructure({ id: 'fs-2', name: 'By Month' }),
    createFolderStructure({ id: 'fs-3', name: 'By Category' }),
  ];

  it('should return name for existing structure', () => {
    expect(getFolderStructureName('fs-1', structures)).toBe('By Year');
    expect(getFolderStructureName('fs-2', structures)).toBe('By Month');
    expect(getFolderStructureName('fs-3', structures)).toBe('By Category');
  });

  it('should return undefined for non-existent structure', () => {
    expect(getFolderStructureName('fs-unknown', structures)).toBeUndefined();
  });

  it('should return undefined for empty structures array', () => {
    expect(getFolderStructureName('fs-1', [])).toBeUndefined();
  });

  it('should handle undefined id', () => {
    expect(getFolderStructureName(undefined as unknown as string, structures)).toBeUndefined();
  });
});

// =============================================================================
// filterPreviewByOperationType Tests (AC5)
// =============================================================================

describe('filterPreviewByOperationType', () => {
  const moveProposal1 = createProposal({
    id: 'move-1',
    isMoveOperation: true,
    proposedPath: '/organized/2026/photo1.jpg',
  });
  const moveProposal2 = createProposal({
    id: 'move-2',
    isMoveOperation: true,
    proposedPath: '/organized/2026/photo2.jpg',
  });
  const renameProposal1 = createProposal({
    id: 'rename-1',
    isMoveOperation: false,
    proposedPath: '/photos/renamed1.jpg',
  });
  const renameProposal2 = createProposal({
    id: 'rename-2',
    isMoveOperation: undefined,
    proposedPath: '/photos/renamed2.jpg',
  });

  const mixedProposals = [moveProposal1, renameProposal1, moveProposal2, renameProposal2];

  describe('filter type: move', () => {
    it('should return only move operations', () => {
      const result = filterPreviewByOperationType(mixedProposals, 'move');
      expect(result).toHaveLength(2);
      expect(result.map((p) => p.id)).toEqual(['move-1', 'move-2']);
    });

    it('should return empty array when no move operations', () => {
      const result = filterPreviewByOperationType([renameProposal1, renameProposal2], 'move');
      expect(result).toHaveLength(0);
    });
  });

  describe('filter type: rename', () => {
    it('should return only rename-only operations', () => {
      const result = filterPreviewByOperationType(mixedProposals, 'rename');
      expect(result).toHaveLength(2);
      expect(result.map((p) => p.id)).toEqual(['rename-1', 'rename-2']);
    });

    it('should include proposals with undefined isMoveOperation', () => {
      const result = filterPreviewByOperationType([renameProposal2], 'rename');
      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe('rename-2');
    });

    it('should return empty array when all are move operations', () => {
      const result = filterPreviewByOperationType([moveProposal1, moveProposal2], 'rename');
      expect(result).toHaveLength(0);
    });
  });

  describe('filter type: all', () => {
    it('should return all proposals', () => {
      const result = filterPreviewByOperationType(mixedProposals, 'all');
      expect(result).toHaveLength(4);
    });

    it('should return a copy, not the original array', () => {
      const result = filterPreviewByOperationType(mixedProposals, 'all');
      expect(result).not.toBe(mixedProposals);
      expect(result).toEqual(mixedProposals);
    });
  });

  describe('edge cases', () => {
    it('should handle empty proposals array', () => {
      expect(filterPreviewByOperationType([], 'move')).toEqual([]);
      expect(filterPreviewByOperationType([], 'rename')).toEqual([]);
      expect(filterPreviewByOperationType([], 'all')).toEqual([]);
    });
  });
});

// =============================================================================
// analyzeDestinationFolders Tests (AC6)
// =============================================================================

describe('analyzeDestinationFolders', () => {
  const mockStat = vi.mocked(fs.stat);

  // Helper to create a mock stat result for a directory
  const mockDirectory = () => ({ isDirectory: () => true }) as fs.Stats;
  // Helper to create ENOENT error (folder doesn't exist)
  const mockEnoent = () => Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
  // Helper to create EPERM error (permission denied)
  const mockEperm = () => Object.assign(new Error('Permission denied'), { code: 'EPERM' });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('folder extraction', () => {
    it('should extract unique destination folders from move proposals', async () => {
      // Folders exist
      mockStat.mockResolvedValue(mockDirectory());

      const proposals = [
        createProposal({
          proposedPath: '/organized/2026/01/photo1.jpg',
          isMoveOperation: true,
        }),
        createProposal({
          proposedPath: '/organized/2026/01/photo2.jpg',
          isMoveOperation: true,
        }),
        createProposal({
          proposedPath: '/organized/2026/02/photo3.jpg',
          isMoveOperation: true,
        }),
      ];

      const result = await analyzeDestinationFolders(proposals);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Should have 2 unique folders
        expect(result.data.totalFolders).toBe(2);
        expect(result.data.existingFolders).toContain('/organized/2026/01');
        expect(result.data.existingFolders).toContain('/organized/2026/02');
      }
    });

    it('should only analyze move operations, not rename-only', async () => {
      mockStat.mockResolvedValue(mockDirectory());

      const proposals = [
        createProposal({
          proposedPath: '/organized/2026/01/photo1.jpg',
          isMoveOperation: true,
        }),
        createProposal({
          proposedPath: '/photos/renamed.jpg',
          isMoveOperation: false, // Should be ignored
        }),
      ];

      const result = await analyzeDestinationFolders(proposals);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.totalFolders).toBe(1);
        expect(result.data.existingFolders).toContain('/organized/2026/01');
        // /photos should not be included (rename-only)
      }
    });
  });

  describe('folder existence checking', () => {
    it('should identify existing folders', async () => {
      mockStat.mockResolvedValue(mockDirectory()); // Folder exists

      const proposals = [
        createProposal({
          proposedPath: '/organized/2026/01/photo.jpg',
          isMoveOperation: true,
        }),
      ];

      const result = await analyzeDestinationFolders(proposals);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.existingFolders).toContain('/organized/2026/01');
        expect(result.data.newFolders).toHaveLength(0);
      }
    });

    it('should identify new folders that need creation', async () => {
      mockStat.mockRejectedValue(mockEnoent()); // Folder doesn't exist

      const proposals = [
        createProposal({
          proposedPath: '/organized/2026/01/photo.jpg',
          isMoveOperation: true,
        }),
      ];

      const result = await analyzeDestinationFolders(proposals);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.newFolders).toContain('/organized/2026/01');
        expect(result.data.existingFolders).toHaveLength(0);
      }
    });

    it('should handle mixed existing and new folders', async () => {
      // First folder exists, second doesn't
      mockStat.mockResolvedValueOnce(mockDirectory()).mockRejectedValueOnce(mockEnoent());

      const proposals = [
        createProposal({
          proposedPath: '/existing/folder/photo1.jpg',
          isMoveOperation: true,
        }),
        createProposal({
          proposedPath: '/new/folder/photo2.jpg',
          isMoveOperation: true,
        }),
      ];

      const result = await analyzeDestinationFolders(proposals);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.existingFolders).toContain('/existing/folder');
        expect(result.data.newFolders).toContain('/new/folder');
        expect(result.data.totalFolders).toBe(2);
      }
    });

    it('should treat file at path as non-existent folder', async () => {
      // Path exists but is a file, not a directory
      mockStat.mockResolvedValue({ isDirectory: () => false } as fs.Stats);

      const proposals = [
        createProposal({
          proposedPath: '/path/that/is/file/photo.jpg',
          isMoveOperation: true,
        }),
      ];

      const result = await analyzeDestinationFolders(proposals);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // File exists but not a directory, so it counts as "new folder needed"
        expect(result.data.newFolders).toContain('/path/that/is/file');
        expect(result.data.existingFolders).toHaveLength(0);
      }
    });
  });

  describe('error handling', () => {
    it('should return error when permission denied', async () => {
      mockStat.mockRejectedValue(mockEperm());

      const proposals = [
        createProposal({
          proposedPath: '/restricted/folder/photo.jpg',
          isMoveOperation: true,
        }),
      ];

      const result = await analyzeDestinationFolders(proposals);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('Failed to analyze some folders');
        expect(result.error.message).toContain('Permission denied');
      }
    });

    it('should aggregate multiple filesystem errors', async () => {
      mockStat
        .mockRejectedValueOnce(mockEperm())
        .mockRejectedValueOnce(Object.assign(new Error('Access denied'), { code: 'EACCES' }));

      const proposals = [
        createProposal({
          proposedPath: '/restricted1/photo1.jpg',
          isMoveOperation: true,
        }),
        createProposal({
          proposedPath: '/restricted2/photo2.jpg',
          isMoveOperation: true,
        }),
      ];

      const result = await analyzeDestinationFolders(proposals);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('Permission denied');
        expect(result.error.message).toContain('Access denied');
      }
    });
  });

  describe('edge cases', () => {
    it('should handle empty proposals array', async () => {
      const result = await analyzeDestinationFolders([]);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.existingFolders).toHaveLength(0);
        expect(result.data.newFolders).toHaveLength(0);
        expect(result.data.totalFolders).toBe(0);
      }
    });

    it('should handle proposals with no move operations', async () => {
      const proposals = [
        createProposal({ isMoveOperation: false }),
        createProposal({ isMoveOperation: undefined }),
      ];

      const result = await analyzeDestinationFolders(proposals);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.totalFolders).toBe(0);
      }
    });

    it('should deduplicate folders when multiple files go to same folder', async () => {
      mockStat.mockResolvedValue(mockDirectory());

      const proposals = [
        createProposal({
          proposedPath: '/organized/2026/photo1.jpg',
          isMoveOperation: true,
        }),
        createProposal({
          proposedPath: '/organized/2026/photo2.jpg',
          isMoveOperation: true,
        }),
        createProposal({
          proposedPath: '/organized/2026/photo3.jpg',
          isMoveOperation: true,
        }),
      ];

      const result = await analyzeDestinationFolders(proposals);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.totalFolders).toBe(1);
        expect(result.data.existingFolders).toEqual(['/organized/2026']);
      }
    });

    it('should return sorted folders for deterministic output', async () => {
      // Return in non-alphabetical order to verify sorting
      mockStat
        .mockResolvedValueOnce(mockDirectory()) // /z/folder
        .mockResolvedValueOnce(mockDirectory()) // /a/folder
        .mockRejectedValueOnce(mockEnoent()) // /y/new
        .mockRejectedValueOnce(mockEnoent()); // /b/new

      const proposals = [
        createProposal({ proposedPath: '/z/folder/photo.jpg', isMoveOperation: true }),
        createProposal({ proposedPath: '/a/folder/photo.jpg', isMoveOperation: true }),
        createProposal({ proposedPath: '/y/new/photo.jpg', isMoveOperation: true }),
        createProposal({ proposedPath: '/b/new/photo.jpg', isMoveOperation: true }),
      ];

      const result = await analyzeDestinationFolders(proposals);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Verify alphabetical sorting
        expect(result.data.existingFolders).toEqual(['/a/folder', '/z/folder']);
        expect(result.data.newFolders).toEqual(['/b/new', '/y/new']);
      }
    });

    it('should accept optional baseDirectory parameter', async () => {
      mockStat.mockResolvedValue(mockDirectory());

      const proposals = [
        createProposal({
          proposedPath: '/organized/2026/photo.jpg',
          isMoveOperation: true,
        }),
      ];

      // Test that baseDirectory parameter is accepted (even if not yet used)
      const result = await analyzeDestinationFolders(proposals, '/base/dir');

      expect(result.ok).toBe(true);
    });
  });
});
