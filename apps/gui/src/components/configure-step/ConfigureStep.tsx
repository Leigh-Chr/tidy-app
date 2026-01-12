/**
 * Configure Step Component
 *
 * Step 2 of the workflow wizard.
 * Focused on template selection with a clean, hero-style presentation.
 * Advanced options are collapsed by default.
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import { ArrowRight, ChevronDown, ChevronUp, Settings2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/stores/app-store";
import { TemplateSelector } from "@/components/template-selector/TemplateSelector";
import { AiAnalysisBar } from "@/components/ai-analysis";
import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Template, FileInfo } from "@/lib/tauri";

/**
 * Hero template card with live preview
 */
function TemplateHero({
  templates,
  selectedTemplateId,
  onTemplateChange,
}: {
  templates: Template[];
  selectedTemplateId: string | null;
  onTemplateChange: (id: string) => void;
}) {
  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

  // Generate preview example
  const previewExample = useMemo(() => {
    if (!selectedTemplate) return null;
    const now = new Date();
    const year = now.getFullYear().toString();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    const original = "beach_sunset.jpg";
    const originalName = "beach_sunset";
    const ext = "jpg";

    let result = selectedTemplate.pattern
      .replace(/\{year\}/gi, year)
      .replace(/\{month\}/gi, month)
      .replace(/\{day\}/gi, day)
      .replace(/\{date:([^}]+)\}/gi, (_match, format: string) => {
        return format.replace(/YYYY/g, year).replace(/MM/g, month).replace(/DD/g, day);
      })
      .replace(/\{original\}/gi, originalName)
      .replace(/\{name\}/gi, originalName)
      .replace(/\{ext\}/gi, ext)
      .replace(/\{extension\}/gi, ext);

    if (!result.includes(".")) {
      result += "." + ext;
    }

    return { original, result };
  }, [selectedTemplate]);

  return (
    <Card className="border-2 border-primary/20 bg-primary/5">
      <CardContent className="pt-6">
        <div className="text-center space-y-4">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">How should files be named?</h3>
            <p className="text-sm text-muted-foreground">
              Choose a naming pattern for your files
            </p>
          </div>

          <div className="flex justify-center">
            <TemplateSelector
              templates={templates}
              selectedId={selectedTemplateId}
              onSelect={onTemplateChange}
              showPreview={false}
              className="w-full max-w-xs"
            />
          </div>

          {/* Live preview transformation */}
          {previewExample && (
            <div className="flex flex-col items-center gap-2 pt-2">
              <div className="flex items-center gap-3 text-sm">
                <span className="font-mono text-muted-foreground bg-muted/50 px-2 py-1 rounded">
                  {previewExample.original}
                </span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <span className="font-mono text-primary font-medium bg-primary/10 px-2 py-1 rounded">
                  {previewExample.result}
                </span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * File summary header
 */
function FileSummary({
  files,
  folder,
}: {
  files: FileInfo[];
  folder: string;
}) {
  const totalSize = useMemo(() => {
    return files.reduce((acc, f) => acc + f.size, 0);
  }, [files]);

  // Get folder name from path
  const folderName = folder.split("/").pop() || folder;

  return (
    <div className="text-center space-y-2">
      <div className="flex items-center justify-center gap-2 text-muted-foreground">
        <span className="text-sm truncate max-w-xs" title={folder}>
          📁 {folderName}
        </span>
      </div>
      <div className="flex items-center justify-center gap-3">
        <span className="text-3xl font-bold">{files.length.toLocaleString()}</span>
        <span className="text-muted-foreground">files</span>
        <span className="text-muted-foreground/30">•</span>
        <span className="text-muted-foreground">{formatBytes(totalSize)}</span>
      </div>
    </div>
  );
}

export interface ConfigureStepProps {
  /** Callback when user wants to proceed to preview */
  onContinue: () => void;
  /** Callback when user wants to go back */
  onBack: () => void;
}

export function ConfigureStep({ onContinue, onBack }: ConfigureStepProps) {
  const {
    config,
    loadConfig,
    selectedFolder,
    scanResult,
    getFilteredFiles,
    scanOptions,
    setScanOptions,
    generatePreview,
    llmStatus,
  } = useAppStore();

  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [showOptions, setShowOptions] = useState(false);

  // Load config on mount
  useEffect(() => {
    if (!config) {
      loadConfig();
    }
  }, [config, loadConfig]);

  // Set default template when config loads
  useEffect(() => {
    if (config && !selectedTemplateId) {
      const defaultTemplate = config.templates.find((t) => t.isDefault);
      if (defaultTemplate) {
        setSelectedTemplateId(defaultTemplate.id);
      } else if (config.templates.length > 0) {
        setSelectedTemplateId(config.templates[0].id);
      }
    }
  }, [config, selectedTemplateId]);

  const filteredFiles = getFilteredFiles();

  const handleTemplateChange = useCallback((templateId: string) => {
    setSelectedTemplateId(templateId);
  }, []);

  const handleContinue = useCallback(async () => {
    if (!config || !selectedTemplateId || filteredFiles.length === 0) return;

    const template = config.templates.find((t) => t.id === selectedTemplateId);
    if (!template) return;

    // Generate preview and advance to next step
    await generatePreview(filteredFiles, template.pattern);
    onContinue();
  }, [config, selectedTemplateId, filteredFiles, generatePreview, onContinue]);

  const handleRecursiveChange = useCallback(
    (checked: boolean) => {
      setScanOptions({ recursive: checked });
      // Note: User would need to re-scan to apply this change
    },
    [setScanOptions]
  );

  if (!config || !scanResult || !selectedFolder) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const isAiEnabled = config.ollama.enabled;
  const isAiAvailable = llmStatus === "available";

  return (
    <div className="max-w-xl mx-auto space-y-8 animate-step-in">
      {/* File Summary */}
      <FileSummary
        files={filteredFiles}
        folder={selectedFolder}
      />

      {/* Template Selection Hero */}
      <TemplateHero
        templates={config.templates}
        selectedTemplateId={selectedTemplateId}
        onTemplateChange={handleTemplateChange}
      />

      {/* Options Section (collapsed by default) */}
      <Collapsible open={showOptions} onOpenChange={setShowOptions}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full flex items-center justify-center gap-2 text-muted-foreground hover:text-foreground"
          >
            <Settings2 className="h-4 w-4" />
            <span>More options</span>
            {showOptions ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent className="space-y-4 pt-4">
          {/* Scan Options */}
          <Card>
            <CardContent className="pt-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="recursive-toggle" className="text-sm font-medium">
                    Include subfolders
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Scan all nested directories
                  </p>
                </div>
                <Switch
                  id="recursive-toggle"
                  checked={scanOptions.recursive}
                  onCheckedChange={handleRecursiveChange}
                  aria-label="Include subfolders in scan"
                />
              </div>

              {scanOptions.recursive !== (config.preferences.recursiveScan ?? false) && (
                <p className="text-xs text-amber-600 dark:text-amber-500">
                  Re-scan folder to apply changes
                </p>
              )}
            </CardContent>
          </Card>

          {/* AI Analysis (if enabled) */}
          {isAiEnabled && (
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className={cn(
                    "h-4 w-4",
                    isAiAvailable ? "text-purple-500" : "text-muted-foreground"
                  )} />
                  <span className="text-sm font-medium">AI-Powered Names</span>
                  {!isAiAvailable && (
                    <Badge variant="secondary" className="text-xs">offline</Badge>
                  )}
                </div>
                <AiAnalysisBar files={filteredFiles} />
              </CardContent>
            </Card>
          )}
        </CollapsibleContent>
      </Collapsible>

      {/* Action Buttons */}
      <div className="flex flex-col gap-3">
        <Button
          size="lg"
          onClick={handleContinue}
          disabled={!selectedTemplateId || filteredFiles.length === 0}
          className="w-full text-base"
        >
          Continue to Preview
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          onClick={onBack}
          className="text-muted-foreground"
        >
          ← Choose different folder
        </Button>
      </div>
    </div>
  );
}
