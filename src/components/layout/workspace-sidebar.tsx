import { cn } from "@/lib/utils"
import { DASHBOARD_WORKSPACE_NAV } from "@/lib/dashboard-workspace-nav"
import {
  useDashboardWorkspaceStore,
  type DashboardWorkspace,
} from "@/stores/dashboard-workspace-store"
import { useServicePlanStore } from "@/stores/service-plan-store"
import { formatShortcutLabel } from "@/lib/dashboard-keyboard-shortcuts"

export function WorkspaceSidebar() {
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
    <aside className="flex w-[210px] shrink-0 flex-col border-r border-[rgba(255,255,255,0.06)] bg-[#03050b]/80 backdrop-blur-md">
      <nav className="flex flex-1 flex-col gap-1 py-4" aria-label="Workspaces">
        {DASHBOARD_WORKSPACE_NAV.map((item) => {
          const Icon = item.icon
          const active = workspace === item.id
          return (
            <div key={item.id}>
              {item.dividerBefore ? (
                <div className="mx-5 my-2 h-px bg-white/5" role="separator" />
              ) : null}
              <button
                type="button"
                aria-current={active ? "page" : undefined}
                data-tour={
                  item.id === "live-service"
                    ? "broadcast"
                    : item.id === "settings"
                      ? "settings"
                      : undefined
                }
                onClick={() => selectWorkspace(item.id, item.opensPlanner)}
                className={cn(
                  "nav-item flex w-full cursor-pointer items-center gap-3 px-5 py-3.5 text-left text-xs font-medium decoration-none",
                  active ? "active text-slate-100" : "text-slate-400",
                )}
              >
                <Icon
                  className={cn(
                    "size-4 shrink-0",
                    active ? "text-[var(--accent)]" : "",
                  )}
                />
                <span>{item.label}</span>
              </button>
            </div>
          )
        })}
      </nav>

      <div className="border-t border-[rgba(255,255,255,0.06)] bg-slate-950/40 p-4">
        <div className="flex items-center gap-2.5 text-xs text-slate-400">
          <span className="size-2.5 animate-ping rounded-full bg-emerald-500" />
          <span className="font-mono text-[11px] tracking-wide">
            System: Online
          </span>
        </div>
        <div className="mt-3 space-y-1 font-mono text-[9px] text-slate-500">
          {[
            ["Ctrl/Cmd + 1", "Live"],
            ["Ctrl/Cmd + M", "Mic"],
            ["Ctrl/Cmd + Enter", "Present"],
            ["Ctrl/Cmd + Shift + B", "Blackout"],
          ].map(([keys, action]) => (
            <div key={keys} className="flex min-w-0 justify-between gap-2">
              <span className="shrink-0">{formatShortcutLabel(keys)}</span>
              <span className="truncate text-right">{action}</span>
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-between font-mono text-[9px] text-slate-600">
          <span>SABBATHCUE PRO</span>
          <span>ACTIVE</span>
        </div>
      </div>
    </aside>
  )
}
