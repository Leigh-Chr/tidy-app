/**
 * Metadata capability levels for file types.
 * Indicates what level of metadata can be extracted from a file.
 */

/**
 * Metadata extraction capability levels.
 *
 * @example
 * ```typescript
 * if (file.metadataCapability === MetadataCapability.FULL) {
 *   // Can extract rich metadata (EXIF, PDF props, Office props)
 * }
 * ```
 */
export const MetadataCapability = {
  /** Full metadata extraction supported (EXIF, PDF properties, Office properties) */
  FULL: 'full',
  /** Basic file system metadata only (size, created, modified) */
  BASIC: 'basic',
} as const;

export type MetadataCapability =
  (typeof MetadataCapability)[keyof typeof MetadataCapability];
