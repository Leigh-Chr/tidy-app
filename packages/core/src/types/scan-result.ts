import { z } from 'zod';
import { fileInfoSchema } from './file-info.js';
import { FileCategory } from './file-category.js';

// NOTE: fileInfoSchema import is used by scanResultSchema.files

/**
 * Schema for scan statistics.
 * Provides aggregate information about scanned files.
 */
export const scanStatisticsSchema = z.object({
  /** Total number of files found */
  totalFiles: z.number().nonnegative(),
  /** Total size of all files in bytes */
  totalSize: z.number().nonnegative(),
  /** Count of files by category */
  byCategory: z.record(
    z.enum([
      FileCategory.IMAGE,
      FileCategory.DOCUMENT,
      FileCategory.PDF,
      FileCategory.SPREADSHEET,
      FileCategory.PRESENTATION,
      FileCategory.OTHER,
    ]),
    z.number().nonnegative()
  ),
  /** Number of files that support metadata extraction */
  metadataSupportedCount: z.number().nonnegative(),
});

export type ScanStatistics = z.infer<typeof scanStatisticsSchema>;

/**
 * Schema for scan results.
 * Contains the list of files and aggregate statistics.
 */
export const scanResultSchema = z.object({
  /** Array of scanned file information */
  files: z.array(fileInfoSchema),
  /** Aggregate statistics about the scan */
  statistics: scanStatisticsSchema,
  /** When the scan was performed */
  scannedAt: z.date(),
  /** Root path that was scanned */
  rootPath: z.string(),
  /** Whether the scan was recursive */
  recursive: z.boolean(),
});

export type ScanResult = z.infer<typeof scanResultSchema>;

// NOTE: calculateStatistics has been moved to statistics/statistics.ts
// Import from '@tidy/core' or './statistics/statistics.js' instead
