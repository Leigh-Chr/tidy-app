import type {
  PlaceholderContext,
  ResolvedPlaceholder,
  PlaceholderSource,
  ResolverOptions,
} from '../../types/template.js';
import { sanitizeFilename } from '../utils/sanitize.js';

/**
 * Metadata-related placeholder types
 */
export type MetadataPlaceholder = 'title' | 'author' | 'camera' | 'location';

const METADATA_PLACEHOLDERS: readonly MetadataPlaceholder[] = [
  'title',
  'author',
  'camera',
  'location',
];

/**
 * Check if a placeholder name is a metadata placeholder.
 *
 * @param name - The placeholder name to check
 * @returns True if the placeholder is a metadata placeholder
 */
export function isMetadataPlaceholder(name: string): name is MetadataPlaceholder {
  return METADATA_PLACEHOLDERS.includes(name as MetadataPlaceholder);
}

/**
 * Resolve a metadata placeholder to its value.
 *
 * @param placeholder - The metadata placeholder to resolve
 * @param context - The context containing file and metadata info
 * @param options - Resolution options (fallback values, sanitization)
 * @returns The resolved placeholder with value and source
 */
export function resolveMetadataPlaceholder(
  placeholder: MetadataPlaceholder,
  context: PlaceholderContext,
  options: ResolverOptions = {}
): ResolvedPlaceholder {
  const { fallback = '', sanitizeForFilename = true } = options;
  const customFallback = options.fallbacks?.[placeholder] ?? fallback;

  let value: string;
  let source: PlaceholderSource;

  switch (placeholder) {
    case 'title':
      ({ value, source } = resolveTitle(context, customFallback));
      break;
    case 'author':
      ({ value, source } = resolveAuthor(context, customFallback));
      break;
    case 'camera':
      ({ value, source } = resolveCamera(context, customFallback));
      break;
    case 'location':
      ({ value, source } = resolveLocation(context, customFallback));
      break;
    default: {
      // TypeScript exhaustiveness check
      const _exhaustive: never = placeholder;
      value = _exhaustive;
      source = 'literal';
    }
  }

  if (sanitizeForFilename && value) {
    value = sanitizeFilename(value);
  }

  return { name: placeholder, value, source };
}

/**
 * Resolve title from document metadata.
 *
 * Priority:
 * 1. PDF title
 * 2. Office document title
 * 3. Original filename (without extension)
 * 4. Fallback value
 */
function resolveTitle(
  context: PlaceholderContext,
  fallback: string
): { value: string; source: PlaceholderSource } {
  // Try PDF title first
  if (context.pdfMetadata?.title) {
    return {
      value: context.pdfMetadata.title.trim(),
      source: 'document',
    };
  }

  // Try Office document title
  if (context.officeMetadata?.title) {
    return {
      value: context.officeMetadata.title.trim(),
      source: 'document',
    };
  }

  // Fallback to original filename (without extension)
  if (context.file.name) {
    return {
      value: context.file.name,
      source: 'filesystem',
    };
  }

  return { value: fallback, source: 'literal' };
}

/**
 * Resolve author from document metadata.
 *
 * Priority:
 * 1. PDF author
 * 2. Office document creator
 * 3. Fallback value
 */
function resolveAuthor(
  context: PlaceholderContext,
  fallback: string
): { value: string; source: PlaceholderSource } {
  // Try PDF author
  if (context.pdfMetadata?.author) {
    return {
      value: context.pdfMetadata.author.trim(),
      source: 'document',
    };
  }

  // Try Office document creator
  if (context.officeMetadata?.creator) {
    return {
      value: context.officeMetadata.creator.trim(),
      source: 'document',
    };
  }

  return { value: fallback, source: 'literal' };
}

/**
 * Resolve camera make/model from EXIF metadata.
 *
 * Combines camera make and model, avoiding duplication when
 * the model name already contains the make.
 */
function resolveCamera(
  context: PlaceholderContext,
  fallback: string
): { value: string; source: PlaceholderSource } {
  const make = context.imageMetadata?.cameraMake?.trim();
  const model = context.imageMetadata?.cameraModel?.trim();

  if (!make && !model) {
    return { value: fallback, source: 'literal' };
  }

  let cameraName: string;

  if (make && model) {
    // If model already contains make (case-insensitive), just use model
    if (model.toLowerCase().includes(make.toLowerCase())) {
      cameraName = model;
    } else {
      cameraName = `${make} ${model}`;
    }
  } else {
    cameraName = make ?? model ?? fallback;
  }

  // Clean up common formatting issues
  cameraName = cleanCameraName(cameraName);

  return {
    value: cameraName,
    source: 'exif',
  };
}

/**
 * Clean up camera name formatting.
 *
 * Removes common corporate suffixes and extra whitespace.
 */
function cleanCameraName(name: string): string {
  return name
    // Remove extra whitespace
    .replace(/\s+/g, ' ')
    // Remove "CORPORATION", "Corp.", "Inc.", "Ltd." etc.
    .replace(/\s*(corporation|corp\.?|inc\.?|ltd\.?)\s*/gi, ' ')
    // Remove trailing/leading spaces
    .trim();
}

/**
 * Resolve location from GPS coordinates.
 *
 * Formats GPS coordinates as a filename-friendly string:
 * latitude direction + longitude direction (e.g., "48.8566N_2.3522E")
 */
function resolveLocation(
  context: PlaceholderContext,
  fallback: string
): { value: string; source: PlaceholderSource } {
  const gps = context.imageMetadata?.gps;

  if (!gps) {
    return { value: fallback, source: 'literal' };
  }

  const lat = formatCoordinate(gps.latitude, 'lat');
  const lng = formatCoordinate(gps.longitude, 'lng');

  return {
    value: `${lat}_${lng}`,
    source: 'exif',
  };
}

/**
 * Format a GPS coordinate for filename use.
 *
 * @param value - The coordinate value in decimal degrees
 * @param type - Whether this is latitude ('lat') or longitude ('lng')
 * @returns Formatted coordinate string (e.g., "48.8566N" or "2.3522W")
 */
function formatCoordinate(value: number, type: 'lat' | 'lng'): string {
  const direction =
    type === 'lat'
      ? value >= 0 ? 'N' : 'S'
      : value >= 0 ? 'E' : 'W';

  const absValue = Math.abs(value).toFixed(4);
  return `${absValue}${direction}`;
}

/**
 * Get all metadata-related placeholders.
 */
export function getMetadataPlaceholders(): readonly MetadataPlaceholder[] {
  return METADATA_PLACEHOLDERS;
}
