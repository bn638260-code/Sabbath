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
import {
  clampMonitorIndex,
  normalizeMonitorList,
  resolveMonitorIndexFromKey,
  shouldPersistResolvedMonitorKey,
  type MonitorInfo,
} from "@/components/broadcast/broadcast-settings-wiring"
import { BroadcastOutputCard } from "@/components/broadcast/BroadcastOutputCard"
import { useAssets } from "@/hooks/use-assets"
import { useBroadcastOutputSettings } from "@/hooks/use-broadcast-output-settings"
import { useBroadcastLiveStore } from "@/stores/broadcast/live-store"
import { useBroadcastMonitorStore } from "@/stores/broadcast/monitor-store"
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
  const { status: assetStatus } = useAssets()
  const ndiSdkInstalled = Boolean(assetStatus?.ndi_sdk)

  const [monitors, setMonitors] = useState<MonitorInfo[]>([])
  const [refreshing, setRefreshing] = useState(false)

  const mainOutput = useBroadcastOutputSettings("main", { open, ndiSdkInstalled, monitors })
  const altOutput = useBroadcastOutputSettings("alt", { open, ndiSdkInstalled, monitors })
  const {
    syncNdiConfigToOutput: syncMainNdiConfigToOutput,
    ndiActive: mainNdiActive,
    ndiFrameRate: mainNdiFrameRate,
    ndiResolution: mainNdiResolution,
  } = mainOutput
  const {
    syncNdiConfigToOutput: syncAltNdiConfigToOutput,
    ndiActive: altNdiActive,
    ndiFrameRate: altNdiFrameRate,
    ndiResolution: altNdiResolution,
  } = altOutput

  const fetchMonitors = useCallback(async () => {
    setRefreshing(true)
    try {
      const result = normalizeMonitorList(await invokeTauri<MonitorInfo[]>("list_monitors"))
      setMonitors(result)

      const store = useBroadcastMonitorStore.getState()
      const mainIndex = resolveMonitorIndexFromKey(
        result,
        store.mainDisplayMonitorKey,
        clampMonitorIndex(store.mainDisplayMonitorIndex, result.length),
      )
      const altIndex = resolveMonitorIndexFromKey(
        result,
        store.altDisplayMonitorKey,
        clampMonitorIndex(store.altDisplayMonitorIndex, result.length),
      )
      store.setMainDisplayMonitorIndex(mainIndex)
      store.setAltDisplayMonitorIndex(altIndex)
      const mainMonitor = result[mainIndex]
      const altMonitor = result[altIndex]
      if (
        mainMonitor &&
        shouldPersistResolvedMonitorKey(result, store.mainDisplayMonitorKey)
      ) {
        store.setMainDisplayMonitorKey(mainMonitor.key)
      }
      if (
        altMonitor &&
        shouldPersistResolvedMonitorKey(result, store.altDisplayMonitorKey)
      ) {
        store.setAltDisplayMonitorKey(altMonitor.key)
      }
    } catch (error) {
      setMonitors([])
      showBroadcastError("Could not load display monitors", error)
    } finally {
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return

    const warmOutputs = async () => {
      try {
        await Promise.all([
          invokeTauri("ensure_broadcast_window", { outputId: "main" }),
          invokeTauri("ensure_broadcast_window", { outputId: "alt" }),
        ])
      } catch (error) {
        console.warn("[broadcast-settings] prewarm broadcast windows failed", error)
      }
    }

    const timeoutId = setTimeout(() => {
      void warmOutputs()
      void fetchMonitors()
    }, 0)

    return () => clearTimeout(timeoutId)
  }, [open, fetchMonitors])

  useEffect(() => {
    if (!open) return

    let timeoutId: ReturnType<typeof setTimeout> | null = null
    const unlistenPromise = listen("broadcast:output-ready", () => {
      useBroadcastLiveStore.getState().syncBroadcastOutput()
      syncMainNdiConfigToOutput(
        mainNdiActive,
        mainNdiFrameRate,
        mainNdiResolution,
      )
      syncAltNdiConfigToOutput(
        altNdiActive,
        altNdiFrameRate,
        altNdiResolution,
      )
      timeoutId = setTimeout(() => {
        useBroadcastLiveStore.getState().syncBroadcastOutput()
      }, 150)
    })

    return () => {
      if (timeoutId) clearTimeout(timeoutId)
      void unlistenPromise.then((unlisten) => unlisten())
    }
  }, [
    open,
    syncMainNdiConfigToOutput,
    mainNdiActive,
    mainNdiFrameRate,
    mainNdiResolution,
    syncAltNdiConfigToOutput,
    altNdiActive,
    altNdiFrameRate,
    altNdiResolution,
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
            dataTour="broadcast-output-main"
            monitorDataTour="broadcast-monitor-main"
          />
          <BroadcastOutputCard
            title="Alternate Output"
            titleIcon={CastIcon}
            model={altOutput}
            monitors={monitors}
            monitorsRefreshing={refreshing}
            onRefreshMonitors={() => void fetchMonitors()}
            ndiSdkInstalled={ndiSdkInstalled}
            dataTour="broadcast-output-alt"
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
