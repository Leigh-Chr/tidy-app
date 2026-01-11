import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createLogger,
  formatLogEntry,
  nullLogger,
  createTestLogger,
  type LogEntry,
} from './logger.js';

describe('formatLogEntry', () => {
  const baseEntry: LogEntry = {
    level: 'info',
    message: 'Test message',
    timestamp: new Date('2026-01-09T12:00:00.000Z'),
  };

  it('should format entry with timestamp', () => {
    const formatted = formatLogEntry(baseEntry, true);
    expect(formatted).toBe('[2026-01-09T12:00:00.000Z] INFO  Test message');
  });

  it('should format entry without timestamp', () => {
    const formatted = formatLogEntry(baseEntry, false);
    expect(formatted).toBe('INFO  Test message');
  });

  it('should include context as JSON', () => {
    const entry: LogEntry = {
      ...baseEntry,
      context: { file: '/test.jpg', size: 1000 },
    };
    const formatted = formatLogEntry(entry, false);
    expect(formatted).toBe(
      'INFO  Test message {"file":"/test.jpg","size":1000}'
    );
  });

  it('should not include empty context', () => {
    const entry: LogEntry = {
      ...baseEntry,
      context: {},
    };
    const formatted = formatLogEntry(entry, false);
    expect(formatted).toBe('INFO  Test message');
  });

  it('should pad level names for alignment', () => {
    // All levels padded to 5 chars: DEBUG, INFO_, WARN_, ERROR
    // When split by space, we get the padded level
    const debugEntry: LogEntry = { ...baseEntry, level: 'debug' };
    const infoEntry: LogEntry = { ...baseEntry, level: 'info' };
    const warnEntry: LogEntry = { ...baseEntry, level: 'warn' };
    const errorEntry: LogEntry = { ...baseEntry, level: 'error' };

    // The format is "LEVEL MESSAGE" where LEVEL is padded to 5 chars
    // After padEnd(5), levels become: DEBUG, INFO , WARN , ERROR
    expect(formatLogEntry(debugEntry, false)).toMatch(/^DEBUG/);
    expect(formatLogEntry(infoEntry, false)).toMatch(/^INFO /);
    expect(formatLogEntry(warnEntry, false)).toMatch(/^WARN /);
    expect(formatLogEntry(errorEntry, false)).toMatch(/^ERROR/);
  });
});

describe('createLogger', () => {
  let consoleSpy: {
    log: ReturnType<typeof vi.spyOn>;
    warn: ReturnType<typeof vi.spyOn>;
    error: ReturnType<typeof vi.spyOn>;
    debug: ReturnType<typeof vi.spyOn>;
  };

  beforeEach(() => {
    consoleSpy = {
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
      debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should log info messages by default', () => {
    const logger = createLogger();
    logger.info('Test message');

    expect(consoleSpy.log).toHaveBeenCalledTimes(1);
    expect(consoleSpy.log).toHaveBeenCalledWith(
      expect.stringContaining('INFO')
    );
    expect(consoleSpy.log).toHaveBeenCalledWith(
      expect.stringContaining('Test message')
    );
  });

  it('should not log debug when minLevel is info', () => {
    const logger = createLogger({ minLevel: 'info' });
    logger.debug('Debug message');

    expect(consoleSpy.debug).not.toHaveBeenCalled();
  });

  it('should log debug when minLevel is debug', () => {
    const logger = createLogger({ minLevel: 'debug' });
    logger.debug('Debug message');

    expect(consoleSpy.debug).toHaveBeenCalledTimes(1);
  });

  it('should log warn and error when minLevel is warn', () => {
    const logger = createLogger({ minLevel: 'warn' });
    logger.info('Info message');
    logger.warn('Warn message');
    logger.error('Error message');

    expect(consoleSpy.log).not.toHaveBeenCalled();
    expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
    expect(consoleSpy.error).toHaveBeenCalledTimes(1);
  });

  it('should only log error when minLevel is error', () => {
    const logger = createLogger({ minLevel: 'error' });
    logger.debug('Debug');
    logger.info('Info');
    logger.warn('Warn');
    logger.error('Error');

    expect(consoleSpy.debug).not.toHaveBeenCalled();
    expect(consoleSpy.log).not.toHaveBeenCalled();
    expect(consoleSpy.warn).not.toHaveBeenCalled();
    expect(consoleSpy.error).toHaveBeenCalledTimes(1);
  });

  it('should use custom handler', () => {
    const handler = vi.fn();
    const logger = createLogger({ handler, minLevel: 'debug' });

    logger.info('Test message', { key: 'value' });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'info',
        message: 'Test message',
        context: { key: 'value' },
      })
    );
  });

  it('should include context in log output', () => {
    const logger = createLogger();
    logger.info('Processing file', { file: '/test.jpg', size: 1024 });

    expect(consoleSpy.log).toHaveBeenCalledWith(
      expect.stringContaining('{"file":"/test.jpg","size":1024}')
    );
  });

  it('should use correct console method for each level', () => {
    const logger = createLogger({ minLevel: 'debug' });

    logger.debug('Debug');
    logger.info('Info');
    logger.warn('Warn');
    logger.error('Error');

    expect(consoleSpy.debug).toHaveBeenCalledTimes(1);
    expect(consoleSpy.log).toHaveBeenCalledTimes(1);
    expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
    expect(consoleSpy.error).toHaveBeenCalledTimes(1);
  });

  it('should omit timestamps when configured', () => {
    const logger = createLogger({ timestamps: false });
    logger.info('Test');

    const call = consoleSpy.log.mock.calls[0][0] as string;
    // Should not have ISO timestamp format
    expect(call).not.toMatch(/\[\d{4}-\d{2}-\d{2}T/);
  });
});

describe('nullLogger', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should not output anything', () => {
    nullLogger.debug('Debug');
    nullLogger.info('Info');
    nullLogger.warn('Warn');
    nullLogger.error('Error');

    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('should be safe to call with context', () => {
    expect(() => {
      nullLogger.info('Message', { data: 'test' });
    }).not.toThrow();
  });
});

describe('createTestLogger', () => {
  it('should collect all log entries', () => {
    const { logger, entries } = createTestLogger();

    logger.debug('Debug message');
    logger.info('Info message');
    logger.warn('Warn message');
    logger.error('Error message');

    expect(entries).toHaveLength(4);
    expect(entries[0].level).toBe('debug');
    expect(entries[1].level).toBe('info');
    expect(entries[2].level).toBe('warn');
    expect(entries[3].level).toBe('error');
  });

  it('should capture message and context', () => {
    const { logger, entries } = createTestLogger();

    logger.info('Test message', { key: 'value' });

    expect(entries[0].message).toBe('Test message');
    expect(entries[0].context).toEqual({ key: 'value' });
  });

  it('should capture timestamp', () => {
    const { logger, entries } = createTestLogger();

    const before = new Date();
    logger.info('Test');
    const after = new Date();

    expect(entries[0].timestamp.getTime()).toBeGreaterThanOrEqual(
      before.getTime()
    );
    expect(entries[0].timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
  });
});
