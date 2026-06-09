import { useState, useEffect, useCallback } from "react"
import { invokeTauri } from "@/lib/tauri-runtime"
import { listen } from "@tauri-apps/api/event"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { clampMonitorIndex } from "@/components/broadcast/broadcast-settings-wiring"
import { BroadcastOutputCard } from "@/components/broadcast/BroadcastOutputCard"
import { useAssets } from "@/hooks/use-assets"
import {
  useBroadcastOutputSettings,
  type MonitorInfo,
} from "@/hooks/use-broadcast-output-settings"
import { useBroadcastStore } from "@/stores/broadcast-store"
import { CastIcon, MonitorIcon } from "lucide-react"
import { toast } from "sonner"

function showBroadcastError(title: string, error: unknown) {
  toast.error(title, { description: String(error) })
}

export function BroadcastSettings({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const mainDisplayMonitorIndex = useBroadcastStore((s) => s.mainDisplayMonitorIndex)
  const altDisplayMonitorIndex = useBroadcastStore((s) => s.altDisplayMonitorIndex)
  const { status: assetStatus, loading: assetsLoading, refresh: refreshAssets } = useAssets()
  const ndiSdkInstalled = Boolean(assetStatus?.ndi_sdk)

  const [monitors, setMonitors] = useState<MonitorInfo[]>([])
  const [refreshing, setRefreshing] = useState(false)

  const mainOutput = useBroadcastOutputSettings("main", { open, ndiSdkInstalled })
  const altOutput = useBroadcastOutputSettings("alt", { open, ndiSdkInstalled })

  const fetchMonitors = useCallback(async () => {
    setRefreshing(true)
    try {
      const result = await invokeTauri<MonitorInfo[]>("list_monitors")
      setMonitors(result)
      const mainIndex = clampMonitorIndex(mainDisplayMonitorIndex, result.length)
      const altIndex = clampMonitorIndex(altDisplayMonitorIndex, result.length)
      useBroadcastStore.getState().setMainDisplayMonitorIndex(mainIndex)
      useBroadcastStore.getState().setAltDisplayMonitorIndex(altIndex)
    } catch (error) {
      setMonitors([])
      showBroadcastError("Could not load display monitors", error)
    } finally {
      setRefreshing(false)
    }
  }, [mainDisplayMonitorIndex, altDisplayMonitorIndex])

  useEffect(() => {
    if (!open) return

    const timeoutId = setTimeout(() => {
      void fetchMonitors()
    }, 0)

    return () => clearTimeout(timeoutId)
  }, [open, fetchMonitors])

  useEffect(() => {
    if (!open) return

    let timeoutId: ReturnType<typeof setTimeout> | null = null
    const unlistenPromise = listen("broadcast:output-ready", () => {
      useBroadcastStore.getState().syncBroadcastOutput()
      mainOutput.syncNdiConfigToOutput(
        mainOutput.ndiActive,
        mainOutput.ndiFrameRate,
        mainOutput.ndiResolution,
      )
      altOutput.syncNdiConfigToOutput(
        altOutput.ndiActive,
        altOutput.ndiFrameRate,
        altOutput.ndiResolution,
      )
      timeoutId = setTimeout(() => {
        useBroadcastStore.getState().syncBroadcastOutput()
      }, 150)
    })

    return () => {
      if (timeoutId) clearTimeout(timeoutId)
      void unlistenPromise.then((unlisten) => unlisten())
    }
  }, [
    open,
    mainOutput,
    altOutput,
  ])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="gap-4 sm:max-w-[700px] dark:max-h-[85vh] dark:overflow-y-auto"
        showCloseButton={true}
      >
        <DialogHeader>
          <DialogTitle>Broadcast</DialogTitle>
          <DialogDescription>
            Configure two independent outputs with different themes.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          <BroadcastOutputCard
            title="Main Output"
            titleIcon={MonitorIcon}
            model={mainOutput}
            monitors={monitors}
            monitorsRefreshing={refreshing}
            onRefreshMonitors={() => void fetchMonitors()}
            ndiSdkInstalled={ndiSdkInstalled}
            assetsLoading={assetsLoading}
            onRefreshAssets={() => void refreshAssets()}
          />
          <BroadcastOutputCard
            title="Alternate Output"
            titleIcon={CastIcon}
            model={altOutput}
            monitors={monitors}
            monitorsRefreshing={refreshing}
            onRefreshMonitors={() => void fetchMonitors()}
            ndiSdkInstalled={ndiSdkInstalled}
            assetsLoading={assetsLoading}
            onRefreshAssets={() => void refreshAssets()}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
