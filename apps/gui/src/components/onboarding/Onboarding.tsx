/**
 * Onboarding Component
 *
 * Guides new users through the app's main features with
 * a step-by-step introduction carousel.
 */

import { useState, useEffect } from "react";
import { Folder, Wand2, FolderTree, Sparkles, X, ChevronRight, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const ONBOARDING_KEY = "tidy-app-onboarding-completed";

// Constants (P3-002)
/** Delay before showing onboarding to let the app render first */
const ONBOARDING_DELAY_MS = 500;

interface OnboardingStep {
  icon: React.ReactNode;
  title: string;
  description: string;
  tip?: string;
}

const STEPS: OnboardingStep[] = [
  {
    icon: <Folder className="h-12 w-12 text-blue-500" />,
    title: "Choose a folder",
    description:
      "Drop a folder onto the app or browse to select one. Tidy will scan its contents and show you what can be organized.",
    tip: "Recent folders appear for quick access.",
  },
  {
    icon: <Wand2 className="h-12 w-12 text-purple-500" />,
    title: "Pick a naming pattern",
    description:
      "Templates define how files get renamed. Use placeholders like {date} or {title} to create consistent, meaningful names.",
    tip: "Create custom templates in Settings.",
  },
  {
    icon: <FolderTree className="h-12 w-12 text-green-500" />,
    title: "Organize into folders",
    description:
      "Optionally sort files into folders by date, type, or custom rules. See the structure before committing.",
  },
  {
    icon: <Sparkles className="h-12 w-12 text-amber-500" />,
    title: "Let AI help",
    description:
      "When enabled, AI can suggest meaningful names based on file contents.",
    tip: "Configure AI in Settings.",
  },
];

export interface OnboardingProps {
  /** Force show onboarding even if completed before */
  forceShow?: boolean;
  /** Callback when onboarding is dismissed */
  onComplete?: () => void;
}

export function Onboarding({ forceShow = false, onComplete }: OnboardingProps) {
  const [open, setOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  // Check if onboarding was completed before
  useEffect(() => {
    if (forceShow) {
      setOpen(true);
      return;
    }

    const completed = localStorage.getItem(ONBOARDING_KEY);
    if (!completed) {
      // Small delay to let the app render first
      const timer = setTimeout(() => setOpen(true), ONBOARDING_DELAY_MS);
      return () => clearTimeout(timer);
    }
  }, [forceShow]);

  const handleClose = () => {
    setOpen(false);
    localStorage.setItem(ONBOARDING_KEY, "true");
    onComplete?.();
  };

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleClose();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    handleClose();
  };

  const step = STEPS[currentStep];
  const isLastStep = currentStep === STEPS.length - 1;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="sm:max-w-md"
        data-testid="onboarding-dialog"
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="text-center pb-2">
          <DialogTitle className="text-lg">Welcome</DialogTitle>
          <DialogDescription>
            A quick tour of how Tidy works
          </DialogDescription>
        </DialogHeader>

        {/* Close button */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-4 top-4"
          onClick={handleSkip}
          aria-label="Skip onboarding"
        >
          <X className="h-4 w-4" />
        </Button>

        {/* Step content */}
        <div className="flex flex-col items-center text-center pt-4">
          {/* Progress dots */}
          <div className="flex gap-1.5 mb-6">
            {STEPS.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentStep(index)}
                className={cn(
                  "w-2 h-2 rounded-full transition-colors",
                  index === currentStep
                    ? "bg-primary"
                    : "bg-muted hover:bg-muted-foreground/30"
                )}
                aria-label={`Go to step ${index + 1}`}
              />
            ))}
          </div>

          {/* Icon */}
          <div className="mb-4 p-4 rounded-full bg-muted/50">
            {step.icon}
          </div>

          {/* Title */}
          <h3 className="text-xl font-semibold mb-2">
            {step.title}
          </h3>

          {/* Description */}
          <p className="text-muted-foreground mb-4">
            {step.description}
          </p>

          {/* Tip */}
          {step.tip && (
            <p className="text-sm text-primary/80 bg-primary/5 px-3 py-2 rounded-md">
              Tip: {step.tip}
            </p>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t">
          <Button
            variant="ghost"
            onClick={handlePrevious}
            disabled={currentStep === 0}
            className="gap-1"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </Button>

          <span className="text-sm text-muted-foreground">
            {currentStep + 1} / {STEPS.length}
          </span>

          <Button onClick={handleNext} className="gap-1">
            {isLastStep ? "Get Started" : "Next"}
            {!isLastStep && <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

