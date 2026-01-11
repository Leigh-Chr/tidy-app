/**
 * Template Manager - CRUD operations and default management for templates.
 *
 * Provides functions to create, read, update, delete, and manage templates
 * with support for file-type-specific defaults and built-in system templates.
 */

import { randomUUID } from 'crypto';
import { z } from 'zod';
import { ok, err } from '../types/result.js';
import type { Result } from '../types/result.js';
import type {
  SavedTemplate,
  CreateTemplateInput,
  UpdateTemplateInput,
  TemplateStore,
  FileTypeDefaults,
} from '../types/template.js';
import {
  createTemplateInputSchema,
  updateTemplateInputSchema,
} from '../types/template.js';
import { parseTemplate } from './parser.js';
import type { FileCategory } from '../types/file-category.js';
import type { FileInfo } from '../types/file-info.js';

// =============================================================================
// Built-in Templates
// =============================================================================

/**
 * Built-in templates that ship with tidy-app.
 * These cannot be modified or deleted by users.
 */
const BUILT_IN_TEMPLATES: Omit<SavedTemplate, 'createdAt' | 'updatedAt'>[] = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    name: 'Date Prefix',
    pattern: '{date}-{original}',
    description: 'Adds date prefix to original filename',
    isBuiltIn: true,
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    name: 'Photo Organizer',
    pattern: '{year}-{month}-{day}_{camera}_{original}',
    description: 'Organizes photos by date and camera',
    isBuiltIn: true,
  },
  {
    id: '00000000-0000-0000-0000-000000000003',
    name: 'Document Naming',
    pattern: '{date}_{title}_{author}',
    description: 'Names documents by date, title, and author',
    isBuiltIn: true,
  },
];

// =============================================================================
// Error Types
// =============================================================================

/**
 * Error types that can occur during template management operations.
 */
export interface TemplateManagerError {
  type:
    | 'not_found'
    | 'validation_error'
    | 'duplicate_name'
    | 'cannot_modify_builtin'
    | 'invalid_pattern';
  message: string;
  details?: unknown;
}

// =============================================================================
// Store Initialization
// =============================================================================

/**
 * Create an initial template store with built-in templates.
 *
 * @returns A new TemplateStore with default configuration
 *
 * @example
 * ```typescript
 * const store = createInitialStore();
 * console.log(store.templates.length); // 3 built-in templates
 * ```
 */
export function createInitialStore(): TemplateStore {
  const now = new Date();
  const templates: SavedTemplate[] = BUILT_IN_TEMPLATES.map((t) => ({
    ...t,
    createdAt: now,
    updatedAt: now,
  }));

  const firstBuiltIn = BUILT_IN_TEMPLATES[0];

  return {
    templates,
    defaults: {},
    globalDefault: firstBuiltIn?.id,
  };
}

// =============================================================================
// Store Validation
// =============================================================================

/**
 * Validation issue found during store validation.
 */
export interface StoreValidationIssue {
  type: 'missing_builtin' | 'invalid_default_ref' | 'invalid_global_default';
  message: string;
  details?: unknown;
}

/**
 * Validate a template store for integrity issues.
 *
 * Checks:
 * 1. All built-in templates are present and unmodified
 * 2. All template IDs in defaults reference existing templates
 * 3. Global default references an existing template
 *
 * @param store - The template store to validate
 * @returns Array of validation issues (empty if valid)
 *
 * @example
 * ```typescript
 * const issues = validateStore(loadedStore);
 * if (issues.length > 0) {
 *   console.error('Store validation failed:', issues);
 * }
 * ```
 */
export function validateStore(store: TemplateStore): StoreValidationIssue[] {
  const issues: StoreValidationIssue[] = [];
  const templateIds = new Set(store.templates.map((t) => t.id));

  // Check that all built-in templates exist with correct IDs and patterns
  for (const builtIn of BUILT_IN_TEMPLATES) {
    const found = store.templates.find((t) => t.id === builtIn.id);
    if (!found) {
      issues.push({
        type: 'missing_builtin',
        message: `Built-in template "${builtIn.name}" (${builtIn.id}) is missing`,
        details: { expectedId: builtIn.id, expectedName: builtIn.name },
      });
    } else if (found.pattern !== builtIn.pattern || found.name !== builtIn.name) {
      issues.push({
        type: 'missing_builtin',
        message: `Built-in template "${builtIn.name}" has been modified`,
        details: {
          expectedPattern: builtIn.pattern,
          actualPattern: found.pattern,
          expectedName: builtIn.name,
          actualName: found.name,
        },
      });
    }
  }

  // Check that all defaults reference existing templates
  for (const [category, templateId] of Object.entries(store.defaults)) {
    if (templateId && !templateIds.has(templateId)) {
      issues.push({
        type: 'invalid_default_ref',
        message: `Default for ${category} references non-existent template "${templateId}"`,
        details: { category, templateId },
      });
    }
  }

  // Check that global default references an existing template
  if (store.globalDefault && !templateIds.has(store.globalDefault)) {
    issues.push({
      type: 'invalid_global_default',
      message: `Global default references non-existent template "${store.globalDefault}"`,
      details: { templateId: store.globalDefault },
    });
  }

  return issues;
}

/**
 * Repair a template store by fixing integrity issues.
 *
 * Repairs:
 * 1. Adds missing built-in templates
 * 2. Removes invalid default references
 * 3. Resets invalid global default to first built-in
 *
 * @param store - The template store to repair
 * @returns Repaired store
 */
export function repairStore(store: TemplateStore): TemplateStore {
  const now = new Date();
  const templateIds = new Set(store.templates.map((t) => t.id));

  // Add missing built-in templates
  const missingBuiltIns: SavedTemplate[] = [];
  for (const builtIn of BUILT_IN_TEMPLATES) {
    if (!templateIds.has(builtIn.id)) {
      missingBuiltIns.push({
        ...builtIn,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  const repairedTemplates = [...store.templates, ...missingBuiltIns];
  const repairedTemplateIds = new Set(repairedTemplates.map((t) => t.id));

  // Remove invalid defaults
  const repairedDefaults: FileTypeDefaults = {};
  for (const [category, templateId] of Object.entries(store.defaults)) {
    if (templateId && repairedTemplateIds.has(templateId)) {
      repairedDefaults[category as FileCategory] = templateId;
    }
  }

  // Fix global default if invalid
  const firstBuiltIn = BUILT_IN_TEMPLATES[0];
  const repairedGlobalDefault =
    store.globalDefault && repairedTemplateIds.has(store.globalDefault)
      ? store.globalDefault
      : firstBuiltIn?.id;

  return {
    templates: repairedTemplates,
    defaults: repairedDefaults,
    globalDefault: repairedGlobalDefault,
  };
}

// =============================================================================
// CRUD Operations
// =============================================================================

/**
 * Create a new template.
 *
 * @param store - The current template store
 * @param input - Template creation input (name, pattern, optional description)
 * @returns Result with updated store and created template, or error
 *
 * @example
 * ```typescript
 * const result = createTemplate(store, {
 *   name: 'My Template',
 *   pattern: '{year}-{original}',
 *   description: 'Add year prefix',
 * });
 *
 * if (result.ok) {
 *   console.log(result.data.template.id);
 * }
 * ```
 */
export function createTemplate(
  store: TemplateStore,
  input: CreateTemplateInput
): Result<{ store: TemplateStore; template: SavedTemplate }, TemplateManagerError> {
  // Validate input schema
  const validation = createTemplateInputSchema.safeParse(input);
  if (!validation.success) {
    return err({
      type: 'validation_error',
      message: 'Invalid template input',
      details: z.treeifyError(validation.error),
    });
  }

  // Validate pattern syntax
  const patternResult = parseTemplate(input.pattern);
  if (!patternResult.ok) {
    return err({
      type: 'invalid_pattern',
      message: `Invalid template pattern: ${patternResult.error.message}`,
      details: patternResult.error,
    });
  }

  // Check for duplicate name (case-insensitive)
  const nameExists = store.templates.some(
    (t) => t.name.toLowerCase() === input.name.toLowerCase()
  );
  if (nameExists) {
    return err({
      type: 'duplicate_name',
      message: `A template named "${input.name}" already exists`,
    });
  }

  const now = new Date();
  const template: SavedTemplate = {
    id: randomUUID(),
    name: input.name,
    pattern: input.pattern,
    description: input.description,
    isBuiltIn: false,
    createdAt: now,
    updatedAt: now,
  };

  const newStore: TemplateStore = {
    ...store,
    templates: [...store.templates, template],
  };

  return ok({ store: newStore, template });
}

/**
 * Get a template by its unique ID.
 *
 * @param store - The template store
 * @param id - The template ID
 * @returns Result with the template, or not_found error
 */
export function getTemplate(
  store: TemplateStore,
  id: string
): Result<SavedTemplate, TemplateManagerError> {
  const template = store.templates.find((t) => t.id === id);

  if (!template) {
    return err({
      type: 'not_found',
      message: `Template with ID "${id}" not found`,
    });
  }

  return ok(template);
}

/**
 * Get a template by its name (case-insensitive).
 *
 * @param store - The template store
 * @param name - The template name
 * @returns Result with the template, or not_found error
 */
export function getTemplateByName(
  store: TemplateStore,
  name: string
): Result<SavedTemplate, TemplateManagerError> {
  const template = store.templates.find(
    (t) => t.name.toLowerCase() === name.toLowerCase()
  );

  if (!template) {
    return err({
      type: 'not_found',
      message: `Template named "${name}" not found`,
    });
  }

  return ok(template);
}

/**
 * Update an existing template.
 *
 * @param store - The template store
 * @param id - The ID of the template to update
 * @param input - Fields to update (all optional)
 * @returns Result with updated store and template, or error
 */
export function updateTemplate(
  store: TemplateStore,
  id: string,
  input: UpdateTemplateInput
): Result<{ store: TemplateStore; template: SavedTemplate }, TemplateManagerError> {
  // Validate input schema FIRST (gives accurate error messages)
  const validation = updateTemplateInputSchema.safeParse(input);
  if (!validation.success) {
    return err({
      type: 'validation_error',
      message: 'Invalid update input',
      details: z.treeifyError(validation.error),
    });
  }

  // Validate pattern syntax if provided
  if (input.pattern) {
    const patternResult = parseTemplate(input.pattern);
    if (!patternResult.ok) {
      return err({
        type: 'invalid_pattern',
        message: `Invalid template pattern: ${patternResult.error.message}`,
        details: patternResult.error,
      });
    }
  }

  const templateIndex = store.templates.findIndex((t) => t.id === id);
  const existing = store.templates[templateIndex];

  if (templateIndex === -1 || !existing) {
    return err({
      type: 'not_found',
      message: `Template with ID "${id}" not found`,
    });
  }

  // Cannot modify built-in templates
  if (existing.isBuiltIn) {
    return err({
      type: 'cannot_modify_builtin',
      message: 'Cannot modify built-in templates',
    });
  }

  // Check for duplicate name if name is being changed
  const newName = input.name;
  if (newName && newName.toLowerCase() !== existing.name.toLowerCase()) {
    const nameExists = store.templates.some(
      (t) => t.name.toLowerCase() === newName.toLowerCase()
    );
    if (nameExists) {
      return err({
        type: 'duplicate_name',
        message: `A template named "${newName}" already exists`,
      });
    }
  }

  // Handle description: null means clear, undefined means keep existing
  let newDescription: string | undefined;
  if (input.description === null) {
    newDescription = undefined; // Explicitly clear
  } else if (input.description !== undefined) {
    newDescription = input.description; // Set new value
  } else {
    newDescription = existing.description; // Keep existing
  }

  const updated: SavedTemplate = {
    id: existing.id,
    name: input.name ?? existing.name,
    pattern: input.pattern ?? existing.pattern,
    description: newDescription,
    isBuiltIn: existing.isBuiltIn,
    createdAt: existing.createdAt,
    updatedAt: new Date(),
  };

  const newTemplates = [...store.templates];
  newTemplates[templateIndex] = updated;

  return ok({
    store: { ...store, templates: newTemplates },
    template: updated,
  });
}

/**
 * Delete a template.
 *
 * Built-in templates cannot be deleted.
 * If the deleted template was set as a default, that default is removed.
 * If it was the global default, the global default is reset to the first built-in.
 *
 * @param store - The template store
 * @param id - The ID of the template to delete
 * @returns Result with updated store, or error
 */
export function deleteTemplate(
  store: TemplateStore,
  id: string
): Result<TemplateStore, TemplateManagerError> {
  const template = store.templates.find((t) => t.id === id);

  if (!template) {
    return err({
      type: 'not_found',
      message: `Template with ID "${id}" not found`,
    });
  }

  if (template.isBuiltIn) {
    return err({
      type: 'cannot_modify_builtin',
      message: 'Cannot delete built-in templates',
    });
  }

  // Remove from templates list
  const newTemplates = store.templates.filter((t) => t.id !== id);

  // Remove from file type defaults if it was set as default
  // Build new defaults object excluding the deleted template
  const newDefaults: FileTypeDefaults = {};
  for (const [category, templateId] of Object.entries(store.defaults)) {
    if (templateId && templateId !== id) {
      newDefaults[category as FileCategory] = templateId;
    }
  }

  // Reset global default if this was it
  const firstBuiltIn = BUILT_IN_TEMPLATES[0];
  const newGlobalDefault =
    store.globalDefault === id ? firstBuiltIn?.id : store.globalDefault;

  return ok({
    templates: newTemplates,
    defaults: newDefaults,
    globalDefault: newGlobalDefault,
  });
}

/**
 * List all templates, sorted with built-in templates first, then alphabetically by name.
 *
 * @param store - The template store
 * @returns Sorted array of all templates (copy, not reference)
 */
export function listTemplates(store: TemplateStore): SavedTemplate[] {
  return [...store.templates].sort((a, b) => {
    // Built-in templates first
    if (a.isBuiltIn && !b.isBuiltIn) return -1;
    if (!a.isBuiltIn && b.isBuiltIn) return 1;
    // Then alphabetically by name
    return a.name.localeCompare(b.name);
  });
}

// =============================================================================
// Default Template Management
// =============================================================================

/**
 * Set a template as the default for a specific file category.
 *
 * @param store - The template store
 * @param category - The file category
 * @param templateId - The template ID to set as default
 * @returns Result with updated store, or not_found error if template doesn't exist
 */
export function setDefaultTemplate(
  store: TemplateStore,
  category: FileCategory,
  templateId: string
): Result<TemplateStore, TemplateManagerError> {
  // Verify template exists
  const templateExists = store.templates.some((t) => t.id === templateId);
  if (!templateExists) {
    return err({
      type: 'not_found',
      message: `Template with ID "${templateId}" not found`,
    });
  }

  return ok({
    ...store,
    defaults: {
      ...store.defaults,
      [category]: templateId,
    },
  });
}

/**
 * Clear the default template for a specific file category.
 *
 * After clearing, the category will fall back to the global default.
 *
 * @param store - The template store
 * @param category - The file category to clear the default for
 * @returns Updated store with the category default removed
 */
export function clearDefaultTemplate(
  store: TemplateStore,
  category: FileCategory
): TemplateStore {
  const newDefaults: FileTypeDefaults = {};
  for (const [cat, templateId] of Object.entries(store.defaults)) {
    if (cat !== category && templateId) {
      newDefaults[cat as FileCategory] = templateId;
    }
  }

  return {
    ...store,
    defaults: newDefaults,
  };
}

/**
 * Get the default template for a specific file category.
 *
 * Resolution priority:
 * 1. Category-specific default
 * 2. Global default
 * 3. First built-in template
 *
 * @param store - The template store
 * @param category - The file category
 * @returns The default template, or null if no templates exist
 */
export function getDefaultForFileType(
  store: TemplateStore,
  category: FileCategory
): SavedTemplate | null {
  // 1. Check category-specific default
  const defaultId = store.defaults[category];
  if (defaultId) {
    const template = store.templates.find((t) => t.id === defaultId);
    if (template) return template;
  }

  // 2. Fall back to global default
  if (store.globalDefault) {
    const template = store.templates.find((t) => t.id === store.globalDefault);
    if (template) return template;
  }

  // 3. Last resort: first built-in template
  return store.templates.find((t) => t.isBuiltIn) ?? null;
}

/**
 * Set the global default template.
 *
 * @param store - The template store
 * @param templateId - The template ID to set as global default
 * @returns Result with updated store, or not_found error
 */
export function setGlobalDefault(
  store: TemplateStore,
  templateId: string
): Result<TemplateStore, TemplateManagerError> {
  const templateExists = store.templates.some((t) => t.id === templateId);
  if (!templateExists) {
    return err({
      type: 'not_found',
      message: `Template with ID "${templateId}" not found`,
    });
  }

  return ok({
    ...store,
    globalDefault: templateId,
  });
}

// =============================================================================
// Template Resolution
// =============================================================================

/**
 * Resolve which template to use for a specific file.
 *
 * Resolution priority:
 * 1. Explicit template ID (if provided and valid)
 * 2. File category default
 * 3. Global default
 * 4. First built-in template
 *
 * @param store - The template store
 * @param file - The file to resolve a template for
 * @param explicitTemplateId - Optional explicit template ID to use
 * @returns The resolved template, or null if no templates exist
 *
 * @example
 * ```typescript
 * // Explicit selection
 * const template = resolveTemplateForFile(store, file, 'my-template-id');
 *
 * // Automatic selection based on file category
 * const template = resolveTemplateForFile(store, file);
 * ```
 */
export function resolveTemplateForFile(
  store: TemplateStore,
  file: FileInfo,
  explicitTemplateId?: string
): SavedTemplate | null {
  // 1. Explicit selection takes precedence (if valid)
  if (explicitTemplateId) {
    const template = store.templates.find((t) => t.id === explicitTemplateId);
    if (template) return template;
    // If explicit ID is invalid, fall through to defaults
  }

  // 2. Use file category default (handles global default and built-in fallback)
  return getDefaultForFileType(store, file.category);
}
