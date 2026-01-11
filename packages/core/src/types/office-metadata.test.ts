import { describe, it, expect } from 'vitest';
import {
  officeMetadataSchema,
  createEmptyOfficeMetadata,
  type OfficeMetadata,
} from './office-metadata.js';

describe('officeMetadataSchema', () => {
  it('validates complete metadata', () => {
    const metadata: OfficeMetadata = {
      title: 'Test Document',
      subject: 'Test Subject',
      creator: 'John Doe',
      keywords: 'test, document, office',
      description: 'A test document',
      lastModifiedBy: 'Jane Smith',
      created: new Date('2024-01-15T10:30:00'),
      modified: new Date('2024-06-20T14:45:00'),
      revision: '5',
      category: 'Reports',
      application: 'Microsoft Office Word',
      appVersion: '16.0',
      pageCount: 10,
      wordCount: 2500,
    };

    const result = officeMetadataSchema.safeParse(metadata);
    expect(result.success).toBe(true);
  });

  it('validates metadata with all null values', () => {
    const metadata = createEmptyOfficeMetadata();

    const result = officeMetadataSchema.safeParse(metadata);
    expect(result.success).toBe(true);
  });

  it('validates metadata with mixed null/actual values', () => {
    const metadata: OfficeMetadata = {
      title: 'Only Title',
      subject: null,
      creator: 'Author',
      keywords: null,
      description: null,
      lastModifiedBy: null,
      created: new Date(),
      modified: null,
      revision: null,
      category: null,
      application: 'LibreOffice Writer',
      appVersion: null,
      pageCount: 3,
      wordCount: null,
    };

    const result = officeMetadataSchema.safeParse(metadata);
    expect(result.success).toBe(true);
  });

  it('rejects invalid date', () => {
    const invalid = {
      ...createEmptyOfficeMetadata(),
      created: 'not a date',
    };

    const result = officeMetadataSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects invalid pageCount', () => {
    const invalid = {
      ...createEmptyOfficeMetadata(),
      pageCount: 'not a number',
    };

    const result = officeMetadataSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('accepts zero page and word counts', () => {
    const metadata: OfficeMetadata = {
      ...createEmptyOfficeMetadata(),
      pageCount: 0,
      wordCount: 0,
    };

    const result = officeMetadataSchema.safeParse(metadata);
    expect(result.success).toBe(true);
  });
});

describe('createEmptyOfficeMetadata', () => {
  it('returns object with all fields set to null', () => {
    const empty = createEmptyOfficeMetadata();

    expect(empty.title).toBeNull();
    expect(empty.subject).toBeNull();
    expect(empty.creator).toBeNull();
    expect(empty.keywords).toBeNull();
    expect(empty.description).toBeNull();
    expect(empty.lastModifiedBy).toBeNull();
    expect(empty.created).toBeNull();
    expect(empty.modified).toBeNull();
    expect(empty.revision).toBeNull();
    expect(empty.category).toBeNull();
    expect(empty.application).toBeNull();
    expect(empty.appVersion).toBeNull();
    expect(empty.pageCount).toBeNull();
    expect(empty.wordCount).toBeNull();
  });

  it('returns valid OfficeMetadata', () => {
    const empty = createEmptyOfficeMetadata();
    const result = officeMetadataSchema.safeParse(empty);

    expect(result.success).toBe(true);
  });

  it('returns new object each call (not shared reference)', () => {
    const empty1 = createEmptyOfficeMetadata();
    const empty2 = createEmptyOfficeMetadata();

    expect(empty1).not.toBe(empty2);
    expect(empty1).toEqual(empty2);
  });
});
