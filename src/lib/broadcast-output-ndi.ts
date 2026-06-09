import type { NdiConfigEventPayload, NdiFrameRequest } from "@/types"

export function uint8ToBase64(bytes: Uint8Array | Uint8ClampedArray): string {
  const chunk = 0x8000
  const parts: string[] = []
  for (let i = 0; i < bytes.length; i += chunk) {
    parts.push(
      String.fromCharCode.apply(
        null,
        bytes.subarray(i, i + chunk) as unknown as number[],
      ),
    )
  }
  return btoa(parts.join(""))
}

export function createNdiFrameRequest(
  outputId: string,
  width: number,
  height: number,
  rgbaBytes: Uint8ClampedArray,
): NdiFrameRequest {
  return {
    outputId,
    width,
    height,
    rgbaBase64: uint8ToBase64(rgbaBytes),
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
  const ndiCtx = ndiCanvas.getContext("2d")
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

export function warnNdiPushFailure(
  error: unknown,
  warn: (message: string, error: unknown) => void = console.warn,
): void {
  warn("[broadcast-output] push_ndi_frame failed", error)
}

export function isNdiActive(config: NdiConfigEventPayload): boolean {
  return config.active
}
