/**
 * Log level enumeration.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Structured log entry.
 */
export interface LogEntry {
  /** Log level */
  level: LogLevel;
  /** Log message */
  message: string;
  /** Additional context data */
  context?: Record<string, unknown>;
  /** Timestamp when log was created */
  timestamp: Date;
}

/**
 * Logger interface.
 */
export interface Logger {
  /** Log debug message */
  debug(message: string, context?: Record<string, unknown>): void;
  /** Log info message */
  info(message: string, context?: Record<string, unknown>): void;
  /** Log warning message */
  warn(message: string, context?: Record<string, unknown>): void;
  /** Log error message */
  error(message: string, context?: Record<string, unknown>): void;
}

/**
 * Log handler function signature.
 */
export type LogHandler = (entry: LogEntry) => void;

/**
 * Logger configuration options.
 */
export interface LoggerOptions {
  /** Minimum log level to output (default: 'info') */
  minLevel?: LogLevel;
  /** Custom log handler (default: console output) */
  handler?: LogHandler;
  /** Include timestamps in output (default: true) */
  timestamps?: boolean;
}

/**
 * Log level priority (higher = more severe).
 */
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Format a log entry for console output.
 */
export function formatLogEntry(entry: LogEntry, includeTimestamp = true): string {
  const parts: string[] = [];

  if (includeTimestamp) {
    parts.push(`[${entry.timestamp.toISOString()}]`);
  }

  parts.push(entry.level.toUpperCase().padEnd(5));
  parts.push(entry.message);

  if (entry.context && Object.keys(entry.context).length > 0) {
    parts.push(JSON.stringify(entry.context));
  }

  return parts.join(' ');
}

/**
 * Default console log handler.
 */
function createConsoleHandler(timestamps: boolean): LogHandler {
  return (entry: LogEntry) => {
    const formatted = formatLogEntry(entry, timestamps);

    switch (entry.level) {
      case 'error':
        console.error(formatted);
        break;
      case 'warn':
        console.warn(formatted);
        break;
      case 'debug':
        console.debug(formatted);
        break;
      default:
        console.log(formatted);
    }
  };
}

/**
 * Create a logger instance.
 *
 * @param options - Logger configuration
 * @returns Logger instance
 *
 * @example
 * ```typescript
 * const logger = createLogger({ minLevel: 'info' });
 *
 * logger.info('Starting extraction', { files: 10 });
 * logger.warn('Slow operation', { duration: 5000 });
 * logger.error('Extraction failed', { file: '/path/to/file.jpg', error: 'Corrupted' });
 * ```
 */
export function createLogger(options: LoggerOptions = {}): Logger {
  const {
    minLevel = 'info',
    handler,
    timestamps = true,
  } = options;

  const logHandler = handler ?? createConsoleHandler(timestamps);

  const shouldLog = (level: LogLevel): boolean => {
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[minLevel];
  };

  const log = (
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>
  ): void => {
    if (!shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      level,
      message,
      context,
      timestamp: new Date(),
    };

    logHandler(entry);
  };

  return {
    debug: (message, context): void => {
      log('debug', message, context);
    },
    info: (message, context): void => {
      log('info', message, context);
    },
    warn: (message, context): void => {
      log('warn', message, context);
    },
    error: (message, context): void => {
      log('error', message, context);
    },
  };
}

/**
 * No-op logger that discards all log messages.
 * Useful for testing or disabling logging.
 */
export const nullLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};

/**
 * Create a logger that collects log entries in an array.
 * Useful for testing.
 *
 * @returns Object with logger and collected entries
 */
export function createTestLogger(): { logger: Logger; entries: LogEntry[] } {
  const entries: LogEntry[] = [];

  const handler: LogHandler = (entry) => {
    entries.push(entry);
  };

  const logger = createLogger({
    minLevel: 'debug',
    handler,
    timestamps: true,
  });

  return { logger, entries };
}
