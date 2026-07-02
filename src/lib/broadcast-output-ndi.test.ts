// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  createNdiFramePayload,
  NDI_BURST_DELAYS_MS,
  NDI_FRAME_HEIGHT_HEADER,
  NDI_FRAME_OUTPUT_ID_HEADER,
  NDI_FRAME_ERROR_RATE_LIMIT_MS,
  NDI_HEARTBEAT_STALE_MS,
  NDI_FRAME_WIDTH_HEADER,
  notifyNdiPushFailure,
  resolveNdiFrameSource,
  scheduleNdiBurst,
  shouldEmitNdiFrameError,
  shouldPushNdiHeartbeat,
  warnNdiPushFailure,
} from "./broadcast-output-ndi"

describe("createNdiFramePayload", () => {
  it("builds a raw frame payload with metadata headers", () => {
    const bytes = new Uint8ClampedArray(16)
    const request = createNdiFramePayload("main", 2, 2, bytes)
    expect(request).toEqual({
      outputId: "main",
      width: 2,
      height: 2,
      body: new Uint8Array(bytes.buffer),
      headers: {
        [NDI_FRAME_OUTPUT_ID_HEADER]: "main",
        [NDI_FRAME_WIDTH_HEADER]: "2",
        [NDI_FRAME_HEIGHT_HEADER]: "2",
      },
    })
  })

  it("rejects payloads that do not match width * height * 4", () => {
    const bytes = new Uint8ClampedArray(12)
    expect(() => createNdiFramePayload("main", 2, 2, bytes)).toThrow(
      "Invalid NDI frame byte length: expected 16, received 12",
    )
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
    expect(getContext).toHaveBeenCalledWith("2d", { willReadFrequently: true })
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

describe("ndi frame error rate limiting", () => {
  it("allows the first emission and blocks repeats inside the window", () => {
    const now = 10_000
    expect(shouldEmitNdiFrameError(now, 0)).toBe(true)
    expect(shouldEmitNdiFrameError(now + 1_000, now)).toBe(false)
    expect(
      shouldEmitNdiFrameError(now + NDI_FRAME_ERROR_RATE_LIMIT_MS, now),
    ).toBe(true)
  })

  it("notifies the main window with a rate-limited payload", () => {
    const emit = vi.fn()
    const warn = vi.fn()
    const now = 5_000

    const first = notifyNdiPushFailure("main", new Error("ndi down"), 1, now, 0, emit, warn)
    const second = notifyNdiPushFailure(
      "main",
      new Error("ndi down"),
      2,
      now + 1_000,
      first,
      emit,
      warn,
    )

    expect(emit).toHaveBeenCalledTimes(1)
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        outputId: "main",
        kind: "ndi-frame",
        title: "NDI frame push failed",
      }),
    )
    expect(second).toBe(now)
  })
})
