/**
 * File category constants and utilities.
 * Categories are used for organizing and filtering files by type.
 */

/**
 * File categories for organizing files.
 */
export const FileCategory = {
  IMAGE: 'image',
  DOCUMENT: 'document',
  PDF: 'pdf',
  SPREADSHEET: 'spreadsheet',
  PRESENTATION: 'presentation',
  OTHER: 'other',
} as const;

export type FileCategory = (typeof FileCategory)[keyof typeof FileCategory];

/**
 * Mapping of file extensions to their categories.
 * Extensions should be lowercase without the leading dot.
 */
export const EXTENSION_CATEGORIES: Record<string, FileCategory> = {
  // Images
  jpg: FileCategory.IMAGE,
  jpeg: FileCategory.IMAGE,
  png: FileCategory.IMAGE,
  gif: FileCategory.IMAGE,
  webp: FileCategory.IMAGE,
  heic: FileCategory.IMAGE,
  heif: FileCategory.IMAGE,
  bmp: FileCategory.IMAGE,
  tiff: FileCategory.IMAGE,
  tif: FileCategory.IMAGE,
  svg: FileCategory.IMAGE,
  // PDFs
  pdf: FileCategory.PDF,
  // Documents
  doc: FileCategory.DOCUMENT,
  docx: FileCategory.DOCUMENT,
  txt: FileCategory.DOCUMENT,
  md: FileCategory.DOCUMENT,
  rtf: FileCategory.DOCUMENT,
  odt: FileCategory.DOCUMENT,
  // Spreadsheets
  xls: FileCategory.SPREADSHEET,
  xlsx: FileCategory.SPREADSHEET,
  csv: FileCategory.SPREADSHEET,
  ods: FileCategory.SPREADSHEET,
  // Presentations
  ppt: FileCategory.PRESENTATION,
  pptx: FileCategory.PRESENTATION,
  odp: FileCategory.PRESENTATION,
};

/**
 * Get the category for a given file extension.
 *
 * @param extension - File extension (with or without dot, case insensitive)
 * @returns The file category, or OTHER if unknown
 *
 * @example
 * ```typescript
 * getCategoryForExtension('jpg')   // 'image'
 * getCategoryForExtension('.PDF')  // 'pdf'
 * getCategoryForExtension('xyz')   // 'other'
 * ```
 */
export function getCategoryForExtension(extension: string): FileCategory {
  // Remove leading dot if present and convert to lowercase
  const normalizedExt = extension.startsWith('.')
    ? extension.slice(1).toLowerCase()
    : extension.toLowerCase();
  return EXTENSION_CATEGORIES[normalizedExt] ?? FileCategory.OTHER;
}
