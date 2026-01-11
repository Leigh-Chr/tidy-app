/**
 * @fileoverview LLM module exports - Story 10.1, 10.2, 10.5, 10.6
 *
 * Provides local LLM integration via Ollama:
 * - Health check and connectivity verification
 * - Model discovery and listing
 * - Content analysis and naming suggestions
 * - Vision model support for image analysis (Story 10.5)
 * - Offline mode support and graceful degradation (Story 10.6)
 * - Type definitions and schemas
 */

// Types and schemas
export {
  // Schemas
  ollamaErrorCodeSchema,
  ollamaConfigSchema,
  ollamaModelsConfigSchema,
  healthStatusSchema,
  ollamaModelDetailsSchema,
  ollamaModelSchema,
  // Story 10.4: File type schemas
  llmFileTypesSchema,
  fileTypePresetSchema,
  // Story 10.6: Offline mode schema
  offlineModeSchema,
  // Types
  type OllamaErrorCode,
  type OllamaError,
  type OllamaConfig,
  type OllamaModelsConfig,
  type HealthStatus,
  type OllamaModelDetails,
  type OllamaModel,
  type FormattedModel,
  // Story 10.4: File type types
  type LlmFileTypes,
  type FileTypePresetValue,
  // Story 10.6: Offline mode type
  type OfflineModeValue,
  // Utilities
  createOllamaError,
  formatModel,
  formatModelSize,
  DEFAULT_OLLAMA_CONFIG,
  // Story 10.4: File type defaults
  DEFAULT_LLM_FILE_TYPES,
} from './types.js';

// Client
export {
  createOllamaClient,
  type OllamaClient,
  type OllamaClientOptions,
} from './client.js';

// Health check
export {
  checkOllamaHealth,
  isOllamaAvailable,
  getOllamaStatus,
  getOllamaHealthReport,
  type OllamaHealthReport,
} from './health.js';

// Model discovery
export {
  listOllamaModels,
  listFormattedModels,
  getModelCount,
  isModelInstalled,
  findModel,
  getModelNames,
  getModelsByFamily,
  getModelsSummary,
  type ModelsSummary,
} from './models.js';

// Analysis types and schemas (Story 10.2, 10.6)
export {
  // Schemas
  extractedContentSchema,
  analysisRequestSchema,
  analysisSuggestionSchema,
  analysisResultSchema,
  batchAnalysisOptionsSchema,
  // Story 10.6: Analysis source schema
  analysisSourceSchema,
  // Types
  type ExtractedContent,
  type AnalysisRequest,
  type AnalysisSuggestion,
  type AnalysisResult,
  type AnalysisProgressCallback,
  type BatchAnalysisOptions,
  // Story 10.6: Analysis source type
  type AnalysisSource,
  // Utilities
  createExtractedContent,
  createAnalysisRequest,
  createAnalysisResult,
  parseAnalysisSuggestion,
  // Constants
  DEFAULT_MAX_CONTENT_CHARS,
  DEFAULT_ANALYSIS_TEMPERATURE,
  DEFAULT_MAX_RESPONSE_TOKENS,
} from './analysis.js';

// Content extraction (Story 10.2)
export {
  extractTextContent,
  extractFromString,
  isTextExtractable,
  SUPPORTED_TEXT_EXTENSIONS,
  type ExtractOptions,
} from './content-extractor.js';

// Text generation (Story 10.2)
export {
  generateCompletion,
  generate,
  type GenerateOptions,
  type GenerateResponse,
} from './generate.js';

// Content analysis (Story 10.2, 10.4)
export {
  analyzeFile,
  analyzeContent,
  analyzeFiles,
  // Story 10.4: Filtered analysis
  analyzeFilesWithFilter,
  type BatchAnalysisResult,
  type FilteredAnalysisProgressCallback,
  isAnalysisAvailable,
  getAnalysisStatus,
} from './analyzer.js';

// File type presets (Story 10.4)
export {
  FILE_TYPE_PRESETS,
  FILE_TYPE_PRESET_NAMES,
  type FileTypePreset,
  type PresetInfo,
  getPresetExtensions,
  getAllPresets,
  isValidPreset,
  getDefaultPreset,
  formatExtensionList,
} from './file-type-presets.js';

// File type filtering (Story 10.4)
export {
  shouldAnalyzeFile,
  filterFiles,
  getFilterSummary,
  getExtension,
  normalizeExt,
  type FilterResult,
  type BatchFilterResult,
} from './file-type-filter.js';

// Image encoding (Story 10.5)
export {
  encodeImageToBase64,
  isImageFile,
  getImageExtension,
  VISION_SUPPORTED_EXTENSIONS,
  DEFAULT_MAX_IMAGE_SIZE,
  type VisionSupportedExtension,
} from './image-encoder.js';

// Vision analysis (Story 10.5)
export {
  analyzeImageWithVision,
  KNOWN_VISION_MODELS,
  isVisionCapableModel,
  detectVisionModels,
  checkVisionModelAvailable,
  VISION_NAMING_SYSTEM_PROMPT,
  type KnownVisionModel,
} from './vision.js';

// Offline mode support (Story 10.6)
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
  // Types
  type LlmAvailabilityStatus,
  type OfflineOperationMode,
  type AnalysisSource as OfflineAnalysisSource,
  type OfflineFallbackResult,
  type BatchLlmStatus,
  type BatchOfflineSummary,
  type OperationDecision,
} from './offline.js';
