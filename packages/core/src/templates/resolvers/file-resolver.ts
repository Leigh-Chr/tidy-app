import type {
  PlaceholderContext,
  ResolvedPlaceholder,
  PlaceholderSource,
  ResolverOptions,
} from '../../types/template.js';
import { formatBytes } from '../utils/format-size.js';
import { sanitizeFilename } from '../utils/sanitize.js';

/**
 * File-related placeholder types
 */
export type FilePlaceholder = 'ext' | 'original' | 'size';

const FILE_PLACEHOLDERS: readonly FilePlaceholder[] = ['ext', 'original', 'size'];

/**
 * Check if a placeholder name is a file placeholder.
 *
 * @param name - The placeholder name to check
 * @returns True if the placeholder is a file placeholder
 */
export function isFilePlaceholder(name: string): name is FilePlaceholder {
  return FILE_PLACEHOLDERS.includes(name as FilePlaceholder);
}

/**
 * Resolve a file-based placeholder to its value.
 *
 * @param placeholder - The file placeholder to resolve
 * @param context - The context containing file info
 * @param options - Resolution options (fallback values, sanitization)
 * @returns The resolved placeholder with value and source
 */
export function resolveFilePlaceholder(
  placeholder: FilePlaceholder,
  context: PlaceholderContext,
  options: ResolverOptions = {}
): ResolvedPlaceholder {
  const { fallback = '', sanitizeForFilename = true } = options;
  const customFallback = options.fallbacks?.[placeholder] ?? fallback;

  let value: string;
  let source: PlaceholderSource;

  switch (placeholder) {
    case 'ext':
      ({ value, source } = resolveExtension(context, customFallback));
      break;
    case 'original':
      ({ value, source } = resolveOriginalName(context, customFallback));
      break;
    case 'size':
      ({ value, source } = resolveSize(context, customFallback));
      break;
    default: {
      // TypeScript exhaustiveness check
      const _exhaustive: never = placeholder;
      value = _exhaustive;
      source = 'literal';
    }
  }

  // Sanitize for filename safety, but ext doesn't need it (already safe)
  // Size is already formatted and safe
  if (sanitizeForFilename && placeholder === 'original' && value) {
    value = sanitizeFilename(value);
  }

  return { name: placeholder, value, source };
}

/**
 * Resolve file extension (without dot).
 *
 * Returns the file extension from FileInfo, stripping any leading dot.
 */
function resolveExtension(
  context: PlaceholderContext,
  fallback: string
): { value: string; source: PlaceholderSource } {
  const ext = context.file.extension;

  if (!ext) {
    return { value: fallback, source: 'literal' };
  }

  // Remove leading dot if present
  const cleanExt = ext.startsWith('.') ? ext.slice(1) : ext;

  return {
    value: cleanExt,
    source: 'filesystem',
  };
}

/**
 * Resolve original filename (without extension).
 *
 * Returns the base filename preserving original casing.
 */
function resolveOriginalName(
  context: PlaceholderContext,
  fallback: string
): { value: string; source: PlaceholderSource } {
  const name = context.file.name;

  if (!name) {
    return { value: fallback, source: 'literal' };
  }

  return {
    value: name,
    source: 'filesystem',
  };
}

/**
 * Resolve file size as human-readable string.
 *
 * Formats the file size in appropriate units (B, KB, MB, GB).
 */
function resolveSize(
  context: PlaceholderContext,
  fallback: string
): { value: string; source: PlaceholderSource } {
  const size = context.file.size;

  // Defensive check - size should always be a number per FileInfo type,
  // but we handle edge cases gracefully
  if (typeof size !== 'number' || Number.isNaN(size)) {
    return { value: fallback, source: 'literal' };
  }

  return {
    value: formatBytes(size),
    source: 'filesystem',
  };
}

/**
 * Get all file-related placeholders.
 */
export function getFilePlaceholders(): readonly FilePlaceholder[] {
  return FILE_PLACEHOLDERS;
}
