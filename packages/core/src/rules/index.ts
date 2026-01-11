/**
 * @fileoverview Rules module public exports - Story 7.1, 7.2, 7.3, 7.4
 *
 * Exports rule types, evaluators, and management functions for:
 * - Metadata pattern matching rules (Story 7.1)
 * - Filename pattern matching rules (Story 7.2)
 * - Template resolution for rules (Story 7.3)
 * - Unified priority management (Story 7.4)
 */

// =============================================================================
// Field Resolution
// =============================================================================

export {
  resolveFieldPath,
  fieldExists,
  resolveMultipleFields,
  type FieldResolutionResult,
} from './field-resolver.js';

// =============================================================================
// Condition Evaluation
// =============================================================================

export {
  evaluateCondition,
  evaluateConditions,
  clearRegexCache,
  type ConditionEvaluationResult,
  type ConditionEvaluationError,
} from './condition-evaluator.js';

// =============================================================================
// Rule Evaluation
// =============================================================================

export {
  evaluateRule,
  findMatchingRule,
  findAllMatchingRules,
  evaluateAllRules,
  type RuleEvaluatorError,
} from './evaluator.js';

// =============================================================================
// Rule Management
// =============================================================================

export {
  createRule,
  getRule,
  getRuleByName,
  updateRule,
  deleteRule,
  listRules,
  listEnabledRules,
  reorderRules,
  setRulePriority,
  toggleRuleEnabled,
  type RuleManagerError,
} from './manager.js';

// =============================================================================
// Filename Pattern Matching (Story 7.2)
// =============================================================================

export {
  matchGlob,
  isGlobMatch,
  filterByGlob,
  expandBraces,
  compileGlobPattern,
  type GlobMatchResult,
  type GlobMatchOptions,
} from './glob-matcher.js';

export {
  isValidGlobPattern,
  validateGlobPattern,
  PatternValidationMessages,
  PatternExamples,
  getPatternErrorHelp,
} from './pattern-validator.js';

export {
  evaluateFilenameRule,
  findMatchingFilenameRule,
  findAllMatchingFilenameRules,
  evaluateAllFilenameRules,
  evaluateFilenameRulesForFiles,
  type MatchedFilenameRule,
  type FileBatchResult,
} from './filename-evaluator.js';

export {
  createFilenameRule,
  getFilenameRule,
  getFilenameRuleByName,
  updateFilenameRule,
  deleteFilenameRule,
  listFilenameRules,
  listEnabledFilenameRules,
  reorderFilenameRules,
  setFilenameRulePriority,
  toggleFilenameRuleEnabled,
} from './filename-manager.js';

// =============================================================================
// Template Resolution (Story 7.3)
// =============================================================================

export {
  resolveTemplateForRule,
  type RulePriorityMode,
  type RuleMatch,
  type TemplateResolverOptions,
  type TemplateResolutionResult,
} from './template-resolver.js';

// =============================================================================
// Unified Priority Management (Story 7.4)
// =============================================================================

export {
  getUnifiedRulePriorities,
  setUnifiedRulePriority,
  reorderUnifiedRules,
  type UnifiedRule,
  type RulePriorityError,
} from './unified-priority.js';

// =============================================================================
// Priority Preview (Story 7.4)
// =============================================================================

export {
  previewRulePriority,
  detectPriorityTies,
  type RulePriorityPreview,
  type EvaluationOrderEntry,
  type PriorityTie,
  type SkipReason,
} from './priority-preview.js';
