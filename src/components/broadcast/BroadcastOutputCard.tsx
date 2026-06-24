import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import {
  NDI_COMING_SOON_DESCRIPTION,
  NDI_COMING_SOON_MESSAGE,
} from "@/lib/broadcast-output-settings"
import { cn } from "@/lib/utils"
import type { BroadcastOutputSettingsModel } from "@/hooks/use-broadcast-output-settings"
import type { MonitorInfo } from "@/hooks/use-broadcast-output-settings"
import {
  MonitorIcon,
  CastIcon,
  EyeIcon,
  EyeOffIcon,
  RefreshCwIcon,
  RadioIcon,
  Maximize2Icon,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import {
  broadcastOutputBlockedReason,
  canEnableBroadcastOutput,
} from "@/lib/broadcast-output-readiness"

export interface BroadcastOutputCardProps {
  title: string
  titleIcon: LucideIcon
  model: BroadcastOutputSettingsModel
  monitors: MonitorInfo[]
  monitorsRefreshing: boolean
  onRefreshMonitors: () => void
  ndiSdkInstalled: boolean
}

function OutputTypeSelector({
  model,
  settingsLocked,
}: {
  model: BroadcastOutputSettingsModel
  settingsLocked: boolean
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs text-muted-foreground">Output Type</label>
      <div className="grid grid-cols-2 gap-1.5">
        <button
          type="button"
          disabled={settingsLocked}
          onClick={() => model.setOutputType("display")}
          className={cn(
            "flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-xs font-medium transition-all",
            settingsLocked && "cursor-not-allowed opacity-50",
            model.outputType === "display"
              ? "border-lime-500/50 bg-lime-500/15 text-lime-400"
              : "border-[var(--border-subtle)] bg-[var(--shell-code-bg)] text-muted-foreground hover:text-foreground",
          )}
        >
          <MonitorIcon className="size-3.5" />
          HDMI / Display
        </button>
        <button
          type="button"
          disabled
          title={NDI_COMING_SOON_MESSAGE}
          className={cn(
            "flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-xs font-medium transition-all",
            "cursor-not-allowed opacity-50",
            model.outputType === "ndi"
              ? "border-lime-500/50 bg-lime-500/15 text-lime-400"
              : "border-[var(--border-subtle)] bg-[var(--shell-code-bg)] text-muted-foreground hover:text-foreground",
          )}
        >
          <RadioIcon className="size-3.5" />
          NDI
          <Badge variant="secondary" className="ml-1 text-[0.55rem]">
            Soon
          </Badge>
        </button>
      </div>
    </div>
  )
}

function DisplayOutputSettings({
  model,
  monitors,
  monitorsRefreshing,
  onRefreshMonitors,
  settingsLocked,
}: {
  model: BroadcastOutputSettingsModel
  monitors: MonitorInfo[]
  monitorsRefreshing: boolean
  onRefreshMonitors: () => void
  settingsLocked: boolean
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs text-muted-foreground">Target Monitor</label>
          <Button
            variant="ghost"
            size="xs"
            disabled={monitorsRefreshing}
            onClick={onRefreshMonitors}
            className="h-5 gap-1 px-1.5 text-[0.625rem] text-muted-foreground"
          >
            <RefreshCwIcon
              className={cn("size-3", monitorsRefreshing && "animate-spin")}
            />
            Refresh
          </Button>
        </div>
        <Select
          value={model.selectedMonitor}
          onValueChange={model.handleMonitorChange}
          disabled={settingsLocked || monitors.length === 0}
        >
          <SelectTrigger className="w-full" disabled={monitors.length === 0}>
            <SelectValue
              placeholder={
                monitors.length === 0 ? "No monitors detected" : "Select monitor"
              }
            />
          </SelectTrigger>
          <SelectContent>
            {monitors.map((m) => (
              <SelectItem key={m.key} value={m.key}>
                {m.name} ({m.width}&times;{m.height})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border border-[var(--border-dim)] bg-[var(--shell-bg-sunken)] px-3 py-2 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">HDMI setup</p>
        <ol className="mt-2 list-decimal space-y-1 pl-4">
          <li>Connect the HDMI cable from this computer to the projector or TV.</li>
          <li>In Windows display settings, choose Extend these displays.</li>
          <li>Click Refresh, select the HDMI monitor, then use Open Preview.</li>
          <li>Turn on Fullscreen projector before the service starts.</li>
        </ol>
      </div>

      <div className="flex items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <Maximize2Icon className="size-3.5" />
          Fullscreen projector
        </label>
        <Switch
          checked={model.projectorFullscreen}
          disabled={settingsLocked}
          onCheckedChange={model.handleProjectorFullscreenChange}
        />
      </div>

      <Button
        variant="outline"
        size="sm"
        className="w-full gap-1.5"
        disabled={monitors.length === 0 || model.previewPending}
        onClick={model.handleTogglePreview}
      >
        {model.isPreviewOpen ? (
          <>
            <EyeOffIcon className="size-3.5" />
            Close Preview
          </>
        ) : (
          <>
            <EyeIcon className="size-3.5" />
            Open Preview
          </>
        )}
      </Button>
    </div>
  )
}

function NdiOutputSettings({
  model,
}: {
  model: BroadcastOutputSettingsModel
}) {
  return (
    <div className="space-y-3">
      <div className="rounded-md border border-amber-500/25 bg-amber-500/10 p-3">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-[0.625rem]">
            Coming soon
          </Badge>
          <p className="text-xs font-medium text-amber-50">
            {NDI_COMING_SOON_MESSAGE}
          </p>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-amber-100/80">
          {NDI_COMING_SOON_DESCRIPTION}
        </p>
      </div>

      {model.ndiActive ? (
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-1.5 border-emerald-500/50 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-400"
          onClick={model.handleToggleNdi}
          disabled={model.ndiPending}
        >
          <CastIcon className="size-3.5" />
          Stop NDI
        </Button>
      ) : null}
    </div>
  )
}

export function BroadcastOutputCard({
  title,
  titleIcon: TitleIcon,
  model,
  monitors,
  monitorsRefreshing,
  onRefreshMonitors,
  ndiSdkInstalled,
}: BroadcastOutputCardProps) {
  const canEnable = canEnableBroadcastOutput(model, monitors, ndiSdkInstalled)
  const blockedReason = broadcastOutputBlockedReason(
    model,
    monitors,
    ndiSdkInstalled,
  )
  const settingsLocked = model.enabled

  return (
    <div className="glass-panel relative space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TitleIcon className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">{title}</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "text-xs",
              model.enabled ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {model.enabled ? "On" : "Off"}
          </span>
          <Switch
            checked={model.enabled}
            disabled={model.enabledPending || (!model.enabled && !canEnable)}
            title={blockedReason ?? undefined}
            onCheckedChange={model.handleToggleEnabled}
          />
        </div>
      </div>

      {blockedReason && !model.enabled ? (
        <p className="rounded-md border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-100/90">
          {blockedReason}
        </p>
      ) : null}

      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground">Theme</label>
        <Select
          value={model.themeId}
          onValueChange={model.handleThemeChange}
          disabled={settingsLocked}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {model.themes.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <OutputTypeSelector model={model} settingsLocked={settingsLocked} />

      {model.outputType === "display" ? (
        <DisplayOutputSettings
          model={model}
          monitors={monitors}
          monitorsRefreshing={monitorsRefreshing}
          onRefreshMonitors={onRefreshMonitors}
          settingsLocked={settingsLocked}
        />
      ) : (
        <NdiOutputSettings model={model} />
      )}
    </div>
  )
}
