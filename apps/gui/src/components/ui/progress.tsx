import { cn } from "@/lib/utils"
import * as ProgressPrimitive from "@radix-ui/react-progress"
import type * as React from "react"

function Progress({
  className,
  value,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root>) {
  const numValue = value ?? 0;
  const isAnimating = numValue > 0 && numValue < 100;

  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-full bg-primary/20",
        className,
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className={cn(
          "h-full w-full flex-1 bg-primary transition-transform duration-200",
          isAnimating && "bg-gradient-to-r from-primary via-primary/80 to-primary"
        )}
        style={{ transform: `translateX(-${100 - numValue}%)` }}
      />
    </ProgressPrimitive.Root>
  )
}

export { Progress }
