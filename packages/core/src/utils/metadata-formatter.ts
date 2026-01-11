import type { UnifiedMetadata } from '../types/unified-metadata.js';
import type { GPSCoordinates } from '../types/image-metadata.js';
import { formatBytes } from '../statistics/statistics.js';

/**
 * A single field in a formatted metadata section.
 */
export interface FormattedField {
  /** Human-readable field label */
  label: string;
  /** Formatted value string */
  value: string;
}

/**
 * A section of related metadata fields.
 */
export interface FormattedMetadataSection {
  /** Section title (e.g., "File Information", "Image Information") */
  title: string;
  /** Array of formatted field values */
  fields: FormattedField[];
}

/**
 * Format unified metadata into display-friendly sections.
 *
 * Organizes metadata by category and formats values for human readability.
 * Filters out fields with "Not available" values for cleaner output.
 *
 * @param metadata - UnifiedMetadata to format
 * @returns Array of sections with formatted fields
 *
 * @example
 * ```typescript
 * const metadata = await getFileMetadata(fileInfo);
 * if (metadata.ok) {
 *   const sections = formatMetadataForDisplay(metadata.data);
 *   for (const section of sections) {
 *     console.log(`\n${section.title}:`);
 *     for (const field of section.fields) {
 *       console.log(`  ${field.label}: ${field.value}`);
 *     }
 *   }
 * }
 * ```
 */
export function formatMetadataForDisplay(
  metadata: UnifiedMetadata
): FormattedMetadataSection[] {
  const sections: FormattedMetadataSection[] = [];

  // File Information (always present)
  sections.push({
    title: 'File Information',
    fields: [
      { label: 'Name', value: metadata.file.fullName },
      { label: 'Size', value: formatBytes(metadata.file.size) },
      { label: 'Created', value: formatDate(metadata.file.createdAt) },
      { label: 'Modified', value: formatDate(metadata.file.modifiedAt) },
      { label: 'Category', value: formatCategory(metadata.file.category) },
    ],
  });

  // Image metadata
  if (metadata.image) {
    const imageFields = [
      { label: 'Date Taken', value: formatDate(metadata.image.dateTaken) },
      { label: 'Camera', value: formatCamera(metadata.image) },
      { label: 'Dimensions', value: formatDimensions(metadata.image) },
      { label: 'Location', value: formatGPS(metadata.image.gps) },
      { label: 'Exposure', value: formatExposure(metadata.image) },
      { label: 'ISO', value: formatISO(metadata.image.iso) },
    ].filter((f) => f.value !== 'Not available');

    if (imageFields.length > 0) {
      sections.push({
        title: 'Image Information',
        fields: imageFields,
      });
    }
  }

  // PDF metadata
  if (metadata.pdf) {
    const pdfFields = [
      { label: 'Title', value: metadata.pdf.title ?? 'Not available' },
      { label: 'Author', value: metadata.pdf.author ?? 'Not available' },
      { label: 'Subject', value: metadata.pdf.subject ?? 'Not available' },
      { label: 'Keywords', value: metadata.pdf.keywords ?? 'Not available' },
      { label: 'Pages', value: formatPageCount(metadata.pdf.pageCount) },
      { label: 'Created', value: formatDate(metadata.pdf.creationDate) },
      { label: 'Modified', value: formatDate(metadata.pdf.modificationDate) },
      { label: 'Creator', value: metadata.pdf.creator ?? 'Not available' },
      { label: 'Producer', value: metadata.pdf.producer ?? 'Not available' },
    ].filter((f) => f.value !== 'Not available');

    if (pdfFields.length > 0) {
      sections.push({
        title: 'Document Properties',
        fields: pdfFields,
      });
    }
  }

  // Office metadata
  if (metadata.office) {
    const officeFields = [
      { label: 'Title', value: metadata.office.title ?? 'Not available' },
      { label: 'Author', value: metadata.office.creator ?? 'Not available' },
      { label: 'Subject', value: metadata.office.subject ?? 'Not available' },
      { label: 'Keywords', value: metadata.office.keywords ?? 'Not available' },
      {
        label: 'Description',
        value: metadata.office.description ?? 'Not available',
      },
      { label: 'Category', value: metadata.office.category ?? 'Not available' },
      { label: 'Pages', value: formatPageCount(metadata.office.pageCount) },
      { label: 'Word Count', value: formatWordCount(metadata.office.wordCount) },
      { label: 'Created', value: formatDate(metadata.office.created) },
      { label: 'Modified', value: formatDate(metadata.office.modified) },
      {
        label: 'Last Modified By',
        value: metadata.office.lastModifiedBy ?? 'Not available',
      },
      {
        label: 'Application',
        value: metadata.office.application ?? 'Not available',
      },
      { label: 'Revision', value: metadata.office.revision ?? 'Not available' },
    ].filter((f) => f.value !== 'Not available');

    if (officeFields.length > 0) {
      sections.push({
        title: 'Document Properties',
        fields: officeFields,
      });
    }
  }

  // Add extraction status if there was an error
  if (metadata.extractionStatus === 'failed' && metadata.extractionError) {
    sections.push({
      title: 'Extraction Status',
      fields: [
        { label: 'Status', value: 'Failed' },
        { label: 'Error', value: metadata.extractionError },
      ],
    });
  }

  return sections;
}

/**
 * Format a date for display.
 */
function formatDate(date: Date | null | undefined): string {
  if (!date) return 'Not available';
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format camera make and model.
 */
function formatCamera(img: {
  cameraMake: string | null;
  cameraModel: string | null;
}): string {
  if (!img.cameraMake && !img.cameraModel) return 'Not available';
  return [img.cameraMake, img.cameraModel].filter(Boolean).join(' ');
}

/**
 * Format image dimensions.
 */
function formatDimensions(img: {
  width: number | null;
  height: number | null;
}): string {
  if (!img.width || !img.height) return 'Not available';
  return `${String(img.width)} × ${String(img.height)}`;
}

/**
 * Format GPS coordinates.
 */
function formatGPS(gps: GPSCoordinates | null): string {
  if (!gps) return 'Not available';
  return `${gps.latitude.toFixed(6)}, ${gps.longitude.toFixed(6)}`;
}

/**
 * Format exposure settings (time and aperture).
 */
function formatExposure(img: {
  exposureTime: string | null;
  fNumber: number | null;
}): string {
  const parts: string[] = [];
  if (img.exposureTime) parts.push(img.exposureTime);
  if (img.fNumber) parts.push(`f/${String(img.fNumber)}`);
  return parts.length > 0 ? parts.join(' at ') : 'Not available';
}

/**
 * Format ISO value.
 */
function formatISO(iso: number | null): string {
  if (!iso) return 'Not available';
  return `ISO ${String(iso)}`;
}

/**
 * Format page count.
 */
function formatPageCount(count: number | null): string {
  if (count === null) return 'Not available';
  return count === 1 ? '1 page' : `${String(count)} pages`;
}

/**
 * Format word count.
 */
function formatWordCount(count: number | null): string {
  if (count === null) return 'Not available';
  return count.toLocaleString() + ' words';
}

/**
 * Format file category for display.
 */
function formatCategory(category: string): string {
  // Capitalize first letter
  return category.charAt(0).toUpperCase() + category.slice(1);
}
