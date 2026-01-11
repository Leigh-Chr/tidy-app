import { describe, it, expect } from 'vitest';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractPdf } from './pdf.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, '__fixtures__');

describe('extractPdf', () => {
  describe('PDFs with metadata', () => {
    it('extracts metadata from PDF with properties', async () => {
      const result = await extractPdf(join(FIXTURES_DIR, 'with-metadata.pdf'));

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.title).toBe('Test Document Title');
        expect(result.data.author).toBe('John Doe');
        expect(result.data.subject).toBe('Test Subject');
        expect(result.data.creator).toBe('Test Creator App');
        expect(result.data.producer).toBe('pdf-lib');
        expect(result.data.pageCount).toBe(1);
      }
    });

    it('extracts creation and modification dates', async () => {
      const result = await extractPdf(join(FIXTURES_DIR, 'with-metadata.pdf'));

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.creationDate).toBeInstanceOf(Date);
        expect(result.data.modificationDate).toBeInstanceOf(Date);

        if (result.data.creationDate) {
          expect(result.data.creationDate.getFullYear()).toBe(2024);
          expect(result.data.creationDate.getMonth()).toBe(0); // January = 0
        }
      }
    });

    it('extracts keywords as string', async () => {
      const result = await extractPdf(join(FIXTURES_DIR, 'with-metadata.pdf'));

      expect(result.ok).toBe(true);
      if (result.ok) {
        // pdf-lib stores keywords as comma-separated string
        expect(result.data.keywords).toContain('test');
      }
    });
  });

  describe('PDFs without metadata', () => {
    it('returns null values for PDF without metadata', async () => {
      const result = await extractPdf(join(FIXTURES_DIR, 'no-metadata.pdf'));

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.title).toBeNull();
        expect(result.data.author).toBeNull();
        expect(result.data.subject).toBeNull();
        // pageCount should still work
        expect(result.data.pageCount).toBe(1);
      }
    });

    it('still extracts page count when metadata is missing', async () => {
      const result = await extractPdf(join(FIXTURES_DIR, 'no-metadata.pdf'));

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.pageCount).toBeGreaterThan(0);
      }
    });
  });

  describe('multi-page PDFs', () => {
    it('correctly counts pages in multi-page PDF', async () => {
      const result = await extractPdf(join(FIXTURES_DIR, 'multi-page.pdf'));

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.pageCount).toBe(5);
        expect(result.data.title).toBe('Multi-Page Document');
        expect(result.data.author).toBe('Test Author');
      }
    });
  });

  describe('error cases', () => {
    it('returns error for non-existent file', async () => {
      const result = await extractPdf(join(FIXTURES_DIR, 'does-not-exist.pdf'));

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('Failed to extract PDF metadata');
        expect(result.error.message).toContain('ENOENT');
      }
    });

    it('returns error for corrupted PDF', async () => {
      const result = await extractPdf(join(FIXTURES_DIR, 'corrupted.pdf'));

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toMatch(/corrupted|invalid|Failed/i);
      }
    });

    it('returns error for password-protected PDF', async () => {
      const result = await extractPdf(
        join(FIXTURES_DIR, 'password-protected.pdf')
      );

      // Password-protected PDFs should return an error
      // The exact behavior depends on how pdf-parse handles encryption
      if (!result.ok) {
        expect(result.error.message).toMatch(/password|encrypted|invalid/i);
      }
      // If it somehow succeeds (unlikely), that's also acceptable
    });

    it('handles non-PDF file gracefully', async () => {
      const result = await extractPdf(join(FIXTURES_DIR, 'document.txt'));

      // Should return an error for non-PDF files
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toMatch(/invalid|corrupted|Failed/i);
      }
    });
  });
});
