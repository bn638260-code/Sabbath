import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import {
  NDI_ALPHA_OPTIONS,
  NDI_FRAME_RATE_OPTIONS,
  NDI_RESOLUTION_OPTIONS,
} from "@/lib/broadcast-output-settings"
import { cn } from "@/lib/utils"
import type { BroadcastOutputSettingsModel } from "@/hooks/use-broadcast-output-settings"
import type { MonitorInfo } from "@/hooks/use-broadcast-output-settings"
import type { NdiAlphaMode, NdiFrameRate, NdiResolution } from "@/types"
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
  DEFAULT_NDI_ALT_SOURCE_NAME,
  DEFAULT_NDI_SOURCE_NAME,
} from "@/lib/app-brand"

function NdiSdkStatus({
  installed,
  loading,
  onRefresh,
}: {
  installed: boolean
  loading: boolean
  onRefresh: () => void
}) {
  return (
    <div className="rounded-md border border-white/5 bg-white/5 p-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">NDI SDK</span>
        <div className="flex items-center gap-1.5">
          <Badge variant={installed ? "default" : "secondary"} className="text-[0.625rem]">
            {loading ? "Checking" : installed ? "Installed" : "Missing"}
          </Badge>
          <Button
            variant="ghost"
            size="xs"
            className="h-6 px-2"
            disabled={loading}
            onClick={onRefresh}
          >
            <RefreshCwIcon className={cn("size-3", loading && "animate-spin")} />
          </Button>
        </div>
      </div>
      {!loading && !installed ? (
        <p className="mt-1.5 rounded bg-black/40 px-2 py-1 font-mono text-[0.625rem] text-muted-foreground">
          bun run download:ndi-sdk
        </p>
      ) : null}
    </div>
  )
}

export interface BroadcastOutputCardProps {
  title: string
  titleIcon: LucideIcon
  model: BroadcastOutputSettingsModel
  monitors: MonitorInfo[]
  monitorsRefreshing: boolean
  onRefreshMonitors: () => void
  ndiSdkInstalled: boolean
  assetsLoading: boolean
  onRefreshAssets: () => void
}

export function BroadcastOutputCard({
  title,
  titleIcon: TitleIcon,
  model,
  monitors,
  monitorsRefreshing,
  onRefreshMonitors,
  ndiSdkInstalled,
  assetsLoading,
  onRefreshAssets,
}: BroadcastOutputCardProps) {
  const defaultNdiSourceName =
    model.outputId === "alt" ? DEFAULT_NDI_ALT_SOURCE_NAME : DEFAULT_NDI_SOURCE_NAME

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
          <Switch checked={model.enabled} onCheckedChange={model.handleToggleEnabled} />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground">Theme</label>
        <Select value={model.themeId} onValueChange={model.handleThemeChange}>
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

      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground">Output Type</label>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={() => model.setOutputType("display")}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-xs font-medium transition-all",
              model.outputType === "display"
                ? "border-lime-500/50 bg-lime-500/15 text-lime-400"
                : "border-white/5 bg-black/40 text-muted-foreground hover:text-foreground",
            )}
          >
            <MonitorIcon className="size-3.5" />
            External Display
          </button>
          <button
            onClick={() => model.setOutputType("ndi")}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-xs font-medium transition-all",
              model.outputType === "ndi"
                ? "border-lime-500/50 bg-lime-500/15 text-lime-400"
                : "border-white/5 bg-black/40 text-muted-foreground hover:text-foreground",
            )}
          >
            <RadioIcon className="size-3.5" />
            NDI
          </button>
        </div>
      </div>

      {model.outputType === "display" ? (
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
              disabled={monitors.length === 0}
            >
              <SelectTrigger className="w-full" disabled={monitors.length === 0}>
                <SelectValue
                  placeholder={
                    monitors.length === 0 ? "No monitors detected" : "Select monitor"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {monitors.map((m, i) => (
                  <SelectItem key={i} value={String(i)}>
                    {m.name} ({m.width}&times;{m.height})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Maximize2Icon className="size-3.5" />
              Fullscreen projector
            </label>
            <Switch
              checked={model.projectorFullscreen}
              onCheckedChange={model.handleProjectorFullscreenChange}
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            className="w-full gap-1.5"
            disabled={monitors.length === 0}
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
      ) : (
        <div className="space-y-3">
          <NdiSdkStatus
            installed={ndiSdkInstalled}
            loading={assetsLoading}
            onRefresh={onRefreshAssets}
          />

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Resolution</label>
              <Select
                value={model.ndiResolution}
                onValueChange={(value) => model.setNdiResolution(value as NdiResolution)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NDI_RESOLUTION_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Frame Rate</label>
              <Select
                value={model.ndiFrameRate}
                onValueChange={(value) => model.setNdiFrameRate(value as NdiFrameRate)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NDI_FRAME_RATE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Alpha Channel</label>
            <Select
              value={model.ndiAlphaMode}
              onValueChange={(value) => model.setNdiAlphaMode(value as NdiAlphaMode)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {NDI_ALPHA_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Source Name</label>
            <Input
              value={model.ndiSourceName}
              onChange={(e) => model.setNdiSourceName(e.target.value)}
              placeholder={defaultNdiSourceName}
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            className={cn(
              "w-full gap-1.5",
              model.ndiActive &&
                "border-emerald-500/50 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-400",
            )}
            onClick={model.handleToggleNdi}
            disabled={!model.ndiActive && !assetsLoading && !ndiSdkInstalled}
          >
            {model.ndiActive ? (
              <>
                <CastIcon className="size-3.5" />
                Stop NDI
              </>
            ) : (
              <>
                <CastIcon className="size-3.5" />
                Start NDI
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  )
}
