/**
 * @fileoverview Tests for condition evaluator - Story 7.1
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  evaluateCondition,
  evaluateConditions,
  clearRegexCache,
} from './condition-evaluator.js';
import type { RuleCondition } from '../types/rule.js';
import type { UnifiedMetadata } from '../types/unified-metadata.js';
import { FileCategory } from '../types/file-category.js';
import { MetadataCapability } from '../types/metadata-capability.js';

// =============================================================================
// Test Fixtures
// =============================================================================

function createTestMetadata(): UnifiedMetadata {
  return {
    file: {
      path: '/photos/IMG_1234.jpg',
      name: 'IMG_1234',
      extension: 'jpg',
      fullName: 'IMG_1234.jpg',
      size: 2500000,
      createdAt: new Date('2026-01-10T10:00:00Z'),
      modifiedAt: new Date('2026-01-10T11:00:00Z'),
      relativePath: 'photos/IMG_1234.jpg',
      mimeType: 'image/jpeg',
      category: FileCategory.IMAGE,
      metadataSupported: true,
      metadataCapability: MetadataCapability.FULL,
    },
    image: {
      dateTaken: new Date('2026-01-05T14:30:00Z'),
      cameraMake: 'Apple',
      cameraModel: 'iPhone 15 Pro',
      gps: { latitude: 48.8584, longitude: 2.2945 },
      width: 4032,
      height: 3024,
      orientation: 1,
      exposureTime: '1/125',
      fNumber: 1.78,
      iso: 100,
    },
    pdf: null,
    office: null,
    extractionStatus: 'success',
    extractionError: null,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('evaluateCondition', () => {
  beforeEach(() => {
    clearRegexCache();
  });

  describe('equals operator', () => {
    const metadata = createTestMetadata();

    it('matches exact value (case-insensitive)', () => {
      const condition: RuleCondition = {
        field: 'image.cameraMake',
        operator: 'equals',
        value: 'apple',
        caseSensitive: false,
      };

      const result = evaluateCondition(condition, metadata);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.matched).toBe(true);
        expect(result.data.resolvedValue).toBe('Apple');
      }
    });

    it('matches exact value (case-sensitive)', () => {
      const condition: RuleCondition = {
        field: 'image.cameraMake',
        operator: 'equals',
        value: 'Apple',
        caseSensitive: true,
      };

      const result = evaluateCondition(condition, metadata);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.matched).toBe(true);
      }
    });

    it('does not match different case when case-sensitive', () => {
      const condition: RuleCondition = {
        field: 'image.cameraMake',
        operator: 'equals',
        value: 'apple',
        caseSensitive: true,
      };

      const result = evaluateCondition(condition, metadata);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.matched).toBe(false);
      }
    });

    it('does not match different value', () => {
      const condition: RuleCondition = {
        field: 'image.cameraMake',
        operator: 'equals',
        value: 'Samsung',
        caseSensitive: false,
      };

      const result = evaluateCondition(condition, metadata);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.matched).toBe(false);
      }
    });

    it('matches file.category enum value', () => {
      const condition: RuleCondition = {
        field: 'file.category',
        operator: 'equals',
        value: 'image',
        caseSensitive: false,
      };

      const result = evaluateCondition(condition, metadata);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.matched).toBe(true);
      }
    });
  });

  describe('contains operator', () => {
    const metadata = createTestMetadata();

    it('matches substring (case-insensitive)', () => {
      const condition: RuleCondition = {
        field: 'image.cameraModel',
        operator: 'contains',
        value: 'iphone',
        caseSensitive: false,
      };

      const result = evaluateCondition(condition, metadata);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.matched).toBe(true);
      }
    });

    it('matches substring (case-sensitive)', () => {
      const condition: RuleCondition = {
        field: 'image.cameraModel',
        operator: 'contains',
        value: 'iPhone',
        caseSensitive: true,
      };

      const result = evaluateCondition(condition, metadata);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.matched).toBe(true);
      }
    });

    it('does not match wrong case when case-sensitive', () => {
      const condition: RuleCondition = {
        field: 'image.cameraModel',
        operator: 'contains',
        value: 'iphone',
        caseSensitive: true,
      };

      const result = evaluateCondition(condition, metadata);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.matched).toBe(false);
      }
    });

    it('does not match non-existent substring', () => {
      const condition: RuleCondition = {
        field: 'image.cameraModel',
        operator: 'contains',
        value: 'Samsung',
        caseSensitive: false,
      };

      const result = evaluateCondition(condition, metadata);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.matched).toBe(false);
      }
    });
  });

  describe('startsWith operator', () => {
    const metadata = createTestMetadata();

    it('matches prefix (case-insensitive)', () => {
      const condition: RuleCondition = {
        field: 'file.name',
        operator: 'startsWith',
        value: 'img',
        caseSensitive: false,
      };

      const result = evaluateCondition(condition, metadata);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.matched).toBe(true);
      }
    });

    it('matches prefix (case-sensitive)', () => {
      const condition: RuleCondition = {
        field: 'file.name',
        operator: 'startsWith',
        value: 'IMG',
        caseSensitive: true,
      };

      const result = evaluateCondition(condition, metadata);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.matched).toBe(true);
      }
    });

    it('does not match wrong case when case-sensitive', () => {
      const condition: RuleCondition = {
        field: 'file.name',
        operator: 'startsWith',
        value: 'img',
        caseSensitive: true,
      };

      const result = evaluateCondition(condition, metadata);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.matched).toBe(false);
      }
    });

    it('does not match non-prefix', () => {
      const condition: RuleCondition = {
        field: 'file.name',
        operator: 'startsWith',
        value: '1234',
        caseSensitive: false,
      };

      const result = evaluateCondition(condition, metadata);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.matched).toBe(false);
      }
    });
  });

  describe('endsWith operator', () => {
    const metadata = createTestMetadata();

    it('matches suffix (case-insensitive)', () => {
      const condition: RuleCondition = {
        field: 'file.fullName',
        operator: 'endsWith',
        value: '.JPG',
        caseSensitive: false,
      };

      const result = evaluateCondition(condition, metadata);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.matched).toBe(true);
      }
    });

    it('matches suffix (case-sensitive)', () => {
      const condition: RuleCondition = {
        field: 'file.fullName',
        operator: 'endsWith',
        value: '.jpg',
        caseSensitive: true,
      };

      const result = evaluateCondition(condition, metadata);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.matched).toBe(true);
      }
    });

    it('does not match wrong case when case-sensitive', () => {
      const condition: RuleCondition = {
        field: 'file.fullName',
        operator: 'endsWith',
        value: '.JPG',
        caseSensitive: true,
      };

      const result = evaluateCondition(condition, metadata);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.matched).toBe(false);
      }
    });
  });

  describe('regex operator', () => {
    const metadata = createTestMetadata();

    it('matches regex pattern', () => {
      const condition: RuleCondition = {
        field: 'file.name',
        operator: 'regex',
        value: '^IMG_\\d+$',
        caseSensitive: false,
      };

      const result = evaluateCondition(condition, metadata);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.matched).toBe(true);
      }
    });

    it('matches regex case-insensitive', () => {
      const condition: RuleCondition = {
        field: 'file.name',
        operator: 'regex',
        value: '^img_\\d+$',
        caseSensitive: false,
      };

      const result = evaluateCondition(condition, metadata);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.matched).toBe(true);
      }
    });

    it('respects case-sensitive flag', () => {
      const condition: RuleCondition = {
        field: 'file.name',
        operator: 'regex',
        value: '^img_\\d+$',
        caseSensitive: true,
      };

      const result = evaluateCondition(condition, metadata);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.matched).toBe(false); // lowercase pattern, uppercase value
      }
    });

    it('does not match non-matching pattern', () => {
      const condition: RuleCondition = {
        field: 'file.name',
        operator: 'regex',
        value: '^DSC_\\d+$',
        caseSensitive: false,
      };

      const result = evaluateCondition(condition, metadata);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.matched).toBe(false);
      }
    });

    it('returns error for invalid regex', () => {
      const condition: RuleCondition = {
        field: 'file.name',
        operator: 'regex',
        value: '[invalid(regex',
        caseSensitive: false,
      };

      const result = evaluateCondition(condition, metadata);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('INVALID_REGEX');
        expect(result.error.fieldPath).toBe('file.name');
      }
    });

    it('caches compiled regex', () => {
      const condition: RuleCondition = {
        field: 'file.name',
        operator: 'regex',
        value: '^IMG_\\d+$',
        caseSensitive: false,
      };

      // First call
      evaluateCondition(condition, metadata);
      // Second call should use cache
      const result = evaluateCondition(condition, metadata);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.matched).toBe(true);
      }
    });
  });

  describe('exists operator', () => {
    const metadata = createTestMetadata();

    it('matches when field exists', () => {
      const condition: RuleCondition = {
        field: 'image.cameraMake',
        operator: 'exists',
        caseSensitive: false,
      };

      const result = evaluateCondition(condition, metadata);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.matched).toBe(true);
      }
    });

    it('does not match when field is null', () => {
      const metadataWithNull: UnifiedMetadata = {
        ...metadata,
        image: { ...metadata.image!, cameraMake: null },
      };

      const condition: RuleCondition = {
        field: 'image.cameraMake',
        operator: 'exists',
        caseSensitive: false,
      };

      const result = evaluateCondition(condition, metadataWithNull);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.matched).toBe(false);
      }
    });

    it('does not match when namespace is null', () => {
      const condition: RuleCondition = {
        field: 'pdf.author',
        operator: 'exists',
        caseSensitive: false,
      };

      const result = evaluateCondition(condition, metadata);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.matched).toBe(false);
      }
    });

    it('matches when GPS exists', () => {
      const condition: RuleCondition = {
        field: 'image.gps',
        operator: 'exists',
        caseSensitive: false,
      };

      const result = evaluateCondition(condition, metadata);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.matched).toBe(true);
      }
    });
  });

  describe('notExists operator', () => {
    const metadata = createTestMetadata();

    it('matches when field does not exist', () => {
      const condition: RuleCondition = {
        field: 'pdf.author',
        operator: 'notExists',
        caseSensitive: false,
      };

      const result = evaluateCondition(condition, metadata);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.matched).toBe(true);
      }
    });

    it('does not match when field exists', () => {
      const condition: RuleCondition = {
        field: 'image.cameraMake',
        operator: 'notExists',
        caseSensitive: false,
      };

      const result = evaluateCondition(condition, metadata);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.matched).toBe(false);
      }
    });

    it('matches when field is null', () => {
      const metadataWithNull: UnifiedMetadata = {
        ...metadata,
        image: { ...metadata.image!, cameraMake: null },
      };

      const condition: RuleCondition = {
        field: 'image.cameraMake',
        operator: 'notExists',
        caseSensitive: false,
      };

      const result = evaluateCondition(condition, metadataWithNull);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.matched).toBe(true);
      }
    });
  });

  describe('edge cases', () => {
    const metadata = createTestMetadata();

    it('returns not matched for non-existent field with equals', () => {
      const condition: RuleCondition = {
        field: 'pdf.author',
        operator: 'equals',
        value: 'John',
        caseSensitive: false,
      };

      const result = evaluateCondition(condition, metadata);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.matched).toBe(false);
        expect(result.data.resolvedValue).toBeNull();
      }
    });

    it('handles empty string value', () => {
      const metadataWithEmpty: UnifiedMetadata = {
        ...metadata,
        file: { ...metadata.file, extension: '' },
      };

      const condition: RuleCondition = {
        field: 'file.extension',
        operator: 'equals',
        value: '',
        caseSensitive: false,
      };

      const result = evaluateCondition(condition, metadataWithEmpty);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.matched).toBe(true);
      }
    });

    it('provides debug information in result', () => {
      const condition: RuleCondition = {
        field: 'image.cameraMake',
        operator: 'contains',
        value: 'Samsung',
        caseSensitive: false,
      };

      const result = evaluateCondition(condition, metadata);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.fieldPath).toBe('image.cameraMake');
        expect(result.data.resolvedValue).toBe('Apple');
        expect(result.data.expectedValue).toBe('Samsung');
        expect(result.data.matched).toBe(false);
      }
    });
  });
});

describe('evaluateConditions', () => {
  const metadata = createTestMetadata();

  it('evaluates multiple conditions', () => {
    const conditions: RuleCondition[] = [
      { field: 'image.cameraMake', operator: 'contains', value: 'Apple', caseSensitive: false },
      { field: 'file.extension', operator: 'equals', value: 'jpg', caseSensitive: false },
    ];

    const results = evaluateConditions(conditions, metadata);

    expect(results).toHaveLength(2);
    expect(results[0].ok).toBe(true);
    expect(results[1].ok).toBe(true);

    if (results[0].ok) {
      expect(results[0].data.matched).toBe(true);
    }
    if (results[1].ok) {
      expect(results[1].data.matched).toBe(true);
    }
  });

  it('returns mix of matched and unmatched', () => {
    const conditions: RuleCondition[] = [
      { field: 'image.cameraMake', operator: 'contains', value: 'Apple', caseSensitive: false },
      { field: 'image.cameraMake', operator: 'equals', value: 'Samsung', caseSensitive: false },
    ];

    const results = evaluateConditions(conditions, metadata);

    expect(results).toHaveLength(2);
    if (results[0].ok) {
      expect(results[0].data.matched).toBe(true);
    }
    if (results[1].ok) {
      expect(results[1].data.matched).toBe(false);
    }
  });

  it('handles empty conditions array', () => {
    const results = evaluateConditions([], metadata);
    expect(results).toHaveLength(0);
  });
});
