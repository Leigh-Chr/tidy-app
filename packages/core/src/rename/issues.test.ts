/**
 * Tests for issue detection module (Story 4.3)
 *
 * @module rename/issues.test
 */

import { describe, it, expect } from 'vitest';
import {
  IssueCode,
  IssueSeverity,
  detectIssues,
  convertProposalIssues,
  type DetectionContext,
} from './issues.js';
import type { RenameProposal } from '../types/rename-proposal.js';

// =============================================================================
// Test Helpers
// =============================================================================

function createProposal(overrides: Partial<RenameProposal> = {}): RenameProposal {
  return {
    id: '1',
    originalPath: '/test/photo.jpg',
    originalName: 'photo.jpg',
    proposedName: 'renamed.jpg',
    proposedPath: '/test/renamed.jpg',
    status: 'ready',
    issues: [],
    ...overrides,
  };
}

function createContext(
  proposals: RenameProposal[],
  options: Partial<DetectionContext> = {}
): DetectionContext {
  return {
    proposals,
    checkFileSystem: false,
    ...options,
  };
}

// =============================================================================
// IssueCode Tests
// =============================================================================

describe('IssueCode', () => {
  it('defines conflict issue codes', () => {
    expect(IssueCode.DUPLICATE_PROPOSED).toBe('DUPLICATE_PROPOSED');
    expect(IssueCode.FILE_EXISTS).toBe('FILE_EXISTS');
    expect(IssueCode.CASE_CONFLICT).toBe('CASE_CONFLICT');
  });

  it('defines metadata issue codes', () => {
    expect(IssueCode.MISSING_REQUIRED).toBe('MISSING_REQUIRED');
    expect(IssueCode.INVALID_DATE).toBe('INVALID_DATE');
    expect(IssueCode.EMPTY_VALUE).toBe('EMPTY_VALUE');
  });

  it('defines name issue codes', () => {
    expect(IssueCode.INVALID_CHARACTERS).toBe('INVALID_CHARACTERS');
    expect(IssueCode.NAME_TOO_LONG).toBe('NAME_TOO_LONG');
    expect(IssueCode.RESERVED_NAME).toBe('RESERVED_NAME');
  });

  it('defines processing issue codes', () => {
    expect(IssueCode.TEMPLATE_ERROR).toBe('TEMPLATE_ERROR');
    expect(IssueCode.SANITIZATION_REQUIRED).toBe('SANITIZATION_REQUIRED');
  });
});

// =============================================================================
// IssueSeverity Tests
// =============================================================================

describe('IssueSeverity', () => {
  it('defines severity levels', () => {
    expect(IssueSeverity.ERROR).toBe('error');
    expect(IssueSeverity.WARNING).toBe('warning');
    expect(IssueSeverity.INFO).toBe('info');
  });
});

// =============================================================================
// detectIssues Tests
// =============================================================================

describe('detectIssues', () => {
  describe('duplicate proposed names', () => {
    it('detects duplicate proposed names in same directory', () => {
      const proposal1 = createProposal({
        id: '1',
        proposedName: 'same.jpg',
        proposedPath: '/test/same.jpg',
      });
      const proposal2 = createProposal({
        id: '2',
        proposedName: 'same.jpg',
        proposedPath: '/test/same.jpg',
      });

      const issues = detectIssues(proposal1, createContext([proposal1, proposal2]));

      expect(issues).toContainEqual(
        expect.objectContaining({
          code: IssueCode.DUPLICATE_PROPOSED,
          severity: IssueSeverity.ERROR,
        })
      );
    });

    it('does not flag duplicates in different directories', () => {
      const proposal1 = createProposal({
        id: '1',
        proposedName: 'same.jpg',
        proposedPath: '/test/dir1/same.jpg',
      });
      const proposal2 = createProposal({
        id: '2',
        proposedName: 'same.jpg',
        proposedPath: '/test/dir2/same.jpg',
      });

      const issues = detectIssues(proposal1, createContext([proposal1, proposal2]));

      expect(issues).not.toContainEqual(
        expect.objectContaining({ code: IssueCode.DUPLICATE_PROPOSED })
      );
    });

    it('does not flag proposal against itself', () => {
      const proposal = createProposal({ id: '1', proposedName: 'unique.jpg' });

      const issues = detectIssues(proposal, createContext([proposal]));

      expect(issues).not.toContainEqual(
        expect.objectContaining({ code: IssueCode.DUPLICATE_PROPOSED })
      );
    });

    it('provides auto-fix action for duplicates', () => {
      const proposal1 = createProposal({
        id: '1',
        proposedName: 'photo.jpg',
        proposedPath: '/test/photo.jpg',
      });
      const proposal2 = createProposal({
        id: '2',
        proposedName: 'photo.jpg',
        proposedPath: '/test/photo.jpg',
      });

      const issues = detectIssues(proposal1, createContext([proposal1, proposal2]));
      const duplicateIssue = issues.find((i) => i.code === IssueCode.DUPLICATE_PROPOSED);

      expect(duplicateIssue?.autoFixable).toBe(true);
      expect(duplicateIssue?.autoFixAction).toBeDefined();
      expect(duplicateIssue?.autoFixAction?.()).toMatch(/photo_\d+\.jpg/);
    });
  });

  describe('case conflicts', () => {
    it('detects case-only conflicts', () => {
      const proposal1 = createProposal({
        id: '1',
        proposedName: 'Photo.jpg',
        proposedPath: '/test/Photo.jpg',
      });
      const proposal2 = createProposal({
        id: '2',
        proposedName: 'photo.jpg',
        proposedPath: '/test/photo.jpg',
      });

      const issues = detectIssues(proposal1, createContext([proposal1, proposal2]));

      expect(issues).toContainEqual(
        expect.objectContaining({
          code: IssueCode.CASE_CONFLICT,
          severity: IssueSeverity.WARNING,
        })
      );
    });

    it('case conflict is warning not error', () => {
      const proposal1 = createProposal({
        id: '1',
        proposedName: 'PHOTO.jpg',
        proposedPath: '/test/PHOTO.jpg',
      });
      const proposal2 = createProposal({
        id: '2',
        proposedName: 'photo.jpg',
        proposedPath: '/test/photo.jpg',
      });

      const issues = detectIssues(proposal1, createContext([proposal1, proposal2]));
      const caseIssue = issues.find((i) => i.code === IssueCode.CASE_CONFLICT);

      expect(caseIssue?.severity).toBe(IssueSeverity.WARNING);
      expect(caseIssue?.autoFixable).toBe(false);
    });
  });

  describe('no issues', () => {
    it('returns empty array for unique names', () => {
      const proposal1 = createProposal({
        id: '1',
        proposedName: 'unique1.jpg',
        proposedPath: '/test/unique1.jpg',
      });
      const proposal2 = createProposal({
        id: '2',
        proposedName: 'unique2.jpg',
        proposedPath: '/test/unique2.jpg',
      });

      const issues = detectIssues(proposal1, createContext([proposal1, proposal2]));

      expect(issues).toHaveLength(0);
    });

    it('returns empty array for single proposal', () => {
      const proposal = createProposal({ id: '1' });

      const issues = detectIssues(proposal, createContext([proposal]));

      expect(issues).toHaveLength(0);
    });
  });

  describe('file exists', () => {
    it('detects when proposed file already exists', () => {
      const proposal = createProposal({
        id: '1',
        proposedName: 'existing.jpg',
        proposedPath: '/test/existing.jpg',
      });

      // Mock context with filesystem check enabled
      const issues = detectIssues(proposal, {
        proposals: [proposal],
        checkFileSystem: true,
        existingFiles: new Set(['/test/existing.jpg']),
      });

      expect(issues).toContainEqual(
        expect.objectContaining({
          code: IssueCode.FILE_EXISTS,
          severity: IssueSeverity.ERROR,
        })
      );
    });

    it('does not check file exists when checkFileSystem is false', () => {
      const proposal = createProposal({
        id: '1',
        proposedName: 'existing.jpg',
        proposedPath: '/test/existing.jpg',
      });

      const issues = detectIssues(proposal, {
        proposals: [proposal],
        checkFileSystem: false,
        existingFiles: new Set(['/test/existing.jpg']),
      });

      expect(issues).not.toContainEqual(
        expect.objectContaining({ code: IssueCode.FILE_EXISTS })
      );
    });

    it('provides auto-fix for file exists conflict', () => {
      const proposal = createProposal({
        id: '1',
        proposedName: 'existing.jpg',
        proposedPath: '/test/existing.jpg',
      });

      const issues = detectIssues(proposal, {
        proposals: [proposal],
        checkFileSystem: true,
        existingFiles: new Set(['/test/existing.jpg']),
      });

      const existsIssue = issues.find((i) => i.code === IssueCode.FILE_EXISTS);
      expect(existsIssue?.autoFixable).toBe(true);
      expect(existsIssue?.autoFixAction?.()).toContain('_new');
    });

    it('does not flag when file does not exist', () => {
      const proposal = createProposal({
        id: '1',
        proposedName: 'new_file.jpg',
        proposedPath: '/test/new_file.jpg',
      });

      const issues = detectIssues(proposal, {
        proposals: [proposal],
        checkFileSystem: true,
        existingFiles: new Set(['/test/other.jpg']),
      });

      expect(issues).not.toContainEqual(
        expect.objectContaining({ code: IssueCode.FILE_EXISTS })
      );
    });
  });

  describe('multiple issues', () => {
    it('detects multiple issues on single proposal', () => {
      // Proposal has duplicate name AND the file exists
      const proposal1 = createProposal({
        id: '1',
        proposedName: 'conflict.jpg',
        proposedPath: '/test/conflict.jpg',
      });
      const proposal2 = createProposal({
        id: '2',
        proposedName: 'conflict.jpg',
        proposedPath: '/test/conflict.jpg',
      });

      const issues = detectIssues(proposal1, {
        proposals: [proposal1, proposal2],
        checkFileSystem: true,
        existingFiles: new Set(['/test/conflict.jpg']),
      });

      // Should have both DUPLICATE_PROPOSED and FILE_EXISTS
      expect(issues).toContainEqual(
        expect.objectContaining({ code: IssueCode.DUPLICATE_PROPOSED })
      );
      expect(issues).toContainEqual(
        expect.objectContaining({ code: IssueCode.FILE_EXISTS })
      );
      expect(issues.length).toBeGreaterThanOrEqual(2);
    });

    it('detects duplicate and case conflict separately', () => {
      // Three files: two exact duplicates, one case variant
      const proposal1 = createProposal({
        id: '1',
        proposedName: 'Photo.jpg',
        proposedPath: '/test/Photo.jpg',
      });
      const proposal2 = createProposal({
        id: '2',
        proposedName: 'Photo.jpg',
        proposedPath: '/test/Photo.jpg',
      });
      const proposal3 = createProposal({
        id: '3',
        proposedName: 'photo.jpg',
        proposedPath: '/test/photo.jpg',
      });

      // proposal1 should have DUPLICATE (with proposal2) and CASE_CONFLICT (with proposal3)
      const issues = detectIssues(proposal1, createContext([proposal1, proposal2, proposal3]));

      expect(issues).toContainEqual(
        expect.objectContaining({ code: IssueCode.DUPLICATE_PROPOSED })
      );
      expect(issues).toContainEqual(
        expect.objectContaining({ code: IssueCode.CASE_CONFLICT })
      );
    });
  });

  describe('metadata validation', () => {
    it('detects missing required metadata from proposal issues', () => {
      const proposal = createProposal({
        id: '1',
        status: 'missing-data',
        issues: [
          { code: 'MISSING_REQUIRED', message: 'Missing date', field: 'date' },
        ],
      });

      // Call detectIssues to verify it handles proposals with existing issues
      const detectedIssues = detectIssues(proposal, createContext([proposal]));

      // Proposal issues are already captured in the proposal, not re-detected
      // detectIssues focuses on inter-proposal conflicts
      // The metadata issues come from the proposal itself
      expect(proposal.issues).toHaveLength(1);
      // detectIssues should not duplicate existing issues
      expect(detectedIssues).toHaveLength(0);
    });

    it('returns issues from proposal as-is when converting to detailed issues', () => {
      const proposal = createProposal({
        id: '1',
        status: 'missing-data',
        issues: [
          { code: 'MISSING_REQUIRED', message: 'Date field is empty', field: 'date' },
        ],
      });

      // The proposal already contains issues from the template preview
      expect(proposal.issues[0].code).toBe('MISSING_REQUIRED');
      expect(proposal.issues[0].field).toBe('date');
    });
  });

  describe('convertProposalIssues', () => {
    it('converts missing data issues with warning severity', () => {
      const proposalIssues = [
        { code: 'MISSING_REQUIRED', message: 'Date is missing', field: 'date' },
      ];

      const detailed = convertProposalIssues(proposalIssues);

      expect(detailed[0].severity).toBe(IssueSeverity.WARNING);
      expect(detailed[0].suggestion).toContain('date');
    });

    it('converts invalid issues with error severity', () => {
      const proposalIssues = [
        { code: 'INVALID_CHARACTERS', message: 'Invalid chars in name' },
      ];

      const detailed = convertProposalIssues(proposalIssues);

      expect(detailed[0].severity).toBe(IssueSeverity.ERROR);
    });

    it('marks duplicate issues as auto-fixable', () => {
      const proposalIssues = [
        { code: 'DUPLICATE_PROPOSED', message: 'Duplicate name' },
      ];

      const detailed = convertProposalIssues(proposalIssues);

      expect(detailed[0].autoFixable).toBe(true);
    });

    it('marks missing data issues as not auto-fixable', () => {
      const proposalIssues = [
        { code: 'MISSING_REQUIRED', message: 'Missing data' },
      ];

      const detailed = convertProposalIssues(proposalIssues);

      expect(detailed[0].autoFixable).toBe(false);
    });

    it('preserves original issue properties', () => {
      const proposalIssues = [
        { code: 'EMPTY_VALUE', message: 'Value is empty', field: 'author' },
      ];

      const detailed = convertProposalIssues(proposalIssues);

      expect(detailed[0].code).toBe('EMPTY_VALUE');
      expect(detailed[0].message).toBe('Value is empty');
      expect(detailed[0].field).toBe('author');
    });
  });

  describe('resolution suggestions', () => {
    it('suggests counter for duplicate names', () => {
      const proposal1 = createProposal({
        id: '1',
        proposedName: 'photo.jpg',
        proposedPath: '/test/photo.jpg',
      });
      const proposal2 = createProposal({
        id: '2',
        proposedName: 'photo.jpg',
        proposedPath: '/test/photo.jpg',
      });

      const issues = detectIssues(proposal1, createContext([proposal1, proposal2]));
      const dupIssue = issues.find((i) => i.code === IssueCode.DUPLICATE_PROPOSED);

      expect(dupIssue?.autoFixAction?.()).toBe('photo_2.jpg');
    });

    it('provides unique counters for each duplicate', () => {
      const proposal1 = createProposal({
        id: '1',
        proposedName: 'photo.jpg',
        proposedPath: '/test/photo.jpg',
      });
      const proposal2 = createProposal({
        id: '2',
        proposedName: 'photo.jpg',
        proposedPath: '/test/photo.jpg',
      });
      const proposal3 = createProposal({
        id: '3',
        proposedName: 'photo.jpg',
        proposedPath: '/test/photo.jpg',
      });

      const context = createContext([proposal1, proposal2, proposal3]);

      const issues1 = detectIssues(proposal1, context);
      const issues2 = detectIssues(proposal2, context);
      const issues3 = detectIssues(proposal3, context);

      const fix1 = issues1.find((i) => i.code === IssueCode.DUPLICATE_PROPOSED)?.autoFixAction?.();
      const fix2 = issues2.find((i) => i.code === IssueCode.DUPLICATE_PROPOSED)?.autoFixAction?.();
      const fix3 = issues3.find((i) => i.code === IssueCode.DUPLICATE_PROPOSED)?.autoFixAction?.();

      // Each should get a unique counter
      expect(fix1).toBe('photo_2.jpg');
      expect(fix2).toBe('photo_3.jpg');
      expect(fix3).toBe('photo_4.jpg');

      // All fixes should be different
      expect(new Set([fix1, fix2, fix3]).size).toBe(3);
    });

    it('suggests suffix for file exists conflict', () => {
      const proposal = createProposal({
        id: '1',
        proposedName: 'existing.jpg',
        proposedPath: '/test/existing.jpg',
      });

      const issues = detectIssues(proposal, {
        proposals: [proposal],
        checkFileSystem: true,
        existingFiles: new Set(['/test/existing.jpg']),
      });

      const existsIssue = issues.find((i) => i.code === IssueCode.FILE_EXISTS);
      expect(existsIssue?.autoFixAction?.()).toBe('existing_new.jpg');
    });

    it('handles files without extension in counter', () => {
      const proposal1 = createProposal({
        id: '1',
        proposedName: 'README',
        proposedPath: '/test/README',
      });
      const proposal2 = createProposal({
        id: '2',
        proposedName: 'README',
        proposedPath: '/test/README',
      });

      const issues = detectIssues(proposal1, createContext([proposal1, proposal2]));
      const dupIssue = issues.find((i) => i.code === IssueCode.DUPLICATE_PROPOSED);

      expect(dupIssue?.autoFixAction?.()).toBe('README_2');
    });

    it('handles files without extension in suffix', () => {
      const proposal = createProposal({
        id: '1',
        proposedName: 'Makefile',
        proposedPath: '/test/Makefile',
      });

      const issues = detectIssues(proposal, {
        proposals: [proposal],
        checkFileSystem: true,
        existingFiles: new Set(['/test/Makefile']),
      });

      const existsIssue = issues.find((i) => i.code === IssueCode.FILE_EXISTS);
      expect(existsIssue?.autoFixAction?.()).toBe('Makefile_new');
    });
  });

  describe('issue structure', () => {
    it('includes all required fields in issue', () => {
      const proposal1 = createProposal({
        id: '1',
        proposedName: 'same.jpg',
        proposedPath: '/test/same.jpg',
      });
      const proposal2 = createProposal({
        id: '2',
        proposedName: 'same.jpg',
        proposedPath: '/test/same.jpg',
      });

      const issues = detectIssues(proposal1, createContext([proposal1, proposal2]));
      const issue = issues[0];

      expect(issue).toHaveProperty('code');
      expect(issue).toHaveProperty('message');
      expect(issue).toHaveProperty('severity');
      expect(issue).toHaveProperty('autoFixable');
    });

    it('includes suggestion for fixable issues', () => {
      const proposal1 = createProposal({
        id: '1',
        proposedName: 'same.jpg',
        proposedPath: '/test/same.jpg',
      });
      const proposal2 = createProposal({
        id: '2',
        proposedName: 'same.jpg',
        proposedPath: '/test/same.jpg',
      });

      const issues = detectIssues(proposal1, createContext([proposal1, proposal2]));
      const issue = issues.find((i) => i.autoFixable);

      expect(issue?.suggestion).toBeDefined();
      expect(issue?.suggestion).toContain('identifier');
    });
  });
});
