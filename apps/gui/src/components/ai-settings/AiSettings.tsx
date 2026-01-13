/**
 * AI Settings Panel Component
 *
 * Displays and allows editing of LLM configuration.
 * Supports multiple providers (Ollama, OpenAI).
 * Includes health status, model selection, and feature toggles.
 */

import { useEffect, useState } from "react";
import { RefreshCw, CheckCircle, XCircle, Loader2, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAppStore, type OllamaConfig } from "@/stores/app-store";
import type { FileTypePreset, LlmProvider, OfflineMode } from "@/lib/tauri";
import { storeSecret, retrieveSecret } from "@/lib/tauri";
import { secureLog } from "@/lib/log-utils";

// Secret key identifier for OpenAI API key (SEC-004)
const OPENAI_API_KEY_SECRET = "openai_api_key";

// =============================================================================
// Input Validation Schemas (P2-006)
// =============================================================================

/**
 * Schema for validating Ollama base URL.
 * Must be a valid HTTP/HTTPS URL.
 */
const baseUrlSchema = z
  .string()
  .min(1, "URL is required")
  .refine(
    (url) => {
      try {
        const parsed = new URL(url);
        return ["http:", "https:"].includes(parsed.protocol);
      } catch {
        return false;
      }
    },
    { message: "Must be a valid HTTP or HTTPS URL" }
  );

/**
 * Schema for validating OpenAI API key.
 * OpenAI keys start with "sk-" and are typically 51 characters (but can vary for org keys).
 */
const apiKeySchema = z
  .string()
  .min(1, "API key is required")
  .refine(
    (key) => key.startsWith("sk-") || key.startsWith("sk-proj-"),
    { message: "API key must start with 'sk-' or 'sk-proj-'" }
  )
  .refine(
    (key) => key.length >= 20,
    { message: "API key appears to be too short" }
  );

/**
 * Known vision-capable model prefixes (for Ollama)
 *
 * TODO: Move to OllamaConfig in backend to make this user-configurable.
 * Users should be able to add custom prefixes for new vision models
 * without updating the application code.
 *
 * Current known vision models:
 * - llava: LLaVA (Large Language and Vision Assistant)
 * - bakllava: BakLLaVA (fine-tuned LLaVA)
 * - moondream: Moondream vision model
 * - minicpm-v: MiniCPM-V vision model
 * - gemma3: Google Gemma 3 with vision
 * - llama3.2-vision: Meta LLaMA 3.2 Vision
 */
const VISION_MODEL_PREFIXES = [
  "llava",
  "bakllava",
  "moondream",
  "minicpm-v",
  "gemma3",
  "llama3.2-vision",
];

function isVisionModel(modelName: string): boolean {
  const lowerName = modelName.toLowerCase();
  return VISION_MODEL_PREFIXES.some((prefix) => lowerName.startsWith(prefix));
}

function formatModelSize(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024);
  return `${gb.toFixed(1)} GB`;
}

export interface AiSettingsProps {
  /** Current Ollama config */
  config: OllamaConfig;
}

export function AiSettings({ config }: AiSettingsProps) {
  const {
    llmStatus,
    llmModels,
    openaiModels,
    llmError,
    configStatus,
    checkLlmHealth,
    loadLlmModels,
    loadOpenAiModels,
    updateOllamaConfig,
  } = useAppStore();

  const [localBaseUrl, setLocalBaseUrl] = useState(config.baseUrl);
  const [localApiKey, setLocalApiKey] = useState("");
  const [isApiKeyLoaded, setIsApiKeyLoaded] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  // Validation error state (P2-006)
  const [baseUrlError, setBaseUrlError] = useState<string | null>(null);
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);
  const isSaving = configStatus === "saving";
  const isChecking = llmStatus === "checking";
  const isOpenAi = config.provider === "openai";

  // Load API key from secure storage on mount (SEC-004)
  useEffect(() => {
    if (isOpenAi && !isApiKeyLoaded) {
      retrieveSecret(OPENAI_API_KEY_SECRET)
        .then((key) => {
          setLocalApiKey(key);
          setIsApiKeyLoaded(true);
        })
        .catch((err) => {
          secureLog.warn("Failed to load API key from secure storage:", err);
          // Fallback to config (for migration from old storage)
          setLocalApiKey(config.openai?.apiKey || "");
          setIsApiKeyLoaded(true);
        });
    }
  }, [isOpenAi, isApiKeyLoaded, config.openai?.apiKey]);

  // Load models when component mounts and provider is enabled
  useEffect(() => {
    if (config.enabled) {
      if (isOpenAi && openaiModels.length === 0) {
        loadOpenAiModels();
      } else if (!isOpenAi && llmModels.length === 0) {
        checkLlmHealth().then((result) => {
          if (result.ok && result.data.available) {
            loadLlmModels();
          }
        });
      }
    }
  }, [config.enabled, isOpenAi, llmModels.length, openaiModels.length, checkLlmHealth, loadLlmModels, loadOpenAiModels]);

  const handleToggle = async (key: keyof OllamaConfig, value: boolean) => {
    const result = await updateOllamaConfig({ [key]: value });
    if (result.ok) {
      toast.success("Settings saved");
      // If enabling, check health
      if (key === "enabled" && value) {
        checkLlmHealth().then((healthResult) => {
          if (healthResult.ok && healthResult.data.available) {
            loadLlmModels();
          }
        });
      }
    } else {
      toast.error("Failed to save settings");
    }
  };

  const handleProviderChange = async (value: LlmProvider) => {
    const result = await updateOllamaConfig({ provider: value });
    if (result.ok) {
      toast.success(`Switched to ${value === "openai" ? "OpenAI" : "Ollama"}`);
      // Load models for the new provider
      if (value === "openai") {
        loadOpenAiModels();
      } else {
        checkLlmHealth().then((healthResult) => {
          if (healthResult.ok && healthResult.data.available) {
            loadLlmModels();
          }
        });
      }
    } else {
      toast.error("Failed to switch provider");
    }
  };

  const handleCheckConnection = async () => {
    if (isOpenAi) {
      // Save API key to secure storage if changed (SEC-004)
      try {
        await storeSecret(OPENAI_API_KEY_SECRET, localApiKey);
        // Also update config (without the actual key, just mark as configured)
        await updateOllamaConfig({
          openai: { ...config.openai, apiKey: localApiKey ? "[SECURED]" : "" },
        });
      } catch (err) {
        secureLog.error("Failed to save API key:", err);
      }
    } else {
      // Save base URL if changed
      if (localBaseUrl !== config.baseUrl) {
        await updateOllamaConfig({ baseUrl: localBaseUrl });
      }
    }
    const result = await checkLlmHealth();
    if (result.ok) {
      if (result.data.available) {
        toast.success(
          isOpenAi
            ? "Connected to OpenAI!"
            : `Connected! ${result.data.modelCount || 0} models found`
        );
        if (!isOpenAi) {
          loadLlmModels();
        }
      } else {
        toast.error(
          isOpenAi ? "OpenAI API key is invalid or not configured" : "Ollama is not responding"
        );
      }
    } else {
      toast.error(result.error.message);
    }
  };

  const handleBaseUrlBlur = async () => {
    // Validate before saving (P2-006)
    const validation = baseUrlSchema.safeParse(localBaseUrl);
    if (!validation.success) {
      setBaseUrlError(validation.error.issues[0].message);
      return;
    }
    setBaseUrlError(null);

    if (localBaseUrl !== config.baseUrl) {
      const result = await updateOllamaConfig({ baseUrl: localBaseUrl });
      if (result.ok) {
        toast.success("Base URL saved");
      } else {
        toast.error("Failed to save base URL");
      }
    }
  };

  const handleApiKeyBlur = async () => {
    // Allow empty key (to clear it)
    if (localApiKey === "") {
      setApiKeyError(null);
      try {
        await storeSecret(OPENAI_API_KEY_SECRET, "");
        await updateOllamaConfig({
          openai: { ...config.openai, apiKey: "" },
        });
        toast.success("API key cleared");
      } catch {
        toast.error("Failed to clear API key");
      }
      return;
    }

    // Validate before saving (P2-006)
    const validation = apiKeySchema.safeParse(localApiKey);
    if (!validation.success) {
      setApiKeyError(validation.error.issues[0].message);
      return;
    }
    setApiKeyError(null);

    // Save to secure storage (SEC-004)
    try {
      await storeSecret(OPENAI_API_KEY_SECRET, localApiKey);
      // Update config with placeholder to indicate key is configured
      await updateOllamaConfig({
        openai: { ...config.openai, apiKey: "[SECURED]" },
      });
      toast.success("API key saved securely");
    } catch (err) {
      secureLog.error("Failed to save API key:", err);
      toast.error("Failed to save API key");
    }
  };

  // Clear validation errors when input changes
  const handleBaseUrlChange = (value: string) => {
    setLocalBaseUrl(value);
    if (baseUrlError) setBaseUrlError(null);
  };

  const handleApiKeyChange = (value: string) => {
    setLocalApiKey(value);
    if (apiKeyError) setApiKeyError(null);
  };

  const handleModelChange = async (
    modelType: "inference" | "vision",
    value: string
  ) => {
    const models = { ...config.models, [modelType]: value || undefined };
    const result = await updateOllamaConfig({ models });
    if (result.ok) {
      toast.success("Model selection saved");
    } else {
      toast.error("Failed to save model");
    }
  };

  const handleOpenAiModelChange = async (
    modelType: "model" | "visionModel",
    value: string
  ) => {
    const result = await updateOllamaConfig({
      openai: { ...config.openai, [modelType]: value },
    });
    if (result.ok) {
      toast.success("Model selection saved");
    } else {
      toast.error("Failed to save model");
    }
  };

  const handlePresetChange = async (value: FileTypePreset) => {
    const fileTypes = { ...config.fileTypes, preset: value };
    const result = await updateOllamaConfig({ fileTypes });
    if (result.ok) {
      toast.success("File type preset saved");
    } else {
      toast.error("Failed to save preset");
    }
  };

  const handleOfflineModeChange = async (value: OfflineMode) => {
    const result = await updateOllamaConfig({ offlineMode: value });
    if (result.ok) {
      toast.success("Offline mode saved");
    } else {
      toast.error("Failed to save offline mode");
    }
  };

  const visionModels = llmModels.filter((m) => isVisionModel(m.name));
  const hasVisionModels = isOpenAi
    ? openaiModels.some((m) => m.supportsVision)
    : visionModels.length > 0;

  return (
    <div className="space-y-6" data-testid="ai-settings-panel">
      {/* Connection Status */}
      <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
        <div className="flex items-center gap-3">
          {llmStatus === "checking" ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : llmStatus === "available" ? (
            <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
          ) : (
            <XCircle className="h-5 w-5 text-red-500 dark:text-red-400" />
          )}
          <div>
            <p className="font-medium">
              {llmStatus === "checking"
                ? "Checking connection..."
                : llmStatus === "available"
                  ? "Connected"
                  : "Disconnected"}
            </p>
            <p className="text-sm text-muted-foreground">
              {llmStatus === "available"
                ? isOpenAi
                  ? "OpenAI API connected"
                  : `${llmModels.length} model${llmModels.length !== 1 ? "s" : ""} available`
                : llmError || (isOpenAi ? "OpenAI not configured" : "Ollama is not running")}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleCheckConnection}
          disabled={isChecking}
          data-testid="check-connection-btn"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isChecking ? "animate-spin" : ""}`} />
          Check
        </Button>
      </div>

      {/* Enable/Disable */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor="ollama-enabled">Enable AI Features</Label>
          <p className="text-sm text-muted-foreground">
            Use LLM for intelligent file naming
          </p>
        </div>
        <Switch
          id="ollama-enabled"
          checked={config.enabled}
          onCheckedChange={(checked) => handleToggle("enabled", checked)}
          disabled={isSaving}
          data-testid="ollama-enabled-switch"
        />
      </div>

      {/* Provider Selection */}
      <div className="space-y-2">
        <Label htmlFor="llm-provider">Provider</Label>
        <Select
          value={config.provider || "ollama"}
          onValueChange={(v) => handleProviderChange(v as LlmProvider)}
          disabled={isSaving}
        >
          <SelectTrigger data-testid="provider-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ollama">Ollama (Local)</SelectItem>
            <SelectItem value="openai">OpenAI (Cloud)</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {isOpenAi
            ? "Uses OpenAI's cloud API (requires API key)"
            : "Uses locally-running Ollama server"}
        </p>
      </div>

      {/* Ollama-specific settings */}
      {!isOpenAi && (
        <>
          {/* Base URL */}
          <div className="space-y-2">
            <Label htmlFor="base-url">Ollama URL</Label>
            <div className="flex gap-2">
              <Input
                id="base-url"
                value={localBaseUrl}
                onChange={(e) => handleBaseUrlChange(e.target.value)}
                onBlur={handleBaseUrlBlur}
                placeholder="http://localhost:11434"
                disabled={isSaving}
                data-testid="ollama-base-url"
                aria-invalid={!!baseUrlError}
                className={baseUrlError ? "border-destructive" : ""}
              />
            </div>
            {baseUrlError ? (
              <p className="text-xs text-destructive">{baseUrlError}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Default: http://localhost:11434
              </p>
            )}
          </div>

          {/* Model Selection */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="inference-model">Inference Model</Label>
              <Select
                value={config.models.inference || ""}
                onValueChange={(v) => handleModelChange("inference", v)}
                disabled={isSaving || llmModels.length === 0}
              >
                <SelectTrigger data-testid="inference-model-select">
                  <SelectValue placeholder="Select a model..." />
                </SelectTrigger>
                <SelectContent>
                  {llmModels.map((model) => (
                    <SelectItem key={model.name} value={model.name}>
                      {model.name} ({formatModelSize(model.size)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Model for analyzing text files and documents
              </p>
            </div>

            {/* Vision Model */}
            <div className="space-y-2">
              <Label htmlFor="vision-model">Vision Model</Label>
              <Select
                value={config.models.vision || ""}
                onValueChange={(v) => handleModelChange("vision", v)}
                disabled={isSaving || visionModels.length === 0}
              >
                <SelectTrigger data-testid="vision-model-select">
                  <SelectValue
                    placeholder={visionModels.length > 0 ? "Select a vision model..." : "No vision models installed"}
                  />
                </SelectTrigger>
                <SelectContent>
                  {visionModels.map((model) => (
                    <SelectItem key={model.name} value={model.name}>
                      {model.name} ({formatModelSize(model.size)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Vision-capable model for analyzing images (e.g., llava, moondream)
              </p>
            </div>
          </div>
        </>
      )}

      {/* OpenAI-specific settings */}
      {isOpenAi && (
        <>
          {/* API Key */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="openai-api-key">API Key</Label>
              {localApiKey && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                        <ShieldCheck className="h-3 w-3" />
                        <span className="sr-only">Securely stored</span>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>API key is encrypted and stored securely</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="openai-api-key"
                  type={showApiKey ? "text" : "password"}
                  value={localApiKey}
                  onChange={(e) => handleApiKeyChange(e.target.value)}
                  onBlur={handleApiKeyBlur}
                  placeholder="sk-..."
                  disabled={isSaving}
                  data-testid="openai-api-key"
                  aria-invalid={!!apiKeyError}
                  className={apiKeyError ? "border-destructive pr-10" : "pr-10"}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>
            {apiKeyError ? (
              <p className="text-xs text-destructive">{apiKeyError}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Get your API key from{" "}
                <a
                  href="https://platform.openai.com/api-keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  OpenAI Platform
                </a>
              </p>
            )}
          </div>

          {/* OpenAI Model Selection */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="openai-model">Text Model</Label>
              <Select
                value={config.openai?.model || "gpt-4o-mini"}
                onValueChange={(v) => handleOpenAiModelChange("model", v)}
                disabled={isSaving}
              >
                <SelectTrigger data-testid="openai-model-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {openaiModels.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Model for analyzing text files and documents
              </p>
            </div>

            {/* Vision Model */}
            <div className="space-y-2">
              <Label htmlFor="openai-vision-model">Vision Model</Label>
              <Select
                value={config.openai?.visionModel || "gpt-4o"}
                onValueChange={(v) => handleOpenAiModelChange("visionModel", v)}
                disabled={isSaving}
              >
                <SelectTrigger data-testid="openai-vision-model-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {openaiModels
                    .filter((m) => m.supportsVision)
                    .map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        {model.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Model for analyzing images (requires vision capability)
              </p>
            </div>
          </div>
        </>
      )}

      {/* Vision Toggle */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor="vision-enabled">Enable Vision Analysis</Label>
          <p className="text-sm text-muted-foreground">
            Analyze images using vision models
          </p>
        </div>
        <Switch
          id="vision-enabled"
          checked={config.visionEnabled}
          onCheckedChange={(checked) => handleToggle("visionEnabled", checked)}
          disabled={isSaving || !hasVisionModels}
          data-testid="vision-enabled-switch"
        />
      </div>

      {/* File Type Preset */}
      <div className="space-y-2">
        <Label htmlFor="file-type-preset">File Types to Analyze</Label>
        <Select
          value={config.fileTypes.preset}
          onValueChange={(v) => handlePresetChange(v as FileTypePreset)}
          disabled={isSaving}
        >
          <SelectTrigger data-testid="file-type-preset-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="documents">Documents (PDF, Office)</SelectItem>
            <SelectItem value="images">Images (JPG, PNG, etc.)</SelectItem>
            <SelectItem value="text">Text Files (TXT, MD, JSON)</SelectItem>
            <SelectItem value="all">All Supported Types</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Which file types should be sent to the LLM for analysis
        </p>
      </div>

      {/* Offline Mode */}
      <div className="space-y-2">
        <Label htmlFor="offline-mode">Offline Mode</Label>
        <Select
          value={config.offlineMode}
          onValueChange={(v) => handleOfflineModeChange(v as OfflineMode)}
          disabled={isSaving}
        >
          <SelectTrigger data-testid="offline-mode-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">Auto (use LLM when available)</SelectItem>
            <SelectItem value="enabled">Always Offline (skip LLM)</SelectItem>
            <SelectItem value="disabled">Require LLM (fail if unavailable)</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          How to handle when Ollama is not available
        </p>
      </div>

      {/* Status indicator */}
      {isSaving && (
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground" data-testid="saving-indicator">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          <span>Saving...</span>
        </div>
      )}

      {/* Error state */}
      {llmError && llmStatus === "unavailable" && (
        <div
          className="rounded-md bg-destructive/10 p-3 text-sm text-destructive"
          data-testid="ai-settings-error"
        >
          <p className="font-medium">Connection Error</p>
          <p className="mt-1 text-xs">{llmError}</p>
        </div>
      )}
    </div>
  );
}
