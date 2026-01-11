/**
 * Settings Modal Component
 *
 * Modal dialog for viewing and editing application settings.
 * Contains tabbed navigation between Templates and Preferences sections.
 *
 * Story 6.3 - AC1: Settings Modal Opens
 */

import { useEffect, useState } from "react";
import { Settings } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/stores/app-store";
import { TemplateList } from "@/components/template-list/TemplateList";
import { PreferencesPanel } from "@/components/preferences-panel/PreferencesPanel";

export interface SettingsModalProps {
  /** Control open state externally (optional) */
  open?: boolean;
  /** Callback when open state changes */
  onOpenChange?: (open: boolean) => void;
}

export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"templates" | "preferences">("templates");

  const { config, configStatus, loadConfig } = useAppStore();

  // Use controlled or uncontrolled mode
  const isOpen = open ?? internalOpen;
  const handleOpenChange = onOpenChange ?? setInternalOpen;

  // Load config when modal opens
  useEffect(() => {
    if (isOpen && !config) {
      loadConfig();
    }
  }, [isOpen, config, loadConfig]);

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Open settings"
          data-testid="settings-trigger"
        >
          <Settings className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent
        className="sm:max-w-[600px] max-h-[85vh] overflow-hidden flex flex-col"
        data-testid="settings-modal"
      >
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Manage your templates and preferences
          </DialogDescription>
        </DialogHeader>

        {configStatus === "loading" ? (
          <div
            className="flex items-center justify-center py-12"
            role="status"
            aria-label="Loading settings"
          >
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : configStatus === "error" ? (
          <div className="text-center py-8" data-testid="settings-error">
            <p className="text-destructive mb-4">Failed to load settings</p>
            <Button onClick={() => loadConfig()} variant="outline">
              Retry
            </Button>
          </div>
        ) : (
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as "templates" | "preferences")}
            className="flex-1 flex flex-col overflow-hidden"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="templates" data-testid="tab-templates">
                Templates
              </TabsTrigger>
              <TabsTrigger value="preferences" data-testid="tab-preferences">
                Preferences
              </TabsTrigger>
            </TabsList>

            <TabsContent
              value="templates"
              className="flex-1 overflow-auto mt-4"
              data-testid="templates-tab-content"
            >
              {config && <TemplateList templates={config.templates} />}
            </TabsContent>

            <TabsContent
              value="preferences"
              className="flex-1 overflow-auto mt-4"
              data-testid="preferences-tab-content"
            >
              {config && <PreferencesPanel preferences={config.preferences} />}
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
