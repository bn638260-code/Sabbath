import { useCallback, useEffect, useRef } from "react"
import {
  createNdiFrameRequest,
  NDI_HEARTBEAT_INTERVAL_MS,
  resolveNdiFrameSource,
  scheduleNdiBurst,
  shouldPushNdiHeartbeat,
  warnNdiPushFailure,
} from "@/lib/broadcast-output-ndi"
import { invokeTauri } from "@/lib/tauri-runtime"
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow"
import { getBroadcastRenderKey } from "@/lib/broadcast-render-key"
import { renderPresentation } from "@/lib/verse-renderer"
import type { BroadcastTheme, PresentationRenderData } from "@/types"
import type { NdiConfigEventPayload } from "@/types"

export interface BroadcastPayload {
  theme: BroadcastTheme
  item: PresentationRenderData | null
  opacity?: number
}

declare global {
  interface Window {
    __SABBATHCUE_BROADCAST_TEST__?: {
      render: (payload: BroadcastPayload) => void
    }
  }
}

const DEFAULT_NDI_CONFIG: NdiConfigEventPayload = {
  active: false,
  fps: 24,
  width: 1920,
  height: 1080,
}

function fillBlack(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext("2d")
  if (!ctx) return
  ctx.fillStyle = "#000"
  ctx.fillRect(0, 0, canvas.width, canvas.height)
}

interface UseBroadcastOutputRuntimeOptions {
  canvas: HTMLCanvasElement | null
  outputId: string
}

export function useBroadcastOutputRuntime({
  canvas,
  outputId,
}: UseBroadcastOutputRuntimeOptions): void {
  const latestData = useRef<BroadcastPayload | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map())
  const ndiConfigRef = useRef<NdiConfigEventPayload>(DEFAULT_NDI_CONFIG)
  const ndiCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const lastPushRef = useRef(0)
  const pushingRef = useRef(false)
  const lastRenderKeyRef = useRef<string | null>(null)
  const ndiBurstTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    canvasRef.current = canvas
    return () => {
      if (canvasRef.current === canvas) canvasRef.current = null
    }
  }, [canvas])

  const logDebug = useCallback((message: string, meta?: unknown) => {
    if (!import.meta.env.DEV) return
    if (meta === undefined) {
      console.debug(`[broadcast-output] ${message}`)
      return
    }
    console.debug(`[broadcast-output] ${message}`, meta)
  }, [])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const data = latestData.current
    if (!data) {
      fillBlack(canvas)
      return
    }

    const { theme, item } = data
    canvas.width = theme.resolution.width
    canvas.height = theme.resolution.height
    const result = renderPresentation(ctx, theme, item, {
      scale: 1,
      opacity: data.opacity,
      imageCache: imageCacheRef.current,
    })

    if (!result) {
      fillBlack(canvas)
      logDebug("renderPresentation returned null; drew fallback frame")
    }
  }, [logDebug])

  const preloadBackgroundImage = useCallback((theme: BroadcastTheme) => {
    const bg = theme.background
    if (bg.type !== "image" || !bg.image?.url) return

    const url = bg.image.url
    const cache = imageCacheRef.current
    if (cache.has(url)) return

    const img = new Image()
    img.onload = () => {
      cache.set(url, img)
      logDebug("Background image loaded", { url })
      draw()
    }
    img.onerror = () => {
      console.warn("[broadcast-output] failed to load background image", { url })
    }
    img.src = url
  }, [draw, logDebug])

  const pushNdiFrame = useCallback(async () => {
    if (!ndiConfigRef.current.active) return
    if (pushingRef.current) return
    pushingRef.current = true

    try {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext("2d")
      if (!ctx) return

      const targetWidth = ndiConfigRef.current.width
      const targetHeight = ndiConfigRef.current.height

      const resized = resolveNdiFrameSource(
        canvas,
        ctx,
        targetWidth,
        targetHeight,
        ndiCanvasRef.current,
      )
      if (resized.scratch) {
        ndiCanvasRef.current = resized.scratch
      }

      const imageData = resized.source.ctx.getImageData(
        0,
        0,
        resized.width,
        resized.height,
      )
      const request = createNdiFrameRequest(
        outputId,
        resized.width,
        resized.height,
        imageData.data,
      )

      await invokeTauri("push_ndi_frame", { request })
      lastPushRef.current = Date.now()
    } catch (error) {
      warnNdiPushFailure(error)
    } finally {
      pushingRef.current = false
    }
  }, [outputId])

  const pushNdiBurst = useCallback(() => {
    if (!ndiConfigRef.current.active) return
    const timers = scheduleNdiBurst(
      () => pushNdiFrame(),
      setTimeout,
      (timer) => {
        ndiBurstTimersRef.current = ndiBurstTimersRef.current.filter(
          (pending) => pending !== timer,
        )
      },
    )
    ndiBurstTimersRef.current.push(...timers)
  }, [pushNdiFrame])

  useEffect(() => {
    const canvas = canvasRef.current
    if (canvas) {
      canvas.width = 1920
      canvas.height = 1080
      fillBlack(canvas)
    }

    const applyPayload = (payload: BroadcastPayload) => {
      const renderKey = `${getBroadcastRenderKey(payload.theme, payload.item)}:${payload.opacity ?? 1}`

      if (lastRenderKeyRef.current === renderKey) {
        logDebug("Skipped duplicate broadcast payload", {
          hasItem: Boolean(payload.item),
          themeId: payload.theme.id,
        })
        return
      }

      lastRenderKeyRef.current = renderKey
      latestData.current = payload
      preloadBackgroundImage(payload.theme)
      logDebug("Received broadcast payload", {
        hasItem: Boolean(payload.item),
        themeId: payload.theme.id,
      })
      draw()
      pushNdiBurst()
    }

    const e2eHarnessEnabled =
      import.meta.env.DEV ||
      import.meta.env.MODE === "test" ||
      new URLSearchParams(window.location.search).has("e2e")

    if (e2eHarnessEnabled) {
      window.__SABBATHCUE_BROADCAST_TEST__ = {
        render: applyPayload,
      }
    }

    let unlisten: Promise<() => void> | null = null
    let unlistenNdiConfig: Promise<() => void> | null = null

    try {
      const currentWindow = getCurrentWebviewWindow()
      logDebug("Listener registration started", { label: currentWindow.label })
      unlisten = currentWindow.listen<BroadcastPayload>("broadcast:verse-update", (event) => {
        applyPayload(event.payload)
      })

      unlistenNdiConfig = currentWindow.listen<NdiConfigEventPayload>(
        "broadcast:ndi-config",
        (event) => {
          ndiConfigRef.current = event.payload
          logDebug("Received broadcast:ndi-config", event.payload)
          if (event.payload.active) pushNdiBurst()
        },
      )

      void currentWindow.emitTo("main", "broadcast:output-ready").then(() => {
        logDebug("Sent broadcast:output-ready")
      }).catch(() => {
        console.warn("[broadcast-output] failed to send output-ready event")
      })
    } catch (error) {
      logDebug("Tauri broadcast listeners unavailable", error)
    }

    void invokeTauri<{ active: boolean; width: number; height: number; fps: number } | null>(
      "get_ndi_status",
      { outputId },
    )
      .then((status) => {
        if (!status?.active) return
        ndiConfigRef.current = {
          active: true,
          fps: status.fps,
          width: status.width,
          height: status.height,
        }
        logDebug("Fetched NDI status on mount", status)
      })
      .catch(() => {
        // The browser e2e harness runs outside Tauri, so this command is optional.
      })

    return () => {
      delete window.__SABBATHCUE_BROADCAST_TEST__
      ndiBurstTimersRef.current.forEach(clearTimeout)
      ndiBurstTimersRef.current = []
      unlisten?.then((fn) => fn())
      unlistenNdiConfig?.then((fn) => fn())
    }
  }, [canvas, draw, logDebug, outputId, preloadBackgroundImage, pushNdiBurst])

  useEffect(() => {
    const timer = setInterval(() => {
      if (
        shouldPushNdiHeartbeat(
          ndiConfigRef.current.active,
          Date.now(),
          lastPushRef.current,
        )
      ) {
        void pushNdiFrame()
      }
    }, NDI_HEARTBEAT_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [pushNdiFrame])
}
