// Result type for error handling
export type { Result } from './result.js';
export { ok, err } from './result.js';

// File information types
export type { FileInfo } from './file-info.js';
export { fileInfoSchema } from './file-info.js';

// File category types
export {
  FileCategory,
  EXTENSION_CATEGORIES,
  getCategoryForExtension,
} from './file-category.js';

// Metadata capability
export { MetadataCapability } from './metadata-capability.js';

// Metadata support (legacy - prefer file-type-registry)
export {
  METADATA_SUPPORTED_EXTENSIONS,
  isMetadataSupported,
} from './metadata-support.js';

// File type registry
export type { FileTypeInfo } from './file-type-registry.js';
export {
  FILE_TYPE_REGISTRY,
  getFileTypeInfo,
  getMetadataCapability,
  isMetadataSupportedByRegistry,
  getSupportDescription,
  getMimeType,
  getFullMetadataExtensions,
} from './file-type-registry.js';

// Image metadata types
export type { ImageMetadata, GPSCoordinates } from './image-metadata.js';
export {
  imageMetadataSchema,
  gpsCoordinatesSchema,
  createEmptyImageMetadata,
} from './image-metadata.js';

// PDF metadata types
export type { PDFMetadata } from './pdf-metadata.js';
export { pdfMetadataSchema, createEmptyPdfMetadata } from './pdf-metadata.js';

// Office metadata types
export type { OfficeMetadata } from './office-metadata.js';
export {
  officeMetadataSchema,
  createEmptyOfficeMetadata,
} from './office-metadata.js';

// Scan result types
export type { ScanResult, ScanStatistics } from './scan-result.js';
export { scanResultSchema, scanStatisticsSchema } from './scan-result.js';

// Unified metadata types
export type { UnifiedMetadata, ExtractionStatus } from './unified-metadata.js';
export {
  unifiedMetadataSchema,
  extractionStatusSchema,
  createEmptyUnifiedMetadata,
} from './unified-metadata.js';

// Extraction error types
export type { ExtractionError, ExtractionErrorCode } from './extraction-error.js';
export {
  ExtractionErrorCode as ExtractionErrorCodeEnum,
  extractionErrorCodeSchema,
  extractionErrorSchema,
  createExtractionError,
  inferErrorCode,
} from './extraction-error.js';

// Template types
export type {
  TemplateToken,
  ParsedTemplate,
  NamedTemplate,
  PlaceholderType,
  PlaceholderCategory,
  PlaceholderSource,
  ResolvedPlaceholder,
  PlaceholderContext,
  ResolverOptions,
  // Template management types (Story 3.5)
  SavedTemplate,
  CreateTemplateInput,
  UpdateTemplateInput,
  TemplateStore,
  FileTypeDefaults,
  // Template validation types (Story 3.6)
  ValidationSeverity,
  ValidationIssue,
  ValidationIssueType,
  ValidationResult,
  // Template preview types (Story 3.7)
  PreviewPlaceholderSource,
  PlaceholderResolution,
  FilePreviewResult,
  BatchPreviewResult,
  PreviewOptions,
  // AI integration types (Story 10.3 enhancement)
  AiSuggestion,
} from './template.js';
export {
  templateTokenSchema,
  parsedTemplateSchema,
  namedTemplateSchema,
  PlaceholderCategory as PlaceholderCategoryEnum,
  PLACEHOLDER_TYPES,
  // Template management schemas (Story 3.5)
  savedTemplateSchema,
  createTemplateInputSchema,
  updateTemplateInputSchema,
  templateStoreSchema,
  fileTypeDefaultsSchema,
  // Template validation schemas (Story 3.6)
  ValidationIssueTypeEnum,
  validationIssueSchema,
  validationResultSchema,
  // Template preview schemas (Story 3.7)
  placeholderResolutionSchema,
  filePreviewResultSchema,
  batchPreviewResultSchema,
} from './template.js';

// Rename proposal types (Story 4.1, 7.3, 10.3)
export type {
  RenameStatusType,
  RenameIssue,
  RenameProposal,
  PreviewSummary,
  RenamePreview,
  AppliedRule,
  TemplateSource,
  LlmSuggestion,
} from './rename-proposal.js';
export {
  RenameStatus,
  renameIssueSchema,
  renameProposalSchema,
  previewSummarySchema,
  renamePreviewSchema,
  appliedRuleSchema,
  templateSourceSchema,
  llmSuggestionSchema,
} from './rename-proposal.js';

// Rename result types (Story 4.4)
export type {
  FileRenameResult,
  BatchRenameSummary,
  BatchRenameResult,
  RenameOutcomeType,
} from './rename-result.js';
export {
  RenameOutcome,
  fileRenameResultSchema,
  batchRenameSummarySchema,
  batchRenameResultSchema,
} from './rename-result.js';

// Rule types (Story 7.1)
export type {
  RuleOperatorType,
  FieldNamespaceType,
  RuleCondition,
  MatchModeType,
  MetadataPatternRule,
  CreateRuleInput,
  UpdateRuleInput,
  RuleEvaluationResult,
  RuleErrorCodeType,
  RuleError,
} from './rule.js';
export {
  RuleOperator,
  FieldNamespace,
  VALID_FIELD_PATHS,
  getAllValidFieldPaths,
  ruleOperatorSchema,
  ruleConditionSchema,
  MatchMode,
  matchModeSchema,
  metadataPatternRuleSchema,
  createRuleInputSchema,
  updateRuleInputSchema,
  ruleEvaluationResultSchema,
  RuleErrorCode,
  createRuleError,
  parseFieldPath,
  isValidFieldPath,
} from './rule.js';

// Filename rule types (Story 7.2)
export type {
  PatternValidationResult,
  FilenameRuleErrorCodeType,
  FilenameRuleError,
  FilenamePatternRule,
  CreateFilenameRuleInput,
  UpdateFilenameRuleInput,
  FilenameRuleEvaluationResult,
} from './filename-rule.js';
export {
  validateGlobPattern,
  isValidGlobPattern,
  FilenameRuleErrorCode,
  createFilenameRuleError,
  filenamePatternRuleSchema,
  createFilenameRuleInputSchema,
  updateFilenameRuleInputSchema,
  filenameRuleEvaluationResultSchema,
} from './filename-rule.js';

// Folder structure types (Story 8.1)
export type {
  FolderStructure,
  CreateFolderStructureInput,
  UpdateFolderStructureInput,
  FolderStructureError,
  FolderStructureErrorCodeType,
  FolderPatternValidationResult,
} from './folder-structure.js';
export {
  folderStructureSchema,
  createFolderStructureInputSchema,
  updateFolderStructureInputSchema,
  FolderStructureErrorCode,
  createFolderStructureError,
  folderPatternValidationResultSchema,
} from './folder-structure.js';

// Operation history types (Story 9.1)
export type {
  OperationType,
  FileHistoryRecord,
  OperationSummary,
  OperationHistoryEntry,
  HistoryStore,
  PruneConfig,
} from './operation-history.js';
export {
  operationTypeSchema,
  fileHistoryRecordSchema,
  operationSummarySchema,
  operationHistoryEntrySchema,
  historyStoreSchema,
  pruneConfigSchema,
  createEmptyHistoryStore,
  HISTORY_STORE_VERSION,
} from './operation-history.js';

// Undo result types (Story 9.3)
export type { UndoFileResult, UndoResult, UndoOptions } from './undo-result.js';
export {
  undoFileResultSchema,
  undoResultSchema,
  undoOptionsSchema,
  createEmptyUndoResult,
  createSuccessFileResult,
  createFailedFileResult,
  createSkippedFileResult,
} from './undo-result.js';

// Restore result types (Story 9.4)
export type {
  FileOperationEntry,
  FileHistoryLookup,
  RestoreResult,
  RestoreOptions,
} from './restore-result.js';
export {
  fileOperationEntrySchema,
  fileHistoryLookupSchema,
  restoreResultSchema,
  restoreOptionsSchema,
  createSuccessRestoreResult,
  createFailedRestoreResult,
  createMessageRestoreResult,
  createEmptyFileHistoryLookup,
} from './restore-result.js';
