/**
 * @fileoverview Tests for exit handler utilities - Story 5.8
 *
 * AC covered (5.8):
 * - AC1: Exit code 0 on success
 * - AC2: Exit code 1 on error
 * - AC3: Exit code 2 on warning
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WarningCollector, reportWarning } from './exit-handler.js';
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
