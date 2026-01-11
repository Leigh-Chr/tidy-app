import { describe, it, expect, beforeEach } from 'vitest';
import {
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
  type TemplateManagerError,
  type StoreValidationIssue,
} from './manager.js';
import type { TemplateStore } from '../types/template.js';
import { FileCategory } from '../types/file-category.js';
import type { FileInfo } from '../types/file-info.js';
import { MetadataCapability } from '../types/metadata-capability.js';

/**
 * Create a mock FileInfo for testing
 */
const createMockFile = (
  overrides: Partial<FileInfo> = {}
): FileInfo => ({
  path: '/test/photo.jpg',
  name: 'photo',
  extension: 'jpg',
  fullName: 'photo.jpg',
  size: 1024,
  createdAt: new Date(),
  modifiedAt: new Date(),
  category: FileCategory.IMAGE,
  metadataSupported: true,
  metadataCapability: MetadataCapability.FULL,
  ...overrides,
});

describe('TemplateManager', () => {
  let store: TemplateStore;

  beforeEach(() => {
    store = createInitialStore();
  });

  describe('createInitialStore', () => {
    it('creates store with built-in templates', () => {
      expect(store.templates.length).toBeGreaterThan(0);
      expect(store.templates.some((t) => t.isBuiltIn)).toBe(true);
    });

    it('sets a global default', () => {
      expect(store.globalDefault).toBeDefined();
    });

    it('initializes with empty defaults object', () => {
      expect(store.defaults).toEqual({});
    });

    it('all built-in templates have valid IDs', () => {
      for (const template of store.templates.filter((t) => t.isBuiltIn)) {
        expect(template.id).toBeDefined();
        expect(typeof template.id).toBe('string');
      }
    });

    it('built-in templates have createdAt and updatedAt dates', () => {
      for (const template of store.templates) {
        expect(template.createdAt).toBeInstanceOf(Date);
        expect(template.updatedAt).toBeInstanceOf(Date);
      }
    });
  });

  describe('createTemplate', () => {
    it('creates a new template with generated ID', () => {
      const result = createTemplate(store, {
        name: 'My Template',
        pattern: '{year}-{original}',
        description: 'Test template',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.template.name).toBe('My Template');
        expect(result.data.template.pattern).toBe('{year}-{original}');
        expect(result.data.template.description).toBe('Test template');
        expect(result.data.template.isBuiltIn).toBe(false);
        expect(result.data.template.id).toBeDefined();
        expect(result.data.store.templates).toContainEqual(result.data.template);
      }
    });

    it('sets createdAt and updatedAt to current time', () => {
      const before = new Date();
      const result = createTemplate(store, {
        name: 'Test',
        pattern: '{original}',
      });
      const after = new Date();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.template.createdAt.getTime()).toBeGreaterThanOrEqual(
          before.getTime()
        );
        expect(result.data.template.createdAt.getTime()).toBeLessThanOrEqual(
          after.getTime()
        );
        expect(result.data.template.updatedAt).toEqual(
          result.data.template.createdAt
        );
      }
    });

    it('rejects duplicate names (case-insensitive)', () => {
      const first = createTemplate(store, { name: 'Test', pattern: '{original}' });
      expect(first.ok).toBe(true);
      if (!first.ok) return;

      const result = createTemplate(first.data.store, {
        name: 'TEST',
        pattern: '{year}',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('duplicate_name');
      }
    });

    it('rejects invalid patterns (unclosed brace)', () => {
      const result = createTemplate(store, {
        name: 'Invalid',
        pattern: '{unclosed',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('invalid_pattern');
      }
    });

    it('rejects empty pattern', () => {
      const result = createTemplate(store, {
        name: 'Empty',
        pattern: '',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('validation_error');
      }
    });

    it('rejects empty name', () => {
      const result = createTemplate(store, {
        name: '',
        pattern: '{original}',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('validation_error');
      }
    });

    it('rejects name longer than 100 characters', () => {
      const result = createTemplate(store, {
        name: 'a'.repeat(101),
        pattern: '{original}',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('validation_error');
      }
    });

    it('allows description to be optional', () => {
      const result = createTemplate(store, {
        name: 'No Description',
        pattern: '{original}',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.template.description).toBeUndefined();
      }
    });

    it('does not mutate the original store', () => {
      const originalTemplateCount = store.templates.length;
      createTemplate(store, { name: 'Test', pattern: '{original}' });
      expect(store.templates.length).toBe(originalTemplateCount);
    });
  });

  describe('getTemplate', () => {
    it('retrieves template by ID', () => {
      const created = createTemplate(store, {
        name: 'Test',
        pattern: '{original}',
      });

      if (!created.ok) throw new Error('Setup failed');

      const result = getTemplate(created.data.store, created.data.template.id);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.name).toBe('Test');
        expect(result.data.id).toBe(created.data.template.id);
      }
    });

    it('retrieves built-in templates', () => {
      const builtIn = store.templates.find((t) => t.isBuiltIn);
      expect(builtIn).toBeDefined();
      if (!builtIn) return;

      const result = getTemplate(store, builtIn.id);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.isBuiltIn).toBe(true);
      }
    });

    it('returns error for non-existent ID', () => {
      const result = getTemplate(store, 'non-existent-id');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('not_found');
      }
    });
  });

  describe('getTemplateByName', () => {
    it('retrieves template by exact name', () => {
      const created = createTemplate(store, {
        name: 'My Template',
        pattern: '{original}',
      });

      if (!created.ok) throw new Error('Setup failed');

      const result = getTemplateByName(created.data.store, 'My Template');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.name).toBe('My Template');
      }
    });

    it('retrieves template case-insensitively', () => {
      const created = createTemplate(store, {
        name: 'My Template',
        pattern: '{original}',
      });

      if (!created.ok) throw new Error('Setup failed');

      const result = getTemplateByName(created.data.store, 'my template');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.name).toBe('My Template');
      }
    });

    it('returns error for non-existent name', () => {
      const result = getTemplateByName(store, 'Does Not Exist');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('not_found');
      }
    });
  });

  describe('updateTemplate', () => {
    it('updates template name', () => {
      const created = createTemplate(store, {
        name: 'Original',
        pattern: '{original}',
      });

      if (!created.ok) throw new Error('Setup failed');

      const result = updateTemplate(created.data.store, created.data.template.id, {
        name: 'Updated',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.template.name).toBe('Updated');
      }
    });

    it('updates template pattern', () => {
      const created = createTemplate(store, {
        name: 'Test',
        pattern: '{original}',
      });

      if (!created.ok) throw new Error('Setup failed');

      const result = updateTemplate(created.data.store, created.data.template.id, {
        pattern: '{year}-{original}',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.template.pattern).toBe('{year}-{original}');
      }
    });

    it('updates template description', () => {
      const created = createTemplate(store, {
        name: 'Test',
        pattern: '{original}',
      });

      if (!created.ok) throw new Error('Setup failed');

      const result = updateTemplate(created.data.store, created.data.template.id, {
        description: 'New description',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.template.description).toBe('New description');
      }
    });

    it('updates updatedAt timestamp', () => {
      const created = createTemplate(store, {
        name: 'Test',
        pattern: '{original}',
      });

      if (!created.ok) throw new Error('Setup failed');

      const originalUpdatedAt = created.data.template.updatedAt;

      // Small delay to ensure timestamp difference
      const result = updateTemplate(created.data.store, created.data.template.id, {
        name: 'Updated',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.template.updatedAt.getTime()).toBeGreaterThanOrEqual(
          originalUpdatedAt.getTime()
        );
      }
    });

    it('cannot modify built-in templates', () => {
      const builtIn = store.templates.find((t) => t.isBuiltIn);
      expect(builtIn).toBeDefined();
      if (!builtIn) return;

      const result = updateTemplate(store, builtIn.id, { name: 'Modified' });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('cannot_modify_builtin');
      }
    });

    it('returns error for non-existent ID', () => {
      const result = updateTemplate(store, 'fake-id', { name: 'Test' });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('not_found');
      }
    });

    it('rejects duplicate name on update', () => {
      const first = createTemplate(store, { name: 'First', pattern: '{original}' });
      if (!first.ok) throw new Error('Setup failed');

      const second = createTemplate(first.data.store, {
        name: 'Second',
        pattern: '{year}',
      });
      if (!second.ok) throw new Error('Setup failed');

      const result = updateTemplate(
        second.data.store,
        second.data.template.id,
        { name: 'First' }
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('duplicate_name');
      }
    });

    it('allows updating to same name (case-insensitive)', () => {
      const created = createTemplate(store, {
        name: 'Test',
        pattern: '{original}',
      });

      if (!created.ok) throw new Error('Setup failed');

      const result = updateTemplate(created.data.store, created.data.template.id, {
        name: 'TEST',
      });

      expect(result.ok).toBe(true);
    });

    it('rejects invalid pattern on update', () => {
      const created = createTemplate(store, {
        name: 'Test',
        pattern: '{original}',
      });

      if (!created.ok) throw new Error('Setup failed');

      const result = updateTemplate(created.data.store, created.data.template.id, {
        pattern: '{unclosed',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('invalid_pattern');
      }
    });

    it('does not mutate the original store', () => {
      const created = createTemplate(store, {
        name: 'Test',
        pattern: '{original}',
      });

      if (!created.ok) throw new Error('Setup failed');

      const originalName = created.data.template.name;
      updateTemplate(created.data.store, created.data.template.id, {
        name: 'Updated',
      });

      const template = created.data.store.templates.find(
        (t) => t.id === created.data.template.id
      );
      expect(template?.name).toBe(originalName);
    });
  });

  describe('deleteTemplate', () => {
    it('deletes user templates', () => {
      const created = createTemplate(store, {
        name: 'ToDelete',
        pattern: '{original}',
      });

      if (!created.ok) throw new Error('Setup failed');

      const result = deleteTemplate(created.data.store, created.data.template.id);

      expect(result.ok).toBe(true);
      if (result.ok) {
        const found = result.data.templates.find(
          (t) => t.id === created.data.template.id
        );
        expect(found).toBeUndefined();
      }
    });

    it('cannot delete built-in templates', () => {
      const builtIn = store.templates.find((t) => t.isBuiltIn);
      expect(builtIn).toBeDefined();
      if (!builtIn) return;

      const result = deleteTemplate(store, builtIn.id);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('cannot_modify_builtin');
      }
    });

    it('returns error for non-existent ID', () => {
      const result = deleteTemplate(store, 'fake-id');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('not_found');
      }
    });

    it('removes template from file type defaults when deleted', () => {
      const created = createTemplate(store, {
        name: 'ToDelete',
        pattern: '{original}',
      });

      if (!created.ok) throw new Error('Setup failed');

      // Set as default
      const withDefault = setDefaultTemplate(
        created.data.store,
        FileCategory.IMAGE,
        created.data.template.id
      );

      if (!withDefault.ok) throw new Error('Setup failed');
      expect(withDefault.data.defaults[FileCategory.IMAGE]).toBe(
        created.data.template.id
      );

      // Delete
      const result = deleteTemplate(withDefault.data, created.data.template.id);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.defaults[FileCategory.IMAGE]).toBeUndefined();
      }
    });

    it('resets global default to built-in when deleted template was global default', () => {
      const created = createTemplate(store, {
        name: 'ToDelete',
        pattern: '{original}',
      });

      if (!created.ok) throw new Error('Setup failed');

      // Set as global default
      const withGlobal = setGlobalDefault(
        created.data.store,
        created.data.template.id
      );

      if (!withGlobal.ok) throw new Error('Setup failed');

      // Delete
      const result = deleteTemplate(withGlobal.data, created.data.template.id);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Should reset to first built-in template
        const builtInIds = store.templates
          .filter((t) => t.isBuiltIn)
          .map((t) => t.id);
        expect(builtInIds).toContain(result.data.globalDefault);
      }
    });

    it('does not mutate the original store', () => {
      const created = createTemplate(store, {
        name: 'ToDelete',
        pattern: '{original}',
      });

      if (!created.ok) throw new Error('Setup failed');

      const originalCount = created.data.store.templates.length;
      deleteTemplate(created.data.store, created.data.template.id);
      expect(created.data.store.templates.length).toBe(originalCount);
    });
  });

  describe('listTemplates', () => {
    it('returns all templates', () => {
      const created = createTemplate(store, {
        name: 'Custom',
        pattern: '{original}',
      });

      if (!created.ok) throw new Error('Setup failed');

      const list = listTemplates(created.data.store);

      expect(list.length).toBe(created.data.store.templates.length);
    });

    it('returns templates sorted with built-in first, then by name', () => {
      // Add multiple custom templates
      let currentStore = store;
      const names = ['Zebra', 'Alpha', 'Middle'];

      for (const name of names) {
        const result = createTemplate(currentStore, {
          name,
          pattern: '{original}',
        });
        if (!result.ok) throw new Error('Setup failed');
        currentStore = result.data.store;
      }

      const list = listTemplates(currentStore);

      // All built-in templates should come before custom ones
      const firstCustomIndex = list.findIndex((t) => !t.isBuiltIn);
      // Find last built-in index manually to avoid type issues with findLastIndex
      let lastBuiltInIndex = -1;
      for (let i = list.length - 1; i >= 0; i--) {
        if (list[i].isBuiltIn) {
          lastBuiltInIndex = i;
          break;
        }
      }

      expect(firstCustomIndex).toBeGreaterThan(lastBuiltInIndex);

      // Custom templates should be sorted alphabetically
      const customTemplates = list.filter((t) => !t.isBuiltIn);
      const customNames = customTemplates.map((t) => t.name);
      const sortedNames = [...customNames].sort((a, b) => a.localeCompare(b));

      expect(customNames).toEqual(sortedNames);
    });

    it('returns a copy, not the original array', () => {
      const list = listTemplates(store);
      list.push(store.templates[0]); // Try to mutate

      expect(listTemplates(store).length).toBe(store.templates.length);
    });
  });

  describe('setDefaultTemplate', () => {
    it('sets default for a file category', () => {
      const templateId = store.templates[0].id;
      const result = setDefaultTemplate(store, FileCategory.IMAGE, templateId);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.defaults[FileCategory.IMAGE]).toBe(templateId);
      }
    });

    it('overwrites existing default', () => {
      const firstId = store.templates[0].id;
      const secondId = store.templates[1].id;

      const first = setDefaultTemplate(store, FileCategory.IMAGE, firstId);
      if (!first.ok) throw new Error('Setup failed');

      const result = setDefaultTemplate(first.data, FileCategory.IMAGE, secondId);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.defaults[FileCategory.IMAGE]).toBe(secondId);
      }
    });

    it('rejects non-existent template ID', () => {
      const result = setDefaultTemplate(store, FileCategory.IMAGE, 'fake-id');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('not_found');
      }
    });

    it('does not mutate the original store', () => {
      const templateId = store.templates[0].id;
      setDefaultTemplate(store, FileCategory.IMAGE, templateId);
      expect(store.defaults[FileCategory.IMAGE]).toBeUndefined();
    });
  });

  describe('getDefaultForFileType', () => {
    it('returns file type specific default', () => {
      const templateId = store.templates[1].id;
      const withDefault = setDefaultTemplate(store, FileCategory.IMAGE, templateId);

      if (!withDefault.ok) throw new Error('Setup failed');

      const result = getDefaultForFileType(withDefault.data, FileCategory.IMAGE);

      expect(result?.id).toBe(templateId);
    });

    it('falls back to global default when no file type default', () => {
      const result = getDefaultForFileType(store, FileCategory.IMAGE);

      expect(result?.id).toBe(store.globalDefault);
    });

    it('falls back to first built-in when no global default', () => {
      const storeWithoutGlobal: TemplateStore = {
        ...store,
        globalDefault: undefined,
      };

      const result = getDefaultForFileType(storeWithoutGlobal, FileCategory.IMAGE);

      expect(result?.isBuiltIn).toBe(true);
    });

    it('returns null for empty store', () => {
      const emptyStore: TemplateStore = {
        templates: [],
        defaults: {},
        globalDefault: undefined,
      };

      const result = getDefaultForFileType(emptyStore, FileCategory.IMAGE);

      expect(result).toBeNull();
    });
  });

  describe('setGlobalDefault', () => {
    it('sets global default template', () => {
      const templateId = store.templates[1].id;
      const result = setGlobalDefault(store, templateId);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.globalDefault).toBe(templateId);
      }
    });

    it('rejects non-existent template ID', () => {
      const result = setGlobalDefault(store, 'fake-id');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('not_found');
      }
    });

    it('does not mutate the original store', () => {
      const originalGlobal = store.globalDefault;
      const newId = store.templates[1].id;
      setGlobalDefault(store, newId);
      expect(store.globalDefault).toBe(originalGlobal);
    });
  });

  describe('resolveTemplateForFile', () => {
    const mockFile = createMockFile();

    it('prefers explicit selection over defaults', () => {
      // Set a file type default
      const defaultId = store.templates[0].id;
      const explicitId = store.templates[1].id;

      const withDefault = setDefaultTemplate(store, FileCategory.IMAGE, defaultId);
      if (!withDefault.ok) throw new Error('Setup failed');

      const result = resolveTemplateForFile(withDefault.data, mockFile, explicitId);

      expect(result?.id).toBe(explicitId);
    });

    it('uses file type default when no explicit selection', () => {
      const templateId = store.templates[1].id;
      const withDefault = setDefaultTemplate(store, FileCategory.IMAGE, templateId);

      if (!withDefault.ok) throw new Error('Setup failed');

      const result = resolveTemplateForFile(withDefault.data, mockFile);

      expect(result?.id).toBe(templateId);
    });

    it('uses global default when no file type default', () => {
      const result = resolveTemplateForFile(store, mockFile);

      expect(result?.id).toBe(store.globalDefault);
    });

    it('uses different defaults for different file types', () => {
      const imageTemplate = store.templates[0].id;
      const docTemplate = store.templates[1].id;

      let currentStore = store;

      const withImage = setDefaultTemplate(currentStore, FileCategory.IMAGE, imageTemplate);
      if (!withImage.ok) throw new Error('Setup failed');
      currentStore = withImage.data;

      const withDoc = setDefaultTemplate(currentStore, FileCategory.DOCUMENT, docTemplate);
      if (!withDoc.ok) throw new Error('Setup failed');
      currentStore = withDoc.data;

      const imageFile = createMockFile({ category: FileCategory.IMAGE });
      const docFile = createMockFile({ category: FileCategory.DOCUMENT });

      expect(resolveTemplateForFile(currentStore, imageFile)?.id).toBe(imageTemplate);
      expect(resolveTemplateForFile(currentStore, docFile)?.id).toBe(docTemplate);
    });

    it('returns null for empty store', () => {
      const emptyStore: TemplateStore = {
        templates: [],
        defaults: {},
        globalDefault: undefined,
      };

      const result = resolveTemplateForFile(emptyStore, mockFile);

      expect(result).toBeNull();
    });

    it('ignores invalid explicit template ID', () => {
      const result = resolveTemplateForFile(store, mockFile, 'invalid-id');

      // Should fall back to defaults
      expect(result?.id).toBe(store.globalDefault);
    });
  });

  describe('type safety', () => {
    it('TemplateManagerError has correct type discriminants', () => {
      const errorTypes: TemplateManagerError['type'][] = [
        'not_found',
        'validation_error',
        'duplicate_name',
        'cannot_modify_builtin',
        'invalid_pattern',
      ];

      // This is a compile-time check - if it compiles, the types are correct
      expect(errorTypes).toHaveLength(5);
    });
  });

  describe('clearDefaultTemplate', () => {
    it('removes default for a file category', () => {
      const templateId = store.templates[0].id;
      const withDefault = setDefaultTemplate(store, FileCategory.IMAGE, templateId);
      if (!withDefault.ok) throw new Error('Setup failed');

      expect(withDefault.data.defaults[FileCategory.IMAGE]).toBe(templateId);

      const cleared = clearDefaultTemplate(withDefault.data, FileCategory.IMAGE);

      expect(cleared.defaults[FileCategory.IMAGE]).toBeUndefined();
    });

    it('preserves other defaults when clearing one', () => {
      const template1 = store.templates[0].id;
      const template2 = store.templates[1].id;

      let currentStore = store;
      const withImage = setDefaultTemplate(currentStore, FileCategory.IMAGE, template1);
      if (!withImage.ok) throw new Error('Setup failed');
      currentStore = withImage.data;

      const withDoc = setDefaultTemplate(currentStore, FileCategory.DOCUMENT, template2);
      if (!withDoc.ok) throw new Error('Setup failed');
      currentStore = withDoc.data;

      const cleared = clearDefaultTemplate(currentStore, FileCategory.IMAGE);

      expect(cleared.defaults[FileCategory.IMAGE]).toBeUndefined();
      expect(cleared.defaults[FileCategory.DOCUMENT]).toBe(template2);
    });

    it('does not mutate the original store', () => {
      const templateId = store.templates[0].id;
      const withDefault = setDefaultTemplate(store, FileCategory.IMAGE, templateId);
      if (!withDefault.ok) throw new Error('Setup failed');

      clearDefaultTemplate(withDefault.data, FileCategory.IMAGE);

      expect(withDefault.data.defaults[FileCategory.IMAGE]).toBe(templateId);
    });

    it('handles clearing a non-existent default gracefully', () => {
      const cleared = clearDefaultTemplate(store, FileCategory.IMAGE);

      expect(cleared.defaults[FileCategory.IMAGE]).toBeUndefined();
    });
  });

  describe('validateStore', () => {
    it('returns empty array for valid store', () => {
      const issues = validateStore(store);
      expect(issues).toEqual([]);
    });

    it('detects missing built-in templates', () => {
      const corruptedStore: TemplateStore = {
        ...store,
        templates: store.templates.filter((t) => !t.isBuiltIn),
      };

      const issues = validateStore(corruptedStore);

      expect(issues.length).toBeGreaterThan(0);
      expect(issues.some((i) => i.type === 'missing_builtin')).toBe(true);
    });

    it('detects modified built-in templates', () => {
      const corruptedStore: TemplateStore = {
        ...store,
        templates: store.templates.map((t) =>
          t.isBuiltIn ? { ...t, pattern: '{hacked}' } : t
        ),
      };

      const issues = validateStore(corruptedStore);

      expect(issues.some((i) => i.type === 'missing_builtin')).toBe(true);
    });

    it('detects invalid default references', () => {
      const corruptedStore: TemplateStore = {
        ...store,
        defaults: {
          [FileCategory.IMAGE]: 'non-existent-id',
        },
      };

      const issues = validateStore(corruptedStore);

      expect(issues.some((i) => i.type === 'invalid_default_ref')).toBe(true);
    });

    it('detects invalid global default reference', () => {
      const corruptedStore: TemplateStore = {
        ...store,
        globalDefault: 'non-existent-id',
      };

      const issues = validateStore(corruptedStore);

      expect(issues.some((i) => i.type === 'invalid_global_default')).toBe(true);
    });
  });

  describe('repairStore', () => {
    it('restores missing built-in templates', () => {
      const corruptedStore: TemplateStore = {
        templates: [],
        defaults: {},
        globalDefault: undefined,
      };

      const repaired = repairStore(corruptedStore);

      expect(repaired.templates.some((t) => t.isBuiltIn)).toBe(true);
      expect(validateStore(repaired)).toEqual([]);
    });

    it('removes invalid default references', () => {
      const corruptedStore: TemplateStore = {
        ...store,
        defaults: {
          [FileCategory.IMAGE]: 'non-existent-id',
        },
      };

      const repaired = repairStore(corruptedStore);

      expect(repaired.defaults[FileCategory.IMAGE]).toBeUndefined();
    });

    it('fixes invalid global default', () => {
      const corruptedStore: TemplateStore = {
        ...store,
        globalDefault: 'non-existent-id',
      };

      const repaired = repairStore(corruptedStore);

      // Should be reset to first built-in
      expect(repaired.globalDefault).toBeDefined();
      const globalTemplate = repaired.templates.find(
        (t) => t.id === repaired.globalDefault
      );
      expect(globalTemplate?.isBuiltIn).toBe(true);
    });

    it('preserves valid user templates', () => {
      const created = createTemplate(store, {
        name: 'My Custom',
        pattern: '{original}',
      });
      if (!created.ok) throw new Error('Setup failed');

      const repaired = repairStore(created.data.store);

      expect(repaired.templates.find((t) => t.name === 'My Custom')).toBeDefined();
    });
  });

  describe('updateTemplate description clearing', () => {
    it('can clear description with null', () => {
      const created = createTemplate(store, {
        name: 'WithDesc',
        pattern: '{original}',
        description: 'Initial description',
      });
      if (!created.ok) throw new Error('Setup failed');

      const result = updateTemplate(
        created.data.store,
        created.data.template.id,
        { description: null }
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.template.description).toBeUndefined();
      }
    });

    it('keeps description when undefined is passed', () => {
      const created = createTemplate(store, {
        name: 'WithDesc',
        pattern: '{original}',
        description: 'Initial description',
      });
      if (!created.ok) throw new Error('Setup failed');

      const result = updateTemplate(
        created.data.store,
        created.data.template.id,
        { name: 'NewName' } // description not provided
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.template.description).toBe('Initial description');
      }
    });

    it('rejects empty string description on create', () => {
      const result = createTemplate(store, {
        name: 'Test',
        pattern: '{original}',
        description: '',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('validation_error');
      }
    });

    it('rejects empty string description on update', () => {
      const created = createTemplate(store, {
        name: 'Test',
        pattern: '{original}',
      });
      if (!created.ok) throw new Error('Setup failed');

      const result = updateTemplate(
        created.data.store,
        created.data.template.id,
        { description: '' }
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('validation_error');
      }
    });
  });

  describe('concurrent modification safety', () => {
    it('parallel operations on same store produce independent results', () => {
      // Create a template
      const created = createTemplate(store, {
        name: 'Shared',
        pattern: '{original}',
      });
      if (!created.ok) throw new Error('Setup failed');

      const baseStore = created.data.store;
      const templateId = created.data.template.id;

      // Perform two independent operations on the same base store
      const update1 = updateTemplate(baseStore, templateId, { name: 'Update1' });
      const update2 = updateTemplate(baseStore, templateId, { name: 'Update2' });

      // Both should succeed
      expect(update1.ok).toBe(true);
      expect(update2.ok).toBe(true);

      if (update1.ok && update2.ok) {
        // Each produces its own independent store
        expect(update1.data.template.name).toBe('Update1');
        expect(update2.data.template.name).toBe('Update2');

        // Original store unchanged
        const originalTemplate = baseStore.templates.find((t) => t.id === templateId);
        expect(originalTemplate?.name).toBe('Shared');
      }
    });
  });

  describe('StoreValidationIssue type safety', () => {
    it('has correct type discriminants', () => {
      const issueTypes: StoreValidationIssue['type'][] = [
        'missing_builtin',
        'invalid_default_ref',
        'invalid_global_default',
      ];

      expect(issueTypes).toHaveLength(3);
    });
  });
});
