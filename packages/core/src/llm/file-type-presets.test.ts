/**
 * @fileoverview Tests for file type presets - Story 10.4
 */

import { describe, it, expect } from 'vitest';
import {
  FILE_TYPE_PRESETS,
  FILE_TYPE_PRESET_NAMES,
  type FileTypePreset,
  getPresetExtensions,
  getAllPresets,
  isValidPreset,
  getDefaultPreset,
  formatExtensionList,
} from './file-type-presets.js';

describe('FILE_TYPE_PRESETS', () => {
  it('should have images preset with common image extensions', () => {
    const images = FILE_TYPE_PRESETS.images;
    expect(images).toContain('jpg');
    expect(images).toContain('jpeg');
    expect(images).toContain('png');
    expect(images).toContain('gif');
    expect(images).toContain('webp');
    expect(images).toContain('heic');
  });

  it('should have documents preset with office and PDF extensions', () => {
    const docs = FILE_TYPE_PRESETS.documents;
    expect(docs).toContain('pdf');
    expect(docs).toContain('docx');
    expect(docs).toContain('doc');
    expect(docs).toContain('xlsx');
    expect(docs).toContain('pptx');
    expect(docs).toContain('odt');
  });

  it('should have text preset with text file extensions', () => {
    const text = FILE_TYPE_PRESETS.text;
    expect(text).toContain('txt');
    expect(text).toContain('md');
    expect(text).toContain('csv');
    expect(text).toContain('json');
    expect(text).toContain('yaml');
  });

  it('should have all preset combining images, documents, and text', () => {
    const all = FILE_TYPE_PRESETS.all;
    // Should include items from all three
    expect(all).toContain('jpg'); // from images
    expect(all).toContain('pdf'); // from documents
    expect(all).toContain('txt'); // from text
  });

  it('should have custom preset as empty array', () => {
    expect(FILE_TYPE_PRESETS.custom).toEqual([]);
  });

  it('should have no duplicate extensions in all preset', () => {
    const all = FILE_TYPE_PRESETS.all;
    const unique = new Set(all);
    expect(unique.size).toBe(all.length);
  });
});

describe('FILE_TYPE_PRESET_NAMES', () => {
  it('should contain all preset names', () => {
    expect(FILE_TYPE_PRESET_NAMES).toContain('images');
    expect(FILE_TYPE_PRESET_NAMES).toContain('documents');
    expect(FILE_TYPE_PRESET_NAMES).toContain('text');
    expect(FILE_TYPE_PRESET_NAMES).toContain('all');
    expect(FILE_TYPE_PRESET_NAMES).toContain('custom');
  });

  it('should have 5 presets', () => {
    expect(FILE_TYPE_PRESET_NAMES).toHaveLength(5);
  });
});

describe('getPresetExtensions', () => {
  it('should return copy of images extensions', () => {
    const exts = getPresetExtensions('images');
    expect(exts).toEqual(expect.arrayContaining(['jpg', 'png']));
    // Should be a copy, not the original
    exts.push('test');
    expect(FILE_TYPE_PRESETS.images).not.toContain('test');
  });

  it('should return copy of documents extensions', () => {
    const exts = getPresetExtensions('documents');
    expect(exts).toContain('pdf');
    expect(exts).toContain('docx');
  });

  it('should return copy of text extensions', () => {
    const exts = getPresetExtensions('text');
    expect(exts).toContain('txt');
    expect(exts).toContain('md');
  });

  it('should return all extensions for all preset', () => {
    const exts = getPresetExtensions('all');
    expect(exts.length).toBeGreaterThan(20);
  });

  it('should return empty array for custom preset', () => {
    const exts = getPresetExtensions('custom');
    expect(exts).toEqual([]);
  });
});

describe('getAllPresets', () => {
  it('should return info for all presets', () => {
    const presets = getAllPresets();
    expect(presets).toHaveLength(5);
  });

  it('should include name, count, and description for each preset', () => {
    const presets = getAllPresets();
    for (const preset of presets) {
      expect(preset).toHaveProperty('name');
      expect(preset).toHaveProperty('count');
      expect(preset).toHaveProperty('description');
      expect(typeof preset.name).toBe('string');
      expect(typeof preset.count).toBe('number');
      expect(typeof preset.description).toBe('string');
    }
  });

  it('should have correct count for images preset', () => {
    const presets = getAllPresets();
    const images = presets.find((p) => p.name === 'images');
    expect(images).toBeDefined();
    expect(images!.count).toBe(FILE_TYPE_PRESETS.images.length);
  });

  it('should have count of 0 for custom preset', () => {
    const presets = getAllPresets();
    const custom = presets.find((p) => p.name === 'custom');
    expect(custom).toBeDefined();
    expect(custom!.count).toBe(0);
  });

  it('should have description for each preset', () => {
    const presets = getAllPresets();
    const images = presets.find((p) => p.name === 'images');
    expect(images!.description).toContain('Image');
  });
});

describe('isValidPreset', () => {
  it('should return true for valid preset names', () => {
    expect(isValidPreset('images')).toBe(true);
    expect(isValidPreset('documents')).toBe(true);
    expect(isValidPreset('text')).toBe(true);
    expect(isValidPreset('all')).toBe(true);
    expect(isValidPreset('custom')).toBe(true);
  });

  it('should return false for invalid preset names', () => {
    expect(isValidPreset('invalid')).toBe(false);
    expect(isValidPreset('')).toBe(false);
    expect(isValidPreset('IMAGES')).toBe(false); // case sensitive
    expect(isValidPreset('image')).toBe(false); // typo
  });
});

describe('getDefaultPreset', () => {
  it('should return documents as the default', () => {
    expect(getDefaultPreset()).toBe('documents');
  });

  it('should return a valid preset name', () => {
    expect(isValidPreset(getDefaultPreset())).toBe(true);
  });
});

describe('formatExtensionList', () => {
  it('should format empty array as (none)', () => {
    expect(formatExtensionList([])).toBe('(none)');
  });

  it('should format single extension', () => {
    expect(formatExtensionList(['pdf'])).toBe('pdf');
  });

  it('should format multiple extensions with commas', () => {
    expect(formatExtensionList(['pdf', 'docx'])).toBe('pdf, docx');
  });

  it('should show all extensions when under maxShow', () => {
    expect(formatExtensionList(['pdf', 'docx', 'xlsx'], 5)).toBe('pdf, docx, xlsx');
  });

  it('should truncate with "and X more" when over maxShow', () => {
    const result = formatExtensionList(['a', 'b', 'c', 'd', 'e', 'f'], 3);
    expect(result).toBe('a, b, c, and 3 more');
  });

  it('should use default maxShow of 5', () => {
    const exts = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    const result = formatExtensionList(exts);
    expect(result).toBe('a, b, c, d, e, and 2 more');
  });

  it('should handle exactly maxShow extensions', () => {
    const result = formatExtensionList(['a', 'b', 'c'], 3);
    expect(result).toBe('a, b, c');
  });
});
