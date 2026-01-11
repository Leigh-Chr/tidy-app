/**
 * @fileoverview Tests for Content Extractor - Story 10.2
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  extractTextContent,
  extractFromString,
  isTextExtractable,
  SUPPORTED_TEXT_EXTENSIONS,
} from './content-extractor.js';

describe('Content Extractor', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `content-extractor-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('extractTextContent', () => {
    it('extracts content from text file', async () => {
      const filePath = join(testDir, 'test.txt');
      await writeFile(filePath, 'Hello, World!');

      const result = await extractTextContent(filePath);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.content).toBe('Hello, World!');
        expect(result.data.truncated).toBe(false);
        expect(result.data.originalLength).toBe(13);
        expect(result.data.extractedLength).toBe(13);
      }
    });

    it('handles empty file', async () => {
      const filePath = join(testDir, 'empty.txt');
      await writeFile(filePath, '');

      const result = await extractTextContent(filePath);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.content).toBe('');
        expect(result.data.truncated).toBe(false);
        expect(result.data.extractedLength).toBe(0);
      }
    });

    it('truncates content exceeding maxChars', async () => {
      const filePath = join(testDir, 'large.txt');
      const content = 'A'.repeat(5000);
      await writeFile(filePath, content);

      const result = await extractTextContent(filePath, { maxChars: 100 });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.truncated).toBe(true);
        expect(result.data.originalLength).toBe(5000);
        expect(result.data.extractedLength).toBeLessThanOrEqual(100);
        expect(result.data.content).toContain('[... content truncated ...]');
      }
    });

    it('breaks at sentence boundary when truncating', async () => {
      const filePath = join(testDir, 'sentences.txt');
      const content = 'First sentence. Second sentence. Third sentence is very long and continues.';
      await writeFile(filePath, content);

      const result = await extractTextContent(filePath, { maxChars: 50 });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.truncated).toBe(true);
        // Should break after "First sentence." or "Second sentence."
        expect(result.data.content).toMatch(/sentence\./);
      }
    });

    it('returns error for non-existent file', async () => {
      const result = await extractTextContent('/non/existent/path.txt');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('CONTENT_EXTRACTION_FAILED');
        expect(result.error.message).toContain('not found');
      }
    });

    it('returns error for directory path', async () => {
      const result = await extractTextContent(testDir);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('CONTENT_EXTRACTION_FAILED');
        expect(result.error.message).toContain('directory');
      }
    });

    it('handles UTF-8 content correctly', async () => {
      const filePath = join(testDir, 'unicode.txt');
      const content = 'Hello 世界! Émojis: 🎉🚀';
      await writeFile(filePath, content);

      const result = await extractTextContent(filePath);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.content).toBe(content);
      }
    });

    it('respects custom maxChars option', async () => {
      const filePath = join(testDir, 'custom.txt');
      await writeFile(filePath, 'A'.repeat(200));

      const result = await extractTextContent(filePath, { maxChars: 150 });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.extractedLength).toBeLessThanOrEqual(150);
      }
    });
  });

  describe('extractFromString', () => {
    it('returns content unchanged when under limit', () => {
      const result = extractFromString('Hello, World!');

      expect(result.content).toBe('Hello, World!');
      expect(result.truncated).toBe(false);
      expect(result.originalLength).toBe(13);
    });

    it('truncates content over limit', () => {
      const content = 'A'.repeat(5000);
      const result = extractFromString(content, { maxChars: 100 });

      expect(result.truncated).toBe(true);
      expect(result.originalLength).toBe(5000);
      expect(result.extractedLength).toBeLessThanOrEqual(100);
    });

    it('handles empty string', () => {
      const result = extractFromString('');

      expect(result.content).toBe('');
      expect(result.truncated).toBe(false);
      expect(result.extractedLength).toBe(0);
    });

    it('uses default maxChars when not specified', () => {
      // Default is 4000, so 3000 chars should not truncate
      const content = 'A'.repeat(3000);
      const result = extractFromString(content);

      expect(result.truncated).toBe(false);
    });
  });

  describe('isTextExtractable', () => {
    it('returns true for .txt extension', () => {
      expect(isTextExtractable('.txt')).toBe(true);
      expect(isTextExtractable('txt')).toBe(true);
    });

    it('returns true for markdown files', () => {
      expect(isTextExtractable('.md')).toBe(true);
      expect(isTextExtractable('.markdown')).toBe(true);
    });

    it('returns true for code files', () => {
      expect(isTextExtractable('.js')).toBe(true);
      expect(isTextExtractable('.ts')).toBe(true);
      expect(isTextExtractable('.py')).toBe(true);
      expect(isTextExtractable('.java')).toBe(true);
    });

    it('returns true for config files', () => {
      expect(isTextExtractable('.json')).toBe(true);
      expect(isTextExtractable('.yaml')).toBe(true);
      expect(isTextExtractable('.yml')).toBe(true);
    });

    it('returns false for binary extensions', () => {
      expect(isTextExtractable('.pdf')).toBe(false);
      expect(isTextExtractable('.docx')).toBe(false);
      expect(isTextExtractable('.jpg')).toBe(false);
      expect(isTextExtractable('.exe')).toBe(false);
    });

    it('is case insensitive', () => {
      expect(isTextExtractable('.TXT')).toBe(true);
      expect(isTextExtractable('.MD')).toBe(true);
      expect(isTextExtractable('.Js')).toBe(true);
    });
  });

  describe('SUPPORTED_TEXT_EXTENSIONS', () => {
    it('includes common text extensions', () => {
      expect(SUPPORTED_TEXT_EXTENSIONS.has('.txt')).toBe(true);
      expect(SUPPORTED_TEXT_EXTENSIONS.has('.md')).toBe(true);
      expect(SUPPORTED_TEXT_EXTENSIONS.has('.json')).toBe(true);
    });

    it('includes programming language extensions', () => {
      expect(SUPPORTED_TEXT_EXTENSIONS.has('.ts')).toBe(true);
      expect(SUPPORTED_TEXT_EXTENSIONS.has('.js')).toBe(true);
      expect(SUPPORTED_TEXT_EXTENSIONS.has('.py')).toBe(true);
    });

    it('has reasonable size', () => {
      expect(SUPPORTED_TEXT_EXTENSIONS.size).toBeGreaterThan(20);
      expect(SUPPORTED_TEXT_EXTENSIONS.size).toBeLessThan(100);
    });
  });
});
