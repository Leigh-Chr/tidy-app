/**
 * @fileoverview Offline operation support - Story 10.6
 *
 * Provides graceful degradation when Ollama is unavailable.
 * Ensures tidy-app works fully without AI dependency.
 *
 * Key principles:
 * 1. Fail-safe default: App never crashes due to LLM unavailability
 * 2. Quick detection: Health checks use short timeouts (5s) to avoid blocking
 * 3. Clear communication: Users always know why LLM features aren't working
 * 4. Graceful degradation: Non-LLM features (EXIF, file system metadata) always work
 *
 * @module llm/offline
 */

import {
  type OllamaConfig,
  type OllamaError,
} from './types.js';
import { checkOllamaHealth } from './health.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Result of pre-operation availability check.
 *
 * Provides detailed information about LLM availability suitable
 * for display in CLI or GUI.
 */
export interface LlmAvailabilityStatus {
  /** Whether LLM is available for use */
  available: boolean;
  /** Human-readable reason for status */
  reason: string;
  /** Suggested action for user */
  suggestion: string;
  /** Response time if check succeeded (ms) */
  responseTimeMs?: number;
}

/**
 * Recommended action when LLM unavailable.
 *
 * - `proceed-without-llm`: Continue with metadata-only naming
 * - `abort`: Stop the operation
 * - `retry`: Attempt the operation again
 */
export type OfflineOperationMode = 'proceed-without-llm' | 'abort' | 'retry';

/**
 * Source of analysis for a file.
 *
 * - `llm`: Full LLM text analysis
 * - `vision`: Vision model image analysis
 * - `metadata-only`: Used existing metadata (EXIF, document properties)
 * - `offline-fallback`: LLM was unavailable, used fallback
 */
export type AnalysisSource = 'llm' | 'vision' | 'metadata-only' | 'offline-fallback';

/**
 * Result for files that couldn't be analyzed due to LLM unavailability.
 */
export interface OfflineFallbackResult {
  /** Path to the file */
  filePath: string;
  /** Always 'offline-fallback' for this type */
  analysisSource: 'offline-fallback';
  /** Reason why LLM wasn't available */
  reason: string;
  /** No suggestion available in offline mode */
  suggestion: null;
  /** When the fallback was created */
  timestamp: string;
}

/**
 * LLM status during batch processing.
 *
 * - `available`: LLM was used for all eligible files
 * - `unavailable`: LLM was not available for any files
 * - `partial`: LLM became unavailable mid-batch (some files used it)
 */
export type BatchLlmStatus = 'available' | 'unavailable' | 'partial';

/**
 * Summary of batch processing with offline information.
 */
export interface BatchOfflineSummary {
  /** Overall LLM status during batch */
  llmStatus: BatchLlmStatus;
  /** Files analyzed with LLM */
  llmAnalyzedCount: number;
  /** Files analyzed with vision model */
  visionAnalyzedCount: number;
  /** Files that fell back to offline mode */
  offlineFallbackCount: number;
  /** Files skipped by filter */
  skippedCount: number;
  /** Error messages if any */
  errors: string[];
}

/**
 * Decision about whether to proceed with an operation.
 */
export interface OperationDecision {
  /** Whether to proceed with the operation */
  proceed: boolean;
  /** Whether to use offline mode (no LLM) */
  useOfflineMode: boolean;
  /** Human-readable explanation */
  message: string;
}

// =============================================================================
// Error Message Templates
// =============================================================================

/**
 * Standard error messages for offline scenarios.
 *
 * Provides consistent, user-friendly messages with actionable suggestions.
 */
export const OFFLINE_MESSAGES = {
  CONNECTION_REFUSED: {
    reason: 'Cannot connect to Ollama server',
    suggestion: 'Start Ollama with: ollama serve',
  },
  TIMEOUT: {
    reason: 'Ollama server is not responding',
    suggestion: 'Check if Ollama is running: ollama -v',
  },
  DISABLED: {
    reason: 'LLM integration is disabled in configuration',
    suggestion: 'Enable LLM with: tidy config set llm.enabled true',
  },
  OFFLINE_MODE_ENABLED: {
    reason: 'Offline mode is enabled in configuration',
    suggestion: 'To use LLM: tidy config set llm.offlineMode auto',
  },
  NO_MODEL: {
    reason: 'No inference model configured',
    suggestion: 'Set a model with: tidy config set llm.models.inference mistral',
  },
  NOT_RESPONDING: {
    reason: 'Ollama is not responding',
    suggestion: 'Check if Ollama is running: ollama -v',
  },
} as const;

// =============================================================================
// Pre-Operation Check
// =============================================================================

/**
 * Check LLM availability before starting an operation.
 *
 * Uses a shorter timeout than normal requests to avoid blocking.
 * Returns detailed status suitable for user display.
 *
 * This is the primary way to check availability before any operation
 * that might use LLM features.
 *
 * @param config - Ollama configuration
 * @returns Availability status with reason and suggestion
 *
 * @example
 * ```typescript
 * const status = await checkLlmAvailabilityForOperation(config);
 * if (!status.available) {
 *   console.log(`LLM unavailable: ${status.reason}`);
 *   console.log(`Suggestion: ${status.suggestion}`);
 *   // Proceed with offline mode or prompt user
 * }
 * ```
 */
export async function checkLlmAvailabilityForOperation(
  config: OllamaConfig
): Promise<LlmAvailabilityStatus> {
  // Check if LLM is disabled in config
  if (!config.enabled) {
    return {
      available: false,
      reason: OFFLINE_MESSAGES.DISABLED.reason,
      suggestion: OFFLINE_MESSAGES.DISABLED.suggestion,
    };
  }

  // Check if offline mode is explicitly enabled
  if ('offlineMode' in config && config.offlineMode === 'enabled') {
    return {
      available: false,
      reason: OFFLINE_MESSAGES.OFFLINE_MODE_ENABLED.reason,
      suggestion: OFFLINE_MESSAGES.OFFLINE_MODE_ENABLED.suggestion,
    };
  }

  // Check if inference model is configured
  if (!config.models?.inference) {
    return {
      available: false,
      reason: OFFLINE_MESSAGES.NO_MODEL.reason,
      suggestion: OFFLINE_MESSAGES.NO_MODEL.suggestion,
    };
  }

  // Perform quick health check with shorter timeout
  const startTime = Date.now();
  const healthCheckTimeout = 'healthCheckTimeout' in config
    ? (config.healthCheckTimeout as number)
    : 5000;

  const healthCheckConfig = {
    ...config,
    timeout: healthCheckTimeout,
  };

  const healthResult = await checkOllamaHealth(healthCheckConfig);
  const responseTime = Date.now() - startTime;

  if (!healthResult.ok) {
    // Categorize the error for better messaging
    const errorMessage = healthResult.error.message.toLowerCase();
    const isTimeout = errorMessage.includes('timeout') || healthResult.error.code === 'TIMEOUT';
    const messageTemplate = isTimeout
      ? OFFLINE_MESSAGES.TIMEOUT
      : OFFLINE_MESSAGES.CONNECTION_REFUSED;

    return {
      available: false,
      reason: `${messageTemplate.reason}: ${healthResult.error.message}`,
      suggestion: messageTemplate.suggestion,
      responseTimeMs: responseTime,
    };
  }

  if (!healthResult.data.available) {
    return {
      available: false,
      reason: OFFLINE_MESSAGES.NOT_RESPONDING.reason,
      suggestion: OFFLINE_MESSAGES.NOT_RESPONDING.suggestion,
      responseTimeMs: responseTime,
    };
  }

  return {
    available: true,
    reason: `Connected with ${healthResult.data.modelCount ?? 0} model${(healthResult.data.modelCount ?? 0) === 1 ? '' : 's'}`,
    suggestion: '',
    responseTimeMs: responseTime,
  };
}

/**
 * Determine if operation should proceed based on config and availability.
 *
 * Takes the availability status from `checkLlmAvailabilityForOperation`
 * and the configuration to decide:
 * - Whether to proceed at all
 * - Whether to use offline mode
 *
 * @param config - Ollama configuration (including offlineMode setting)
 * @param availability - Result from checkLlmAvailabilityForOperation
 * @returns Decision about whether and how to proceed
 *
 * @example
 * ```typescript
 * const availability = await checkLlmAvailabilityForOperation(config);
 * const decision = shouldProceedWithOperation(config, availability);
 *
 * if (!decision.proceed) {
 *   console.error(decision.message);
 *   return;
 * }
 *
 * if (decision.useOfflineMode) {
 *   console.log('Operating without LLM...');
 * }
 * ```
 */
export function shouldProceedWithOperation(
  config: OllamaConfig,
  availability: LlmAvailabilityStatus
): OperationDecision {
  // If available, always proceed with LLM
  if (availability.available) {
    return {
      proceed: true,
      useOfflineMode: false,
      message: 'LLM available',
    };
  }

  // Get offline mode setting (with fallback for configs without this field)
  const offlineMode = 'offlineMode' in config
    ? (config.offlineMode as 'auto' | 'enabled' | 'disabled')
    : 'auto';

  switch (offlineMode) {
    case 'enabled':
      // Explicit offline mode - proceed without LLM
      return {
        proceed: true,
        useOfflineMode: true,
        message: 'Operating in offline mode (configured)',
      };

    case 'disabled':
      // Require LLM - fail if unavailable
      return {
        proceed: false,
        useOfflineMode: false,
        message: `LLM required but unavailable: ${availability.reason}`,
      };

    case 'auto':
    default:
      // Graceful degradation - proceed in offline mode
      return {
        proceed: true,
        useOfflineMode: true,
        message: `LLM unavailable, continuing in offline mode: ${availability.reason}`,
      };
  }
}

// =============================================================================
// Offline Fallback Results
// =============================================================================

/**
 * Create a fallback result for when LLM analysis couldn't be performed.
 *
 * Use this when a file would normally be analyzed by LLM but the
 * LLM is unavailable.
 *
 * @param filePath - Path to the file
 * @param reason - Why LLM wasn't available
 * @returns Analysis result marked as offline fallback
 *
 * @example
 * ```typescript
 * if (!llmAvailable) {
 *   const fallback = createOfflineFallbackResult(
 *     filePath,
 *     'Ollama connection timeout'
 *   );
 *   offlineFallbacks.set(filePath, fallback);
 * }
 * ```
 */
export function createOfflineFallbackResult(
  filePath: string,
  reason: string
): OfflineFallbackResult {
  return {
    filePath,
    analysisSource: 'offline-fallback',
    reason,
    suggestion: null,
    timestamp: new Date().toISOString(),
  };
}

// =============================================================================
// Batch Processing Status
// =============================================================================

/**
 * Create a batch offline summary from processing counts.
 *
 * Determines the overall LLM status based on how many files
 * were processed with vs without LLM.
 *
 * @param analyzedWithLlm - Count of files analyzed with LLM
 * @param analyzedWithVision - Count of files analyzed with vision model
 * @param offlineFallbacks - Count of files that fell back to offline mode
 * @param skipped - Count of files skipped by filter
 * @param errors - Error messages encountered during processing
 * @returns Summary of batch processing with offline information
 *
 * @example
 * ```typescript
 * const summary = createBatchOfflineSummary(10, 5, 3, 2, []);
 * // summary.llmStatus === 'partial' (some files used LLM, some didn't)
 * ```
 */
export function createBatchOfflineSummary(
  analyzedWithLlm: number,
  analyzedWithVision: number,
  offlineFallbacks: number,
  skipped: number,
  errors: string[]
): BatchOfflineSummary {
  let llmStatus: BatchLlmStatus;

  const totalAnalyzedWithAi = analyzedWithLlm + analyzedWithVision;

  if (totalAnalyzedWithAi > 0 && offlineFallbacks === 0) {
    llmStatus = 'available';
  } else if (totalAnalyzedWithAi === 0 && offlineFallbacks > 0) {
    llmStatus = 'unavailable';
  } else if (totalAnalyzedWithAi > 0 && offlineFallbacks > 0) {
    llmStatus = 'partial';
  } else {
    // No files processed with LLM and no fallbacks - either all skipped or no files
    llmStatus = 'unavailable';
  }

  return {
    llmStatus,
    llmAnalyzedCount: analyzedWithLlm,
    visionAnalyzedCount: analyzedWithVision,
    offlineFallbackCount: offlineFallbacks,
    skippedCount: skipped,
    errors,
  };
}

// =============================================================================
// Connection Error Detection
// =============================================================================

/**
 * Check if an error is a connection-related error.
 *
 * Used to detect when LLM becomes unavailable mid-batch so we can
 * switch to offline mode for remaining files.
 *
 * @param error - The error to check
 * @returns True if this is a connection error
 */
export function isConnectionError(error: OllamaError): boolean {
  return error.code === 'CONNECTION_FAILED' || error.code === 'TIMEOUT';
}

/**
 * Format an offline status for CLI display.
 *
 * @param status - The availability status
 * @returns Formatted status lines for display
 */
export function formatOfflineStatus(status: LlmAvailabilityStatus): string[] {
  const lines: string[] = [];

  if (status.available) {
    lines.push(`Mode:            Connected`);
    lines.push(`Status:          ${status.reason}`);
    if (status.responseTimeMs !== undefined) {
      lines.push(`Response time:   ${status.responseTimeMs}ms`);
    }
  } else {
    lines.push(`Mode:            Offline (LLM not available)`);
    lines.push(`Reason:          ${status.reason}`);
    if (status.suggestion) {
      lines.push(`Suggestion:      ${status.suggestion}`);
    }
  }

  return lines;
}
