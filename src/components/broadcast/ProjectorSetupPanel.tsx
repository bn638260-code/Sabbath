import { useEffect, useMemo, useState } from "react"
import {
  ChevronDownIcon,
  ExternalLinkIcon,
  Maximize2Icon,
  MonitorIcon,
  MonitorXIcon,
  PlayIcon,
  ScanSearchIcon,
  SettingsIcon,
} from "lucide-react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { invokeTauri } from "@/lib/tauri-runtime"
import type { MonitorInfo } from "@/components/broadcast/broadcast-settings-wiring"
import { useBroadcastOutputSettings } from "@/hooks/use-broadcast-output-settings"
import {
  broadcastOutputBlockedReason,
  canEnableBroadcastOutput,
} from "@/lib/broadcast-output-readiness"
import { useBroadcastMonitorStore } from "@/stores/broadcast/monitor-store"
import { useProjectorSetupStore } from "@/stores/projector-setup-store"
import { deriveProjectorReadiness } from "@/lib/projector-setup/projector-readiness"
import {
  projectorReadinessCopy,
  type ProjectorChipTone,
} from "@/lib/projector-setup/projector-readiness-copy"
import { parseRememberedSetupKey } from "@/lib/projector-setup/remembered-setup-key"
import { resolveRestoreTargetKey } from "@/lib/projector-setup/restore"

const TONE_BANNER: Record<ProjectorChipTone, string> = {
  live: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
  ready: "border-teal-400/30 bg-teal-400/10 text-teal-800 dark:text-teal-200",
  warn: "border-amber-400/35 bg-amber-400/10 text-amber-800 dark:text-amber-100",
  neutral:
    "border-[var(--border-subtle)] bg-[var(--shell-bg-sunken)] text-muted-foreground",
}

async function openDisplaySettings(): Promise<void> {
  try {
    const { openUrl } = await import("@tauri-apps/plugin-opener")
    await openUrl("ms-settings:display")
  } catch {
    toast.error("Couldn't open Windows display settings", {
      description: "Press Win+P instead, then choose Extend.",
    })
  }
}

export function ProjectorSetupPanel() {
  const open = useProjectorSetupStore((s) => s.open)
  const setOpen = useProjectorSetupStore((s) => s.setOpen)
  const monitors = useProjectorSetupStore((s) => s.monitors)

  // Drive the panel off the same Main output model the Broadcast Settings card
  // uses, so the toggle, this panel, and that card are one source of truth.
  const model = useBroadcastOutputSettings("main", {
    open,
    ndiSdkInstalled: false,
    monitors,
  })

  const rememberedKey = useBroadcastMonitorStore((s) => s.mainDisplayMonitorKey)
  const rememberedFullscreen = useBroadcastMonitorStore(
    (s) => s.mainProjectorFullscreen,
  )
  const remembered = useMemo(
    () => parseRememberedSetupKey(rememberedKey, rememberedFullscreen),
    [rememberedKey, rememberedFullscreen],
  )

  const [showHelp, setShowHelp] = useState(false)
  // "Go live" changes the target monitor first, then enables once the model has
  // applied that selection (avoids opening on a stale monitor).
  const [pendingEnableKey, setPendingEnableKey] = useState<string | null>(null)

  useEffect(() => {
    if (pendingEnableKey === null) return
    if (model.selectedMonitor !== pendingEnableKey) return
    setPendingEnableKey(null)
    void model.handleToggleEnabled(true)
  }, [pendingEnableKey, model.selectedMonitor, model.handleToggleEnabled])

  const isLive = model.enabled
  const readiness = deriveProjectorReadiness({ monitors, remembered, isLive })
  const copy = projectorReadinessCopy(readiness)
  const restoreTarget = resolveRestoreTargetKey(monitors, remembered)

  const canEnable = canEnableBroadcastOutput(model, monitors, false)
  const blockedReason = broadcastOutputBlockedReason(model, monitors, false)
  const settingsLocked = model.enabled

  function goLive(): void {
    const targetKey = restoreTarget
    if (!targetKey) return
    model.handleProjectorFullscreenChange(remembered?.fullscreen ?? true)
    if (model.selectedMonitor === targetKey) {
      void model.handleToggleEnabled(true)
    } else {
      model.handleMonitorChange(targetKey)
      setPendingEnableKey(targetKey)
    }
  }

  async function identify(): Promise<void> {
    try {
      await invokeTauri("flash_monitor_labels", { durationMs: 4000 })
    } catch (error) {
      toast.error("Couldn't identify screens", { description: String(error) })
    }
  }

  const primaryDisabled =
    model.enabledPending ||
    copy.primaryKind === "none" ||
    (copy.primaryKind === "restore" && !restoreTarget)

  function onPrimary(): void {
    if (copy.primaryKind === "restore") goLive()
    else if (copy.primaryKind === "hide") void model.handleToggleEnabled(false)
    else if (copy.primaryKind === "open-display-settings")
      void openDisplaySettings()
  }

  const PrimaryIcon =
    copy.primaryKind === "hide"
      ? MonitorXIcon
      : copy.primaryKind === "open-display-settings"
        ? SettingsIcon
        : PlayIcon

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        data-tour="projector-setup-panel"
        className="gap-4 sm:max-w-[460px]"
        showCloseButton={true}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MonitorIcon className="size-4 text-muted-foreground" />
            Projector Setup
          </DialogTitle>
          <DialogDescription>
            Get today's service showing on the projector.
          </DialogDescription>
        </DialogHeader>

        <div
          className={cn(
            "rounded-lg border px-3 py-2.5 text-sm",
            TONE_BANNER[copy.chipTone],
          )}
        >
          <p className="font-semibold">{copy.title}</p>
          <p className="mt-0.5 text-xs opacity-90">{copy.body}</p>
        </div>

        <Button
          size="lg"
          data-tour="projector-go-live"
          disabled={primaryDisabled}
          onClick={onPrimary}
          className="h-12 w-full gap-2 text-base"
        >
          <PrimaryIcon className="size-5" />
          {copy.primaryLabel}
        </Button>

        {/* The Main output master switch — the same on/off state as
            Broadcast Settings > Main Output. Nothing shows to the audience
            until this is On. */}
        <div className="space-y-1.5">
          <div
            data-tour="projector-main-output-toggle"
            className="flex items-center justify-between rounded-lg border border-[var(--border-subtle)] bg-[var(--shell-bg-sunken)] px-3 py-2.5"
          >
            <div className="flex items-center gap-2">
              <MonitorIcon className="size-4 text-muted-foreground" />
              <div className="leading-tight">
                <p className="text-sm font-medium">Main output</p>
                <p className="text-[11px] text-muted-foreground">
                  Nothing shows to the audience until this is On.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "text-xs font-medium",
                  model.enabled ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {model.enabled ? "On" : "Off"}
              </span>
              <Switch
                checked={model.enabled}
                disabled={model.enabledPending || (!model.enabled && !canEnable)}
                title={blockedReason ?? undefined}
                onCheckedChange={(value) => void model.handleToggleEnabled(value)}
              />
            </div>
          </div>
          {blockedReason && !model.enabled ? (
            <p className="rounded-md border border-amber-500/25 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-800 dark:text-amber-100/90">
              {blockedReason}
            </p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Projector screen</label>
          <Select
            value={model.selectedMonitor}
            onValueChange={model.handleMonitorChange}
            disabled={settingsLocked || monitors.length === 0}
          >
            <SelectTrigger
              className="w-full"
              disabled={settingsLocked || monitors.length === 0}
            >
              <SelectValue
                placeholder={
                  monitors.length === 0
                    ? "No screens detected"
                    : "Choose a screen"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {monitors.map((monitor: MonitorInfo) => (
                <SelectItem key={monitor.key} value={monitor.key}>
                  {monitor.name} ({monitor.width}&times;{monitor.height})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={monitors.length === 0}
            onClick={() => void identify()}
          >
            <ScanSearchIcon className="size-3.5" />
            Identify screens
          </Button>

          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Maximize2Icon className="size-3.5" />
            Fullscreen
            <Switch
              checked={model.projectorFullscreen}
              disabled={settingsLocked}
              onCheckedChange={model.handleProjectorFullscreenChange}
            />
          </label>
        </div>

        <div className="border-t border-[var(--border-subtle)] pt-2">
          <button
            type="button"
            onClick={() => setShowHelp((value) => !value)}
            className="flex w-full items-center justify-between text-xs text-muted-foreground hover:text-foreground"
          >
            <span>Projector not working?</span>
            <ChevronDownIcon
              className={cn(
                "size-3.5 transition-transform",
                showHelp && "rotate-180",
              )}
            />
          </button>
          {showHelp ? (
            <div className="mt-2 space-y-2 text-xs text-muted-foreground">
              <ol className="list-decimal space-y-1 pl-4">
                <li>Connect the HDMI cable from this computer to the projector.</li>
                <li>
                  Press <span className="font-semibold">Win+P</span> and choose{" "}
                  <span className="font-semibold">Extend</span> (not Duplicate).
                </li>
                <li>Use Identify screens to confirm which one is the projector.</li>
              </ol>
              <Button
                variant="ghost"
                size="xs"
                className="gap-1.5 text-[0.7rem]"
                onClick={() => void openDisplaySettings()}
              >
                <ExternalLinkIcon className="size-3" />
                Open Windows display settings
              </Button>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
