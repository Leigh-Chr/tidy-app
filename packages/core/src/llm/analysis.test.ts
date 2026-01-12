/**
 * @fileoverview Tests for LLM Analysis Types & Schemas - Story 10.2
 */

import { describe, it, expect } from 'vitest';
import {
  extractedContentSchema,
  createExtractedContent,
  analysisRequestSchema,
  createAnalysisRequest,
  analysisSuggestionSchema,
  parseAnalysisSuggestion,
  analysisResultSchema,
  createAnalysisResult,
  batchAnalysisOptionsSchema,
  DEFAULT_MAX_CONTENT_CHARS,
  DEFAULT_ANALYSIS_TEMPERATURE,
  DEFAULT_MAX_RESPONSE_TOKENS,
} from './analysis.js';

describe('ExtractedContent', () => {
  describe('extractedContentSchema', () => {
    it('validates valid extracted content', () => {
      const content = {
        content: 'Hello world',
        truncated: false,
        originalLength: 11,
        extractedLength: 11,
      };
      const result = extractedContentSchema.safeParse(content);
      expect(result.success).toBe(true);
    });

    it('validates truncated content', () => {
      const content = {
        content: 'Truncated...',
        truncated: true,
        originalLength: 10000,
        extractedLength: 12,
      };
      const result = extractedContentSchema.safeParse(content);
      expect(result.success).toBe(true);
    });

    it('rejects negative lengths', () => {
      const content = {
        content: 'test',
        truncated: false,
        originalLength: -1,
        extractedLength: 4,
      };
      const result = extractedContentSchema.safeParse(content);
      expect(result.success).toBe(false);
    });

    it('rejects missing content', () => {
      const content = {
        truncated: false,
        originalLength: 10,
        extractedLength: 10,
      };
      const result = extractedContentSchema.safeParse(content);
      expect(result.success).toBe(false);
    });
  });

  describe('createExtractedContent', () => {
    it('creates extracted content with correct values', () => {
      const result = createExtractedContent('Hello', 100, true);
      expect(result.content).toBe('Hello');
      expect(result.truncated).toBe(true);
      expect(result.originalLength).toBe(100);
      expect(result.extractedLength).toBe(5);
    });

    it('handles empty content', () => {
      const result = createExtractedContent('', 0, false);
      expect(result.content).toBe('');
      expect(result.extractedLength).toBe(0);
    });
  });
});

describe('AnalysisRequest', () => {
  describe('analysisRequestSchema', () => {
    it('validates minimal request', () => {
      const request = {
        filePath: '/path/to/file.txt',
        content: 'File content here',
      };
      const result = analysisRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.maxTokens).toBe(256); // default
        expect(result.data.temperature).toBe(0.3); // default
      }
    });

    it('validates full request with options', () => {
      const request = {
        filePath: '/path/to/file.txt',
        content: 'File content here',
        fileType: 'txt',
        maxTokens: 512,
        temperature: 0.5,
      };
      const result = analysisRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.fileType).toBe('txt');
        expect(result.data.maxTokens).toBe(512);
        expect(result.data.temperature).toBe(0.5);
      }
    });

    it('rejects negative maxTokens', () => {
      const request = {
        filePath: '/path/to/file.txt',
        content: 'content',
        maxTokens: -1,
      };
      const result = analysisRequestSchema.safeParse(request);
      expect(result.success).toBe(false);
    });

    it('rejects temperature > 2', () => {
      const request = {
        filePath: '/path/to/file.txt',
        content: 'content',
        temperature: 2.5,
      };
      const result = analysisRequestSchema.safeParse(request);
      expect(result.success).toBe(false);
    });

    it('rejects temperature < 0', () => {
      const request = {
        filePath: '/path/to/file.txt',
        content: 'content',
        temperature: -0.1,
      };
      const result = analysisRequestSchema.safeParse(request);
      expect(result.success).toBe(false);
    });

    it('rejects missing filePath', () => {
      const request = {
        content: 'content',
      };
      const result = analysisRequestSchema.safeParse(request);
      expect(result.success).toBe(false);
    });
  });

  describe('createAnalysisRequest', () => {
    it('creates request with defaults', () => {
      const result = createAnalysisRequest('/file.txt', 'content');
      expect(result.filePath).toBe('/file.txt');
      expect(result.content).toBe('content');
      expect(result.maxTokens).toBe(256);
      expect(result.temperature).toBe(0.3);
    });

    it('creates request with custom options', () => {
      const result = createAnalysisRequest('/file.txt', 'content', {
        fileType: 'md',
        maxTokens: 100,
      });
      expect(result.fileType).toBe('md');
      expect(result.maxTokens).toBe(100);
    });
  });
});

describe('AnalysisSuggestion', () => {
  describe('analysisSuggestionSchema', () => {
    it('validates valid suggestion', () => {
      const suggestion = {
        suggestedName: 'quarterly-report',
        confidence: 0.85,
        reasoning: 'Document contains Q3 data',
      };
      const result = analysisSuggestionSchema.safeParse(suggestion);
      expect(result.success).toBe(true);
    });

    it('validates suggestion with keywords', () => {
      const suggestion = {
        suggestedName: 'meeting-notes',
        confidence: 0.9,
        reasoning: 'Contains meeting agenda',
        keywords: ['meeting', 'agenda', 'notes'],
      };
      const result = analysisSuggestionSchema.safeParse(suggestion);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.keywords).toEqual(['meeting', 'agenda', 'notes']);
      }
    });

    it('defaults keywords to empty array', () => {
      const suggestion = {
        suggestedName: 'test',
        confidence: 0.5,
        reasoning: 'test',
      };
      const result = analysisSuggestionSchema.safeParse(suggestion);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.keywords).toEqual([]);
      }
    });

    it('rejects empty suggestedName', () => {
      const suggestion = {
        suggestedName: '',
        confidence: 0.5,
        reasoning: 'test',
      };
      const result = analysisSuggestionSchema.safeParse(suggestion);
      expect(result.success).toBe(false);
    });

    it('rejects confidence > 1', () => {
      const suggestion = {
        suggestedName: 'test',
        confidence: 1.5,
        reasoning: 'test',
      };
      const result = analysisSuggestionSchema.safeParse(suggestion);
      expect(result.success).toBe(false);
    });

    it('rejects confidence < 0', () => {
      const suggestion = {
        suggestedName: 'test',
        confidence: -0.1,
        reasoning: 'test',
      };
      const result = analysisSuggestionSchema.safeParse(suggestion);
      expect(result.success).toBe(false);
    });
  });

  describe('parseAnalysisSuggestion', () => {
    it('parses direct JSON', () => {
      const json = JSON.stringify({
        suggestedName: 'test-file',
        confidence: 0.8,
        reasoning: 'Test reason',
      });
      const result = parseAnalysisSuggestion(json);
      expect(result).not.toBeNull();
      expect(result?.suggestedName).toBe('test-file');
    });

    it('parses JSON from markdown code block', () => {
      const response = `Here's my suggestion:
\`\`\`json
{
  "suggestedName": "report-2024",
  "confidence": 0.9,
  "reasoning": "Contains 2024 data"
}
\`\`\``;
      const result = parseAnalysisSuggestion(response);
      expect(result).not.toBeNull();
      expect(result?.suggestedName).toBe('report-2024');
    });

    it('parses JSON from code block without language', () => {
      const response = `\`\`\`
{"suggestedName": "notes", "confidence": 0.7, "reasoning": "Short notes"}
\`\`\``;
      const result = parseAnalysisSuggestion(response);
      expect(result).not.toBeNull();
      expect(result?.suggestedName).toBe('notes');
    });

    it('extracts JSON from mixed content', () => {
      const response = `I analyzed the file and here's my suggestion:
      {"suggestedName": "invoice-jan", "confidence": 0.85, "reasoning": "Invoice document"}
      Hope this helps!`;
      const result = parseAnalysisSuggestion(response);
      expect(result).not.toBeNull();
      expect(result?.suggestedName).toBe('invoice-jan');
    });

    it('returns null for invalid JSON', () => {
      const result = parseAnalysisSuggestion('Not valid JSON at all');
      expect(result).toBeNull();
    });

    it('returns null for incomplete JSON', () => {
      const json = JSON.stringify({
        suggestedName: 'test',
        // missing confidence and reasoning
      });
      const result = parseAnalysisSuggestion(json);
      expect(result).toBeNull();
    });

    it('handles keywords in response', () => {
      const json = JSON.stringify({
        suggestedName: 'project-plan',
        confidence: 0.95,
        reasoning: 'Project planning document',
        keywords: ['project', 'plan', 'timeline'],
      });
      const result = parseAnalysisSuggestion(json);
      expect(result).not.toBeNull();
      expect(result?.keywords).toEqual(['project', 'plan', 'timeline']);
    });
  });
});

describe('AnalysisResult', () => {
  describe('analysisResultSchema', () => {
    it('validates complete result', () => {
      const result = {
        filePath: '/path/to/file.txt',
        suggestion: {
          suggestedName: 'document',
          confidence: 0.8,
          reasoning: 'Generic document',
        },
        modelUsed: 'mistral',
        processingTimeMs: 1500,
        analyzedAt: '2024-01-15T10:30:00.000Z',
        contentTruncated: false,
      };
      const parsed = analysisResultSchema.safeParse(result);
      expect(parsed.success).toBe(true);
    });

    it('rejects invalid datetime format', () => {
      const result = {
        filePath: '/path/to/file.txt',
        suggestion: {
          suggestedName: 'document',
          confidence: 0.8,
          reasoning: 'Generic document',
        },
        modelUsed: 'mistral',
        processingTimeMs: 1500,
        analyzedAt: 'not-a-date',
        contentTruncated: false,
      };
      const parsed = analysisResultSchema.safeParse(result);
      expect(parsed.success).toBe(false);
    });

    it('rejects negative processing time', () => {
      const result = {
        filePath: '/path/to/file.txt',
        suggestion: {
          suggestedName: 'document',
          confidence: 0.8,
          reasoning: 'test',
        },
        modelUsed: 'mistral',
        processingTimeMs: -100,
        analyzedAt: new Date().toISOString(),
        contentTruncated: false,
      };
      const parsed = analysisResultSchema.safeParse(result);
      expect(parsed.success).toBe(false);
    });
  });

  describe('createAnalysisResult', () => {
    it('creates result with current timestamp', () => {
      const before = new Date().toISOString();
      const suggestion = {
        suggestedName: 'test',
        confidence: 0.5,
        reasoning: 'test',
        keywords: [],
        keepOriginal: false,
      };
      const result = createAnalysisResult('/file.txt', suggestion, 'llama3', 500, false);
      const after = new Date().toISOString();

      expect(result.filePath).toBe('/file.txt');
      expect(result.suggestion).toEqual(suggestion);
      expect(result.modelUsed).toBe('llama3');
      expect(result.processingTimeMs).toBe(500);
      expect(result.contentTruncated).toBe(false);
      expect(result.analyzedAt >= before).toBe(true);
      expect(result.analyzedAt <= after).toBe(true);
    });

    // Story 10.6: analysisSource tests
    it('defaults to llm analysis source', () => {
      const suggestion = {
        suggestedName: 'test',
        confidence: 0.5,
        reasoning: 'test',
        keywords: [],
        keepOriginal: false,
      };
      const result = createAnalysisResult('/file.txt', suggestion, 'mistral', 100, false);

      expect(result.analysisSource).toBe('llm');
    });

    it('accepts vision analysis source', () => {
      const suggestion = {
        suggestedName: 'sunset-photo',
        confidence: 0.9,
        reasoning: 'Image of sunset',
        keywords: ['sunset'],
        keepOriginal: false,
      };
      const result = createAnalysisResult('/photo.jpg', suggestion, 'llava', 200, false, 'vision');

      expect(result.analysisSource).toBe('vision');
    });

    it('accepts metadata-only analysis source', () => {
      const suggestion = {
        suggestedName: 'document',
        confidence: 0.7,
        reasoning: 'From EXIF data',
        keywords: [],
        keepOriginal: false,
      };
      const result = createAnalysisResult('/doc.pdf', suggestion, 'n/a', 10, false, 'metadata-only');

      expect(result.analysisSource).toBe('metadata-only');
    });

    it('accepts offline-fallback analysis source', () => {
      const suggestion = {
        suggestedName: 'unknown',
        confidence: 0.1,
        reasoning: 'LLM unavailable',
        keywords: [],
        keepOriginal: false,
      };
      const result = createAnalysisResult('/file.txt', suggestion, 'n/a', 0, false, 'offline-fallback');

      expect(result.analysisSource).toBe('offline-fallback');
    });
  });
});

describe('BatchAnalysisOptions', () => {
  describe('batchAnalysisOptionsSchema', () => {
    it('applies defaults for empty object', () => {
      const result = batchAnalysisOptionsSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.concurrency).toBe(1);
        expect(result.data.continueOnError).toBe(true);
      }
    });

    it('accepts custom concurrency', () => {
      const result = batchAnalysisOptionsSchema.safeParse({ concurrency: 3 });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.concurrency).toBe(3);
      }
    });

    it('rejects zero concurrency', () => {
      const result = batchAnalysisOptionsSchema.safeParse({ concurrency: 0 });
      expect(result.success).toBe(false);
    });

    it('rejects negative concurrency', () => {
      const result = batchAnalysisOptionsSchema.safeParse({ concurrency: -1 });
      expect(result.success).toBe(false);
    });
  });
});

describe('Default Constants', () => {
  it('has reasonable default max content chars', () => {
    expect(DEFAULT_MAX_CONTENT_CHARS).toBe(4000);
  });

  it('has low default temperature for consistency', () => {
    expect(DEFAULT_ANALYSIS_TEMPERATURE).toBe(0.3);
    expect(DEFAULT_ANALYSIS_TEMPERATURE).toBeLessThan(1);
  });

  it('has reasonable default max tokens', () => {
    expect(DEFAULT_MAX_RESPONSE_TOKENS).toBe(256);
    expect(DEFAULT_MAX_RESPONSE_TOKENS).toBeGreaterThan(100);
  });
});
