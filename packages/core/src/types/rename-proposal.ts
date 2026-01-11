import { z } from 'zod';

// =============================================================================
// Rename Status (Story 4.1)
// =============================================================================

/**
 * Status values for rename proposals.
 */
export const RenameStatus = {
  /** File is ready to be renamed */
  READY: 'ready',
  /** Multiple files would have the same name */
  CONFLICT: 'conflict',
  /** Required metadata for template is missing */
  MISSING_DATA: 'missing-data',
  /** Proposed name is the same as original */
  NO_CHANGE: 'no-change',
  /** Proposed name contains invalid characters */
  INVALID_NAME: 'invalid-name',
} as const;

export type RenameStatusType = (typeof RenameStatus)[keyof typeof RenameStatus];

// =============================================================================
// Rename Issue Schema
// =============================================================================

/**
 * Issue associated with a rename proposal.
 */
export const renameIssueSchema = z.object({
  /** Issue code for programmatic handling */
  code: z.string(),
  /** Human-readable message */
  message: z.string(),
  /** Field or placeholder that caused the issue */
  field: z.string().optional(),
});

export type RenameIssue = z.infer<typeof renameIssueSchema>;

// =============================================================================
// Applied Rule Schema (Story 7.3)
// =============================================================================

/**
 * Information about which rule was applied to determine the template.
 */
export const appliedRuleSchema = z.object({
  /** ID of the rule that was applied */
  ruleId: z.string(),
  /** Name of the rule for display */
  ruleName: z.string(),
  /** Type of rule that matched */
  ruleType: z.enum(['metadata', 'filename']),
});

export type AppliedRule = z.infer<typeof appliedRuleSchema>;

/**
 * Source of the template used for a proposal.
 * - 'rule': Template came from a matched rule
 * - 'default': Template is the default (no rule matched)
 * - 'fallback': Rule matched but its template was missing, so default was used
 * - 'llm': Name suggested by LLM content analysis (Story 10.3)
 */
export const templateSourceSchema = z.enum(['rule', 'default', 'fallback', 'llm']);

export type TemplateSource = z.infer<typeof templateSourceSchema>;

// =============================================================================
// LLM Suggestion Schema (Story 10.3)
// =============================================================================

/**
 * LLM-generated naming suggestion for a file.
 */
export const llmSuggestionSchema = z.object({
  /** Suggested filename (without extension) - must be non-empty */
  suggestedName: z.string().min(1, 'Suggested name cannot be empty'),
  /** Confidence score 0-1 (1 = highest confidence) */
  confidence: z.number().min(0).max(1),
  /** Brief reasoning for the suggestion */
  reasoning: z.string(),
  /** Extracted keywords from content */
  keywords: z.array(z.string()).optional(),
});

export type LlmSuggestion = z.infer<typeof llmSuggestionSchema>;

// =============================================================================
// Rename Proposal Schema
// =============================================================================

/**
 * Proposal for renaming a single file.
 */
export const renameProposalSchema = z.object({
  /** Unique ID for selection tracking */
  id: z.string(),
  /** Full path to original file */
  originalPath: z.string(),
  /** Original filename (with extension) */
  originalName: z.string(),
  /** Proposed new filename (with extension) */
  proposedName: z.string(),
  /** Full path with proposed name */
  proposedPath: z.string(),
  /** Status of this proposal */
  status: z.enum(['ready', 'conflict', 'missing-data', 'no-change', 'invalid-name']),
  /** Issues found with this proposal */
  issues: z.array(renameIssueSchema),
  /** Metadata used in template (for debugging/display) */
  metadata: z.record(z.string(), z.unknown()).optional(),
  /** Information about the rule that was applied (Story 7.3) */
  appliedRule: appliedRuleSchema.optional(),
  /** Source of the template used (Story 7.3) */
  templateSource: templateSourceSchema.optional(),
  /** True if this proposal involves moving to a different directory (Story 8.2) */
  isMoveOperation: z.boolean().optional(),
  /** ID of the folder structure applied, if any (Story 8.2) */
  folderStructureId: z.string().uuid().optional(),
  /** LLM-generated naming suggestion (Story 10.3) */
  llmSuggestion: llmSuggestionSchema.optional(),
  /** Whether to use LLM suggestion for naming instead of template (Story 10.3) */
  useLlmSuggestion: z.boolean().optional(),
});

export type RenameProposal = z.infer<typeof renameProposalSchema>;

// =============================================================================
// Preview Summary Schema
// =============================================================================

/**
 * Summary statistics for a rename preview.
 */
export const previewSummarySchema = z.object({
  /** Total number of files */
  total: z.number(),
  /** Files ready to rename */
  ready: z.number(),
  /** Files with naming conflicts */
  conflicts: z.number(),
  /** Files missing required metadata */
  missingData: z.number(),
  /** Files that would be unchanged */
  noChange: z.number(),
  /** Files with invalid proposed names */
  invalidName: z.number(),
  /** Number of files being moved to different directories (Story 8.3) */
  moveOperations: z.number().optional(),
  /** Number of files being renamed in place (Story 8.3) */
  renameOnly: z.number().optional(),
  /** Number of files using LLM-suggested names (Story 10.3) */
  llmSuggested: z.number().optional(),
});

export type PreviewSummary = z.infer<typeof previewSummarySchema>;

// =============================================================================
// Rename Preview Schema
// =============================================================================

/**
 * Complete preview of a rename operation.
 */
export const renamePreviewSchema = z.object({
  /** All file proposals */
  proposals: z.array(renameProposalSchema),
  /** Summary statistics */
  summary: previewSummarySchema,
  /** When the preview was generated */
  generatedAt: z.date(),
  /** Template pattern used */
  templateUsed: z.string(),
});

export type RenamePreview = z.infer<typeof renamePreviewSchema>;
