/**
 * Metadata support detection.
 * Determines which file types have extractable metadata.
 */

/**
 * File extensions that have extractable metadata.
 * - Images: EXIF data (camera settings, GPS, dates)
 * - PDFs: Document properties (author, title, dates)
 * - Office: Document properties (author, title, dates)
 */
export const METADATA_SUPPORTED_EXTENSIONS = new Set([
  // Images with EXIF
  'jpg',
  'jpeg',
  'png',
  'heic',
  'heif',
  'webp',
  'gif',
  'tiff',
  'tif',
  // PDFs
  'pdf',
  // Office documents (Open XML format)
  'docx',
  'xlsx',
  'pptx',
]);

/**
 * Check if a file extension supports metadata extraction.
 *
 * @param extension - File extension (with or without dot, case insensitive)
 * @returns true if metadata can be extracted from this file type
 *
 * @example
 * ```typescript
 * isMetadataSupported('jpg')   // true
 * isMetadataSupported('.PDF')  // true
 * isMetadataSupported('txt')   // false
 * ```
 */
export function isMetadataSupported(extension: string): boolean {
  // Remove leading dot if present and convert to lowercase
  const normalizedExt = extension.startsWith('.')
    ? extension.slice(1).toLowerCase()
    : extension.toLowerCase();
  return METADATA_SUPPORTED_EXTENSIONS.has(normalizedExt);
}
