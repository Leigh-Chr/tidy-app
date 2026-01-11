/**
 * @fileoverview File Type Presets for LLM Analysis - Story 10.4
 *
 * Defines preset categories of file extensions for LLM analysis.
 * Users can select presets like 'images', 'documents', 'text'
 * or use custom extensions.
 *
 * @module llm/file-type-presets
 */

// =============================================================================
// Preset Definitions
// =============================================================================

/**
 * Image file extensions.
 *
 * Common image formats that may benefit from content analysis.
 * Note: Vision models (Story 10.5) are required for actual image analysis.
 */
const IMAGE_EXTENSIONS = [
  'jpg',
  'jpeg',
  'png',
  'gif',
  'webp',
  'heic',
  'bmp',
  'tiff',
  'tif',
] as const;

/**
 * Document file extensions.
 *
 * Office documents, PDFs, and other structured documents
 * that contain extractable text content.
 */
const DOCUMENT_EXTENSIONS = [
  'pdf',
  'docx',
  'doc',
  'xlsx',
  'xls',
  'pptx',
  'ppt',
  'odt',
  'ods',
  'odp',
  'rtf',
] as const;

/**
 * Text file extensions.
 *
 * Plain text, markup, and data formats that are
 * directly readable without special extraction.
 */
const TEXT_EXTENSIONS = [
  'txt',
  'md',
  'markdown',
  'rst',
  'csv',
  'json',
  'xml',
  'yaml',
  'yml',
  'log',
  'ini',
  'cfg',
  'conf',
] as const;

/**
 * File type preset categories.
 *
 * Each preset maps to a curated list of file extensions:
 * - `images`: Image files (requires vision model for actual analysis)
 * - `documents`: Office documents and PDFs
 * - `text`: Plain text and markup files
 * - `all`: All of the above combined
 * - `custom`: Empty preset - user defines extensions explicitly
 */
export const FILE_TYPE_PRESETS = {
  images: [...IMAGE_EXTENSIONS],
  documents: [...DOCUMENT_EXTENSIONS],
  text: [...TEXT_EXTENSIONS],
  all: [...IMAGE_EXTENSIONS, ...DOCUMENT_EXTENSIONS, ...TEXT_EXTENSIONS],
  custom: [],
} as const;

/**
 * Available preset names.
 */
export type FileTypePreset = keyof typeof FILE_TYPE_PRESETS;

/**
 * All valid preset names as an array.
 */
export const FILE_TYPE_PRESET_NAMES: readonly FileTypePreset[] = [
  'images',
  'documents',
  'text',
  'all',
  'custom',
] as const;

// =============================================================================
// Preset Functions
// =============================================================================

/**
 * Get extensions for a preset category.
 *
 * Returns a copy of the preset's extensions array.
 *
 * @param preset - The preset category name
 * @returns Array of file extensions (without dots)
 *
 * @example
 * ```typescript
 * const exts = getPresetExtensions('documents');
 * // ['pdf', 'docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt', 'odt', 'ods', 'odp', 'rtf']
 * ```
 */
export function getPresetExtensions(preset: FileTypePreset): string[] {
  return [...FILE_TYPE_PRESETS[preset]];
}

/**
 * Information about a preset.
 */
export interface PresetInfo {
  /** Preset name */
  name: FileTypePreset;
  /** Number of extensions in the preset */
  count: number;
  /** Human-readable description */
  description: string;
}

/**
 * Get all available presets with their extension counts.
 *
 * Useful for displaying preset options to users.
 *
 * @returns Array of preset information objects
 *
 * @example
 * ```typescript
 * const presets = getAllPresets();
 * // [
 * //   { name: 'images', count: 9, description: 'Image files (jpg, png, gif, ...)' },
 * //   { name: 'documents', count: 11, description: 'Documents (pdf, docx, xlsx, ...)' },
 * //   ...
 * // ]
 * ```
 */
export function getAllPresets(): PresetInfo[] {
  const descriptions: Record<FileTypePreset, string> = {
    images: 'Image files (jpg, png, gif, ...)',
    documents: 'Documents (pdf, docx, xlsx, ...)',
    text: 'Text files (txt, md, csv, ...)',
    all: 'All supported file types',
    custom: 'User-defined extensions only',
  };

  return FILE_TYPE_PRESET_NAMES.map((name) => ({
    name,
    count: FILE_TYPE_PRESETS[name].length,
    description: descriptions[name],
  }));
}

/**
 * Check if a preset name is valid.
 *
 * @param name - The preset name to check
 * @returns True if the name is a valid preset
 */
export function isValidPreset(name: string): name is FileTypePreset {
  return FILE_TYPE_PRESET_NAMES.includes(name as FileTypePreset);
}

/**
 * Get the default preset for LLM analysis.
 *
 * Returns 'documents' as the default because:
 * - Documents typically lack rich metadata (unlike images with EXIF)
 * - Text content is directly extractable without vision models
 * - Conservative default that works without special configuration
 */
export function getDefaultPreset(): FileTypePreset {
  return 'documents';
}

/**
 * Format a list of extensions for display.
 *
 * @param extensions - Array of extensions
 * @param maxShow - Maximum number to show before "and X more"
 * @returns Formatted string
 *
 * @example
 * ```typescript
 * formatExtensionList(['pdf', 'docx', 'xlsx'], 2);
 * // 'pdf, docx, and 1 more'
 * ```
 */
export function formatExtensionList(extensions: string[], maxShow: number = 5): string {
  if (extensions.length === 0) {
    return '(none)';
  }

  if (extensions.length <= maxShow) {
    return extensions.join(', ');
  }

  const shown = extensions.slice(0, maxShow);
  const remaining = extensions.length - maxShow;
  return `${shown.join(', ')}, and ${remaining} more`;
}
