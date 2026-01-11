import ExifReader from 'exifreader';
import { readFile } from 'node:fs/promises';
import type { ImageMetadata, GPSCoordinates } from '../types/image-metadata.js';
import { createEmptyImageMetadata } from '../types/image-metadata.js';
import { ok, err, type Result } from '../types/result.js';

/**
 * Extract EXIF metadata from an image file.
 *
 * Supports JPEG, PNG, HEIC, WebP, GIF, and TIFF formats.
 * Returns empty metadata (not an error) for files without EXIF data.
 *
 * @param filePath - Absolute path to the image file
 * @returns Result containing ImageMetadata or an error
 *
 * @example
 * ```typescript
 * const result = await extractExif('/path/to/photo.jpg');
 * if (result.ok) {
 *   console.log(`Taken: ${result.data.dateTaken}`);
 *   console.log(`Camera: ${result.data.cameraMake} ${result.data.cameraModel}`);
 * }
 * ```
 */
export async function extractExif(
  filePath: string
): Promise<Result<ImageMetadata>> {
  try {
    const buffer = await readFile(filePath);
    const tags = ExifReader.load(buffer, { expanded: true });

    return ok(parseExifTags(tags));
  } catch (error) {
    // Return empty metadata for files without EXIF (not an error)
    if (isNoExifError(error)) {
      return ok(createEmptyImageMetadata());
    }
    return err(
      new Error(`Failed to extract EXIF: ${(error as Error).message}`)
    );
  }
}

/**
 * Parse ExifReader tags into our ImageMetadata structure.
 */
function parseExifTags(tags: ExifReader.ExpandedTags): ImageMetadata {
  return {
    dateTaken: parseExifDate(tags.exif?.DateTimeOriginal?.description),
    cameraMake: extractStringValue(tags.exif?.Make) ?? null,
    cameraModel: extractStringValue(tags.exif?.Model) ?? null,
    gps: parseGPS(tags.gps),
    width: extractNumberValue(tags.file?.['Image Width']) ?? null,
    height: extractNumberValue(tags.file?.['Image Height']) ?? null,
    orientation: extractNumberValue(tags.exif?.Orientation) ?? null,
    exposureTime: tags.exif?.ExposureTime?.description ?? null,
    fNumber: extractFNumber(tags.exif?.FNumber) ?? null,
    iso: extractIsoValue(tags.exif?.ISOSpeedRatings) ?? null,
  };
}

/**
 * Extract string value from EXIF tag.
 * Handles both string and string array values.
 */
function extractStringValue(
  tag: { value?: string | string[]; description?: string } | undefined
): string | null {
  if (!tag) return null;
  if (typeof tag.value === 'string') return tag.value;
  if (Array.isArray(tag.value) && tag.value.length > 0) {
    return tag.value[0] ?? null;
  }
  if (typeof tag.description === 'string') return tag.description;
  return null;
}

/**
 * Extract number value from EXIF tag.
 */
function extractNumberValue(
  tag: { value?: number; description?: string } | undefined
): number | null {
  if (!tag) return null;
  if (typeof tag.value === 'number') return tag.value;
  return null;
}

/**
 * Extract F-number from EXIF rational tag.
 * FNumber is stored as [numerator, denominator] and has computed value.
 */
function extractFNumber(
  tag:
    | { value?: [number, number]; computed?: number | null; description?: string }
    | undefined
): number | null {
  if (!tag) return null;
  if (typeof tag.computed === 'number') return tag.computed;
  // Value is a tuple [numerator, denominator] when present
  const value = tag.value;
  if (value && value[1] !== 0) {
    return value[0] / value[1];
  }
  return null;
}

/**
 * Extract ISO value from EXIF tag.
 * ISO can be a number or an array of numbers.
 */
function extractIsoValue(
  tag: { value?: number | number[] } | undefined
): number | null {
  if (!tag) return null;
  if (typeof tag.value === 'number') return tag.value;
  if (Array.isArray(tag.value) && tag.value.length > 0) {
    return tag.value[0] ?? null;
  }
  return null;
}

/**
 * Parse EXIF date string to Date object.
 * EXIF format: "2023:12:25 10:30:00"
 */
function parseExifDate(dateString?: string): Date | null {
  if (!dateString) return null;
  // EXIF format uses colons in the date portion: "YYYY:MM:DD HH:MM:SS"
  // Convert to ISO format: "YYYY-MM-DDTHH:MM:SS"
  const normalized = dateString.replace(
    /^(\d{4}):(\d{2}):(\d{2})\s+/,
    '$1-$2-$3T'
  );
  const date = new Date(normalized);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Parse GPS coordinates from EXIF tags.
 * ExifReader with expanded option provides decimal degrees directly.
 */
function parseGPS(gps: ExifReader.ExpandedTags['gps']): GPSCoordinates | null {
  if (!gps?.Latitude || !gps.Longitude) {
    return null;
  }
  return {
    latitude: gps.Latitude,
    longitude: gps.Longitude,
  };
}

/**
 * Check if error indicates missing EXIF data (not a failure).
 */
function isNoExifError(error: unknown): boolean {
  if (error instanceof ExifReader.errors.MetadataMissingError) {
    return true;
  }
  const typedError = error as Error | undefined;
  const message = typedError?.message ?? '';
  return (
    message.includes('No Exif data') ||
    message.includes('Invalid image format') ||
    message.includes('No metadata') ||
    message.includes('not a valid')
  );
}
