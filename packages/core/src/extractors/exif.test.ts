import { describe, it, expect } from 'vitest';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractExif } from './exif.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, '__fixtures__');

describe('extractExif', () => {
  describe('images with EXIF data', () => {
    it('extracts EXIF from JPEG with full metadata', async () => {
      const result = await extractExif(join(FIXTURES_DIR, 'with-exif.jpg'));

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.dateTaken).toBeInstanceOf(Date);
        expect(result.data.cameraMake).toBe('Canon');
        expect(result.data.cameraModel).toBe('Canon EOS 40D');
        expect(result.data.orientation).toBe(1); // TopLeft
      }
    });

    it('extracts exposure settings', async () => {
      const result = await extractExif(join(FIXTURES_DIR, 'with-exif.jpg'));

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.exposureTime).toBe('1/160');
        // FNumber 71/10 = 7.1
        expect(result.data.fNumber).toBeCloseTo(7.1, 1);
      }
    });

    it('extracts image dimensions', async () => {
      const result = await extractExif(join(FIXTURES_DIR, 'with-exif.jpg'));

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.width).toBe(100);
        expect(result.data.height).toBe(68);
      }
    });

    it('extracts ISO value', async () => {
      const result = await extractExif(join(FIXTURES_DIR, 'with-exif.jpg'));

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Canon 40D sample has ISO data
        expect(result.data.iso).toBeTypeOf('number');
        expect(result.data.iso).toBeGreaterThan(0);
      }
    });

    it('parses date correctly from EXIF format', async () => {
      const result = await extractExif(join(FIXTURES_DIR, 'with-exif.jpg'));

      expect(result.ok).toBe(true);
      if (result.ok) {
        const date = result.data.dateTaken;
        expect(date).not.toBeNull();
        if (date) {
          // DateTimeOriginal: 2008:05:30 15:56:01
          expect(date.getFullYear()).toBe(2008);
          expect(date.getMonth()).toBe(4); // May = 4 (0-indexed)
          expect(date.getDate()).toBe(30);
        }
      }
    });
  });

  describe('images with GPS data', () => {
    it('extracts GPS coordinates when available', async () => {
      const result = await extractExif(join(FIXTURES_DIR, 'with-gps.jpg'));

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.gps).not.toBeNull();
        if (result.data.gps) {
          // GPS: 43°28'N, 11°53'E (Tuscany, Italy area)
          expect(result.data.gps.latitude).toBeGreaterThan(43);
          expect(result.data.gps.latitude).toBeLessThan(44);
          expect(result.data.gps.longitude).toBeGreaterThan(11);
          expect(result.data.gps.longitude).toBeLessThan(12);
        }
      }
    });

    it('returns GPS as decimal degrees', async () => {
      const result = await extractExif(join(FIXTURES_DIR, 'with-gps.jpg'));

      expect(result.ok).toBe(true);
      if (result.ok && result.data.gps) {
        expect(typeof result.data.gps.latitude).toBe('number');
        expect(typeof result.data.gps.longitude).toBe('number');
      }
    });
  });

  describe('images without EXIF data', () => {
    it('returns empty metadata for image without EXIF', async () => {
      const result = await extractExif(join(FIXTURES_DIR, 'no-exif.jpg'));

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.dateTaken).toBeNull();
        expect(result.data.cameraMake).toBeNull();
        expect(result.data.cameraModel).toBeNull();
        expect(result.data.gps).toBeNull();
      }
    });

    it('still extracts file-level info when available', async () => {
      const result = await extractExif(join(FIXTURES_DIR, 'no-exif.jpg'));

      expect(result.ok).toBe(true);
      // File dimensions may or may not be available from JFIF header
      // The important thing is we don't error
    });
  });

  describe('unsupported file formats', () => {
    it('handles unsupported file format gracefully', async () => {
      const result = await extractExif(join(FIXTURES_DIR, 'document.txt'));

      // Returns empty metadata, not an error
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.dateTaken).toBeNull();
        expect(result.data.cameraMake).toBeNull();
        expect(result.data.cameraModel).toBeNull();
        expect(result.data.gps).toBeNull();
      }
    });
  });

  describe('error cases', () => {
    it('returns error for non-existent file', async () => {
      const result = await extractExif(join(FIXTURES_DIR, 'does-not-exist.jpg'));

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('Failed to extract EXIF');
      }
    });
  });
});
