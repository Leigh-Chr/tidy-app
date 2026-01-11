import { z } from 'zod';
import { fileInfoSchema } from './file-info.js';
import { imageMetadataSchema } from './image-metadata.js';
import { pdfMetadataSchema } from './pdf-metadata.js';
import { officeMetadataSchema } from './office-metadata.js';

/**
 * Extraction status for unified metadata.
 *
 * - 'success': Extraction completed (metadata may still have null fields if source lacks data)
 * - 'partial': Reserved for future use when extraction partially fails (e.g., corrupt metadata block)
 * - 'failed': Extraction failed entirely (file unreadable, corrupted, encrypted)
 * - 'unsupported': File type does not support metadata extraction
 */
export const extractionStatusSchema = z.enum([
  'success',
  'partial',
  'failed',
  'unsupported',
]);

export type ExtractionStatus = z.infer<typeof extractionStatusSchema>;

/**
 * Unified metadata schema combining file info with type-specific metadata.
 *
 * This is the primary interface for viewing all available metadata for a file.
 * Only one of image/pdf/office will be populated based on file type.
 */
export const unifiedMetadataSchema = z.object({
  /** Base file information (always present) */
  file: fileInfoSchema,

  /** Image metadata (EXIF) - only populated for images */
  image: imageMetadataSchema.nullable(),

  /** PDF metadata - only populated for PDF files */
  pdf: pdfMetadataSchema.nullable(),

  /** Office metadata - only populated for docx/xlsx/pptx files */
  office: officeMetadataSchema.nullable(),

  /** Status of metadata extraction */
  extractionStatus: extractionStatusSchema,

  /** Error message if extraction failed */
  extractionError: z.string().nullable(),
});

export type UnifiedMetadata = z.infer<typeof unifiedMetadataSchema>;

/**
 * Creates an empty unified metadata object for a file.
 * Used as a base before type-specific metadata extraction.
 */
export function createEmptyUnifiedMetadata(file: z.infer<typeof fileInfoSchema>): UnifiedMetadata {
  return {
    file,
    image: null,
    pdf: null,
    office: null,
    extractionStatus: 'unsupported',
    extractionError: null,
  };
}
