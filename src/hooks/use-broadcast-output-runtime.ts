import { useCallback, useEffect, useRef } from "react"
import {
  createNdiFrameRequest,
  NDI_FRAME_FAILURE_STOP_THRESHOLD,
  NDI_HEARTBEAT_INTERVAL_MS,
  notifyNdiPushFailure,
  resolveNdiFrameSource,
  scheduleNdiBurst,
  shouldPushNdiHeartbeat,
} from "@/lib/broadcast-output-ndi"
import { invokeTauri } from "@/lib/tauri-runtime"
import { emitTo } from "@tauri-apps/api/event"
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow"
import type { BroadcastOutputId } from "@/types"
import { getBroadcastRenderKey } from "@/lib/broadcast-render-key"
import { renderPresentation } from "@/lib/verse-renderer"
import type { BroadcastTheme, BroadcastTransition, PresentationRenderData } from "@/types"
import type { NdiConfigEventPayload } from "@/types"

export interface BroadcastPayload {
  theme: BroadcastTheme
  item: PresentationRenderData | null
  opacity?: number
  transition?: BroadcastTransition
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

function scheduleAnimationFrame(callback: FrameRequestCallback): number {
  if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
    return window.requestAnimationFrame(callback)
  }
  return setTimeout(() => callback(performance.now()), 16) as unknown as number
}

function cancelScheduledAnimationFrame(id: number): void {
  if (typeof window !== "undefined" && typeof window.cancelAnimationFrame === "function") {
    window.cancelAnimationFrame(id)
    return
  }
  clearTimeout(id)
}

function easeTransitionProgress(
  progress: number,
  easing: BroadcastTransition["easing"],
): number {
  const p = Math.max(0, Math.min(1, progress))
  if (easing === "linear") return p
  if (easing === "ease-in") return p * p
  if (easing === "ease-out") return 1 - Math.pow(1 - p, 2)
  return p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2
}

function slideVector(
  transition: BroadcastTransition,
  width: number,
  height: number,
): { x: number; y: number } {
  if (transition.direction === "down") return { x: 0, y: -height }
  if (transition.direction === "left") return { x: width, y: 0 }
  if (transition.direction === "right") return { x: -width, y: 0 }
  return { x: 0, y: height }
}

function drawCanvasLayer(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  layer: HTMLCanvasElement,
  opacity: number,
  offsetX = 0,
  offsetY = 0,
  scale = 1,
): void {
  const width = canvas.width * scale
  const height = canvas.height * scale
  ctx.save()
  ctx.globalAlpha = Math.max(0, Math.min(1, opacity))
  ctx.drawImage(
    layer,
    0,
    0,
    layer.width,
    layer.height,
    (canvas.width - width) / 2 + offsetX,
    (canvas.height - height) / 2 + offsetY,
    width,
    height,
  )
  ctx.restore()
}

interface UseBroadcastOutputRuntimeOptions {
  canvas: HTMLCanvasElement | null
  outputId: string
  onPayloadChange?: (payload: BroadcastPayload) => void
}

export function useBroadcastOutputRuntime({
  canvas,
  outputId,
  onPayloadChange,
}: UseBroadcastOutputRuntimeOptions): void {
  const latestData = useRef<BroadcastPayload | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map())
  const ndiConfigRef = useRef<NdiConfigEventPayload>(DEFAULT_NDI_CONFIG)
  const ndiCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const lastPushRef = useRef(0)
  const pushingRef = useRef(false)
  const ndiAutoStoppingRef = useRef(false)
  const consecutiveFailuresRef = useRef(0)
  const lastErrorEmittedAtRef = useRef(0)
  const lastRenderKeyRef = useRef<string | null>(null)
  const transitionFrameRef = useRef<number | null>(null)
  const fromCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const toCanvasRef = useRef<HTMLCanvasElement | null>(null)
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

  const renderPayloadToCanvas = useCallback((
    target: HTMLCanvasElement,
    payload: BroadcastPayload | null,
    fallbackSize?: { width: number; height: number },
  ) => {
    const width = payload?.theme.resolution.width ?? fallbackSize?.width ?? 1920
    const height = payload?.theme.resolution.height ?? fallbackSize?.height ?? 1080
    target.width = width
    target.height = height

    if (!payload) {
      fillBlack(target)
      return
    }

    if (payload.item?.kind === "video") {
      fillBlack(target)
      return
    }

    const ctx = target.getContext("2d")
    if (!ctx) return
    const result = renderPresentation(ctx, payload.theme, payload.item, {
      scale: 1,
      opacity: payload.opacity,
      imageCache: imageCacheRef.current,
    })

    if (!result) {
      fillBlack(target)
      logDebug("renderPresentation returned null; drew fallback frame")
    }
  }, [logDebug])

  const drawRenderedCanvas = useCallback((source: HTMLCanvasElement) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    canvas.width = source.width
    canvas.height = source.height
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(source, 0, 0)
  }, [])

  const draw = useCallback(() => {
    const target = toCanvasRef.current ?? document.createElement("canvas")
    toCanvasRef.current = target
    renderPayloadToCanvas(target, latestData.current)
    drawRenderedCanvas(target)
  }, [drawRenderedCanvas, renderPayloadToCanvas])

  const cancelTransition = useCallback(() => {
    if (transitionFrameRef.current === null) return
    cancelScheduledAnimationFrame(transitionFrameRef.current)
    transitionFrameRef.current = null
  }, [])

  const drawTransitionFrame = useCallback((
    fromCanvas: HTMLCanvasElement,
    toCanvas: HTMLCanvasElement,
    transition: BroadcastTransition,
    rawProgress: number,
  ) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const progress = easeTransitionProgress(rawProgress, transition.easing)
    canvas.width = toCanvas.width
    canvas.height = toCanvas.height
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    if (transition.type === "slide") {
      const vector = slideVector(transition, canvas.width, canvas.height)
      drawCanvasLayer(ctx, canvas, fromCanvas, 1, -vector.x * progress, -vector.y * progress)
      drawCanvasLayer(
        ctx,
        canvas,
        toCanvas,
        1,
        vector.x * (1 - progress),
        vector.y * (1 - progress),
      )
      return
    }

    if (transition.type === "scale") {
      drawCanvasLayer(ctx, canvas, fromCanvas, 1 - progress, 0, 0, 1 + progress * 0.04)
      drawCanvasLayer(ctx, canvas, toCanvas, progress, 0, 0, 0.96 + progress * 0.04)
      return
    }

    drawCanvasLayer(ctx, canvas, fromCanvas, 1 - progress)
    drawCanvasLayer(ctx, canvas, toCanvas, progress)
  }, [])

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
      consecutiveFailuresRef.current = 0
    } catch (error) {
      consecutiveFailuresRef.current += 1
      const now = Date.now()
      lastErrorEmittedAtRef.current = notifyNdiPushFailure(
        outputId as BroadcastOutputId,
        error,
        consecutiveFailuresRef.current,
        now,
        lastErrorEmittedAtRef.current,
        (event) => emitTo("main", "broadcast:output-error", event),
      )
      if (
        consecutiveFailuresRef.current >= NDI_FRAME_FAILURE_STOP_THRESHOLD &&
        !ndiAutoStoppingRef.current
      ) {
        ndiAutoStoppingRef.current = true
        try {
          await invokeTauri("stop_ndi", { outputId })
          ndiConfigRef.current = {
            ...ndiConfigRef.current,
            active: false,
          }
          consecutiveFailuresRef.current = 0
          void emitTo("main", "broadcast:output-error", {
            outputId: outputId as BroadcastOutputId,
            kind: "ndi-frame",
            title: "NDI output stopped",
            description: `Stopped after ${NDI_FRAME_FAILURE_STOP_THRESHOLD} consecutive frame transmission failures.`,
          })
        } catch (stopError) {
          console.warn("[broadcast-output] stop_ndi after frame failures failed", stopError)
        } finally {
          ndiAutoStoppingRef.current = false
        }
      }
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

  const animatePayload = useCallback((
    previousPayload: BroadcastPayload | null,
    payload: BroadcastPayload,
  ) => {
    cancelTransition()
    const transition = payload.transition
    if (!transition || transition.type === "none" || transition.duration <= 0) {
      draw()
      pushNdiBurst()
      return
    }

    const fromCanvas = fromCanvasRef.current ?? document.createElement("canvas")
    const toCanvas = toCanvasRef.current ?? document.createElement("canvas")
    fromCanvasRef.current = fromCanvas
    toCanvasRef.current = toCanvas

    renderPayloadToCanvas(toCanvas, payload)
    renderPayloadToCanvas(fromCanvas, previousPayload, {
      width: toCanvas.width,
      height: toCanvas.height,
    })

    const startedAt = performance.now()
    const step = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / transition.duration)
      drawTransitionFrame(fromCanvas, toCanvas, transition, progress)

      if (progress < 1) {
        transitionFrameRef.current = scheduleAnimationFrame(step)
        return
      }

      transitionFrameRef.current = null
      drawRenderedCanvas(toCanvas)
      pushNdiBurst()
    }

    step(startedAt)
  }, [
    cancelTransition,
    draw,
    drawRenderedCanvas,
    drawTransitionFrame,
    pushNdiBurst,
    renderPayloadToCanvas,
  ])

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

      const previousPayload = latestData.current
      lastRenderKeyRef.current = renderKey
      latestData.current = payload
      onPayloadChange?.(payload)
      preloadBackgroundImage(payload.theme)
      logDebug("Received broadcast payload", {
        hasItem: Boolean(payload.item),
        themeId: payload.theme.id,
      })
      animatePayload(previousPayload, payload)
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
      cancelTransition()
      ndiBurstTimersRef.current.forEach(clearTimeout)
      ndiBurstTimersRef.current = []
      unlisten?.then((fn) => fn())
      unlistenNdiConfig?.then((fn) => fn())
    }
  }, [animatePayload, cancelTransition, canvas, logDebug, onPayloadChange, outputId, preloadBackgroundImage, pushNdiBurst])

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
