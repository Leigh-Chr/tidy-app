/**
 * @fileoverview Tests for image encoding functionality - Story 10.5
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  encodeImageToBase64,
  isImageFile,
  getImageExtension,
  VISION_SUPPORTED_EXTENSIONS,
} from './image-encoder.js';

describe('Image Encoder - Story 10.5', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `image-encoder-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  // ===========================================================================
  // VISION_SUPPORTED_EXTENSIONS (Task 2.4)
  // ===========================================================================
  describe('VISION_SUPPORTED_EXTENSIONS', () => {
    it('should include common image formats', () => {
      expect(VISION_SUPPORTED_EXTENSIONS).toContain('jpg');
      expect(VISION_SUPPORTED_EXTENSIONS).toContain('jpeg');
      expect(VISION_SUPPORTED_EXTENSIONS).toContain('png');
      expect(VISION_SUPPORTED_EXTENSIONS).toContain('gif');
      expect(VISION_SUPPORTED_EXTENSIONS).toContain('webp');
      expect(VISION_SUPPORTED_EXTENSIONS).toContain('heic');
    });

    it('should be lowercase normalized', () => {
      VISION_SUPPORTED_EXTENSIONS.forEach(ext => {
        expect(ext).toBe(ext.toLowerCase());
      });
    });
  });

  // ===========================================================================
  // isImageFile (Task 2.3)
  // ===========================================================================
  describe('isImageFile', () => {
    it('should return true for supported image extensions', () => {
      expect(isImageFile('/path/to/photo.jpg')).toBe(true);
      expect(isImageFile('/path/to/photo.jpeg')).toBe(true);
      expect(isImageFile('/path/to/image.png')).toBe(true);
      expect(isImageFile('/path/to/image.gif')).toBe(true);
      expect(isImageFile('/path/to/image.webp')).toBe(true);
      expect(isImageFile('/path/to/image.heic')).toBe(true);
    });

    it('should return true for uppercase extensions', () => {
      expect(isImageFile('/path/to/photo.JPG')).toBe(true);
      expect(isImageFile('/path/to/photo.JPEG')).toBe(true);
      expect(isImageFile('/path/to/image.PNG')).toBe(true);
      expect(isImageFile('/path/to/image.GIF')).toBe(true);
    });

    it('should return true for mixed case extensions', () => {
      expect(isImageFile('/path/to/photo.Jpg')).toBe(true);
      expect(isImageFile('/path/to/image.PnG')).toBe(true);
    });

    it('should return false for non-image files', () => {
      expect(isImageFile('/path/to/document.pdf')).toBe(false);
      expect(isImageFile('/path/to/document.docx')).toBe(false);
      expect(isImageFile('/path/to/video.mp4')).toBe(false);
      expect(isImageFile('/path/to/audio.mp3')).toBe(false);
      expect(isImageFile('/path/to/text.txt')).toBe(false);
    });

    it('should return false for files without extension', () => {
      expect(isImageFile('/path/to/noextension')).toBe(false);
    });

    it('should return false for hidden files without extension', () => {
      expect(isImageFile('/path/to/.hidden')).toBe(false);
    });

    it('should handle files with multiple dots', () => {
      expect(isImageFile('/path/to/photo.backup.jpg')).toBe(true);
      expect(isImageFile('/path/to/photo.2024.01.01.png')).toBe(true);
    });

    it('should return false for empty string', () => {
      expect(isImageFile('')).toBe(false);
    });
  });

  // ===========================================================================
  // getImageExtension (Task 2.3)
  // ===========================================================================
  describe('getImageExtension', () => {
    it('should extract extension from file path', () => {
      expect(getImageExtension('/path/to/photo.jpg')).toBe('jpg');
      expect(getImageExtension('/path/to/image.png')).toBe('png');
    });

    it('should return lowercase extension', () => {
      expect(getImageExtension('/path/to/photo.JPG')).toBe('jpg');
      expect(getImageExtension('/path/to/photo.JPEG')).toBe('jpeg');
    });

    it('should return undefined for files without extension', () => {
      expect(getImageExtension('/path/to/noextension')).toBeUndefined();
    });

    it('should return undefined for empty string', () => {
      expect(getImageExtension('')).toBeUndefined();
    });
  });

  // ===========================================================================
  // encodeImageToBase64 (Task 2.2, 2.5, 2.6)
  // ===========================================================================
  describe('encodeImageToBase64', () => {
    it('should encode valid image file to base64', async () => {
      // Create a small test image (1x1 PNG pixel)
      const pngData = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
        0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
        0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
        0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41,
        0x54, 0x08, 0xd7, 0x63, 0xf8, 0xff, 0xff, 0x3f,
        0x00, 0x05, 0xfe, 0x02, 0xfe, 0xdc, 0xcc, 0x59,
        0xe7, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e,
        0x44, 0xae, 0x42, 0x60, 0x82,
      ]);
      const testPath = join(testDir, 'test.png');
      await writeFile(testPath, pngData);

      const result = await encodeImageToBase64(testPath);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toMatch(/^[A-Za-z0-9+/=]+$/);
        // Verify base64 can be decoded back
        const decoded = Buffer.from(result.data, 'base64');
        expect(decoded.length).toBe(pngData.length);
      }
    });

    it('should return error for non-existent file', async () => {
      const result = await encodeImageToBase64('/nonexistent/path.jpg');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('CONTENT_EXTRACTION_FAILED');
        expect(result.error.message).toContain('Failed to read image file');
      }
    });

    it('should return error for file exceeding max size', async () => {
      // Create a file larger than the limit
      const largeData = Buffer.alloc(1024); // 1KB
      const testPath = join(testDir, 'large.png');
      await writeFile(testPath, largeData);

      // Use a very small limit
      const result = await encodeImageToBase64(testPath, 100);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('CONTENT_EXTRACTION_FAILED');
        expect(result.error.message).toContain('exceeds maximum size');
      }
    });

    it('should accept file within max size', async () => {
      const smallData = Buffer.alloc(50);
      const testPath = join(testDir, 'small.png');
      await writeFile(testPath, smallData);

      const result = await encodeImageToBase64(testPath, 100);

      expect(result.ok).toBe(true);
    });

    it('should use default max size of 20MB', async () => {
      // Create a small test file
      const testData = Buffer.from('test image data');
      const testPath = join(testDir, 'test.png');
      await writeFile(testPath, testData);

      const result = await encodeImageToBase64(testPath);

      expect(result.ok).toBe(true);
    });

    it('should handle empty file', async () => {
      const testPath = join(testDir, 'empty.png');
      await writeFile(testPath, Buffer.alloc(0));

      const result = await encodeImageToBase64(testPath);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toBe('');
      }
    });

    it('should handle binary content correctly', async () => {
      // Create binary data with all byte values
      const binaryData = Buffer.from([0x00, 0x7f, 0x80, 0xff, 0x01, 0xfe]);
      const testPath = join(testDir, 'binary.png');
      await writeFile(testPath, binaryData);

      const result = await encodeImageToBase64(testPath);

      expect(result.ok).toBe(true);
      if (result.ok) {
        const decoded = Buffer.from(result.data, 'base64');
        expect(decoded).toEqual(binaryData);
      }
    });

    it('should return error for directory', async () => {
      const dirPath = join(testDir, 'subdir');
      await mkdir(dirPath);

      const result = await encodeImageToBase64(dirPath);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('CONTENT_EXTRACTION_FAILED');
      }
    });

    it('should include file path in error message', async () => {
      const badPath = '/definitely/does/not/exist/image.jpg';
      const result = await encodeImageToBase64(badPath);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain(badPath);
      }
    });

    it('should format size in MB in error message', async () => {
      const data = Buffer.alloc(5 * 1024 * 1024); // 5MB
      const testPath = join(testDir, 'medium.png');
      await writeFile(testPath, data);

      // Use 1MB limit
      const result = await encodeImageToBase64(testPath, 1024 * 1024);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('MB');
      }
    });
  });

  // ===========================================================================
  // Edge Cases and Integration
  // ===========================================================================
  describe('edge cases', () => {
    it('should handle special characters in file path', async () => {
      const specialPath = join(testDir, 'photo with spaces & symbols!.png');
      await writeFile(specialPath, Buffer.from('test'));

      const result = await encodeImageToBase64(specialPath);

      expect(result.ok).toBe(true);
    });

    it('should handle unicode in file path', async () => {
      const unicodePath = join(testDir, '照片_测试.png');
      await writeFile(unicodePath, Buffer.from('test'));

      const result = await encodeImageToBase64(unicodePath);

      expect(result.ok).toBe(true);
    });
  });
});
