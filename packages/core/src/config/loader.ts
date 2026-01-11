/**
 * @fileoverview Configuration loader implementation - Story 5.1
 *
 * Provides functions for loading and saving application configuration
 * with cross-platform support via env-paths.
 *
 * AC covered:
 * - AC1: Save configuration to standard location (~/.config/tidy-app/config.json)
 * - AC2: Auto-load configuration on startup
 * - AC3: Handle invalid configuration gracefully (returns defaults)
 * - AC4: Handle missing configuration directory (creates automatically)
 * - AC5: Cross-platform config location (via env-paths)
 */
import { readFile, writeFile, mkdir, access, constants } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import envPaths from 'env-paths';
import { ok, err, type Result } from '../types/result.js';
import { appConfigSchema, DEFAULT_CONFIG, type AppConfig } from './schema.js';

// Get OS-appropriate paths for tidy-app (no suffix for cleaner paths)
const paths = envPaths('tidy-app', { suffix: '' });

// =============================================================================
// Types
// =============================================================================

/**
 * Options for config operations.
 */
export interface ConfigOptions {
  /** Custom config file path (overrides default location) */
  configPath?: string;
}

/**
 * Options for loading configuration.
 */
export interface LoadConfigOptions extends ConfigOptions {
  /**
   * When true, require the file to exist and be valid (for custom paths).
   * When false, return defaults if file doesn't exist or is invalid.
   * Defaults to true when configPath is provided, false otherwise.
   */
  strict?: boolean;
}

// =============================================================================
// Path Functions (AC5)
// =============================================================================

/**
 * Get the path to the configuration file.
 *
 * Uses env-paths for cross-platform support:
 * - macOS: ~/Library/Application Support/tidy-app/config.json
 * - Windows: %APPDATA%/tidy-app/config.json
 * - Linux: ~/.config/tidy-app/config.json
 *
 * @param options - Optional custom path
 * @returns Path to config file
 */
export function getConfigPath(options?: ConfigOptions): string {
  if (options?.configPath) {
    return options.configPath;
  }
  return join(paths.config, 'config.json');
}

// =============================================================================
// Load Function (AC2, AC3)
// =============================================================================

/**
 * Load application configuration from disk.
 *
 * Behavior (non-strict mode, default for default path):
 * - If file doesn't exist: returns DEFAULT_CONFIG
 * - If file contains invalid JSON: logs warning, returns DEFAULT_CONFIG
 * - If file fails schema validation: logs warning, returns DEFAULT_CONFIG
 * - If file is valid: returns parsed and validated config
 *
 * Behavior (strict mode, default for custom path):
 * - If file doesn't exist: returns error
 * - If file contains invalid JSON: returns error
 * - If file fails schema validation: returns error
 * - If file is valid: returns parsed and validated config
 *
 * @param options - Optional custom path and strict mode
 * @returns Result with AppConfig
 *
 * @example
 * ```typescript
 * // Default behavior - returns defaults on error
 * const result = await loadConfig();
 *
 * // Strict mode - returns error if file missing/invalid
 * const result = await loadConfig({ configPath: './custom.json' });
 * ```
 */
export async function loadConfig(
  options?: LoadConfigOptions
): Promise<Result<AppConfig, Error>> {
  const configPath = getConfigPath(options);
  // Custom paths are strict by default (user explicitly asked for this file)
  const strict = options?.strict ?? !!options?.configPath;

  try {
    // Check if file exists
    await access(configPath, constants.R_OK);

    // Read file content
    const content = await readFile(configPath, 'utf-8');

    // Handle empty file
    if (!content.trim()) {
      return ok(DEFAULT_CONFIG);
    }

    // Parse JSON
    let rawConfig: unknown;
    try {
      rawConfig = JSON.parse(content);
    } catch {
      if (strict) {
        return err(new Error(`Invalid JSON in config file: ${configPath}`));
      }
      // Invalid JSON - return defaults
      console.warn(`Invalid JSON in config file: ${configPath}`);
      console.warn('Using default configuration');
      return ok(DEFAULT_CONFIG);
    }

    // Validate against schema
    const parseResult = appConfigSchema.safeParse(rawConfig);

    if (!parseResult.success) {
      if (strict) {
        return err(new Error(`Invalid config at ${configPath}: ${parseResult.error.message}`));
      }
      console.warn(`Invalid config at ${configPath}:`, parseResult.error.message);
      console.warn('Using default configuration');
      return ok(DEFAULT_CONFIG);
    }

    return ok(parseResult.data);
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;

    // File doesn't exist
    if (nodeError.code === 'ENOENT') {
      if (strict) {
        return err(new Error(`Config file not found: ${configPath}`));
      }
      return ok(DEFAULT_CONFIG);
    }

    // Permission denied
    if (nodeError.code === 'EACCES') {
      if (strict) {
        return err(new Error(`Permission denied reading config: ${configPath}`));
      }
      console.warn(`Permission denied reading config: ${configPath}`);
      console.warn('Using default configuration');
      return ok(DEFAULT_CONFIG);
    }

    // Other filesystem errors
    return err(new Error(`Failed to load config: ${nodeError.message}`));
  }
}

// =============================================================================
// Save Function (AC1, AC4)
// =============================================================================

/**
 * Save application configuration to disk.
 *
 * Behavior:
 * - Validates config against schema before saving
 * - Creates parent directories if they don't exist (AC4)
 * - Sets appropriate file permissions (600 on Unix)
 * - Writes formatted JSON for readability
 *
 * @param config - Configuration to save
 * @param options - Optional custom path
 * @returns Result indicating success or failure
 *
 * @example
 * ```typescript
 * const result = await saveConfig({
 *   ...config,
 *   preferences: { ...config.preferences, colorOutput: false }
 * });
 * if (!result.ok) {
 *   console.error('Failed to save:', result.error);
 * }
 * ```
 */
export async function saveConfig(
  config: AppConfig,
  options?: ConfigOptions
): Promise<Result<void, Error>> {
  const configPath = getConfigPath(options);

  try {
    // Validate config before saving
    const parseResult = appConfigSchema.safeParse(config);
    if (!parseResult.success) {
      return err(new Error(`Invalid config: ${parseResult.error.message}`));
    }

    // Create directory if it doesn't exist (AC4)
    const configDir = dirname(configPath);
    await mkdir(configDir, { recursive: true, mode: 0o700 });

    // Write config with pretty formatting
    const content = JSON.stringify(parseResult.data, null, 2);
    await writeFile(configPath, content, { encoding: 'utf-8', mode: 0o600 });

    return ok(undefined);
  } catch (error) {
    return err(new Error(`Failed to save config: ${(error as Error).message}`));
  }
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Check if a configuration file exists.
 *
 * @param options - Optional custom path
 * @returns true if config file exists, false otherwise
 */
export async function configExists(options?: ConfigOptions): Promise<boolean> {
  try {
    await access(getConfigPath(options), constants.F_OK);
    return true;
  } catch {
    return false;
  }
}
