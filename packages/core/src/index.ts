/**
 * @tidy/core - Core business logic for tidy-app
 *
 * This package provides:
 * - File scanning and discovery
 * - Metadata extraction (EXIF, PDF, Office)
 * - Naming template system
 * - Preview and rename operations
 */

// Types and utilities
export type { Result } from './types/result.js';
export { ok, err } from './types/result.js';
export type { FileInfo } from './types/file-info.js';
export { fileInfoSchema } from './types/file-info.js';

// File category and metadata capability
export { FileCategory } from './types/file-category.js';
export { MetadataCapability } from './types/metadata-capability.js';

// Scanner
export { scanFolder } from './scanner/index.js';
export type { ScanOptions } from './scanner/index.js';

// Filter
export {
  filterFiles,
  filterByCategory,
  filterByExtensions,
  filterImages,
  filterDocuments,
  filterMetadataSupported,
} from './filter/index.js';
export type { FilterOptions } from './filter/index.js';

// Statistics
export {
  calculateStatistics,
  formatStatistics,
  formatBytes,
  formatCount,
} from './statistics/index.js';
export type {
  FormattedStatistics,
  CategoryBreakdown,
} from './statistics/index.js';

// Scan result types
export type { ScanStatistics, ScanResult } from './types/scan-result.js';
export { scanStatisticsSchema, scanResultSchema } from './types/scan-result.js';

// Image metadata types
export type { ImageMetadata, GPSCoordinates } from './types/image-metadata.js';
export {
  imageMetadataSchema,
  gpsCoordinatesSchema,
  createEmptyImageMetadata,
} from './types/image-metadata.js';

// PDF metadata types
export type { PDFMetadata } from './types/pdf-metadata.js';
export {
  pdfMetadataSchema,
  createEmptyPdfMetadata,
} from './types/pdf-metadata.js';

// Office metadata types
export type { OfficeMetadata } from './types/office-metadata.js';
export {
  officeMetadataSchema,
  createEmptyOfficeMetadata,
} from './types/office-metadata.js';

// Unified metadata types
export type { UnifiedMetadata, ExtractionStatus } from './types/unified-metadata.js';
export {
  unifiedMetadataSchema,
  extractionStatusSchema,
  createEmptyUnifiedMetadata,
} from './types/unified-metadata.js';

// Extractors
export { extractExif } from './extractors/index.js';
export { extractPdf } from './extractors/index.js';
export { extractOffice } from './extractors/index.js';
export { getFileMetadata } from './extractors/index.js';

// Batch extraction
export type {
  BatchExtractionResult,
  BatchExtractionOptions,
  BatchProgressCallback,
  BatchErrorCallback,
} from './extractors/index.js';
export {
  extractBatch,
  extractSingle,
  isExtractionError,
} from './extractors/index.js';

// Extraction error types
export type { ExtractionError, ExtractionErrorCode } from './types/index.js';
export {
  ExtractionErrorCodeEnum,
  extractionErrorCodeSchema,
  extractionErrorSchema,
  createExtractionError,
  inferErrorCode,
} from './types/index.js';

// Metadata formatting
export type {
  FormattedField,
  FormattedMetadataSection,
} from './utils/index.js';
export { formatMetadataForDisplay } from './utils/index.js';

// Logger
export type {
  LogLevel,
  LogEntry,
  Logger,
  LogHandler,
  LoggerOptions,
} from './utils/index.js';
export {
  createLogger,
  formatLogEntry,
  nullLogger,
  createTestLogger,
} from './utils/index.js';

// Retry utilities
export type { RetryOptions } from './utils/index.js';
export {
  withRetry,
  withRetryResult,
  isTransientError,
  calculateBackoffDelay,
} from './utils/index.js';

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
} from './types/index.js';
export {
  templateTokenSchema,
  parsedTemplateSchema,
  namedTemplateSchema,
  PlaceholderCategoryEnum,
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
} from './types/index.js';

// Template parsing
export type {
  ParseError,
  DatePlaceholder,
  MetadataPlaceholder,
  FilePlaceholder,
  TemplateManagerError,
  StoreValidationIssue,
  PreviewError,
} from './templates/index.js';
export {
  parseTemplate,
  extractPlaceholders,
  isKnownPlaceholder,
  getKnownPlaceholders,
  getUnknownPlaceholders,
  resolveDatePlaceholder,
  isDatePlaceholder,
  getDatePlaceholders,
  resolveMetadataPlaceholder,
  isMetadataPlaceholder,
  getMetadataPlaceholders,
  resolveFilePlaceholder,
  isFilePlaceholder,
  getFilePlaceholders,
  sanitizeFilename,
  isValidFilename,
  formatBytes as formatBytesTemplate,
  parseBytes,
  // Template management functions (Story 3.5)
  createInitialStore,
  createTemplate,
  getTemplate,
  getTemplateByName,
  updateTemplate,
  deleteTemplate,
  listTemplates,
  setDefaultTemplate,
  clearDefaultTemplate,
  getDefaultForFileType,
  setGlobalDefault,
  resolveTemplateForFile,
  validateStore,
  repairStore,
  // Template validation functions (Story 3.6)
  validateTemplate,
  isValidTemplate,
  getTemplateErrors,
  getTemplateWarnings,
  getTemplateInfo,
  formatValidationResult,
  // Template preview functions (Story 3.7)
  previewFile,
  previewFiles,
  formatPreviewResult,
  formatBatchPreview,
} from './templates/index.js';

// Rename proposal types (Story 4.1)
export type {
  RenameStatusType,
  RenameIssue,
  RenameProposal,
  PreviewSummary,
  RenamePreview,
} from './types/index.js';
export {
  RenameStatus,
  renameIssueSchema,
  renameProposalSchema,
  previewSummarySchema,
  renamePreviewSchema,
} from './types/index.js';

// Rename preview (Story 4.1)
export type {
  FileMetadata,
  GeneratePreviewOptions,
  GeneratePreviewError,
} from './rename/index.js';
export { generatePreview } from './rename/index.js';

// Rename formatter (Story 4.2)
export type {
  DiffSegment,
  StringDiff,
  FileDisplay,
  ComparisonEntry,
  FormattedSummary,
  FormattedPreview,
  FormatOptions,
} from './rename/index.js';
export { formatPreview, computeDiff, truncateFilename } from './rename/index.js';

// Issue detection (Story 4.3)
export type {
  IssueCodeType,
  IssueSeverityType,
  DetailedIssue,
  IssueReport,
  DetectionContext,
  GroupedPreview,
  GroupedSummary,
  GroupOptions,
} from './rename/index.js';
export {
  IssueCode,
  IssueSeverity,
  detectIssues,
  convertProposalIssues,
  createIssueReport,
  addSuffix,
  addCounter,
  groupPreviewByStatus,
} from './rename/index.js';

// Batch rename engine (Story 4.4, 8.4)
export type {
  ExecuteRenameOptions,
  ValidationError,
  ValidationErrorCode,
  ValidationResult as RenameValidationResult,
  ValidateBatchRenameOptions,
  DirectoryCreated,
} from './rename/index.js';
export {
  executeBatchRename,
  validateBatchRename,
  ensureDirectory,
  findExistingAncestor,
} from './rename/index.js';

// Rename result types (Story 4.4)
export type {
  RenameOutcomeType,
  FileRenameResult,
  BatchRenameSummary,
  BatchRenameResult,
} from './types/rename-result.js';
export {
  RenameOutcome,
  fileRenameResultSchema,
  batchRenameSummarySchema,
  batchRenameResultSchema,
} from './types/rename-result.js';

// Selection manager (Story 4.5)
export type {
  SelectionState,
  SelectionSummary,
  SelectionPredicate,
} from './rename/index.js';
export { SelectionManager } from './rename/index.js';

// Conflict detection (Story 4.6)
export type {
  ConflictInfo,
  ConflictReport,
  FilesystemCheckOptions,
} from './rename/index.js';
export {
  ConflictCode,
  detectBatchDuplicates,
  detectFilesystemCollisions,
  detectAllConflicts,
  blockOnConflicts,
} from './rename/index.js';

// Filename sanitization (Story 4.7)
export type {
  SanitizeOptions,
  SanitizeResult,
  SanitizeChange,
  SanitizeChangeType,
} from './rename/index.js';
export {
  sanitizeFilename as sanitizeForOS,
  INVALID_CHARS_UNIVERSAL,
  INVALID_CHARS_WINDOWS,
  INVALID_CHARS_MACOS,
  INVALID_CHARS_LINUX,
  WINDOWS_RESERVED_NAMES,
  MAX_FILENAME_LENGTH,
} from './rename/index.js';

// Configuration (Story 5.1, 5.2)
export type {
  AppConfig,
  Template,
  Preferences,
  ConfigOptions,
  LoadConfigOptions,
  ResolveConfigPathOptions,
} from './config/index.js';
export {
  loadConfig,
  saveConfig,
  getConfigPath,
  configExists,
  resolveConfigPath,
  getDefaultConfigDir,
  appConfigSchema,
  templateSchema,
  preferencesSchema,
  DEFAULT_CONFIG,
  DEFAULT_TEMPLATES,
} from './config/index.js';

// Rule types (Story 7.1)
export type {
  RuleCondition,
  MetadataPatternRule,
  RuleEvaluationResult,
  CreateRuleInput,
  UpdateRuleInput,
  RuleOperatorType,
  MatchModeType,
  FieldNamespaceType,
} from './types/index.js';
export {
  RuleOperator,
  MatchMode,
  FieldNamespace,
  VALID_FIELD_PATHS,
  ruleConditionSchema,
  metadataPatternRuleSchema,
  ruleEvaluationResultSchema,
  createRuleInputSchema,
  updateRuleInputSchema,
  RuleErrorCode,
  createRuleError,
  parseFieldPath,
  isValidFieldPath,
} from './types/index.js';

// Rules module (Story 7.1)
export type {
  FieldResolutionResult,
  ConditionEvaluationResult,
  ConditionEvaluationError,
  RuleEvaluatorError,
  RuleManagerError,
} from './rules/index.js';
export {
  // Field resolution
  resolveFieldPath,
  fieldExists,
  resolveMultipleFields,
  // Condition evaluation
  evaluateCondition,
  evaluateConditions,
  clearRegexCache,
  // Rule evaluation
  evaluateRule,
  findMatchingRule,
  findAllMatchingRules,
  evaluateAllRules,
  // Rule management
  createRule,
  getRule,
  getRuleByName,
  updateRule,
  deleteRule,
  listRules,
  listEnabledRules,
  reorderRules,
  setRulePriority,
  toggleRuleEnabled,
} from './rules/index.js';

// Filename pattern rule types (Story 7.2)
export type {
  PatternValidationResult,
  FilenameRuleErrorCodeType,
  FilenameRuleError,
  FilenamePatternRule,
  CreateFilenameRuleInput,
  UpdateFilenameRuleInput,
  FilenameRuleEvaluationResult,
} from './types/index.js';
export {
  FilenameRuleErrorCode,
  createFilenameRuleError,
  filenamePatternRuleSchema,
  createFilenameRuleInputSchema,
  updateFilenameRuleInputSchema,
  filenameRuleEvaluationResultSchema,
} from './types/index.js';

// Filename rules module (Story 7.2)
export type {
  GlobMatchResult,
  GlobMatchOptions,
  MatchedFilenameRule,
  FileBatchResult,
} from './rules/index.js';
export {
  // Glob pattern matching
  matchGlob,
  isGlobMatch,
  filterByGlob,
  expandBraces,
  compileGlobPattern,
  // Pattern validation
  isValidGlobPattern,
  validateGlobPattern,
  PatternValidationMessages,
  PatternExamples,
  getPatternErrorHelp,
  // Filename rule evaluation
  evaluateFilenameRule,
  findMatchingFilenameRule,
  findAllMatchingFilenameRules,
  evaluateAllFilenameRules,
  evaluateFilenameRulesForFiles,
  // Filename rule management
  createFilenameRule,
  getFilenameRule,
  getFilenameRuleByName,
  updateFilenameRule,
  deleteFilenameRule,
  listFilenameRules,
  listEnabledFilenameRules,
  reorderFilenameRules,
  setFilenameRulePriority,
  toggleFilenameRuleEnabled,
} from './rules/index.js';

// Template resolution (Story 7.3)
export type {
  RulePriorityMode,
  RuleMatch,
  TemplateResolverOptions,
  TemplateResolutionResult,
} from './rules/index.js';
export { resolveTemplateForRule } from './rules/index.js';

// Applied rule types (Story 7.3)
export type { AppliedRule, TemplateSource } from './types/rename-proposal.js';
export { appliedRuleSchema, templateSourceSchema } from './types/rename-proposal.js';

// Rule-aware preview (Story 7.3)
export type {
  GeneratePreviewWithRulesOptions,
  GeneratePreviewWithRulesError,
} from './rename/index.js';
export { generatePreviewWithRules } from './rename/index.js';

// Unified priority management (Story 7.4)
export type {
  UnifiedRule,
  RulePriorityError,
  RulePriorityPreview,
  EvaluationOrderEntry,
  PriorityTie,
  SkipReason,
} from './rules/index.js';
export {
  getUnifiedRulePriorities,
  setUnifiedRulePriority,
  reorderUnifiedRules,
  previewRulePriority,
  detectPriorityTies,
} from './rules/index.js';

// Rule priority mode schema (Story 7.4)
export { rulePriorityModeSchema } from './config/index.js';
export type { RulePriorityMode as RulePriorityModeType } from './config/index.js';

// Workflow module (Story 7.5)
export type {
  ScanAndApplyOptions,
  ScanAndApplyResult,
  ScanAndApplyError,
  WorkflowProgressCallback,
  WorkflowTiming,
  ExtractionErrorInfo,
} from './workflow/index.js';
export { scanAndApplyRules } from './workflow/index.js';

// Folder structure types (Story 8.1)
export type {
  FolderStructure,
  CreateFolderStructureInput,
  UpdateFolderStructureInput,
  FolderStructureErrorCodeType,
  FolderStructureError,
  FolderPatternValidationResult,
} from './types/index.js';
export {
  folderStructureSchema,
  createFolderStructureInputSchema,
  updateFolderStructureInputSchema,
  FolderStructureErrorCode,
  createFolderStructureError,
} from './types/index.js';

// Organize module - folder structure management (Story 8.1)
export {
  // Folder pattern validation
  validateFolderPattern,
  isValidFolderPattern,
  normalizeFolderPattern,
  extractFolderPlaceholders,
  VALID_FOLDER_PLACEHOLDERS,
  // Folder structure CRUD operations
  createFolderStructure,
  getFolderStructure,
  getFolderStructureByName,
  updateFolderStructure,
  deleteFolderStructure,
  listFolderStructures,
  listEnabledFolderStructures,
  toggleFolderStructureEnabled,
  setFolderStructurePriority,
  reorderFolderStructures,
  // Folder path resolution (Story 8.2)
  resolveFolderPath,
} from './organize/index.js';

// Folder path resolution types (Story 8.2)
export type {
  ResolveFolderPathOptions,
  FolderPathResolution,
  FolderResolutionError,
} from './organize/index.js';

// Preview formatting and filtering (Story 8.3)
export {
  formatMovePreview,
  formatSourceToDestination,
  getFolderStructureName,
  filterPreviewByOperationType,
  analyzeDestinationFolders,
} from './organize/index.js';

// Preview formatting types (Story 8.3)
export type {
  MovePreviewDisplay,
  PreviewFilterType,
  DestinationFolderAnalysis,
} from './organize/index.js';

// Operation history types (Story 9.1)
export type {
  OperationType,
  FileHistoryRecord,
  OperationSummary,
  OperationHistoryEntry,
  HistoryStore,
  PruneConfig,
} from './types/index.js';
export {
  operationTypeSchema,
  fileHistoryRecordSchema,
  operationSummarySchema,
  operationHistoryEntrySchema,
  historyStoreSchema,
  pruneConfigSchema,
  createEmptyHistoryStore,
  HISTORY_STORE_VERSION,
} from './types/index.js';

// History module (Story 9.1, 9.2, 9.3)
export type { RecordOptions, QueryOptions } from './history/index.js';
export {
  // Storage functions
  loadHistory,
  saveHistory,
  getHistoryPath,
  HISTORY_FILENAME,
  // Recording functions
  recordOperation,
  createEntryFromResult,
  determineOperationType,
  // Pruning functions
  pruneHistory,
  shouldPrune,
  DEFAULT_PRUNE_CONFIG,
  // Query functions (Story 9.2)
  getHistory,
  getHistoryEntry,
  getHistoryCount,
  // Undo functions (Story 9.3)
  undoOperation,
  cleanupDirectories,
  markOperationAsUndone,
  isOperationUndone,
} from './history/index.js';

// Undo result types (Story 9.3)
export type { UndoFileResult, UndoResult, UndoOptions } from './types/index.js';
export {
  undoFileResultSchema,
  undoResultSchema,
  undoOptionsSchema,
  createEmptyUndoResult,
  createSuccessFileResult,
  createFailedFileResult,
  createSkippedFileResult,
} from './types/index.js';

// Restore types (Story 9.4)
export type {
  FileOperationEntry,
  FileHistoryLookup,
  RestoreResult,
  RestoreOptions,
} from './types/restore-result.js';
export {
  fileOperationEntrySchema,
  fileHistoryLookupSchema,
  restoreResultSchema,
  restoreOptionsSchema,
  createSuccessRestoreResult,
  createFailedRestoreResult,
  createMessageRestoreResult,
  createEmptyFileHistoryLookup,
} from './types/restore-result.js';

// Restore functions (Story 9.4)
export {
  lookupFileHistory,
  lookupMultipleFiles,
  hasFileBeenRenamed,
  getOriginalPath,
  restoreFile,
  restoreFileWithDetails,
  canRestoreFile,
} from './history/index.js';

// LLM/Ollama integration (Story 10.1)
export type {
  OllamaErrorCode,
  OllamaError,
  OllamaConfig,
  OllamaModelsConfig,
  HealthStatus,
  OllamaModelDetails,
  OllamaModel,
  FormattedModel,
  OllamaClient,
  OllamaClientOptions,
  OllamaHealthReport,
  ModelsSummary,
} from './llm/index.js';
export {
  // Schemas
  ollamaErrorCodeSchema,
  ollamaConfigSchema as ollamaConfigSchemaLlm,
  ollamaModelsConfigSchema as ollamaModelsConfigSchemaLlm,
  healthStatusSchema,
  ollamaModelDetailsSchema,
  ollamaModelSchema,
  // Utilities
  createOllamaError,
  formatModel,
  formatModelSize,
  DEFAULT_OLLAMA_CONFIG,
  // Client
  createOllamaClient,
  // Health check
  checkOllamaHealth,
  isOllamaAvailable,
  getOllamaStatus,
  getOllamaHealthReport,
  // Model discovery
  listOllamaModels,
  listFormattedModels,
  getModelCount,
  isModelInstalled,
  findModel,
  getModelNames,
  getModelsByFamily,
  getModelsSummary,
} from './llm/index.js';

// Ollama config types from config module (Story 10.1)
export {
  ollamaConfigSchema,
  ollamaModelsConfigSchema,
} from './config/index.js';

// LLM file type configuration (Story 10.4)
export type {
  LlmFileTypes,
  FileTypePresetValue,
  FilterResult,
  BatchFilterResult,
  FilteredAnalysisProgressCallback,
  BatchAnalysisResult,
} from './llm/index.js';
export {
  // File type schemas
  llmFileTypesSchema,
  fileTypePresetSchema,
  DEFAULT_LLM_FILE_TYPES,
  // File type presets
  FILE_TYPE_PRESETS,
  FILE_TYPE_PRESET_NAMES,
  getPresetExtensions,
  getAllPresets,
  isValidPreset,
  getDefaultPreset,
  formatExtensionList,
  // File type filtering
  shouldAnalyzeFile,
  filterFiles as filterFilesByType,
  getFilterSummary,
  getExtension,
  normalizeExt,
  // Filtered analysis
  analyzeFilesWithFilter,
} from './llm/index.js';

// LLM vision support (Story 10.5)
export type {
  KnownVisionModel,
  VisionSupportedExtension,
} from './llm/index.js';
export {
  // Image encoding
  encodeImageToBase64,
  isImageFile,
  getImageExtension,
  VISION_SUPPORTED_EXTENSIONS,
  DEFAULT_MAX_IMAGE_SIZE,
  // Vision analysis
  analyzeImageWithVision,
  KNOWN_VISION_MODELS,
  isVisionCapableModel,
  detectVisionModels,
  checkVisionModelAvailable,
  VISION_NAMING_SYSTEM_PROMPT,
} from './llm/index.js';

// LLM offline mode support (Story 10.6)
export type {
  LlmAvailabilityStatus,
  OfflineOperationMode,
  OfflineFallbackResult,
  BatchLlmStatus,
  BatchOfflineSummary,
  OperationDecision,
  AnalysisSource,
} from './llm/index.js';
export {
  // Pre-operation check
  checkLlmAvailabilityForOperation,
  shouldProceedWithOperation,
  // Fallback result creation
  createOfflineFallbackResult,
  createBatchOfflineSummary,
  // Error detection
  isConnectionError,
  // Display formatting
  formatOfflineStatus,
  // Message templates
  OFFLINE_MESSAGES,
  // Analysis source schema
  analysisSourceSchema,
} from './llm/index.js';

// Version
export const VERSION = '0.0.1';
