import { describe, it, expect } from 'vitest';
import {
  pdfMetadataSchema,
  createEmptyPdfMetadata,
  type PDFMetadata,
} from './pdf-metadata.js';

describe('pdfMetadataSchema', () => {
  it('validates complete metadata', () => {
    const metadata: PDFMetadata = {
      title: 'Test Document',
      author: 'John Doe',
      subject: 'Test Subject',
      keywords: 'test, pdf, metadata',
      creator: 'Microsoft Word',
      producer: 'Adobe PDF Library',
      creationDate: new Date('2024-01-15T10:30:00'),
      modificationDate: new Date('2024-06-20T14:45:00'),
      pageCount: 10,
    };

    const result = pdfMetadataSchema.safeParse(metadata);
    expect(result.success).toBe(true);
  });

  it('validates metadata with all null values', () => {
    const metadata = createEmptyPdfMetadata();

    const result = pdfMetadataSchema.safeParse(metadata);
    expect(result.success).toBe(true);
  });

  it('validates metadata with mixed null/actual values', () => {
    const metadata: PDFMetadata = {
      title: 'Only Title',
      author: null,
      subject: null,
      keywords: null,
      creator: null,
      producer: null,
      creationDate: null,
      modificationDate: null,
      pageCount: 5,
    };

    const result = pdfMetadataSchema.safeParse(metadata);
    expect(result.success).toBe(true);
  });

  it('rejects invalid date', () => {
    const invalid = {
      ...createEmptyPdfMetadata(),
      creationDate: 'not a date',
    };

    const result = pdfMetadataSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects invalid pageCount', () => {
    const invalid = {
      ...createEmptyPdfMetadata(),
      pageCount: 'not a number',
    };

    const result = pdfMetadataSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('accepts zero page count', () => {
    const metadata: PDFMetadata = {
      ...createEmptyPdfMetadata(),
      pageCount: 0,
    };

    const result = pdfMetadataSchema.safeParse(metadata);
    expect(result.success).toBe(true);
  });
});

describe('createEmptyPdfMetadata', () => {
  it('returns object with all fields set to null', () => {
    const empty = createEmptyPdfMetadata();

    expect(empty.title).toBeNull();
    expect(empty.author).toBeNull();
    expect(empty.subject).toBeNull();
    expect(empty.keywords).toBeNull();
    expect(empty.creator).toBeNull();
    expect(empty.producer).toBeNull();
    expect(empty.creationDate).toBeNull();
    expect(empty.modificationDate).toBeNull();
    expect(empty.pageCount).toBeNull();
  });

  it('returns valid PDFMetadata', () => {
    const empty = createEmptyPdfMetadata();
    const result = pdfMetadataSchema.safeParse(empty);

    expect(result.success).toBe(true);
  });

  it('returns new object each call (not shared reference)', () => {
    const empty1 = createEmptyPdfMetadata();
    const empty2 = createEmptyPdfMetadata();

    expect(empty1).not.toBe(empty2);
    expect(empty1).toEqual(empty2);
  });
});
