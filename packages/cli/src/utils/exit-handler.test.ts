/**
 * @fileoverview Tests for exit handler utilities - Story 5.8
 *
 * AC covered (5.8):
 * - AC1: Exit code 0 on success
 * - AC2: Exit code 1 on error
 * - AC3: Exit code 2 on warning
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  WarningCollector,
  reportWarning,
  onExit,
  offExit,
  exit,
  exitSuccess,
  exitError,
  exitWarning,
  resetExitContext,
} from './exit-handler.js';
import { ExitCode } from './exit-codes.js';

describe('WarningCollector', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts with no warnings', () => {
    const collector = new WarningCollector();
    expect(collector.hasWarnings()).toBe(false);
    expect(collector.getWarnings()).toHaveLength(0);
  });

  it('returns SUCCESS exit code when no warnings', () => {
    const collector = new WarningCollector();
    expect(collector.getExitCode()).toBe(ExitCode.SUCCESS);
  });

  it('tracks added warnings', () => {
    const collector = new WarningCollector();
    collector.add('First warning');
    collector.add('Second warning');

    expect(collector.hasWarnings()).toBe(true);
    expect(collector.getWarnings()).toHaveLength(2);
    expect(collector.getWarnings()).toContain('First warning');
    expect(collector.getWarnings()).toContain('Second warning');
  });

  it('returns WARNING exit code when warnings exist', () => {
    const collector = new WarningCollector();
    collector.add('Test warning');

    expect(collector.getExitCode()).toBe(ExitCode.WARNING);
  });

  it('reports warnings to console when added', () => {
    const collector = new WarningCollector();
    collector.add('Test warning');

    expect(console.warn).toHaveBeenCalled();
  });

  it('returns a copy of warnings array', () => {
    const collector = new WarningCollector();
    collector.add('Warning 1');

    const warnings1 = collector.getWarnings();
    const warnings2 = collector.getWarnings();

    expect(warnings1).not.toBe(warnings2);
    expect(warnings1).toEqual(warnings2);
  });
});

describe('reportWarning', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('writes warning to console.warn', () => {
    reportWarning('Test warning message');

    expect(console.warn).toHaveBeenCalled();
  });

  it('includes the warning message in output', () => {
    let output = '';
    vi.spyOn(console, 'warn').mockImplementation((msg) => {
      output = msg;
    });

    reportWarning('Test warning message');

    expect(output).toContain('Test warning message');
  });
});

describe('onExit and offExit', () => {
  beforeEach(() => {
    resetExitContext();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetExitContext();
  });

  it('registers cleanup handler with onExit', () => {
    const handler = vi.fn();
    expect(() => onExit(handler)).not.toThrow();
  });

  it('removes cleanup handler with offExit', () => {
    const handler = vi.fn();
    onExit(handler);
    expect(() => offExit(handler)).not.toThrow();
  });

  it('offExit with non-registered handler does not throw', () => {
    const handler = vi.fn();
    expect(() => offExit(handler)).not.toThrow();
  });
});

describe('exit function', () => {
  let mockProcessExit: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resetExitContext();
    mockProcessExit = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit(${code})`);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetExitContext();
  });

  it('calls process.exit with the specified code', async () => {
    await expect(exit(ExitCode.SUCCESS)).rejects.toThrow('process.exit(0)');
  });

  it('runs cleanup handlers before exiting', async () => {
    const handler = vi.fn();
    onExit(handler);

    await expect(exit(ExitCode.SUCCESS)).rejects.toThrow();

    expect(handler).toHaveBeenCalled();
  });

  it('runs cleanup handlers in reverse order (LIFO)', async () => {
    const order: number[] = [];
    onExit(() => order.push(1));
    onExit(() => order.push(2));
    onExit(() => order.push(3));

    await expect(exit(ExitCode.SUCCESS)).rejects.toThrow();

    expect(order).toEqual([3, 2, 1]);
  });

  it('handles failing cleanup handlers gracefully', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const failingHandler = () => {
      throw new Error('Handler failed');
    };
    onExit(failingHandler);

    // Should not throw due to handler failure
    await expect(exit(ExitCode.SUCCESS)).rejects.toThrow('process.exit');
  });

  it('does not run handlers twice on multiple exit calls', async () => {
    const handler = vi.fn();
    onExit(handler);

    // First exit
    await expect(exit(ExitCode.SUCCESS)).rejects.toThrow();
    expect(handler).toHaveBeenCalledTimes(1);

    // Second exit should skip handlers
    await expect(exit(ExitCode.SUCCESS)).rejects.toThrow();
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

describe('exitSuccess', () => {
  let mockProcessExit: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resetExitContext();
    mockProcessExit = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit(${code})`);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetExitContext();
  });

  it('exits with code 0 (AC1)', async () => {
    await expect(exitSuccess()).rejects.toThrow('process.exit(0)');
  });
});

describe('exitError', () => {
  let mockProcessExit: ReturnType<typeof vi.spyOn>;
  let mockConsoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resetExitContext();
    mockProcessExit = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit(${code})`);
    });
    mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetExitContext();
  });

  it('exits with code 1 (AC2)', async () => {
    await expect(exitError('Test error')).rejects.toThrow('process.exit(1)');
  });

  it('prints error message to console', async () => {
    let capturedMessage = '';
    mockConsoleError.mockImplementation((msg) => {
      capturedMessage = String(msg);
    });

    await expect(exitError('Test error message')).rejects.toThrow();

    expect(capturedMessage).toContain('Test error message');
  });

  it('prints details if provided', async () => {
    const captured: string[] = [];
    mockConsoleError.mockImplementation((msg) => {
      captured.push(String(msg));
    });

    await expect(exitError('Error', 'Additional details')).rejects.toThrow();

    expect(captured.join(' ')).toContain('Additional details');
  });
});

describe('exitWarning', () => {
  let mockProcessExit: ReturnType<typeof vi.spyOn>;
  let mockConsoleWarn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resetExitContext();
    mockProcessExit = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit(${code})`);
    });
    mockConsoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetExitContext();
  });

  it('exits with code 2 (AC3)', async () => {
    await expect(exitWarning('Test warning')).rejects.toThrow('process.exit(2)');
  });

  it('prints warning message to console', async () => {
    let capturedMessage = '';
    mockConsoleWarn.mockImplementation((msg) => {
      capturedMessage = String(msg);
    });

    await expect(exitWarning('Test warning message')).rejects.toThrow();

    expect(capturedMessage).toContain('Test warning message');
  });
});

describe('resetExitContext', () => {
  it('can be called without error', () => {
    expect(() => resetExitContext()).not.toThrow();
  });

  it('clears hasExited flag allowing handlers to run again', async () => {
    const mockProcessExit = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit(${code})`);
    });

    const handler = vi.fn();
    onExit(handler);

    // First exit
    await expect(exit(ExitCode.SUCCESS)).rejects.toThrow();
    expect(handler).toHaveBeenCalledTimes(1);

    // Reset context
    resetExitContext();
    onExit(handler);

    // Second exit should run handler again
    await expect(exit(ExitCode.SUCCESS)).rejects.toThrow();
    expect(handler).toHaveBeenCalledTimes(2);

    mockProcessExit.mockRestore();
  });
});
