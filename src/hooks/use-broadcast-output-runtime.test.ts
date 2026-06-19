// @vitest-environment jsdom
import React from "react"
import { act } from "react"
import { createRoot } from "react-dom/client"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { BroadcastTheme } from "@/types"

const mockInvoke = vi.fn<(...args: unknown[]) => unknown>()
const mockEmitTo = vi.fn<(...args: unknown[]) => unknown>()
const mockWindowEmitTo = vi.fn<(...args: unknown[]) => unknown>()
const mockRenderPresentation = vi.fn<(...args: unknown[]) => { lines: unknown[] }>(() => ({
  lines: [],
}))
const listeners = new Map<string, (event: { payload: unknown }) => void>()
let canvasContexts = new WeakMap<HTMLCanvasElement, ReturnType<typeof createMockCanvasContext>>()

vi.mock("@/lib/tauri-runtime", () => ({
  invokeTauri: (...args: unknown[]) => mockInvoke(...args),
}))

vi.mock("@tauri-apps/api/event", () => ({
  emitTo: (...args: unknown[]) => mockEmitTo(...args),
}))

vi.mock("@tauri-apps/api/webviewWindow", () => ({
  getCurrentWebviewWindow: () => ({
    label: "broadcast",
    listen: (eventName: string, callback: (event: { payload: unknown }) => void) => {
      listeners.set(eventName, callback)
      return Promise.resolve(() => listeners.delete(eventName))
    },
    emitTo: (...args: unknown[]) => mockWindowEmitTo(...args),
  }),
}))

vi.mock("@/lib/verse-renderer", () => ({
  renderPresentation: (...args: unknown[]) => mockRenderPresentation(...args),
}))

function createMockCanvasContext(canvas: HTMLCanvasElement) {
  return {
    canvas,
    fillStyle: "",
    globalAlpha: 1,
    save: vi.fn(),
    restore: vi.fn(),
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    drawImage: vi.fn(),
    getImageData: vi.fn(() => ({
      data: new Uint8ClampedArray(1920 * 1080 * 4),
    })),
  }
}

function installCanvasMock() {
  canvasContexts = new WeakMap()
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function getContext(
    this: HTMLCanvasElement
  ) {
    const canvas = this as HTMLCanvasElement
    let context = canvasContexts.get(canvas)
    if (!context) {
      context = createMockCanvasContext(canvas)
      canvasContexts.set(canvas, context)
    }
    return context as unknown as CanvasRenderingContext2D
  })
}

function createCanvas() {
  const canvas = document.createElement("canvas")
  return canvas
}

function makeTheme(): BroadcastTheme {
  return {
    id: "theme",
    name: "Theme",
    builtin: true,
    pinned: false,
    createdAt: 0,
    updatedAt: 0,
    resolution: { width: 1920, height: 1080 },
    background: {
      type: "solid",
      color: "#000000",
      gradient: null,
      image: null,
    },
    textBox: {
      enabled: false,
      color: "#000000",
      opacity: 0,
      borderRadius: 0,
      padding: 0,
    },
    verseText: {
      fontFamily: "Inter",
      fontSize: 72,
      fontWeight: 400,
      color: "#ffffff",
      lineHeight: 1.2,
      letterSpacing: 0,
      shadow: null,
      outline: null,
    },
    verseNumbers: {
      visible: true,
      fontSize: 20,
      color: "#ffffff",
      superscript: true,
    },
    reference: {
      fontFamily: "Inter",
      fontSize: 48,
      fontWeight: 600,
      color: "#ffffff",
      uppercase: false,
      letterSpacing: 0,
      position: "below",
    },
    layout: {
      anchor: "center",
      offsetX: 0,
      offsetY: 0,
      padding: { top: 80, right: 80, bottom: 80, left: 80 },
      textAlign: "center",
      backgroundWidth: 100,
      backgroundHeight: 100,
      textAreaWidth: 80,
      textAreaHeight: 80,
    },
    transition: {
      type: "fade",
      duration: 100,
      easing: "linear",
      direction: "up",
    },
  }
}

describe("useBroadcastOutputRuntime", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    installCanvasMock()
    listeners.clear()
    mockEmitTo.mockResolvedValue(undefined)
    mockWindowEmitTo.mockResolvedValue(undefined)
    mockRenderPresentation.mockClear()
    mockInvoke.mockImplementation(async (command: unknown) => {
      if (command === "push_ndi_frame") throw new Error("ndi down")
      if (command === "get_ndi_status") return null
      return undefined
    })
  })

  it("stops NDI after repeated frame push failures", async () => {
    const { useBroadcastOutputRuntime } = await import("./use-broadcast-output-runtime")
    const canvas = createCanvas()
    const root = createRoot(document.createElement("div"))

    function Probe() {
      useBroadcastOutputRuntime({ canvas, outputId: "main" })
      return null
    }

    await act(async () => {
      root.render(React.createElement(Probe))
      await Promise.resolve()
    })

    await act(async () => {
      listeners.get("broadcast:ndi-config")?.({
        payload: {
          active: true,
          fps: 24,
          width: 1920,
          height: 1080,
        },
      })
      await Promise.resolve()
      vi.advanceTimersByTime(301)
      await Promise.resolve()
      await Promise.resolve()
      vi.advanceTimersByTime(2000)
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(mockInvoke.mock.calls.filter((call) => call[0] === "push_ndi_frame")).toHaveLength(3)
    expect(mockInvoke).toHaveBeenCalledWith("stop_ndi", { outputId: "main" })
    expect(mockEmitTo).toHaveBeenCalledWith(
      "main",
      "broadcast:output-error",
      expect.objectContaining({
        outputId: "main",
        kind: "ndi-frame",
        title: "NDI output stopped",
      }),
    )

    await act(async () => {
      root.unmount()
    })
    vi.useRealTimers()
  })

  it("animates a live payload when a transition is provided", async () => {
    const { useBroadcastOutputRuntime } = await import("./use-broadcast-output-runtime")
    const canvas = createCanvas()
    const context = canvas.getContext("2d") as unknown as ReturnType<typeof createMockCanvasContext>
    const root = createRoot(document.createElement("div"))
    const theme = makeTheme()

    function Probe() {
      useBroadcastOutputRuntime({ canvas, outputId: "main" })
      return null
    }

    await act(async () => {
      root.render(React.createElement(Probe))
      await Promise.resolve()
    })

    await act(async () => {
      listeners.get("broadcast:verse-update")?.({
        payload: {
          theme,
          item: { reference: "John 3:16", segments: [{ text: "For God so loved the world." }] },
          opacity: 1,
          transition: { ...theme.transition, type: "none", duration: 0 },
        },
      })
      await Promise.resolve()
    })
    context.drawImage.mockClear()

    await act(async () => {
      listeners.get("broadcast:verse-update")?.({
        payload: {
          theme,
          item: { reference: "John 3:17", segments: [{ text: "For God sent not his Son." }] },
          opacity: 1,
          transition: { ...theme.transition, type: "fade", duration: 100 },
        },
      })
      vi.advanceTimersByTime(120)
      await Promise.resolve()
    })

    expect(mockRenderPresentation).toHaveBeenCalled()
    expect(context.drawImage.mock.calls.length).toBeGreaterThan(1)

    await act(async () => {
      root.unmount()
    })
  })
})
