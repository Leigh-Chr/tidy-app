import { z } from 'zod';

/**
 * Zod schema for Office document metadata (OOXML format).
 *
 * Supports docx (Word), xlsx (Excel), and pptx (PowerPoint) files.
 * Properties are extracted from docProps/core.xml and docProps/app.xml.
 */
export const officeMetadataSchema = z.object({
  // Core properties (docProps/core.xml - Dublin Core)
  /** Document title */
  title: z.string().nullable(),
  /** Document subject or description */
  subject: z.string().nullable(),
  /** Document creator/author */
  creator: z.string().nullable(),
  /** Keywords or tags */
  keywords: z.string().nullable(),
  /** Extended description */
  description: z.string().nullable(),
  /** Last person to modify the document */
  lastModifiedBy: z.string().nullable(),
  /** Date the document was created */
  created: z.date().nullable(),
  /** Date the document was last modified */
  modified: z.date().nullable(),
  /** Revision number */
  revision: z.string().nullable(),
  /** Document category */
  category: z.string().nullable(),

  // Application properties (docProps/app.xml)
  /** Application that created the document (e.g., "Microsoft Office Word") */
  application: z.string().nullable(),
  /** Application version */
  appVersion: z.string().nullable(),
  /** Page count (Word documents) */
  pageCount: z.number().nullable(),
  /** Word count (Word documents) */
  wordCount: z.number().nullable(),
});

export type OfficeMetadata = z.infer<typeof officeMetadataSchema>;

/**
 * Creates an empty OfficeMetadata object with all fields set to null.
 * Used when metadata cannot be extracted or is not available.
 */
export function createEmptyOfficeMetadata(): OfficeMetadata {
  return {
    title: null,
    subject: null,
    creator: null,
    keywords: null,
    description: null,
    lastModifiedBy: null,
    created: null,
    modified: null,
    revision: null,
    category: null,
    application: null,
    appVersion: null,
    pageCount: null,
    wordCount: null,
  };
}
