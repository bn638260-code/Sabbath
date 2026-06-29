import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { invokeTauri } from "@/lib/tauri-runtime"
import { emitTo } from "@tauri-apps/api/event"
import { getAllWindows } from "@tauri-apps/api/window"
import {
  buildOpenBroadcastWindowArgs,
  type MonitorInfo,
} from "@/components/broadcast/broadcast-settings-wiring"
import {
  buildNdiConfigPayload,
  getBroadcastWindowLabel,
  getDefaultOutputSettings,
  NDI_COMING_SOON_DESCRIPTION,
  NDI_COMING_SOON_MESSAGE,
  type BroadcastOutputType,
} from "@/lib/broadcast-output-settings"
import { useBroadcastOutputSettingsStore as useBroadcastStore } from "@/stores/broadcast/output-settings-store"
import type {
  BroadcastOutputId,
  NdiAlphaMode,
  NdiFrameRate,
  NdiResolution,
} from "@/types"
import { toast } from "sonner"

export type { MonitorInfo }

export interface UseBroadcastOutputSettingsOptions {
  open: boolean
  ndiSdkInstalled: boolean
  monitors: MonitorInfo[]
}

interface NdiStatusResponse {
  active: boolean
  width: number
  height: number
  fps: number
}

function showBroadcastError(title: string, error: unknown) {
  toast.error(title, { description: String(error) })
}

function mapNdiResolution(width: number, height: number): NdiResolution | null {
  if (width === 3840 && height === 2160) return "r4k"
  if (width === 1920 && height === 1080) return "r1080p"
  if (width === 1280 && height === 720) return "r720p"
  return null
}

function mapNdiFrameRate(fps: number): NdiFrameRate | null {
  if (fps === 24) return "fps24"
  if (fps === 30) return "fps30"
  if (fps === 60) return "fps60"
  return null
}

// Creating the projector WebView window on a freshly connected HDMI display
// can take several seconds (WebView2 cold start + display mode switch). The
// open path waits with this budget, otherwise the open command succeeds but
// the UI reports the connection as failed/not registered. Close/polling
// checks keep the short default, where an absent window is the answer.
export const OPEN_PREVIEW_RECONCILE_OPTIONS = { retries: 24, delayMs: 250 }

export async function reconcileBroadcastPreviewState(
  outputId: BroadcastOutputId,
  options?: { retries?: number; delayMs?: number },
): Promise<boolean> {
  const label = getBroadcastWindowLabel(outputId)
  const retries = options?.retries ?? 8
  const delayMs = options?.delayMs ?? 125

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const windows = await getAllWindows()
    if (windows.some((w) => w.label === label)) {
      return true
    }
    if (attempt < retries) {
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }

  return false
}

async function getBroadcastNdiStatus(
  invoke: typeof invokeTauri,
  outputId: BroadcastOutputId,
): Promise<NdiStatusResponse | null> {
  return invoke<NdiStatusResponse | null>("get_ndi_status", { outputId })
}

export interface BroadcastOutputCommandState {
  outputId: BroadcastOutputId
  isPreviewOpen: boolean
  selectedMonitor: string
  monitors: MonitorInfo[]
  fallbackMonitorIndex: number
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
    emitNdiConfig: (active: boolean, frameRate: NdiFrameRate, resolution: NdiResolution) => void
    onPreviewOpenChange: (open: boolean) => void
    onError: (title: string, error: unknown) => void
    onIssue?: (input: {
      outputId: BroadcastOutputId
      kind: "preview-open" | "broadcast-sync" | "ndi-config"
      title: string
      description: string
    }) => void
    clearOutputIssueFor?: (
      outputId: BroadcastOutputId,
      kind: "preview-open",
    ) => void
  },
): Promise<void> {
  const {
    outputId,
    isPreviewOpen,
    selectedMonitor,
    monitors,
    fallbackMonitorIndex,
    projectorFullscreen,
    ndiActive,
    ndiFrameRate,
    ndiResolution,
  } = state

  try {
    if (isPreviewOpen) {
      await deps.invoke("close_broadcast_window", { outputId })
      deps.onPreviewOpenChange(await reconcileBroadcastPreviewState(outputId))
    } else {
      if (monitors.length === 0) {
        deps.onError(
          outputId === "alt"
            ? "Alternate display output unavailable"
            : "Main display output unavailable",
          "No monitors were detected. Refresh monitors, then try again.",
        )
        return
      }
      await deps.invoke("ensure_broadcast_window", { outputId })
      await deps.invoke("open_broadcast_window", {
        ...buildOpenBroadcastWindowArgs(
          outputId,
          monitors,
          selectedMonitor,
          fallbackMonitorIndex,
          projectorFullscreen,
        ),
      })
      const opened = await reconcileBroadcastPreviewState(
        outputId,
        OPEN_PREVIEW_RECONCILE_OPTIONS,
      )
      deps.onPreviewOpenChange(opened)
      if (!opened) {
        const title =
          outputId === "alt"
            ? "Alternate preview did not open"
            : "Broadcast preview did not open"
        const description =
          "The open command completed, but the preview window was not found."
        deps.onIssue?.({
          outputId,
          kind: "preview-open",
          title,
          description,
        })
        deps.onError(title, description)
        return
      }
      deps.clearOutputIssueFor?.(outputId, "preview-open")
      deps.syncBroadcastOutputFor(outputId)
      deps.emitNdiConfig(ndiActive, ndiFrameRate, ndiResolution)
      setTimeout(() => {
        deps.syncBroadcastOutputFor(outputId)
      }, 150)
    }
  } catch (error) {
    deps.onError(
      outputId === "alt"
        ? "Could not toggle alternate preview"
        : "Could not toggle broadcast preview",
      error,
    )
  }
}

export async function runToggleBroadcastNdi(
  state: BroadcastOutputCommandState,
  deps: {
    invoke: typeof invokeTauri
    emitNdiConfig: (active: boolean, frameRate: NdiFrameRate, resolution: NdiResolution) => void
    onNdiActiveChange: (active: boolean) => void
    onError: (title: string, error: unknown) => void
  },
): Promise<void> {
  const {
    outputId,
    isPreviewOpen,
    ndiActive,
    ndiResolution,
    ndiFrameRate,
  } = state

  try {
    if (!ndiActive) {
      deps.onError(NDI_COMING_SOON_MESSAGE, NDI_COMING_SOON_DESCRIPTION)
      return
    }

    await deps.invoke("stop_ndi", { outputId })
    deps.emitNdiConfig(false, ndiFrameRate, ndiResolution)
    deps.onNdiActiveChange(false)
    if (!isPreviewOpen) {
      await deps
        .invoke("close_broadcast_window", { outputId })
        .catch((error) =>
          console.warn(
            `[broadcast-settings] close ${outputId} window after NDI stop failed`,
            error,
          ),
        )
    }
  } catch (error) {
    deps.onError(
      outputId === "alt" ? "Could not toggle alternate NDI output" : "Could not toggle NDI output",
      error,
    )
  }
}

export async function runDisableBroadcastOutput(
  state: Pick<
    BroadcastOutputCommandState,
    "outputId" | "isPreviewOpen" | "ndiActive" | "ndiFrameRate" | "ndiResolution"
  >,
  deps: {
    invoke: typeof invokeTauri
    emitNdiConfig: (active: boolean, frameRate: NdiFrameRate, resolution: NdiResolution) => void
    onPreviewOpenChange: (open: boolean) => void
    onNdiActiveChange: (active: boolean) => void
    onError: (title: string, error: unknown) => void
  },
): Promise<void> {
  const { outputId, isPreviewOpen, ndiActive, ndiFrameRate, ndiResolution } = state

  let previewOpenBefore = isPreviewOpen
  try {
    previewOpenBefore = isPreviewOpen || (await reconcileBroadcastPreviewState(outputId))
  } catch {
    previewOpenBefore = isPreviewOpen
  }

  let ndiActiveBefore = ndiActive
  try {
    const status = await getBroadcastNdiStatus(deps.invoke, outputId)
    ndiActiveBefore = ndiActive || Boolean(status?.active)
  } catch {
    ndiActiveBefore = ndiActive
  }

  if (previewOpenBefore) {
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
  }

  if (ndiActiveBefore) {
    try {
      await deps.invoke("stop_ndi", { outputId })
      deps.emitNdiConfig(false, ndiFrameRate, ndiResolution)
    } catch (error) {
      deps.onError(
        outputId === "alt" ? "Could not stop alternate NDI output" : "Could not stop NDI output",
        error,
      )
    }
  }

  const previewOpen = await reconcileBroadcastPreviewState(outputId)
  deps.onPreviewOpenChange(previewOpen)

  let ndiStillActive = false
  try {
    const status = await getBroadcastNdiStatus(deps.invoke, outputId)
    ndiStillActive = Boolean(status?.active)
  } catch {
    ndiStillActive = false
  }
  deps.onNdiActiveChange(ndiStillActive)
}

export function useBroadcastOutputSettings(
  outputId: BroadcastOutputId,
  options: UseBroadcastOutputSettingsOptions,
) {
  const { open, ndiSdkInstalled, monitors } = options
  const defaults = getDefaultOutputSettings(outputId)

  const themes = useBroadcastStore((s) => s.themes)
  const activeThemeId = useBroadcastStore((s) =>
    outputId === "alt" ? s.altActiveThemeId : s.activeThemeId,
  )
  const displayMonitorIndex = useBroadcastStore((s) =>
    outputId === "alt" ? s.altDisplayMonitorIndex : s.mainDisplayMonitorIndex,
  )
  const displayMonitorKey = useBroadcastStore((s) =>
    outputId === "alt" ? s.altDisplayMonitorKey : s.mainDisplayMonitorKey,
  )
  const projectorFullscreen = useBroadcastStore((s) =>
    outputId === "alt" ? s.altProjectorFullscreen : s.mainProjectorFullscreen,
  )

  const [themeId, setThemeId] = useState(activeThemeId)
  const [outputType, setOutputType] = useState<BroadcastOutputType>(defaults.outputType)
  const [selectedMonitor, setSelectedMonitor] = useState(displayMonitorKey)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [ndiSourceName, setNdiSourceName] = useState(defaults.ndiSourceName)
  const [ndiResolution, setNdiResolution] = useState<NdiResolution>(defaults.ndiResolution)
  const [ndiFrameRate, setNdiFrameRate] = useState<NdiFrameRate>(defaults.ndiFrameRate)
  const [ndiAlphaMode, setNdiAlphaMode] = useState<NdiAlphaMode>(defaults.ndiAlphaMode)
  const [ndiActive, setNdiActive] = useState(false)
  const [previewPending, setPreviewPending] = useState(false)
  const [ndiPending, setNdiPending] = useState(false)
  const [enabledPending, setEnabledPending] = useState(false)
  const previewPendingRef = useRef(false)
  const ndiPendingRef = useRef(false)
  const enabledPendingRef = useRef(false)
  const previewPendingPromiseRef = useRef<Promise<void> | null>(null)
  const ndiPendingPromiseRef = useRef<Promise<void> | null>(null)
  const enabledPendingPromiseRef = useRef<Promise<void> | null>(null)

  const enabled = isPreviewOpen || ndiActive

  const syncNdiConfigToOutput = useCallback(
    (active: boolean, frameRate: NdiFrameRate, resolution: NdiResolution) => {
      const label = getBroadcastWindowLabel(outputId)
      const payload = buildNdiConfigPayload(active, frameRate, resolution)
      void emitTo(label, "broadcast:ndi-config", payload).catch((error) => {
        console.warn("[broadcast-settings] emit ndi-config failed", error)
        useBroadcastStore.getState().reportOutputIssue({
          outputId,
          kind: "ndi-config",
          title: "NDI config sync failed",
          description: `Could not sync NDI config to ${label}: ${String(error)}`,
        })
      })
    },
    [outputId],
  )

  const applyNdiStatus = useCallback(
    (status: NdiStatusResponse | null, previewOpen: boolean) => {
      if (status?.active) {
        setNdiActive(true)
        setOutputType("ndi")
        const mappedResolution = mapNdiResolution(status.width, status.height)
        const mappedFrameRate = mapNdiFrameRate(status.fps)
        if (mappedResolution) setNdiResolution(mappedResolution)
        if (mappedFrameRate) setNdiFrameRate(mappedFrameRate)
      } else {
        setNdiActive(false)
        if (previewOpen) setOutputType("display")
      }
    },
    [],
  )

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setThemeId(activeThemeId)
    }, 0)
    return () => clearTimeout(timeoutId)
  }, [activeThemeId])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (monitors.length === 0) return

      const hasSelectedMonitor = monitors.some(
        (monitor) => monitor.key === selectedMonitor,
      )
      if (hasSelectedMonitor) return

      const keyedMonitor = displayMonitorKey
        ? monitors.find((monitor) => monitor.key === displayMonitorKey)
        : undefined
      const fallbackMonitor =
        keyedMonitor ?? monitors[displayMonitorIndex] ?? monitors[0]
      if (fallbackMonitor) {
        setSelectedMonitor(fallbackMonitor.key)
      }
    }, 0)
    return () => clearTimeout(timeoutId)
  }, [displayMonitorKey, displayMonitorIndex, monitors, selectedMonitor])

  useEffect(() => {
    if (!open) return

    let cancelled = false

    const reconcile = async () => {
      const previewOpen = await reconcileBroadcastPreviewState(outputId)
      if (!cancelled) setIsPreviewOpen(previewOpen)

      try {
        const status = await getBroadcastNdiStatus(invokeTauri, outputId)
        if (cancelled) return
        applyNdiStatus(status, previewOpen)
      } catch {
        if (!cancelled) setNdiActive(false)
      }
    }

    void reconcile()
    return () => {
      cancelled = true
    }
  }, [applyNdiStatus, open, outputId])

  useEffect(() => {
    if (!open) return

    let cancelled = false
    const intervalId = setInterval(() => {
      void Promise.allSettled([
        isPreviewOpen
          ? reconcileBroadcastPreviewState(outputId)
          : Promise.resolve(isPreviewOpen),
        getBroadcastNdiStatus(invokeTauri, outputId),
      ]).then(([previewResult, statusResult]) => {
        if (cancelled) return
        const previewOpen =
          previewResult.status === "fulfilled"
            ? previewResult.value
            : isPreviewOpen
        if (isPreviewOpen && previewResult.status === "fulfilled") {
          setIsPreviewOpen(previewOpen)
        }
        if (statusResult.status === "fulfilled") {
          applyNdiStatus(statusResult.value, previewOpen)
        } else {
          setNdiActive(false)
        }
      })
    }, 750)

    return () => {
      cancelled = true
      clearInterval(intervalId)
    }
  }, [applyNdiStatus, isPreviewOpen, open, outputId])

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
      const index = monitors.findIndex((monitor) => monitor.key === value)
      if (outputId === "alt") {
        useBroadcastStore.getState().setAltDisplayMonitorKey(value)
        if (index >= 0) useBroadcastStore.getState().setAltDisplayMonitorIndex(index)
      } else {
        useBroadcastStore.getState().setMainDisplayMonitorKey(value)
        if (index >= 0) useBroadcastStore.getState().setMainDisplayMonitorIndex(index)
      }
    },
    [outputId, monitors],
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

  const buildCommandState = useCallback(
    (): BroadcastOutputCommandState => ({
      outputId,
      isPreviewOpen,
      selectedMonitor,
      monitors,
      fallbackMonitorIndex: displayMonitorIndex,
      projectorFullscreen,
      ndiActive,
      ndiSourceName,
      ndiResolution,
      ndiFrameRate,
      ndiAlphaMode,
      ndiSdkInstalled,
    }),
    [
      outputId,
      isPreviewOpen,
      selectedMonitor,
      monitors,
      displayMonitorIndex,
      projectorFullscreen,
      ndiActive,
      ndiSourceName,
      ndiResolution,
      ndiFrameRate,
      ndiAlphaMode,
      ndiSdkInstalled,
    ],
  )

  const buildCommandDeps = useCallback(
    () => ({
      invoke: invokeTauri,
      syncBroadcastOutputFor: useBroadcastStore.getState().syncBroadcastOutputFor,
      emitNdiConfig: syncNdiConfigToOutput,
      onPreviewOpenChange: setIsPreviewOpen,
      onNdiActiveChange: setNdiActive,
      onError: showBroadcastError,
      onIssue: useBroadcastStore.getState().reportOutputIssue,
      clearOutputIssueFor: useBroadcastStore.getState().clearOutputIssueFor,
    }),
    [syncNdiConfigToOutput],
  )

  const handleTogglePreview = useCallback(async () => {
    if (previewPendingRef.current) return previewPendingPromiseRef.current
    previewPendingRef.current = true
    setPreviewPending(true)
    const pending = (async () => {
      await runToggleBroadcastPreview(buildCommandState(), buildCommandDeps())
    })()
    previewPendingPromiseRef.current = pending
    try {
      await pending
    } finally {
      previewPendingRef.current = false
      previewPendingPromiseRef.current = null
      setPreviewPending(false)
    }
  }, [buildCommandState, buildCommandDeps])

  const handleToggleNdi = useCallback(async () => {
    if (ndiPendingRef.current) return ndiPendingPromiseRef.current
    ndiPendingRef.current = true
    setNdiPending(true)
    const pending = (async () => {
      await runToggleBroadcastNdi(buildCommandState(), buildCommandDeps())
    })()
    ndiPendingPromiseRef.current = pending
    try {
      await pending
    } finally {
      ndiPendingRef.current = false
      ndiPendingPromiseRef.current = null
      setNdiPending(false)
    }
  }, [buildCommandState, buildCommandDeps])

  const handleToggleEnabled = useCallback(
    async (nextEnabled: boolean) => {
      if (enabledPendingRef.current) {
        const pending = enabledPendingPromiseRef.current
        if (!nextEnabled && pending) {
          await pending
        } else {
          return pending
        }
      }
      enabledPendingRef.current = true
      setEnabledPending(true)
      const pending = (async () => {
        if (nextEnabled) {
          if (outputType === "display" && monitors.length === 0) {
            showBroadcastError(
              outputId === "alt"
                ? "Alternate display output unavailable"
                : "Main display output unavailable",
              "No monitors were detected. Refresh monitors, then try again.",
            )
            return
          }
          if (outputType === "ndi" && !ndiActive) {
            showBroadcastError(
              NDI_COMING_SOON_MESSAGE,
              NDI_COMING_SOON_DESCRIPTION,
            )
            return
          }
          if (outputType === "display") {
            await handleTogglePreview()
          } else {
            await handleToggleNdi()
          }
          return
        }
        await Promise.all(
          [previewPendingPromiseRef.current, ndiPendingPromiseRef.current].filter(
            (promise): promise is Promise<void> => Boolean(promise),
          ),
        )
        await runDisableBroadcastOutput(buildCommandState(), buildCommandDeps())
      })()
      enabledPendingPromiseRef.current = pending
      try {
        await pending
      } finally {
        enabledPendingRef.current = false
        enabledPendingPromiseRef.current = null
        setEnabledPending(false)
      }
    },
    [
      buildCommandState,
      buildCommandDeps,
      handleToggleNdi,
      handleTogglePreview,
      monitors.length,
      ndiActive,
      outputId,
      outputType,
    ],
  )

  return useMemo(
    () => ({
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
      previewPending,
      ndiPending,
      enabledPending,
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
    }),
    [
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
      previewPending,
      ndiPending,
      enabledPending,
      handleThemeChange,
      handleMonitorChange,
      handleProjectorFullscreenChange,
      handleTogglePreview,
      handleToggleNdi,
      handleToggleEnabled,
      syncNdiConfigToOutput,
    ],
  )
}

export type BroadcastOutputSettingsModel = ReturnType<typeof useBroadcastOutputSettings>
