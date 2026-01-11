import { describe, it, expect, vi } from 'vitest';
import {
  withRetry,
  withRetryResult,
  isTransientError,
  calculateBackoffDelay,
} from './retry.js';
import { ok, err } from '../types/result.js';

describe('isTransientError', () => {
  it('should return true for EBUSY errors', () => {
    expect(isTransientError(new Error('EBUSY: resource busy'))).toBe(true);
    expect(isTransientError(new Error('Resource busy'))).toBe(true);
  });

  it('should return true for EMFILE errors', () => {
    expect(isTransientError(new Error('EMFILE: too many open files'))).toBe(
      true
    );
  });

  it('should return true for EAGAIN errors', () => {
    expect(isTransientError(new Error('EAGAIN: resource unavailable'))).toBe(
      true
    );
    expect(isTransientError(new Error('Try again later'))).toBe(true);
  });

  it('should return true for timeout errors', () => {
    expect(isTransientError(new Error('ETIMEDOUT: connection timed out'))).toBe(
      true
    );
    expect(isTransientError(new Error('Request timeout'))).toBe(true);
  });

  it('should return true for connection reset errors', () => {
    expect(isTransientError(new Error('ECONNRESET'))).toBe(true);
    expect(isTransientError(new Error('Connection reset by peer'))).toBe(true);
  });

  it('should return false for non-transient errors', () => {
    expect(isTransientError(new Error('ENOENT: file not found'))).toBe(false);
    expect(isTransientError(new Error('Permission denied'))).toBe(false);
    expect(isTransientError(new Error('Invalid input'))).toBe(false);
  });
});

describe('calculateBackoffDelay', () => {
  it('should calculate exponential delay', () => {
    // First attempt (attempt=0): 100 * 2^0 = 100
    const delay0 = calculateBackoffDelay(0, 100, 10000, 2);
    expect(delay0).toBeGreaterThanOrEqual(75); // 100 - 25% jitter
    expect(delay0).toBeLessThanOrEqual(125); // 100 + 25% jitter

    // Second attempt (attempt=1): 100 * 2^1 = 200
    const delay1 = calculateBackoffDelay(1, 100, 10000, 2);
    expect(delay1).toBeGreaterThanOrEqual(150);
    expect(delay1).toBeLessThanOrEqual(250);

    // Third attempt (attempt=2): 100 * 2^2 = 400
    const delay2 = calculateBackoffDelay(2, 100, 10000, 2);
    expect(delay2).toBeGreaterThanOrEqual(300);
    expect(delay2).toBeLessThanOrEqual(500);
  });

  it('should respect maxDelay', () => {
    // Large attempt number should be clamped to maxDelay
    const delay = calculateBackoffDelay(10, 100, 1000, 2);
    expect(delay).toBeLessThanOrEqual(1000);
  });

  it('should use custom multiplier', () => {
    // With multiplier of 3: 100 * 3^1 = 300
    const delay = calculateBackoffDelay(1, 100, 10000, 3);
    expect(delay).toBeGreaterThanOrEqual(225);
    expect(delay).toBeLessThanOrEqual(375);
  });
});

describe('withRetry', () => {
  it('should return success on first try', async () => {
    const fn = vi.fn().mockResolvedValue('success');

    const result = await withRetry(fn);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toBe('success');
    }
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on transient error and succeed', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('EBUSY: resource busy'))
      .mockResolvedValueOnce('success');

    const result = await withRetry(fn, {
      initialDelay: 1,
      maxRetries: 3,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toBe('success');
    }
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should not retry on non-transient error', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('ENOENT: file not found'));

    const result = await withRetry(fn, {
      initialDelay: 1,
      maxRetries: 3,
    });

    expect(result.ok).toBe(false);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should give up after maxRetries', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('EBUSY: resource busy'));

    const result = await withRetry(fn, {
      initialDelay: 1,
      maxRetries: 2,
    });

    expect(result.ok).toBe(false);
    // Initial attempt + 2 retries = 3 calls
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should call onRetry callback', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('EBUSY: resource busy'))
      .mockResolvedValueOnce('success');

    const onRetry = vi.fn();

    await withRetry(fn, {
      initialDelay: 1,
      maxRetries: 3,
      onRetry,
    });

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(
      expect.any(Error),
      1,
      expect.any(Number)
    );
  });

  it('should use custom shouldRetry predicate', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('Custom error'));

    const shouldRetry = vi.fn().mockReturnValue(true);

    await withRetry(fn, {
      initialDelay: 1,
      maxRetries: 2,
      shouldRetry,
    });

    expect(shouldRetry).toHaveBeenCalled();
    expect(fn).toHaveBeenCalledTimes(3); // Initial + 2 retries
  });

  it('should respect abort signal', async () => {
    const controller = new AbortController();
    const fn = vi.fn().mockRejectedValue(new Error('EBUSY'));

    // Abort immediately
    controller.abort();

    const result = await withRetry(fn, {
      signal: controller.signal,
      initialDelay: 1,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toBe('Aborted');
    }
    expect(fn).not.toHaveBeenCalled();
  });

  it('should handle non-Error exceptions', async () => {
    const fn = vi.fn().mockRejectedValue('string error');

    const result = await withRetry(fn, {
      initialDelay: 1,
      maxRetries: 0,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toBe('string error');
    }
  });
});

describe('withRetryResult', () => {
  it('should return success on first try', async () => {
    const fn = vi.fn().mockResolvedValue(ok('success'));

    const result = await withRetryResult(fn);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toBe('success');
    }
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on transient error result and succeed', async () => {
    const fn = vi
      .fn()
      .mockResolvedValueOnce(err(new Error('EBUSY: resource busy')))
      .mockResolvedValueOnce(ok('success'));

    const result = await withRetryResult(fn, {
      initialDelay: 1,
      maxRetries: 3,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toBe('success');
    }
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should not retry on non-transient error result', async () => {
    const fn = vi
      .fn()
      .mockResolvedValue(err(new Error('ENOENT: file not found')));

    const result = await withRetryResult(fn, {
      initialDelay: 1,
      maxRetries: 3,
    });

    expect(result.ok).toBe(false);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should give up after maxRetries', async () => {
    const fn = vi.fn().mockResolvedValue(err(new Error('EBUSY: busy')));

    const result = await withRetryResult(fn, {
      initialDelay: 1,
      maxRetries: 2,
    });

    expect(result.ok).toBe(false);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should respect abort signal', async () => {
    const controller = new AbortController();
    controller.abort();

    const fn = vi.fn().mockResolvedValue(err(new Error('EBUSY')));

    const result = await withRetryResult(fn, {
      signal: controller.signal,
      initialDelay: 1,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toBe('Aborted');
    }
    expect(fn).not.toHaveBeenCalled();
  });
});
