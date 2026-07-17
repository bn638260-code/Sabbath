import { useEffect, useState, type ReactNode } from "react"
import { CircleDotIcon, MonitorIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { APP_DISPLAY_NAME } from "@/lib/app-brand"
import { AppLogo } from "@/components/ui/app-logo"
import { useBroadcastLiveStore } from "@/stores/broadcast/live-store"
import { useBroadcastMonitorStore } from "@/stores/broadcast/monitor-store"
import {
  openProjectorSetup,
  useProjectorSetupStore,
} from "@/stores/projector-setup-store"
import { deriveProjectorReadiness } from "@/lib/projector-setup/projector-readiness"
import { projectorReadinessCopy } from "@/lib/projector-setup/projector-readiness-copy"
import { parseRememberedSetupKey } from "@/lib/projector-setup/remembered-setup-key"
import { WorkspaceTopNav } from "@/components/layout/workspace-top-nav"
import packageJson from "../../../package.json"

function formatClock(date: Date): string {
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}

function HeaderStatusChip({
  icon,
  label,
  tone = "neutral",
}: {
  icon: ReactNode
  label: string
  tone?: "neutral" | "live" | "ready" | "warn"
}) {
  return (
    <span
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-xl border px-3 text-[11px] font-extrabold tracking-[0.06em] uppercase",
        tone === "live"
          ? "border-red-500/35 bg-red-500/12 text-red-700 dark:text-red-300"
          : tone === "ready"
            ? "border-teal-400/30 bg-teal-400/10 text-teal-700 dark:text-teal-200"
            : tone === "warn"
              ? "border-amber-400/35 bg-amber-400/12 text-amber-700 dark:text-amber-300"
              : "border-[var(--border-subtle)] bg-[var(--shell-bg-sunken)] text-muted-foreground"
      )}
    >
      {icon}
      {label}
    </span>
  )
}

export function AppControllerHeader() {
  const isLive = useBroadcastLiveStore((s) => s.isLive)
  const projectorMonitors = useProjectorSetupStore((s) => s.monitors)
  const rememberedMonitorKey = useBroadcastMonitorStore(
    (s) => s.mainDisplayMonitorKey
  )
  const rememberedFullscreen = useBroadcastMonitorStore(
    (s) => s.mainProjectorFullscreen
  )
  const projectorChip = projectorReadinessCopy(
    deriveProjectorReadiness({
      monitors: projectorMonitors,
      remembered: parseRememberedSetupKey(
        rememberedMonitorKey,
        rememberedFullscreen
      ),
      // The header cannot observe the Main output window's enabled state, only
      // global broadcast content state. Keep this chip about setup readiness and
      // let the separate "On Air" chip report global live status.
      isLive: false,
    })
  )
  const [clock, setClock] = useState(() => formatClock(new Date()))

  useEffect(() => {
    const id = window.setInterval(() => setClock(formatClock(new Date())), 1000)
    return () => window.clearInterval(id)
  }, [])

  const versionLabel = `v${packageJson.version}`

  return (
    <header className="z-50 mx-3 mt-3 grid min-h-[76px] shrink-0 grid-cols-[minmax(0,1.4fr)_auto_minmax(0,1fr)] items-center gap-4 rounded-3xl border border-[var(--border-subtle)] bg-[color-mix(in_srgb,var(--shell-bg-elevated)_62%,transparent)] px-5 shadow-[var(--shell-panel-shadow)] backdrop-blur-2xl">
      <div className="flex min-w-0 items-center gap-4 overflow-hidden">
        <div className="hidden shrink-0 items-center gap-3 border-r border-[var(--border-subtle)] pr-4 min-[1680px]:flex">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-white to-slate-100 shadow-[inset_0_0_0_1px_rgba(11,43,72,0.09),0_6px_16px_rgba(18,60,97,0.09)]">
            <img
              src="/sda-logo.png"
              alt="Seventh-day Adventist Church logo"
              className="size-8 object-contain"
            />
          </span>
          <div className="flex flex-col leading-none whitespace-nowrap">
            <span className="text-[15px] font-bold tracking-[-0.02em] text-[var(--shell-navy)]">
              KNFC Conference
            </span>
            <span className="mt-1.5 text-[8px] tracking-[0.13em] text-muted-foreground uppercase">
              Seventh-day Adventist Church
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <AppLogo
            size="sm"
            className="transition-transform duration-300 hover:rotate-3"
          />
          <div className="flex flex-col leading-none whitespace-nowrap">
            <span className="text-lg font-bold tracking-[-0.035em] text-foreground">
              {APP_DISPLAY_NAME}
            </span>
            <span className="mt-1.5 text-[9px] font-semibold tracking-[0.13em] text-muted-foreground uppercase">
              Automated Presentation Space
            </span>
          </div>
          <span className="ml-2 rounded-md border border-yellow-400/20 bg-yellow-400/10 px-2 py-0.5 font-mono text-[9px] font-semibold tracking-wider text-yellow-700 uppercase dark:text-yellow-400">
            {versionLabel}
          </span>
        </div>
      </div>

      <div className="justify-self-center">
        <WorkspaceTopNav />
      </div>

      <div className="flex min-w-0 items-center justify-end gap-2.5">
        <button
          type="button"
          data-tour="projector-setup"
          onClick={() => openProjectorSetup()}
          title="Open Projector Setup"
          aria-label="Open Projector Setup"
          className="hidden cursor-pointer transition-transform hover:scale-[1.03] md:inline-flex"
        >
          <HeaderStatusChip
            icon={<MonitorIcon className="size-3" />}
            label={projectorChip.chipLabel}
            tone={projectorChip.chipTone}
          />
        </button>
        <div className="hidden items-center gap-1.5 xl:flex">
          <HeaderStatusChip
            icon={<CircleDotIcon className="size-3" />}
            label={isLive ? "On Air" : "Standby"}
            tone={isLive ? "live" : "neutral"}
          />
        </div>
        <div className="hidden h-9 items-center rounded-xl border border-[var(--border-subtle)] bg-[var(--shell-bg-sunken)] px-3 text-[13px] font-bold tracking-[0.04em] text-foreground tabular-nums lg:flex">
          {clock}
        </div>
      </div>
    </header>
  )
}
