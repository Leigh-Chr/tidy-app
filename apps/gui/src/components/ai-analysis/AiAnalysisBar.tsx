/**
 * AI Analysis Bar Component
 *
 * Shows AI analysis controls and status when LLM is enabled.
 * Allows users to analyze files with AI to get naming suggestions.
 */

import { useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import { AlertCircle, Check } from "lucide-react";
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

interface AiAnalysisBarProps {
  files: FileInfo[];
  disabled?: boolean;
}

export function AiAnalysisBar({ files, disabled }: AiAnalysisBarProps) {
  const {
    config,
    preview,
    aiAnalysisStatus,
    aiSuggestions,
    lastAnalysisResult,
    aiAnalysisError,
    analyzeFilesWithAi,
    clearAiSuggestions,
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

  // Check if current template uses AI placeholders
  const currentTemplateUsesAi = useMemo(() => {
    if (!config) return true; // Assume true if no config
    const defaultTemplate = config.templates?.find((t) => t.isDefault);
    const currentPattern = preview?.templateUsed ?? defaultTemplate?.pattern;
    if (!currentPattern) return true; // Assume true if no pattern
    return templateNeedsAi(currentPattern);
  }, [config, preview?.templateUsed]);

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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
        if ((result.data as any)._templateSkipped) {
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
    <div
      className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border"
      data-testid="ai-analysis-bar"
    >
      {/* AI Icon and Status */}
      <div className="flex items-center gap-2">
        <div
          className={`w-2 h-2 rounded-full ${
            isLlmAvailable ? "bg-green-500" : llmStatus === "checking" ? "bg-yellow-500 animate-pulse" : "bg-gray-400"
          }`}
        />
        <span className="text-sm font-medium">AI Analysis</span>
        <Badge variant="outline" className="text-xs">
          {providerName}
        </Badge>
      </div>

      {/* Analyzing Progress */}
      {isAnalyzing && (
        <div className="flex-1 flex items-center gap-2">
          <Progress value={33} className="flex-1 h-2" />
          <span className="text-xs text-muted-foreground">Analyzing...</span>
        </div>
      )}

      {/* Active AI indicator with preview - shown when AI suggestions are being used */}
      {hasSuccessfulResults && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-2 px-2 py-1 bg-purple-100 dark:bg-purple-900/50 rounded text-purple-700 dark:text-purple-300 cursor-help">
                <Check className="w-4 h-4" aria-hidden="true" />
                <span className="text-xs font-medium">AI names active ({aiSuggestions.size})</span>
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
        </TooltipProvider>
      )}

      {/* Results Summary */}
      {hasResults && lastAnalysisResult && (
        <div className="flex items-center gap-2 text-sm">
          {lastAnalysisResult.analyzed > 0 ? (
            <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
              {lastAnalysisResult.analyzed} analyzed
            </Badge>
          ) : (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="text-xs text-yellow-600 border-yellow-600 cursor-help">
                    0 analyzed
                  </Badge>
                </TooltipTrigger>
                <TooltipContent className="max-w-sm">
                  <p className="font-medium mb-1">No files could be analyzed</p>
                  <p className="text-xs">Supported text files: .txt, .md, .json, .yaml, .py, .js, .ts, etc.</p>
                  <p className="text-xs">Images (.jpg, .png, .gif, .webp) require vision model enabled in settings.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {lastAnalysisResult.skipped > 0 && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="text-xs cursor-help text-orange-600 border-orange-600">
                    {lastAnalysisResult.skipped} skipped
                  </Badge>
                </TooltipTrigger>
                <TooltipContent className="max-w-sm">
                  <p className="font-medium mb-1">Files were skipped</p>
                  <p className="text-xs">These files have unsupported types (like .pdf, .docx, .mp4, etc.)</p>
                  <p className="text-xs mt-1">For images, enable &quot;Vision Model&quot; in AI settings.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {lastAnalysisResult.failed > 0 && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="destructive" className="text-xs cursor-help">
                    {lastAnalysisResult.failed} failed
                  </Badge>
                </TooltipTrigger>
                <TooltipContent className="max-w-md">
                  <p className="font-medium mb-1">Analysis errors:</p>
                  <ul className="text-xs space-y-1">
                    {lastAnalysisResult.results
                      .filter(r => r.error && !r.skipped)
                      .slice(0, 5)
                      .map((r, i) => (
                        <li key={i} className="truncate">
                          <span className="font-mono">{r.filePath.split('/').pop()}</span>: {r.error}
                        </li>
                      ))}
                  </ul>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      )}

      {/* Error */}
      {aiAnalysisStatus === "error" && aiAnalysisError && (
        <TooltipProvider>
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
        </TooltipProvider>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Actions */}
      <div className="flex items-center gap-2">
        {hasSuccessfulResults && (
          <TooltipProvider>
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
          </TooltipProvider>
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

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex items-center gap-1">
                {!currentTemplateUsesAi && (
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                )}
                <Button
                  variant={hasResults ? "outline" : "default"}
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
        </TooltipProvider>
      </div>
    </div>
  );
}
