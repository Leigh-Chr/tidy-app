import { z } from 'zod';
import type { FileInfo } from './file-info.js';
import type { ImageMetadata } from './image-metadata.js';
import type { PDFMetadata } from './pdf-metadata.js';
import type { OfficeMetadata } from './office-metadata.js';
import type { CaseStyle } from '../templates/utils/case-normalizer.js';

/**
 * Supported placeholder categories
 */
export const PlaceholderCategory = {
  DATE: 'date',
  METADATA: 'metadata',
  FILE: 'file',
} as const;

export type PlaceholderCategory =
  (typeof PlaceholderCategory)[keyof typeof PlaceholderCategory];

/**
 * All supported placeholder types
 */
export const PLACEHOLDER_TYPES = [
  // Date placeholders
  'year',
  'month',
  'day',
  'date',
  // Metadata placeholders
  'title',
  'author',
  'camera',
  'location',
  // File placeholders
  'name',    // Smart name: AI if available, otherwise original (recommended)
  'ext',
  'original', // Always original filename (ignores AI)
  'size',
  'ai',       // Only AI suggestion (empty if no AI)
] as const;

export type PlaceholderType = (typeof PLACEHOLDER_TYPES)[number];

/**
 * A token in a parsed template - either literal text or a placeholder
 */
export const templateTokenSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('literal'),
    value: z.string(),
  }),
  z.object({
    type: z.literal('placeholder'),
    name: z.string(),
  }),
]);

export type TemplateToken = z.infer<typeof templateTokenSchema>;

/**
 * A parsed template with tokens and metadata
 */
export const parsedTemplateSchema = z.object({
  pattern: z.string(),
  tokens: z.array(templateTokenSchema),
  placeholders: z.array(z.string()),
});

export type ParsedTemplate = z.infer<typeof parsedTemplateSchema>;

/**
 * A named template that users can save and reuse
 */
export const namedTemplateSchema = z.object({
  name: z.string().min(1),
  pattern: z.string().min(1),
  description: z.string().optional(),
  isDefault: z.boolean().default(false),
});

export type NamedTemplate = z.infer<typeof namedTemplateSchema>;

/**
 * Source of the placeholder value (for transparency)
 */
export type PlaceholderSource =
  | 'exif'
  | 'document'
  | 'filesystem'
  | 'literal'
  | 'ai';

/**
 * Result of resolving a single placeholder
 */
export interface ResolvedPlaceholder {
  name: string;
  value: string;
  source: PlaceholderSource;
}

/**
 * AI suggestion for filename (Story 10.3)
 */
export interface AiSuggestion {
  /** Suggested filename (without extension) */
  suggestedName: string;
  /** Confidence score (0-1) */
  confidence: number;
  /** Optional reasoning from the AI */
  reasoning?: string;
}

/**
 * Context containing all data available for placeholder resolution
 */
export interface PlaceholderContext {
  file: FileInfo;
  imageMetadata?: ImageMetadata | null;
  pdfMetadata?: PDFMetadata | null;
  officeMetadata?: OfficeMetadata | null;
  /** AI suggestion for {name} and {ai} placeholders */
  aiSuggestion?: AiSuggestion | null;
  /**
   * The template pattern being used.
   * Used by smart placeholders like {name} to avoid duplicating patterns
   * that the template would add (e.g., stripping existing date prefix
   * if template starts with {date}).
   */
  templatePattern?: string;
}

/**
 * Options for placeholder resolution
 */
export interface ResolverOptions {
  /** Default fallback value when metadata is missing */
  fallback?: string;
  /** Whether to sanitize output for filenames (default: true) */
  sanitizeForFilename?: boolean;
  /** Custom fallback values per placeholder type */
  fallbacks?: Record<string, string>;
}

// =============================================================================
// Template Management Types (Story 3.5)
// =============================================================================

import { FileCategory } from './file-category.js';

/**
 * A saved template with full metadata for persistence.
 */
export const savedTemplateSchema = z.object({
  /** Unique identifier for the template */
  id: z.uuid(),
  /** User-friendly name for the template */
  name: z.string().min(1).max(100),
  /** The template pattern string with placeholders */
  pattern: z.string().min(1),
  /** Optional description of what this template is for */
  description: z.string().optional(),
  /** Whether this is a built-in system template (cannot be modified/deleted) */
  isBuiltIn: z.boolean().default(false),
  /** When the template was created */
  createdAt: z.coerce.date(),
  /** When the template was last updated */
  updatedAt: z.coerce.date(),
});

export type SavedTemplate = z.infer<typeof savedTemplateSchema>;

/**
 * Input for creating a new template.
 */
export const createTemplateInputSchema = z.object({
  name: z.string().min(1).max(100),
  pattern: z.string().min(1),
  /** Description must be non-empty if provided */
  description: z.string().min(1).optional(),
});

export type CreateTemplateInput = z.infer<typeof createTemplateInputSchema>;

/**
 * Input for updating an existing template.
 * All fields are optional - only provided fields will be updated.
 * Use `null` to explicitly clear a field (e.g., description: null clears the description).
 */
export const updateTemplateInputSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  pattern: z.string().min(1).optional(),
  /** Set to null to clear description, undefined to keep existing, or string to update */
  description: z.string().min(1).nullable().optional(),
});

export type UpdateTemplateInput = z.infer<typeof updateTemplateInputSchema>;

/**
 * Mapping of file categories to their default template IDs.
 * Partial record - not all categories need defaults.
 */
export const fileTypeDefaultsSchema = z.object({
  [FileCategory.IMAGE]: z.uuid().optional(),
  [FileCategory.DOCUMENT]: z.uuid().optional(),
  [FileCategory.VIDEO]: z.uuid().optional(),
  [FileCategory.AUDIO]: z.uuid().optional(),
  [FileCategory.ARCHIVE]: z.uuid().optional(),
  [FileCategory.CODE]: z.uuid().optional(),
  [FileCategory.DATA]: z.uuid().optional(),
  [FileCategory.OTHER]: z.uuid().optional(),
}).partial();

export type FileTypeDefaults = z.infer<typeof fileTypeDefaultsSchema>;

/**
 * Complete template store containing all templates and default settings.
 */
export const templateStoreSchema = z.object({
  /** All saved templates (both built-in and user-created) */
  templates: z.array(savedTemplateSchema),
  /** Default template assignments per file category */
  defaults: fileTypeDefaultsSchema,
  /** Global default template ID (used when no category-specific default) */
  globalDefault: z.uuid().optional(),
});

export type TemplateStore = z.infer<typeof templateStoreSchema>;

// =============================================================================
// Template Validation Types (Story 3.6)
// =============================================================================

/**
 * Severity levels for validation issues
 */
export type ValidationSeverity = 'error' | 'warning' | 'info';

/**
 * Types of validation issues that can be detected
 */
export const ValidationIssueTypeEnum = {
  // Errors (syntax issues)
  UNCLOSED_BRACE: 'unclosed_brace',
  EMPTY_PLACEHOLDER: 'empty_placeholder',
  UNKNOWN_PLACEHOLDER: 'unknown_placeholder',
  UNEXPECTED_CLOSE_BRACE: 'unexpected_close_brace',
  // Warnings (valid but potentially problematic)
  DUPLICATE_PLACEHOLDER: 'duplicate_placeholder',
  POTENTIALLY_EMPTY: 'potentially_empty',
  MISSING_EXTENSION: 'missing_extension',
  // Info (suggestions)
  SUGGESTION: 'suggestion',
} as const;

export type ValidationIssueType =
  (typeof ValidationIssueTypeEnum)[keyof typeof ValidationIssueTypeEnum];

/**
 * A single validation issue
 */
export const validationIssueSchema = z.object({
  severity: z.enum(['error', 'warning', 'info']),
  type: z.enum([
    'unclosed_brace',
    'empty_placeholder',
    'unknown_placeholder',
    'unexpected_close_brace',
    'duplicate_placeholder',
    'potentially_empty',
    'missing_extension',
    'suggestion',
  ]),
  message: z.string(),
  position: z.number().optional(),
  placeholder: z.string().optional(),
  suggestion: z.string().optional(),
});

export type ValidationIssue = z.infer<typeof validationIssueSchema>;

/**
 * Complete validation result
 */
export const validationResultSchema = z.object({
  valid: z.boolean(),
  pattern: z.string(),
  issues: z.array(validationIssueSchema),
  placeholders: z.array(z.string()),
  knownPlaceholders: z.array(z.string()),
  unknownPlaceholders: z.array(z.string()),
});

export type ValidationResult = z.infer<typeof validationResultSchema>;

// =============================================================================
// Template Preview Types (Story 3.7)
// =============================================================================

/**
 * Extended source type for preview tracking (includes 'fallback' and 'ai')
 */
export type PreviewPlaceholderSource =
  | 'exif'
  | 'document'
  | 'filesystem'
  | 'fallback'
  | 'literal'
  | 'ai';

/**
 * Resolution details for a single placeholder in preview
 */
export const placeholderResolutionSchema = z.object({
  placeholder: z.string(),
  value: z.string(),
  source: z.enum(['exif', 'document', 'filesystem', 'fallback', 'literal', 'ai']),
  isEmpty: z.boolean(),
  usedFallback: z.boolean(),
});

export type PlaceholderResolution = z.infer<typeof placeholderResolutionSchema>;

/**
 * Preview result for a single file
 */
export const filePreviewResultSchema = z.object({
  originalPath: z.string(),
  originalName: z.string(),
  proposedName: z.string(),
  proposedPath: z.string(),
  template: z.string(),
  resolutions: z.array(placeholderResolutionSchema),
  hasEmptyPlaceholders: z.boolean(),
  emptyPlaceholders: z.array(z.string()),
  status: z.enum(['ready', 'warning', 'error']),
  warnings: z.array(z.string()),
  error: z.string().optional(),
});

export type FilePreviewResult = z.infer<typeof filePreviewResultSchema>;

/**
 * Batch preview result
 */
export const batchPreviewResultSchema = z.object({
  template: z.string(),
  totalFiles: z.number(),
  results: z.array(filePreviewResultSchema),
  readyCount: z.number(),
  warningCount: z.number(),
  errorCount: z.number(),
});

export type BatchPreviewResult = z.infer<typeof batchPreviewResultSchema>;

/**
 * Options for preview generation
 */
export interface PreviewOptions {
  /** Custom fallback values per placeholder */
  fallbacks?: Record<string, string>;
  /** Whether to sanitize filenames (default: true) */
  sanitizeFilenames?: boolean;
  /** Whether to include extension in result (default: true) */
  includeExtension?: boolean;
  /**
   * Case normalization style for filenames.
   * Applied after template resolution and sanitization.
   * Extensions are always lowercased regardless of this setting.
   *
   * Options: 'none' | 'lowercase' | 'uppercase' | 'capitalize' |
   *          'title-case' | 'kebab-case' | 'snake_case' | 'camelCase' | 'PascalCase'
   *
   * Default: 'kebab-case' (recommended for maximum compatibility)
   */
  caseNormalization?: CaseStyle;
  /**
   * AI suggestion for filename.
   * When provided, used by {name} and {ai} placeholders:
   * - {name}: Uses AI suggestion if available, otherwise original filename
   * - {ai}: Uses AI suggestion only (empty if not available)
   * - {original}: Always uses original filename (ignores AI)
   */
  aiSuggestion?: AiSuggestion | null;
}
