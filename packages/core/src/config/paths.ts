/**
 * @fileoverview Config path resolution - Story 5.2
 *
 * Provides path resolution for configuration files with precedence:
 * 1. Custom path (--config argument)
 * 2. TIDY_CONFIG environment variable
 * 3. Default OS-appropriate location via env-paths
 *
 * AC covered:
 * - AC3: Relative and absolute paths supported
 * - AC5: Environment variable support
 */
import { resolve, isAbsolute } from 'node:path';
import envPaths from 'env-paths';

// Get OS-appropriate paths for tidy-app (no suffix for cleaner paths)
const paths = envPaths('tidy-app', { suffix: '' });

// =============================================================================
// Types
// =============================================================================

/**
 * Options for resolving config path.
 */
export interface ResolveConfigPathOptions {
  /** Custom config file path (--config argument) */
  customPath?: string;
  /** Current working directory for resolving relative paths */
  cwd?: string;
}

// =============================================================================
// Path Resolution Functions
// =============================================================================

/**
 * Resolve config path with precedence:
 * 1. customPath parameter (--config argument)
 * 2. TIDY_CONFIG environment variable
 * 3. Default path from env-paths
 *
 * Relative paths are resolved against the provided cwd (or process.cwd()).
 *
 * @param options - Resolution options
 * @returns Absolute path to config file
 *
 * @example
 * ```typescript
 * // With --config argument
 * resolveConfigPath({ customPath: './project.json' })
 *
 * // With env var set
 * process.env.TIDY_CONFIG = './env-config.json';
 * resolveConfigPath() // Uses env var
 *
 * // Default
 * resolveConfigPath() // ~/.config/tidy-app/config.json
 * ```
 */
export function resolveConfigPath(options?: ResolveConfigPathOptions): string {
  const { customPath, cwd = process.cwd() } = options ?? {};

  // Priority 1: Explicit custom path (--config argument)
  if (customPath) {
    return isAbsolute(customPath) ? customPath : resolve(cwd, customPath);
  }

  // Priority 2: Environment variable
  const envPath = process.env["TIDY_CONFIG"];
  if (envPath) {
    return isAbsolute(envPath) ? envPath : resolve(cwd, envPath);
  }

  // Priority 3: Default location from env-paths
  return resolve(paths.config, 'config.json');
}

/**
 * Get the default configuration directory path.
 *
 * Returns the OS-appropriate config directory:
 * - macOS: ~/Library/Application Support/tidy-app/
 * - Windows: %APPDATA%/tidy-app/
 * - Linux: ~/.config/tidy-app/
 *
 * @returns Absolute path to config directory
 */
export function getDefaultConfigDir(): string {
  return paths.config;
}
