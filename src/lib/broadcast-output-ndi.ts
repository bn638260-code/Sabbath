import type {
  BroadcastOutputErrorEvent,
  BroadcastOutputId,
  NdiConfigEventPayload,
  NdiFramePayload,
} from "@/types"

export const NDI_FRAME_OUTPUT_ID_HEADER = "x-sabbathcue-output-id"
export const NDI_FRAME_WIDTH_HEADER = "x-sabbathcue-width"
export const NDI_FRAME_HEIGHT_HEADER = "x-sabbathcue-height"

function expectedRgbaByteLength(width: number, height: number): number {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error(`Invalid NDI frame dimensions: ${width}x${height}`)
  }
  return width * height * 4
}

export function createNdiFramePayload(
  outputId: string,
  width: number,
  height: number,
  rgbaBytes: Uint8Array | Uint8ClampedArray,
): NdiFramePayload {
  const expectedLength = expectedRgbaByteLength(width, height)
  if (rgbaBytes.byteLength !== expectedLength) {
    throw new Error(
      `Invalid NDI frame byte length: expected ${expectedLength}, received ${rgbaBytes.byteLength}`,
    )
  }

  return {
    outputId,
    width,
    height,
    body: new Uint8Array(rgbaBytes.buffer, rgbaBytes.byteOffset, rgbaBytes.byteLength),
    headers: {
      [NDI_FRAME_OUTPUT_ID_HEADER]: outputId,
      [NDI_FRAME_WIDTH_HEADER]: String(width),
      [NDI_FRAME_HEIGHT_HEADER]: String(height),
    },
  }
}

export interface NdiResizeSource {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
}

export function resolveNdiFrameSource(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  targetWidth: number,
  targetHeight: number,
  scratchCanvas: HTMLCanvasElement | null,
): { source: NdiResizeSource; width: number; height: number; scratch: HTMLCanvasElement | null } {
  if (canvas.width === targetWidth && canvas.height === targetHeight) {
    return { source: { canvas, ctx }, width: canvas.width, height: canvas.height, scratch: scratchCanvas }
  }

  const ndiCanvas = scratchCanvas ?? document.createElement("canvas")
  ndiCanvas.width = targetWidth
  ndiCanvas.height = targetHeight
  const ndiCtx = ndiCanvas.getContext("2d", { willReadFrequently: true })
  if (!ndiCtx) {
    return { source: { canvas, ctx }, width: canvas.width, height: canvas.height, scratch: scratchCanvas }
  }
  ndiCtx.drawImage(canvas, 0, 0, targetWidth, targetHeight)
  return {
    source: { canvas: ndiCanvas, ctx: ndiCtx },
    width: targetWidth,
    height: targetHeight,
    scratch: ndiCanvas,
  }
}

export const NDI_BURST_DELAYS_MS = [150, 300] as const

export function scheduleNdiBurst(
  pushFrame: () => void | Promise<void>,
  setTimeoutFn: typeof setTimeout = setTimeout,
  onTimerComplete?: (timer: ReturnType<typeof setTimeout>) => void,
): Array<ReturnType<typeof setTimeout>> {
  void pushFrame()
  return NDI_BURST_DELAYS_MS.map((delay) => {
    const timer = setTimeoutFn(() => {
      onTimerComplete?.(timer)
      void pushFrame()
    }, delay)
    return timer
  })
}

export const NDI_HEARTBEAT_INTERVAL_MS = 2000
export const NDI_HEARTBEAT_STALE_MS = 2000

export function shouldPushNdiHeartbeat(
  active: boolean,
  now: number,
  lastPushAt: number,
): boolean {
  if (!active) return false
  return now - lastPushAt > NDI_HEARTBEAT_STALE_MS
}

export const NDI_FRAME_ERROR_RATE_LIMIT_MS = 30_000
export const NDI_FRAME_FAILURE_STOP_THRESHOLD = 3

export function shouldEmitNdiFrameError(
  now: number,
  lastEmittedAt: number,
): boolean {
  if (lastEmittedAt <= 0) return true
  return now - lastEmittedAt >= NDI_FRAME_ERROR_RATE_LIMIT_MS
}

export function buildNdiFrameErrorEvent(
  outputId: BroadcastOutputId,
  error: unknown,
  consecutiveFailures: number,
): BroadcastOutputErrorEvent {
  return {
    outputId,
    kind: "ndi-frame",
    title: "NDI frame push failed",
    description: `Frame transmission failed (${consecutiveFailures} consecutive): ${String(error)}`,
  }
}

export function warnNdiPushFailure(
  error: unknown,
  warn: (message: string, error: unknown) => void = console.warn,
): void {
  warn("[broadcast-output] push_ndi_frame failed", error)
}

export function notifyNdiPushFailure(
  outputId: BroadcastOutputId,
  error: unknown,
  consecutiveFailures: number,
  now: number,
  lastEmittedAt: number,
  emit: (event: BroadcastOutputErrorEvent) => void | Promise<void>,
  warn: (message: string, error: unknown) => void = console.warn,
): number {
  warnNdiPushFailure(error, warn)
  if (!shouldEmitNdiFrameError(now, lastEmittedAt)) {
    return lastEmittedAt
  }
  void emit(buildNdiFrameErrorEvent(outputId, error, consecutiveFailures))
  return now
}

export function isNdiActive(config: NdiConfigEventPayload): boolean {
  return config.active
}
