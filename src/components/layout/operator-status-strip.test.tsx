// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach, beforeAll } from "vitest"
import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { useVerificationStore } from "@/stores/verification-store"

const mockSetLive = vi.fn()
const mockSetLiveVerse = vi.fn()
const mockSelectVerse = vi.fn()
const mockSetReadingModeAutoLive = vi.fn()
const mockSetDetectionPaused = vi.fn().mockResolvedValue(true)
const mockStop = vi.fn()
const mockInvoke = vi.fn().mockResolvedValue(undefined)

vi.mock("@/lib/tauri-runtime", () => ({
  invokeTauri: (...args: unknown[]) => mockInvoke(...args),
}))

vi.mock("@/stores/audio-store", () => ({
  useAudioStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ level: { rms: 0, peak: 0 } }),
}))

let broadcastIsLive = false
let broadcastLiveVerse: unknown = null
let broadcastReadingModeAutoLive = false
let transcriptIsTranscribing = false
let bibleSelectedVerse: unknown = null
let latestOutputIssue: {
  id: string
  outputId: "main" | "alt" | "global"
  kind: string
  title: string
  description: string
} | null = null

const mockClearOutputIssue = vi.fn()

vi.mock("@/stores/broadcast-store", () => {
  const useBroadcastStore = (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      isLive: broadcastIsLive,
      liveItem: broadcastLiveVerse,
      previewItem: null,
      readingModeAutoLive: broadcastReadingModeAutoLive,
      themes: [],
      activeThemeId: "",
      outputIssues: latestOutputIssue ? [latestOutputIssue] : [],
    })
  const selectActiveTheme = (state: { themes: Array<{ id: string }>; activeThemeId: string }) =>
    state.themes.find((theme) => theme.id === state.activeThemeId) ?? state.themes[0] ?? null
  const selectLatestOutputIssue = (state: {
    outputIssues: Array<NonNullable<typeof latestOutputIssue>>
  }) => state.outputIssues[0] ?? null
  useBroadcastStore.getState = () => ({
    setLive: mockSetLive,
    setLiveItem: mockSetLiveVerse,
    setReadingModeAutoLive: mockSetReadingModeAutoLive,
    setPreviewItem: vi.fn(),
    clearOutputIssue: mockClearOutputIssue,
  })
  return { selectActiveTheme, selectLatestOutputIssue, useBroadcastStore }
})

vi.mock("@/stores/transcript-store", () => ({
  useTranscriptStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ isTranscribing: transcriptIsTranscribing }),
}))

vi.mock("@/stores/queue-store", () => ({
  useQueueStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ items: [] }),
}))

vi.mock("@/stores/bible-store", () => {
  const useBibleStore = (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      selectedVerse: bibleSelectedVerse,
    })
  useBibleStore.getState = () => ({ selectVerse: mockSelectVerse })
  return { useBibleStore }
})

vi.mock("@/stores/service-plan-store", () => ({
  useServicePlanStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ activePlan: null }),
}))

vi.mock("@/hooks/use-detection", () => ({
  detectionActions: {
    setDetectionPaused: mockSetDetectionPaused,
    getDetectionControlStatus: () =>
      Promise.resolve({
        detection_paused: false,
      }),
  },
}))

vi.mock("@/hooks/use-transcription", () => ({
  transcriptionActions: { stop: mockStop },
}))

vi.mock("@/components/ui/level-meter", () => ({
  LevelMeter: () => React.createElement("div", { "data-testid": "level-meter" }),
}))

function resetState() {
  broadcastIsLive = false
  broadcastLiveVerse = null
  broadcastReadingModeAutoLive = false
  transcriptIsTranscribing = false
  bibleSelectedVerse = null
  latestOutputIssue = null
}

describe("OperatorStatusStrip emergency controls", () => {
  let OperatorStatusStrip: typeof import("./operator-status-strip").OperatorStatusStrip
  let root: Root | null = null
  let container: HTMLDivElement | null = null

  beforeAll(async () => {
    ;({ OperatorStatusStrip } = await import("./operator-status-strip"))
  })

  beforeEach(() => {
    vi.clearAllMocks()
    resetState()
    useVerificationStore.setState({
      isChurchOrganization: false,
      churchName: null,
    })
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

  async function renderStrip() {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => {
      root?.render(
        React.createElement(OperatorStatusStrip, { actionsLayout: "inline" })
      )
    })
  }

  function getButtonByTitle(title: string): HTMLButtonElement {
    const button = container?.querySelector<HTMLButtonElement>(
      `button[title="${title}"]`
    )
    expect(button).toBeTruthy()
    return button as HTMLButtonElement
  }

  async function click(button: HTMLButtonElement) {
    await act(async () => {
      button.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true })
      )
    })
  }

  describe("Hide Live Output", () => {
    it("is disabled when not live", async () => {
      broadcastIsLive = false
      await renderStrip()
      const btn = getButtonByTitle("Hide live output")
      expect(btn.disabled).toBe(true)
    })

    it("is enabled when live and calls setLive(false) when clicked", async () => {
      broadcastIsLive = true
      broadcastLiveVerse = { reference: "John 3:16" }
      await renderStrip()
      const btn = getButtonByTitle("Hide live output")
      expect(btn.disabled).toBe(false)
      await click(btn)
      expect(mockSetLive).toHaveBeenCalledWith(false)
    })
  })

  describe("Stop Transcription", () => {
    it("is disabled when not transcribing", async () => {
      transcriptIsTranscribing = false
      await renderStrip()
      const btn = getButtonByTitle("Stop transcription")
      expect(btn.disabled).toBe(true)
    })

    it("is enabled when transcribing and calls stop()", async () => {
      transcriptIsTranscribing = true
      broadcastLiveVerse = { reference: "John 3:16" }
      await renderStrip()
      const btn = getButtonByTitle("Stop transcription")
      expect(btn.disabled).toBe(false)
      await click(btn)
      expect(mockStop).toHaveBeenCalled()
    })
  })

  describe("Clear Live Output", () => {
    it("is disabled when no live verse", async () => {
      broadcastLiveVerse = null
      await renderStrip()
      const btn = getButtonByTitle("Clear live")
      expect(btn.disabled).toBe(true)
    })

    it("clears liveItem and hides output when clicked", async () => {
      broadcastLiveVerse = { reference: "John 3:16" }
      broadcastIsLive = true
      await renderStrip()
      const btn = getButtonByTitle("Clear live")
      expect(btn.disabled).toBe(false)
      await click(btn)
      expect(mockSetLiveVerse).toHaveBeenCalledWith(null)
      expect(mockSetLive).toHaveBeenCalledWith(false)
    })
  })

  describe("Clear Preview", () => {
    it("is disabled when no preview verse", async () => {
      bibleSelectedVerse = null
      await renderStrip()
      const btn = getButtonByTitle("Clear preview")
      expect(btn.disabled).toBe(true)
    })

    it("calls selectVerse(null) when clicked", async () => {
      bibleSelectedVerse = { book_number: 1, chapter: 1, verse: 1 }
      await renderStrip()
      const btn = getButtonByTitle("Clear preview")
      expect(btn.disabled).toBe(false)
      await click(btn)
      expect(mockSelectVerse).toHaveBeenCalledWith(null)
    })
  })

  describe("Pause Auto-Live", () => {
    it("is disabled when auto-live is off", async () => {
      broadcastReadingModeAutoLive = false
      await renderStrip()
      const btn = getButtonByTitle("Pause auto-live")
      expect(btn.disabled).toBe(true)
    })

    it("sets readingModeAutoLive false and invokes stop_reading_mode", async () => {
      broadcastReadingModeAutoLive = true
      await renderStrip()
      const btn = getButtonByTitle("Pause auto-live")
      expect(btn.disabled).toBe(false)
      await click(btn)
      expect(mockSetReadingModeAutoLive).toHaveBeenCalledWith(false)
      expect(mockInvoke).toHaveBeenCalledWith("stop_reading_mode")
    })
  })

  describe("Output issue warning", () => {
    it("shows a warning chip when an unresolved output issue exists", async () => {
      latestOutputIssue = {
        id: "main:broadcast-sync",
        outputId: "main",
        kind: "broadcast-sync",
        title: "Broadcast sync failed",
        description: "Could not sync live output to broadcast",
      }
      await renderStrip()

      const chip = container?.querySelector("button[title*='Could not sync']")
      expect(chip?.textContent).toContain("Main: Broadcast sync failed")
    })

    it("clears the issue when the warning chip is clicked", async () => {
      latestOutputIssue = {
        id: "global:persistence",
        outputId: "global",
        kind: "persistence",
        title: "Settings save failed",
        description: "Could not save settings to disk.",
      }
      await renderStrip()

      const chip = container?.querySelector<HTMLButtonElement>(
        "button[title='Could not save settings to disk.']",
      )
      expect(chip).toBeTruthy()
      await click(chip as HTMLButtonElement)
      expect(mockClearOutputIssue).toHaveBeenCalledWith("global:persistence")
    })
  })

  describe("Church organization badge", () => {
    it("shows the self-declared church name for an organization account", async () => {
      useVerificationStore.setState({
        isChurchOrganization: true,
        churchName: "Central SDA Church",
      })
      await renderStrip()

      expect(container?.textContent).toContain("Church · Central SDA Church")
    })
  })

  describe("Pause/Resume Suggestions", () => {
    it("calls setDetectionPaused(true) when Pause suggestions is clicked", async () => {
      await renderStrip()
      await click(getButtonByTitle("Pause suggestions"))
      expect(mockSetDetectionPaused).toHaveBeenCalledWith(true)
    })

    it("calls setDetectionPaused(false) when Resume suggestions is clicked", async () => {
      await renderStrip()
      await click(getButtonByTitle("Pause suggestions"))
      await act(async () => {
        await Promise.resolve()
      })
      await click(getButtonByTitle("Resume suggestions"))
      expect(mockSetDetectionPaused).toHaveBeenCalledWith(false)
    })
  })
})
