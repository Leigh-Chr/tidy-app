/**
 * @fileoverview Tests for signal handlers - Story 5.8
 *
 * AC covered (5.8):
 * - AC4: Exit code 130 on user cancellation
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setupSignalHandlers, isInterrupted, resetSignalState } from './signals.js';
import { ExitCode } from './exit-codes.js';

// Mock the exit handler to prevent actual process exit
vi.mock('./exit-handler.js', () => ({
  exit: vi.fn().mockImplementation((code) => {
    throw new Error(`exit(${code})`);
  }),
}));

describe('setupSignalHandlers', () => {
  let mockProcessOn: ReturnType<typeof vi.spyOn>;
  let mockConsoleLog: ReturnType<typeof vi.spyOn>;
  let mockConsoleError: ReturnType<typeof vi.spyOn>;
  let mockProcessExit: ReturnType<typeof vi.spyOn>;
  const originalProcessOn = process.on.bind(process);

  beforeEach(() => {
    vi.clearAllMocks();
    resetSignalState();

    mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockProcessExit = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit(${code})`);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetSignalState();
    // Remove any listeners we added during tests
    process.removeAllListeners('SIGINT');
    process.removeAllListeners('SIGTERM');
    process.removeAllListeners('uncaughtException');
    process.removeAllListeners('unhandledRejection');
  });

  it('sets up handlers without throwing', () => {
    expect(() => setupSignalHandlers()).not.toThrow();
  });

  it('registers SIGINT handler', () => {
    mockProcessOn = vi.spyOn(process, 'on');
    setupSignalHandlers();

    expect(mockProcessOn).toHaveBeenCalledWith('SIGINT', expect.any(Function));
  });

  it('registers SIGTERM handler', () => {
    mockProcessOn = vi.spyOn(process, 'on');
    setupSignalHandlers();

    expect(mockProcessOn).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
  });

  it('registers uncaughtException handler', () => {
    mockProcessOn = vi.spyOn(process, 'on');
    setupSignalHandlers();

    expect(mockProcessOn).toHaveBeenCalledWith('uncaughtException', expect.any(Function));
  });

  it('registers unhandledRejection handler', () => {
    mockProcessOn = vi.spyOn(process, 'on');
    setupSignalHandlers();

    expect(mockProcessOn).toHaveBeenCalledWith('unhandledRejection', expect.any(Function));
  });
});

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

  it('returns false after reset', () => {
    // Simulate some state change would happen
    resetSignalState();
    expect(isInterrupted()).toBe(false);
  });
});

describe('resetSignalState', () => {
  it('can be called multiple times without error', () => {
    expect(() => {
      resetSignalState();
      resetSignalState();
      resetSignalState();
    }).not.toThrow();
  });

  it('resets interrupted state to false', () => {
    resetSignalState();
    expect(isInterrupted()).toBe(false);
  });
});

describe('ExitCode values used by signals', () => {
  it('SIGINT should be 130', () => {
    expect(ExitCode.SIGINT).toBe(130);
  });

  it('SIGTERM should be 143', () => {
    expect(ExitCode.SIGTERM).toBe(143);
  });

  it('ERROR should be 1', () => {
    expect(ExitCode.ERROR).toBe(1);
  });
});
