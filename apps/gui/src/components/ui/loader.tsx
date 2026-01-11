/**
 * Loader/spinner component
 * Displays a loading indicator with configurable size
 */

import { cn } from "@/lib/utils"
import { Loader2 } from "lucide-react"

export interface LoaderProps {
  /** Size of the loader */
  size?: "sm" | "md" | "lg" | "xl" | "2xl" | undefined
  /** Additional CSS classes */
  className?: string | undefined
}

const sizeClasses = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-8 w-8",
  xl: "h-10 w-10",
  "2xl": "h-12 w-12",
}

export function Loader({ size = "md", className }: LoaderProps) {
  return (
    <div
      data-slot="loader"
      role="status"
      aria-live="polite"
      className={cn("flex items-center justify-center", className)}
    >
      <Loader2
        className={cn("animate-spin text-muted-foreground", sizeClasses[size])}
        aria-hidden="true"
      />
      <span className="sr-only">Loading...</span>
    </div>
  )
}
