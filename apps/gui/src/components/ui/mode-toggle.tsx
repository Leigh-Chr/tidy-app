/**
 * Theme mode toggle component
 * Cycles between light, dark, and system themes on click
 */

import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "./button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./tooltip";

const THEME_ORDER = ["light", "dark", "system"] as const;
const THEME_LABELS: Record<string, string> = {
  light: "Light mode",
  dark: "Dark mode",
  system: "System preference",
};

export function ModeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();

  const cycleTheme = () => {
    const currentIndex = THEME_ORDER.indexOf(theme as typeof THEME_ORDER[number]);
    const nextIndex = (currentIndex + 1) % THEME_ORDER.length;
    setTheme(THEME_ORDER[nextIndex]);
  };

  // Determine which icon to show based on current theme
  const isSystem = theme === "system";
  const isDark = isSystem ? resolvedTheme === "dark" : theme === "dark";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={cycleTheme}
            aria-label={`Current: ${THEME_LABELS[theme ?? "system"]}. Click to change.`}
          >
            {isSystem ? (
              <Monitor className="h-[1.2rem] w-[1.2rem]" aria-hidden="true" />
            ) : isDark ? (
              <Moon className="h-[1.2rem] w-[1.2rem]" aria-hidden="true" />
            ) : (
              <Sun className="h-[1.2rem] w-[1.2rem]" aria-hidden="true" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{THEME_LABELS[theme ?? "system"]}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
