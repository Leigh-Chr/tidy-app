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
 *
 * - `name`: Smart name - uses AI suggestion if available, otherwise original filename (recommended)
 * - `original`: Always the original filename (ignores AI)
 * - `ai`: Only AI suggestion (empty if no AI available)
 * - `ext`: File extension
 * - `size`: Human-readable file size
 */
export type FilePlaceholder = 'name' | 'ext' | 'original' | 'size' | 'ai';

const FILE_PLACEHOLDERS: readonly FilePlaceholder[] = ['name', 'ext', 'original', 'size', 'ai'];

/**
 * Placeholders that can use AI suggestions.
 * Used to determine if AI analysis is needed for a template.
 */
export const AI_PLACEHOLDERS: readonly string[] = ['name', 'ai'];

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
 * @param context - The context containing file info and optional AI suggestion
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
    case 'name':
      // Smart name: AI if available, otherwise original
      ({ value, source } = resolveSmartName(context, customFallback));
      break;
    case 'ext':
      ({ value, source } = resolveExtension(context, customFallback));
      break;
    case 'original':
      // Always returns original filename (ignores AI)
      ({ value, source } = resolveOriginalName(context, customFallback));
      break;
    case 'size':
      ({ value, source } = resolveSize(context, customFallback));
      break;
    case 'ai':
      // Only AI suggestion (empty/fallback if no AI)
      ({ value, source } = resolveAiSuggestion(context, customFallback));
      break;
    default: {
      // TypeScript exhaustiveness check
      const _exhaustive: never = placeholder;
      value = _exhaustive;
      source = 'literal';
    }
  }

  // Sanitize for filename safety
  // ext and size don't need it (already safe)
  if (sanitizeForFilename && (placeholder === 'name' || placeholder === 'original' || placeholder === 'ai') && value) {
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
 * All date-related placeholder names.
 * Used to detect if a template will add date information.
 */
const DATE_PLACEHOLDER_NAMES = ['date', 'year', 'month', 'day'];

/**
 * Date patterns found at the BEGINNING of filenames.
 * Ordered from most specific (full date) to least specific (year only).
 * Each pattern captures the date and any trailing separator.
 *
 * Supported formats:
 * - YYYY-MM-DD, YYYY_MM_DD (ISO format)
 * - YYYYMMDD (compact 8-digit)
 * - DD-MM-YYYY, DD_MM_YYYY, MM-DD-YYYY, MM_DD_YYYY
 * - YYYY-MM, YYYY_MM (year-month) - only if followed by non-digit
 * - YYYY (year only) - only if followed by non-digit
 *
 * Partial date patterns use negative lookahead to avoid breaking up full dates.
 * e.g., `2024-01-15` should NOT be stripped to `15` by matching `2024-01-`
 */
const DATE_START_PATTERNS = [
  // Full dates (most specific first)
  /^(\d{4}[-_]\d{2}[-_]\d{2})[-_\s]+/,   // YYYY-MM-DD or YYYY_MM_DD
  /^(\d{8})[-_\s]+/,                       // YYYYMMDD (compact)
  /^(\d{2}[-_]\d{2}[-_]\d{4})[-_\s]+/,   // DD-MM-YYYY or MM-DD-YYYY
  // Partial dates - require non-digit after to avoid breaking full dates
  /^(\d{4}[-_]\d{2})[-_\s]+(?=\D)/,       // YYYY-MM followed by non-digit content
  // Year only - require non-digit after to avoid matching start of full date
  /^(\d{4})[-_\s]+(?=\D)/,                 // YYYY followed by non-digit content
];

/**
 * Date patterns found at the END of filenames.
 * Mirror of start patterns but anchored at end.
 *
 * Partial date patterns use negative lookbehind to avoid breaking up full dates.
 * e.g., `vacation-2024-01-15` should NOT become `vacation-2024` by matching `-01-15`
 */
const DATE_END_PATTERNS = [
  // Full dates (most specific first)
  /[-_\s]+(\d{4}[-_]\d{2}[-_]\d{2})$/,   // YYYY-MM-DD or YYYY_MM_DD
  /[-_\s]+(\d{8})$/,                       // YYYYMMDD (compact)
  /[-_\s]+(\d{2}[-_]\d{2}[-_]\d{4})$/,   // DD-MM-YYYY or MM-DD-YYYY
  // Partial dates - require non-digit before to avoid breaking full dates
  /(?<!\d[-_])[-_\s]+(\d{4}[-_]\d{2})$/,  // YYYY-MM preceded by non-digit
  // Year only - require non-digit before to avoid matching end of full date
  /(?<!\d[-_])[-_\s]+(\d{4})$/,            // YYYY preceded by non-digit
];

/**
 * Check if a template pattern contains any date-related placeholders.
 * This triggers date stripping from filenames to prevent duplication.
 *
 * @param templatePattern - The template pattern to check
 * @returns True if the template contains date, year, month, or day placeholders
 *
 * @example
 * templateHasDatePlaceholder('{date}-{name}')     // true
 * templateHasDatePlaceholder('{name}-{year}')     // true
 * templateHasDatePlaceholder('{year}/{month}')    // true
 * templateHasDatePlaceholder('{name}.{ext}')      // false
 */
function templateHasDatePlaceholder(templatePattern: string | undefined): boolean {
  if (!templatePattern) return false;

  const placeholderRegex = /\{([^}:]+)/g;
  let match;

  while ((match = placeholderRegex.exec(templatePattern)) !== null) {
    const placeholder = match[1]?.toLowerCase();
    if (placeholder && DATE_PLACEHOLDER_NAMES.includes(placeholder)) {
      return true;
    }
  }

  return false;
}

/**
 * Strip date prefix from the START of a filename.
 *
 * @param filename - The filename to process
 * @returns The filename with leading date stripped, or original if no date found
 */
function stripDateFromStart(filename: string): string {
  for (const pattern of DATE_START_PATTERNS) {
    const match = filename.match(pattern);
    if (match) {
      const stripped = filename.slice(match[0].length);
      // Only strip if there's content left
      if (stripped.length > 0) {
        return stripped;
      }
    }
  }
  return filename;
}

/**
 * Strip date suffix from the END of a filename.
 *
 * @param filename - The filename to process
 * @returns The filename with trailing date stripped, or original if no date found
 */
function stripDateFromEnd(filename: string): string {
  for (const pattern of DATE_END_PATTERNS) {
    const match = filename.match(pattern);
    if (match) {
      const stripped = filename.slice(0, -match[0].length);
      // Only strip if there's content left
      if (stripped.length > 0) {
        return stripped;
      }
    }
  }
  return filename;
}

/**
 * Strip date patterns from both START and END of a filename.
 * Preserves dates that appear in the middle of the filename (likely meaningful context).
 *
 * @param filename - The original filename (without extension)
 * @returns The filename with date patterns stripped from boundaries
 *
 * @example
 * stripDatePatterns('2024-01-15-vacation')        // 'vacation' (start stripped)
 * stripDatePatterns('vacation-2024-01-15')        // 'vacation' (end stripped)
 * stripDatePatterns('2024-01-15-vacation-2024')   // 'vacation' (both stripped)
 * stripDatePatterns('vacation-2024-party')        // 'vacation-2024-party' (middle preserved)
 * stripDatePatterns('2024-vacation')              // 'vacation' (year-only stripped)
 */
function stripDatePatterns(filename: string): string {
  let result = filename;

  // Strip from start first
  result = stripDateFromStart(result);

  // Then strip from end
  result = stripDateFromEnd(result);

  return result;
}

// Legacy exports for backward compatibility with existing tests
/**
 * @deprecated Use stripDatePatterns() instead
 */
function stripDatePrefix(filename: string): string {
  return stripDateFromStart(filename);
}

/**
 * @deprecated Use templateHasDatePlaceholder() instead
 */
function templateStartsWithDate(templatePattern: string | undefined): boolean {
  if (!templatePattern) return false;

  const firstPlaceholderMatch = templatePattern.match(/^\s*\{([^}:]+)/);
  if (!firstPlaceholderMatch?.[1]) return false;

  const firstPlaceholder = firstPlaceholderMatch[1].toLowerCase();
  return DATE_PLACEHOLDER_NAMES.includes(firstPlaceholder);
}

/**
 * Resolve smart name - AI suggestion if available, otherwise original filename.
 *
 * This is the recommended placeholder for most templates as it automatically
 * uses AI-generated names when available while falling back to original names.
 *
 * Smart behavior:
 * - Uses AI suggestion if available
 * - Falls back to original filename
 * - Strips existing date patterns (start and end) if template contains any date placeholder
 * - Preserves dates in the middle of filenames (likely meaningful context)
 *
 * @param context - Context containing file info, optional AI suggestion, and template pattern
 * @param fallback - Fallback value if neither AI nor original name available
 *
 * @example
 * // Template: {date}-{name}, File: 2024-01-15-vacation → vacation
 * // Template: {name}-{year}, File: vacation-2024 → vacation
 * // Template: {date}-{name}, File: vacation-2024-party → vacation-2024-party (middle preserved)
 * // Template: {name}.{ext}, File: 2024-01-15-vacation → 2024-01-15-vacation (no date in template)
 */
function resolveSmartName(
  context: PlaceholderContext,
  fallback: string
): { value: string; source: PlaceholderSource } {
  const shouldStripDates = templateHasDatePlaceholder(context.templatePattern);

  // Use AI suggestion if available
  if (context.aiSuggestion?.suggestedName) {
    let suggestion = context.aiSuggestion.suggestedName;
    // Strip date patterns from AI suggestion if template adds dates
    if (shouldStripDates) {
      suggestion = stripDatePatterns(suggestion);
    }
    return {
      value: suggestion,
      source: 'ai',
    };
  }

  // Fall back to original filename
  let name = context.file.name;

  if (!name) {
    return { value: fallback, source: 'literal' };
  }

  // Strip date patterns from boundaries if template would add dates
  // This prevents duplication like "2024-01-15-2024-01-15-vacation"
  // but preserves dates in the middle (likely meaningful context)
  if (shouldStripDates) {
    name = stripDatePatterns(name);
  }

  return {
    value: name,
    source: 'filesystem',
  };
}

/**
 * Resolve original filename (without extension).
 *
 * Always returns the original filename, ignoring any AI suggestions.
 * Use {name} instead if you want AI suggestions when available.
 *
 * @param context - Context containing file info
 * @param fallback - Fallback value if name is not available
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
 * Resolve AI suggestion placeholder.
 *
 * Returns the AI-suggested filename if available, otherwise falls back to the
 * provided fallback value or empty string.
 *
 * @param context - Context containing optional AI suggestion
 * @param fallback - Fallback value if AI suggestion is not available
 */
function resolveAiSuggestion(
  context: PlaceholderContext,
  fallback: string
): { value: string; source: PlaceholderSource } {
  const suggestion = context.aiSuggestion?.suggestedName;

  if (!suggestion) {
    return { value: fallback, source: 'literal' };
  }

  return {
    value: suggestion,
    source: 'ai',
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

/**
 * Check if a template pattern uses AI-related placeholders.
 *
 * Returns true if the template contains {name} or {ai}, meaning
 * AI analysis would be useful for this template.
 *
 * @param templatePattern - The template pattern to check
 * @returns True if the template can benefit from AI analysis
 *
 * @example
 * ```typescript
 * templateNeedsAi('{date}-{name}');     // true - {name} uses AI
 * templateNeedsAi('{date}-{ai}');       // true - {ai} uses AI
 * templateNeedsAi('{date}-{original}'); // false - {original} ignores AI
 * templateNeedsAi('{year}/{month}');    // false - no name placeholders
 * ```
 */
export function templateNeedsAi(templatePattern: string): boolean {
  // Match placeholders in the pattern
  const placeholderRegex = /\{([^}]+)\}/g;
  let match;

  while ((match = placeholderRegex.exec(templatePattern)) !== null) {
    const placeholderName = match[1];
    if (placeholderName && AI_PLACEHOLDERS.includes(placeholderName.toLowerCase())) {
      return true;
    }
  }

  return false;
}

// Export helper functions for testing
export {
  stripDatePrefix,
  templateStartsWithDate,
  stripDatePatterns,
  stripDateFromStart,
  stripDateFromEnd,
  templateHasDatePlaceholder,
};
