/**
 * @fileoverview Configuration module exports - Story 5.1, 5.2
 *
 * Provides configuration management for tidy-app:
 * - Load/save configuration
 * - Cross-platform config paths
 * - Schema validation
 * - Custom config path resolution (5.2)
 */

// Loader functions
export { loadConfig, saveConfig, getConfigPath, configExists } from './loader.js';
export type { ConfigOptions, LoadConfigOptions } from './loader.js';

// Path resolution (Story 5.2)
export { resolveConfigPath, getDefaultConfigDir } from './paths.js';
export type { ResolveConfigPathOptions } from './paths.js';

// Schema and types (Story 5.3, 7.4, 10.1, 10.4)
export {
  appConfigSchema,
  templateSchema,
  preferencesSchema,
  rulePriorityModeSchema,
  ollamaConfigSchema,
  ollamaModelsConfigSchema,
  // Story 10.4: File type configuration
  llmFileTypesSchema,
  fileTypePresetSchema,
  DEFAULT_LLM_FILE_TYPES,
  DEFAULT_CONFIG,
  DEFAULT_TEMPLATES,
} from './schema.js';
export type {
  AppConfig,
  Template,
  Preferences,
  RulePriorityMode,
  OllamaConfig,
  OllamaModelsConfig,
  // Story 10.4: File type configuration
  LlmFileTypes,
  FileTypePresetValue,
} from './schema.js';
