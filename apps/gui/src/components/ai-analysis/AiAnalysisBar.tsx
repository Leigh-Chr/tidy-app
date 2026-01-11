/**
 * AI Analysis Bar Component
 *
 * Shows AI analysis controls and status when LLM is enabled.
 * Allows users to analyze files with AI to get naming suggestions.
 */

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAppStore } from "@/stores/app-store";
import type { FileInfo } from "@/lib/tauri";

interface AiAnalysisBarProps {
  files: FileInfo[];
  disabled?: boolean;
}

export function AiAnalysisBar({ files, disabled }: AiAnalysisBarProps) {
  const {
    config,
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
      console.log("[AI Analysis] Starting analysis of", files.length, "files");
      console.log("[AI Analysis] File extensions:", files.map(f => f.extension).join(", "));
      toast.info(`Analyzing ${files.length} files...`, { duration: 3000 });

      const result = await analyzeFilesWithAi(files);
      console.log("[AI Analysis] Result:", result);

      if (result.ok) {
        const { analyzed, skipped, failed, results } = result.data;
        console.log("[AI Analysis] Summary - analyzed:", analyzed, "skipped:", skipped, "failed:", failed);

        // Log details of each result for debugging
        results.forEach(r => {
          console.log(`[AI Analysis] ${r.filePath}: source=${r.source}, skipped=${r.skipped}, error=${r.error || 'none'}`);
        });

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
        console.error("[AI Analysis] Error:", result.error);
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

      {/* Active AI indicator - shown when AI suggestions are being used */}
      {hasSuccessfulResults && (
        <div className="flex items-center gap-2 px-2 py-1 bg-purple-100 dark:bg-purple-900/50 rounded text-purple-700 dark:text-purple-300">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-xs font-medium">AI names active</span>
        </div>
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
              <span>
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
            {!isLlmAvailable && (
              <TooltipContent>
                <p>{providerName} is not available. Check your settings.</p>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}
