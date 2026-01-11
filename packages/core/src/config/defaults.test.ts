/**
 * @fileoverview Tests for default configuration - Story 5.3
 *
 * AC covered:
 * - AC1: Default templates available
 * - AC3: Default preferences are sensible
 */
import { describe, it, expect } from 'vitest';
import {
  DEFAULT_CONFIG,
  DEFAULT_TEMPLATES,
  appConfigSchema,
} from './schema.js';

describe('default configuration', () => {
  // AC1: Default templates available
  describe('default templates', () => {
    it('default config has templates', () => {
      expect(DEFAULT_CONFIG.templates.length).toBeGreaterThan(0);
    });

    it('has at least one default template marked with isDefault', () => {
      const defaultTemplate = DEFAULT_TEMPLATES.find((t) => t.isDefault);
      expect(defaultTemplate).toBeDefined();
    });

    it('default template has {date}-{original} pattern', () => {
      const defaultTemplate = DEFAULT_TEMPLATES.find((t) => t.isDefault);
      expect(defaultTemplate?.pattern).toBe('{date}-{original}');
    });

    it('has Date Prefix template', () => {
      const template = DEFAULT_TEMPLATES.find((t) => t.name === 'Date Prefix');
      expect(template).toBeDefined();
      expect(template?.pattern).toBe('{date}-{original}');
    });

    it('has Year/Month Folders template', () => {
      const template = DEFAULT_TEMPLATES.find(
        (t) => t.name === 'Year/Month Folders'
      );
      expect(template).toBeDefined();
      expect(template?.pattern).toBe('{year}/{month}/{original}');
    });

    it('has Camera + Date template', () => {
      const template = DEFAULT_TEMPLATES.find(
        (t) => t.name === 'Camera + Date'
      );
      expect(template).toBeDefined();
      expect(template?.pattern).toBe('{camera}-{date}-{original}');
    });

    it('has Document Date template', () => {
      const template = DEFAULT_TEMPLATES.find(
        (t) => t.name === 'Document Date'
      );
      expect(template).toBeDefined();
      expect(template?.pattern).toBe('{date}-{original}');
      expect(template?.fileTypes).toContain('pdf');
    });
  });

  describe('template validation', () => {
    it('all templates have required fields', () => {
      for (const template of DEFAULT_TEMPLATES) {
        expect(template.id).toBeDefined();
        expect(template.name).toBeDefined();
        expect(template.name.length).toBeGreaterThan(0);
        expect(template.pattern).toBeDefined();
        expect(template.pattern.length).toBeGreaterThan(0);
        expect(template.createdAt).toBeDefined();
        expect(template.updatedAt).toBeDefined();
      }
    });

    it('all templates have valid UUIDs', () => {
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      for (const template of DEFAULT_TEMPLATES) {
        expect(template.id).toMatch(uuidRegex);
      }
    });

    it('all templates have valid ISO datetime strings', () => {
      for (const template of DEFAULT_TEMPLATES) {
        expect(() => new Date(template.createdAt)).not.toThrow();
        expect(() => new Date(template.updatedAt)).not.toThrow();
      }
    });

    it('templates have descriptive names (min 3 chars)', () => {
      for (const template of DEFAULT_TEMPLATES) {
        expect(template.name.length).toBeGreaterThanOrEqual(3);
      }
    });
  });

  // AC3: Default preferences are sensible
  describe('default preferences', () => {
    it('colorOutput is true', () => {
      expect(DEFAULT_CONFIG.preferences.colorOutput).toBe(true);
    });

    it('confirmBeforeApply is true', () => {
      expect(DEFAULT_CONFIG.preferences.confirmBeforeApply).toBe(true);
    });

    it('defaultOutputFormat is table', () => {
      expect(DEFAULT_CONFIG.preferences.defaultOutputFormat).toBe('table');
    });

    it('recursiveScan is false', () => {
      expect(DEFAULT_CONFIG.preferences.recursiveScan).toBe(false);
    });
  });

  describe('schema validation', () => {
    it('default config passes schema validation', () => {
      const result = appConfigSchema.safeParse(DEFAULT_CONFIG);
      expect(result.success).toBe(true);
    });

    it('default templates pass individual schema validation', async () => {
      const { templateSchema } = await import('./schema.js');
      for (const template of DEFAULT_TEMPLATES) {
        const result = templateSchema.safeParse(template);
        expect(result.success).toBe(true);
      }
    });
  });
});

describe('zero-config operation', () => {
  it('loadConfig returns defaults with templates when no file exists', async () => {
    const { loadConfig, DEFAULT_CONFIG } = await import('./index.js');

    // Use non-existent path with strict: false
    const result = await loadConfig({
      configPath: '/nonexistent/path/config.json',
      strict: false,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.version).toBe(DEFAULT_CONFIG.version);
      expect(result.data.templates.length).toBeGreaterThan(0);
      expect(result.data.preferences.colorOutput).toBe(true);
    }
  });
});
