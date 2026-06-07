import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "@radix-ui/react-slot"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "btn-action inline-flex shrink-0 items-center justify-center rounded-lg text-xs font-bold whitespace-nowrap transition-all outline-none select-none focus-visible:ring-2 focus-visible:ring-[var(--accent-border)] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-yellow-400 text-slate-950 hover:bg-yellow-500",
        outline:
          "border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10",
        secondary:
          "border border-white/10 bg-slate-900/50 text-slate-300 hover:bg-white/15",
        ghost: "text-slate-400 hover:bg-white/5 hover:text-white",
        chrome:
          "border border-white/5 bg-slate-900/60 text-slate-400 hover:border-[var(--accent-border)] hover:bg-[var(--accent-glow)] hover:text-[var(--accent)]",
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
  },
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
