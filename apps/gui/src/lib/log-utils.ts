/**
 * Logging Utilities (SEC-007)
 *
 * Provides secure logging with automatic redaction of sensitive data.
 * Prevents accidental exposure of API keys, paths, and other sensitive info.
 */

/**
 * Patterns that indicate sensitive data that should be redacted.
 */
const SENSITIVE_PATTERNS = [
  // API keys
  /sk-[a-zA-Z0-9]{20,}/g, // OpenAI API keys
  /sk-proj-[a-zA-Z0-9-_]{20,}/g, // OpenAI project keys
  /Bearer\s+[a-zA-Z0-9._-]+/gi, // Authorization headers

  // Generic secrets
  /api[_-]?key['":\s]*[a-zA-Z0-9._-]{16,}/gi,
  /secret['":\s]*[a-zA-Z0-9._-]{16,}/gi,
  /password['":\s]*[^\s"']+/gi,
  /token['":\s]*[a-zA-Z0-9._-]{16,}/gi,

  // Base64 encoded secrets (long base64 strings)
  /[A-Za-z0-9+/]{40,}={0,2}/g,
];

/**
 * Words that should trigger path redaction
 */
const SENSITIVE_PATH_SEGMENTS = [
  "password",
  "secret",
  "private",
  "credentials",
  ".ssh",
  ".gnupg",
  ".env",
];

/**
 * Redact sensitive information from a string.
 *
 * @param input - The string to redact
 * @returns The string with sensitive data replaced by [REDACTED]
 *
 * @example
 * ```typescript
 * const safe = redactSensitive("API key: sk-abc123...");
 * // Returns: "API key: [REDACTED]"
 * ```
 */
export function redactSensitive(input: string): string {
  let result = input;

  // Redact known sensitive patterns
  for (const pattern of SENSITIVE_PATTERNS) {
    result = result.replace(pattern, "[REDACTED]");
  }

  return result;
}

/**
 * Redact file paths that may contain sensitive information.
 *
 * @param path - The file path to redact
 * @returns The path with sensitive segments replaced
 *
 * @example
 * ```typescript
 * const safe = redactPath("/home/user/.ssh/id_rsa");
 * // Returns: "/home/user/[REDACTED]/[REDACTED]"
 * ```
 */
export function redactPath(path: string): string {
  const segments = path.split(/[/\\]/);
  const redactedSegments = segments.map((segment) => {
    const lower = segment.toLowerCase();
    if (SENSITIVE_PATH_SEGMENTS.some((s) => lower.includes(s))) {
      return "[REDACTED]";
    }
    return segment;
  });
  return redactedSegments.join("/");
}

/**
 * Secure console wrapper that automatically redacts sensitive data.
 *
 * @example
 * ```typescript
 * secureLog.info("Processing file:", path);
 * secureLog.error("API error:", error);
 * secureLog.warn("Config issue:", config);
 * ```
 */
export const secureLog = {
  /**
   * Log an info message with redaction
   */
  info: (...args: unknown[]) => {
    const safeArgs = args.map((arg) =>
      typeof arg === "string" ? redactSensitive(arg) : arg
    );
    console.info(...safeArgs);
  },

  /**
   * Log a warning with redaction
   */
  warn: (...args: unknown[]) => {
    const safeArgs = args.map((arg) =>
      typeof arg === "string" ? redactSensitive(arg) : arg
    );
    console.warn(...safeArgs);
  },

  /**
   * Log an error with redaction
   */
  error: (...args: unknown[]) => {
    const safeArgs = args.map((arg) =>
      typeof arg === "string" ? redactSensitive(arg) : arg
    );
    console.error(...safeArgs);
  },

  /**
   * Log a debug message with redaction (only in development)
   */
  debug: (...args: unknown[]) => {
    if (import.meta.env.DEV) {
      const safeArgs = args.map((arg) =>
        typeof arg === "string" ? redactSensitive(arg) : arg
      );
      console.debug(...safeArgs);
    }
  },
};

/**
 * Redact sensitive fields from an object for safe logging.
 * Creates a shallow copy with sensitive values replaced.
 *
 * @param obj - The object to redact
 * @param sensitiveKeys - Keys to redact (default: common sensitive keys)
 * @returns A new object with sensitive values redacted
 *
 * @example
 * ```typescript
 * const config = { apiKey: "sk-123", baseUrl: "https://api.com" };
 * const safe = redactObject(config);
 * // Returns: { apiKey: "[REDACTED]", baseUrl: "https://api.com" }
 * ```
 */
export function redactObject<T extends Record<string, unknown>>(
  obj: T,
  sensitiveKeys: string[] = [
    "apiKey",
    "api_key",
    "apikey",
    "secret",
    "password",
    "token",
    "authorization",
    "auth",
    "key",
    "credential",
    "credentials",
  ]
): T {
  const result = { ...obj };

  for (const key of Object.keys(result)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.some((sk) => lowerKey.includes(sk.toLowerCase()))) {
      (result as Record<string, unknown>)[key] = "[REDACTED]";
    } else if (typeof result[key] === "string") {
      (result as Record<string, unknown>)[key] = redactSensitive(
        result[key] as string
      );
    }
  }

  return result;
}
