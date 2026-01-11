/**
 * @fileoverview Tests for exit codes - Story 5.8
 *
 * AC covered (5.8):
 * - AC1: Exit code 0 on success
 * - AC2: Exit code 1 on error
 * - AC3: Exit code 2 on warning
 * - AC4: Exit code 130 on user cancellation
 */
import { describe, it, expect } from 'vitest';
import { ExitCode, getExitCodeDescription } from './exit-codes.js';

describe('ExitCode', () => {
  // AC1: Exit code 0 on success
  it('has SUCCESS code as 0', () => {
    expect(ExitCode.SUCCESS).toBe(0);
  });

  // AC2: Exit code 1 on error
  it('has ERROR code as 1', () => {
    expect(ExitCode.ERROR).toBe(1);
  });

  // AC3: Exit code 2 on warning
  it('has WARNING code as 2', () => {
    expect(ExitCode.WARNING).toBe(2);
  });

  // AC4: Exit code 130 on user cancellation
  it('has SIGINT code as 130', () => {
    expect(ExitCode.SIGINT).toBe(130);
  });

  it('has SIGTERM code as 143', () => {
    expect(ExitCode.SIGTERM).toBe(143);
  });

  it('has USAGE_ERROR code as 64', () => {
    expect(ExitCode.USAGE_ERROR).toBe(64);
  });

  it('has DATA_ERROR code as 65', () => {
    expect(ExitCode.DATA_ERROR).toBe(65);
  });

  it('has NO_INPUT code as 66', () => {
    expect(ExitCode.NO_INPUT).toBe(66);
  });

  it('has NO_PERMISSION code as 77', () => {
    expect(ExitCode.NO_PERMISSION).toBe(77);
  });

  it('has CONFIG_ERROR code as 78', () => {
    expect(ExitCode.CONFIG_ERROR).toBe(78);
  });
});

describe('getExitCodeDescription', () => {
  it('returns "Success" for SUCCESS code', () => {
    expect(getExitCodeDescription(ExitCode.SUCCESS)).toBe('Success');
  });

  it('returns "General error" for ERROR code', () => {
    expect(getExitCodeDescription(ExitCode.ERROR)).toBe('General error');
  });

  it('returns "Completed with warnings" for WARNING code', () => {
    expect(getExitCodeDescription(ExitCode.WARNING)).toBe('Completed with warnings');
  });

  it('returns "Interrupted by user" for SIGINT code', () => {
    expect(getExitCodeDescription(ExitCode.SIGINT)).toBe('Interrupted by user');
  });

  it('returns "Terminated" for SIGTERM code', () => {
    expect(getExitCodeDescription(ExitCode.SIGTERM)).toBe('Terminated');
  });

  it('returns "Invalid command usage" for USAGE_ERROR code', () => {
    expect(getExitCodeDescription(ExitCode.USAGE_ERROR)).toBe('Invalid command usage');
  });

  it('returns "Data format error" for DATA_ERROR code', () => {
    expect(getExitCodeDescription(ExitCode.DATA_ERROR)).toBe('Data format error');
  });

  it('returns "Input not found" for NO_INPUT code', () => {
    expect(getExitCodeDescription(ExitCode.NO_INPUT)).toBe('Input not found');
  });

  it('returns "Permission denied" for NO_PERMISSION code', () => {
    expect(getExitCodeDescription(ExitCode.NO_PERMISSION)).toBe('Permission denied');
  });

  it('returns "Configuration error" for CONFIG_ERROR code', () => {
    expect(getExitCodeDescription(ExitCode.CONFIG_ERROR)).toBe('Configuration error');
  });

  it('returns "Unknown" for undefined codes', () => {
    // @ts-expect-error - Testing invalid code
    expect(getExitCodeDescription(999)).toBe('Unknown');
  });
});
