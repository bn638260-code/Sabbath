// @vitest-environment jsdom
import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { readFileSync } from "node:fs"
import path from "node:path"
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/components/ui/canvas-verse", () => ({
  CanvasPresentation: () => React.createElement("div", { "data-testid": "canvas-presentation" }),
}))

vi.mock("@/components/broadcast/VideoControlBar", () => ({
  VideoControlBar: () => React.createElement("div", { "data-testid": "video-control-bar" }),
}))

vi.mock("@/lib/presentation-workflow", () => ({
  commitPreviewToLive: vi.fn(),
  presentItem: vi.fn(),
}))

const setWindowFullscreenMock = vi.fn().mockResolvedValue(undefined)
const setLiveTransitionTypeMock = vi.fn()
let broadcastState: Record<string, unknown>
vi.mock("./live-output-panel-fullscreen", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("./live-output-panel-fullscreen")>()
  return {
    ...actual,
    tauriWindowFullscreen: (fullscreen: boolean) =>
      setWindowFullscreenMock(fullscreen) as Promise<void>,
  }
})

vi.mock("@/stores/broadcast-store", () => {
  const useBroadcastStore = (selector: (state: Record<string, unknown>) => unknown) =>
    selector(broadcastState)
  const selectActiveTheme = (state: Record<string, unknown>) => state.activeTheme
  useBroadcastStore.getState = () => ({
    setLive: vi.fn(),
    setReadingModeAutoLive: vi.fn(),
    setLiveTransitionType: setLiveTransitionTypeMock,
  })
  return { selectActiveTheme, useBroadcastStore }
})

vi.mock("@/stores/egw-slide-store", () => ({
  useEgwSlideStore: { getState: () => ({ deck: [], setDeck: vi.fn() }) },
}))
vi.mock("@/stores/hymn-slide-store", () => ({
  useHymnSlideStore: { getState: () => ({ deck: [], setDeck: vi.fn() }) },
}))
vi.mock("@/stores/sermon-slide-store", () => ({
  useSermonSlideStore: {
    getState: () => ({ deck: [], setDeck: vi.fn(), activeItemId: null }),
  },
}))

describe("LiveOutputPanel fullscreen chrome contract", () => {
  let LiveOutputPanel: typeof import("./live-output-panel").LiveOutputPanel
  let container: HTMLDivElement
  let root: Root

  beforeAll(async () => {
    ;({ LiveOutputPanel } = await import("./live-output-panel"))
  })

  beforeEach(() => {
    setLiveTransitionTypeMock.mockClear()
    broadcastState = {
      isLive: false,
      liveItem: null,
      previewItem: null,
      readingModeAutoLive: false,
      liveTransitionType: "fade",
      themes: [],
      activeThemeId: "",
      activeTheme: null,
    }
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    container.remove()
    vi.restoreAllMocks()
  })

  const renderPanel = () => {
    act(() => {
      root.render(React.createElement(LiveOutputPanel))
    })
    const panel = container.querySelector('[data-slot="live-output-panel"]')
    expect(panel).not.toBeNull()
    return panel as HTMLElement
  }

  it("tags the presentation stage as a direct child so fullscreen CSS can isolate it", () => {
    // The fullscreen CSS hides every direct child of the panel except the
    // stage. If the stage stops being a tagged direct child, fullscreen
    // would show panel chrome again (header, switches, the top border).
    const panel = renderPanel()
    const stage = panel.querySelector(':scope > [data-slot="live-output-stage"]')
    expect(stage).not.toBeNull()
    expect(stage?.parentElement).toBe(panel)
    expect(stage?.querySelector('[data-slot="live-output-frame"]')).not.toBeNull()
    // There is chrome besides the stage; it must all be sibling-level so the
    // :fullscreen > *:not(stage) rule can hide it.
    expect(panel.children.length).toBeGreaterThan(1)
  })

  it("offers live transition choices", () => {
    renderPanel()

    expect(container.querySelector('[aria-label="Live transition"]')).not.toBeNull()
    const cut = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Cut",
    )
    expect(cut).not.toBeNull()

    act(() => {
      cut?.click()
    })
    expect(setLiveTransitionTypeMock).toHaveBeenCalledWith("none")
  })

  it("renders live video media instead of the text canvas", () => {
    broadcastState = {
      ...broadcastState,
      isLive: true,
      liveItem: {
        kind: "video",
        reference: "Welcome Video",
        segments: [{ text: "Welcome Video" }],
        video: {
          source: "url",
          videoId: "video-1",
          title: "Welcome Video",
          url: "https://cdn.example.com/welcome.mp4",
        },
      },
      activeTheme: { id: "theme-1" },
    }

    renderPanel()

    const video = container.querySelector("video")
    expect(video).not.toBeNull()
    expect(video?.getAttribute("src")).toBe("https://cdn.example.com/welcome.mp4")
    expect(container.querySelector("[data-testid='canvas-presentation']")).toBeNull()
    expect(container.querySelector("[data-testid='video-control-bar']")).not.toBeNull()
    expect(container.querySelector("[data-slot='live-output-anim']")?.className).toContain(
      "live-anim-fade",
    )
  })

  it("drives Tauri window fullscreen and applies the layout attribute synchronously", async () => {
    const panel = renderPanel()
    expect(panel.dataset.fullscreenLayout).toBeUndefined()

    const button = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Enter fullscreen"]',
    )
    expect(button).not.toBeNull()

    await act(async () => {
      button?.click()
    })
    expect(setWindowFullscreenMock).toHaveBeenCalledWith(true)
    expect(panel.dataset.fullscreenLayout).toBe("true")

    // Escape leaves fullscreen (window fullscreen has no built-in handling).
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }))
    })
    expect(setWindowFullscreenMock).toHaveBeenCalledWith(false)
    expect(panel.dataset.fullscreenLayout).toBeUndefined()
  })
})

describe("fullscreen stylesheet contract", () => {
  const css = readFileSync(path.resolve(__dirname, "../../index.css"), "utf8")

  it("strips the panel border, blur, and transitions in fullscreen", () => {
    const rule = css.match(
      /\[data-slot="live-output-panel"\]\[data-fullscreen-layout="true"\],\s*\[data-slot="live-output-panel"\]:fullscreen \{[^}]*\}/,
    )?.[0]
    expect(rule).toBeDefined()
    expect(rule).toContain("border: 0 !important")
    expect(rule).toContain("backdrop-filter: none !important")
    expect(rule).toContain("transition: none !important")
  })

  it("hides all panel chrome except the stage in fullscreen", () => {
    expect(css).toContain(
      '[data-slot="live-output-panel"][data-fullscreen-layout="true"] > *:not([data-slot="live-output-stage"])',
    )
  })

  it("removes the frame border so no hairline shows at the top of the output", () => {
    const rule = css.match(
      /\[data-slot="live-output-panel"\]\[data-fullscreen-layout="true"\] \[data-slot="live-output-frame"\][^{]*\{[^}]*\}/,
    )?.[0]
    expect(rule).toBeDefined()
    expect(rule).toContain("border: 0 !important")
  })
})

describe("liveTransitionClass", () => {
  it("maps the selected transition to a preview animation class", async () => {
    const { liveTransitionClass } = await import("./live-output-panel")
    expect(liveTransitionClass("fade")).toBe("live-anim-fade")
    expect(liveTransitionClass("slide")).toBe("live-anim-slide")
    expect(liveTransitionClass("scale")).toBe("live-anim-scale")
    expect(liveTransitionClass("none")).toBe("")
  })
})
