import { cn } from "@/lib/utils"
import { DASHBOARD_WORKSPACE_NAV } from "@/lib/dashboard-workspace-nav"
import {
  useDashboardWorkspaceStore,
  type DashboardWorkspace,
} from "@/stores/dashboard-workspace-store"
import { useServicePlanStore } from "@/stores/service-plan-store"
import { formatShortcutLabel } from "@/lib/dashboard-keyboard-shortcuts"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export function WorkspaceTopNav() {
  const workspace = useDashboardWorkspaceStore((s) => s.workspace)
  const setWorkspace = useDashboardWorkspaceStore((s) => s.setWorkspace)
  const closePlanner = useServicePlanStore((s) => s.closePlanner)
  const openPlanner = useServicePlanStore((s) => s.openPlanner)

  const selectWorkspace = (id: DashboardWorkspace, opensPlanner?: boolean) => {
    if (opensPlanner) {
      setWorkspace("service-plans")
      openPlanner()
      return
    }
    closePlanner()
    setWorkspace(id)
  }

  return (
    <nav
      aria-label="Workspaces"
      className="flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--shell-bg-sunken)] px-1 py-1"
    >
      {DASHBOARD_WORKSPACE_NAV.map((item) => {
        const Icon = item.icon
        const active = workspace === item.id
        const tooltipLabel = item.shortcut
          ? `${item.label} · ${formatShortcutLabel(item.shortcut)}`
          : item.label
        return (
          <div key={item.id} className="flex items-center">
            {item.dividerBefore ? (
              <div
                className="mx-1 h-5 w-px bg-[var(--shell-bg-sunken)]"
                role="separator"
                aria-orientation="vertical"
              />
            ) : null}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label={tooltipLabel}
                  aria-current={active ? "page" : undefined}
                  data-tour={
                    item.id === "live-service"
                      ? "broadcast"
                      : item.id === "kinetic-themes"
                        ? "kinetic-themes"
                        : item.id === "settings"
                          ? "settings"
                          : undefined
                  }
                  onClick={() => selectWorkspace(item.id, item.opensPlanner)}
                  className={cn(
                    "btn-action flex size-8 cursor-pointer items-center justify-center rounded-md transition-colors",
                    active
                      ? "bg-[var(--accent-glow)] text-[var(--accent)] ring-1 ring-[var(--accent)]/40"
                      : "text-muted-foreground hover:bg-[var(--shell-bg-sunken)] hover:text-foreground"
                  )}
                >
                  <Icon className="size-[18px] shrink-0" strokeWidth={2} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">{tooltipLabel}</TooltipContent>
            </Tooltip>
          </div>
        )
      })}
    </nav>
  )
}
