/**
 * Empty State - Engaging empty states with illustrations
 */

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import { Button } from "./button";

type ButtonVariant =
  | "default"
  | "destructive"
  | "outline"
  | "secondary"
  | "ghost"
  | "link";

export interface EmptyStateAction {
  label: string;
  onClick: () => void;
  variant?: ButtonVariant;
  icon?: ReactNode;
}

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: EmptyStateAction;
  secondaryAction?: Omit<EmptyStateAction, "variant">;
  className?: string;
  children?: ReactNode;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  className,
  children,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center py-8 text-center sm:py-16 animate-in fade-in duration-300",
        className
      )}
    >
      {/* Subtle background glow */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-48 w-48 rounded-full bg-primary/5 blur-3xl" />
      </div>

      {icon && (
        <div className="relative mb-6">
          {/* Decorative ring */}
          <div className="absolute inset-0 scale-150 rounded-full border border-primary/10" />
          {icon}
        </div>
      )}

      <h3 className="relative mb-2 text-lg font-semibold">{title}</h3>

      {description && (
        <p className="relative mb-4 max-w-md text-muted-foreground sm:mb-6">
          {description}
        </p>
      )}

      {(action || secondaryAction) && (
        <div className="relative flex flex-col justify-center gap-3 sm:flex-row">
          {action && (
            <Button onClick={action.onClick} variant={action.variant || "default"}>
              {action.icon}
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button onClick={secondaryAction.onClick} variant="outline">
              {secondaryAction.icon}
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}

      {children}
    </div>
  );
}

/**
 * Illustration: Empty folder/files
 */
export function EmptyFilesIllustration({ className }: { className?: string }) {
  return (
    <svg
      className={cn("h-32 w-32 text-muted-foreground/30", className)}
      viewBox="0 0 128 128"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="No files"
    >
      {/* Folder shape */}
      <path
        d="M16 32H52L60 24H112V96H16V32Z"
        stroke="currentColor"
        strokeWidth="4"
      />
      {/* Folder tab */}
      <path
        d="M16 32V24C16 20 20 16 24 16H48L56 24"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
      {/* Empty indicator - dashed circle */}
      <circle
        cx="64"
        cy="64"
        r="20"
        stroke="currentColor"
        strokeWidth="2"
        strokeDasharray="4 4"
        opacity="0.5"
      />
    </svg>
  );
}

/**
 * Illustration: Search Empty
 */
export function EmptySearchIllustration({ className }: { className?: string }) {
  return (
    <svg
      className={cn("h-32 w-32 text-muted-foreground/30", className)}
      viewBox="0 0 128 128"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="No results"
    >
      <circle cx="52" cy="52" r="32" stroke="currentColor" strokeWidth="4" />
      <path
        d="M76 76L104 104"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinecap="round"
      />
      {/* Question mark */}
      <path
        d="M44 44C44 40 48 36 52 36C56 36 60 40 60 44C60 48 56 50 52 52V58"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <circle cx="52" cy="66" r="3" fill="currentColor" />
    </svg>
  );
}

/**
 * Illustration: Success/Checkmark
 */
export function SuccessIllustration({ className }: { className?: string }) {
  return (
    <svg
      className={cn("h-32 w-32 text-green-500", className)}
      viewBox="0 0 128 128"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Success"
    >
      <circle cx="64" cy="64" r="48" stroke="currentColor" strokeWidth="4" />
      <path
        d="M40 64L56 80L88 48"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Illustration: AI/Analysis
 */
export function AiAnalysisIllustration({ className }: { className?: string }) {
  return (
    <svg
      className={cn("h-32 w-32 text-purple-500/50", className)}
      viewBox="0 0 128 128"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="AI Analysis"
    >
      {/* Brain/chip shape */}
      <rect
        x="32"
        y="32"
        width="64"
        height="64"
        rx="8"
        stroke="currentColor"
        strokeWidth="4"
      />
      {/* Connection points */}
      <circle cx="48" cy="48" r="6" fill="currentColor" />
      <circle cx="80" cy="48" r="6" fill="currentColor" />
      <circle cx="48" cy="80" r="6" fill="currentColor" />
      <circle cx="80" cy="80" r="6" fill="currentColor" />
      {/* Center connection */}
      <circle cx="64" cy="64" r="8" stroke="currentColor" strokeWidth="2" />
      {/* Lines from center */}
      <path d="M64 56V48M64 72V80M56 64H48M72 64H80" stroke="currentColor" strokeWidth="2" />
      {/* External connectors */}
      <path d="M32 64H24M96 64H104M64 32V24M64 96V104" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
