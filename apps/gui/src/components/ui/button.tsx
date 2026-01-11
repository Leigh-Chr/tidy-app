import { cn } from "@/lib/utils"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import type * as React from "react"

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium text-sm outline-none transition-all transition-smooth duration-300 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-[var(--primary)]/30 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-[0_4px_12px_var(--primary)/0.3,0_0_20px_var(--primary)/0.15] dark:hover:shadow-[0_4px_12px_var(--primary)/0.4,0_0_25px_var(--primary)/0.2]",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40",
        outline:
          "border bg-background shadow-(--shadow-0) hover:border-primary/30 hover:bg-accent hover:text-accent-foreground dark:border-input dark:bg-input/30 dark:hover:border-primary/40 dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 min-h-[44px] px-4 py-2 has-[>svg]:px-3 sm:min-h-0",
        sm: "h-8 min-h-[44px] gap-1.5 rounded-md px-3 has-[>svg]:px-2.5 sm:min-h-0",
        lg: "h-10 min-h-[44px] rounded-md px-6 has-[>svg]:px-4 sm:min-h-0",
        icon: "size-10 min-h-[44px] sm:size-9 sm:min-h-0",
        "icon-sm": "size-10 min-h-[44px] sm:size-8 sm:min-h-0",
        "icon-lg": "size-11 min-h-[44px] sm:size-10 sm:min-h-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
