import { z } from 'zod';

/**
 * Zod schema for PDF document metadata.
 *
 * All fields are nullable to handle PDFs without complete metadata.
 * The pageCount field is typically always available.
 */
export const pdfMetadataSchema = z.object({
  /** Document title from PDF info dictionary */
  title: z.string().nullable(),
  /** Document author from PDF info dictionary */
  author: z.string().nullable(),
  /** Document subject/description */
  subject: z.string().nullable(),
  /** Keywords associated with the document */
  keywords: z.string().nullable(),
  /** Application that created the original document */
  creator: z.string().nullable(),
  /** PDF producer (converter application) */
  producer: z.string().nullable(),
  /** Date the document was created */
  creationDate: z.date().nullable(),
  /** Date the document was last modified */
  modificationDate: z.date().nullable(),
  /** Number of pages in the document */
  pageCount: z.number().nullable(),
});

export type PDFMetadata = z.infer<typeof pdfMetadataSchema>;

/**
 * Creates an empty PDFMetadata object with all fields set to null.
 * Used when metadata cannot be extracted or is not available.
 */
export function createEmptyPdfMetadata(): PDFMetadata {
  return {
    title: null,
    author: null,
    subject: null,
    keywords: null,
    creator: null,
    producer: null,
    creationDate: null,
    modificationDate: null,
    pageCount: null,
  };
}
