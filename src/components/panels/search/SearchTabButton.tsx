import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"

/** One tab button in the Search panel's Book / Context / EGW switcher. */
export function SearchTabButton({
  icon: Icon,
  label,
  active,
  inactiveClassName,
  dataTour,
  onClick,
}: {
  icon: LucideIcon
  label: string
  active: boolean
  inactiveClassName?: string
  dataTour?: string
  onClick: () => void
}) {
  return (
    <button
      data-tour={dataTour}
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors",
        active
          ? "border-lime-500/50 bg-lime-500/15"
          : (inactiveClassName ??
            "border-[var(--border-subtle)] text-muted-foreground hover:text-foreground"),
      )}
    >
      <Icon
        className={cn(
          "size-3.5",
          active ? "text-lime-700 dark:text-lime-400" : "text-muted-foreground",
        )}
      />
      {label}
    </button>
  )
}
