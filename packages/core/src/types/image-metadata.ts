import { z } from 'zod';

/**
 * GPS coordinates in decimal degrees format.
 */
export const gpsCoordinatesSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
});

export type GPSCoordinates = z.infer<typeof gpsCoordinatesSchema>;

/**
 * Metadata extracted from image files via EXIF.
 *
 * All fields are nullable since images may not contain EXIF data
 * or specific fields may be missing.
 */
export const imageMetadataSchema = z.object({
  /** Date the photo was taken (DateTimeOriginal) */
  dateTaken: z.date().nullable(),
  /** Camera manufacturer */
  cameraMake: z.string().nullable(),
  /** Camera model name */
  cameraModel: z.string().nullable(),
  /** GPS coordinates where photo was taken */
  gps: gpsCoordinatesSchema.nullable(),
  /** Image width in pixels */
  width: z.number().nullable(),
  /** Image height in pixels */
  height: z.number().nullable(),
  /** EXIF orientation value (1-8) */
  orientation: z.number().nullable(),
  /** Exposure time as string (e.g., "1/125") */
  exposureTime: z.string().nullable(),
  /** F-number (aperture) */
  fNumber: z.number().nullable(),
  /** ISO speed rating */
  iso: z.number().nullable(),
});

export type ImageMetadata = z.infer<typeof imageMetadataSchema>;

/**
 * Creates empty metadata object with all fields set to null.
 * Used when EXIF data is not available.
 */
export function createEmptyImageMetadata(): ImageMetadata {
  return {
    dateTaken: null,
    cameraMake: null,
    cameraModel: null,
    gps: null,
    width: null,
    height: null,
    orientation: null,
    exposureTime: null,
    fNumber: null,
    iso: null,
  };
}
