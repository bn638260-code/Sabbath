// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  createNdiFrameRequest,
  NDI_BURST_DELAYS_MS,
  NDI_HEARTBEAT_STALE_MS,
  resolveNdiFrameSource,
  scheduleNdiBurst,
  shouldPushNdiHeartbeat,
  uint8ToBase64,
  warnNdiPushFailure,
} from "./broadcast-output-ndi"

describe("uint8ToBase64", () => {
  it("encodes RGBA bytes to base64", () => {
    const bytes = new Uint8ClampedArray([255, 0, 0, 255])
    expect(uint8ToBase64(bytes)).toBe(uint8ToBase64(bytes))
    expect(atob(uint8ToBase64(bytes)).length).toBe(4)
  })
})

describe("createNdiFrameRequest", () => {
  it("builds a frame request with dimensions and base64 payload", () => {
    const bytes = new Uint8ClampedArray(16)
    const request = createNdiFrameRequest("main", 2, 2, bytes)
    expect(request).toEqual({
      outputId: "main",
      width: 2,
      height: 2,
      rgbaBase64: uint8ToBase64(bytes),
    })
  })
})

describe("resolveNdiFrameSource", () => {
  function mock2dContext() {
    return {
      drawImage: vi.fn(),
      getImageData: vi.fn(),
    } as unknown as CanvasRenderingContext2D
  }

  it("reuses the source canvas when dimensions already match", () => {
    const canvas = document.createElement("canvas")
    canvas.width = 4
    canvas.height = 4
    const ctx = mock2dContext()
    const result = resolveNdiFrameSource(canvas, ctx, 4, 4, null)
    expect(result.source.canvas).toBe(canvas)
    expect(result.width).toBe(4)
  })

  it("resizes into a scratch canvas when dimensions differ", () => {
    const canvas = document.createElement("canvas")
    canvas.width = 4
    canvas.height = 4
    const ctx = mock2dContext()
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockReturnValue(mock2dContext())

    const result = resolveNdiFrameSource(canvas, ctx, 2, 2, null)
    expect(result.source.canvas).not.toBe(canvas)
    expect(result.width).toBe(2)
    expect(result.height).toBe(2)
    getContext.mockRestore()
  })
})

describe("scheduleNdiBurst", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("pushes immediately and schedules delayed bursts", () => {
    vi.useFakeTimers()
    const push = vi.fn()
    const timers = scheduleNdiBurst(push)

    expect(push).toHaveBeenCalledTimes(1)
    expect(timers).toHaveLength(NDI_BURST_DELAYS_MS.length)

    vi.advanceTimersByTime(NDI_BURST_DELAYS_MS[0])
    expect(push).toHaveBeenCalledTimes(2)
    vi.advanceTimersByTime(NDI_BURST_DELAYS_MS[1])
    expect(push).toHaveBeenCalledTimes(3)
  })
})

describe("heartbeat scheduling", () => {
  it("pushes when the last frame is stale", () => {
    const now = 10_000
    expect(shouldPushNdiHeartbeat(true, now, now - NDI_HEARTBEAT_STALE_MS - 1)).toBe(true)
    expect(shouldPushNdiHeartbeat(true, now, now)).toBe(false)
    expect(shouldPushNdiHeartbeat(false, now, 0)).toBe(false)
  })
})

describe("warnNdiPushFailure", () => {
  it("warns with the broadcast-output prefix", () => {
    const warn = vi.fn()
    warnNdiPushFailure(new Error("ndi down"), warn)
    expect(warn).toHaveBeenCalledWith(
      "[broadcast-output] push_ndi_frame failed",
      expect.any(Error),
    )
  })
})
