/**
 * Preferences Panel Component
 *
 * Displays and allows editing of user preferences.
 *
 * Story 6.3 - AC6: Preferences Section
 */

import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAppStore, type Preferences, type CaseStyle } from "@/stores/app-store";
import type { OutputFormat } from "@/lib/tauri";

/** Case style options with labels and descriptions */
const CASE_STYLE_OPTIONS: Array<{ value: CaseStyle; label: string; example: string }> = [
  { value: "kebab-case", label: "kebab-case", example: "my-vacation-photos" },
  { value: "snake_case", label: "snake_case", example: "my_vacation_photos" },
  { value: "none", label: "None", example: "My Vacation Photos" },
  { value: "lowercase", label: "lowercase", example: "my vacation photos" },
  { value: "uppercase", label: "UPPERCASE", example: "MY VACATION PHOTOS" },
  { value: "title-case", label: "Title Case", example: "My Vacation Photos" },
  { value: "camelCase", label: "camelCase", example: "myVacationPhotos" },
  { value: "PascalCase", label: "PascalCase", example: "MyVacationPhotos" },
];

export interface PreferencesPanelProps {
  /** Current preferences */
  preferences: Preferences;
}

export function PreferencesPanel({ preferences }: PreferencesPanelProps) {
  const { updatePreferences, configStatus, configError } = useAppStore();
  const isSaving = configStatus === "saving";
  const hasError = configStatus === "error";

  const handleToggle = async (key: keyof Preferences, value: boolean) => {
    const result = await updatePreferences({ [key]: value });
    if (result.ok) {
      toast.success("Preferences saved");
    } else {
      toast.error("Failed to save preferences");
    }
  };

  const handleOutputFormatChange = async (value: OutputFormat) => {
    const result = await updatePreferences({ defaultOutputFormat: value });
    if (result.ok) {
      toast.success("Preferences saved");
    } else {
      toast.error("Failed to save preferences");
    }
  };

  const handleCaseStyleChange = async (value: CaseStyle) => {
    const result = await updatePreferences({ caseNormalization: value });
    if (result.ok) {
      toast.success("Preferences saved");
    } else {
      toast.error("Failed to save preferences");
    }
  };

  return (
    <div className="space-y-6" data-testid="preferences-panel">
      {/* Output Format */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor="output-format">Default Output Format</Label>
          <p className="text-sm text-muted-foreground">
            How results are displayed in the CLI
          </p>
        </div>
        <Select
          value={preferences.defaultOutputFormat}
          onValueChange={handleOutputFormatChange}
          disabled={isSaving}
        >
          <SelectTrigger className="w-[120px]" data-testid="output-format-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="table">Table</SelectItem>
            <SelectItem value="json">JSON</SelectItem>
            <SelectItem value="plain">Plain</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Filename Case Style */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor="case-style">Filename Style</Label>
          <p className="text-sm text-muted-foreground">
            How filenames are formatted
          </p>
        </div>
        <Select
          value={preferences.caseNormalization}
          onValueChange={handleCaseStyleChange}
          disabled={isSaving}
        >
          <SelectTrigger className="w-[140px]" data-testid="case-style-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CASE_STYLE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                <div className="flex flex-col">
                  <span>{option.label}</span>
                  <span className="text-xs text-muted-foreground">{option.example}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Confirm Before Apply */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor="confirm-apply">Confirm Before Apply</Label>
          <p className="text-sm text-muted-foreground">
            Ask for confirmation before renaming files
          </p>
        </div>
        <Switch
          id="confirm-apply"
          checked={preferences.confirmBeforeApply}
          onCheckedChange={(checked) => handleToggle("confirmBeforeApply", checked)}
          disabled={isSaving}
          data-testid="confirm-apply-switch"
        />
      </div>

      {/* Recursive Scan */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor="recursive-scan">Recursive Scan</Label>
          <p className="text-sm text-muted-foreground">
            Include files from subdirectories
          </p>
        </div>
        <Switch
          id="recursive-scan"
          checked={preferences.recursiveScan}
          onCheckedChange={(checked) => handleToggle("recursiveScan", checked)}
          disabled={isSaving}
          data-testid="recursive-scan-switch"
        />
      </div>

      {/* Color Output */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor="color-output">Color Output</Label>
          <p className="text-sm text-muted-foreground">
            Use colors in CLI output
          </p>
        </div>
        <Switch
          id="color-output"
          checked={preferences.colorOutput}
          onCheckedChange={(checked) => handleToggle("colorOutput", checked)}
          disabled={isSaving}
          data-testid="color-output-switch"
        />
      </div>

      {/* Status indicator with spinner overlay */}
      {isSaving && (
        <div className="flex items-center justify-center gap-2 p-3 bg-muted/50 rounded-md" data-testid="saving-indicator">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="text-sm text-muted-foreground">Saving preferences...</span>
        </div>
      )}

      {/* Error state */}
      {hasError && configError && (
        <div
          className="rounded-md bg-destructive/10 p-3 text-sm text-destructive"
          data-testid="preferences-error"
        >
          <p className="font-medium">Failed to save preferences</p>
          <p className="mt-1 text-xs">{configError}</p>
        </div>
      )}
    </div>
  );
}
