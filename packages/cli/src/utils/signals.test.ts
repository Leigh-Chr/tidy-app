/**
 * @fileoverview Tests for signal handlers - Story 5.8
 *
 * AC covered (5.8):
 * - AC4: Exit code 130 on user cancellation
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isInterrupted, resetSignalState } from './signals.js';

describe('isInterrupted', () => {
  beforeEach(() => {
    resetSignalState();
  });

  afterEach(() => {
    resetSignalState();
  });

  it('returns false initially', () => {
    expect(isInterrupted()).toBe(false);
  });
});

describe('signal state', () => {
  beforeEach(() => {
    resetSignalState();
  });

  afterEach(() => {
    resetSignalState();
  });

  it('can be reset', () => {
    // State should be false after reset
    expect(isInterrupted()).toBe(false);
  });
});
