// @vitest-environment jsdom
import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest"
import type { BroadcastTheme } from "@/types"
import type { ServiceContext } from "@/types/service-plan"

const mockSetDesignerOpen = vi.fn()
const mockClosePlanner = vi.fn()
const mockSetWorkspace = vi.fn()

const broadcastState = {
  isLive: true,
  liveItem: {
    reference: "John 3:16",
    segments: [{ text: "For God so loved the world", verseNumber: 16 }],
  },
  previewItem: {
    reference: "Psalm 23:1",
    segments: [{ text: "The Lord is my shepherd", verseNumber: 1 }],
  },
  themes: [
    {
      id: "theme-1",
      name: "Broadcast Overlay",
    } as BroadcastTheme,
  ],
  activeThemeId: "theme-1",
  outputIssues: [
    {
      id: "main:ndi-frame",
      outputId: "main" as const,
      kind: "ndi-frame" as const,
      title: "NDI frame push failed",
      description: "Could not send the latest frame.",
      firstSeenAt: 1,
      lastSeenAt: 2,
      count: 1,
    },
  ],
}

const serviceContext: ServiceContext = {
  planId: "plan-1",
  planTitle: "Sabbath Service",
  planStatus: "live",
  mode: "performance",
  activeItem: {
    id: "item-1",
    title: "Scripture Reading",
    kind: "scripture",
    notes: "Read slowly",
    expectedReferences: ["John 3:16"],
  },
  nextItem: {
    id: "item-2",
    title: "Closing Hymn",
    kind: "hymn",
    notes: "",
    expectedReferences: [],
  },
  operatorNotes: "Keep lower thirds ready.",
  expectedReferences: ["John 3:16", "Psalm 23:1"],
  hymnSummaries: [],
  mediaSummaries: [],
  outputTemplateId: null,
  performanceMode: true,
}

vi.mock("@/components/panels/preview-panel", () => ({
  PreviewPanel: () =>
    React.createElement(
      "section",
      { "data-testid": "preview-panel" },
      "Program Preview"
    ),
}))

vi.mock("@/components/panels/live-output-panel", () => ({
  LiveOutputPanel: () =>
    React.createElement(
      "section",
      { "data-testid": "live-output-panel" },
      "Live Output"
    ),
}))

vi.mock("@/components/panels/transcript-panel", () => ({
  TranscriptPanel: () =>
    React.createElement(
      "section",
      { "data-testid": "transcript-panel" },
      "Transcript"
    ),
}))

vi.mock("@/components/panels/queue-panel", () => ({
  QueuePanel: () =>
    React.createElement("section", { "data-testid": "queue-panel" }, "Queue"),
}))

vi.mock("@/components/broadcast/broadcast-settings", () => ({
  BroadcastSettings: ({ open }: { open: boolean }) =>
    open
      ? React.createElement(
          "div",
          { "data-testid": "broadcast-settings" },
          "Broadcast Settings Dialog"
        )
      : null,
}))

vi.mock("@/components/broadcast/theme-designer", () => ({
  ThemeDesigner: () =>
    React.createElement(
      "div",
      { "data-testid": "theme-designer" },
      "Theme Designer Dialog"
    ),
}))

vi.mock("@/stores/broadcast-store", () => {
  const useBroadcastStore = (
    selector: (state: typeof broadcastState) => unknown
  ) => selector(broadcastState)
  useBroadcastStore.getState = () => ({
    setDesignerOpen: mockSetDesignerOpen,
  })
  const selectActiveTheme = (state: typeof broadcastState) =>
    state.themes.find((theme) => theme.id === state.activeThemeId) ?? null
  const selectLatestOutputIssue = (state: typeof broadcastState) =>
    state.outputIssues[0] ?? null
  return { selectActiveTheme, selectLatestOutputIssue, useBroadcastStore }
})

vi.mock("@/stores/service-plan-store", () => ({
  useServicePlanStore: Object.assign(
    (selector: (state: { serviceContext: ServiceContext }) => unknown) =>
      selector({ serviceContext }),
    {
      getState: () => ({ closePlanner: mockClosePlanner }),
    }
  ),
}))

vi.mock("@/stores/dashboard-workspace-store", () => ({
  useDashboardWorkspaceStore: {
    getState: () => ({ setWorkspace: mockSetWorkspace }),
  },
}))

describe("LiveServicePlanPage", () => {
  let LiveServicePlanPage: typeof import("./LiveServicePlanPage").LiveServicePlanPage
  let root: Root | null = null
  let container: HTMLDivElement | null = null

  beforeAll(async () => {
    ;({ LiveServicePlanPage } = await import("./LiveServicePlanPage"))
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root?.unmount()
      })
    }
    container?.remove()
    root = null
    container = null
  })

  async function renderPage() {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => {
      root?.render(React.createElement(LiveServicePlanPage))
    })
  }

  function text(): string {
    return container?.textContent ?? ""
  }

  function clickButton(label: string) {
    const button = Array.from(
      container?.querySelectorAll<HTMLButtonElement>("button") ?? []
    ).find((candidate) => candidate.textContent?.includes(label))
    expect(button).toBeTruthy()
    button?.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true })
    )
  }

  it("keeps the broadcast screen focused on output control and confidence monitors", async () => {
    await renderPage()

    expect(text()).toContain("Production Output")
    expect(text()).toContain("Broadcast settings")
    expect(text()).toContain("Kinetic themes")
    expect(text()).toContain("Theme designer")
    expect(
      container?.querySelector('[data-testid="preview-panel"]')
    ).toBeTruthy()
    expect(
      container?.querySelector('[data-testid="live-output-panel"]')
    ).toBeTruthy()
    expect(
      container?.querySelector('[data-testid="transcript-panel"]')
    ).toBeNull()
    expect(container?.querySelector('[data-testid="queue-panel"]')).toBeNull()
  })

  it("shows compact output and service signal summaries", async () => {
    await renderPage()

    expect(text()).toContain("Output Status")
    expect(text()).toContain("Broadcast Overlay")
    expect(text()).toContain("Psalm 23:1")
    expect(text()).toContain("John 3:16")
    expect(text()).toContain("NDI frame push failed")
    expect(text()).toContain("Service Signal")
    expect(text()).toContain("Scripture Reading")
    expect(text()).toContain("Closing Hymn")
  })

  it("opens lazy broadcast tools from the page actions", async () => {
    await renderPage()

    await act(async () => {
      clickButton("Broadcast settings")
      await Promise.resolve()
    })
    expect(
      container?.querySelector('[data-testid="broadcast-settings"]')
    ).toBeTruthy()

    await act(async () => {
      clickButton("Kinetic themes")
      await Promise.resolve()
    })
    expect(mockClosePlanner).toHaveBeenCalled()
    expect(mockSetWorkspace).toHaveBeenCalledWith("kinetic-themes")

    await act(async () => {
      clickButton("Theme designer")
      await Promise.resolve()
    })
    expect(mockSetDesignerOpen).toHaveBeenCalledWith(true)
    expect(
      container?.querySelector('[data-testid="theme-designer"]')
    ).toBeTruthy()
  })
})
