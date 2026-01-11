/**
 * @fileoverview Workflow module exports - Story 7.5
 *
 * Provides unified workflows that combine multiple operations:
 * - scanAndApplyRules: Scan folder, extract metadata, apply rules, generate preview
 */

export {
  scanAndApplyRules,
  type ScanAndApplyOptions,
  type ScanAndApplyResult,
  type ScanAndApplyError,
  type WorkflowProgressCallback,
  type WorkflowTiming,
  type ExtractionErrorInfo,
} from './scan-and-apply.js';
