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

    const pushCalls = mockInvoke.mock.calls.filter((call) => call[0] === "push_ndi_frame")
    expect(pushCalls).toHaveLength(3)
    expect(pushCalls[0][1]).toBeInstanceOf(Uint8Array)
    expect(pushCalls[0][2]).toEqual({
      headers: {
        "x-sabbathcue-output-id": "main",
        "x-sabbathcue-width": "1920",
        "x-sabbathcue-height": "1080",
      },
    })
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

  it("repaints the latest payload when the output canvas is remounted", async () => {
    const { useBroadcastOutputRuntime } = await import("./use-broadcast-output-runtime")
    const firstCanvas = createCanvas()
    const secondCanvas = createCanvas()
    const firstContext = firstCanvas.getContext("2d") as unknown as ReturnType<
      typeof createMockCanvasContext
    >
    const secondContext = secondCanvas.getContext("2d") as unknown as ReturnType<
      typeof createMockCanvasContext
    >
    const root = createRoot(document.createElement("div"))
    const theme = makeTheme()
    let activeCanvas = firstCanvas

    function Probe() {
      useBroadcastOutputRuntime({ canvas: activeCanvas, outputId: "main" })
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

    expect(firstContext.drawImage).toHaveBeenCalled()
    secondContext.drawImage.mockClear()

    activeCanvas = secondCanvas
    await act(async () => {
      root.render(React.createElement(Probe))
      await Promise.resolve()
    })

    expect(secondContext.drawImage).toHaveBeenCalled()

    await act(async () => {
      root.unmount()
    })
  })

  it("runs a redraw loop for kinetic themes and stops for static payloads", async () => {
    const { useBroadcastOutputRuntime } = await import("./use-broadcast-output-runtime")
    const canvas = createCanvas()
    const root = createRoot(document.createElement("div"))
    const kineticTheme: BroadcastTheme = {
      ...makeTheme(),
      id: "builtin-kinetic-ocean",
      kinetic: {
        source: "html-prototype-v2",
        presetId: "ocean",
        group: "classical",
        backgroundKind: "mesh",
        colors: ["#061127", "#112d61"],
        accentColor: "#38bdf8",
        motion: {
          durationMs: 6000,
          driftAmount: 0.6,
          hueShiftDegrees: 25,
          saturationBoost: 0.3,
        },
      },
    }

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
          theme: kineticTheme,
          item: { reference: "John 3:16", segments: [{ text: "For God so loved the world." }] },
          opacity: 1,
          transition: { ...kineticTheme.transition, type: "none", duration: 0 },
        },
      })
      await Promise.resolve()
    })

    mockRenderPresentation.mockClear()
    await act(async () => {
      vi.advanceTimersByTime(210)
      await Promise.resolve()
    })
    const kineticCalls = mockRenderPresentation.mock.calls.length
    expect(kineticCalls).toBeGreaterThan(1)
    expect(kineticCalls).toBeLessThanOrEqual(4)

    // Switching to a static theme stops the loop: no further renders accrue.
    await act(async () => {
      listeners.get("broadcast:verse-update")?.({
        payload: {
          theme: makeTheme(),
          item: { reference: "Romans 8:28", segments: [{ text: "All things." }] },
          opacity: 1,
          transition: { ...makeTheme().transition, type: "none", duration: 0 },
        },
      })
      await Promise.resolve()
    })
    mockRenderPresentation.mockClear()
    await act(async () => {
      vi.advanceTimersByTime(120)
      await Promise.resolve()
    })
    expect(mockRenderPresentation.mock.calls.length).toBe(0)

    await act(async () => {
      root.unmount()
    })
  })

  it("preloads an imported slide image into the render cache", async () => {
    const { useBroadcastOutputRuntime } = await import("./use-broadcast-output-runtime")
    const canvas = createCanvas()
    const root = createRoot(document.createElement("div"))
    const theme = makeTheme()
    const slideUrl = "data:image/png;base64,SLIDE"

    const images: Array<{ src: string; onload: (() => void) | null }> = []
    const RealImage = globalThis.Image
    class FakeImage {
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      naturalWidth = 1920
      naturalHeight = 1080
      #src = ""
      constructor() {
        images.push(this as unknown as { src: string; onload: (() => void) | null })
      }
      set src(value: string) {
        this.#src = value
      }
      get src() {
        return this.#src
      }
    }
    globalThis.Image = FakeImage as unknown as typeof Image

    function Probe() {
      useBroadcastOutputRuntime({ canvas, outputId: "main" })
      return null
    }

    try {
      await act(async () => {
        root.render(React.createElement(Probe))
        await Promise.resolve()
      })

      await act(async () => {
        listeners.get("broadcast:verse-update")?.({
          payload: {
            theme,
            item: {
              kind: "slideDeck",
              reference: "Deck - Slide 1",
              segments: [{ text: "Slide 1" }],
              slideImageUrl: slideUrl,
            },
            opacity: 1,
            transition: { ...theme.transition, type: "none", duration: 0 },
          },
        })
        await Promise.resolve()
      })

      const slideImage = images.find((img) => img.src === slideUrl)
      expect(slideImage).toBeDefined()

      mockRenderPresentation.mockClear()
      await act(async () => {
        slideImage?.onload?.()
        await Promise.resolve()
      })

      const lastCall = mockRenderPresentation.mock.calls.at(-1)
      const options = lastCall?.[3] as { imageCache?: Map<string, unknown> } | undefined
      expect(options?.imageCache?.has(slideUrl)).toBe(true)
    } finally {
      globalThis.Image = RealImage
      await act(async () => {
        root.unmount()
      })
    }
  })

  it("evicts the oldest loaded image after the render cache exceeds 20 entries", async () => {
    const { useBroadcastOutputRuntime } = await import("./use-broadcast-output-runtime")
    const canvas = createCanvas()
    const root = createRoot(document.createElement("div"))
    const theme = makeTheme()

    const images: Array<{ src: string; onload: (() => void) | null }> = []
    const RealImage = globalThis.Image
    class FakeImage {
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      naturalWidth = 1920
      naturalHeight = 1080
      #src = ""
      constructor() {
        images.push(this as unknown as { src: string; onload: (() => void) | null })
      }
      set src(value: string) {
        this.#src = value
      }
      get src() {
        return this.#src
      }
    }
    globalThis.Image = FakeImage as unknown as typeof Image

    function Probe() {
      useBroadcastOutputRuntime({ canvas, outputId: "main" })
      return null
    }

    try {
      await act(async () => {
        root.render(React.createElement(Probe))
        await Promise.resolve()
      })

      for (let i = 0; i < 21; i += 1) {
        const slideUrl = `data:image/png;base64,SLIDE_${i}`
        await act(async () => {
          listeners.get("broadcast:verse-update")?.({
            payload: {
              theme,
              item: {
                kind: "slideDeck",
                reference: `Deck - Slide ${i}`,
                segments: [{ text: `Slide ${i}` }],
                slideImageUrl: slideUrl,
              },
              opacity: 1,
              transition: { ...theme.transition, type: "none", duration: 0 },
            },
          })
          await Promise.resolve()
        })

        const slideImage = images.find((img) => img.src === slideUrl)
        await act(async () => {
          slideImage?.onload?.()
          await Promise.resolve()
        })
      }

      const lastCall = mockRenderPresentation.mock.calls.at(-1)
      const options = lastCall?.[3] as { imageCache?: Map<string, unknown> } | undefined
      expect(options?.imageCache?.size).toBe(20)
      expect(options?.imageCache?.has("data:image/png;base64,SLIDE_0")).toBe(false)
      expect(options?.imageCache?.has("data:image/png;base64,SLIDE_20")).toBe(true)
    } finally {
      globalThis.Image = RealImage
      await act(async () => {
        root.unmount()
      })
    }
  })
})
