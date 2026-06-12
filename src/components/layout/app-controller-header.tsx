import { useEffect, useState } from "react"
import { Trash2Icon } from "lucide-react"
import { cn } from "@/lib/utils"
import { APP_DISPLAY_NAME } from "@/lib/app-brand"
import { AppLogo } from "@/components/ui/app-logo"
import {
  useAccentThemeStore,
  type AccentTheme,
} from "@/stores/accent-theme-store"
import { isTauriRuntime } from "@/lib/tauri-runtime"
import { blackoutOutput } from "@/lib/operator-actions"
import packageJson from "../../../package.json"

const ACCENT_SWATCHES: { id: AccentTheme; className: string; title: string }[] =
  [
    { id: "gold", className: "bg-yellow-400", title: "Sunrise Gold" },
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

export function AppControllerHeader() {
  const theme = useAccentThemeStore((s) => s.theme)
  const setTheme = useAccentThemeStore((s) => s.setTheme)
  const [clock, setClock] = useState(() => formatClock(new Date()))

  useEffect(() => {
    const id = window.setInterval(() => setClock(formatClock(new Date())), 1000)
    return () => window.clearInterval(id)
  }, [])

  const versionLabel = `v${packageJson.version}`

  return (
    <header className="z-50 flex h-[56px] shrink-0 items-center justify-between border-b border-[rgba(255,255,255,0.06)] bg-[#02040a]/90 px-6 backdrop-blur-xl">
      <div className="flex items-center gap-5">
        <div className="flex items-center gap-3">
          <AppLogo
            size="sm"
            className="transition-transform duration-300 hover:rotate-3"
          />
          <div className="flex flex-col leading-none">
            <span className="font-display text-xl tracking-wide text-white">
              {APP_DISPLAY_NAME}
            </span>
            <span className="mt-0.5 font-mono text-[9px] tracking-wider text-slate-500 uppercase">
              Automated Presentation Space
            </span>
          </div>
          <span className="ml-2 rounded-md border border-yellow-400/20 bg-yellow-400/10 px-2 py-0.5 font-mono text-[9px] font-semibold tracking-wider text-yellow-400 uppercase">
            {versionLabel}
          </span>
        </div>
      </div>

      <div className="hidden items-center gap-6 font-mono text-sm text-slate-400 md:flex">
        <div className="flex items-center gap-2 rounded-lg border border-white/5 bg-slate-900/50 px-3 py-1 text-xs">
          <span className="size-2 animate-pulse rounded-full bg-emerald-500" />
          <span>
            {isTauriRuntime() ? "DESKTOP CORE: ACTIVE" : "WEB PREVIEW: ACTIVE"}
          </span>
        </div>
        <div className="rounded-lg border border-white/5 bg-slate-950/60 px-3 py-1 text-xs font-semibold tracking-wider text-slate-100">
          {clock}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div
          className="flex items-center gap-1.5 rounded-lg border border-white/5 bg-slate-900/60 p-1"
          data-tour="theme"
        >
          <span className="hidden px-2 font-mono text-[10px] font-bold text-slate-400 uppercase sm:inline">
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
                "btn-action size-[18px] rounded-md border border-white/10 transition-all hover:scale-125",
                swatch.className,
                theme === swatch.id && "ring-2 ring-white/40"
              )}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={blackoutOutput}
          className="btn-action flex items-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/25"
        >
          <Trash2Icon className="size-[13px]" strokeWidth={2} />
          <span>Blackout Output</span>
        </button>
      </div>
    </header>
  )
}
