/**
 * @fileoverview Tests for rename proposal types - Story 8.2 additions
 */

import { describe, expect, it } from 'vitest';
import {
  renameProposalSchema,
  RenameStatus,
  type RenameProposal,
} from './rename-proposal.js';

describe('RenameProposal schema', () => {
  const validProposal: RenameProposal = {
    id: '123',
    originalPath: '/photos/IMG_001.jpg',
    originalName: 'IMG_001.jpg',
    proposedName: '2026-01-10_photo.jpg',
    proposedPath: '/photos/2026-01-10_photo.jpg',
    status: RenameStatus.READY,
    issues: [],
  };

  describe('existing fields', () => {
    it('validates a minimal proposal', () => {
      const result = renameProposalSchema.parse(validProposal);
      expect(result.id).toBe('123');
      expect(result.originalPath).toBe('/photos/IMG_001.jpg');
      expect(result.proposedPath).toBe('/photos/2026-01-10_photo.jpg');
    });

    it('validates proposal with metadata', () => {
      const proposal = {
        ...validProposal,
        metadata: { year: '2026', month: '01' },
      };
      const result = renameProposalSchema.parse(proposal);
      expect(result.metadata).toEqual({ year: '2026', month: '01' });
    });

    it('validates proposal with applied rule', () => {
      const proposal = {
        ...validProposal,
        appliedRule: {
          ruleId: 'rule-123',
          ruleName: 'Photo Rule',
          ruleType: 'metadata' as const,
        },
        templateSource: 'rule' as const,
      };
      const result = renameProposalSchema.parse(proposal);
      expect(result.appliedRule?.ruleId).toBe('rule-123');
      expect(result.templateSource).toBe('rule');
    });
  });

  // =============================================================================
  // Story 8.2: isMoveOperation tests
  // =============================================================================

  describe('isMoveOperation field (Story 8.2)', () => {
    it('validates proposal with isMoveOperation: true', () => {
      const proposal = {
        ...validProposal,
        proposedPath: '/organized/2026/01/2026-01-10_photo.jpg',
        isMoveOperation: true,
      };
      const result = renameProposalSchema.parse(proposal);
      expect(result.isMoveOperation).toBe(true);
    });

    it('validates proposal with isMoveOperation: false', () => {
      const proposal = {
        ...validProposal,
        isMoveOperation: false,
      };
      const result = renameProposalSchema.parse(proposal);
      expect(result.isMoveOperation).toBe(false);
    });

    it('validates proposal without isMoveOperation (optional)', () => {
      const result = renameProposalSchema.parse(validProposal);
      expect(result.isMoveOperation).toBeUndefined();
    });

    it('rejects proposal with invalid isMoveOperation type', () => {
      const proposal = {
        ...validProposal,
        isMoveOperation: 'yes', // should be boolean
      };
      expect(() => renameProposalSchema.parse(proposal)).toThrow();
    });
  });

  // =============================================================================
  // Story 8.2: folderStructureId tests
  // =============================================================================

  describe('folderStructureId field (Story 8.2)', () => {
    it('validates proposal with folderStructureId', () => {
      const proposal = {
        ...validProposal,
        folderStructureId: '550e8400-e29b-41d4-a716-446655440001',
        isMoveOperation: true,
      };
      const result = renameProposalSchema.parse(proposal);
      expect(result.folderStructureId).toBe('550e8400-e29b-41d4-a716-446655440001');
    });

    it('validates proposal without folderStructureId (optional)', () => {
      const result = renameProposalSchema.parse(validProposal);
      expect(result.folderStructureId).toBeUndefined();
    });

    it('rejects proposal with invalid folderStructureId (not UUID)', () => {
      const proposal = {
        ...validProposal,
        folderStructureId: 'not-a-uuid',
      };
      expect(() => renameProposalSchema.parse(proposal)).toThrow();
    });

    it('validates proposal with both isMoveOperation and folderStructureId', () => {
      const proposal = {
        ...validProposal,
        proposedPath: '/organized/2026/01/2026-01-10_photo.jpg',
        isMoveOperation: true,
        folderStructureId: '550e8400-e29b-41d4-a716-446655440001',
      };
      const result = renameProposalSchema.parse(proposal);
      expect(result.isMoveOperation).toBe(true);
      expect(result.folderStructureId).toBe('550e8400-e29b-41d4-a716-446655440001');
    });
  });
});

// =============================================================================
// Story 8.3: PreviewSummary move statistics tests
// =============================================================================

import { previewSummarySchema, type PreviewSummary } from './rename-proposal.js';

describe('PreviewSummary schema (Story 8.3)', () => {
  const validSummary: PreviewSummary = {
    total: 10,
    ready: 7,
    conflicts: 1,
    missingData: 1,
    noChange: 1,
    invalidName: 0,
  };

  describe('existing fields', () => {
    it('validates a summary with required fields', () => {
      const result = previewSummarySchema.parse(validSummary);
      expect(result.total).toBe(10);
      expect(result.ready).toBe(7);
      expect(result.conflicts).toBe(1);
      expect(result.missingData).toBe(1);
      expect(result.noChange).toBe(1);
      expect(result.invalidName).toBe(0);
    });
  });

  describe('moveOperations field (Story 8.3)', () => {
    it('validates summary with moveOperations count', () => {
      const summary = {
        ...validSummary,
        moveOperations: 5,
      };
      const result = previewSummarySchema.parse(summary);
      expect(result.moveOperations).toBe(5);
    });

    it('validates summary with moveOperations: 0', () => {
      const summary = {
        ...validSummary,
        moveOperations: 0,
      };
      const result = previewSummarySchema.parse(summary);
      expect(result.moveOperations).toBe(0);
    });

    it('validates summary without moveOperations (optional, backwards compatible)', () => {
      const result = previewSummarySchema.parse(validSummary);
      expect(result.moveOperations).toBeUndefined();
    });

    it('rejects summary with invalid moveOperations type', () => {
      const summary = {
        ...validSummary,
        moveOperations: 'five',
      };
      expect(() => previewSummarySchema.parse(summary)).toThrow();
    });
  });

  describe('renameOnly field (Story 8.3)', () => {
    it('validates summary with renameOnly count', () => {
      const summary = {
        ...validSummary,
        renameOnly: 3,
      };
      const result = previewSummarySchema.parse(summary);
      expect(result.renameOnly).toBe(3);
    });

    it('validates summary with renameOnly: 0', () => {
      const summary = {
        ...validSummary,
        renameOnly: 0,
      };
      const result = previewSummarySchema.parse(summary);
      expect(result.renameOnly).toBe(0);
    });

    it('validates summary without renameOnly (optional, backwards compatible)', () => {
      const result = previewSummarySchema.parse(validSummary);
      expect(result.renameOnly).toBeUndefined();
    });

    it('rejects summary with invalid renameOnly type', () => {
      const summary = {
        ...validSummary,
        renameOnly: 'three',
      };
      expect(() => previewSummarySchema.parse(summary)).toThrow();
    });
  });

  describe('combined move statistics (Story 8.3)', () => {
    it('validates summary with both moveOperations and renameOnly', () => {
      const summary = {
        ...validSummary,
        moveOperations: 4,
        renameOnly: 3,
      };
      const result = previewSummarySchema.parse(summary);
      expect(result.moveOperations).toBe(4);
      expect(result.renameOnly).toBe(3);
    });

    it('moveOperations + renameOnly should equal ready for consistent preview', () => {
      // This is a business rule validation, not schema validation
      // Schema allows any values, but consumers should ensure consistency
      const summary = {
        ...validSummary,
        ready: 7,
        moveOperations: 4,
        renameOnly: 3,
      };
      const result = previewSummarySchema.parse(summary);
      expect(result.moveOperations! + result.renameOnly!).toBe(result.ready);
    });
  });

  // =============================================================================
  // Story 10.3: llmSuggested field tests
  // =============================================================================

  describe('llmSuggested field (Story 10.3)', () => {
    it('validates summary with llmSuggested count', () => {
      const summary = {
        ...validSummary,
        llmSuggested: 3,
      };
      const result = previewSummarySchema.parse(summary);
      expect(result.llmSuggested).toBe(3);
    });

    it('validates summary with llmSuggested: 0', () => {
      const summary = {
        ...validSummary,
        llmSuggested: 0,
      };
      const result = previewSummarySchema.parse(summary);
      expect(result.llmSuggested).toBe(0);
    });

    it('validates summary without llmSuggested (optional, backwards compatible)', () => {
      const result = previewSummarySchema.parse(validSummary);
      expect(result.llmSuggested).toBeUndefined();
    });
  });
});

// =============================================================================
// Story 10.3: LLM Suggestion and templateSource tests
// =============================================================================

import {
  llmSuggestionSchema,
  templateSourceSchema,
  type LlmSuggestion,
} from './rename-proposal.js';

describe('LlmSuggestion schema (Story 10.3)', () => {
  const validSuggestion: LlmSuggestion = {
    suggestedName: 'quarterly-sales-report',
    confidence: 0.85,
    reasoning: 'Document discusses Q3 sales figures and projections',
    keywords: ['sales', 'quarterly', 'report'],
  };

  it('validates a complete suggestion', () => {
    const result = llmSuggestionSchema.parse(validSuggestion);
    expect(result.suggestedName).toBe('quarterly-sales-report');
    expect(result.confidence).toBe(0.85);
    expect(result.reasoning).toContain('Q3 sales');
    expect(result.keywords).toEqual(['sales', 'quarterly', 'report']);
  });

  it('validates suggestion without optional keywords', () => {
    const suggestion = {
      suggestedName: 'meeting-notes',
      confidence: 0.7,
      reasoning: 'Appears to be notes from a meeting',
    };
    const result = llmSuggestionSchema.parse(suggestion);
    expect(result.suggestedName).toBe('meeting-notes');
    expect(result.keywords).toBeUndefined();
  });

  it('validates confidence boundaries (0)', () => {
    const suggestion = { ...validSuggestion, confidence: 0 };
    const result = llmSuggestionSchema.parse(suggestion);
    expect(result.confidence).toBe(0);
  });

  it('validates confidence boundaries (1)', () => {
    const suggestion = { ...validSuggestion, confidence: 1 };
    const result = llmSuggestionSchema.parse(suggestion);
    expect(result.confidence).toBe(1);
  });

  it('rejects confidence below 0', () => {
    const suggestion = { ...validSuggestion, confidence: -0.1 };
    expect(() => llmSuggestionSchema.parse(suggestion)).toThrow();
  });

  it('rejects confidence above 1', () => {
    const suggestion = { ...validSuggestion, confidence: 1.1 };
    expect(() => llmSuggestionSchema.parse(suggestion)).toThrow();
  });

  it('rejects empty suggestedName', () => {
    const suggestion = { ...validSuggestion, suggestedName: '' };
    // Empty string should be rejected with min(1) validation
    const result = llmSuggestionSchema.safeParse(suggestion);
    expect(result.success).toBe(false); // Empty string NOT allowed
  });
});

describe('templateSourceSchema (Story 10.3)', () => {
  it('validates all template sources including llm', () => {
    expect(templateSourceSchema.parse('rule')).toBe('rule');
    expect(templateSourceSchema.parse('default')).toBe('default');
    expect(templateSourceSchema.parse('fallback')).toBe('fallback');
    expect(templateSourceSchema.parse('llm')).toBe('llm');
  });

  it('rejects invalid template source', () => {
    expect(() => templateSourceSchema.parse('ai')).toThrow();
    expect(() => templateSourceSchema.parse('custom')).toThrow();
  });
});

describe('RenameProposal with LLM fields (Story 10.3)', () => {
  const baseProposal: RenameProposal = {
    id: '456',
    originalPath: '/docs/document.txt',
    originalName: 'document.txt',
    proposedName: 'quarterly-report.txt',
    proposedPath: '/docs/quarterly-report.txt',
    status: RenameStatus.READY,
    issues: [],
  };

  it('validates proposal with llmSuggestion', () => {
    const proposal = {
      ...baseProposal,
      llmSuggestion: {
        suggestedName: 'quarterly-report',
        confidence: 0.85,
        reasoning: 'Content analysis',
        keywords: ['report'],
      },
    };
    const result = renameProposalSchema.parse(proposal);
    expect(result.llmSuggestion?.suggestedName).toBe('quarterly-report');
    expect(result.llmSuggestion?.confidence).toBe(0.85);
  });

  it('validates proposal with useLlmSuggestion: true', () => {
    const proposal = {
      ...baseProposal,
      llmSuggestion: {
        suggestedName: 'quarterly-report',
        confidence: 0.9,
        reasoning: 'High confidence suggestion',
      },
      useLlmSuggestion: true,
      templateSource: 'llm' as const,
    };
    const result = renameProposalSchema.parse(proposal);
    expect(result.useLlmSuggestion).toBe(true);
    expect(result.templateSource).toBe('llm');
  });

  it('validates proposal with useLlmSuggestion: false', () => {
    const proposal = {
      ...baseProposal,
      llmSuggestion: {
        suggestedName: 'quarterly-report',
        confidence: 0.4,
        reasoning: 'Low confidence, template preferred',
      },
      useLlmSuggestion: false,
      templateSource: 'default' as const,
    };
    const result = renameProposalSchema.parse(proposal);
    expect(result.useLlmSuggestion).toBe(false);
    expect(result.templateSource).toBe('default');
  });

  it('validates proposal without LLM fields (backwards compatible)', () => {
    const result = renameProposalSchema.parse(baseProposal);
    expect(result.llmSuggestion).toBeUndefined();
    expect(result.useLlmSuggestion).toBeUndefined();
  });
});
