/**
 * File Type Registry.
 * Central registry of supported file types with their capabilities.
 */

import { FileCategory } from './file-category.js';
import { MetadataCapability } from './metadata-capability.js';

/**
 * Information about a file type.
 */
export interface FileTypeInfo {
  /** File extensions (lowercase, without dot) */
  extensions: string[];
  /** File category */
  category: FileCategory;
  /** Metadata extraction capability level */
  metadataCapability: MetadataCapability;
  /** MIME types for this file type */
  mimeTypes: string[];
  /** Human-readable description */
  description: string;
  /** Extractor module reference (for Epic 2) */
  extractorModule?: string;
}

/**
 * Registry of all supported file types.
 * Used for file categorization and metadata capability detection.
 */
export const FILE_TYPE_REGISTRY: FileTypeInfo[] = [
  // Images with EXIF metadata support
  {
    extensions: ['jpg', 'jpeg'],
    category: FileCategory.IMAGE,
    metadataCapability: MetadataCapability.FULL,
    mimeTypes: ['image/jpeg'],
    description: 'JPEG Image',
    extractorModule: 'exif',
  },
  {
    extensions: ['png'],
    category: FileCategory.IMAGE,
    metadataCapability: MetadataCapability.FULL,
    mimeTypes: ['image/png'],
    description: 'PNG Image',
    extractorModule: 'exif',
  },
  {
    extensions: ['heic', 'heif'],
    category: FileCategory.IMAGE,
    metadataCapability: MetadataCapability.FULL,
    mimeTypes: ['image/heic', 'image/heif'],
    description: 'HEIC Image',
    extractorModule: 'exif',
  },
  {
    extensions: ['webp'],
    category: FileCategory.IMAGE,
    metadataCapability: MetadataCapability.FULL,
    mimeTypes: ['image/webp'],
    description: 'WebP Image',
    extractorModule: 'exif',
  },
  {
    extensions: ['gif'],
    category: FileCategory.IMAGE,
    metadataCapability: MetadataCapability.FULL,
    mimeTypes: ['image/gif'],
    description: 'GIF Image',
    extractorModule: 'exif',
  },
  {
    extensions: ['tiff', 'tif'],
    category: FileCategory.IMAGE,
    metadataCapability: MetadataCapability.FULL,
    mimeTypes: ['image/tiff'],
    description: 'TIFF Image',
    extractorModule: 'exif',
  },
  {
    extensions: ['bmp'],
    category: FileCategory.IMAGE,
    metadataCapability: MetadataCapability.BASIC,
    mimeTypes: ['image/bmp'],
    description: 'BMP Image',
  },
  {
    extensions: ['svg'],
    category: FileCategory.IMAGE,
    metadataCapability: MetadataCapability.BASIC,
    mimeTypes: ['image/svg+xml'],
    description: 'SVG Image',
  },

  // PDF documents
  {
    extensions: ['pdf'],
    category: FileCategory.DOCUMENT,
    metadataCapability: MetadataCapability.FULL,
    mimeTypes: ['application/pdf'],
    description: 'PDF Document',
    extractorModule: 'pdf',
  },

  // Office documents (Open XML format)
  {
    extensions: ['docx'],
    category: FileCategory.DOCUMENT,
    metadataCapability: MetadataCapability.FULL,
    mimeTypes: [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
    description: 'Word Document',
    extractorModule: 'office',
  },
  {
    extensions: ['doc'],
    category: FileCategory.DOCUMENT,
    metadataCapability: MetadataCapability.BASIC,
    mimeTypes: ['application/msword'],
    description: 'Legacy Word Document',
  },
  {
    extensions: ['xlsx'],
    category: FileCategory.DOCUMENT,
    metadataCapability: MetadataCapability.FULL,
    mimeTypes: [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ],
    description: 'Excel Spreadsheet',
    extractorModule: 'office',
  },
  {
    extensions: ['xls'],
    category: FileCategory.DOCUMENT,
    metadataCapability: MetadataCapability.BASIC,
    mimeTypes: ['application/vnd.ms-excel'],
    description: 'Legacy Excel Spreadsheet',
  },
  {
    extensions: ['pptx'],
    category: FileCategory.DOCUMENT,
    metadataCapability: MetadataCapability.FULL,
    mimeTypes: [
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ],
    description: 'PowerPoint Presentation',
    extractorModule: 'office',
  },
  {
    extensions: ['ppt'],
    category: FileCategory.DOCUMENT,
    metadataCapability: MetadataCapability.BASIC,
    mimeTypes: ['application/vnd.ms-powerpoint'],
    description: 'Legacy PowerPoint Presentation',
  },

  // Text-based documents (basic metadata only)
  {
    extensions: ['txt'],
    category: FileCategory.DOCUMENT,
    metadataCapability: MetadataCapability.BASIC,
    mimeTypes: ['text/plain'],
    description: 'Text File',
  },
  {
    extensions: ['md', 'markdown'],
    category: FileCategory.DOCUMENT,
    metadataCapability: MetadataCapability.BASIC,
    mimeTypes: ['text/markdown'],
    description: 'Markdown File',
  },
  {
    extensions: ['csv'],
    category: FileCategory.DOCUMENT,
    metadataCapability: MetadataCapability.BASIC,
    mimeTypes: ['text/csv'],
    description: 'CSV File',
  },
  {
    extensions: ['rtf'],
    category: FileCategory.DOCUMENT,
    metadataCapability: MetadataCapability.BASIC,
    mimeTypes: ['application/rtf'],
    description: 'Rich Text File',
  },

  // Video files
  {
    extensions: ['mp4'],
    category: FileCategory.VIDEO,
    metadataCapability: MetadataCapability.BASIC,
    mimeTypes: ['video/mp4'],
    description: 'MP4 Video',
  },
  {
    extensions: ['avi'],
    category: FileCategory.VIDEO,
    metadataCapability: MetadataCapability.BASIC,
    mimeTypes: ['video/x-msvideo'],
    description: 'AVI Video',
  },
  {
    extensions: ['mkv'],
    category: FileCategory.VIDEO,
    metadataCapability: MetadataCapability.BASIC,
    mimeTypes: ['video/x-matroska'],
    description: 'Matroska Video',
  },
  {
    extensions: ['mov'],
    category: FileCategory.VIDEO,
    metadataCapability: MetadataCapability.BASIC,
    mimeTypes: ['video/quicktime'],
    description: 'QuickTime Video',
  },
  {
    extensions: ['webm'],
    category: FileCategory.VIDEO,
    metadataCapability: MetadataCapability.BASIC,
    mimeTypes: ['video/webm'],
    description: 'WebM Video',
  },

  // Audio files
  {
    extensions: ['mp3'],
    category: FileCategory.AUDIO,
    metadataCapability: MetadataCapability.BASIC,
    mimeTypes: ['audio/mpeg'],
    description: 'MP3 Audio',
  },
  {
    extensions: ['wav'],
    category: FileCategory.AUDIO,
    metadataCapability: MetadataCapability.BASIC,
    mimeTypes: ['audio/wav'],
    description: 'WAV Audio',
  },
  {
    extensions: ['flac'],
    category: FileCategory.AUDIO,
    metadataCapability: MetadataCapability.BASIC,
    mimeTypes: ['audio/flac'],
    description: 'FLAC Audio',
  },
  {
    extensions: ['ogg'],
    category: FileCategory.AUDIO,
    metadataCapability: MetadataCapability.BASIC,
    mimeTypes: ['audio/ogg'],
    description: 'OGG Audio',
  },
  {
    extensions: ['m4a'],
    category: FileCategory.AUDIO,
    metadataCapability: MetadataCapability.BASIC,
    mimeTypes: ['audio/mp4'],
    description: 'M4A Audio',
  },

  // Archive files
  {
    extensions: ['zip'],
    category: FileCategory.ARCHIVE,
    metadataCapability: MetadataCapability.BASIC,
    mimeTypes: ['application/zip'],
    description: 'ZIP Archive',
  },
  {
    extensions: ['tar'],
    category: FileCategory.ARCHIVE,
    metadataCapability: MetadataCapability.BASIC,
    mimeTypes: ['application/x-tar'],
    description: 'TAR Archive',
  },
  {
    extensions: ['gz'],
    category: FileCategory.ARCHIVE,
    metadataCapability: MetadataCapability.BASIC,
    mimeTypes: ['application/gzip'],
    description: 'GZIP Archive',
  },
  {
    extensions: ['7z'],
    category: FileCategory.ARCHIVE,
    metadataCapability: MetadataCapability.BASIC,
    mimeTypes: ['application/x-7z-compressed'],
    description: '7-Zip Archive',
  },
  {
    extensions: ['rar'],
    category: FileCategory.ARCHIVE,
    metadataCapability: MetadataCapability.BASIC,
    mimeTypes: ['application/vnd.rar'],
    description: 'RAR Archive',
  },

  // Code files
  {
    extensions: ['js'],
    category: FileCategory.CODE,
    metadataCapability: MetadataCapability.BASIC,
    mimeTypes: ['application/javascript'],
    description: 'JavaScript File',
  },
  {
    extensions: ['ts'],
    category: FileCategory.CODE,
    metadataCapability: MetadataCapability.BASIC,
    mimeTypes: ['application/typescript'],
    description: 'TypeScript File',
  },
  {
    extensions: ['py'],
    category: FileCategory.CODE,
    metadataCapability: MetadataCapability.BASIC,
    mimeTypes: ['text/x-python'],
    description: 'Python File',
  },
  {
    extensions: ['rs'],
    category: FileCategory.CODE,
    metadataCapability: MetadataCapability.BASIC,
    mimeTypes: ['text/x-rust'],
    description: 'Rust File',
  },
  {
    extensions: ['json'],
    category: FileCategory.CODE,
    metadataCapability: MetadataCapability.BASIC,
    mimeTypes: ['application/json'],
    description: 'JSON File',
  },
  {
    extensions: ['xml'],
    category: FileCategory.CODE,
    metadataCapability: MetadataCapability.BASIC,
    mimeTypes: ['application/xml', 'text/xml'],
    description: 'XML File',
  },
  {
    extensions: ['yaml', 'yml'],
    category: FileCategory.CODE,
    metadataCapability: MetadataCapability.BASIC,
    mimeTypes: ['application/x-yaml'],
    description: 'YAML File',
  },
  {
    extensions: ['html', 'htm'],
    category: FileCategory.CODE,
    metadataCapability: MetadataCapability.BASIC,
    mimeTypes: ['text/html'],
    description: 'HTML File',
  },
  {
    extensions: ['css'],
    category: FileCategory.CODE,
    metadataCapability: MetadataCapability.BASIC,
    mimeTypes: ['text/css'],
    description: 'CSS File',
  },

  // Data files
  {
    extensions: ['db', 'sqlite'],
    category: FileCategory.DATA,
    metadataCapability: MetadataCapability.BASIC,
    mimeTypes: ['application/x-sqlite3'],
    description: 'SQLite Database',
  },
];

// Build lookup maps for fast access
const extensionMap = new Map<string, FileTypeInfo>();
FILE_TYPE_REGISTRY.forEach((info) => {
  info.extensions.forEach((ext) => {
    extensionMap.set(ext.toLowerCase(), info);
  });
});

/**
 * Get file type information for an extension.
 *
 * @param extension - File extension (with or without dot, case insensitive)
 * @returns FileTypeInfo or undefined if extension is not registered
 *
 * @example
 * ```typescript
 * const info = getFileTypeInfo('jpg');
 * // { extensions: ['jpg', 'jpeg'], category: 'image', ... }
 * ```
 */
export function getFileTypeInfo(extension: string): FileTypeInfo | undefined {
  const normalizedExt = extension.startsWith('.')
    ? extension.slice(1).toLowerCase()
    : extension.toLowerCase();
  return extensionMap.get(normalizedExt);
}

/**
 * Get metadata capability for an extension.
 *
 * @param extension - File extension (with or without dot, case insensitive)
 * @returns MetadataCapability (FULL or BASIC)
 *
 * @example
 * ```typescript
 * getMetadataCapability('jpg')  // 'full'
 * getMetadataCapability('txt')  // 'basic'
 * getMetadataCapability('xyz')  // 'basic' (unknown defaults to basic)
 * ```
 */
export function getMetadataCapability(extension: string): MetadataCapability {
  const info = getFileTypeInfo(extension);
  return info?.metadataCapability ?? MetadataCapability.BASIC;
}

/**
 * Check if an extension supports full metadata extraction.
 *
 * @param extension - File extension (with or without dot, case insensitive)
 * @returns true if full metadata extraction is supported
 *
 * @example
 * ```typescript
 * isMetadataSupportedByRegistry('jpg')   // true
 * isMetadataSupportedByRegistry('pdf')   // true
 * isMetadataSupportedByRegistry('txt')   // false
 * ```
 */
export function isMetadataSupportedByRegistry(extension: string): boolean {
  return getMetadataCapability(extension) === MetadataCapability.FULL;
}

/**
 * Get human-readable support level description.
 *
 * @param extension - File extension (with or without dot, case insensitive)
 * @returns Human-readable description of support level
 *
 * @example
 * ```typescript
 * getSupportDescription('jpg')  // 'Full metadata supported'
 * getSupportDescription('txt')  // 'Basic info only'
 * ```
 */
export function getSupportDescription(extension: string): string {
  const capability = getMetadataCapability(extension);
  switch (capability) {
    case MetadataCapability.FULL:
      return 'Full metadata supported';
    case MetadataCapability.BASIC:
      return 'Basic info only';
    default:
      return 'Unknown';
  }
}

/**
 * Get MIME type for an extension.
 *
 * @param extension - File extension (with or without dot, case insensitive)
 * @returns Primary MIME type or undefined if not registered
 *
 * @example
 * ```typescript
 * getMimeType('jpg')  // 'image/jpeg'
 * getMimeType('xyz')  // undefined
 * ```
 */
export function getMimeType(extension: string): string | undefined {
  const info = getFileTypeInfo(extension);
  return info?.mimeTypes[0];
}

/**
 * Get all extensions that support full metadata extraction.
 *
 * @returns Array of extensions with full metadata support
 */
export function getFullMetadataExtensions(): string[] {
  return FILE_TYPE_REGISTRY.filter(
    (info) => info.metadataCapability === MetadataCapability.FULL
  ).flatMap((info) => info.extensions);
}
