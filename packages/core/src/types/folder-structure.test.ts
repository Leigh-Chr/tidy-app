/**
 * @fileoverview Tests for folder structure types - Story 8.1
 */

import { describe, expect, it } from 'vitest';
import {
  folderStructureSchema,
  createFolderStructureInputSchema,
  updateFolderStructureInputSchema,
  FolderStructureErrorCode,
  createFolderStructureError,
  type FolderStructure,
  type CreateFolderStructureInput,
  type UpdateFolderStructureInput,
} from './folder-structure.js';

describe('folder-structure types', () => {
  describe('folderStructureSchema', () => {
    it('should validate a complete folder structure', () => {
      const structure: FolderStructure = {
        id: 'fs-001',
        name: 'By Year and Month',
        pattern: '{year}/{month}',
        description: 'Organize photos by date',
        enabled: true,
        priority: 10,
        createdAt: new Date('2026-01-10'),
        updatedAt: new Date('2026-01-10'),
      };

      const result = folderStructureSchema.safeParse(structure);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe('fs-001');
        expect(result.data.name).toBe('By Year and Month');
        expect(result.data.pattern).toBe('{year}/{month}');
      }
    });

    it('should validate structure without optional description', () => {
      const structure = {
        id: 'fs-002',
        name: 'Simple',
        pattern: '{year}',
        enabled: true,
        priority: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = folderStructureSchema.safeParse(structure);
      expect(result.success).toBe(true);
    });

    it('should reject structure with empty id', () => {
      const structure = {
        id: '',
        name: 'Test',
        pattern: '{year}',
        enabled: true,
        priority: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = folderStructureSchema.safeParse(structure);
      expect(result.success).toBe(false);
    });

    it('should reject structure with empty name', () => {
      const structure = {
        id: 'fs-001',
        name: '',
        pattern: '{year}',
        enabled: true,
        priority: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = folderStructureSchema.safeParse(structure);
      expect(result.success).toBe(false);
    });

    it('should reject structure with empty pattern', () => {
      const structure = {
        id: 'fs-001',
        name: 'Test',
        pattern: '',
        enabled: true,
        priority: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = folderStructureSchema.safeParse(structure);
      expect(result.success).toBe(false);
    });

    it('should reject structure with negative priority', () => {
      const structure = {
        id: 'fs-001',
        name: 'Test',
        pattern: '{year}',
        enabled: true,
        priority: -1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = folderStructureSchema.safeParse(structure);
      expect(result.success).toBe(false);
    });

    it('should coerce date strings to Date objects', () => {
      const structure = {
        id: 'fs-001',
        name: 'Test',
        pattern: '{year}',
        enabled: true,
        priority: 0,
        createdAt: '2026-01-10T00:00:00.000Z',
        updatedAt: '2026-01-10T00:00:00.000Z',
      };

      const result = folderStructureSchema.safeParse(structure);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.createdAt).toBeInstanceOf(Date);
        expect(result.data.updatedAt).toBeInstanceOf(Date);
      }
    });
  });

  describe('createFolderStructureInputSchema', () => {
    it('should validate minimal create input', () => {
      const input: CreateFolderStructureInput = {
        name: 'By Date',
        pattern: '{year}/{month}/{day}',
      };

      const result = createFolderStructureInputSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.enabled).toBe(true); // default
      }
    });

    it('should validate complete create input', () => {
      const input = {
        name: 'Documents',
        pattern: 'Documents/{author}',
        description: 'Organize by author',
        enabled: false,
        priority: 5,
      };

      const result = createFolderStructureInputSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.enabled).toBe(false);
        expect(result.data.priority).toBe(5);
      }
    });

    it('should reject create input with empty name', () => {
      const input = {
        name: '',
        pattern: '{year}',
      };

      const result = createFolderStructureInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject create input with empty pattern', () => {
      const input = {
        name: 'Test',
        pattern: '',
      };

      const result = createFolderStructureInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('updateFolderStructureInputSchema', () => {
    it('should validate partial update with name only', () => {
      const input: UpdateFolderStructureInput = {
        name: 'New Name',
      };

      const result = updateFolderStructureInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should validate partial update with pattern only', () => {
      const input: UpdateFolderStructureInput = {
        pattern: '{year}/{month}',
      };

      const result = updateFolderStructureInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should validate empty update (no changes)', () => {
      const input: UpdateFolderStructureInput = {};

      const result = updateFolderStructureInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should validate complete update', () => {
      const input: UpdateFolderStructureInput = {
        name: 'Updated Name',
        pattern: '{date}',
        description: 'Updated description',
        enabled: true,
        priority: 20,
      };

      const result = updateFolderStructureInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject update with empty name if provided', () => {
      const input = {
        name: '',
      };

      const result = updateFolderStructureInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('FolderStructureErrorCode', () => {
    it('should have all expected error codes', () => {
      expect(FolderStructureErrorCode.NOT_FOUND).toBe('not_found');
      expect(FolderStructureErrorCode.DUPLICATE_NAME).toBe('duplicate_name');
      expect(FolderStructureErrorCode.INVALID_PATTERN).toBe('invalid_pattern');
      expect(FolderStructureErrorCode.INVALID_INPUT).toBe('invalid_input');
    });
  });

  describe('createFolderStructureError', () => {
    it('should create error without details', () => {
      const error = createFolderStructureError(
        FolderStructureErrorCode.NOT_FOUND,
        'Structure not found'
      );

      expect(error.type).toBe('not_found');
      expect(error.message).toBe('Structure not found');
      expect(error.details).toBeUndefined();
    });

    it('should create error with details', () => {
      const error = createFolderStructureError(
        FolderStructureErrorCode.INVALID_PATTERN,
        'Invalid pattern syntax',
        { pattern: '{invalid', position: 8 }
      );

      expect(error.type).toBe('invalid_pattern');
      expect(error.message).toBe('Invalid pattern syntax');
      expect(error.details).toEqual({ pattern: '{invalid', position: 8 });
    });
  });
});
