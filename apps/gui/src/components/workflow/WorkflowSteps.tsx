/**
 * Workflow Steps Component
 *
 * Visual step indicator showing progress through the 3-step wizard.
 * Provides clear visual feedback of current position and allows
 * navigation to completed steps.
 */

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type WorkflowStep = "select" | "configure" | "preview";

const STEPS: { id: WorkflowStep; label: string; number: number }[] = [
  { id: "select", label: "Select", number: 1 },
  { id: "configure", label: "Configure", number: 2 },
  { id: "preview", label: "Preview", number: 3 },
];

export interface WorkflowStepsProps {
  /** Current active step */
  currentStep: WorkflowStep;
  /** Callback when a step is clicked (only for completed steps) */
  onStepClick?: (step: WorkflowStep) => void;
  /** Additional CSS classes */
  className?: string;
}

function getStepIndex(step: WorkflowStep): number {
  return STEPS.findIndex((s) => s.id === step);
}

export function WorkflowSteps({
  currentStep,
  onStepClick,
  className,
}: WorkflowStepsProps) {
  const currentIndex = getStepIndex(currentStep);

  return (
    <div
      className={cn("flex items-center justify-center gap-2", className)}
      role="navigation"
      aria-label="Workflow progress"
    >
      {STEPS.map((step, index) => {
        const isCompleted = index < currentIndex;
        const isCurrent = index === currentIndex;
        const isClickable = isCompleted && onStepClick;

        return (
          <div key={step.id} className="flex items-center">
            {/* Step indicator */}
            <button
              onClick={() => isClickable && onStepClick(step.id)}
              disabled={!isClickable}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-all",
                // Completed step
                isCompleted && [
                  "bg-primary/10 text-primary",
                  isClickable && "hover:bg-primary/20 cursor-pointer",
                ],
                // Current step
                isCurrent && "bg-primary text-primary-foreground font-medium",
                // Future step
                !isCompleted && !isCurrent && "text-muted-foreground/50"
              )}
              aria-current={isCurrent ? "step" : undefined}
              aria-label={`Step ${step.number}: ${step.label}${isCompleted ? " (completed)" : isCurrent ? " (current)" : ""}`}
            >
              {/* Step circle/check */}
              <span
                className={cn(
                  "flex items-center justify-center w-5 h-5 rounded-full text-xs font-medium",
                  isCompleted && "bg-primary text-primary-foreground",
                  isCurrent && "bg-primary-foreground/20",
                  !isCompleted && !isCurrent && "bg-muted"
                )}
              >
                {isCompleted ? (
                  <Check className="w-3 h-3" />
                ) : (
                  step.number
                )}
              </span>
              {/* Step label - only show for current and completed on larger screens */}
              <span className={cn(
                "hidden sm:inline",
                !isCompleted && !isCurrent && "sr-only"
              )}>
                {step.label}
              </span>
            </button>

            {/* Connector line (except after last step) */}
            {index < STEPS.length - 1 && (
              <div
                className={cn(
                  "w-8 h-0.5 mx-1",
                  index < currentIndex ? "bg-primary" : "bg-muted"
                )}
                aria-hidden="true"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Minimal step indicator - just dots
 */
export function WorkflowDots({
  currentStep,
  onStepClick,
  className,
}: WorkflowStepsProps) {
  const currentIndex = getStepIndex(currentStep);

  return (
    <div
      className={cn("flex items-center justify-center gap-2", className)}
      role="navigation"
      aria-label="Workflow progress"
    >
      {STEPS.map((step, index) => {
        const isCompleted = index < currentIndex;
        const isCurrent = index === currentIndex;
        const isClickable = isCompleted && onStepClick;

        return (
          <button
            key={step.id}
            onClick={() => isClickable && onStepClick(step.id)}
            disabled={!isClickable}
            className={cn(
              "w-2 h-2 rounded-full transition-all",
              isCompleted && [
                "bg-primary",
                isClickable && "hover:scale-125 cursor-pointer",
              ],
              isCurrent && "bg-primary w-6",
              !isCompleted && !isCurrent && "bg-muted"
            )}
            aria-label={`Step ${step.number}: ${step.label}`}
            aria-current={isCurrent ? "step" : undefined}
          />
        );
      })}
    </div>
  );
}
