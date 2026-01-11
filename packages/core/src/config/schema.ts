/**
 * @fileoverview Configuration schema definitions - Story 5.1, 5.3, 7.1, 7.2, 7.4, 8.1, 10.1
 *
 * Defines the Zod schemas for application configuration including:
 * - Template definitions
 * - User preferences
 * - Recent folders
 * - Default templates and configuration (Story 5.3)
 * - Metadata pattern rules (Story 7.1)
 * - Filename pattern rules (Story 7.2)
 * - Rule priority mode configuration (Story 7.4)
 * - Folder structures (Story 8.1)
 * - Ollama/LLM configuration (Story 10.1)
 */
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { metadataPatternRuleSchema } from '../types/rule.js';
import { filenamePatternRuleSchema } from '../types/filename-rule.js';
import { folderStructureSchema } from '../types/folder-structure.js';

// =============================================================================
// Template Schema
// =============================================================================

/**
 * Schema for a saved template configuration.
 */
export const templateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  pattern: z.string().min(1).max(500),
  fileTypes: z.array(z.string()).optional(),
  isDefault: z.boolean().default(false),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Template = z.infer<typeof templateSchema>;

// =============================================================================
// Rule Priority Mode Schema (Story 7.4)
// =============================================================================

/**
 * Schema for rule priority mode.
 *
 * Determines how metadata rules and filename rules are prioritized:
 * - 'combined': All rules sorted by priority regardless of type (default)
 * - 'metadata-first': Metadata rules evaluated before filename rules
 * - 'filename-first': Filename rules evaluated before metadata rules
 */
export const rulePriorityModeSchema = z.enum(['combined', 'metadata-first', 'filename-first']);

export type RulePriorityMode = z.infer<typeof rulePriorityModeSchema>;

// =============================================================================
// Preferences Schema
// =============================================================================

/**
 * Schema for user preferences.
 */
export const preferencesSchema = z.object({
  defaultOutputFormat: z.enum(['table', 'json', 'plain']).default('table'),
  colorOutput: z.boolean().default(true),
  confirmBeforeApply: z.boolean().default(true),
  recursiveScan: z.boolean().default(false),
  /** Rule priority mode for template resolution (Story 7.4) */
  rulePriorityMode: rulePriorityModeSchema.default('combined'),
});

export type Preferences = z.infer<typeof preferencesSchema>;

/**
 * Default preferences with all defaults applied.
 */
const DEFAULT_PREFERENCES: Preferences = {
  defaultOutputFormat: 'table',
  colorOutput: true,
  confirmBeforeApply: true,
  recursiveScan: false,
  rulePriorityMode: 'combined',
};

// =============================================================================
// Ollama/LLM Configuration Schema (Story 10.1, 10.4)
// =============================================================================

// Import and re-export Ollama types from llm/types for backward compatibility
// The canonical definitions are in llm/types.ts
import {
  ollamaModelsConfigSchema as _ollamaModelsConfigSchema,
  type OllamaModelsConfig as _OllamaModelsConfig,
  ollamaConfigSchema as _ollamaConfigSchema,
  type OllamaConfig as _OllamaConfig,
  llmFileTypesSchema as _llmFileTypesSchema,
  type LlmFileTypes as _LlmFileTypes,
  fileTypePresetSchema as _fileTypePresetSchema,
  type FileTypePresetValue as _FileTypePresetValue,
  DEFAULT_OLLAMA_CONFIG as _DEFAULT_OLLAMA_CONFIG,
  DEFAULT_LLM_FILE_TYPES as _DEFAULT_LLM_FILE_TYPES,
} from '../llm/types.js';

// Re-export for backward compatibility
export const ollamaModelsConfigSchema = _ollamaModelsConfigSchema;
export type OllamaModelsConfig = _OllamaModelsConfig;
export const ollamaConfigSchema = _ollamaConfigSchema;
export type OllamaConfig = _OllamaConfig;
export const llmFileTypesSchema = _llmFileTypesSchema;
export type LlmFileTypes = _LlmFileTypes;
export const fileTypePresetSchema = _fileTypePresetSchema;
export type FileTypePresetValue = _FileTypePresetValue;
export const DEFAULT_OLLAMA_CONFIG = _DEFAULT_OLLAMA_CONFIG;
export const DEFAULT_LLM_FILE_TYPES = _DEFAULT_LLM_FILE_TYPES;

// =============================================================================
// App Config Schema
// =============================================================================

/**
 * Schema for the complete application configuration.
 * Uses explicit default object to ensure nested defaults are applied.
 */
export const appConfigSchema = z.object({
  version: z.literal(1),
  templates: z.array(templateSchema).default([]),
  preferences: preferencesSchema.default(DEFAULT_PREFERENCES),
  recentFolders: z.array(z.string()).max(10).default([]),
  /** Metadata pattern rules for automatic template assignment (Story 7.1) */
  rules: z.array(metadataPatternRuleSchema).default([]),
  /** Filename pattern rules for automatic template assignment (Story 7.2) */
  filenameRules: z.array(filenamePatternRuleSchema).default([]),
  /** Folder structures for organizing files into directories (Story 8.1) */
  folderStructures: z.array(folderStructureSchema).default([]),
  /** Ollama/LLM configuration for intelligent naming (Story 10.1) */
  ollama: ollamaConfigSchema.default(DEFAULT_OLLAMA_CONFIG),
});

export type AppConfig = z.infer<typeof appConfigSchema>;

// =============================================================================
// Default Templates (Story 5.3 - AC1)
// =============================================================================

// Fixed timestamp for consistent default templates
const DEFAULT_TIMESTAMP = '2024-01-01T00:00:00.000Z';

/**
 * Default templates available when no configuration exists.
 * These provide sensible starting points for common use cases.
 *
 * AC1: Default templates available - users can immediately use them
 */
export const DEFAULT_TEMPLATES: Template[] = [
  {
    id: randomUUID(),
    name: 'Date Prefix',
    pattern: '{date}-{original}',
    fileTypes: ['jpg', 'jpeg', 'png', 'heic', 'webp', 'gif'],
    isDefault: true,
    createdAt: DEFAULT_TIMESTAMP,
    updatedAt: DEFAULT_TIMESTAMP,
  },
  {
    id: randomUUID(),
    name: 'Year/Month Folders',
    pattern: '{year}/{month}/{original}',
    fileTypes: ['jpg', 'jpeg', 'png', 'heic', 'webp', 'gif'],
    isDefault: false,
    createdAt: DEFAULT_TIMESTAMP,
    updatedAt: DEFAULT_TIMESTAMP,
  },
  {
    id: randomUUID(),
    name: 'Camera + Date',
    pattern: '{camera}-{date}-{original}',
    fileTypes: ['jpg', 'jpeg', 'png', 'heic'],
    isDefault: false,
    createdAt: DEFAULT_TIMESTAMP,
    updatedAt: DEFAULT_TIMESTAMP,
  },
  {
    id: randomUUID(),
    name: 'Document Date',
    pattern: '{date}-{original}',
    fileTypes: ['pdf', 'docx', 'xlsx', 'pptx'],
    isDefault: false,
    createdAt: DEFAULT_TIMESTAMP,
    updatedAt: DEFAULT_TIMESTAMP,
  },
];

// =============================================================================
// Default Configuration
// =============================================================================

/**
 * Default configuration used when no config file exists
 * or when the config file is invalid.
 *
 * AC3: Default preferences are sensible
 * - colorOutput: true (better UX)
 * - confirmBeforeApply: true (safety)
 * - defaultOutputFormat: 'table' (human-readable)
 * - recursiveScan: false (safer default)
 *
 * Story 7.1: rules array starts empty - users create rules manually
 * Story 7.2: filenameRules array starts empty - users create rules manually
 * Story 7.4: rulePriorityMode defaults to 'combined'
 * Story 8.1: folderStructures array starts empty - users create structures manually
 * Story 10.1: ollama disabled by default (offline-first)
 * Story 10.4: fileTypes defaults to 'documents' preset
 */
export const DEFAULT_CONFIG: AppConfig = {
  version: 1,
  templates: DEFAULT_TEMPLATES,
  preferences: {
    defaultOutputFormat: 'table',
    colorOutput: true,
    confirmBeforeApply: true,
    recursiveScan: false,
    rulePriorityMode: 'combined',
  },
  recentFolders: [],
  rules: [],
  filenameRules: [],
  folderStructures: [],
  ollama: {
    enabled: false,
    baseUrl: 'http://localhost:11434',
    timeout: 30000,
    models: {},
    fileTypes: {
      preset: 'documents',
      includedExtensions: [],
      excludedExtensions: [],
      skipWithMetadata: true,
    },
    visionEnabled: false,
    skipImagesWithExif: true,
    maxImageSize: 20 * 1024 * 1024,
    offlineMode: 'auto',
    healthCheckTimeout: 5000,
  },
};
