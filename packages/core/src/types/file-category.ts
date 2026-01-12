/**
 * File category constants and utilities.
 * Categories are used for organizing and filtering files by type.
 *
 * NOTE: These categories are aligned with the Rust backend (scanner.rs)
 * to ensure consistency between CLI and GUI.
 */

/**
 * File categories for organizing files.
 * Aligned with Rust FileCategory enum in apps/gui/src-tauri/src/commands/scanner.rs
 */
export const FileCategory = {
  IMAGE: 'image',
  DOCUMENT: 'document',
  VIDEO: 'video',
  AUDIO: 'audio',
  ARCHIVE: 'archive',
  CODE: 'code',
  DATA: 'data',
  OTHER: 'other',
} as const;

export type FileCategory = (typeof FileCategory)[keyof typeof FileCategory];

/**
 * Mapping of file extensions to their categories.
 * Extensions should be lowercase without the leading dot.
 *
 * This mapping is aligned with the Rust implementation in scanner.rs
 * to ensure consistent categorization between CLI and GUI.
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
  ico: FileCategory.IMAGE,
  raw: FileCategory.IMAGE,
  cr2: FileCategory.IMAGE,
  nef: FileCategory.IMAGE,
  arw: FileCategory.IMAGE,
  dng: FileCategory.IMAGE,

  // Documents (text-based)
  pdf: FileCategory.DOCUMENT,
  doc: FileCategory.DOCUMENT,
  docx: FileCategory.DOCUMENT,
  txt: FileCategory.DOCUMENT,
  md: FileCategory.DOCUMENT,
  rtf: FileCategory.DOCUMENT,
  odt: FileCategory.DOCUMENT,
  xls: FileCategory.DOCUMENT,
  xlsx: FileCategory.DOCUMENT,
  csv: FileCategory.DOCUMENT,
  ods: FileCategory.DOCUMENT,
  ppt: FileCategory.DOCUMENT,
  pptx: FileCategory.DOCUMENT,
  odp: FileCategory.DOCUMENT,

  // Video
  mp4: FileCategory.VIDEO,
  avi: FileCategory.VIDEO,
  mkv: FileCategory.VIDEO,
  mov: FileCategory.VIDEO,
  wmv: FileCategory.VIDEO,
  flv: FileCategory.VIDEO,
  webm: FileCategory.VIDEO,
  m4v: FileCategory.VIDEO,
  mpeg: FileCategory.VIDEO,
  mpg: FileCategory.VIDEO,

  // Audio
  mp3: FileCategory.AUDIO,
  wav: FileCategory.AUDIO,
  flac: FileCategory.AUDIO,
  aac: FileCategory.AUDIO,
  ogg: FileCategory.AUDIO,
  wma: FileCategory.AUDIO,
  m4a: FileCategory.AUDIO,
  opus: FileCategory.AUDIO,

  // Archives
  zip: FileCategory.ARCHIVE,
  tar: FileCategory.ARCHIVE,
  gz: FileCategory.ARCHIVE,
  bz2: FileCategory.ARCHIVE,
  xz: FileCategory.ARCHIVE,
  '7z': FileCategory.ARCHIVE,
  rar: FileCategory.ARCHIVE,
  iso: FileCategory.ARCHIVE,

  // Code
  js: FileCategory.CODE,
  ts: FileCategory.CODE,
  jsx: FileCategory.CODE,
  tsx: FileCategory.CODE,
  py: FileCategory.CODE,
  rs: FileCategory.CODE,
  go: FileCategory.CODE,
  java: FileCategory.CODE,
  c: FileCategory.CODE,
  cpp: FileCategory.CODE,
  h: FileCategory.CODE,
  hpp: FileCategory.CODE,
  cs: FileCategory.CODE,
  rb: FileCategory.CODE,
  php: FileCategory.CODE,
  swift: FileCategory.CODE,
  kt: FileCategory.CODE,
  scala: FileCategory.CODE,
  html: FileCategory.CODE,
  css: FileCategory.CODE,
  scss: FileCategory.CODE,
  less: FileCategory.CODE,
  json: FileCategory.CODE,
  yaml: FileCategory.CODE,
  yml: FileCategory.CODE,
  xml: FileCategory.CODE,
  toml: FileCategory.CODE,
  sql: FileCategory.CODE,
  sh: FileCategory.CODE,
  bash: FileCategory.CODE,
  ps1: FileCategory.CODE,

  // Data
  db: FileCategory.DATA,
  sqlite: FileCategory.DATA,
  mdb: FileCategory.DATA,
  accdb: FileCategory.DATA,
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
