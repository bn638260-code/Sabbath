import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "@radix-ui/react-slot"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "btn-action inline-flex shrink-0 items-center justify-center rounded-lg text-xs font-bold whitespace-nowrap transition-all outline-none select-none focus-visible:ring-2 focus-visible:ring-[var(--accent-border)] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--broadcast-accent)] text-slate-950 hover:bg-[color-mix(in_srgb,var(--broadcast-accent)_88%,white)]",
        outline:
          "border border-[var(--border-dim)] bg-[var(--shell-bg-sunken)] text-foreground hover:bg-[var(--shell-bg-sunken)]",
        secondary:
          "border border-[var(--border-dim)] bg-[var(--shell-bg-sunken)] text-foreground hover:bg-[var(--shell-bg-sunken)]",
        ghost:
          "text-muted-foreground hover:bg-[var(--shell-bg-sunken)] hover:text-foreground",
        chrome:
          "border border-[var(--border-subtle)] bg-[var(--shell-bg-sunken)] text-muted-foreground hover:border-[var(--accent-border)] hover:bg-[var(--accent-glow)] hover:text-[var(--accent)]",
        destructive:
          "border border-red-500/20 bg-red-500/10 text-red-300 hover:bg-red-500/25",
        link: "text-[var(--accent)] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 gap-1.5 px-3",
        xs: "h-6 gap-1 px-2 text-[10px] [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1 px-2.5",
        lg: "h-10 gap-1.5 px-4",
        icon: "size-9",
        "icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
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
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
