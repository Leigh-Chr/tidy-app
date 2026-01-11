import { describe, it, expect } from 'vitest';
import {
  imageMetadataSchema,
  gpsCoordinatesSchema,
  createEmptyImageMetadata,
  type ImageMetadata,
  type GPSCoordinates,
} from './image-metadata.js';

describe('gpsCoordinatesSchema', () => {
  it('validates correct GPS coordinates', () => {
    const coords: GPSCoordinates = {
      latitude: 43.4679,
      longitude: 11.8825,
    };

    const result = gpsCoordinatesSchema.safeParse(coords);
    expect(result.success).toBe(true);
  });

  it('accepts negative coordinates (Southern/Western hemisphere)', () => {
    const coords = {
      latitude: -33.8688, // Sydney
      longitude: 151.2093,
    };

    const result = gpsCoordinatesSchema.safeParse(coords);
    expect(result.success).toBe(true);
  });

  it('rejects non-numeric values', () => {
    const invalid = {
      latitude: 'not a number',
      longitude: 10,
    };

    const result = gpsCoordinatesSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects missing properties', () => {
    const incomplete = {
      latitude: 43.4679,
    };

    const result = gpsCoordinatesSchema.safeParse(incomplete);
    expect(result.success).toBe(false);
  });
});

describe('imageMetadataSchema', () => {
  it('validates complete metadata', () => {
    const metadata: ImageMetadata = {
      dateTaken: new Date('2024-06-15T14:30:00'),
      cameraMake: 'Canon',
      cameraModel: 'EOS 40D',
      gps: { latitude: 43.4679, longitude: 11.8825 },
      width: 4000,
      height: 3000,
      orientation: 1,
      exposureTime: '1/125',
      fNumber: 5.6,
      iso: 400,
    };

    const result = imageMetadataSchema.safeParse(metadata);
    expect(result.success).toBe(true);
  });

  it('validates metadata with all null values', () => {
    const metadata = createEmptyImageMetadata();

    const result = imageMetadataSchema.safeParse(metadata);
    expect(result.success).toBe(true);
  });

  it('validates metadata with mixed null/actual values', () => {
    const metadata: ImageMetadata = {
      dateTaken: new Date(),
      cameraMake: 'iPhone',
      cameraModel: 'iPhone 15 Pro',
      gps: null, // No GPS
      width: 4032,
      height: 3024,
      orientation: 6,
      exposureTime: null,
      fNumber: null,
      iso: null,
    };

    const result = imageMetadataSchema.safeParse(metadata);
    expect(result.success).toBe(true);
  });

  it('rejects invalid date', () => {
    const invalid = {
      ...createEmptyImageMetadata(),
      dateTaken: 'not a date',
    };

    const result = imageMetadataSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects invalid GPS', () => {
    const invalid = {
      ...createEmptyImageMetadata(),
      gps: { latitude: 'invalid' },
    };

    const result = imageMetadataSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

describe('createEmptyImageMetadata', () => {
  it('returns object with all fields set to null', () => {
    const empty = createEmptyImageMetadata();

    expect(empty.dateTaken).toBeNull();
    expect(empty.cameraMake).toBeNull();
    expect(empty.cameraModel).toBeNull();
    expect(empty.gps).toBeNull();
    expect(empty.width).toBeNull();
    expect(empty.height).toBeNull();
    expect(empty.orientation).toBeNull();
    expect(empty.exposureTime).toBeNull();
    expect(empty.fNumber).toBeNull();
    expect(empty.iso).toBeNull();
  });

  it('returns valid ImageMetadata', () => {
    const empty = createEmptyImageMetadata();
    const result = imageMetadataSchema.safeParse(empty);

    expect(result.success).toBe(true);
  });

  it('returns new object each call (not shared reference)', () => {
    const empty1 = createEmptyImageMetadata();
    const empty2 = createEmptyImageMetadata();

    expect(empty1).not.toBe(empty2);
    expect(empty1).toEqual(empty2);
  });
});
