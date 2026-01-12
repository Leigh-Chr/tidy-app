import { z } from 'zod';
import { FileCategory } from './file-category.js';
import { MetadataCapability } from './metadata-capability.js';

/**
 * Schema for file information.
 * Use fileInfoSchema.parse() for runtime validation.
 */
export const fileInfoSchema = z.object({
  // Core properties
  /** Absolute path to the file */
  path: z.string().min(1, 'Path cannot be empty'),
  /** File name without extension */
  name: z.string().min(1, 'Name cannot be empty'),
  /** File extension without dot (e.g., "jpg") or empty string */
  extension: z.string(),
  /** Full filename with extension (e.g., "photo.jpg") */
  fullName: z.string().min(1, 'Full name cannot be empty'),

  // File system metadata (always available - FR9)
  /** File size in bytes */
  size: z.number().nonnegative(),
  /** File creation timestamp */
  createdAt: z.date(),
  /** File modification timestamp */
  modifiedAt: z.date(),

  // Organization helpers
  /** Relative path from scan root (for recursive scans) */
  relativePath: z.string().optional(),
  /** MIME type (e.g., "image/jpeg") */
  mimeType: z.string().optional(),
  /** File category (image, document, video, audio, archive, code, data, other) */
  category: z.enum([
    FileCategory.IMAGE,
    FileCategory.DOCUMENT,
    FileCategory.VIDEO,
    FileCategory.AUDIO,
    FileCategory.ARCHIVE,
    FileCategory.CODE,
    FileCategory.DATA,
    FileCategory.OTHER,
  ]),

  // Metadata support
  /** Whether full metadata extraction is supported for this file type */
  metadataSupported: z.boolean(),
  /** Level of metadata extraction capability */
  metadataCapability: z.enum([MetadataCapability.FULL, MetadataCapability.BASIC]),
});

/**
 * Information about a file in the file system.
 * Inferred from Zod schema for type safety.
 */
export type FileInfo = z.infer<typeof fileInfoSchema>;
