import type {
  PlaceholderContext,
  ResolvedPlaceholder,
  PlaceholderSource,
} from '../../types/template.js';

/**
 * Date-related placeholder types
 */
export type DatePlaceholder = 'year' | 'month' | 'day' | 'date';

const DATE_PLACEHOLDERS: readonly DatePlaceholder[] = [
  'year',
  'month',
  'day',
  'date',
];

/**
 * Check if a placeholder name is a date placeholder.
 *
 * @param name - The placeholder name to check
 * @returns True if the placeholder is a date placeholder
 */
export function isDatePlaceholder(name: string): name is DatePlaceholder {
  return DATE_PLACEHOLDERS.includes(name as DatePlaceholder);
}

/**
 * Resolve a date placeholder to its value.
 *
 * @param placeholder - The date placeholder to resolve
 * @param context - The context containing file and metadata info
 * @returns The resolved placeholder with value and source
 */
export function resolveDatePlaceholder(
  placeholder: DatePlaceholder,
  context: PlaceholderContext
): ResolvedPlaceholder {
  const { date, source } = extractBestDate(context);

  const value = formatDate(placeholder, date);

  return {
    name: placeholder,
    value,
    source,
  };
}

/**
 * Extract the best available date from context.
 *
 * Priority order:
 * 1. EXIF dateTaken (for images)
 * 2. PDF creationDate (for PDFs)
 * 3. Office created (for Office documents)
 * 4. File system modifiedAt (always available)
 */
function extractBestDate(context: PlaceholderContext): {
  date: Date;
  source: PlaceholderSource;
} {
  // Priority 1: EXIF dateTaken (for images)
  if (context.imageMetadata?.dateTaken) {
    return {
      date: context.imageMetadata.dateTaken,
      source: 'exif',
    };
  }

  // Priority 2: PDF creation date
  if (context.pdfMetadata?.creationDate) {
    return {
      date: context.pdfMetadata.creationDate,
      source: 'document',
    };
  }

  // Priority 2: Office document created date
  if (context.officeMetadata?.created) {
    return {
      date: context.officeMetadata.created,
      source: 'document',
    };
  }

  // Priority 3: File system modification date (always available per FileInfo schema)
  // Use modifiedAt as primary, createdAt as backup
  return {
    date: context.file.modifiedAt,
    source: 'filesystem',
  };
}

/**
 * Format a date for a specific placeholder type.
 */
function formatDate(placeholder: DatePlaceholder, date: Date): string {
  switch (placeholder) {
    case 'year':
      return date.getFullYear().toString();

    case 'month':
      return (date.getMonth() + 1).toString().padStart(2, '0');

    case 'day':
      return date.getDate().toString().padStart(2, '0');

    case 'date':
      return formatFullDate(date);

    default: {
      // TypeScript exhaustiveness check
      const _exhaustive: never = placeholder;
      return _exhaustive;
    }
  }
}

/**
 * Format a full date as YYYY-MM-DD.
 */
function formatFullDate(date: Date): string {
  const year = date.getFullYear().toString();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get all date-related placeholders.
 */
export function getDatePlaceholders(): readonly DatePlaceholder[] {
  return DATE_PLACEHOLDERS;
}
