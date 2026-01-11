/**
 * @fileoverview Info command implementation - Story 10.1, 10.6
 *
 * Commands:
 * - tidy info: Display application information and LLM status
 *
 * AC5: LLM status shown when running `tidy info`
 * - Shows enabled/disabled status
 * - Shows connected/disconnected status when enabled
 * - Shows configured base URL and timeout
 *
 * Story 10.6: Offline Mode Support
 * - Shows offline mode status (auto/enabled/disabled)
 * - Displays clear "Offline Mode" indicator when LLM unavailable
 * - Provides actionable suggestions for enabling LLM
 */
import { Command } from 'commander';
import chalk from 'chalk';
import {
  VERSION,
  DEFAULT_CONFIG,
  getOllamaStatus,
  getOllamaHealthReport,
  checkLlmAvailabilityForOperation,
  formatOfflineStatus,
} from '@tidy/core';
import type { CliContext } from '../index.js';

// =============================================================================
// Info Command
// =============================================================================

export function createInfoCommand(): Command {
  const info = new Command('info')
    .description('Display information about tidy-app and LLM status')
    .option('-v, --verbose', 'Show detailed LLM connection information')
    .action(async (options, command) => {
      const context = command.parent?.opts()._context as CliContext | undefined;
      const appConfig = context?.config ?? DEFAULT_CONFIG;

      // Header
      console.log();
      console.log(chalk.blue.bold('tidy-app') + ` v${VERSION}`);
      console.log(chalk.gray('Intelligent file organization tool'));
      console.log();

      // Configuration status
      if (context?.configPath) {
        console.log(`Config: ${chalk.cyan(context.configPath)}`);
      } else {
        console.log(`Config: ${chalk.gray('(using defaults)')}`);
      }
      console.log();

      // LLM Integration section (AC5)
      console.log(chalk.bold('LLM Integration (Ollama):'));
      console.log();

      const ollama = appConfig.ollama;
      const enabledText = ollama.enabled
        ? chalk.green('enabled')
        : chalk.gray('disabled');

      console.log(`  Status:   ${enabledText}`);
      console.log(`  Base URL: ${chalk.yellow(ollama.baseUrl)}`);
      console.log(`  Timeout:  ${chalk.yellow(ollama.timeout + 'ms')}`);

      // Story 10.6: Show offline mode status
      const offlineMode = 'offlineMode' in ollama
        ? (ollama as { offlineMode?: string }).offlineMode ?? 'auto'
        : 'auto';
      const offlineModeText = offlineMode === 'enabled'
        ? chalk.yellow('enabled (LLM disabled)')
        : offlineMode === 'disabled'
          ? chalk.cyan('disabled (LLM required)')
          : chalk.gray('auto (graceful degradation)');

      console.log(`  Offline:    ${offlineModeText}`);

      // Show connection status if enabled
      if (ollama.enabled) {
        console.log();
        console.log(chalk.dim('  Checking connection...'));

        // Story 10.6: Use the new availability check
        const availability = await checkLlmAvailabilityForOperation(ollama);

        // Clear the "Checking connection..." line
        process.stdout.write('\x1b[1A\x1b[2K');

        if (options.verbose) {
          // Detailed status using formatOfflineStatus
          const statusLines = formatOfflineStatus(availability);
          for (const line of statusLines) {
            // Parse the line to add colors
            if (line.startsWith('Mode:')) {
              const mode = line.includes('Connected')
                ? chalk.green('Connected')
                : chalk.yellow('Offline (LLM not available)');
              console.log(`  Mode:       ${mode}`);
            } else if (line.startsWith('Status:') || line.startsWith('Reason:')) {
              const [label, ...rest] = line.split(':');
              const value = rest.join(':').trim();
              console.log(`  ${label.trim()}:${' '.repeat(10 - label.trim().length)}${chalk.gray(value)}`);
            } else if (line.startsWith('Response time:')) {
              const time = line.replace('Response time:', '').trim();
              console.log(`  Response:   ${chalk.gray(time)}`);
            } else if (line.startsWith('Suggestion:')) {
              console.log(`  Suggestion: ${chalk.cyan(line.replace('Suggestion:', '').trim())}`);
            }
          }
        } else {
          // Simple status check
          if (availability.available) {
            console.log(`  Connection: ${chalk.green('Connected')}`);
            if (availability.responseTimeMs !== undefined) {
              console.log(`  Response:   ${chalk.gray(availability.responseTimeMs + 'ms')}`);
            }
          } else {
            console.log(`  Connection: ${chalk.yellow('Offline')}`);
            console.log(`  Reason:     ${chalk.gray(availability.reason)}`);
            if (availability.suggestion) {
              console.log(`  Suggestion: ${chalk.cyan(availability.suggestion)}`);
            }
          }
        }

        // Show configured models
        if (ollama.models?.inference || ollama.models?.embedding) {
          console.log();
          console.log(chalk.dim('  Configured Models:'));
          if (ollama.models.inference) {
            console.log(`    Inference: ${chalk.yellow(ollama.models.inference)}`);
          }
          if (ollama.models.embedding) {
            console.log(`    Embedding: ${chalk.yellow(ollama.models.embedding)}`);
          }
          if ((ollama as { visionEnabled?: boolean }).visionEnabled && ollama.models?.vision) {
            console.log(`    Vision:    ${chalk.yellow(ollama.models.vision)}`);
          }
        }
      } else {
        console.log();
        console.log(chalk.gray('  Enable with: Edit config and set ollama.enabled = true'));
      }

      console.log();

      // Quick help
      console.log(chalk.bold('Quick Commands:'));
      console.log(`  ${chalk.cyan('tidy scan <folder>')}    Scan and preview files`);
      console.log(`  ${chalk.cyan('tidy config show')}      View full configuration`);
      console.log(`  ${chalk.cyan('tidy history')}          View operation history`);
      console.log();
    });

  return info;
}
