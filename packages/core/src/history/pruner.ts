/**
 * @fileoverview History pruner for operation history - Story 9.1
 *
 * Provides functions to prune history entries based on count and age limits.
 * Supports configurable retention settings.
 *
 * @module history/pruner
 */

import type { HistoryStore, PruneConfig } from '../types/operation-history.js';

// =============================================================================
// Constants
// =============================================================================

/**
 * Default pruning configuration.
 */
export const DEFAULT_PRUNE_CONFIG: PruneConfig = {
  maxEntries: 100,
  maxAgeDays: 30,
};

// =============================================================================
// Pruning Functions
// =============================================================================

/**
 * Check if history store needs pruning.
 *
 * Returns true if either:
 * - Number of entries exceeds maxEntries
 * - Any entry is older than maxAgeDays
 *
 * @param store - The history store to check
 * @param config - Optional prune configuration
 * @returns True if pruning is needed
 *
 * @example
 * ```typescript
 * if (shouldPrune(store)) {
 *   const pruned = pruneHistory(store);
 * }
 * ```
 */
export function shouldPrune(
  store: HistoryStore,
  config: PruneConfig = DEFAULT_PRUNE_CONFIG
): boolean {
  // Check count limit
  if (store.entries.length > config.maxEntries) {
    return true;
  }

  // Check age limit
  const now = Date.now();
  const maxAgeMs = config.maxAgeDays * 24 * 60 * 60 * 1000;

  for (const entry of store.entries) {
    const entryTime = new Date(entry.timestamp).getTime();
    const age = now - entryTime;
    if (age > maxAgeMs) {
      return true;
    }
  }

  return false;
}

/**
 * Prune history entries based on count and age limits.
 *
 * Pruning strategy:
 * 1. First prune by count (keep newest maxEntries)
 * 2. Then prune by age (remove entries older than maxAgeDays)
 *
 * Updates lastPruned timestamp if any entries were removed.
 *
 * @param store - The history store to prune
 * @param config - Optional prune configuration
 * @returns A new history store with pruned entries
 *
 * @example
 * ```typescript
 * const config = { maxEntries: 50, maxAgeDays: 14 };
 * const prunedStore = pruneHistory(store, config);
 * ```
 */
export function pruneHistory(
  store: HistoryStore,
  config: PruneConfig = DEFAULT_PRUNE_CONFIG
): HistoryStore {
  const originalCount = store.entries.length;

  // Start with a copy of entries
  let prunedEntries = [...store.entries];

  // Step 1: Prune by count (entries are assumed newest-first)
  if (prunedEntries.length > config.maxEntries) {
    prunedEntries = prunedEntries.slice(0, config.maxEntries);
  }

  // Step 2: Prune by age
  const now = Date.now();
  const maxAgeMs = config.maxAgeDays * 24 * 60 * 60 * 1000;

  prunedEntries = prunedEntries.filter((entry) => {
    const entryTime = new Date(entry.timestamp).getTime();
    const age = now - entryTime;
    return age <= maxAgeMs;
  });

  // Determine if pruning occurred
  const pruned = prunedEntries.length < originalCount;

  return {
    version: store.version,
    lastPruned: pruned ? new Date().toISOString() : store.lastPruned,
    entries: prunedEntries,
  };
}
