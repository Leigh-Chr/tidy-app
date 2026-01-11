/**
 * @fileoverview Rule type definitions for metadata pattern matching - Story 7.1
 *
 * Defines schemas and types for rules that match files based on metadata patterns.
 * Rules can have multiple conditions with AND/OR logic and are assigned to templates.
 */

import { z } from 'zod';

// =============================================================================
// Rule Operators (AC1: operators include equals, contains, startsWith, etc.)
// =============================================================================

/**
 * Supported operators for rule condition matching.
 */
export const RuleOperator = {
  /** Exact value match (case-insensitive by default) */
  EQUALS: 'equals',
  /** Value contains substring */
  CONTAINS: 'contains',
  /** Value starts with prefix */
  STARTS_WITH: 'startsWith',
  /** Value ends with suffix */
  ENDS_WITH: 'endsWith',
  /** Value matches regex pattern */
  REGEX: 'regex',
  /** Field exists and is not null/undefined */
  EXISTS: 'exists',
  /** Field does not exist or is null/undefined */
  NOT_EXISTS: 'notExists',
} as const;

export type RuleOperatorType = (typeof RuleOperator)[keyof typeof RuleOperator];

/**
 * Zod enum for rule operators (for schema validation).
 */
export const ruleOperatorSchema = z.enum([
  'equals',
  'contains',
  'startsWith',
  'endsWith',
  'regex',
  'exists',
  'notExists',
]);

// =============================================================================
// Field Path Namespaces (AC2: paths support image.*, pdf.*, office.*, file.*)
// =============================================================================

/**
 * Valid namespaces for field paths in rule conditions.
 */
export const FieldNamespace = {
  /** Image/EXIF metadata (e.g., image.cameraMake, image.dateTaken) */
  IMAGE: 'image',
  /** PDF document metadata (e.g., pdf.author, pdf.title) */
  PDF: 'pdf',
  /** Office document metadata (e.g., office.creator, office.title) */
  OFFICE: 'office',
  /** File system info (e.g., file.extension, file.name, file.category) */
  FILE: 'file',
} as const;

export type FieldNamespaceType = (typeof FieldNamespace)[keyof typeof FieldNamespace];

/**
 * Valid field paths organized by namespace.
 * Used for validation and autocomplete suggestions.
 */
export const VALID_FIELD_PATHS: Record<FieldNamespaceType, string[]> = {
  image: [
    'image.dateTaken',
    'image.cameraMake',
    'image.cameraModel',
    'image.gps',
    'image.gps.latitude',
    'image.gps.longitude',
    'image.width',
    'image.height',
    'image.orientation',
    'image.exposureTime',
    'image.fNumber',
    'image.iso',
  ],
  pdf: [
    'pdf.title',
    'pdf.author',
    'pdf.subject',
    'pdf.keywords',
    'pdf.creator',
    'pdf.producer',
    'pdf.creationDate',
    'pdf.modificationDate',
    'pdf.pageCount',
  ],
  office: [
    'office.title',
    'office.subject',
    'office.creator',
    'office.keywords',
    'office.description',
    'office.lastModifiedBy',
    'office.created',
    'office.modified',
    'office.revision',
    'office.category',
    'office.application',
    'office.appVersion',
    'office.pageCount',
    'office.wordCount',
  ],
  file: [
    'file.path',
    'file.name',
    'file.extension',
    'file.fullName',
    'file.size',
    'file.createdAt',
    'file.modifiedAt',
    'file.relativePath',
    'file.mimeType',
    'file.category',
    'file.metadataSupported',
    'file.metadataCapability',
  ],
};

/**
 * Get all valid field paths as a flat array.
 */
export function getAllValidFieldPaths(): string[] {
  return Object.values(VALID_FIELD_PATHS).flat();
}

// =============================================================================
// Rule Condition Schema (AC1: conditions support field path, operator, value)
// =============================================================================

/**
 * A single condition in a rule.
 *
 * Example: { field: 'image.cameraMake', operator: 'contains', value: 'Apple' }
 */
export const ruleConditionSchema = z.object({
  /** Field path (e.g., "image.cameraMake", "pdf.author", "file.extension") */
  field: z.string().min(1, 'Field path cannot be empty'),

  /** Comparison operator */
  operator: ruleOperatorSchema,

  /** Value to compare against (not required for exists/notExists operators) */
  value: z.string().optional(),

  /** Whether comparison is case-sensitive (default: false) */
  caseSensitive: z.boolean().default(false),
}).refine(
  (data) => {
    // exists/notExists operators don't need a value
    if (data.operator === 'exists' || data.operator === 'notExists') {
      return true;
    }
    // All other operators require a value
    return data.value !== undefined && data.value !== '';
  },
  {
    message: 'Value is required for this operator',
    path: ['value'],
  }
);

export type RuleCondition = z.infer<typeof ruleConditionSchema>;

// =============================================================================
// Match Mode (AC3: AND/OR logic)
// =============================================================================

/**
 * How multiple conditions are combined.
 */
export const MatchMode = {
  /** All conditions must match (AND logic) */
  ALL: 'all',
  /** Any condition can match (OR logic) */
  ANY: 'any',
} as const;

export type MatchModeType = (typeof MatchMode)[keyof typeof MatchMode];

export const matchModeSchema = z.enum(['all', 'any']);

// =============================================================================
// Metadata Pattern Rule Schema (AC1: complete rule definition)
// =============================================================================

/**
 * A complete metadata pattern rule.
 *
 * Rules are evaluated against file metadata to determine which template to apply.
 */
export const metadataPatternRuleSchema = z.object({
  /** Unique identifier for the rule */
  id: z.string().uuid(),

  /** User-friendly name for the rule */
  name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or less'),

  /** Optional description of what this rule does */
  description: z.string().optional(),

  /** Conditions that must be met for the rule to match */
  conditions: z.array(ruleConditionSchema).min(1, 'At least one condition is required'),

  /** How conditions are combined: 'all' (AND) or 'any' (OR) */
  matchMode: matchModeSchema.default('all'),

  /** ID of the template to apply when this rule matches */
  templateId: z.string().uuid(),

  /** Optional ID of the folder structure to apply when this rule matches (Story 8.2) */
  folderStructureId: z.string().uuid().optional(),

  /** Priority for rule ordering (higher = evaluated first) */
  priority: z.number().int().min(0).default(0),

  /** Whether the rule is enabled */
  enabled: z.boolean().default(true),

  /** When the rule was created */
  createdAt: z.string().datetime(),

  /** When the rule was last updated */
  updatedAt: z.string().datetime(),
});

export type MetadataPatternRule = z.infer<typeof metadataPatternRuleSchema>;

// =============================================================================
// Rule Creation/Update Input Types
// =============================================================================

/**
 * Input for creating a new rule.
 * ID and timestamps are auto-generated.
 */
export const createRuleInputSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  conditions: z.array(ruleConditionSchema).min(1),
  matchMode: matchModeSchema.default('all'),
  templateId: z.string().uuid(),
  folderStructureId: z.string().uuid().optional(),
  priority: z.number().int().min(0).default(0),
  enabled: z.boolean().default(true),
});

export type CreateRuleInput = z.infer<typeof createRuleInputSchema>;

/**
 * Input for updating an existing rule.
 * All fields are optional - only provided fields will be updated.
 */
export const updateRuleInputSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().nullable().optional(),
  conditions: z.array(ruleConditionSchema).min(1).optional(),
  matchMode: matchModeSchema.optional(),
  templateId: z.string().uuid().optional(),
  folderStructureId: z.string().uuid().nullable().optional(),
  priority: z.number().int().min(0).optional(),
  enabled: z.boolean().optional(),
});

export type UpdateRuleInput = z.infer<typeof updateRuleInputSchema>;

// =============================================================================
// Rule Evaluation Result (AC4: evaluateRule returns matches and matchedConditions)
// =============================================================================

/**
 * Result of evaluating a rule against file metadata.
 */
export const ruleEvaluationResultSchema = z.object({
  /** Whether the rule matched */
  matches: z.boolean(),

  /** List of field paths that matched (for debugging/transparency) */
  matchedConditions: z.array(z.string()),

  /** List of field paths that did not match (for debugging) */
  unmatchedConditions: z.array(z.string()).optional(),
});

export type RuleEvaluationResult = z.infer<typeof ruleEvaluationResultSchema>;

// =============================================================================
// Rule Error Types (for Result<T, RuleError>)
// =============================================================================

/**
 * Error codes for rule operations.
 */
export const RuleErrorCode = {
  /** Field path format is invalid */
  INVALID_FIELD_PATH: 'INVALID_FIELD_PATH',
  /** Regex pattern is invalid */
  INVALID_REGEX: 'INVALID_REGEX',
  /** Rule with given ID not found */
  RULE_NOT_FOUND: 'RULE_NOT_FOUND',
  /** A rule with this name already exists */
  DUPLICATE_RULE_NAME: 'DUPLICATE_RULE_NAME',
  /** Rule validation failed */
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  /** Template referenced by rule does not exist */
  TEMPLATE_NOT_FOUND: 'TEMPLATE_NOT_FOUND',
} as const;

export type RuleErrorCodeType = (typeof RuleErrorCode)[keyof typeof RuleErrorCode];

/**
 * Error type for rule operations.
 */
export interface RuleError {
  code: RuleErrorCodeType;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Create a RuleError instance.
 */
export function createRuleError(
  code: RuleErrorCodeType,
  message: string,
  details?: Record<string, unknown>
): RuleError {
  return { code, message, details };
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Parse a field path into namespace and field parts.
 *
 * @example
 * parseFieldPath('image.cameraMake') // { namespace: 'image', path: ['cameraMake'] }
 * parseFieldPath('image.gps.latitude') // { namespace: 'image', path: ['gps', 'latitude'] }
 */
export function parseFieldPath(fieldPath: string): {
  namespace: FieldNamespaceType | null;
  path: string[];
} {
  const parts = fieldPath.split('.');
  if (parts.length < 2) {
    return { namespace: null, path: [] };
  }

  const namespace = parts[0] as FieldNamespaceType;
  const validNamespaces: FieldNamespaceType[] = ['image', 'pdf', 'office', 'file'];

  if (!validNamespaces.includes(namespace)) {
    return { namespace: null, path: [] };
  }

  return {
    namespace,
    path: parts.slice(1),
  };
}

/**
 * Check if a field path is valid (has valid namespace and at least one field).
 */
export function isValidFieldPath(fieldPath: string): boolean {
  const { namespace, path } = parseFieldPath(fieldPath);
  return namespace !== null && path.length > 0;
}
