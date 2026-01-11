/**
 * Rename module - Preview and execute file renames.
 *
 * @module rename
 */

export {
  generatePreview,
  type FileMetadata,
  type GeneratePreviewOptions,
  type GeneratePreviewError,
} from './preview.js';

// Formatter exports (Story 4.2)
export {
  formatPreview,
  computeDiff,
  truncateFilename,
  type DiffSegment,
  type StringDiff,
  type FileDisplay,
  type ComparisonEntry,
  type FormattedSummary,
  type FormattedPreview,
  type FormatOptions,
} from './formatter.js';

// Issue detection exports (Story 4.3)
export {
  IssueCode,
  IssueSeverity,
  detectIssues,
  convertProposalIssues,
  createIssueReport,
  addSuffix,
  addCounter,
  type IssueCodeType,
  type IssueSeverityType,
  type DetailedIssue,
  type IssueReport,
  type DetectionContext,
} from './issues.js';

// Grouped preview exports (Story 4.3)
export {
  groupPreviewByStatus,
  type GroupedPreview,
  type GroupedSummary,
  type GroupOptions,
} from './grouped-preview.js';

// Batch rename engine exports (Story 4.4, 8.4)
export {
  executeBatchRename,
  validateBatchRename,
  type ExecuteRenameOptions,
  type ValidationError,
  type ValidationErrorCode,
  type ValidationResult,
  type ValidateBatchRenameOptions,
} from './engine.js';

// Directory creation exports (Story 8.4)
export {
  ensureDirectory,
  findExistingAncestor,
  type DirectoryCreated,
} from './ensure-directory.js';

// Selection manager exports (Story 4.5)
export {
  SelectionManager,
  type SelectionState,
  type SelectionSummary,
  type SelectionPredicate,
} from './selection.js';

// Conflict detection exports (Story 4.6)
export {
  ConflictCode,
  detectBatchDuplicates,
  detectFilesystemCollisions,
  detectAllConflicts,
  blockOnConflicts,
  type ConflictInfo,
  type ConflictReport,
  type FilesystemCheckOptions,
} from './conflicts.js';

// Filename sanitization exports (Story 4.7)
export {
  sanitizeFilename,
  INVALID_CHARS_UNIVERSAL,
  INVALID_CHARS_WINDOWS,
  INVALID_CHARS_MACOS,
  INVALID_CHARS_LINUX,
  WINDOWS_RESERVED_NAMES,
  MAX_FILENAME_LENGTH,
  type SanitizeOptions,
  type SanitizeResult,
  type SanitizeChange,
  type SanitizeChangeType,
} from './sanitize.js';

// Rule-aware preview exports (Story 7.3)
export {
  generatePreviewWithRules,
  type GeneratePreviewWithRulesOptions,
  type GeneratePreviewWithRulesError,
} from './preview-with-rules.js';
