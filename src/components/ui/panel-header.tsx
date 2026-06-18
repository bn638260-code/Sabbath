import * as React from "react"

import { cn } from "@/lib/utils"

function PanelHeader({
  className,
  title,
  icon,
  step,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  title: string
  icon?: React.ReactNode
  step?: number
}) {
  return (
    <div className={cn("panel-header", className)} {...props}>
      <span className="flex items-center gap-2 text-xs font-semibold tracking-wider text-foreground uppercase">
        {step !== undefined && (
          <span className="flex size-[18px] shrink-0 items-center justify-center rounded-md border border-[var(--border-subtle)] bg-[var(--shell-bg-sunken)] text-[10px] font-bold text-muted-foreground">
            {step}
          </span>
        )}
        {icon}
        {title}
      </span>
      {children ? (
        <div className="flex items-center gap-1">{children}</div>
      ) : null}
    </div>
  )
}

export { PanelHeader }
