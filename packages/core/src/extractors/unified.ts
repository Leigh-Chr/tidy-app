import type { FileInfo } from '../types/file-info.js';
import type { UnifiedMetadata } from '../types/unified-metadata.js';
import { createEmptyUnifiedMetadata } from '../types/unified-metadata.js';
import { FileCategory } from '../types/file-category.js';
import { extractExif } from './exif.js';
import { extractPdf } from './pdf.js';
import { extractOffice } from './office.js';
import { ok, type Result } from '../types/result.js';

/**
 * Get unified metadata for a file.
 *
 * Routes to the appropriate extractor based on file category and merges
 * results into a unified format. Always returns a successful Result,
 * with extraction status indicating whether metadata extraction succeeded.
 *
 * @param file - FileInfo object from scanner
 * @returns Result containing UnifiedMetadata
 *
 * @example
 * ```typescript
 * const result = await getFileMetadata(fileInfo);
 * if (result.ok) {
 *   console.log(`Status: ${result.data.extractionStatus}`);
 *   if (result.data.image) {
 *     console.log(`Camera: ${result.data.image.cameraMake}`);
 *   }
 * }
 * ```
 */
export async function getFileMetadata(
  file: FileInfo
): Promise<Result<UnifiedMetadata>> {
  const base = createEmptyUnifiedMetadata(file);

  // If metadata is not supported for this file type, return early
  if (!file.metadataSupported) {
    return ok(base);
  }

  try {
    switch (file.category) {
      case FileCategory.IMAGE: {
        const result = await extractExif(file.path);
        if (result.ok) {
          return ok({
            ...base,
            image: result.data,
            extractionStatus: 'success',
          });
        }
        return ok({
          ...base,
          extractionStatus: 'failed',
          extractionError: result.error.message,
        });
      }

      case FileCategory.PDF: {
        const result = await extractPdf(file.path);
        if (result.ok) {
          return ok({
            ...base,
            pdf: result.data,
            extractionStatus: 'success',
          });
        }
        return ok({
          ...base,
          extractionStatus: 'failed',
          extractionError: result.error.message,
        });
      }

      case FileCategory.DOCUMENT:
      case FileCategory.SPREADSHEET:
      case FileCategory.PRESENTATION: {
        const result = await extractOffice(file.path);
        if (result.ok) {
          return ok({
            ...base,
            office: result.data,
            extractionStatus: 'success',
          });
        }
        return ok({
          ...base,
          extractionStatus: 'failed',
          extractionError: result.error.message,
        });
      }

      default:
        // File type has metadataSupported=true but unknown category
        return ok(base);
    }
  } catch (error) {
    // Unexpected error - wrap and return as failed
    return ok({
      ...base,
      extractionStatus: 'failed',
      extractionError: (error as Error).message,
    });
  }
}
