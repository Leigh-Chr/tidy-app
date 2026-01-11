/**
 * @fileoverview Tests for output utilities - Story 5.7
 *
 * AC covered (5.7):
 * - AC5: Output is pipeable
 * - AC6: Colors disabled when not TTY
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import chalk from 'chalk';
import { shouldUseColor, configureColors } from './output.js';

describe('shouldUseColor', () => {
  // Store original values
  const originalEnv = { ...process.env };
  const originalIsTTY = process.stdout.isTTY;

  beforeEach(() => {
    // Reset to clean state
    process.env = { ...originalEnv };
    delete process.env.NO_COLOR;
    delete process.env.TERM;
  });

  afterEach(() => {
    // Restore original values
    process.env = originalEnv;
    Object.defineProperty(process.stdout, 'isTTY', {
      value: originalIsTTY,
      writable: true,
      configurable: true,
    });
  });

  // AC6: Colors disabled when not TTY
  describe('TTY detection', () => {
    it('returns true when stdout is TTY and no overrides', () => {
      Object.defineProperty(process.stdout, 'isTTY', {
        value: true,
        writable: true,
        configurable: true,
      });

      expect(shouldUseColor()).toBe(true);
    });

    it('returns false when stdout is not TTY (piping)', () => {
      Object.defineProperty(process.stdout, 'isTTY', {
        value: false,
        writable: true,
        configurable: true,
      });

      expect(shouldUseColor()).toBe(false);
    });

    it('returns false when stdout.isTTY is undefined', () => {
      Object.defineProperty(process.stdout, 'isTTY', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      expect(shouldUseColor()).toBe(false);
    });
  });

  describe('--no-color flag', () => {
    it('returns false when noColor option is true', () => {
      Object.defineProperty(process.stdout, 'isTTY', {
        value: true,
        writable: true,
        configurable: true,
      });

      expect(shouldUseColor({ noColor: true })).toBe(false);
    });

    it('returns true when noColor option is false', () => {
      Object.defineProperty(process.stdout, 'isTTY', {
        value: true,
        writable: true,
        configurable: true,
      });

      expect(shouldUseColor({ noColor: false })).toBe(true);
    });
  });

  describe('NO_COLOR environment variable', () => {
    it('returns false when NO_COLOR is set to empty string', () => {
      Object.defineProperty(process.stdout, 'isTTY', {
        value: true,
        writable: true,
        configurable: true,
      });
      process.env.NO_COLOR = '';

      expect(shouldUseColor()).toBe(false);
    });

    it('returns false when NO_COLOR is set to any value', () => {
      Object.defineProperty(process.stdout, 'isTTY', {
        value: true,
        writable: true,
        configurable: true,
      });
      process.env.NO_COLOR = '1';

      expect(shouldUseColor()).toBe(false);
    });
  });

  describe('TERM=dumb', () => {
    it('returns false when TERM is dumb', () => {
      Object.defineProperty(process.stdout, 'isTTY', {
        value: true,
        writable: true,
        configurable: true,
      });
      process.env.TERM = 'dumb';

      expect(shouldUseColor()).toBe(false);
    });

    it('returns true when TERM is not dumb', () => {
      Object.defineProperty(process.stdout, 'isTTY', {
        value: true,
        writable: true,
        configurable: true,
      });
      process.env.TERM = 'xterm-256color';

      expect(shouldUseColor()).toBe(true);
    });
  });

  describe('priority order', () => {
    it('--no-color takes precedence over TTY', () => {
      Object.defineProperty(process.stdout, 'isTTY', {
        value: true,
        writable: true,
        configurable: true,
      });

      // Even with TTY, --no-color should disable colors
      expect(shouldUseColor({ noColor: true })).toBe(false);
    });

    it('NO_COLOR env takes precedence over TTY', () => {
      Object.defineProperty(process.stdout, 'isTTY', {
        value: true,
        writable: true,
        configurable: true,
      });
      process.env.NO_COLOR = '1';

      // Even with TTY, NO_COLOR should disable colors
      expect(shouldUseColor()).toBe(false);
    });
  });
});

describe('configureColors', () => {
  // Store original chalk level
  const originalLevel = chalk.level;

  afterEach(() => {
    // Restore original chalk level
    chalk.level = originalLevel;
  });

  it('sets chalk.level to 3 when useColor is true', () => {
    configureColors(true);
    expect(chalk.level).toBe(3);
  });

  it('sets chalk.level to 0 when useColor is false', () => {
    configureColors(false);
    expect(chalk.level).toBe(0);
  });

  it('disables all chalk styling when level is 0', () => {
    configureColors(false);
    // When level is 0, chalk returns plain text without ANSI codes
    const styled = chalk.bold.red('test');
    expect(styled).toBe('test');
  });

  it('enables chalk styling when level is 3', () => {
    configureColors(true);
    // When level is 3, chalk adds ANSI codes
    const styled = chalk.bold('test');
    // ANSI codes start with \x1b[
    expect(styled).toMatch(/\x1b\[/);
  });
});
