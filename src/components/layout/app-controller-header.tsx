import { useEffect, useState, type ReactNode } from "react"
import { CircleDotIcon, MonitorIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { APP_DISPLAY_NAME } from "@/lib/app-brand"
import { AppLogo } from "@/components/ui/app-logo"
import {
  useAccentThemeStore,
  type AccentTheme,
} from "@/stores/accent-theme-store"
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

const ACCENT_SWATCHES: { id: AccentTheme; className: string; title: string }[] =
  [
    { id: "gold", className: "bg-yellow-400", title: "Sunrise Gold" },
    { id: "teal", className: "bg-teal-500", title: "Soft Teal" },
    { id: "emerald", className: "bg-emerald-500", title: "Emerald Sanctuary" },
    {
      id: "purple",
      className: "bg-purple-400",
      title: "Royal Amethyst",
    },
    { id: "aurora", className: "bg-sky-400", title: "Midnight Aurora" },
  ]

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
        "inline-flex h-7 items-center gap-1.5 rounded-md border px-2 font-mono text-[10px] font-semibold tracking-wide uppercase",
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
  const theme = useAccentThemeStore((s) => s.theme)
  const setTheme = useAccentThemeStore((s) => s.setTheme)
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
    <header className="z-50 flex h-[58px] shrink-0 items-center justify-between border-b border-[var(--border-subtle)] bg-[color-mix(in_srgb,var(--shell-bg-sunken)_86%,transparent)] px-5 backdrop-blur-xl">
      <div className="flex items-center gap-4">
        <div className="hidden items-center gap-2.5 border-r border-[var(--border-subtle)] pr-4 2xl:flex">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-white to-slate-100 shadow-[inset_0_0_0_1px_rgba(11,43,72,0.09),0_6px_16px_rgba(18,60,97,0.09)]">
            <img
              src="/sda-logo.png"
              alt="Seventh-day Adventist Church logo"
              className="size-7 object-contain"
            />
          </span>
          <div className="flex flex-col leading-none">
            <span className="text-sm font-bold tracking-tight text-[var(--shell-navy)]">
              KNFC Conference
            </span>
            <span className="mt-1 text-[8px] tracking-[0.13em] text-muted-foreground uppercase">
              Seventh-day Adventist Church
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <AppLogo
            size="sm"
            className="transition-transform duration-300 hover:rotate-3"
          />
          <div className="flex flex-col leading-none">
            <span className="font-display text-xl tracking-wide text-foreground">
              {APP_DISPLAY_NAME}
            </span>
            <span className="mt-0.5 font-mono text-[9px] tracking-wider text-muted-foreground uppercase">
              Automated Presentation Space
            </span>
          </div>
          <span className="ml-2 rounded-md border border-yellow-400/20 bg-yellow-400/10 px-2 py-0.5 font-mono text-[9px] font-semibold tracking-wider text-yellow-700 uppercase dark:text-yellow-400">
            {versionLabel}
          </span>
          <span className="hidden rounded-full bg-[var(--shell-navy)] px-2.5 py-1 text-[9px] font-extrabold tracking-[0.12em] whitespace-nowrap text-[var(--shell-bg-base)] uppercase shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14),0_6px_16px_rgba(11,43,72,0.18)] xl:inline">
            Special Edition
          </span>
        </div>
      </div>

      <div className="flex flex-1 justify-center">
        <WorkspaceTopNav />
      </div>

      <div className="flex items-center gap-3">
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
        <div className="hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--shell-bg-sunken)] px-3 py-1 font-mono text-xs font-semibold tracking-wider text-foreground lg:block">
          {clock}
        </div>
        <div
          className="flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--shell-bg-sunken)] p-1"
          data-tour="theme"
        >
          <span className="hidden px-2 font-mono text-[10px] font-bold text-muted-foreground uppercase sm:inline">
            Theme:
          </span>
          {ACCENT_SWATCHES.map((swatch) => (
            <button
              key={swatch.id}
              type="button"
              title={swatch.title}
              aria-label={swatch.title}
              aria-pressed={theme === swatch.id}
              onClick={() => setTheme(swatch.id)}
              className={cn(
                "btn-action size-[18px] rounded-md border border-[var(--border-subtle)] transition-all hover:scale-125",
                swatch.className,
                theme === swatch.id && "ring-2 ring-[var(--accent-border)]"
              )}
            />
          ))}
        </div>
      </div>
    </header>
  )
}
