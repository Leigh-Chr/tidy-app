/**
 * @fileoverview Config command implementation - Story 5.3, 5.4, 10.1
 *
 * Commands:
 * - tidy config show: Display current/default configuration
 * - tidy config init: Write defaults to config file
 * - tidy config path: Show config file path
 * - tidy config reset: Reset configuration to factory defaults
 *
 * AC covered:
 * - AC4: Defaults documented in help (config show)
 * - AC5: Defaults can be exported (config init)
 * - Story 5.4: Reset configuration to defaults
 * - Story 10.1: Display LLM/Ollama configuration status
 */
import { Command } from 'commander';
import chalk from 'chalk';
import {
  loadConfig,
  saveConfig,
  getConfigPath,
  configExists,
  DEFAULT_CONFIG,
  type AppConfig,
  getOllamaStatus,
  getPresetExtensions,
  formatExtensionList,
} from '@tidy/core';
import type { CliContext } from '../index.js';
import { confirm, type ConfirmResult } from '../utils/prompts.js';
import { ExitCode } from '../utils/exit-codes.js';

// =============================================================================
// Helpers
// =============================================================================

function formatValue(value: unknown): string {
  if (typeof value === 'boolean') {
    return value ? chalk.green('true') : chalk.red('false');
  }
  return chalk.yellow(String(value));
}

function defaultHint(current: unknown, defaultValue: unknown): string {
  if (current === defaultValue) {
    return chalk.gray('(default)');
  }
  return '';
}

// =============================================================================
// Config Command
// =============================================================================

export function createConfigCommand(): Command {
  const config = new Command('config').description(
    'Manage tidy-app configuration'
  );

  // ---------------------------------------------------------------------------
  // config show
  // ---------------------------------------------------------------------------
  config
    .command('show')
    .description('Show current configuration')
    .action(async (_options, command) => {
      const context = command.parent?.parent?.opts()._context as
        | CliContext
        | undefined;
      const appConfig = context?.config ?? DEFAULT_CONFIG;
      const configPath = context?.configPath;

      console.log(chalk.bold('\nConfiguration\n'));

      if (configPath) {
        console.log(`Config file: ${chalk.cyan(configPath)}`);
      } else {
        console.log(`Config file: ${chalk.gray('(using defaults)')}`);
      }

      console.log('\n' + chalk.bold('Preferences:\n'));

      const prefs = appConfig.preferences;
      console.log(
        `  colorOutput:         ${formatValue(prefs.colorOutput)} ${defaultHint(prefs.colorOutput, DEFAULT_CONFIG.preferences.colorOutput)}`
      );
      console.log(
        `  confirmBeforeApply:  ${formatValue(prefs.confirmBeforeApply)} ${defaultHint(prefs.confirmBeforeApply, DEFAULT_CONFIG.preferences.confirmBeforeApply)}`
      );
      console.log(
        `  defaultOutputFormat: ${formatValue(prefs.defaultOutputFormat)} ${defaultHint(prefs.defaultOutputFormat, DEFAULT_CONFIG.preferences.defaultOutputFormat)}`
      );
      console.log(
        `  recursiveScan:       ${formatValue(prefs.recursiveScan)} ${defaultHint(prefs.recursiveScan, DEFAULT_CONFIG.preferences.recursiveScan)}`
      );

      console.log('\n' + chalk.bold('Templates:\n'));

      for (const template of appConfig.templates) {
        const defaultMark = template.isDefault ? chalk.green(' [default]') : '';
        console.log(`  ${chalk.cyan(template.name)}${defaultMark}`);
        console.log(`    Pattern: ${template.pattern}`);
        if (template.fileTypes?.length) {
          console.log(`    Types: ${template.fileTypes.join(', ')}`);
        }
        console.log();
      }

      // LLM/Ollama section (Story 10.1)
      console.log(chalk.bold('LLM Integration (Ollama):\n'));

      const ollama = appConfig.ollama;
      const enabledText = ollama.enabled
        ? chalk.green('enabled')
        : chalk.gray('disabled');
      console.log(
        `  enabled:  ${enabledText} ${defaultHint(ollama.enabled, DEFAULT_CONFIG.ollama.enabled)}`
      );
      console.log(
        `  baseUrl:  ${formatValue(ollama.baseUrl)} ${defaultHint(ollama.baseUrl, DEFAULT_CONFIG.ollama.baseUrl)}`
      );
      console.log(
        `  timeout:  ${formatValue(ollama.timeout + 'ms')} ${defaultHint(ollama.timeout, DEFAULT_CONFIG.ollama.timeout)}`
      );

      // Show connection status if enabled
      if (ollama.enabled) {
        const status = await getOllamaStatus(ollama);
        const statusColor = status.startsWith('Connected')
          ? chalk.green(status)
          : status === 'Disabled'
            ? chalk.gray(status)
            : chalk.yellow(status);
        console.log(`  status:   ${statusColor}`);
      }

      // Show configured models
      if (ollama.models.inference || ollama.models.embedding || ollama.models.vision) {
        console.log('\n  ' + chalk.dim('Models:'));
        if (ollama.models.inference) {
          console.log(`    inference: ${formatValue(ollama.models.inference)}`);
        }
        if (ollama.models.embedding) {
          console.log(`    embedding: ${formatValue(ollama.models.embedding)}`);
        }
        if (ollama.models.vision) {
          const visionLabel = ollama.visionEnabled ? chalk.green('(vision-capable)') : chalk.gray('(vision disabled)');
          console.log(`    vision:    ${formatValue(ollama.models.vision)} ${visionLabel}`);
        }
      }

      // Story 10.5: Show vision settings if vision model configured
      if (ollama.models.vision || ollama.visionEnabled) {
        console.log('\n  ' + chalk.dim('Vision Settings:'));
        const visionEnabledText = ollama.visionEnabled ? chalk.green('yes') : chalk.gray('no');
        console.log(`    Enabled:              ${visionEnabledText}`);
        const skipExifText = ollama.skipImagesWithExif ? 'yes' : 'no';
        console.log(`    Skip images with EXIF: ${formatValue(skipExifText)}`);
        const maxSizeMB = (ollama.maxImageSize / (1024 * 1024)).toFixed(0);
        console.log(`    Max image size:       ${formatValue(maxSizeMB + ' MB')}`);
      }

      // Story 10.4: Show file type configuration
      console.log('\n  ' + chalk.dim('File Types:'));
      const fileTypes = ollama.fileTypes;
      console.log(`    Preset:   ${formatValue(fileTypes.preset)}`);

      // Show effective extensions based on preset
      if (fileTypes.includedExtensions.length > 0) {
        console.log(`    Included: ${formatValue(formatExtensionList(fileTypes.includedExtensions))}`);
      } else {
        const presetExts = getPresetExtensions(fileTypes.preset);
        if (presetExts.length > 0) {
          console.log(`    Included: ${chalk.gray(formatExtensionList(presetExts))}`);
        } else {
          console.log(`    Included: ${chalk.gray('(none)')}`);
        }
      }

      if (fileTypes.excludedExtensions.length > 0) {
        console.log(`    Excluded: ${formatValue(formatExtensionList(fileTypes.excludedExtensions))}`);
      } else {
        console.log(`    Excluded: ${chalk.gray('(none)')}`);
      }

      const skipMetaText = fileTypes.skipWithMetadata ? 'yes' : 'no';
      console.log(`    Skip with metadata: ${formatValue(skipMetaText)}`);

      console.log();
    });

  // ---------------------------------------------------------------------------
  // config init
  // ---------------------------------------------------------------------------
  config
    .command('init')
    .description('Initialize configuration file with defaults')
    .option('-f, --force', 'Overwrite existing configuration')
    .action(async (options, command) => {
      const context = command.parent?.parent?.opts()._context as
        | CliContext
        | undefined;
      const configPath = getConfigPath({ configPath: context?.configPath });

      const exists = await configExists({ configPath });

      if (exists && !options.force) {
        console.error(
          chalk.yellow(`Configuration already exists at: ${configPath}`)
        );
        console.error(chalk.gray('Use --force to overwrite'));
        process.exit(ExitCode.ERROR);
      }

      const result = await saveConfig(DEFAULT_CONFIG, { configPath });

      if (!result.ok) {
        console.error(chalk.red(`Error: ${result.error.message}`));
        process.exit(ExitCode.ERROR);
      }

      console.log(chalk.green('Configuration initialized at:'));
      console.log(chalk.cyan(configPath));
      console.log();
      console.log(chalk.gray('Edit this file to customize your settings.'));
    });

  // ---------------------------------------------------------------------------
  // config path
  // ---------------------------------------------------------------------------
  config
    .command('path')
    .description('Show configuration file path')
    .action((_options, command) => {
      const context = command.parent?.parent?.opts()._context as
        | CliContext
        | undefined;
      const configPath = getConfigPath({ configPath: context?.configPath });

      console.log(configPath);
    });

  // ---------------------------------------------------------------------------
  // config reset (Story 5.4)
  // ---------------------------------------------------------------------------
  config
    .command('reset')
    .description('Reset configuration to factory defaults')
    .option('-f, --force', 'Skip confirmation prompt')
    .action(async (options, command) => {
      const context = command.parent?.parent?.opts()._context as
        | CliContext
        | undefined;
      const configPath = getConfigPath({ configPath: context?.configPath });

      // Check current state
      const exists = await configExists({ configPath });
      let currentConfig: AppConfig | null = null;

      if (exists) {
        const loadResult = await loadConfig({ configPath, strict: false });
        if (loadResult.ok) {
          currentConfig = loadResult.data;
        }
      }

      // Confirmation prompt (unless --force)
      if (!options.force) {
        const result = await confirmReset(currentConfig);
        if (result.cancelled) {
          if (result.reason === 'non-interactive') {
            console.error(
              chalk.red('Cannot prompt in non-interactive mode. Use --force.')
            );
            process.exit(ExitCode.ERROR);
          }
          if (result.reason === 'ctrl-c') {
            console.log(); // newline after ^C
          }
          console.log(chalk.yellow('Reset cancelled.'));
          process.exit(ExitCode.ERROR);
        }
      }

      // Perform reset
      const result = await saveConfig(DEFAULT_CONFIG, { configPath });

      if (!result.ok) {
        console.error(chalk.red(`Error: ${result.error.message}`));
        process.exit(ExitCode.ERROR);
      }

      // Report changes
      displayResetSummary(currentConfig, configPath, exists);
    });

  return config;
}

// =============================================================================
// Reset Command Helpers (Story 5.4)
// =============================================================================

async function confirmReset(currentConfig: AppConfig | null): Promise<ConfirmResult> {
  let preMessage: string | undefined;

  if (currentConfig) {
    const lines = [chalk.yellow('\nThis will reset:')];
    lines.push(`  - ${currentConfig.templates.length} template(s)`);
    lines.push(`  - All preference settings`);
    if (currentConfig.recentFolders.length > 0) {
      lines.push(`  - ${currentConfig.recentFolders.length} recent folder(s)`);
    }
    // Story 10.1: Include LLM config in reset warning
    if (currentConfig.ollama.enabled) {
      lines.push(`  - LLM/Ollama settings (currently enabled)`);
    }
    lines.push('');
    preMessage = lines.join('\n');
  }

  return confirm(chalk.bold('Reset configuration to defaults?'), {
    defaultValue: false,
    preMessage,
  });
}

interface PreferenceChange {
  key: string;
  from: unknown;
  to: unknown;
}

function getPreferenceChanges(
  previous: AppConfig['preferences']
): PreferenceChange[] {
  const changes: PreferenceChange[] = [];
  const defaults = DEFAULT_CONFIG.preferences;

  for (const key of Object.keys(defaults) as (keyof typeof defaults)[]) {
    if (previous[key] !== defaults[key]) {
      changes.push({
        key,
        from: previous[key],
        to: defaults[key],
      });
    }
  }

  return changes;
}

/**
 * Get changes between previous Ollama config and defaults.
 * Story 10.1, updated Story 10.5 for vision settings
 */
function getOllamaChanges(
  previous: AppConfig['ollama']
): PreferenceChange[] {
  const changes: PreferenceChange[] = [];
  const defaults = DEFAULT_CONFIG.ollama;

  // Check top-level ollama settings
  if (previous.enabled !== defaults.enabled) {
    changes.push({ key: 'enabled', from: previous.enabled, to: defaults.enabled });
  }
  if (previous.baseUrl !== defaults.baseUrl) {
    changes.push({ key: 'baseUrl', from: previous.baseUrl, to: defaults.baseUrl });
  }
  if (previous.timeout !== defaults.timeout) {
    changes.push({ key: 'timeout', from: previous.timeout, to: defaults.timeout });
  }

  // Check models
  if (previous.models.inference !== defaults.models.inference) {
    changes.push({
      key: 'models.inference',
      from: previous.models.inference ?? '(none)',
      to: defaults.models.inference ?? '(none)',
    });
  }
  if (previous.models.embedding !== defaults.models.embedding) {
    changes.push({
      key: 'models.embedding',
      from: previous.models.embedding ?? '(none)',
      to: defaults.models.embedding ?? '(none)',
    });
  }
  // Story 10.5: Vision model changes
  if (previous.models.vision !== defaults.models.vision) {
    changes.push({
      key: 'models.vision',
      from: previous.models.vision ?? '(none)',
      to: defaults.models.vision ?? '(none)',
    });
  }

  // Story 10.5: Vision setting changes
  if (previous.visionEnabled !== defaults.visionEnabled) {
    changes.push({ key: 'visionEnabled', from: previous.visionEnabled, to: defaults.visionEnabled });
  }
  if (previous.skipImagesWithExif !== defaults.skipImagesWithExif) {
    changes.push({ key: 'skipImagesWithExif', from: previous.skipImagesWithExif, to: defaults.skipImagesWithExif });
  }
  if (previous.maxImageSize !== defaults.maxImageSize) {
    const fromMB = (previous.maxImageSize / (1024 * 1024)).toFixed(0);
    const toMB = (defaults.maxImageSize / (1024 * 1024)).toFixed(0);
    changes.push({ key: 'maxImageSize', from: `${fromMB}MB`, to: `${toMB}MB` });
  }

  return changes;
}

function displayResetSummary(
  previousConfig: AppConfig | null,
  configPath: string,
  existed: boolean
): void {
  console.log();

  if (!existed) {
    console.log(chalk.green('Configuration initialized with defaults.'));
  } else if (previousConfig) {
    console.log(chalk.green('Configuration reset to defaults.'));
    console.log();
    console.log(chalk.bold('Changes:'));

    // Count template changes
    const defaultTemplateMap = new Map(
      DEFAULT_CONFIG.templates.map((t) => [t.name, t.pattern])
    );

    // Custom templates = templates with names not in defaults
    const customTemplates = previousConfig.templates.filter(
      (t) => !defaultTemplateMap.has(t.name)
    );

    // Modified templates = templates with default names but different patterns
    const modifiedTemplates = previousConfig.templates.filter((t) => {
      const defaultPattern = defaultTemplateMap.get(t.name);
      return defaultPattern !== undefined && defaultPattern !== t.pattern;
    });

    if (customTemplates.length > 0) {
      console.log(`  - Removed ${customTemplates.length} custom template(s)`);
    }
    if (modifiedTemplates.length > 0) {
      console.log(`  - Reset ${modifiedTemplates.length} modified template(s)`);
    }

    // List preference changes
    const prefChanges = getPreferenceChanges(previousConfig.preferences);
    for (const change of prefChanges) {
      console.log(`  - Reset ${change.key}: ${String(change.from)} -> ${String(change.to)}`);
    }

    // Recent folders
    if (previousConfig.recentFolders.length > 0) {
      console.log(
        `  - Cleared ${previousConfig.recentFolders.length} recent folder(s)`
      );
    }

    // Story 10.1: LLM config changes
    const ollamaChanges = getOllamaChanges(previousConfig.ollama);
    if (ollamaChanges.length > 0) {
      for (const change of ollamaChanges) {
        console.log(`  - Reset ollama.${change.key}: ${String(change.from)} -> ${String(change.to)}`);
      }
    }

    // If no changes detected
    if (
      customTemplates.length === 0 &&
      modifiedTemplates.length === 0 &&
      prefChanges.length === 0 &&
      previousConfig.recentFolders.length === 0 &&
      ollamaChanges.length === 0
    ) {
      console.log('  - No changes (already using defaults)');
    }
  } else {
    console.log(chalk.green('Configuration reset to defaults.'));
  }

  console.log();
  console.log(`Config file: ${chalk.cyan(configPath)}`);
}
