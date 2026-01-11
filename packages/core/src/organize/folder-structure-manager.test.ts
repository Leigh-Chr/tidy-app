/**
 * @fileoverview Tests for folder structure manager - Story 8.1
 */

import { describe, expect, it, beforeEach } from 'vitest';
import {
  createFolderStructure,
  getFolderStructure,
  getFolderStructureByName,
  updateFolderStructure,
  deleteFolderStructure,
  listFolderStructures,
  listEnabledFolderStructures,
  toggleFolderStructureEnabled,
  setFolderStructurePriority,
  reorderFolderStructures,
} from './folder-structure-manager.js';
import type { FolderStructure } from '../types/folder-structure.js';
import { FolderStructureErrorCode } from '../types/folder-structure.js';

// Helper to create a test structure
function createTestStructure(overrides: Partial<FolderStructure> = {}): FolderStructure {
  return {
    id: `test-${Math.random().toString(36).substring(7)}`,
    name: 'Test Structure',
    pattern: '{year}/{month}',
    description: 'Test description',
    enabled: true,
    priority: 10,
    createdAt: new Date('2026-01-10'),
    updatedAt: new Date('2026-01-10'),
    ...overrides,
  };
}

describe('folder-structure-manager', () => {
  let structures: FolderStructure[];

  beforeEach(() => {
    structures = [];
  });

  describe('createFolderStructure', () => {
    it('should create a new folder structure with valid input', () => {
      const result = createFolderStructure(structures, {
        name: 'By Date',
        pattern: '{year}/{month}/{day}',
        description: 'Organize by date',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        const [updated, created] = result.data;
        expect(updated).toHaveLength(1);
        expect(created.name).toBe('By Date');
        expect(created.pattern).toBe('{year}/{month}/{day}');
        expect(created.description).toBe('Organize by date');
        expect(created.enabled).toBe(true);
        expect(created.id).toBeTruthy();
        expect(created.priority).toBe(10); // First structure
      }
    });

    it('should auto-assign priority when not provided', () => {
      // Create first structure
      const first = createFolderStructure(structures, {
        name: 'First',
        pattern: '{year}',
      });
      expect(first.ok).toBe(true);
      if (!first.ok) return;

      // Create second structure
      const second = createFolderStructure(first.data[0], {
        name: 'Second',
        pattern: '{month}',
      });

      expect(second.ok).toBe(true);
      if (second.ok) {
        expect(second.data[1].priority).toBe(20); // 10 + 10
      }
    });

    it('should use provided priority', () => {
      const result = createFolderStructure(structures, {
        name: 'Custom Priority',
        pattern: '{year}',
        priority: 100,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data[1].priority).toBe(100);
      }
    });

    it('should normalize pattern with backslashes', () => {
      const result = createFolderStructure(structures, {
        name: 'Windows Style',
        pattern: '{year}\\{month}\\{day}',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data[1].pattern).toBe('{year}/{month}/{day}');
      }
    });

    it('should reject duplicate name', () => {
      // Create first structure
      const first = createFolderStructure(structures, {
        name: 'Unique Name',
        pattern: '{year}',
      });
      expect(first.ok).toBe(true);
      if (!first.ok) return;

      // Try to create another with same name
      const duplicate = createFolderStructure(first.data[0], {
        name: 'Unique Name',
        pattern: '{month}',
      });

      expect(duplicate.ok).toBe(false);
      if (!duplicate.ok) {
        expect(duplicate.error.type).toBe(FolderStructureErrorCode.DUPLICATE_NAME);
      }
    });

    it('should reject duplicate name case-insensitively', () => {
      const first = createFolderStructure(structures, {
        name: 'My Structure',
        pattern: '{year}',
      });
      expect(first.ok).toBe(true);
      if (!first.ok) return;

      const duplicate = createFolderStructure(first.data[0], {
        name: 'MY STRUCTURE',
        pattern: '{month}',
      });

      expect(duplicate.ok).toBe(false);
      if (!duplicate.ok) {
        expect(duplicate.error.type).toBe(FolderStructureErrorCode.DUPLICATE_NAME);
      }
    });

    it('should reject invalid pattern', () => {
      const result = createFolderStructure(structures, {
        name: 'Invalid',
        pattern: '{unclosed',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe(FolderStructureErrorCode.INVALID_PATTERN);
      }
    });

    it('should reject empty name', () => {
      const result = createFolderStructure(structures, {
        name: '',
        pattern: '{year}',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe(FolderStructureErrorCode.INVALID_INPUT);
      }
    });

    it('should set enabled to false when specified', () => {
      const result = createFolderStructure(structures, {
        name: 'Disabled',
        pattern: '{year}',
        enabled: false,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data[1].enabled).toBe(false);
      }
    });
  });

  describe('getFolderStructure', () => {
    it('should return structure by ID', () => {
      const testStructure = createTestStructure({ id: 'test-123' });
      structures = [testStructure];

      const result = getFolderStructure(structures, 'test-123');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.id).toBe('test-123');
      }
    });

    it('should return error for non-existent ID', () => {
      const result = getFolderStructure(structures, 'non-existent');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe(FolderStructureErrorCode.NOT_FOUND);
      }
    });
  });

  describe('getFolderStructureByName', () => {
    it('should return structure by name', () => {
      const testStructure = createTestStructure({ name: 'My Structure' });
      structures = [testStructure];

      const result = getFolderStructureByName(structures, 'My Structure');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.name).toBe('My Structure');
      }
    });

    it('should be case-insensitive', () => {
      const testStructure = createTestStructure({ name: 'My Structure' });
      structures = [testStructure];

      const result = getFolderStructureByName(structures, 'MY STRUCTURE');
      expect(result.ok).toBe(true);
    });

    it('should return error for non-existent name', () => {
      const result = getFolderStructureByName(structures, 'Non Existent');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe(FolderStructureErrorCode.NOT_FOUND);
      }
    });
  });

  describe('updateFolderStructure', () => {
    it('should update name', () => {
      const testStructure = createTestStructure({ id: 'test-123', name: 'Old Name' });
      structures = [testStructure];

      const result = updateFolderStructure(structures, 'test-123', { name: 'New Name' });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data[1].name).toBe('New Name');
        expect(result.data[1].updatedAt.getTime()).toBeGreaterThan(
          testStructure.updatedAt.getTime()
        );
      }
    });

    it('should update pattern and normalize', () => {
      const testStructure = createTestStructure({ id: 'test-123' });
      structures = [testStructure];

      const result = updateFolderStructure(structures, 'test-123', {
        pattern: '{year}\\{month}',
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data[1].pattern).toBe('{year}/{month}');
      }
    });

    it('should reject update to duplicate name', () => {
      const struct1 = createTestStructure({ id: 'test-1', name: 'First' });
      const struct2 = createTestStructure({ id: 'test-2', name: 'Second' });
      structures = [struct1, struct2];

      const result = updateFolderStructure(structures, 'test-2', { name: 'First' });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe(FolderStructureErrorCode.DUPLICATE_NAME);
      }
    });

    it('should allow updating to same name (no change)', () => {
      const testStructure = createTestStructure({ id: 'test-123', name: 'Same Name' });
      structures = [testStructure];

      const result = updateFolderStructure(structures, 'test-123', { name: 'Same Name' });
      expect(result.ok).toBe(true);
    });

    it('should reject invalid pattern on update', () => {
      const testStructure = createTestStructure({ id: 'test-123' });
      structures = [testStructure];

      const result = updateFolderStructure(structures, 'test-123', { pattern: '{unclosed' });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe(FolderStructureErrorCode.INVALID_PATTERN);
      }
    });

    it('should return error for non-existent ID', () => {
      const result = updateFolderStructure(structures, 'non-existent', { name: 'New' });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe(FolderStructureErrorCode.NOT_FOUND);
      }
    });
  });

  describe('deleteFolderStructure', () => {
    it('should delete structure by ID', () => {
      const struct1 = createTestStructure({ id: 'test-1' });
      const struct2 = createTestStructure({ id: 'test-2' });
      structures = [struct1, struct2];

      const result = deleteFolderStructure(structures, 'test-1');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0]!.id).toBe('test-2');
      }
    });

    it('should return error for non-existent ID', () => {
      const result = deleteFolderStructure(structures, 'non-existent');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe(FolderStructureErrorCode.NOT_FOUND);
      }
    });
  });

  describe('listFolderStructures', () => {
    it('should return all structures sorted by priority', () => {
      structures = [
        createTestStructure({ id: '1', name: 'Third', priority: 30 }),
        createTestStructure({ id: '2', name: 'First', priority: 10 }),
        createTestStructure({ id: '3', name: 'Second', priority: 20 }),
      ];

      const result = listFolderStructures(structures);
      expect(result).toHaveLength(3);
      expect(result[0]!.name).toBe('First');
      expect(result[1]!.name).toBe('Second');
      expect(result[2]!.name).toBe('Third');
    });

    it('should return empty array for empty structures', () => {
      const result = listFolderStructures([]);
      expect(result).toHaveLength(0);
    });
  });

  describe('listEnabledFolderStructures', () => {
    it('should return only enabled structures sorted by priority', () => {
      structures = [
        createTestStructure({ id: '1', name: 'Enabled1', priority: 20, enabled: true }),
        createTestStructure({ id: '2', name: 'Disabled', priority: 10, enabled: false }),
        createTestStructure({ id: '3', name: 'Enabled2', priority: 15, enabled: true }),
      ];

      const result = listEnabledFolderStructures(structures);
      expect(result).toHaveLength(2);
      expect(result[0]!.name).toBe('Enabled2');
      expect(result[1]!.name).toBe('Enabled1');
    });
  });

  describe('toggleFolderStructureEnabled', () => {
    it('should toggle enabled from true to false', () => {
      const testStructure = createTestStructure({ id: 'test-123', enabled: true });
      structures = [testStructure];

      const result = toggleFolderStructureEnabled(structures, 'test-123');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data[1].enabled).toBe(false);
      }
    });

    it('should toggle enabled from false to true', () => {
      const testStructure = createTestStructure({ id: 'test-123', enabled: false });
      structures = [testStructure];

      const result = toggleFolderStructureEnabled(structures, 'test-123');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data[1].enabled).toBe(true);
      }
    });

    it('should return error for non-existent ID', () => {
      const result = toggleFolderStructureEnabled(structures, 'non-existent');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe(FolderStructureErrorCode.NOT_FOUND);
      }
    });
  });

  describe('setFolderStructurePriority', () => {
    it('should set new priority', () => {
      const testStructure = createTestStructure({ id: 'test-123', priority: 10 });
      structures = [testStructure];

      const result = setFolderStructurePriority(structures, 'test-123', 50);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data[0]!.priority).toBe(50);
      }
    });

    it('should reject negative priority', () => {
      const testStructure = createTestStructure({ id: 'test-123' });
      structures = [testStructure];

      const result = setFolderStructurePriority(structures, 'test-123', -5);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe(FolderStructureErrorCode.INVALID_INPUT);
      }
    });

    it('should reject non-integer priority', () => {
      const testStructure = createTestStructure({ id: 'test-123' });
      structures = [testStructure];

      const result = setFolderStructurePriority(structures, 'test-123', 10.5);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe(FolderStructureErrorCode.INVALID_INPUT);
      }
    });

    it('should return error for non-existent ID', () => {
      const result = setFolderStructurePriority(structures, 'non-existent', 50);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe(FolderStructureErrorCode.NOT_FOUND);
      }
    });
  });

  describe('reorderFolderStructures', () => {
    it('should reorder structures with new priorities', () => {
      structures = [
        createTestStructure({ id: '1', name: 'A', priority: 10 }),
        createTestStructure({ id: '2', name: 'B', priority: 20 }),
        createTestStructure({ id: '3', name: 'C', priority: 30 }),
      ];

      const result = reorderFolderStructures(structures, ['3', '1', '2']);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data[0]!.id).toBe('3');
        expect(result.data[0]!.priority).toBe(10);
        expect(result.data[1]!.id).toBe('1');
        expect(result.data[1]!.priority).toBe(20);
        expect(result.data[2]!.id).toBe('2');
        expect(result.data[2]!.priority).toBe(30);
      }
    });

    it('should handle partial reorder (missing IDs appended)', () => {
      structures = [
        createTestStructure({ id: '1', name: 'A' }),
        createTestStructure({ id: '2', name: 'B' }),
        createTestStructure({ id: '3', name: 'C' }),
      ];

      const result = reorderFolderStructures(structures, ['2']);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toHaveLength(3);
        expect(result.data[0]!.id).toBe('2');
        expect(result.data[0]!.priority).toBe(10);
        // Remaining structures appended
        expect(result.data.slice(1).map((s) => s.id).sort()).toEqual(['1', '3']);
      }
    });

    it('should return error for non-existent IDs', () => {
      const result = reorderFolderStructures(structures, ['non-existent']);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe(FolderStructureErrorCode.NOT_FOUND);
      }
    });

    it('should return error for duplicate IDs', () => {
      structures = [
        createTestStructure({ id: '1' }),
        createTestStructure({ id: '2' }),
      ];

      const result = reorderFolderStructures(structures, ['1', '1']);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe(FolderStructureErrorCode.INVALID_INPUT);
      }
    });
  });
});
