/**
 * AI Analysis Bar Component
 *
 * Shows AI analysis controls and status when LLM is enabled.
 * Allows users to analyze files with AI to get naming suggestions.
 */

import { useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import { AlertCircle, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAppStore, templateNeedsAi } from "@/stores/app-store";
import type { FileInfo } from "@/lib/tauri";
import { onAnalysisProgress } from "@/lib/tauri";
import { cn } from "@/lib/utils";

// Supported file extensions for AI analysis (defined outside component for referential stability)
const SUPPORTED_TEXT_EXTENSIONS = ["txt", "md", "json", "yaml", "yml", "py", "js", "ts", "tsx", "jsx", "html", "css", "xml", "csv"];
const SUPPORTED_IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp", "bmp"];

interface AiAnalysisBarProps {
  files: FileInfo[];
  disabled?: boolean;
}

export function AiAnalysisBar({ files, disabled }: AiAnalysisBarProps) {
  const {
    config,
    preview,
    aiAnalysisStatus,
    aiAnalysisProgress,
    aiSuggestions,
    lastAnalysisResult,
    aiAnalysisError,
    analyzeFilesWithAi,
    clearAiSuggestions,
    setAiAnalysisProgress,
    llmStatus,
    checkLlmHealth,
  } = useAppStore();

  const [hasCheckedHealth, setHasCheckedHealth] = useState(false);

  // Check LLM health on mount if enabled
  useEffect(() => {
    if (config?.ollama.enabled && !hasCheckedHealth) {
      checkLlmHealth();
      setHasCheckedHealth(true);
    }
  }, [config?.ollama.enabled, hasCheckedHealth, checkLlmHealth]);

  // Listen for AI analysis progress events
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    onAnalysisProgress((progress) => {
      setAiAnalysisProgress(progress);
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      unlisten?.();
    };
  }, [setAiAnalysisProgress]);

  // Check if current template uses AI placeholders
  const currentTemplateUsesAi = useMemo(() => {
    if (!config) return true; // Assume true if no config
    const defaultTemplate = config.templates?.find((t) => t.isDefault);
    const currentPattern = preview?.templateUsed ?? defaultTemplate?.pattern;
    if (!currentPattern) return true; // Assume true if no pattern
    return templateNeedsAi(currentPattern);
  }, [config, preview?.templateUsed]);

  // Check how many files can be analyzed
  const analyzableFilesInfo = useMemo(() => {
    const visionEnabled = config?.ollama.visionEnabled ?? false;
    let textCount = 0;
    let imageCount = 0;
    let unsupportedCount = 0;

    for (const file of files) {
      const ext = (file.extension || "").toLowerCase();
      if (SUPPORTED_TEXT_EXTENSIONS.includes(ext)) {
        textCount++;
      } else if (SUPPORTED_IMAGE_EXTENSIONS.includes(ext)) {
        if (visionEnabled) {
          imageCount++;
        } else {
          unsupportedCount++;
        }
      } else {
        unsupportedCount++;
      }
    }

    return {
      textCount,
      imageCount,
      unsupportedCount,
      totalAnalyzable: textCount + imageCount,
      allUnsupported: textCount + imageCount === 0 && unsupportedCount > 0,
      hasImagesWithoutVision: !visionEnabled && files.some(f => SUPPORTED_IMAGE_EXTENSIONS.includes((f.extension || "").toLowerCase())),
    };
  }, [files, config?.ollama.visionEnabled]);

  // Don't show if LLM is disabled
  if (!config?.ollama.enabled) {
    return null;
  }

  const isAnalyzing = aiAnalysisStatus === "analyzing";
  const hasResults = aiAnalysisStatus === "done" && lastAnalysisResult !== null;
  const hasSuccessfulResults = hasResults && aiSuggestions.size > 0;
  const isLlmAvailable = llmStatus === "available";

  const handleAnalyze = async () => {
    if (files.length > 0) {
      // Check if template uses AI placeholders before starting
      if (!currentTemplateUsesAi) {
        toast.info(
          "Your template uses {original} instead of {name}. AI analysis won't affect filenames. Edit your template to use {name} for smart naming.",
          { duration: 6000 }
        );
        return;
      }

      toast.info(`Analyzing ${files.length} files...`, { duration: 3000 });

      const result = await analyzeFilesWithAi(files);

      if (result.ok) {
        const { analyzed, skipped, failed, results } = result.data;

        // Check if this was skipped due to template not using AI
        if (result.data._templateSkipped) {
          toast.info(
            "Your template uses {original} instead of {name}. Edit your template to use {name} for AI-powered naming.",
            { duration: 6000 }
          );
          return;
        }

        if (analyzed > 0) {
          toast.success(
            `Analyzed ${analyzed} files - Preview updated with AI suggestions!`,
            { duration: 5000 }
          );
        } else if (skipped > 0 && failed === 0) {
          // Show more detailed message about why files were skipped
          const extensions = [...new Set(files.map(f => f.extension || 'unknown'))].join(", ");
          toast.warning(
            `All ${skipped} files were skipped. Supported types: txt, md, json, yaml, py, js, ts, etc. Images require vision model enabled. Your files: ${extensions}`,
            { duration: 8000 }
          );
        } else if (failed > 0) {
          // Get the first error message to show
          const firstError = results.find(r => r.error && !r.skipped);
          const errorMsg = firstError?.error || "Unknown error";
          toast.error(
            `Analysis failed for ${failed} files. Error: ${errorMsg}`,
            { duration: 8000 }
          );
        } else {
          toast.info("No files were analyzed", { duration: 4000 });
        }
      } else {
        toast.error(`Analysis failed: ${result.error.message}`, { duration: 5000 });
      }
    }
  };

  const handleClear = () => {
    clearAiSuggestions();
  };

  // Provider display
  const providerName = config.ollama.provider === "openai" ? "OpenAI" : "Ollama";

  return (
    <TooltipProvider>
      <div
        className={cn(
          "flex items-center gap-3 p-3 rounded-lg border transition-colors",
          hasSuccessfulResults
            ? "bg-purple-50/50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800"
            : "bg-muted/50"
        )}
        data-testid="ai-analysis-bar"
      >
        {/* AI Icon and Status - Simplified */}
        <div className="flex items-center gap-2">
          <Sparkles className={cn(
            "h-4 w-4",
            isLlmAvailable ? "text-purple-500" : "text-muted-foreground"
          )} />
          <span className="text-sm font-medium">AI</span>
          {!isLlmAvailable && llmStatus !== "checking" && (
            <span className="text-xs text-muted-foreground">(offline)</span>
          )}
          {llmStatus === "checking" && (
            <span className="text-xs text-muted-foreground animate-pulse">connecting...</span>
          )}
        </div>

        {/* Analyzing Progress */}
        {isAnalyzing && (
          <div className="flex-1 flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Progress
                value={aiAnalysisProgress?.percent ?? 0}
                className="flex-1 h-2"
              />
              <span className="text-xs text-muted-foreground whitespace-nowrap min-w-[4rem] text-right">
                {aiAnalysisProgress
                  ? `${aiAnalysisProgress.processed}/${aiAnalysisProgress.total}`
                  : "Starting..."}
              </span>
            </div>
            {aiAnalysisProgress?.currentFile && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <span className="truncate max-w-[200px]" title={aiAnalysisProgress.currentFile}>
                  {aiAnalysisProgress.currentFile.split("/").pop()}
                </span>
              </div>
            )}
          </div>
        )}

        {/* File compatibility hint - simplified, only show when relevant */}
        {!isAnalyzing && !hasResults && analyzableFilesInfo.totalAnalyzable < files.length && files.length > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-xs text-muted-foreground cursor-help">
                {analyzableFilesInfo.totalAnalyzable}/{files.length} supported
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-sm">
              <p className="text-xs">
                Supports: .txt, .md, .json, .py, .js, .ts, etc.
                {analyzableFilesInfo.hasImagesWithoutVision && " Enable Vision Model for images."}
              </p>
            </TooltipContent>
          </Tooltip>
        )}

        {/* Active AI indicator with preview - shown when AI suggestions are being used */}
        {hasSuccessfulResults && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-2 px-2 py-1 bg-purple-200 dark:bg-purple-800/50 rounded text-purple-800 dark:text-purple-200 cursor-help">
                <Check className="w-4 h-4" aria-hidden="true" />
                <span className="text-xs font-medium">Using AI suggestions ({aiSuggestions.size})</span>
              </div>
            </TooltipTrigger>
            <TooltipContent className="max-w-md p-0">
              <div className="p-3">
                <p className="font-medium mb-2 text-sm">AI Suggestions Preview</p>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {Array.from(aiSuggestions.entries())
                    .slice(0, 5)
                    .map(([path, suggestion]) => {
                      const fileName = path.split("/").pop() || path;
                      return (
                        <div key={path} className="text-xs">
                          <div className="text-muted-foreground truncate">{fileName}</div>
                          <div className="font-mono text-purple-600 dark:text-purple-400 truncate">
                            → {suggestion.suggestedName}
                          </div>
                        </div>
                      );
                    })}
                  {aiSuggestions.size > 5 && (
                    <div className="text-xs text-muted-foreground pt-1">
                      ... and {aiSuggestions.size - 5} more
                    </div>
                  )}
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        )}

        {/* Results Summary - Simplified */}
        {hasResults && lastAnalysisResult && !hasSuccessfulResults && (
          <span className="text-xs text-muted-foreground">
            {lastAnalysisResult.analyzed > 0
              ? `${lastAnalysisResult.analyzed} analyzed`
              : lastAnalysisResult.skipped > 0
                ? `${lastAnalysisResult.skipped} skipped (unsupported)`
                : `${lastAnalysisResult.failed} failed`
            }
          </span>
        )}

        {/* Error */}
        {aiAnalysisStatus === "error" && aiAnalysisError && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="destructive" className="cursor-help">
                Error
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p className="max-w-xs">{aiAnalysisError}</p>
            </TooltipContent>
          </Tooltip>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Actions */}
        <div className="flex items-center gap-2">
          {hasSuccessfulResults && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClear}
                  disabled={isAnalyzing}
                  data-testid="clear-ai-analysis"
                >
                  Use Template Names
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Remove AI suggestions and use template-based names</p>
              </TooltipContent>
            </Tooltip>
          )}
          {hasResults && !hasSuccessfulResults && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              disabled={isAnalyzing}
              data-testid="clear-ai-analysis"
            >
              Clear
            </Button>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex items-center gap-1">
                {!currentTemplateUsesAi && (
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                )}
                <Button
                  variant={hasResults ? "ghost" : "secondary"}
                  size="sm"
                  onClick={handleAnalyze}
                  disabled={disabled || isAnalyzing || !isLlmAvailable || files.length === 0}
                  data-testid="analyze-with-ai"
                >
                  {isAnalyzing ? (
                    <>
                      <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Analyzing...
                    </>
                  ) : hasResults ? (
                    "Re-analyze"
                  ) : (
                    "Analyze with AI"
                  )}
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {!isLlmAvailable ? (
                <p>{providerName} is not available. Check your settings.</p>
              ) : !currentTemplateUsesAi ? (
                <div className="max-w-xs">
                  <p className="font-medium text-amber-600">Template will not use AI names</p>
                  <p className="text-xs mt-1">
                    Your template uses {"{original}"} which ignores AI suggestions.
                    Use {"{name}"} to enable smart AI naming.
                  </p>
                </div>
              ) : null}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
}
