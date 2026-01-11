/**
 * @fileoverview Analyze command implementation
 *
 * Commands:
 * - tidy analyze [folder]: Get AI-powered naming suggestions
 *
 * Features:
 * - Analyzes files using local LLM (Ollama)
 * - Vision model support for images
 * - Batch analysis with progress reporting
 * - Offline mode handling
 */
import { Command } from 'commander';
import chalk from 'chalk';
import {
  scanFolder,
  checkLlmAvailabilityForOperation,
  analyzeFilesWithFilter,
  analyzeImageWithVision,
  isImageFile,
  formatOfflineStatus,
  checkVisionModelAvailable,
  type ScanOptions,
  type FileInfo,
} from '@tidy/core';
import type { CliContext } from '../index.js';
import { getFolderToScan } from '../utils/path.js';
import {
  formatAnalyzeTable,
  formatAnalyzeJson,
  formatAnalyzePlain,
  formatAnalyzeSummary,
} from '../utils/analyze-format.js';
import { shouldUseColor, configureColors } from '../utils/output.js';
import { ExitCode } from '../utils/exit-codes.js';
import { createProgressReporter, createSpinner } from '../utils/progress.js';

export type AnalyzeOutputFormat = 'table' | 'json' | 'plain';

export interface AnalyzeCommandOptions {
  format: AnalyzeOutputFormat;
  recursive: boolean;
  extensions?: string;
  types?: string;
  vision: boolean;
  limit?: string;
  color: boolean;
  verbose: boolean;
}

/**
 * Create the analyze command.
 */
export function createAnalyzeCommand(): Command {
  const analyze = new Command('analyze');

  analyze
    .description('Get AI-powered naming suggestions for files')
    .argument('[folder]', 'Folder to analyze (defaults to current directory)')
    .option('-f, --format <type>', 'Output format: table, json, plain', 'table')
    .option('-r, --recursive', 'Scan subfolders recursively', false)
    .option('-e, --extensions <list>', 'Filter by extensions (comma-separated)')
    .option('-T, --types <list>', 'Filter by type: images, documents, code, all', 'all')
    .option('--vision', 'Use vision model for image analysis', false)
    .option('-l, --limit <n>', 'Maximum number of files to analyze')
    .option('--no-color', 'Disable colored output')
    .option('-v, --verbose', 'Show detailed progress information', false)
    .addHelpText(
      'after',
      `
Output Formats:
  ${chalk.cyan('table')}   Human-readable table with suggestions (default)
  ${chalk.cyan('json')}    Valid JSON with full analysis results (for scripting)
  ${chalk.cyan('plain')}   Simple list of suggestions

File Types:
  ${chalk.cyan('images')}      JPG, PNG, GIF, WebP, HEIC, etc.
  ${chalk.cyan('documents')}   PDF, DOCX, XLSX, TXT, etc.
  ${chalk.cyan('code')}        JS, TS, PY, etc.
  ${chalk.cyan('all')}         All supported file types (default)

Examples:
  ${chalk.gray('# Analyze files in current directory')}
  $ tidy analyze

  ${chalk.gray('# Analyze images with vision model')}
  $ tidy analyze ~/Photos --vision

  ${chalk.gray('# Analyze only documents')}
  $ tidy analyze ~/Documents --types documents

  ${chalk.gray('# Analyze with limit')}
  $ tidy analyze ~/Downloads --limit 20

  ${chalk.gray('# Get JSON output')}
  $ tidy analyze ~/Downloads --format json

  ${chalk.gray('# Analyze recursively with progress')}
  $ tidy analyze ~/Projects --recursive --verbose

Requirements:
  - Ollama must be installed and running
  - LLM must be enabled in config (ollama.enabled = true)
  - For --vision: A vision-capable model must be configured

Related Commands:
  ${chalk.cyan('tidy info')}      Check LLM status and configuration
  ${chalk.cyan('tidy preview')}   Preview renames (can use AI suggestions)
`
    )
    .action(async (folder: string | undefined, options: AnalyzeCommandOptions, command) => {
      // Validate format
      const validFormats: AnalyzeOutputFormat[] = ['table', 'json', 'plain'];
      if (!validFormats.includes(options.format)) {
        console.error(chalk.red(`Error: Invalid format '${options.format}'`));
        console.error(`Valid formats: ${validFormats.join(', ')}`);
        process.exit(ExitCode.ERROR);
      }

      // Configure colors
      const useColor = shouldUseColor({ noColor: !options.color });
      configureColors(useColor);

      // Get context
      const context = command.parent?.opts()._context as CliContext | undefined;

      await executeAnalyze(folder, options, context, useColor);
    });

  return analyze;
}

/**
 * Execute the analyze operation.
 */
async function executeAnalyze(
  folder: string | undefined,
  options: AnalyzeCommandOptions,
  context: CliContext | undefined,
  useColor: boolean
): Promise<void> {
  // Resolve folder
  const folderResult = await getFolderToScan(folder);
  if (!folderResult.ok) {
    console.error(chalk.red(`Error: ${folderResult.error.message}`));
    process.exit(ExitCode.ERROR);
  }

  const { path: folderPath, isDefault } = folderResult.data;

  // Get config
  const config = context?.config;
  if (!config) {
    console.error(chalk.red('Error: Configuration not loaded'));
    process.exit(ExitCode.ERROR);
  }

  const ollamaConfig = config.ollama;

  // Check if LLM is enabled
  if (!ollamaConfig.enabled) {
    console.error(chalk.red('Error: LLM analysis is disabled'));
    console.error(chalk.gray('Enable it with: Edit config and set ollama.enabled = true'));
    console.error(chalk.gray('Check status with: tidy info'));
    process.exit(ExitCode.ERROR);
  }

  // Show status message
  if (options.format === 'table') {
    if (isDefault) {
      console.log(chalk.gray(`Analyzing files in current directory: ${folderPath}`));
    } else {
      console.log(chalk.gray(`Analyzing files in: ${folderPath}`));
    }
    console.log();
  }

  // Check LLM availability
  const spinner = createSpinner();
  if (options.verbose && options.format === 'table') {
    spinner.start('Checking LLM availability');
  }

  const availability = await checkLlmAvailabilityForOperation(ollamaConfig);

  if (!availability.available) {
    spinner.stop();
    console.error(chalk.red('Error: LLM is not available'));
    const statusLines = formatOfflineStatus(availability);
    for (const line of statusLines) {
      console.error(chalk.gray(`  ${line}`));
    }
    process.exit(ExitCode.ERROR);
  }

  // Check vision model if requested
  if (options.vision) {
    const visionCheck = checkVisionModelAvailable(
      [], // We'd need to list models, but for now just check config
      ollamaConfig.models?.vision
    );
    if (!visionCheck.available && options.verbose) {
      console.log(chalk.yellow(`Warning: Vision model may not be available. Configured: ${ollamaConfig.models?.vision || 'none'}`));
    }
  }

  spinner.succeed('LLM connected');

  // Scan folder
  if (options.verbose && options.format === 'table') {
    spinner.start('Scanning folder');
  }

  const scanOptions: ScanOptions = {
    recursive: options.recursive,
  };

  const scanResult = await scanFolder(folderPath, scanOptions);
  if (!scanResult.ok) {
    spinner.stop();
    console.error(chalk.red(`Error: ${scanResult.error.message}`));
    process.exit(ExitCode.ERROR);
  }

  let files = scanResult.data;
  spinner.stop();

  // Filter by extensions if specified
  if (options.extensions) {
    const exts = options.extensions.split(',').map((e) => e.trim().toLowerCase().replace(/^\./, ''));
    files = files.filter((f) => f.extension && exts.includes(f.extension.toLowerCase()));
  }

  // Filter by types if specified
  if (options.types && options.types !== 'all') {
    const types = options.types.split(',').map((t) => t.trim().toLowerCase());
    files = filterByTypes(files, types);
  }

  // Apply limit
  const limit = options.limit ? parseInt(options.limit, 10) : undefined;
  if (limit && !isNaN(limit) && limit > 0) {
    files = files.slice(0, limit);
  }

  if (files.length === 0) {
    if (options.format === 'json') {
      console.log(JSON.stringify({ results: [], summary: { total: 0, analyzed: 0, skipped: 0 } }, null, 2));
    } else if (options.format !== 'plain') {
      console.log(chalk.yellow('No files found to analyze.'));
    }
    process.exit(ExitCode.SUCCESS);
  }

  // Show file count
  if (options.format === 'table') {
    console.log(`Found ${files.length} file${files.length > 1 ? 's' : ''} to analyze`);
    console.log();
  }

  // Analyze files
  const progress = options.verbose && options.format === 'table' ? createProgressReporter() : null;

  const results: AnalysisResultWithPath[] = [];
  let analyzed = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];

    if (progress) {
      progress.update('analyzing', i + 1, files.length);
    }

    try {
      // Use vision model for images if requested
      const useVision = options.vision && isImageFile(file.path);

      if (useVision) {
        const visionResult = await analyzeImageWithVision(
          file.path,
          ollamaConfig,
          ollamaConfig.models?.vision || 'llava'
        );

        if (visionResult.ok && visionResult.data) {
          results.push({
            filePath: file.path,
            fileName: file.fullName,
            suggestion: visionResult.data,
            source: 'vision',
          });
          analyzed++;
        } else {
          results.push({
            filePath: file.path,
            fileName: file.fullName,
            error: visionResult.ok ? 'No suggestion' : visionResult.error.message,
            source: 'vision',
          });
          errors++;
        }
      } else {
        // Use text analysis
        const analysisResult = await analyzeFilesWithFilter(
          [file.path],
          ollamaConfig,
          { preset: 'all' }
        );

        if (analysisResult.ok && analysisResult.data.results.length > 0) {
          const result = analysisResult.data.results[0];
          if (result.analyzed && result.suggestion) {
            results.push({
              filePath: file.path,
              fileName: file.fullName,
              suggestion: result.suggestion,
              source: 'inference',
            });
            analyzed++;
          } else {
            results.push({
              filePath: file.path,
              fileName: file.fullName,
              skipped: true,
              skipReason: result.skipReason || 'Not analyzable',
              source: 'inference',
            });
            skipped++;
          }
        } else {
          results.push({
            filePath: file.path,
            fileName: file.fullName,
            error: analysisResult.ok ? 'No result' : analysisResult.error.message,
            source: 'inference',
          });
          errors++;
        }
      }
    } catch (err) {
      results.push({
        filePath: file.path,
        fileName: file.fullName,
        error: err instanceof Error ? err.message : 'Unknown error',
        source: 'error',
      });
      errors++;
    }
  }

  if (progress) {
    progress.clear();
  }

  // Create summary
  const summary = {
    total: files.length,
    analyzed,
    skipped,
    errors,
  };

  // Output results
  switch (options.format) {
    case 'json':
      console.log(formatAnalyzeJson(results, summary));
      break;
    case 'plain':
      console.log(formatAnalyzePlain(results));
      break;
    case 'table':
    default:
      console.log(formatAnalyzeTable(results, { color: useColor }));
      console.log();
      console.log(formatAnalyzeSummary(summary, { color: useColor }));
      break;
  }

  // Exit code
  if (errors > 0 && analyzed === 0) {
    process.exit(ExitCode.ERROR);
  } else if (errors > 0) {
    process.exit(ExitCode.WARNING);
  } else {
    process.exit(ExitCode.SUCCESS);
  }
}

/**
 * Filter files by type categories.
 */
function filterByTypes(files: FileInfo[], types: string[]): FileInfo[] {
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'bmp', 'tiff', 'svg'];
  const documentExts = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'rtf', 'odt', 'ods', 'odp'];
  const codeExts = ['js', 'ts', 'jsx', 'tsx', 'py', 'rb', 'go', 'rs', 'java', 'c', 'cpp', 'h', 'cs', 'php'];

  return files.filter((f) => {
    if (!f.extension) return false;
    const ext = f.extension.toLowerCase();

    for (const type of types) {
      if (type === 'images' && imageExts.includes(ext)) return true;
      if (type === 'documents' && documentExts.includes(ext)) return true;
      if (type === 'code' && codeExts.includes(ext)) return true;
    }
    return false;
  });
}

/**
 * Analysis result with file path context.
 */
interface AnalysisResultWithPath {
  filePath: string;
  fileName: string;
  suggestion?: {
    suggestedName: string;
    confidence: number;
    reasoning?: string;
    keywords?: string[];
  };
  skipped?: boolean;
  skipReason?: string;
  error?: string;
  source: string;
}

// Export for formatter
export type { AnalysisResultWithPath };
