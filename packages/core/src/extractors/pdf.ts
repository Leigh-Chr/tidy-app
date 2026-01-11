/**
 * PDF Metadata Extractor
 *
 * Uses pdf-parse library for metadata extraction.
 * Library choice rationale:
 * - Pure JavaScript, no native dependencies (~200KB)
 * - Active maintenance (v2.4.5, updated 2024)
 * - MIT license
 * - Full metadata support (title, author, dates, etc.)
 *
 * Alternative considered: pdf-lib - Cannot read existing PDFs, only create/modify
 * Alternative considered: mupdf - AGPL license, large WASM bundle
 */
import { PDFParse } from 'pdf-parse';
import { readFile } from 'node:fs/promises';
import type { PDFMetadata } from '../types/pdf-metadata.js';
import { createEmptyPdfMetadata } from '../types/pdf-metadata.js';
import { ok, err, type Result } from '../types/result.js';

/**
 * Extract metadata from a PDF file.
 *
 * Supports standard PDF document info dictionary fields:
 * title, author, subject, keywords, creator, producer, dates.
 *
 * @param filePath - Absolute path to the PDF file
 * @returns Result containing PDFMetadata or an error
 *
 * @example
 * ```typescript
 * const result = await extractPdf('/path/to/document.pdf');
 * if (result.ok) {
 *   console.log(`Title: ${result.data.title}`);
 *   console.log(`Author: ${result.data.author}`);
 *   console.log(`Pages: ${result.data.pageCount}`);
 * }
 * ```
 */
export async function extractPdf(
  filePath: string
): Promise<Result<PDFMetadata>> {
  let parser: PDFParse | null = null;

  try {
    const buffer = await readFile(filePath);
    parser = new PDFParse({ data: buffer });

    const infoResult = await parser.getInfo();

    return ok(
      parsePdfInfo(infoResult.info as Record<string, unknown> | undefined, infoResult.total)
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    // Handle password-protected PDFs
    if (
      message.toLowerCase().includes('password') ||
      message.includes('encrypted')
    ) {
      return err(new Error('PDF is password-protected'));
    }

    // Handle corrupted/invalid PDFs
    if (
      message.includes('Invalid') ||
      message.includes('corrupt') ||
      message.includes('not a PDF') ||
      message.includes('Invalid PDF structure')
    ) {
      return err(new Error('PDF file is corrupted or invalid'));
    }

    // Handle file not found
    if (message.includes('ENOENT')) {
      return err(new Error(`Failed to extract PDF metadata: ${message}`));
    }

    // For unknown PDF parsing errors, return empty metadata (graceful handling)
    // This handles cases like PDFs with no info dictionary
    if (isNoMetadataError(error)) {
      return ok(createEmptyPdfMetadata());
    }

    return err(new Error(`Failed to extract PDF metadata: ${message}`));
  } finally {
    // Clean up parser resources
    if (parser) {
      try {
        await parser.destroy();
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}

/**
 * Parse pdf-parse info object into our PDFMetadata structure.
 */
function parsePdfInfo(
  info: Record<string, unknown> | undefined,
  pageCount: number
): PDFMetadata {
  if (!info) {
    return {
      ...createEmptyPdfMetadata(),
      pageCount,
    };
  }

  return {
    title: asString(info.Title),
    author: asString(info.Author),
    subject: asString(info.Subject),
    keywords: asString(info.Keywords),
    creator: asString(info.Creator),
    producer: asString(info.Producer),
    creationDate: parsePdfDate(info.CreationDate),
    modificationDate: parsePdfDate(info.ModDate),
    pageCount,
  };
}

/**
 * Safely convert unknown value to string or null.
 * Handles empty strings by returning null.
 */
function asString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }
  return null;
}

/**
 * Parse PDF date to Date object.
 *
 * PDF date format: D:YYYYMMDDHHmmSSOHH'mm'
 * Where:
 *   - D: prefix indicates date
 *   - YYYY: year
 *   - MM: month (01-12)
 *   - DD: day (01-31)
 *   - HH: hour (00-23)
 *   - mm: minute (00-59)
 *   - SS: second (00-59)
 *   - O: timezone offset direction (+, -, or Z)
 *   - HH'mm': timezone offset
 *
 * pdf-parse v2 may return Date objects directly.
 */
function parsePdfDate(value: unknown): Date | null {
  if (!value) return null;

  // Handle Date objects (pdf-parse v2 returns these directly)
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'string') {
    // PDF date format: D:YYYYMMDDHHmmSSOHH'mm'
    const match = value.match(
      /D:(\d{4})(\d{2})?(\d{2})?(\d{2})?(\d{2})?(\d{2})?/
    );
    if (match) {
      const [
        ,
        yearMatch,
        monthMatch,
        dayMatch,
        hourMatch,
        minMatch,
        secMatch,
      ] = match;
      const year = yearMatch ?? '1970';
      const month = monthMatch ?? '01';
      const day = dayMatch ?? '01';
      const hour = hourMatch ?? '00';
      const min = minMatch ?? '00';
      const sec = secMatch ?? '00';
      const isoString = `${year}-${month}-${day}T${hour}:${min}:${sec}`;
      const date = new Date(isoString);
      return isNaN(date.getTime()) ? null : date;
    }

    // Try direct date parsing as fallback
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  }

  return null;
}

/**
 * Check if error indicates missing metadata (not a failure).
 * These cases should return empty metadata rather than an error.
 */
function isNoMetadataError(error: unknown): boolean {
  const typedError = error as Error | undefined;
  const message = typedError?.message ?? '';

  return (
    message.includes('No metadata') ||
    message.includes('info dictionary') ||
    message.includes('undefined')
  );
}
