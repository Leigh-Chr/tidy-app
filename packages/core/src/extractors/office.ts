/**
 * Office Document Metadata Extractor
 *
 * Extracts metadata from Office Open XML documents (docx, xlsx, pptx).
 * These are ZIP archives containing:
 * - docProps/core.xml - Dublin Core metadata (title, author, dates)
 * - docProps/app.xml - Application-specific properties
 *
 * Uses:
 * - node-stream-zip: ZIP archive reading (async, streaming)
 * - fast-xml-parser: XML parsing (fast, lightweight)
 */
import StreamZip from 'node-stream-zip';
import { XMLParser } from 'fast-xml-parser';
import type { OfficeMetadata } from '../types/office-metadata.js';
import { createEmptyOfficeMetadata } from '../types/office-metadata.js';
import { ok, err, type Result } from '../types/result.js';

/**
 * Extract metadata from an Office document (docx, xlsx, pptx).
 *
 * @param filePath - Absolute path to the Office document
 * @returns Result containing OfficeMetadata or an error
 *
 * @example
 * ```typescript
 * const result = await extractOffice('/path/to/document.docx');
 * if (result.ok) {
 *   console.log(`Title: ${result.data.title}`);
 *   console.log(`Author: ${result.data.creator}`);
 *   console.log(`Pages: ${result.data.pageCount}`);
 * }
 * ```
 */
export async function extractOffice(
  filePath: string
): Promise<Result<OfficeMetadata>> {
  let zip: StreamZip.StreamZipAsync | null = null;

  try {
    zip = new StreamZip.async({ file: filePath });

    // Read core.xml (Dublin Core metadata)
    let coreXml: string | undefined;
    try {
      const buffer = await zip.entryData('docProps/core.xml');
      coreXml = buffer.toString('utf-8');
    } catch {
      // Some files might not have core.xml - that's OK
    }

    // Read app.xml (Application properties)
    let appXml: string | undefined;
    try {
      const buffer = await zip.entryData('docProps/app.xml');
      appXml = buffer.toString('utf-8');
    } catch {
      // Optional - not all documents have this
    }

    await zip.close();
    zip = null;

    // If neither file exists, return empty metadata
    if (!coreXml && !appXml) {
      return ok(createEmptyOfficeMetadata());
    }

    const coreProps = coreXml ? parseCoreXml(coreXml) : {};
    const appProps = appXml ? parseAppXml(appXml) : {};

    return ok(mergeProperties(coreProps, appProps));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    // Clean up on error
    if (zip) {
      try {
        await zip.close();
      } catch {
        // Ignore cleanup errors
      }
    }

    // Handle password-protected documents
    if (
      message.toLowerCase().includes('password') ||
      message.includes('encrypted')
    ) {
      return err(new Error('Document is password-protected'));
    }

    // Handle corrupted/invalid ZIP files
    if (
      message.includes('Invalid') ||
      message.includes('End of Central Directory') ||
      message.includes('Bad archive') ||
      message.includes('not a valid zip')
    ) {
      return err(new Error('Document is corrupted or invalid format'));
    }

    // Handle file not found
    if (message.includes('ENOENT')) {
      return err(new Error(`Failed to extract Office metadata: ${message}`));
    }

    return err(new Error(`Failed to extract Office metadata: ${message}`));
  }
}

/**
 * Parse core.xml (Dublin Core metadata).
 */
function parseCoreXml(xml: string): Partial<OfficeMetadata> {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
  });

  try {
    const parsed = parser.parse(xml) as Record<string, unknown>;
    const coreProps = parsed['cp:coreProperties'] ?? parsed['coreProperties'];
    const cp = (coreProps as Record<string, unknown> | undefined) ?? {};

    return {
      title: asString(cp['dc:title'] ?? cp['title']),
      subject: asString(cp['dc:subject'] ?? cp['subject']),
      creator: asString(cp['dc:creator'] ?? cp['creator']),
      keywords: asString(cp['cp:keywords'] ?? cp['keywords']),
      description: asString(cp['dc:description'] ?? cp['description']),
      lastModifiedBy: asString(cp['cp:lastModifiedBy']),
      created: parseXmlDate(cp['dcterms:created']),
      modified: parseXmlDate(cp['dcterms:modified']),
      revision: asString(cp['cp:revision']),
      category: asString(cp['cp:category']),
    };
  } catch {
    return {};
  }
}

/**
 * Parse app.xml (Application properties).
 */
function parseAppXml(xml: string): Partial<OfficeMetadata> {
  const parser = new XMLParser();

  try {
    const parsed = parser.parse(xml) as Record<string, unknown>;
    const props = (parsed['Properties'] as Record<string, unknown> | undefined) ?? {};

    return {
      application: asString(props['Application']),
      appVersion: asString(props['AppVersion']),
      pageCount: asNumber(props['Pages']),
      wordCount: asNumber(props['Words']),
    };
  } catch {
    return {};
  }
}

/**
 * Merge core and app properties into complete OfficeMetadata.
 */
function mergeProperties(
  core: Partial<OfficeMetadata>,
  app: Partial<OfficeMetadata>
): OfficeMetadata {
  return {
    title: core.title ?? null,
    subject: core.subject ?? null,
    creator: core.creator ?? null,
    keywords: core.keywords ?? null,
    description: core.description ?? null,
    lastModifiedBy: core.lastModifiedBy ?? null,
    created: core.created ?? null,
    modified: core.modified ?? null,
    revision: core.revision ?? null,
    category: core.category ?? null,
    application: app.application ?? null,
    appVersion: app.appVersion ?? null,
    pageCount: app.pageCount ?? null,
    wordCount: app.wordCount ?? null,
  };
}

/**
 * Safely convert unknown value to string or null.
 */
function asString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }
  // Handle numbers (XML parser may convert numeric strings to numbers)
  if (typeof value === 'number') {
    return String(value);
  }
  // Handle objects with #text (XML text content)
  if (typeof value === 'object' && value !== null) {
    const obj = value as Record<string, unknown>;
    if (typeof obj['#text'] === 'string') {
      return obj['#text'].trim() || null;
    }
    if (typeof obj['#text'] === 'number') {
      return String(obj['#text']);
    }
  }
  return null;
}

/**
 * Safely convert unknown value to number or null.
 */
function asNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    const num = Number(value);
    return isNaN(num) ? null : num;
  }
  return null;
}

/**
 * Parse XML date value to Date object.
 * Handles both string dates and objects with #text property.
 */
function parseXmlDate(value: unknown): Date | null {
  if (!value) return null;

  let dateStr: string | undefined;

  if (typeof value === 'string') {
    dateStr = value;
  } else if (typeof value === 'object') {
    // XML parser may return { '#text': 'date', '@_xsi:type': '...' }
    const obj = value as Record<string, unknown>;
    if (typeof obj['#text'] === 'string') {
      dateStr = obj['#text'];
    }
  }

  if (!dateStr) return null;

  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date;
}
