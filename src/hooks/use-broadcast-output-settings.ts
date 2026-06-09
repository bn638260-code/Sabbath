import { useState, useEffect, useCallback } from "react"
import { invokeTauri } from "@/lib/tauri-runtime"
import { emitTo } from "@tauri-apps/api/event"
import { getAllWindows } from "@tauri-apps/api/window"
import {
  buildOpenBroadcastWindowArgs,
  parseMonitorIndex,
  type BroadcastOutputId,
} from "@/components/broadcast/broadcast-settings-wiring"
import {
  buildNdiConfigPayload,
  buildNdiStartRequest,
  getBroadcastWindowLabel,
  getDefaultOutputSettings,
  type BroadcastOutputType,
} from "@/lib/broadcast-output-settings"
import { useBroadcastStore } from "@/stores/broadcast-store"
import type { NdiAlphaMode, NdiFrameRate, NdiResolution, NdiSessionInfo } from "@/types"
import { toast } from "sonner"

export interface MonitorInfo {
  name: string
  width: number
  height: number
}

export interface UseBroadcastOutputSettingsOptions {
  open: boolean
  ndiSdkInstalled: boolean
}

function showBroadcastError(title: string, error: unknown) {
  toast.error(title, { description: String(error) })
}

export async function reconcileBroadcastPreviewState(
  outputId: BroadcastOutputId,
): Promise<boolean> {
  const label = getBroadcastWindowLabel(outputId)
  const windows = await getAllWindows()
  return windows.some((w) => w.label === label)
}

export interface BroadcastOutputCommandState {
  outputId: BroadcastOutputId
  isPreviewOpen: boolean
  selectedMonitor: string
  projectorFullscreen: boolean
  ndiActive: boolean
  ndiSourceName: string
  ndiResolution: NdiResolution
  ndiFrameRate: NdiFrameRate
  ndiAlphaMode: NdiAlphaMode
  ndiSdkInstalled: boolean
}

export async function runToggleBroadcastPreview(
  state: BroadcastOutputCommandState,
  deps: {
    invoke: typeof invokeTauri
    syncBroadcastOutputFor: (outputId: string) => void
    emitNdiConfig: (
      active: boolean,
      frameRate: NdiFrameRate,
      resolution: NdiResolution,
    ) => void
    onPreviewOpenChange: (open: boolean) => void
    onError: (title: string, error: unknown) => void
  },
): Promise<void> {
  const { outputId, isPreviewOpen, selectedMonitor, projectorFullscreen, ndiActive, ndiFrameRate, ndiResolution } =
    state

  try {
    if (isPreviewOpen) {
      await deps.invoke("close_broadcast_window", { outputId })
      deps.onPreviewOpenChange(await reconcileBroadcastPreviewState(outputId))
    } else {
      await deps.invoke("open_broadcast_window", {
        ...buildOpenBroadcastWindowArgs(outputId, selectedMonitor, projectorFullscreen),
      })
      const opened = await reconcileBroadcastPreviewState(outputId)
      deps.onPreviewOpenChange(opened)
      if (!opened) return
      deps.syncBroadcastOutputFor(outputId)
      deps.emitNdiConfig(ndiActive, ndiFrameRate, ndiResolution)
      setTimeout(() => {
        deps.syncBroadcastOutputFor(outputId)
      }, 150)
    }
  } catch (error) {
    deps.onError(
      outputId === "alt" ? "Could not toggle alternate preview" : "Could not toggle broadcast preview",
      error,
    )
  }
}

export async function runToggleBroadcastNdi(
  state: BroadcastOutputCommandState,
  deps: {
    invoke: typeof invokeTauri
    syncBroadcastOutputFor: (outputId: string) => void
    emitNdiConfig: (
      active: boolean,
      frameRate: NdiFrameRate,
      resolution: NdiResolution,
    ) => void
    emitPostStartNdiConfig: (session: NdiSessionInfo) => void
    onNdiActiveChange: (active: boolean) => void
    onError: (title: string, error: unknown) => void
    onNdiSdkMissing: () => void
  },
): Promise<void> {
  const {
    outputId,
    isPreviewOpen,
    ndiActive,
    ndiSdkInstalled,
    ndiSourceName,
    ndiResolution,
    ndiFrameRate,
    ndiAlphaMode,
  } = state

  try {
    if (!ndiActive && !ndiSdkInstalled) {
      deps.onNdiSdkMissing()
      return
    }

    const windowLabel = getBroadcastWindowLabel(outputId)

    if (ndiActive) {
      await deps.invoke("stop_ndi", { outputId })
      deps.emitNdiConfig(false, ndiFrameRate, ndiResolution)
      deps.onNdiActiveChange(false)
      if (!isPreviewOpen) {
        await deps.invoke("close_broadcast_window", { outputId }).catch((error) =>
          console.warn(
            `[broadcast-settings] close ${outputId} window after NDI stop failed`,
            error,
          ),
        )
      }
    } else {
      await deps.invoke("ensure_broadcast_window", { outputId })
      const request = buildNdiStartRequest(
        ndiSourceName,
        ndiResolution,
        ndiFrameRate,
        ndiAlphaMode,
      )
      const session = await deps.invoke<NdiSessionInfo>("start_ndi", { outputId, request })
      deps.onNdiActiveChange(true)
      deps.syncBroadcastOutputFor(outputId)
      void emitTo(windowLabel, "broadcast:ndi-config", {
        active: true,
        fps: session.fps,
        width: session.width,
        height: session.height,
      }).catch((error) =>
        console.warn(
          `[broadcast-settings] emit post-start sync (${outputId}) failed`,
          error,
        ),
      )
      setTimeout(() => {
        deps.syncBroadcastOutputFor(outputId)
        deps.emitNdiConfig(true, ndiFrameRate, ndiResolution)
      }, 300)
    }
  } catch (error) {
    deps.onError(
      outputId === "alt" ? "Could not toggle alternate NDI output" : "Could not toggle NDI output",
      error,
    )
  }
}

export async function runDisableBroadcastOutput(
  state: Pick<BroadcastOutputCommandState, "outputId" | "isPreviewOpen" | "ndiActive" | "ndiFrameRate" | "ndiResolution">,
  deps: {
    invoke: typeof invokeTauri
    emitNdiConfig: (
      active: boolean,
      frameRate: NdiFrameRate,
      resolution: NdiResolution,
    ) => void
    onPreviewOpenChange: (open: boolean) => void
    onNdiActiveChange: (active: boolean) => void
    onError: (title: string, error: unknown) => void
  },
): Promise<void> {
  const { outputId, isPreviewOpen, ndiActive, ndiFrameRate, ndiResolution } = state

  if (isPreviewOpen) {
    try {
      await deps.invoke("close_broadcast_window", { outputId })
    } catch (error) {
      deps.onError(
        outputId === "alt"
          ? "Could not close alternate broadcast preview"
          : "Could not close broadcast preview",
        error,
      )
    }
    deps.onPreviewOpenChange(false)
  }

  if (ndiActive) {
    try {
      await deps.invoke("stop_ndi", { outputId })
    } catch (error) {
      deps.onError(
        outputId === "alt" ? "Could not stop alternate NDI output" : "Could not stop NDI output",
        error,
      )
    }
    deps.emitNdiConfig(false, ndiFrameRate, ndiResolution)
    deps.onNdiActiveChange(false)
  }
}

export function useBroadcastOutputSettings(
  outputId: BroadcastOutputId,
  options: UseBroadcastOutputSettingsOptions,
) {
  const { open, ndiSdkInstalled } = options
  const defaults = getDefaultOutputSettings(outputId)

  const themes = useBroadcastStore((s) => s.themes)
  const activeThemeId = useBroadcastStore((s) =>
    outputId === "alt" ? s.altActiveThemeId : s.activeThemeId,
  )
  const displayMonitorIndex = useBroadcastStore((s) =>
    outputId === "alt" ? s.altDisplayMonitorIndex : s.mainDisplayMonitorIndex,
  )
  const projectorFullscreen = useBroadcastStore((s) =>
    outputId === "alt" ? s.altProjectorFullscreen : s.mainProjectorFullscreen,
  )

  const [enabled, setEnabled] = useState(false)
  const [themeId, setThemeId] = useState(activeThemeId)
  const [outputType, setOutputType] = useState<BroadcastOutputType>(defaults.outputType)
  const [selectedMonitor, setSelectedMonitor] = useState(String(displayMonitorIndex))
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [ndiSourceName, setNdiSourceName] = useState(defaults.ndiSourceName)
  const [ndiResolution, setNdiResolution] = useState<NdiResolution>(defaults.ndiResolution)
  const [ndiFrameRate, setNdiFrameRate] = useState<NdiFrameRate>(defaults.ndiFrameRate)
  const [ndiAlphaMode, setNdiAlphaMode] = useState<NdiAlphaMode>(defaults.ndiAlphaMode)
  const [ndiActive, setNdiActive] = useState(false)

  const syncNdiConfigToOutput = useCallback(
    (active: boolean, frameRate: NdiFrameRate, resolution: NdiResolution) => {
      const label = getBroadcastWindowLabel(outputId)
      const payload = buildNdiConfigPayload(active, frameRate, resolution)
      void emitTo(label, "broadcast:ndi-config", payload).catch((error) =>
        console.warn("[broadcast-settings] emit ndi-config failed", error),
      )
    },
    [outputId],
  )

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setThemeId(activeThemeId)
    }, 0)
    return () => clearTimeout(timeoutId)
  }, [activeThemeId])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setSelectedMonitor(String(displayMonitorIndex))
    }, 0)
    return () => clearTimeout(timeoutId)
  }, [displayMonitorIndex])

  useEffect(() => {
    if (!open || !isPreviewOpen) return

    const intervalId = setInterval(() => {
      void reconcileBroadcastPreviewState(outputId).then(setIsPreviewOpen)
    }, 750)

    return () => {
      clearInterval(intervalId)
    }
  }, [open, isPreviewOpen, outputId])

  const handleThemeChange = useCallback(
    (id: string) => {
      setThemeId(id)
      if (outputId === "alt") {
        useBroadcastStore.getState().setAltActiveTheme(id)
      } else {
        useBroadcastStore.getState().setActiveTheme(id)
      }
    },
    [outputId],
  )

  const handleMonitorChange = useCallback(
    (value: string) => {
      setSelectedMonitor(value)
      const index = parseMonitorIndex(value)
      if (outputId === "alt") {
        useBroadcastStore.getState().setAltDisplayMonitorIndex(index)
      } else {
        useBroadcastStore.getState().setMainDisplayMonitorIndex(index)
      }
    },
    [outputId],
  )

  const handleProjectorFullscreenChange = useCallback(
    (checked: boolean) => {
      if (outputId === "alt") {
        useBroadcastStore.getState().setAltProjectorFullscreen(checked)
      } else {
        useBroadcastStore.getState().setMainProjectorFullscreen(checked)
      }
    },
    [outputId],
  )

  const buildCommandState = (): BroadcastOutputCommandState => ({
    outputId,
    isPreviewOpen,
    selectedMonitor,
    projectorFullscreen,
    ndiActive,
    ndiSourceName,
    ndiResolution,
    ndiFrameRate,
    ndiAlphaMode,
    ndiSdkInstalled,
  })

  const buildCommandDeps = () => ({
    invoke: invokeTauri,
    syncBroadcastOutputFor: useBroadcastStore.getState().syncBroadcastOutputFor,
    emitNdiConfig: syncNdiConfigToOutput,
    onPreviewOpenChange: setIsPreviewOpen,
    onNdiActiveChange: setNdiActive,
    onError: showBroadcastError,
    onNdiSdkMissing: () => {
      toast.error("NDI SDK is missing", {
        description: "Run bun run download:ndi-sdk, then refresh SDK status.",
      })
    },
    emitPostStartNdiConfig: () => {},
  })

  const handleTogglePreview = async () => {
    await runToggleBroadcastPreview(buildCommandState(), buildCommandDeps())
  }

  const handleToggleNdi = async () => {
    await runToggleBroadcastNdi(buildCommandState(), buildCommandDeps())
  }

  const handleToggleEnabled = async (nextEnabled: boolean) => {
    setEnabled(nextEnabled)
    if (!nextEnabled) {
      await runDisableBroadcastOutput(buildCommandState(), buildCommandDeps())
    }
  }

  return {
    outputId,
    enabled,
    themeId,
    themes,
    outputType,
    selectedMonitor,
    isPreviewOpen,
    projectorFullscreen,
    ndiSourceName,
    ndiResolution,
    ndiFrameRate,
    ndiAlphaMode,
    ndiActive,
    setOutputType,
    setNdiSourceName,
    setNdiResolution,
    setNdiFrameRate,
    setNdiAlphaMode,
    handleThemeChange,
    handleMonitorChange,
    handleProjectorFullscreenChange,
    handleTogglePreview,
    handleToggleNdi,
    handleToggleEnabled,
    syncNdiConfigToOutput,
  }
}

export type BroadcastOutputSettingsModel = ReturnType<typeof useBroadcastOutputSettings>
